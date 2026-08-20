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
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  const organizationId =
    req.user?.organizationId?.trim();

  return organizationId || null;
};

const getParam = (
  value: string | string[] | undefined
): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : "";

    const documents =
      await prisma.document.findMany({
        where: {
          organizationId,

          ...(search
            ? {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    documentCode: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    category: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    uploadedBy: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),

          ...(category
            ? {
                category: {
                  equals: category,
                  mode: "insensitive",
                },
              }
            : {}),
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    const categories = [
      ...new Set(
        documents.map(
          (document) =>
            document.category
        )
      ),
    ].sort();

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents,
      categories,
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

    return res.status(200).json({
      success: true,
      document,
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

      const {
        documentCode,
        fileName,
        mimeType,
      } = req.body;

      if (
        typeof documentCode !==
          "string" ||
        !documentCode.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Document code is required",
        });
      }

      if (
        typeof fileName !==
          "string" ||
        !fileName.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "File name is required",
        });
      }

      const normalizedCode =
        documentCode
          .trim()
          .toUpperCase();

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

      const normalizedMimeType =
        typeof mimeType === "string" &&
        mimeType.trim()
          ? mimeType.trim()
          : undefined;

      /*
       * The backend controls the complete
       * storage path.
       *
       * The browser cannot choose another
       * organization's storage location.
       */
      const storageKey =
        buildDocumentStorageKey(
          organizationId,
          normalizedCode,
          fileName.trim()
        );

      const uploadUrl =
        await generateDocumentUploadUrl(
          storageKey,
          normalizedMimeType
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

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message:
          "Organization context is required",
      });
    }

    const {
      documentCode,
      name,
      category,
      uploadedBy,
      mimeType,
      fileSize,
      storageKey,
    } = req.body;

    if (
      typeof documentCode !==
        "string" ||
      !documentCode.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Document code is required",
      });
    }

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Document name is required",
      });
    }

    if (
      typeof category !==
        "string" ||
      !category.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Document category is required",
      });
    }

    if (
      typeof uploadedBy !==
        "string" ||
      !uploadedBy.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Uploaded by is required",
      });
    }

    if (
      typeof storageKey !==
        "string" ||
      !storageKey.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Storage key is required",
      });
    }

    const normalizedCode =
      documentCode
        .trim()
        .toUpperCase();

    /*
     * Critical tenant-isolation check.
     *
     * The submitted storage key must belong
     * to the authenticated organization and
     * document code.
     */
    const expectedPrefix =
      `organizations/${organizationId}/documents/${normalizedCode}/`;

    if (
      !storageKey
        .trim()
        .startsWith(
          expectedPrefix
        )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Invalid document storage location",
      });
    }

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

    let normalizedFileSize:
      number | null = null;

    if (
      fileSize !== undefined &&
      fileSize !== null &&
      fileSize !== ""
    ) {
      const parsedFileSize =
        Number(fileSize);

      if (
        !Number.isInteger(
          parsedFileSize
        ) ||
        parsedFileSize < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "File size must be a valid non-negative integer",
        });
      }

      normalizedFileSize =
        parsedFileSize;
    }

    const document =
      await prisma.document.create({
        data: {
          organizationId,

          documentCode:
            normalizedCode,

          name:
            name.trim(),

          category:
            category.trim(),

          uploadedBy:
            uploadedBy.trim(),

          mimeType:
            typeof mimeType ===
              "string" &&
            mimeType.trim()
              ? mimeType.trim()
              : null,

          fileSize:
            normalizedFileSize,

          storageKey:
            storageKey.trim(),
        },
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

    return res.status(500).json({
      success: false,
      message:
        "Failed to create document",
    });
  }
};

/* =========================================================
   DOWNLOAD DOCUMENT
========================================================= */

export const downloadDocument =
  async (
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

      if (!document.storageKey) {
        return res.status(404).json({
          success: false,
          message:
            "Document file is not available",
        });
      }

      const downloadUrl =
        await createDocumentDownloadUrl(
          document.storageKey,
          document.name,
          document.mimeType
        );

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
     * Delete the physical file first.
     *
     * Database metadata is only deleted
     * after the storage object deletion
     * succeeds.
     */
    if (document.storageKey) {
      await deleteDocumentObject(
        document.storageKey
      );
    }

    await prisma.document.delete({
      where: {
        id: document.id,
      },
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