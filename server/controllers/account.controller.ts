import { Prisma } from "@prisma/client";
import { Response } from "express";

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

const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;

const ACCOUNT_CODE_RANGES: Record<
  (typeof ACCOUNT_TYPES)[number],
  { start: number; end: number }
> = {
  ASSET: { start: 1000, end: 1999 },
  LIABILITY: { start: 2000, end: 2999 },
  EQUITY: { start: 3000, end: 3999 },
  INCOME: { start: 4000, end: 4999 },
  EXPENSE: { start: 5000, end: 5999 },
};

const normalizeAccountType = (
  value: unknown
): string => String(value ?? "").trim().toUpperCase();

const isValidAccountType = (
  value: string
): value is (typeof ACCOUNT_TYPES)[number] =>
  ACCOUNT_TYPES.includes(
    value as (typeof ACCOUNT_TYPES)[number]
  );

const isAccountCodeValidForType = (
  code: string,
  type: string
): boolean => {
  if (!isValidAccountType(type)) {
    return false;
  }

  const numericCode = Number.parseInt(code, 10);

  if (!Number.isInteger(numericCode)) {
    return false;
  }

  const range = ACCOUNT_CODE_RANGES[type];

  return (
    numericCode >= range.start &&
    numericCode <= range.end
  );
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
        message: "Organization context is required",
      });
    }

    const {
      name,
      type,
      description,
      parentId,
    } = req.body;

    const normalizedName =
      String(name ?? "").trim();

    const normalizedType =
      String(type ?? "")
        .trim()
        .toUpperCase();

    const normalizedDescription =
      String(description ?? "").trim();

    const normalizedParentId =
      normalizeOptionalString(parentId);

    if (
      !normalizedName ||
      !normalizedType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Account name and type are required",
      });
    }

    if (
      !isValidAccountType(
        normalizedType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid account type. Allowed types are ASSET, LIABILITY, EQUITY, INCOME and EXPENSE.",
      });
    }

    const range =
      ACCOUNT_CODE_RANGES[
        normalizedType
      ];

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
            "Parent account not found",
        });
      }
    }

    const account =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Lock account-code generation for this
           * organization and account type.
           *
           * This prevents two users creating accounts
           * at the same time from receiving the same
           * automatically generated code.
           */
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(
                ${`${organizationId}:account-code:${normalizedType}`}
              )
            )
          `;

          const existingAccounts =
            await tx.account.findMany({
              where: {
                organizationId,
              },

              select: {
                code: true,
              },
            });

          const usedCodes =
            new Set<number>();

          for (
            const existing of
            existingAccounts
          ) {
            const numericCode =
              Number.parseInt(
                existing.code,
                10
              );

            if (
              Number.isInteger(
                numericCode
              ) &&
              numericCode >=
                range.start &&
              numericCode <=
                range.end
            ) {
              usedCodes.add(
                numericCode
              );
            }
          }

          let nextCode =
            range.start + 1;

          while (
            usedCodes.has(
              nextCode
            ) &&
            nextCode <=
              range.end
          ) {
            nextCode += 1;
          }

          if (
            nextCode >
            range.end
          ) {
            throw new Error(
              `No available account codes remain for ${normalizedType} accounts`
            );
          }

          return tx.account.create({
            data: {
              organizationId,
              code: String(
                nextCode
              ),
              name:
                normalizedName,
              type:
                normalizedType,
              description:
                normalizedDescription ||
                null,
              parentId:
                normalizedParentId ||
                null,
            },

            include: {
              parent: true,
              children: true,
            },
          });
        }
      );

    return res.status(201).json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    console.error(
      "Create account error:",
      error
    );

    if (
      error?.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to create account",
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
        message:
          "Authentication required.",
      });
    }

    const id =
      String(req.params.id);

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
      normalizeAccountType(type);

    if (
      !isValidAccountType(
        normalizedType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid account type. Allowed types are ASSET, LIABILITY, EQUITY, INCOME and EXPENSE.",
      });
    }

    if (
      normalizedCode &&
      !isAccountCodeValidForType(
        normalizedCode,
        normalizedType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Account code does not match the selected account type range.",
      });
    }

    const normalizedParentId =
      normalizeOptionalString(
        parentId
      );

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
          type: true,
        },
      });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        message:
          "Account not found",
      });
    }

    /*
     * Do not allow an account with existing
     * posted/approved accounting history to
     * silently change its classification.
     */
    if (
      existingAccount.type.toUpperCase() !==
      normalizedType
    ) {
      const effectiveLineCount =
        await prisma.journalEntryLine.count({
          where: {
            accountId: id,

            journalEntry: {
              organizationId,

              status: {
                in: [
                  "POSTED",
                  "APPROVED",
                ],
              },
            },
          },
        });

      if (
        effectiveLineCount > 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Account type cannot be changed because this account has posted or approved journal entries. Use a controlled reclassification process instead.",
        });
      }
    }

    /*
     * Account cannot be its own parent.
     */
    if (
      normalizedParentId === id
    ) {
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
            id:
              normalizedParentId,
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

      while (
        currentParentId
      ) {
        if (
          currentParentId === id
        ) {
          return res.status(400).json({
            success: false,
            message:
              "This parent would create a circular account hierarchy",
          });
        }

        if (
          visited.has(
            currentParentId
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Circular account hierarchy detected",
          });
        }

        visited.add(
          currentParentId
        );

        /*
         * Explicit type annotation prevents
         * TypeScript TS7022 on `current`.
         */
        const current: {
          parentId:
            string | null;
        } | null =
          await prisma.account.findFirst({
            where: {
              id:
                currentParentId,
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
          code:
            normalizedCode,

          name:
            normalizedName,

          type:
            normalizedType,

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
      if (
        error.code === "P2002"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An account with this code already exists in this organization",
        });
      }

      if (
        error.code === "P2025"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Account not found",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update account",
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
        message:
          "Authentication required.",
      });
    }

    const id =
      String(req.params.id);

    /*
     * Verify account ownership before
     * checking or changing any financial data.
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
        message:
          "Account not found",
      });
    }

    /*
     * Never delete an account that has
     * financial history.
     *
     * Posted/approved entries are immutable
     * accounting history and must remain intact.
     */
    const journalLineCount =
      await prisma.journalEntryLine.count({
        where: {
          accountId: id,

          journalEntry: {
            organizationId,
          },
        },
      });

    /*
     * Also check legacy journal-entry
     * header references because older
     * entries may still use the legacy
     * debitAccountId / creditAccountId.
     */
    const legacyJournalEntryCount =
      await prisma.journalEntry.count({
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

    if (
      journalLineCount > 0 ||
      legacyJournalEntryCount > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This account cannot be deleted because it has financial transaction history. Deactivate or reclassify the account instead.",
      });
    }

    /*
     * Do not silently orphan child accounts.
     * Reassign or remove child accounts first.
     */
    const childCount =
      await prisma.account.count({
        where: {
          organizationId,
          parentId: id,
        },
      });

    if (
      childCount > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This account cannot be deleted while it has child accounts. Reassign or remove the child accounts first.",
      });
    }

    const deletion =
      await prisma.account.deleteMany({
        where: {
          id,
          organizationId,
        },
      });

    if (
      deletion.count !== 1
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Account not found",
      });
    }

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
      message:
        "Failed to delete account",
    });
  }
};



