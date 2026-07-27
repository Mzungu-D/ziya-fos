import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

const normalizeOptionalString = (
  value: unknown
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized.length > 0
    ? normalized
    : null;
};

/* =========================================================
   GET ALL ACCOUNTS
========================================================= */

export const getAccounts = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId,
        },

        include: {
          parent: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          children: {
            where: {
              organizationId,
            },

            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
        },

        orderBy: {
          code: "asc",
        },
      });

    return res.status(200).json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error(
      "GET ACCOUNTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load accounts",
    });
  }
};

/* =========================================================
   GET ONE ACCOUNT
========================================================= */

export const getAccount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = String(req.params.id);

    const account =
      await prisma.account.findFirst({
        where: {
          id,
          organizationId,
        },

        include: {
          parent: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          children: {
            where: {
              organizationId,
            },

            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
        },
      });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    return res.status(200).json({
      success: true,
      account,
    });
  } catch (error) {
    console.error(
      "GET ACCOUNT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load account",
    });
  }
};

/* =========================================================
   CREATE ACCOUNT
========================================================= */

export const createAccount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      code,
      name,
      type,
      description,
      parentId,
    } = req.body;

    const normalizedCode =
      String(code ?? "").trim();

    const normalizedName =
      String(name ?? "").trim();

    const normalizedType =
      String(type ?? "").trim();

    const normalizedParentId =
      normalizeOptionalString(parentId);

    if (
      !normalizedCode ||
      !normalizedName ||
      !normalizedType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Account code, name and type are required",
      });
    }

    /*
     * Parent account must belong to
     * the authenticated organization.
     */
    if (normalizedParentId) {
      const parent =
        await prisma.account.findFirst({
          where: {
            id: normalizedParentId,
            organizationId,
          },

          select: {
            id: true,
          },
        });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message:
            "Parent account does not exist in this organization",
        });
      }
    }

    const account =
      await prisma.account.create({
        data: {
          organizationId,

          code: normalizedCode,
          name: normalizedName,
          type: normalizedType,

          description:
            normalizeOptionalString(
              description
            ),

          parentId:
            normalizedParentId,
        },

        include: {
          parent: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

    return res.status(201).json({
      success: true,
      account,
    });
  } catch (error) {
    console.error(
      "CREATE ACCOUNT ERROR:",
      error
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this code already exists in this organization",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
};

/* =========================================================
   UPDATE ACCOUNT
========================================================= */

export const updateAccount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = String(req.params.id);

    const {
      code,
      name,
      type,
      description,
      parentId,
    } = req.body;

    const normalizedCode =
      String(code ?? "").trim();

    const normalizedName =
      String(name ?? "").trim();

    const normalizedType =
      String(type ?? "").trim();

    const normalizedParentId =
      normalizeOptionalString(parentId);

    if (
      !normalizedCode ||
      !normalizedName ||
      !normalizedType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Account code, name and type are required",
      });
    }

    /*
     * Verify this account belongs
     * to the authenticated tenant.
     */
    const existingAccount =
      await prisma.account.findFirst({
        where: {
          id,
          organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    /*
     * Account cannot be its own parent.
     */
    if (normalizedParentId === id) {
      return res.status(400).json({
        success: false,
        message:
          "An account cannot be its own parent",
      });
    }

    /*
     * Validate parent account and
     * prevent circular hierarchies.
     */
    if (normalizedParentId) {
      const parent =
        await prisma.account.findFirst({
          where: {
            id: normalizedParentId,
            organizationId,
          },

          select: {
            id: true,
          },
        });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message:
            "Parent account does not exist in this organization",
        });
      }

      let currentParentId:
        | string
        | null =
        normalizedParentId;

      const visited =
        new Set<string>();

      while (currentParentId) {
        if (currentParentId === id) {
          return res.status(400).json({
            success: false,
            message:
              "This parent would create a circular account hierarchy",
          });
        }

        if (
          visited.has(currentParentId)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Circular account hierarchy detected",
          });
        }

        visited.add(currentParentId);

        /*
         * Explicit type annotation prevents
         * TypeScript TS7022 on `current`.
         */
        const current: {
          parentId: string | null;
        } | null =
          await prisma.account.findFirst({
            where: {
              id: currentParentId,
              organizationId,
            },

            select: {
              parentId: true,
            },
          });

        if (!current) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid account hierarchy",
          });
        }

        currentParentId =
          current.parentId;
      }
    }

    const account =
      await prisma.account.update({
        where: {
          id,
        },

        data: {
          code: normalizedCode,
          name: normalizedName,
          type: normalizedType,

          description:
            normalizeOptionalString(
              description
            ),

          parentId:
            normalizedParentId,
        },

        include: {
          parent: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

    return res.status(200).json({
      success: true,
      account,
    });
  } catch (error) {
    console.error(
      "UPDATE ACCOUNT ERROR:",
      error
    );

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message:
            "An account with this code already exists in this organization",
        });
      }

      if (error.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update account",
    });
  }
};

/* =========================================================
   DELETE ACCOUNT
========================================================= */

export const deleteAccount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = String(req.params.id);

    /*
     * Verify account ownership BEFORE
     * deleting any financial data.
     */
    const existingAccount =
      await prisma.account.findFirst({
        where: {
          id,
          organizationId,
        },

        select: {
          id: true,
          code: true,
          name: true,
        },
      });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    await prisma.$transaction(
      async (tx) => {
        /*
         * Delete journal entries connected
         * to this account ONLY within
         * the authenticated organization.
         */
        await tx.journalEntry.deleteMany({
          where: {
            organizationId,

            OR: [
              {
                debitAccountId: id,
              },
              {
                creditAccountId: id,
              },
            ],
          },
        });

        /*
         * Unlink child accounts belonging
         * to the same organization.
         */
        await tx.account.updateMany({
          where: {
            organizationId,
            parentId: id,
          },

          data: {
            parentId: null,
          },
        });

        /*
         * Delete ONLY the authenticated
         * organization's account.
         */
        const deletion =
          await tx.account.deleteMany({
            where: {
              id,
              organizationId,
            },
          });

        if (deletion.count !== 1) {
          throw new Error(
            "ACCOUNT_DELETE_FAILED"
          );
        }
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Account deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE ACCOUNT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};