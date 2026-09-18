import { Response } from "express";

import prisma from "../config/prisma";

import {
  AuthRequest,
} from "../middleware/auth.middleware";

import {
  buildDocumentStorageKey,
  createDocumentUploadUrl as generateDocumentUploadUrl,
  createDocumentDownloadUrl,
  deleteDocumentObject,
} from "../services/documentStorage.service";

/* =========================================================
   TYPES
========================================================= */

type DocumentAction =
  | "CREATE"
  | "VIEW"
  | "DOWNLOAD"
  | "DELETE";

type PageSize = 25 | 50 | 100;

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  const organizationId =
    req.user?.organizationId?.trim();

  return organizationId || null;
};

const getUserId = (
  req: AuthRequest
): string => {
  return (
    req.user?.userId?.trim() ||
    "SYSTEM"
  );
};

const getParam = (
  value: unknown
): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return "";
};

const getPositiveInteger = (
  value: unknown,
  fallback: number
): number => {
  const raw = getParam(value).trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return parsed;
};

const getPageSize = (
  value: unknown
): PageSize => {
  const parsed =
    getPositiveInteger(value, 25);

  if (parsed === 100) {
    return 100;
  }

  if (parsed === 50) {
    return 50;
  }

  return 25;
};

const cleanString = (
  value: unknown
): string => {
  return typeof value === "string"
    ? value.trim()
    : "";
};

const normalizeDocumentCode = (
  value: string
): string => {
  return value
    .trim()
    .toUpperCase();
};

const getMimeType = (
  value: unknown
): string | null => {
  const mimeType = cleanString(value);

  return mimeType || null;
};

const parseFileSize = (
  value: unknown
): number | null => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
};

/* =========================================================
   AUDIT HELPER
========================================================= */

const createDocumentAudit = async ({
  organizationId,
  userId,
  action,
  documentId,
  documentCode,
  documentName,
  category,
}: {
  organizationId: string;
  userId: string;
  action: DocumentAction;
  documentId?: string;
  documentCode?: string;
  documentName?: string;
  category?: string;
}) => {
  try {
    const details = {
      documentId:
        documentId ?? null,
      documentCode:
        documentCode ?? null,
      documentName:
        documentName ?? null,
      category:
        category ?? null,
    };

    await prisma.auditTrail.create({
      data: {
        organizationId,
        user: userId,
        action,
        module: "DOCUMENT",
        details: JSON.stringify(details),
      },
    });
  } catch (error) {
    /*
     * Audit logging must never cause a successful
     * document operation to fail.
     *
     * The error is logged for operational visibility.
     */
    console.error(
      "DOCUMENT AUDIT ERROR:",
      error
    );
  }
};

/* =========================================================
   GET DOCUMENTS
========================================================= */

export const getDocuments = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message:
          "Organization context is required",
      });
    }

    const search =
      cleanString(req.query.search);

    const category =
      cleanString(req.query.category);

    const page =
      getPositiveInteger(
        req.query.page,
        1
      );

    const pageSize =
      getPageSize(
        req.query.pageSize
      );

    /*
     * Search is intentionally performed only
     * against document metadata.
     *
     * The actual file contents remain private
     * in object storage.
     */
    const where = {
      organizationId,

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                documentCode: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                category: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                uploadedBy: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),

      ...(category
        ? {
            category: {
              equals: category,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    /*
     * Fetch the requested page and total count
     * concurrently.
     */
    const [
      total,
      documents,
      categoryRows,
    ] = await Promise.all([
      prisma.document.count({
        where,
      }),

      prisma.document.findMany({
        where,

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        skip:
          (page - 1) * pageSize,

        take: pageSize,
      }),

      /*
       * Categories are organization-wide rather
       * than limited to the current page.
       */
      prisma.document.findMany({
        where: {
          organizationId,
        },

        distinct: [
          "category",
        ],

        select: {
          category: true,
        },

        orderBy: {
          category: "asc",
        },
      }),
    ]);

    /*
     * Resolve actual users for the current page.
     *
     * Historical documents may contain SYSTEM or
     * legacy uploader values, so resolution is
     * deliberately defensive.
     */
    const uploaderIds =
      Array.from(
        new Set(
          documents
            .map(
              (document) =>
                document.uploadedBy
            )
            .filter(
              (value) =>
                Boolean(value) &&
                value !== "SYSTEM"
            )
        )
      );

    const uploaderUsers =
      uploaderIds.length > 0
        ? await prisma.user.findMany({
            where: {
              id: {
                in: uploaderIds,
              },

              memberships: {
                some: {
                  organizationId,
                  isActive: true,
                },
              },
            },

            select: {
              id: true,
              name: true,
              email: true,
            },
          })
        : [];

    const uploaderMap =
      new Map(
        uploaderUsers.map(
          (user) => [
            user.id,
            user,
          ]
        )
      );

    const serializedDocuments =
      documents.map(
        (document) => {
          const uploader =
            uploaderMap.get(
              document.uploadedBy
            );

          return {
            ...document,

            uploadedBy:
              document.uploadedBy,

            uploader: uploader
              ? {
                  id: uploader.id,
                  name:
                    uploader.name,
                  email:
                    uploader.email,
                }
              : null,
          };
        }
      );

    const totalPages =
      total > 0
        ? Math.ceil(
            total / pageSize
          )
        : 0;

    /*
     * Summary statistics are intentionally
     * organization-wide and independent of
     * the current page/filter.
     */
    const [
      organizationDocumentCount,
      organizationCategoryCount,
    ] = await Promise.all([
      prisma.document.count({
        where: {
          organizationId,
        },
      }),

      prisma.document.findMany({
        where: {
          organizationId,
        },

        distinct: [
          "category",
        ],

        select: {
          category: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,

      count:
        serializedDocuments.length,

      documents:
        serializedDocuments,

      categories:
        categoryRows.map(
          (row) =>
            row.category
        ),

      totals: {
        documents:
          organizationDocumentCount,

        categories:
          organizationCategoryCount.length,
      },

      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPreviousPage:
          page > 1,

        hasNextPage:
          page < totalPages,
      },

      filters: {
        search,
        category,
      },
    });
  } catch (error) {
    console.error(
      "GET DOCUMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch documents",
    });
  }
};

/* =========================================================
   GET DOCUMENT BY ID
========================================================= */

export const getDocumentById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const id =
      getParam(
        req.params.id
      ).trim();

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message:
          "Organization context is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Document ID is required",
      });
    }

    const document =
      await prisma.document.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!document) {
      return res.status(404).json({
        success: false,
        message:
          "Document not found",
      });
    }

    /*
     * Resolve the uploader only inside the
     * authenticated organization.
     */
    let uploader: {
      id: string;
      name: string;
      email: string;
    } | null = null;

    if (
      document.uploadedBy &&
      document.uploadedBy !== "SYSTEM"
    ) {
      uploader =
        await prisma.user.findFirst({
          where: {
            id: document.uploadedBy,

            memberships: {
              some: {
                organizationId,
                isActive: true,
              },
            },
          },

          select: {
            id: true,
            name: true,
            email: true,
          },
        });
    }

    /*
     * Viewing metadata is an auditable action.
     */
    await createDocumentAudit({
      organizationId,
      userId:
        getUserId(req),
      action: "VIEW",
      documentId:
        document.id,
      documentCode:
        document.documentCode,
      documentName:
        document.name,
      category:
        document.category,
    });

    return res.status(200).json({
      success: true,

      document: {
        ...document,

        uploader: uploader
          ? {
              id: uploader.id,
              name:
                uploader.name,
              email:
                uploader.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error(
      "GET DOCUMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch document",
    });
  }
};

/* =========================================================
   CREATE DOCUMENT UPLOAD URL
========================================================= */

export const createDocumentUploadUrl =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Organization context is required",
        });
      }

      /*
       * Safely handle an absent request body.
       */
      const body =
        req.body &&
        typeof req.body === "object"
          ? req.body
          : {};

      const documentCode =
        cleanString(
          body.documentCode
        );

      const fileName =
        cleanString(
          body.fileName
        );

      const mimeType =
        getMimeType(
          body.mimeType
        );

      if (!documentCode) {
        return res.status(400).json({
          success: false,
          message:
            "Document code is required",
        });
      }

      if (!fileName) {
        return res.status(400).json({
          success: false,
          message:
            "File name is required",
        });
      }

      const normalizedCode =
        normalizeDocumentCode(
          documentCode
        );

      /*
       * Prevent duplicate document codes
       * within the current tenant.
       */
      const existing =
        await prisma.document.findFirst({
          where: {
            organizationId,
            documentCode:
              normalizedCode,
          },

          select: {
            id: true,
          },
        });

      if (existing) {
        return res.status(409).json({
          success: false,
          message:
            "Document code already exists in this organization",
        });
      }

      /*
       * The backend controls the entire storage
       * path. The browser cannot select another
       * organization's storage namespace.
       */
      const storageKey =
        buildDocumentStorageKey(
          organizationId,
          normalizedCode,
          fileName
        );

      const uploadUrl =
        await generateDocumentUploadUrl(
          storageKey,
          mimeType ?? undefined
        );

      return res.status(200).json({
        success: true,

        upload: {
          url: uploadUrl,
          expiresIn: 900,
          storageKey,
        },
      });
    } catch (error) {
      console.error(
        "CREATE DOCUMENT UPLOAD URL ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to create document upload URL",
      });
    }
  };

/* =========================================================
   CREATE DOCUMENT
========================================================= */

export const createDocument = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const authenticatedUserId =
      getUserId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message:
          "Organization context is required",
      });
    }

    if (
      authenticatedUserId ===
      "SYSTEM"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user context is required",
      });
    }

    /*
     * Safely handle an absent request body.
     */
    const body =
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};

    const documentCode =
      cleanString(
        body.documentCode
      );

    const name =
      cleanString(
        body.name
      );

    const category =
      cleanString(
        body.category
      );

    const mimeType =
      getMimeType(
        body.mimeType
      );

    const storageKey =
      cleanString(
        body.storageKey
      );

    if (!documentCode) {
      return res.status(400).json({
        success: false,
        message:
          "Document code is required",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message:
          "Document name is required",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message:
          "Document category is required",
      });
    }

    if (!storageKey) {
      return res.status(400).json({
        success: false,
        message:
          "Storage key is required",
      });
    }

    const normalizedCode =
      normalizeDocumentCode(
        documentCode
      );

    /*
     * Critical tenant-isolation check.
     *
     * The submitted storage key must belong
     * to the authenticated organization and
     * requested document code.
     */
    const expectedPrefix =
      `organizations/${organizationId}/documents/${normalizedCode}/`;

    if (
      !storageKey.startsWith(
        expectedPrefix
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Invalid document storage location",
      });
    }

    /*
     * Validate that the authenticated user
     * actually belongs to the organization.
     */
    const membership =
      await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId:
            authenticatedUserId,
          isActive: true,
        },

        select: {
          id: true,
        },
      });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message:
          "You are not an active member of this organization",
      });
    }

    /*
     * Prevent duplicate document codes.
     */
    const existing =
      await prisma.document.findFirst({
        where: {
          organizationId,
          documentCode:
            normalizedCode,
        },

        select: {
          id: true,
        },
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Document code already exists in this organization",
      });
    }

    const normalizedFileSize =
      parseFileSize(
        body.fileSize
      );

    if (
      body.fileSize !==
        undefined &&
      body.fileSize !==
        null &&
      body.fileSize !==
        ""
    ) {
      const parsed =
        Number(
          body.fileSize
        );

      if (
        !Number.isInteger(
          parsed
        ) ||
        parsed < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "File size must be a valid non-negative integer",
        });
      }
    }

    /*
     * IMPORTANT:
     *
     * uploadedBy is NOT accepted from the browser.
     *
     * The authenticated session is the source
     * of truth.
     */
    const document =
      await prisma.document.create({
        data: {
          organizationId,

          documentCode:
            normalizedCode,

          name,

          category,

          uploadedBy:
            authenticatedUserId,

          mimeType,

          fileSize:
            normalizedFileSize,

          storageKey,
        },
      });

    /*
     * Record the upload in the central
     * organization audit trail.
     */
    await createDocumentAudit({
      organizationId,
      userId:
        authenticatedUserId,
      action: "CREATE",
      documentId:
        document.id,
      documentCode:
        document.documentCode,
      documentName:
        document.name,
      category:
        document.category,
    });

    return res.status(201).json({
      success: true,

      message:
        "Document created successfully",

      document,
    });
  } catch (error: any) {
    console.error(
      "CREATE DOCUMENT ERROR:",
      error
    );

    if (
      error?.code ===
      "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Document code already exists in this organization",
      });
    }

    if (
      error?.code ===
      "P2003"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "The organization associated with your session does not exist.",
      });
    }

    if (
      error?.code ===
      "P2021"
    ) {
      return res.status(500).json({
        success: false,
        message:
          "The Document database table is not available.",
      });
    }

    if (
      error?.code ===
      "P2022"
    ) {
      return res.status(500).json({
        success: false,
        message:
          "The Document database structure is out of date.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to create document",
    });
  }
};

/* =========================================================
   DOWNLOAD / VIEW DOCUMENT
========================================================= */

export const downloadDocument =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const authenticatedUserId =
        getUserId(req);

      const id =
        getParam(
          req.params.id
        ).trim();

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Organization context is required",
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Document ID is required",
        });
      }

      const document =
        await prisma.document.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!document) {
        return res.status(404).json({
          success: false,
          message:
            "Document not found",
        });
      }

      if (!document.storageKey) {
        return res.status(404).json({
          success: false,
          message:
            "Document file is not available",
        });
      }

      /*
       * ?view=1 requests an inline browser URL.
       * Otherwise the signed URL is generated
       * for download.
       */
      const view =
        req.query.view === "1";

      const downloadUrl =
        await createDocumentDownloadUrl(
          document.storageKey,
          document.name,
          document.mimeType,
          view
        );

      /*
       * VIEW and DOWNLOAD are distinct audit
       * actions so the organization can see
       * how its documents are being accessed.
       */
      await createDocumentAudit({
        organizationId,
        userId:
          authenticatedUserId,
        action:
          view
            ? "VIEW"
            : "DOWNLOAD",
        documentId:
          document.id,
        documentCode:
          document.documentCode,
        documentName:
          document.name,
        category:
          document.category,
      });

      return res.status(200).json({
        success: true,

        download: {
          url: downloadUrl,
          expiresIn: 300,
        },
      });
    } catch (error) {
      console.error(
        "DOWNLOAD DOCUMENT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate document download URL",
      });
    }
  };

/* =========================================================
   DELETE DOCUMENT
========================================================= */

export const deleteDocument = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const authenticatedUserId =
      getUserId(req);

    const id =
      getParam(
        req.params.id
      ).trim();

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message:
          "Organization context is required",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Document ID is required",
      });
    }

    const document =
      await prisma.document.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!document) {
      return res.status(404).json({
        success: false,
        message:
          "Document not found",
      });
    }

    /*
     * Delete the physical object first.
     *
     * Database metadata is removed only after
     * storage deletion succeeds.
     */
    if (document.storageKey) {
      await deleteDocumentObject(
        document.storageKey
      );
    }

    await prisma.document.delete({
      where: {
        id:
          document.id,
      },
    });

    /*
     * Keep the deleted document's identifying
     * information in the audit trail even though
     * its database record no longer exists.
     */
    await createDocumentAudit({
      organizationId,
      userId:
        authenticatedUserId,
      action: "DELETE",
      documentId:
        document.id,
      documentCode:
        document.documentCode,
      documentName:
        document.name,
      category:
        document.category,
    });

    return res.status(200).json({
      success: true,
      message:
        "Document deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE DOCUMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete document",
    });
  }
};



