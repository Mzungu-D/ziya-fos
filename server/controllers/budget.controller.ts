import type { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

/* ============================================================
 * TYPES
 * ============================================================ */

type TenantContext = {
  userId: string;
  organizationId: string;
};

type BudgetStatus =
  | "DRAFT"
  | "ACTIVE"
  | "ARCHIVED";

type CalculatedStatus =
  | "Draft"
  | "Archived"
  | "Over Budget"
  | "Near Limit"
  | "No Activity"
  | "Under Budget";

type MonthlyActual = {
  month: number;
  amount: number;
};

type ActualsResult = {
  total: number;
  monthly: MonthlyActual[];
};

type BudgetFinancials = {
  actual: number;
  committed: number;
  available: number;
  utilization: number;
  calculatedStatus: CalculatedStatus;
};

/* ============================================================
 * CONSTANTS
 * ============================================================ */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const MIN_BUDGET_YEAR = 2000;
const MAX_BUDGET_YEAR = 2100;

const ALLOWED_STATUSES = new Set<BudgetStatus>([
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
]);

/* ============================================================
 * TENANT CONTEXT
 * ============================================================ */

/**
 * Every budget operation must run inside a tenant context.
 *
 * The organizationId is always taken from the authenticated
 * session and never from request input.
 */
function getTenantContext(
  req: AuthRequest
): TenantContext | null {
  if (
    !req.user?.userId ||
    !req.user?.organizationId
  ) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  ).sessionType;

  if (
    sessionType &&
    sessionType.toUpperCase() !== "TENANT"
  ) {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId:
      req.user.organizationId,
  };
}

/* ============================================================
 * VALIDATION / PARSING HELPERS
 * ============================================================ */

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseAmount(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return null;
  }

  return amount;
}

function parseYear(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const year = Number(value);

  if (
    !Number.isInteger(year) ||
    year < MIN_BUDGET_YEAR ||
    year > MAX_BUDGET_YEAR
  ) {
    return null;
  }

  return year;
}

function parsePage(
  value: unknown
): number {
  const page = Number(value);

  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
    return DEFAULT_PAGE;
  }

  return page;
}

function parsePageSize(
  value: unknown
): number {
  const pageSize = Number(value);

  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1
  ) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    pageSize,
    MAX_PAGE_SIZE
  );
}

function parseStatus(
  value: unknown
): BudgetStatus | null {
  const status =
    cleanString(value).toUpperCase();

  if (
    ALLOWED_STATUSES.has(
      status as BudgetStatus
    )
  ) {
    return status as BudgetStatus;
  }

  return null;
}

function round(
  value: number,
  decimals = 2
): number {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      (value + Number.EPSILON) *
        multiplier
    ) / multiplier
  );
}

/* ============================================================
 * DATE HELPERS
 * ============================================================ */

function getYearRange(year: number) {
  return {
    start: new Date(
      Date.UTC(year, 0, 1, 0, 0, 0, 0)
    ),

    end: new Date(
      Date.UTC(
        year + 1,
        0,
        1,
        0,
        0,
        0,
        0
      )
    ),
  };
}

function parseDate(
  value: unknown
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const date = new Date(
    String(value)
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return date;
}

function getDefaultStartDate(
  year: number
): Date {
  return new Date(
    Date.UTC(
      year,
      0,
      1,
      0,
      0,
      0,
      0
    )
  );
}

function getDefaultEndDate(
  year: number
): Date {
  return new Date(
    Date.UTC(
      year,
      11,
      31,
      23,
      59,
      59,
      999
    )
  );
}

/**
 * Ensures budget dates remain inside the selected
 * budget year.
 */
function isDateWithinYear(
  date: Date,
  year: number
): boolean {
  const { start, end } =
    getYearRange(year);

  return (
    date >= start &&
    date < end
  );
}

/* ============================================================
 * STATUS CALCULATION
 * ============================================================ */

function calculateStatus(
  budget: number,
  actual: number,
  status?: string
): CalculatedStatus {
  const normalizedStatus =
    cleanString(status).toUpperCase();

  if (
    normalizedStatus ===
    "DRAFT"
  ) {
    return "Draft";
  }

  if (
    normalizedStatus ===
    "ARCHIVED"
  ) {
    return "Archived";
  }

  if (budget <= 0) {
    return actual > 0
      ? "Over Budget"
      : "No Activity";
  }

  if (actual > budget) {
    return "Over Budget";
  }

  if (
    actual >=
    budget * 0.9
  ) {
    return "Near Limit";
  }

  return "Under Budget";
}

/* ============================================================
 * ACCOUNT HELPERS
 * ============================================================ */

/**
 * Account types in the existing FOS database may contain
 * different casing, for example:
 *
 * Expense
 * EXPENSE
 * expense
 *
 * Therefore account classification is normalized in code.
 */
async function getExpenseAccountIds(
  organizationId: string
): Promise<string[]> {
  const accounts =
    await prisma.account.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        type: true,
      },
    });

  return accounts
    .filter(
      (account) =>
        cleanString(account.type)
          .toUpperCase() ===
        "EXPENSE"
    )
    .map(
      (account) => account.id
    );
}

/**
 * Validate that an account belongs to the
 * current organization and is an Expense account.
 */
async function validateExpenseAccount(
  organizationId: string,
  accountId: string
) {
  const account =
    await prisma.account.findFirst({
      where: {
        id: accountId,
        organizationId,
      },

      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
    });

  if (!account) {
    return {
      valid: false as const,
      reason:
        "The selected account does not belong to this organization.",
    };
  }

  if (
    cleanString(account.type)
      .toUpperCase() !==
    "EXPENSE"
  ) {
    return {
      valid: false as const,
      reason:
        "Budgets must be linked to an Expense account.",
    };
  }

  return {
    valid: true as const,
    account,
  };
}

/* ============================================================
 * ACTUAL SPEND
 * ============================================================ */

/**
 * Calculates posted expense movement for one organization,
 * year and optionally one Expense account.
 *
 * Accounting rule:
 *
 * Expense account DEBIT  -> increases expense
 * Expense account CREDIT -> decreases expense
 *
 * Only POSTED journal entries are included.
 */
async function calculateActuals(
  organizationId: string,
  year: number,
  accountId?: string | null
): Promise<ActualsResult> {
  const expenseAccountIds =
    await getExpenseAccountIds(
      organizationId
    );

  const relevantAccountIds =
    accountId
      ? expenseAccountIds.filter(
          (id) => id === accountId
        )
      : expenseAccountIds;

  const monthly: MonthlyActual[] =
    Array.from(
      { length: 12 },
      (_, index) => ({
        month: index + 1,
        amount: 0,
      })
    );

  if (
    relevantAccountIds.length === 0
  ) {
    return {
      total: 0,
      monthly,
    };
  }

  const {
    start,
    end,
  } = getYearRange(year);

  const entries =
    await prisma.journalEntry.findMany({
      where: {
        organizationId,

        status: { in: ["POSTED", "APPROVED"] },

        transactionDate: {
          gte: start,
          lt: end,
        },

        OR: [
          {
            debitAccountId: {
              in: relevantAccountIds,
            },
          },

          {
            creditAccountId: {
              in: relevantAccountIds,
            },
          },
        ],
      },

      select: {
        debitAccountId: true,
        creditAccountId: true,
        amount: true,
        transactionDate: true,
      },
    });

  let total = 0;

  for (const entry of entries) {
    const amount =
      Number(entry.amount);

    if (
      !Number.isFinite(amount) ||
      amount === 0
    ) {
      continue;
    }

    const debitIsExpense =
      relevantAccountIds.includes(
        entry.debitAccountId
      );

    const creditIsExpense =
      relevantAccountIds.includes(
        entry.creditAccountId
      );

    let movement = 0;

    if (debitIsExpense) {
      movement += amount;
    }

    if (creditIsExpense) {
      movement -= amount;
    }

    total += movement;

    const month =
      entry.transactionDate.getUTCMonth() +
      1;

    const bucket =
      monthly[month - 1];

    if (bucket) {
      bucket.amount += movement;
    }
  }

  return {
    total: round(
      Math.max(total, 0)
    ),

    monthly:
      monthly.map((item) => ({
        month: item.month,
        amount: round(
          Math.max(
            item.amount,
            0
          )
        ),
      })),
  };
}

/* ============================================================
 * COMMITTED SPEND
 * ============================================================ */

/**
 * Committed expenditure is expenditure that has not yet
 * become a posted/rejected/cancelled expense.
 */
async function calculateCommitted(
  organizationId: string,
  year: number,
  accountId?: string | null
): Promise<number> {
  const {
    start,
    end,
  } = getYearRange(year);

  const result =
    await prisma.expense.aggregate({
      where: {
        organizationId,

        expenseDate: {
          gte: start,
          lt: end,
        },

        status: {
          notIn: [
            "POSTED",
            "REJECTED",
            "CANCELLED",
          ],
        },

        ...(accountId
          ? {
              expenseAccountId:
                accountId,
            }
          : {}),
      },

      _sum: {
        amount: true,
      },
    });

  return round(
    Number(
      result._sum.amount ?? 0
    )
  );
}

/* ============================================================
 * FINANCIAL CALCULATION
 * ============================================================ */

function calculateFinancials(
  budgetAmount: number,
  actual: number,
  committed: number,
  status: string
): BudgetFinancials {
  const available =
    round(
      budgetAmount -
        actual -
        committed
    );

  const utilization =
    budgetAmount > 0
      ? round(
          ((actual +
            committed) /
            budgetAmount) *
            100
        )
      : 0;

  return {
    actual: round(actual),

    committed: round(
      committed
    ),

    available,

    utilization,

    calculatedStatus:
      calculateStatus(
        budgetAmount,
        actual,
        status
      ),
  };
}

/* ============================================================
 * GET BUDGETS
 * ============================================================ */

/**
 * GET /api/budgets
 *
 * Query parameters:
 *
 * page
 * pageSize
 * year
 * department
 * accountId
 * status
 * search
 *
 * Pagination is performed at the database level.
 */
export const getBudgets = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const page =
      parsePage(req.query.page);

    const pageSize =
      parsePageSize(
        req.query.pageSize
      );

    const year =
      parseYear(req.query.year) ??
      new Date().getFullYear();

    const department =
      cleanString(
        req.query.department
      );

    const accountId =
      cleanString(
        req.query.accountId
      );

    const status =
      parseStatus(
        req.query.status
      );

    const search =
      cleanString(
        req.query.search
      );

    /* --------------------------------------------------------
     * BUILD FILTER
     * -------------------------------------------------------- */

    const where = {
      organizationId:
        context.organizationId,

      year,

      ...(department
        ? {
            department: {
              contains:
                department,
              mode: "insensitive" as const,
            },
          }
        : {}),

      ...(accountId
        ? {
            accountId,
          }
        : {}),

      ...(status
        ? {
            status,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains:
                    search,
                  mode:
                    "insensitive" as const,
                },
              },

              {
                department: {
                  contains:
                    search,
                  mode:
                    "insensitive" as const,
                },
              },

              {
                account: {
                  name: {
                    contains:
                      search,
                    mode:
                      "insensitive" as const,
                  },
                },
              },

              {
                account: {
                  code: {
                    contains:
                      search,
                    mode:
                      "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    /* --------------------------------------------------------
     * DATABASE PAGINATION
     * -------------------------------------------------------- */

    const skip =
      (page - 1) *
      pageSize;

    const [
      totalItems,
      budgets,
    ] = await prisma.$transaction([
      prisma.budget.count({
        where,
      }),

      prisma.budget.findMany({
        where,

        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
        },

        orderBy: [
          {
            year: "desc",
          },

          {
            department: "asc",
          },

          {
            createdAt: "desc",
          },
        ],

        skip,

        take: pageSize,
      }),
    ]);

    /* --------------------------------------------------------
     * LOAD ACTUALS / COMMITTED SPEND FOR THE PAGE
     *
     * We intentionally calculate these values only for the
     * budgets currently visible instead of loading every
     * organization's budgets.
     * -------------------------------------------------------- */

    const uniqueAccountIds =
      Array.from(
        new Set(
          budgets
            .map(
              (budget) =>
                budget.accountId
            )
            .filter(
              (
                accountId
              ): accountId is string =>
                Boolean(accountId)
            )
        )
      );

    const [
      allActuals,
      committedByAccount,
    ] =
      await Promise.all([
        calculateActuals(
          context.organizationId,
          year
        ),

        prisma.expense.groupBy({
          by: ["expenseAccountId"],

          where: {
            organizationId:
              context.organizationId,

            expenseDate: {
              gte:
                getYearRange(
                  year
                ).start,

              lt:
                getYearRange(
                  year
                ).end,
            },

            status: {
              notIn: [
                "POSTED",
                "REJECTED",
                "CANCELLED",
              ],
            },

            ...(uniqueAccountIds.length >
            0
              ? {
                  expenseAccountId: {
                    in:
                      uniqueAccountIds,
                  },
                }
              : {}),
          },

          _sum: {
            amount: true,
          },
        }),
      ]);

    /**
     * Build account-level actuals in one query.
     *
     * The overall actuals above is retained for legacy
     * compatibility and summary use.
     */
    const expenseAccountIds =
      await getExpenseAccountIds(
        context.organizationId
      );

    const relevantActualAccountIds =
      uniqueAccountIds.filter(
        (id) =>
          expenseAccountIds.includes(
            id
          )
      );

    const accountActualMap =
      new Map<
        string,
        number
      >();

    if (
      relevantActualAccountIds.length >
      0
    ) {
      const {
        start,
        end,
      } = getYearRange(year);

      const entries =
        await prisma.journalEntry.findMany({
          where: {
            organizationId:
              context.organizationId,

            status: { in: ["POSTED", "APPROVED"] },

            transactionDate: {
              gte: start,
              lt: end,
            },

            OR: [
              {
                debitAccountId: {
                  in:
                    relevantActualAccountIds,
                },
              },

              {
                creditAccountId: {
                  in:
                    relevantActualAccountIds,
                },
              },
            ],
          },

          select: {
            debitAccountId: true,
            creditAccountId: true,
            amount: true,
          },
        });

      for (const entry of entries) {
        const amount =
          Number(entry.amount);

        if (
          !Number.isFinite(
            amount
          )
        ) {
          continue;
        }

        if (
          relevantActualAccountIds.includes(
            entry.debitAccountId
          )
        ) {
          accountActualMap.set(
            entry.debitAccountId,
            round(
              (accountActualMap.get(
                entry.debitAccountId
              ) ?? 0) +
                amount
            )
          );
        }

        if (
          relevantActualAccountIds.includes(
            entry.creditAccountId
          )
        ) {
          accountActualMap.set(
            entry.creditAccountId,
            round(
              (accountActualMap.get(
                entry.creditAccountId
              ) ?? 0) -
                amount
            )
          );
        }
      }
    }

    const committedMap =
      new Map<
        string,
        number
      >();

    for (
      const row of committedByAccount
    ) {
      if (
        row.expenseAccountId
      ) {
        committedMap.set(
          row.expenseAccountId,
          round(
            Number(
              row._sum.amount ??
                0
            )
          )
        );
      }
    }

    /* --------------------------------------------------------
     * ENRICH CURRENT PAGE
     * -------------------------------------------------------- */

    const data =
      budgets.map((budget) => {
        const budgetAmount =
          Number(
            budget.amount
          );

        const actual =
          budget.accountId
            ? Math.max(
                accountActualMap.get(
                  budget.accountId
                ) ?? 0,
                0
              )
            : allActuals.total;

        const committed =
          budget.accountId
            ? committedMap.get(
                budget.accountId
              ) ?? 0
            : 0;

        const financials =
          calculateFinancials(
            budgetAmount,
            actual,
            committed,
            budget.status
          );

        return {
          ...budget,

          amount:
            round(
              budgetAmount
            ),

          actual:
            financials.actual,

          committed:
            financials.committed,

          available:
            financials.available,

          utilization:
            financials.utilization,

          calculatedStatus:
            financials.calculatedStatus,
        };
      });

    const totalPages =
      totalItems > 0
        ? Math.ceil(
            totalItems /
              pageSize
          )
        : 0;

    /* --------------------------------------------------------
     * PAGE TOTALS
     * -------------------------------------------------------- */

    const pageBudget =
      round(
        data.reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount
            ),
          0
        )
      );

    const pageActual =
      round(
        data.reduce(
          (sum, item) =>
            sum +
            Number(
              item.actual
            ),
          0
        )
      );

    const pageCommitted =
      round(
        data.reduce(
          (sum, item) =>
            sum +
            Number(
              item.committed
            ),
          0
        )
      );

    return res.status(200).json({
      success: true,

      data,

      totals: {
        budget: pageBudget,

        actual: pageActual,

        committed:
          pageCommitted,

        available: round(
          pageBudget -
            pageActual -
            pageCommitted
        ),

        utilization:
          pageBudget > 0
            ? round(
                ((pageActual +
                  pageCommitted) /
                  pageBudget) *
                  100
              )
            : 0,

        count:
          totalItems,
      },

      pagination: {
        page,

        pageSize,

        totalItems,

        totalPages,

        hasNextPage:
          page <
          totalPages,

        hasPreviousPage:
          page > 1 &&
          totalPages > 0,
      },

      meta: {
        organizationId:
          context.organizationId,

        year,
      },
    });
  } catch (error) {
    console.error(
      "[BUDGET] Failed to fetch budgets:",
      error
    );

    return res.status(500).json({
      success: false,

      code:
        "BUDGETS_FETCH_FAILED",

      message:
        "Failed to fetch budgets.",
    });
  }
};

/* ============================================================
 * GET BUDGET SUMMARY
 * ============================================================ */

/**
 * GET /api/budgets/summary?year=2026
 *
 * Dashboard-level totals.
 *
 * IMPORTANT:
 * This is independent of table pagination.
 *
 * The dashboard must show the organization's complete budget
 * position for the selected year, not just the current page.
 */
export const getBudgetSummary =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res
          .status(403)
          .json({
            success: false,
            code:
              "TENANT_SESSION_REQUIRED",
            message:
              "A tenant session is required.",
          });
      }

      const year =
        parseYear(
          req.query.year
        ) ??
        new Date().getFullYear();

      /* ------------------------------------------------------
       * TOTAL BUDGET
       * ------------------------------------------------------ */

      const budgetAggregate =
        await prisma.budget.aggregate({
          where: {
            organizationId:
              context.organizationId,

            year,
          },

          _sum: {
            amount: true,
          },

          _count: {
            id: true,
          },
        });

      const totalBudget =
        round(
          Number(
            budgetAggregate
              ._sum.amount ??
              0
          )
        );

      /* ------------------------------------------------------
       * ACTUALS + COMMITTED
       * ------------------------------------------------------ */

      const [
        actualResult,
        committed,
      ] = await Promise.all([
        calculateActuals(
          context.organizationId,
          year
        ),

        calculateCommitted(
          context.organizationId,
          year
        ),
      ]);

      const actual =
        round(
          actualResult.total
        );

      const committedAmount =
        round(committed);

      const available =
        round(
          totalBudget -
            actual -
            committedAmount
        );

      const utilization =
        totalBudget > 0
          ? round(
              ((actual +
                committedAmount) /
                totalBudget) *
                100
            )
          : 0;

      const variance =
        round(
          totalBudget -
            actual
        );

      return res.status(200).json({
        success: true,

        data: {
          year,

          totalBudget,

          actualSpend:
            actual,

          committedSpend:
            committedAmount,

          availableBudget:
            available,

          utilization,

          variance,

          monthlyActuals:
            actualResult.monthly,
        },

        totals: {
          budget:
            totalBudget,

          actual,

          committed:
            committedAmount,

          available,

          variance,

          utilizationPercentage:
            utilization,

          count:
            budgetAggregate
              ._count.id,
        },

        meta: {
          organizationId:
            context.organizationId,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "[BUDGET] Failed to generate summary:",
        error
      );

      return res.status(500).json({
        success: false,

        code:
          "BUDGET_SUMMARY_FAILED",

        message:
          "Failed to generate budget summary.",
      });
    }
  };

/* ============================================================
 * GET SINGLE BUDGET
 * ============================================================ */

/**
 * GET /api/budgets/:id
 */
export const getBudget =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res
          .status(403)
          .json({
            success: false,
            code:
              "TENANT_SESSION_REQUIRED",
            message:
              "A tenant session is required.",
          });
      }

      const id =
        typeof req.params.id ===
        "string"
          ? req.params.id.trim()
          : "";

      if (!id) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_ID_REQUIRED",
            message:
              "Budget ID is required.",
          });
      }

      const budget =
        await prisma.budget.findFirst({
          where: {
            id,

            organizationId:
              context.organizationId,
          },

          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        });

      if (!budget) {
        return res
          .status(404)
          .json({
            success: false,
            code:
              "BUDGET_NOT_FOUND",
            message:
              "Budget not found.",
          });
      }

      const [
        actualResult,
        committed,
      ] = await Promise.all([
        calculateActuals(
          context.organizationId,
          budget.year,
          budget.accountId
        ),

        calculateCommitted(
          context.organizationId,
          budget.year,
          budget.accountId
        ),
      ]);

      const amount =
        Number(
          budget.amount
        );

      const financials =
        calculateFinancials(
          amount,
          actualResult.total,
          committed,
          budget.status
        );

      return res.status(200).json({
        success: true,

        data: {
          ...budget,

          amount:
            round(amount),

          actual:
            financials.actual,

          committed:
            financials.committed,

          available:
            financials.available,

          utilization:
            financials.utilization,

          calculatedStatus:
            financials.calculatedStatus,

          monthlyActuals:
            actualResult.monthly,
        },
      });
    } catch (error) {
      console.error(
        "[BUDGET] Failed to fetch budget:",
        error
      );

      return res.status(500).json({
        success: false,

        code:
          "BUDGET_FETCH_FAILED",

        message:
          "Failed to fetch budget.",
      });
    }
  };

/* ============================================================
 * CREATE BUDGET
 * ============================================================ */

/**
 * POST /api/budgets
 */
export const createBudget =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res
          .status(403)
          .json({
            success: false,
            code:
              "TENANT_SESSION_REQUIRED",
            message:
              "A tenant session is required.",
          });
      }

      const name =
        cleanString(
          req.body?.name
        ) ||
        "Annual Budget";

      const department =
        cleanString(
          req.body?.department
        );

      const amount =
        parseAmount(
          req.body?.amount
        );

      const year =
        parseYear(
          req.body?.year
        );

      const accountId =
        cleanString(
          req.body?.accountId
        );

      const requestedStatus =
        cleanString(
          req.body?.status
        );

      const status =
        requestedStatus
          ? parseStatus(
              requestedStatus
            )
          : "DRAFT";

      /* ------------------------------------------------------
       * BASIC VALIDATION
       * ------------------------------------------------------ */

      if (!department) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DEPARTMENT_REQUIRED",
            message:
              "Department is required.",
          });
      }

      if (
        department.length >
        150
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DEPARTMENT_TOO_LONG",
            message:
              "Department name is too long.",
          });
      }

      if (amount === null) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_AMOUNT_INVALID",
            message:
              "Budget amount must be a valid non-negative number.",
          });
      }

      if (amount <= 0) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_AMOUNT_MUST_BE_POSITIVE",
            message:
              "Budget amount must be greater than zero.",
          });
      }

      if (year === null) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_YEAR_INVALID",
            message:
              "Budget year is invalid.",
          });
      }

      if (!accountId) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_ACCOUNT_REQUIRED",
            message:
              "An expense Chart of Accounts account is required.",
          });
      }

      if (
        requestedStatus &&
        !status
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_STATUS_INVALID",
            message:
              "Budget status is invalid.",
          });
      }

      /* ------------------------------------------------------
       * ACCOUNT VALIDATION
       * ------------------------------------------------------ */

      const accountResult =
        await validateExpenseAccount(
          context.organizationId,
          accountId
        );

      if (
        !accountResult.valid
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_ACCOUNT_INVALID",
            message:
              accountResult.reason,
          });
      }

      /* ------------------------------------------------------
       * DATE VALIDATION
       * ------------------------------------------------------ */

      const startDate =
        req.body?.startDate !==
        undefined
          ? parseDate(
              req.body.startDate
            )
          : getDefaultStartDate(
              year
            );

      const endDate =
        req.body?.endDate !==
        undefined
          ? parseDate(
              req.body.endDate
            )
          : getDefaultEndDate(
              year
            );

      if (
        !startDate ||
        !endDate
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DATE_INVALID",
            message:
              "Budget dates are invalid.",
          });
      }

      if (
        startDate > endDate
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DATE_RANGE_INVALID",
            message:
              "Budget start date cannot be after the end date.",
          });
      }

      if (
        !isDateWithinYear(
          startDate,
          year
        ) ||
        !isDateWithinYear(
          endDate,
          year
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DATE_OUTSIDE_YEAR",
            message:
              "Budget dates must fall within the selected budget year.",
          });
      }

      /* ------------------------------------------------------
       * DUPLICATE VALIDATION
       * ------------------------------------------------------ */

      const duplicate =
        await prisma.budget.findFirst({
          where: {
            organizationId:
              context.organizationId,

            department,

            year,

            accountId,
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              "BUDGET_ALREADY_EXISTS",
            message:
              "A budget already exists for this department, account and year.",
          });
      }

      /* ------------------------------------------------------
       * CREATE
       * ------------------------------------------------------ */

      const budget =
        await prisma.budget.create({
          data: {
            name,

            department,

            amount,

            year,

            accountId,

            status:
              status ??
              "DRAFT",

            startDate,

            endDate,

            createdBy:
              context.userId,

            organizationId:
              context.organizationId,
          },

          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        });

      return res
        .status(201)
        .json({
          success: true,

          data: budget,

          message:
            "Budget created successfully.",
        });
    } catch (error) {
      console.error(
        "[BUDGET] Failed to create budget:",
        error
      );

      /**
       * Prisma unique constraint handling.
       *
       * Even though duplicate checking is performed above,
       * this protects against future database-level unique
       * constraints and concurrent requests.
       */
      if (
        typeof error ===
          "object" &&
        error !== null &&
        "code" in error &&
        (error as {
          code?: string;
        }).code ===
          "P2002"
      ) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              "BUDGET_ALREADY_EXISTS",
            message:
              "A budget with the same configuration already exists.",
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          code:
            "BUDGET_CREATE_FAILED",
          message:
            "Failed to create budget.",
        });
    }
  };

/* ============================================================
 * UPDATE BUDGET
 * ============================================================ */

/**
 * PUT /api/budgets/:id
 */
export const updateBudget =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res
          .status(403)
          .json({
            success: false,
            code:
              "TENANT_SESSION_REQUIRED",
            message:
              "A tenant session is required.",
          });
      }

      const id =
        typeof req.params.id ===
        "string"
          ? req.params.id.trim()
          : "";

      if (!id) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_ID_REQUIRED",
            message:
              "Budget ID is required.",
          });
      }

      /* ------------------------------------------------------
       * TENANT-SCOPED EXISTENCE CHECK
       * ------------------------------------------------------ */

      const existing =
        await prisma.budget.findFirst({
          where: {
            id,

            organizationId:
              context.organizationId,
          },
        });

      if (!existing) {
        return res
          .status(404)
          .json({
            success: false,
            code:
              "BUDGET_NOT_FOUND",
            message:
              "Budget not found.",
          });
      }

      /* ------------------------------------------------------
       * NORMALIZE INPUT
       * ------------------------------------------------------ */

      const name =
        req.body?.name !==
        undefined
          ? cleanString(
              req.body.name
            ) ||
            "Annual Budget"
          : existing.name;

      const department =
        req.body?.department !==
        undefined
          ? cleanString(
              req.body.department
            )
          : existing.department;

      const amount =
        req.body?.amount !==
        undefined
          ? parseAmount(
              req.body.amount
            )
          : Number(
              existing.amount
            );

      const year =
        req.body?.year !==
        undefined
          ? parseYear(
              req.body.year
            )
          : existing.year;

      const accountId =
        req.body?.accountId !==
        undefined
          ? cleanString(
              req.body.accountId
            )
          : existing.accountId;

      const statusInput =
        req.body?.status !==
        undefined
          ? cleanString(
              req.body.status
            )
          : existing.status;

      const status =
        parseStatus(
          statusInput
        );

      /* ------------------------------------------------------
       * VALIDATION
       * ------------------------------------------------------ */

      if (!name) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_NAME_REQUIRED",
            message:
              "Budget name is required.",
          });
      }

      if (!department) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DEPARTMENT_REQUIRED",
            message:
              "Department is required.",
          });
      }

      if (
        department.length >
        150
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DEPARTMENT_TOO_LONG",
            message:
              "Department name is too long.",
          });
      }

      if (amount === null) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_AMOUNT_INVALID",
            message:
              "Budget amount must be a valid non-negative number.",
          });
      }

      if (amount <= 0) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_AMOUNT_MUST_BE_POSITIVE",
            message:
              "Budget amount must be greater than zero.",
          });
      }

      if (year === null) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_YEAR_INVALID",
            message:
              "Budget year is invalid.",
          });
      }

      if (!accountId) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_ACCOUNT_REQUIRED",
            message:
              "An expense Chart of Accounts account is required.",
          });
      }

      if (!status) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_STATUS_INVALID",
            message:
              "Budget status is invalid.",
          });
      }

      /* ------------------------------------------------------
       * ACCOUNT VALIDATION
       * ------------------------------------------------------ */

      const accountResult =
        await validateExpenseAccount(
          context.organizationId,
          accountId
        );

      if (
        !accountResult.valid
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_ACCOUNT_INVALID",
            message:
              accountResult.reason,
          });
      }

      /* ------------------------------------------------------
       * DATE VALIDATION
       * ------------------------------------------------------ */

      const startDate =
        req.body?.startDate !==
        undefined
          ? parseDate(
              req.body.startDate
            )
          : existing.startDate ??
            getDefaultStartDate(
              year
            );

      const endDate =
        req.body?.endDate !==
        undefined
          ? parseDate(
              req.body.endDate
            )
          : existing.endDate ??
            getDefaultEndDate(
              year
            );

      if (
        !startDate ||
        !endDate
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DATE_INVALID",
            message:
              "Budget dates are invalid.",
          });
      }

      if (
        startDate > endDate
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DATE_RANGE_INVALID",
            message:
              "Budget start date cannot be after the end date.",
          });
      }

      if (
        !isDateWithinYear(
          startDate,
          year
        ) ||
        !isDateWithinYear(
          endDate,
          year
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_DATE_OUTSIDE_YEAR",
            message:
              "Budget dates must fall within the selected budget year.",
          });
      }

      /* ------------------------------------------------------
       * DUPLICATE CHECK
       * ------------------------------------------------------ */

      const duplicate =
        await prisma.budget.findFirst({
          where: {
            organizationId:
              context.organizationId,

            department,

            year,

            accountId,

            NOT: {
              id,
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              "BUDGET_ALREADY_EXISTS",
            message:
              "A budget already exists for this department, account and year.",
          });
      }

      /* ------------------------------------------------------
       * UPDATE
       * ------------------------------------------------------ */

      const budget =
        await prisma.budget.update({
          where: {
            id,
          },

          data: {
            name,

            department,

            amount,

            year,

            accountId,

            status,

            startDate,

            endDate,
          },

          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        });

      return res
        .status(200)
        .json({
          success: true,

          data: budget,

          message:
            "Budget updated successfully.",
        });
    } catch (error) {
      console.error(
        "[BUDGET] Failed to update budget:",
        error
      );

      if (
        typeof error ===
          "object" &&
        error !== null &&
        "code" in error &&
        (error as {
          code?: string;
        }).code ===
          "P2002"
      ) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              "BUDGET_ALREADY_EXISTS",
            message:
              "A budget with the same configuration already exists.",
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          code:
            "BUDGET_UPDATE_FAILED",
          message:
            "Failed to update budget.",
        });
    }
  };

/* ============================================================
 * DELETE BUDGET
 * ============================================================ */

/**
 * DELETE /api/budgets/:id
 */
export const deleteBudget =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res
          .status(403)
          .json({
            success: false,
            code:
              "TENANT_SESSION_REQUIRED",
            message:
              "A tenant session is required.",
          });
      }

      const id =
        typeof req.params.id ===
        "string"
          ? req.params.id.trim()
          : "";

      if (!id) {
        return res
          .status(400)
          .json({
            success: false,
            code:
              "BUDGET_ID_REQUIRED",
            message:
              "Budget ID is required.",
          });
      }

      /* ------------------------------------------------------
       * TENANT-SCOPED LOOKUP
       * ------------------------------------------------------ */

      const existing =
        await prisma.budget.findFirst({
          where: {
            id,

            organizationId:
              context.organizationId,
          },

          select: {
            id: true,
            status: true,
          },
        });

      if (!existing) {
        return res
          .status(404)
          .json({
            success: false,
            code:
              "BUDGET_NOT_FOUND",
            message:
              "Budget not found.",
          });
      }

      /* ------------------------------------------------------
       * DELETE
       * ------------------------------------------------------ */

      await prisma.budget.delete({
        where: {
          id,
        },
      });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Budget deleted successfully.",
        });
    } catch (error) {
      console.error(
        "[BUDGET] Failed to delete budget:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          code:
            "BUDGET_DELETE_FAILED",
          message:
            "Failed to delete budget.",
        });
    }
  };
