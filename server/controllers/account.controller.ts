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

/* =========================================================
   ACCOUNT TYPES
========================================================= */

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
  ASSET: {
    start: 1000,
    end: 1999,
  },

  LIABILITY: {
    start: 2000,
    end: 2999,
  },

  EQUITY: {
    start: 3000,
    end: 3999,
  },

  INCOME: {
    start: 4000,
    end: 4999,
  },

  EXPENSE: {
    start: 5000,
    end: 5999,
  },
};

/* =========================================================
   DEFAULT CHART OF ACCOUNTS
========================================================= */

const DEFAULT_CHART_OF_ACCOUNTS = [
  {
    code: "1100",
    name: "Cash at Bank",
    type: "ASSET",
    description:
      "Cash held in bank accounts.",
  },

  {
    code: "1110",
    name: "Petty Cash",
    type: "ASSET",
    description:
      "Physical cash held for minor expenses.",
  },

  {
    code: "1200",
    name: "Accounts Receivable",
    type: "ASSET",
    description:
      "Amounts owed by customers.",
  },

  {
    code: "1300",
    name: "Inventory",
    type: "ASSET",
    description:
      "Inventory held for sale or operations.",
  },

  {
    code: "1400",
    name: "Prepaid Expenses",
    type: "ASSET",
    description:
      "Expenses paid in advance.",
  },

  {
    code: "1500",
    name: "Property, Plant & Equipment",
    type: "ASSET",
    description:
      "Long-term tangible business assets.",
  },

  {
    code: "1600",
    name: "Customer Loans Receivable",
    type: "ASSET",
    description:
      "Principal amounts receivable from customers under loan arrangements.",
  },

  {
    code: "2100",
    name: "Accounts Payable",
    type: "LIABILITY",
    description:
      "Amounts owed to suppliers and vendors.",
  },

  {
    code: "2200",
    name: "Accrued Expenses",
    type: "LIABILITY",
    description:
      "Expenses incurred but not yet paid.",
  },

  {
    code: "2300",
    name: "Tax Payable",
    type: "LIABILITY",
    description:
      "Taxes owed to tax authorities.",
  },

  {
    code: "2400",
    name: "Loans Payable",
    type: "LIABILITY",
    description:
      "Borrowings and other financing obligations.",
  },

  {
    code: "3100",
    name: "Share Capital",
    type: "EQUITY",
    description:
      "Capital contributed by shareholders.",
  },

  {
    code: "3200",
    name: "Retained Earnings",
    type: "EQUITY",
    description:
      "Accumulated profits retained in the business.",
  },

  {
    code: "3300",
    name: "Owner's Capital",
    type: "EQUITY",
    description:
      "Capital contributed by owners.",
  },

  {
    code: "3400",
    name: "Drawings / Distributions",
    type: "EQUITY",
    description:
      "Owner withdrawals or distributions.",
  },

  {
    code: "4100",
    name: "Sales Revenue",
    type: "INCOME",
    description:
      "Income generated from sale of goods.",
  },

  {
    code: "4200",
    name: "Service Revenue",
    type: "INCOME",
    description:
      "Income generated from services provided.",
  },

  {
    code: "4300",
    name: "Other Income",
    type: "INCOME",
    description:
      "Other operating and non-operating income.",
  },

  {
    code: "5100",
    name: "Salaries and Wages",
    type: "EXPENSE",
    description:
      "Employee salaries and wages.",
  },

  {
    code: "5200",
    name: "Rent Expense",
    type: "EXPENSE",
    description:
      "Premises and office rent.",
  },

  {
    code: "5300",
    name: "Utilities Expense",
    type: "EXPENSE",
    description:
      "Electricity, water, internet and other utilities.",
  },

  {
    code: "5400",
    name: "Marketing and Advertising",
    type: "EXPENSE",
    description:
      "Marketing, advertising and promotional costs.",
  },

  {
    code: "5500",
    name: "Office Expenses",
    type: "EXPENSE",
    description:
      "General office operating expenses.",
  },

  {
    code: "5600",
    name: "Software and Subscriptions",
    type: "EXPENSE",
    description:
      "Software licences and recurring subscriptions.",
  },

  {
    code: "5700",
    name: "Professional Fees",
    type: "EXPENSE",
    description:
      "Legal, accounting and professional services.",
  },

  {
    code: "5800",
    name: "Insurance",
    type: "EXPENSE",
    description:
      "Business insurance costs.",
  },
] as const;

/* =========================================================
   ENSURE DEFAULT CHART OF ACCOUNTS
========================================================= */

const ensureDefaultChartOfAccounts = async (
  organizationId: string
): Promise<void> => {
  const existingAccounts =
    await prisma.account.findMany({
      where: {
        organizationId,
      },

      select: {
        code: true,
      },
    });

  const existingCodes = new Set(
    existingAccounts.map(
      (account) => account.code
    )
  );

  const missingAccounts =
    DEFAULT_CHART_OF_ACCOUNTS.filter(
      (account) =>
        !existingCodes.has(account.code)
    );

  if (missingAccounts.length === 0) {
    return;
  }

  await prisma.account.createMany({
    data: missingAccounts.map(
      (account) => ({
        ...account,
        organizationId,
      })
    ),

    skipDuplicates: true,
  });
};

/* =========================================================
   ACCOUNT TYPE HELPERS
========================================================= */

const normalizeAccountType = (
  value: unknown
): string => {
  return String(value ?? "")
    .trim()
    .toUpperCase();
};

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

  const numericCode = Number.parseInt(
    code,
    10
  );

  if (!Number.isInteger(numericCode)) {
    return false;
  }

  const range =
    ACCOUNT_CODE_RANGES[type];

  return (
    numericCode >= range.start &&
    numericCode <= range.end
  );
};

/* =========================================================
   GET ALL ACCOUNTS
   - Tenant scoped
   - Server-side pagination
   - Search
   - Type filtering
   - Parent/subaccount filtering
   - Organization-wide summary
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
        message:
          "Authentication required.",
      });
    }

    /*
     * Make sure every organization has the
     * standard default chart of accounts.
     */
    await ensureDefaultChartOfAccounts(
      organizationId
    );

    /* =====================================================
       PAGINATION
    ===================================================== */

    const requestedPage =
      Number.parseInt(
        String(
          req.query.page ?? "1"
        ),
        10
      );

    const requestedPageSize =
      Number.parseInt(
        String(
          req.query.pageSize ?? "25"
        ),
        10
      );

    const page =
      Number.isInteger(requestedPage)
        ? Math.max(
            requestedPage,
            1
          )
        : 1;

    const allowedPageSizes = [
      25,
      50,
      100,
    ];

    const pageSize =
      allowedPageSizes.includes(
        requestedPageSize
      )
        ? requestedPageSize
        : 25;

    /* =====================================================
       FILTERS
    ===================================================== */

    const search = String(
      req.query.search ?? ""
    ).trim();

    const requestedType =
      String(
        req.query.type ?? ""
      )
        .trim()
        .toUpperCase();

    const requestedStructure =
      String(
        req.query.structure ?? "all"
      )
        .trim()
        .toLowerCase();

    const structure =
      requestedStructure ===
        "parent" ||
      requestedStructure ===
        "subaccount"
        ? requestedStructure
        : "all";

    const where: Prisma.AccountWhereInput =
      {
        organizationId,
      };

    /* =====================================================
       ACCOUNT TYPE FILTER
    ===================================================== */

    if (
      requestedType &&
      requestedType !== "ALL" &&
      isValidAccountType(
        requestedType
      )
    ) {
      where.type =
        requestedType;
    }

    /* =====================================================
       ACCOUNT STRUCTURE FILTER
    ===================================================== */

    if (
      structure === "parent"
    ) {
      where.parentId = null;
    }

    if (
      structure ===
      "subaccount"
    ) {
      where.parentId = {
        not: null,
      };
    }

    /* =====================================================
       SEARCH
       Search:
       - code
       - name
       - type
       - description
       - parent code
       - parent name
    ===================================================== */

    if (search) {
      where.OR = [
        {
          code: {
            contains: search,
            mode: "insensitive",
          },
        },

        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },

        {
          type: {
            contains: search,
            mode: "insensitive",
          },
        },

        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },

        {
          parent: {
            is: {
              code: {
                contains:
                  search,
                mode: "insensitive",
              },
            },
          },
        },

        {
          parent: {
            is: {
              name: {
                contains:
                  search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    /* =====================================================
       ORGANIZATION-WIDE SUMMARY
       These counts intentionally ignore the current
       page and current filters.
    ===================================================== */

    const [
      totalAccounts,
      accountTypeSummary,
    ] = await Promise.all([
      prisma.account.count({
        where: {
          organizationId,
        },
      }),

      prisma.account.groupBy({
        by: ["type"],

        where: {
          organizationId,
        },

        _count: {
          _all: true,
        },
      }),
    ]);

    const summary = {
      total: totalAccounts,
      assets: 0,
      liabilities: 0,
      equity: 0,
      income: 0,
      expenses: 0,
    };

    for (
      const item of
        accountTypeSummary
    ) {
      const count =
        item._count._all;

      switch (
        item.type.toUpperCase()
      ) {
        case "ASSET":
          summary.assets =
            count;
          break;

        case "LIABILITY":
          summary.liabilities =
            count;
          break;

        case "EQUITY":
          summary.equity =
            count;
          break;

        case "INCOME":
          summary.income =
            count;
          break;

        case "EXPENSE":
          summary.expenses =
            count;
          break;
      }
    }

    /* =====================================================
       FILTERED COUNT
    ===================================================== */

    const filteredTotal =
      await prisma.account.count({
        where,
      });

    const calculatedTotalPages =
      Math.ceil(
        filteredTotal /
          pageSize
      );

    /*
     * Always expose at least one page so
     * frontend pagination remains stable
     * when there are zero filtered results.
     */
    const totalPages =
      Math.max(
        calculatedTotalPages,
        1
      );

    /*
     * If a filter change leaves the requested
     * page beyond the available range,
     * safely return the final available page.
     */
    const safePage =
      Math.min(
        page,
        totalPages
      );

    const skip =
      (safePage - 1) *
      pageSize;

    /* =====================================================
       PAGINATED ACCOUNT QUERY
    ===================================================== */

    const accounts =
      await prisma.account.findMany({
        where,

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

        /*
         * Account types are normalized by the
         * accounting controller, so ordering by
         * type followed by code provides stable
         * deterministic pagination.
         */
        orderBy: [
          {
            type: "asc",
          },

          {
            code: "asc",
          },
        ],

        skip,

        take: pageSize,
      });

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      accounts,

      pagination: {
        page: safePage,
        pageSize,
        total: filteredTotal,
        totalPages,
        hasPreviousPage:
          safePage > 1,
        hasNextPage:
          safePage < totalPages,
      },

      summary,

      filters: {
        search,

        type:
          requestedType &&
          isValidAccountType(
            requestedType
          )
            ? requestedType
            : "ALL",

        structure,
      },
    });
  } catch (error) {
    console.error(
      "GET ACCOUNTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load accounts",
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
        message:
          "Authentication required.",
      });
    }

    const id = String(
      req.params.id
    );

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
        message:
          "Account not found",
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
      message:
        "Failed to load account",
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
        message:
          "Organization context is required",
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
      String(
        description ?? ""
      ).trim();

    const normalizedParentId =
      normalizeOptionalString(
        parentId
      );

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

    /* =====================================================
       VALIDATE PARENT
    ===================================================== */

    if (normalizedParentId) {
      const parent =
        await prisma.account.findFirst({
          where: {
            id: normalizedParentId,
            organizationId,
          },

          select: {
            id: true,
            type: true,
          },
        });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message:
            "Parent account not found",
        });
      }

      /*
       * Parent and child must belong
       * to the same accounting class.
       */
      if (
        parent.type.toUpperCase() !==
        normalizedType
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Parent account must have the same account type as the new account.",
        });
      }
    }

    /* =====================================================
       GENERATE ACCOUNT CODE
       Protected by PostgreSQL advisory lock.
    ===================================================== */

    const account =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Lock account-code generation for
           * this organization and account type.
           *
           * This prevents concurrent requests
           * from generating duplicate codes.
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

          /*
           * Start after the category's
           * base code.
           *
           * Example:
           * ASSET starts at 1000,
           * first generated code = 1001.
           */
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

    const id = String(
      req.params.id
    );

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

    const normalizedParentId =
      normalizeOptionalString(
        parentId
      );

    /* =====================================================
       VERIFY ACCOUNT OWNERSHIP
    ===================================================== */

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

    /* =====================================================
       PROTECT ACCOUNT CLASSIFICATION
    ===================================================== */

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

    /* =====================================================
       ACCOUNT CANNOT BE ITS OWN PARENT
    ===================================================== */

    if (
      normalizedParentId === id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "An account cannot be its own parent",
      });
    }

    /* =====================================================
       VALIDATE PARENT
       - Same tenant
       - Same account type
       - No circular hierarchy
    ===================================================== */

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
            type: true,
          },
        });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message:
            "Parent account does not exist in this organization",
        });
      }

      if (
        parent.type.toUpperCase() !==
        normalizedType
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Parent account must have the same account type as the child account.",
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
            | string
            | null;
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

    /* =====================================================
       UPDATE ACCOUNT
    ===================================================== */

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

    const id = String(
      req.params.id
    );

    /* =====================================================
       VERIFY ACCOUNT OWNERSHIP
    ===================================================== */

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

    /* =====================================================
       NEVER DELETE ACCOUNT WITH JOURNAL HISTORY
    ===================================================== */

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
     * entries may still use:
     *
     * debitAccountId
     * creditAccountId
     */
    const legacyJournalEntryCount =
      await prisma.journalEntry.count({
        where: {
          organizationId,

          OR: [
            {
              debitAccountId:
                id,
            },

            {
              creditAccountId:
                id,
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

    /* =====================================================
       PROTECT CHILD ACCOUNTS
    ===================================================== */

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

    /* =====================================================
       DELETE ONLY WITHIN TENANT
    ===================================================== */

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