import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   TYPES
========================================================= */

type DateFilter = {
  gte?: Date;
  lte?: Date;
};

type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
};

const EFFECTIVE_STATUSES = ["POSTED", "APPROVED"] as const;
const MONEY_TOLERANCE = 0.01;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (req: AuthRequest): string | null =>
  req.user?.organizationId ?? null;

const getDateFilter = (req: AuthRequest): DateFilter => {
  const { startDate, endDate } = req.query;
  const filter: DateFilter = {};

  if (startDate !== undefined && startDate !== "") {
    const date = new Date(String(startDate));

    if (Number.isNaN(date.getTime())) {
      throw new Error("INVALID_START_DATE");
    }

    date.setHours(0, 0, 0, 0);
    filter.gte = date;
  }

  if (endDate !== undefined && endDate !== "") {
    const date = new Date(String(endDate));

    if (Number.isNaN(date.getTime())) {
      throw new Error("INVALID_END_DATE");
    }

    date.setHours(23, 59, 59, 999);
    filter.lte = date;
  }

  if (filter.gte && filter.lte && filter.gte > filter.lte) {
    throw new Error("INVALID_DATE_RANGE");
  }

  return filter;
};

const hasDateFilter = (filter: DateFilter): boolean =>
  Boolean(filter.gte || filter.lte);

const parsePagination = (req: AuthRequest): Pagination => {
  const rawPage = Number(req.query.page);
  const rawPageSize = Number(
    req.query.pageSize ?? req.query.limit,
  );

  const page =
    Number.isFinite(rawPage) && rawPage > 0
      ? Math.floor(rawPage)
      : 1;

  const requestedSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.floor(rawPageSize)
      : DEFAULT_PAGE_SIZE;

  const pageSize = Math.min(
    requestedSize,
    MAX_PAGE_SIZE,
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
};

const getSearch = (req: AuthRequest): string =>
  String(req.query.search ?? "")
    .trim()
    .toLowerCase();

const percentageChange = (
  current: number,
  previous: number,
): number => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return (
    ((current - previous) /
      Math.abs(previous)) *
    100
  );
};

const round = (value: number): number =>
  Math.round(
    (Number.isFinite(value) ? value : 0) * 100,
  ) / 100;

const getAmount = (value: unknown): number => {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? amount
    : 0;
};

const parseYear = (req: AuthRequest): number => {
  const value = Number(req.query.year);

  return Number.isInteger(value) &&
    value >= 1900 &&
    value <= 9999
    ? value
    : new Date().getFullYear();
};

const getOpeningEndDate = (
  startDate?: Date,
): Date | null =>
  startDate
    ? new Date(
        startDate.getTime() - 1,
      )
    : null;

const sendDateError = (
  res: Response,
  error: unknown,
): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (
    error.message ===
    "INVALID_START_DATE"
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid startDate",
    });

    return true;
  }

  if (
    error.message ===
    "INVALID_END_DATE"
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid endDate",
    });

    return true;
  }

  if (
    error.message ===
    "INVALID_DATE_RANGE"
  ) {
    res.status(400).json({
      success: false,
      message:
        "startDate cannot be after endDate",
    });

    return true;
  }

  return false;
};

const reportDateMeta = (
  organizationId: string,
  dateFilter: DateFilter,
) => ({
  organizationId,

  startDate:
    dateFilter.gte?.toISOString() ??
    null,

  endDate:
    (
      dateFilter.lte ??
      new Date()
    ).toISOString(),

  generatedAt:
    new Date().toISOString(),
});

/*
 * JournalEntryLine is the authoritative accounting source
 * for financial reporting.
 *
 * Only POSTED and APPROVED journal entries are reportable.
 * DRAFT and REVERSED entries are excluded.
 */
const getAccountTypeTotals = async (
  organizationId: string,
  types: string[],
  dateFilter?: DateFilter,
) => {
  if (types.length === 0) {
    return [];
  }

  return prisma.journalEntryLine.groupBy({
    by: ["accountId"],

    where: {
      account: {
        organizationId,
        type: {
          in: types,
        },
      },

      journalEntry: {
        organizationId,

        status: {
          in: [
            ...EFFECTIVE_STATUSES,
          ],
        },

        ...(dateFilter &&
        hasDateFilter(dateFilter)
          ? {
              transactionDate:
                dateFilter,
            }
          : {}),
      },
    },

    _sum: {
      debit: true,
      credit: true,
    },
  });
};

const getAccountBalanceMap = (
  rows: Array<{
    accountId: string;
    _sum: {
      debit: unknown;
      credit: unknown;
    };
  }>,
  normalBalance:
    | "DEBIT"
    | "CREDIT",
): Map<string, number> => {
  const map =
    new Map<string, number>();

  for (const row of rows) {
    const debit =
      getAmount(row._sum.debit);

    const credit =
      getAmount(row._sum.credit);

    map.set(
      row.accountId,
      round(
        normalBalance === "DEBIT"
          ? debit - credit
          : credit - debit,
      ),
    );
  }

  return map;
};

const parseSearchAndPagination = (
  req: AuthRequest,
) => ({
  search: getSearch(req),
  pagination:
    parsePagination(req),
});

const paginate = <T>(
  items: T[],
  pagination: Pagination,
) => {
  const total = items.length;

  return {
    data: items.slice(
      pagination.skip,
      pagination.skip +
        pagination.pageSize,
    ),

    pagination: {
      page: pagination.page,
      pageSize:
        pagination.pageSize,
      total,

      totalPages:
        total === 0
          ? 0
          : Math.ceil(
              total /
                pagination.pageSize,
            ),
    },
  };
};

/* =========================================================
   REVENUE ANALYSIS
========================================================= */

export const getRevenueAnalysis =
  async (
    req: AuthRequest,
    res: Response,
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

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          sendDateError(
            res,
            error,
          )
        ) {
          return;
        }

        throw error;
      }

      const {
        search,
        pagination,
      } =
        parseSearchAndPagination(
          req,
        );

      const [
        accounts,
        aggregation,
      ] = await Promise.all([
        prisma.account.findMany({
          where: {
            organizationId,
            type: "INCOME",
          },

          select: {
            id: true,
            code: true,
            name: true,
          },

          orderBy: {
            code: "asc",
          },
        }),

        getAccountTypeTotals(
          organizationId,
          ["INCOME"],
          dateFilter,
        ),
      ]);

      const balances =
        getAccountBalanceMap(
          aggregation,
          "CREDIT",
        );

      const revenue =
        accounts
          .map((account) => ({
            code: account.code,
            name: account.name,

            amount: round(
              balances.get(
                account.id,
              ) ?? 0,
            ),
          }))

          .filter(
            (item) =>
              item.amount !== 0,
          )

          .filter(
            (item) =>
              !search ||
              item.code
                .toLowerCase()
                .includes(search) ||
              item.name
                .toLowerCase()
                .includes(search),
          );

      const totalRevenue =
        round(
          accounts.reduce(
            (sum, account) =>
              sum +
              (
                balances.get(
                  account.id,
                ) ?? 0
              ),

            0,
          ),
        );

      const allNonZero =
        accounts
          .map((account) => ({
            code: account.code,
            name: account.name,
            amount: round(
              balances.get(
                account.id,
              ) ?? 0,
            ),
          }))
          .filter(
            (item) =>
              item.amount !== 0,
          );

      const page =
        paginate(
          revenue,
          pagination,
        );

      return res.status(200).json({
        success: true,

        data: page.data,

        totals: {
          revenue:
            totalRevenue,
        },

        controls: {
          reportAccounts:
            accounts.length,

          nonZeroAccounts:
            allNonZero.length,

          displayedAccounts:
            revenue.length,

          reportingBasis:
            "POSTED_AND_APPROVED",

          accountingBasis:
            "ACCRUAL",

          source:
            "JournalEntryLine",
        },

        pagination:
          page.pagination,

        meta: {
          ...reportDateMeta(
            organizationId,
            dateFilter,
          ),

          search:
            search || null,
        },
      });
    } catch (error) {
      console.error(
        "REVENUE ANALYSIS ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate revenue analysis",
      });
    }
  };

/* =========================================================
   EXPENSE ANALYSIS
========================================================= */

export const getExpenseAnalysis =
  async (
    req: AuthRequest,
    res: Response,
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

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          sendDateError(
            res,
            error,
          )
        ) {
          return;
        }

        throw error;
      }

      const {
        search,
        pagination,
      } =
        parseSearchAndPagination(
          req,
        );

      const [
        accounts,
        aggregation,
      ] = await Promise.all([
        prisma.account.findMany({
          where: {
            organizationId,
            type: "EXPENSE",
          },

          select: {
            id: true,
            code: true,
            name: true,
          },

          orderBy: {
            code: "asc",
          },
        }),

        getAccountTypeTotals(
          organizationId,
          ["EXPENSE"],
          dateFilter,
        ),
      ]);

      const balances =
        getAccountBalanceMap(
          aggregation,
          "DEBIT",
        );

      const expenses =
        accounts
          .map((account) => ({
            code: account.code,
            name: account.name,

            amount: round(
              balances.get(
                account.id,
              ) ?? 0,
            ),
          }))

          .filter(
            (item) =>
              item.amount !== 0,
          )

          .filter(
            (item) =>
              !search ||
              item.code
                .toLowerCase()
                .includes(search) ||
              item.name
                .toLowerCase()
                .includes(search),
          );

      const totalExpenses =
        round(
          accounts.reduce(
            (sum, account) =>
              sum +
              (
                balances.get(
                  account.id,
                ) ?? 0
              ),

            0,
          ),
        );

      const allNonZero =
        accounts
          .map((account) => ({
            code: account.code,
            name: account.name,
            amount: round(
              balances.get(
                account.id,
              ) ?? 0,
            ),
          }))
          .filter(
            (item) =>
              item.amount !== 0,
          );

      const page =
        paginate(
          expenses,
          pagination,
        );

      return res.status(200).json({
        success: true,

        data: page.data,

        totals: {
          expenses:
            totalExpenses,
        },

        controls: {
          reportAccounts:
            accounts.length,

          nonZeroAccounts:
            allNonZero.length,

          displayedAccounts:
            expenses.length,

          reportingBasis:
            "POSTED_AND_APPROVED",

          accountingBasis:
            "ACCRUAL",

          source:
            "JournalEntryLine",
        },

        pagination:
          page.pagination,

        meta: {
          ...reportDateMeta(
            organizationId,
            dateFilter,
          ),

          search:
            search || null,
        },
      });
    } catch (error) {
      console.error(
        "EXPENSE ANALYSIS ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate expense analysis",
      });
    }
  };

/* =========================================================
   BUDGET VS ACTUAL
========================================================= */

export const getBudgetVsActual =
  async (
    req: AuthRequest,
    res: Response,
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

      const year =
        parseYear(req);

      const {
        search,
        pagination,
      } =
        parseSearchAndPagination(
          req,
        );

      const startDate =
        new Date(
          year,
          0,
          1,
          0,
          0,
          0,
          0,
        );

      const endDate =
        new Date(
          year,
          11,
          31,
          23,
          59,
          59,
          999,
        );

      const [
        budgets,
        expenseAccounts,
        expenseAggregation,
      ] = await Promise.all([
        prisma.budget.findMany({
          where: {
            organizationId,
            year,
          },

          select: {
            id: true,
            department: true,
            amount: true,
            year: true,
            accountId: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },

          orderBy: [
            {
              department:
                "asc",
            },
            {
              name: "asc",
            },
            {
              id: "asc",
            },
          ],
        }),

        prisma.account.findMany({
          where: {
            organizationId,
            type: "EXPENSE",
          },

          select: {
            id: true,
            code: true,
            name: true,
          },

          orderBy: {
            code: "asc",
          },
        }),

        getAccountTypeTotals(
          organizationId,
          ["EXPENSE"],
          {
            gte: startDate,
            lte: endDate,
          },
        ),
      ]);

      const actualByAccount =
        getAccountBalanceMap(
          expenseAggregation,
          "DEBIT",
        );

      const accountMap =
        new Map(
          expenseAccounts.map(
            (account) => [
              account.id,
              account,
            ],
          ),
        );

      /*
       * Multiple budget rows can point to the
       * same expense account. Actual expenditure
       * is therefore allocated proportionally by
       * budget amount instead of being duplicated.
       */
      const budgetByAccount =
        new Map<
          string,
          number
        >();

      for (const budget of budgets) {
        if (budget.accountId) {
          budgetByAccount.set(
            budget.accountId,
            round(
              (
                budgetByAccount.get(
                  budget.accountId,
                ) ?? 0
              ) +
                getAmount(
                  budget.amount,
                ),
            ),
          );
        }
      }

      const totalBudget =
        round(
          budgets.reduce(
            (sum, budget) =>
              sum +
              getAmount(
                budget.amount,
              ),
            0,
          ),
        );

      const totalActual =
        round(
          expenseAccounts.reduce(
            (sum, account) =>
              sum +
              (
                actualByAccount.get(
                  account.id,
                ) ?? 0
              ),
            0,
          ),
        );

      const rows =
        budgets.map(
          (budget) => {
            const budgetAmount =
              round(
                getAmount(
                  budget.amount,
                ),
              );

            const accountBudgetTotal =
              budget.accountId
                ? (
                    budgetByAccount.get(
                      budget.accountId,
                    ) ?? 0
                  )
                : 0;

            const accountActual =
              budget.accountId
                ? (
                    actualByAccount.get(
                      budget.accountId,
                    ) ?? 0
                  )
                : 0;

            const actual =
              budget.accountId &&
              accountBudgetTotal > 0
                ? round(
                    accountActual *
                      (
                        budgetAmount /
                        accountBudgetTotal
                      ),
                  )
                : 0;

            const variance =
              round(
                budgetAmount -
                  actual,
              );

            const utilization =
              budgetAmount > 0
                ? round(
                    (
                      actual /
                      budgetAmount
                    ) * 100,
                  )
                : 0;

            const account =
              budget.accountId
                ? accountMap.get(
                    budget.accountId,
                  )
                : undefined;

            return {
              id: budget.id,

              department:
                budget.department,

              name:
                budget.name,

              year:
                budget.year,

              accountId:
                budget.accountId,

              accountCode:
                account?.code ??
                null,

              accountName:
                account?.name ??
                null,

              budget:
                budgetAmount,

              actual,

              variance,

              utilizationPercentage:
                utilization,

              status:
                budget.status,

              allocationStatus:
                budget.accountId
                  ? "ACCOUNT_MAPPED"
                  : "UNASSIGNED_ACCOUNT",

              startDate:
                budget.startDate
                  ?.toISOString() ??
                null,

              endDate:
                budget.endDate
                  ?.toISOString() ??
                null,
            };
          },
        );

      const filteredRows =
        rows.filter(
          (row) => {
            if (!search) {
              return true;
            }

            const haystack = [
              row.department,
              row.name,
              row.accountCode ??
                "",
              row.accountName ??
                "",
              row.status,
            ]
              .join(" ")
              .toLowerCase();

            return haystack.includes(
              search,
            );
          },
        );

      const page =
        paginate(
          filteredRows,
          pagination,
        );

      const unassignedBudget =
        round(
          budgets
            .filter(
              (budget) =>
                !budget.accountId,
            )
            .reduce(
              (sum, budget) =>
                sum +
                getAmount(
                  budget.amount,
                ),
              0,
            ),
        );

      const variance =
        round(
          totalBudget -
            totalActual,
        );

      const utilization =
        totalBudget > 0
          ? round(
              (
                totalActual /
                totalBudget
              ) * 100,
            )
          : 0;

      return res.status(200).json({
        success: true,

        data: page.data,

        totals: {
          budget:
            totalBudget,

          actual:
            totalActual,

          variance,

          utilizationPercentage:
            utilization,
        },

        controls: {
          budgetRows:
            budgets.length,

          accountMappedRows:
            budgets.filter(
              (budget) =>
                Boolean(
                  budget.accountId,
                ),
            ).length,

          unassignedBudget,

          actualSource:
            "JournalEntryLine",

          reportingBasis:
            "POSTED_AND_APPROVED",

          accountingBasis:
            "ACCRUAL",

          note:
            "Actual expense totals are organization-wide. Row-level actuals are allocated only where a budget is linked to an expense account.",
        },

        pagination:
          page.pagination,

        meta: {
          organizationId,
          year,

          startDate:
            startDate.toISOString(),

          endDate:
            endDate.toISOString(),

          search:
            search || null,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "BUDGET VS ACTUAL ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate budget vs actual report",
      });
    }
  };

/* =========================================================
   BUDGET VARIANCE
========================================================= */

export const getBudgetVariance =
  async (
    req: AuthRequest,
    res: Response,
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

      const year =
        parseYear(req);

      const startDate =
        new Date(
          year,
          0,
          1,
          0,
          0,
          0,
          0,
        );

      const endDate =
        new Date(
          year,
          11,
          31,
          23,
          59,
          59,
          999,
        );

      const [
        budgets,
        expenseAggregation,
      ] = await Promise.all([
        prisma.budget.findMany({
          where: {
            organizationId,
            year,
          },

          select: {
            id: true,
            department: true,
            amount: true,
            year: true,
            accountId: true,
            name: true,
            status: true,
          },

          orderBy: [
            {
              department:
                "asc",
            },
            {
              name: "asc",
            },
            {
              id: "asc",
            },
          ],
        }),

        getAccountTypeTotals(
          organizationId,
          ["EXPENSE"],
          {
            gte: startDate,
            lte: endDate,
          },
        ),
      ]);

      const actualByAccount =
        getAccountBalanceMap(
          expenseAggregation,
          "DEBIT",
        );

      const budgetByAccount =
        new Map<
          string,
          number
        >();

      for (const budget of budgets) {
        if (budget.accountId) {
          budgetByAccount.set(
            budget.accountId,
            round(
              (
                budgetByAccount.get(
                  budget.accountId,
                ) ?? 0
              ) +
                getAmount(
                  budget.amount,
                ),
            ),
          );
        }
      }

      const totalBudget =
        round(
          budgets.reduce(
            (sum, budget) =>
              sum +
              getAmount(
                budget.amount,
              ),
            0,
          ),
        );

      const accountIds =
        budgets
          .map(
            (budget) =>
              budget.accountId,
          )
          .filter(
            (
              id,
            ): id is string =>
              Boolean(id),
          );

      const uniqueAccountIds =
        [
          ...new Set(
            accountIds,
          ),
        ];

      const accounts =
        uniqueAccountIds.length
          ? await prisma.account.findMany(
              {
                where: {
                  organizationId,

                  id: {
                    in:
                      uniqueAccountIds,
                  },

                  type: "EXPENSE",
                },

                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            )
          : [];

      const accountMap =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              account,
            ],
          ),
        );

      const totalActual =
        round(
          [
            ...actualByAccount.values(),
          ].reduce(
            (sum, value) =>
              sum + value,
            0,
          ),
        );

      const variance =
        round(
          totalBudget -
            totalActual,
        );

      const variancePercentage =
        totalBudget > 0
          ? round(
              (
                variance /
                totalBudget
              ) * 100,
            )
          : 0;

      const data =
        budgets.map(
          (budget) => {
            const budgetAmount =
              round(
                getAmount(
                  budget.amount,
                ),
              );

            const accountBudgetTotal =
              budget.accountId
                ? (
                    budgetByAccount.get(
                      budget.accountId,
                    ) ?? 0
                  )
                : 0;

            const accountActual =
              budget.accountId
                ? (
                    actualByAccount.get(
                      budget.accountId,
                    ) ?? 0
                  )
                : 0;

            const actual =
              budget.accountId &&
              accountBudgetTotal > 0
                ? round(
                    accountActual *
                      (
                        budgetAmount /
                        accountBudgetTotal
                      ),
                  )
                : 0;

            const rowVariance =
              round(
                budgetAmount -
                  actual,
              );

            const rowVariancePercentage =
              budgetAmount > 0
                ? round(
                    (
                      rowVariance /
                      budgetAmount
                    ) * 100,
                  )
                : 0;

            const account =
              budget.accountId
                ? accountMap.get(
                    budget.accountId,
                  )
                : undefined;

            return {
              id:
                budget.id,

              year:
                budget.year,

              department:
                budget.department,

              name:
                budget.name,

              accountId:
                budget.accountId,

              accountCode:
                account?.code ??
                null,

              accountName:
                account?.name ??
                null,

              budget:
                budgetAmount,

              actual,

              variance:
                rowVariance,

              variancePercentage:
                rowVariancePercentage,

              status:
                rowVariance >= 0
                  ? "FAVORABLE"
                  : "UNFAVORABLE",

              allocationStatus:
                budget.accountId
                  ? "ACCOUNT_MAPPED"
                  : "UNASSIGNED_ACCOUNT",

              budgetStatus:
                budget.status,
            };
          },
        );

      return res.status(200).json({
        success: true,

        data,

        totals: {
          budget:
            totalBudget,

          actual:
            totalActual,

          variance,

          variancePercentage,
        },

        controls: {
          reportingBasis:
            "POSTED_AND_APPROVED",

          accountingBasis:
            "ACCRUAL",

          actualSource:
            "JournalEntryLine",

          note:
            "Positive expense variance means budget remains above actual expenditure. Row-level actuals require an account-linked budget.",
        },

        meta: {
          organizationId,
          year,

          startDate:
            startDate.toISOString(),

          endDate:
            endDate.toISOString(),

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "BUDGET VARIANCE ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate budget variance report",
      });
    }
  };

/* =========================================================
   FINANCIAL KPIs
========================================================= */

export const getFinancialKpis =
  async (
    req: AuthRequest,
    res: Response,
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

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          sendDateError(
            res,
            error,
          )
        ) {
          return;
        }

        throw error;
      }

      /*
       * P&L metrics use the selected reporting period.
       *
       * Balance-sheet metrics are point-in-time and therefore
       * use the report end date.
       */
      const periodFilter =
        dateFilter;

      const asOfDate =
        dateFilter.lte ??
        new Date();

      const balanceFilter: DateFilter =
        {
          lte: asOfDate,
        };

      const openingBalanceFilter =
        dateFilter.gte
          ? {
              lte: new Date(
                dateFilter.gte.getTime() -
                  1,
              ),
            }
          : undefined;

      const [
        periodTotals,
        balanceTotals,
        openingBalanceTotals,
        cumulativeIncomeExpenseTotals,
        openingIncomeExpenseTotals,
      ] = await Promise.all([
        getAccountTypeTotals(
          organizationId,
          [
            "INCOME",
            "EXPENSE",
          ],
          periodFilter,
        ),

        getAccountTypeTotals(
          organizationId,
          [
            "ASSET",
            "LIABILITY",
            "EQUITY",
          ],
          balanceFilter,
        ),

        openingBalanceFilter
          ? getAccountTypeTotals(
              organizationId,
              [
                "ASSET",
                "EQUITY",
              ],
              openingBalanceFilter,
            )
          : Promise.resolve(
              [],
            ),

        getAccountTypeTotals(
          organizationId,
          [
            "INCOME",
            "EXPENSE",
          ],
          balanceFilter,
        ),

        openingBalanceFilter
          ? getAccountTypeTotals(
              organizationId,
              [
                "INCOME",
                "EXPENSE",
              ],
              openingBalanceFilter,
            )
          : Promise.resolve(
              [],
            ),
      ]);

      const periodAccountIds =
        periodTotals.map(
          (row) =>
            row.accountId,
        );

      const balanceAccountIds =
        balanceTotals.map(
          (row) =>
            row.accountId,
        );

      const accountIds =
        [
          ...new Set([
            ...periodAccountIds,
            ...balanceAccountIds,

            ...openingBalanceTotals.map(
              (row) =>
                row.accountId,
            ),

            ...cumulativeIncomeExpenseTotals.map(
              (row) =>
                row.accountId,
            ),

            ...openingIncomeExpenseTotals.map(
              (row) =>
                row.accountId,
            ),
          ]),
        ];

      const accounts =
        accountIds.length
          ? await prisma.account.findMany(
              {
                where: {
                  organizationId,

                  id: {
                    in: accountIds,
                  },
                },

                select: {
                  id: true,
                  type: true,
                },
              },
            )
          : [];

      const typeMap =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              account.type,
            ],
          ),
        );

      let revenue = 0;
      let expenses = 0;

      for (
        const row of
          periodTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "INCOME"
        ) {
          revenue +=
            credit - debit;
        }

        if (
          type === "EXPENSE"
        ) {
          expenses +=
            debit - credit;
        }
      }

      let assets = 0;
      let liabilities = 0;
      let directEquity = 0;

      for (
        const row of
          balanceTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "ASSET"
        ) {
          assets +=
            debit - credit;
        }

        if (
          type === "LIABILITY"
        ) {
          liabilities +=
            credit - debit;
        }

        if (
          type === "EQUITY"
        ) {
          directEquity +=
            credit - debit;
        }
      }

      let cumulativeRevenue = 0;
      let cumulativeExpenses = 0;

      for (
        const row of
          cumulativeIncomeExpenseTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "INCOME"
        ) {
          cumulativeRevenue +=
            credit - debit;
        }

        if (
          type === "EXPENSE"
        ) {
          cumulativeExpenses +=
            debit - credit;
        }
      }

      let openingAssets = 0;
      let openingDirectEquity =
        0;

      for (
        const row of
          openingBalanceTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "ASSET"
        ) {
          openingAssets +=
            debit - credit;
        }

        if (
          type === "EQUITY"
        ) {
          openingDirectEquity +=
            credit - debit;
        }
      }

      let openingRevenue = 0;
      let openingExpenses = 0;

      for (
        const row of
          openingIncomeExpenseTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "INCOME"
        ) {
          openingRevenue +=
            credit - debit;
        }

        if (
          type === "EXPENSE"
        ) {
          openingExpenses +=
            debit - credit;
        }
      }

      const cumulativeProfitLoss =
        cumulativeRevenue -
        cumulativeExpenses;

      const openingProfitLoss =
        openingRevenue -
        openingExpenses;

      let equity =
        directEquity +
        cumulativeProfitLoss;

      revenue =
        round(revenue);

      expenses =
        round(expenses);

      assets =
        round(assets);

      liabilities =
        round(liabilities);

      directEquity =
        round(directEquity);

      equity =
        round(equity);

      cumulativeRevenue =
        round(cumulativeRevenue);

      cumulativeExpenses =
        round(cumulativeExpenses);

      openingAssets =
        openingBalanceFilter
          ? round(openingAssets)
          : assets;

      openingDirectEquity =
        openingBalanceFilter
          ? round(
              openingDirectEquity,
            )
          : directEquity;

      const netProfit =
        round(
          revenue -
            expenses,
        );

      const netMargin =
        revenue !== 0
          ? round(
              (
                netProfit /
                revenue
              ) * 100,
            )
          : 0;

      const averageAssets =
        openingBalanceFilter
          ? round(
              (
                openingAssets +
                assets
              ) / 2,
            )
          : assets;

      const averageEquity =
        openingBalanceFilter
          ? round(
              (
                openingDirectEquity +
                openingProfitLoss +
                equity
              ) / 2,
            )
          : equity;

      const returnOnAssets =
        averageAssets !== 0
          ? round(
              (
                netProfit /
                averageAssets
              ) * 100,
            )
          : 0;

      const returnOnEquity =
        averageEquity !== 0
          ? round(
              (
                netProfit /
                averageEquity
              ) * 100,
            )
          : 0;

      const debtToEquity =
        equity !== 0
          ? round(
              liabilities /
                equity,
            )
          : 0;

      const debtRatio =
        assets !== 0
          ? round(
              (
                liabilities /
                assets
              ) * 100,
            )
          : 0;

      const equityRatio =
        assets !== 0
          ? round(
              (
                equity /
                assets
              ) * 100,
            )
          : 0;

      return res.status(200).json({
        success: true,

        data: [
          {
            metric:
              "Revenue",
            value:
              revenue,
          },

          {
            metric:
              "Expenses",
            value:
              expenses,
          },

          {
            metric:
              "Net Profit",
            value:
              netProfit,
          },

          {
            metric:
              "Net Profit Margin",
            value:
              netMargin,
            unit: "%",
          },

          {
            metric:
              "Return on Assets",
            value:
              returnOnAssets,
            unit: "%",
          },

          {
            metric:
              "Return on Equity",
            value:
              returnOnEquity,
            unit: "%",
          },

          {
            metric:
              "Debt to Equity",
            value:
              debtToEquity,
          },

          {
            metric:
              "Debt Ratio",
            value:
              debtRatio,
            unit: "%",
          },

          {
            metric:
              "Equity Ratio",
            value:
              equityRatio,
            unit: "%",
          },
        ],

        totals: {
          revenue,
          expenses,
          netProfit,

          assets,
          liabilities,
          equity,

          directEquity,

          cumulativeProfitLoss:
            round(
              cumulativeProfitLoss,
            ),

          openingProfitLoss:
            round(
              openingProfitLoss,
            ),

          averageAssets,
          averageEquity,

          netMargin,
          returnOnAssets,
          returnOnEquity,

          debtToEquity,
          debtRatio,
          equityRatio,
        },

        controls: {
          profitLossBasis:
            "SELECTED_PERIOD",

          balanceSheetBasis:
            "AS_OF_END_DATE",

          returnBasis:
            openingBalanceFilter
              ? "AVERAGE_BEGINNING_AND_END_BALANCES"
              : "ENDING_BALANCE",

          reportingBasis:
            "POSTED_AND_APPROVED",

          accountingBasis:
            "ACCRUAL",

          source:
            "JournalEntryLine",
        },

        meta: {
          ...reportDateMeta(
            organizationId,
            dateFilter,
          ),

          asOfDate:
            asOfDate.toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "FINANCIAL KPI ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate financial KPI report",
      });
    }
  };

/* =========================================================
   FINANCIAL RATIOS
========================================================= */

export const getFinancialRatios =
  async (
    req: AuthRequest,
    res: Response,
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

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          sendDateError(
            res,
            error,
          )
        ) {
          return;
        }

        throw error;
      }

      const asOfDate =
        dateFilter.lte ??
        new Date();

      const openingBalanceFilter =
        dateFilter.gte
          ? {
              lte: new Date(
                dateFilter.gte.getTime() -
                  1,
              ),
            }
          : undefined;

      const [
        periodTotals,
        balanceTotals,
        openingBalanceTotals,
        cumulativeIncomeExpenseTotals,
      ] = await Promise.all([
        getAccountTypeTotals(
          organizationId,
          [
            "INCOME",
            "EXPENSE",
          ],
          dateFilter,
        ),

        getAccountTypeTotals(
          organizationId,
          [
            "ASSET",
            "LIABILITY",
            "EQUITY",
          ],
          {
            lte: asOfDate,
          },
        ),

        openingBalanceFilter
          ? getAccountTypeTotals(
              organizationId,
              [
                "ASSET",
                "EQUITY",
              ],
              openingBalanceFilter,
            )
          : Promise.resolve(
              [],
            ),

        getAccountTypeTotals(
          organizationId,
          [
            "INCOME",
            "EXPENSE",
          ],
          {
            lte: asOfDate,
          },
        ),
      ]);

      const accountIds =
        [
          ...new Set([
            ...periodTotals.map(
              (row) =>
                row.accountId,
            ),

            ...balanceTotals.map(
              (row) =>
                row.accountId,
            ),

            ...openingBalanceTotals.map(
              (row) =>
                row.accountId,
            ),

            ...cumulativeIncomeExpenseTotals.map(
              (row) =>
                row.accountId,
            ),
          ]),
        ];

      const accounts =
        accountIds.length
          ? await prisma.account.findMany(
              {
                where: {
                  organizationId,

                  id: {
                    in: accountIds,
                  },
                },

                select: {
                  id: true,
                  type: true,
                },
              },
            )
          : [];

      const typeMap =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              account.type,
            ],
          ),
        );

      let assets = 0;
      let liabilities = 0;
      let directEquity = 0;

      for (
        const row of
          balanceTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "ASSET"
        ) {
          assets +=
            debit - credit;
        }

        if (
          type === "LIABILITY"
        ) {
          liabilities +=
            credit - debit;
        }

        if (
          type === "EQUITY"
        ) {
          directEquity +=
            credit - debit;
        }
      }

      let revenue = 0;
      let expenses = 0;

      for (
        const row of
          periodTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "INCOME"
        ) {
          revenue +=
            credit - debit;
        }

        if (
          type === "EXPENSE"
        ) {
          expenses +=
            debit - credit;
        }
      }

      let cumulativeRevenue =
        0;

      let cumulativeExpenses =
        0;

      for (
        const row of
          cumulativeIncomeExpenseTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "INCOME"
        ) {
          cumulativeRevenue +=
            credit - debit;
        }

        if (
          type === "EXPENSE"
        ) {
          cumulativeExpenses +=
            debit - credit;
        }
      }

      let openingAssets = 0;
      let openingDirectEquity =
        0;

      for (
        const row of
          openingBalanceTotals
      ) {
        const type =
          typeMap.get(
            row.accountId,
          );

        const debit =
          getAmount(
            row._sum.debit,
          );

        const credit =
          getAmount(
            row._sum.credit,
          );

        if (
          type === "ASSET"
        ) {
          openingAssets +=
            debit - credit;
        }

        if (
          type === "EQUITY"
        ) {
          openingDirectEquity +=
            credit - debit;
        }
      }

      assets =
        round(assets);

      liabilities =
        round(liabilities);

      directEquity =
        round(directEquity);

      revenue =
        round(revenue);

      expenses =
        round(expenses);

      const netProfit =
        round(
          revenue -
            expenses,
        );

      const cumulativeEquityProfitLoss =
        round(
          cumulativeRevenue -
            cumulativeExpenses,
        );

      const equity =
        round(
          directEquity +
            cumulativeEquityProfitLoss,
        );

      const averageAssets =
        openingBalanceFilter
          ? round(
              (
                round(
                  openingAssets,
                ) +
                assets
              ) / 2,
            )
          : assets;

      const averageEquity =
        openingBalanceFilter
          ? round(
              (
                round(
                  openingDirectEquity,
                ) +
                (
                  equity
                )
              ) / 2,
            )
          : equity;

      const debtToEquity =
        equity !== 0
          ? round(
              liabilities /
                equity,
            )
          : 0;

      const debtRatio =
        assets !== 0
          ? round(
              (
                liabilities /
                assets
              ) * 100,
            )
          : 0;

      const equityRatio =
        assets !== 0
          ? round(
              (
                equity /
                assets
              ) * 100,
            )
          : 0;

      const returnOnAssets =
        averageAssets !== 0
          ? round(
              (
                netProfit /
                averageAssets
              ) * 100,
            )
          : 0;

      const returnOnEquity =
        averageEquity !== 0
          ? round(
              (
                netProfit /
                averageEquity
              ) * 100,
            )
          : 0;

      const profitMargin =
        revenue !== 0
          ? round(
              (
                netProfit /
                revenue
              ) * 100,
            )
          : 0;

      return res.status(200).json({
        success: true,

        data: [
          {
            ratio:
              "Debt to Equity",

            value:
              debtToEquity,
          },

          {
            ratio:
              "Debt Ratio",

            value:
              debtRatio,

            unit: "%",
          },

          {
            ratio:
              "Equity Ratio",

            value:
              equityRatio,

            unit: "%",
          },

          {
            ratio:
              "Return on Assets",

            value:
              returnOnAssets,

            unit: "%",
          },

          {
            ratio:
              "Return on Equity",

            value:
              returnOnEquity,

            unit: "%",
          },

          {
            ratio:
              "Net Profit Margin",

            value:
              profitMargin,

            unit: "%",
          },
        ],

        totals: {
          assets,
          liabilities,
          equity,

          revenue,
          expenses,
          netProfit,

          debtToEquity,
          debtRatio,
          equityRatio,

          returnOnAssets,
          returnOnEquity,
          profitMargin,
        },

        controls: {
          profitLossBasis:
            "SELECTED_PERIOD",

          balanceSheetBasis:
            "AS_OF_END_DATE",

          returnBasis:
            openingBalanceFilter
              ? "AVERAGE_BEGINNING_AND_END_BALANCES"
              : "ENDING_BALANCE",

          reportingBasis:
            "POSTED_AND_APPROVED",

          accountingBasis:
            "ACCRUAL",

          source:
            "JournalEntryLine",
        },

        meta: {
          ...reportDateMeta(
            organizationId,
            dateFilter,
          ),

          asOfDate:
            asOfDate.toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "FINANCIAL RATIOS ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate financial ratios",
      });
    }
  };

/* =========================================================
   MONTHLY PERFORMANCE
========================================================= */

export const getMonthlyPerformance =
  async (
    req: AuthRequest,
    res: Response,
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

      const year =
        parseYear(req);

      const startDate =
        new Date(
          year,
          0,
          1,
          0,
          0,
          0,
          0,
        );

      const endDate =
        new Date(
          year,
          11,
          31,
          23,
          59,
          59,
          999,
        );

      type MonthlyRow = {
        month: Date;
        revenue: unknown;
        expenses: unknown;
      };

      const rows =
        await prisma.$queryRaw<
          MonthlyRow[]
        >(
          Prisma.sql`
            SELECT
              DATE_TRUNC(
                'month',
                je."transactionDate"
              ) AS month,

              COALESCE(
                SUM(
                  CASE
                    WHEN a."type" = 'INCOME'
                    THEN
                      jel."credit" -
                      jel."debit"
                    ELSE 0
                  END
                ),
                0
              ) AS revenue,

              COALESCE(
                SUM(
                  CASE
                    WHEN a."type" = 'EXPENSE'
                    THEN
                      jel."debit" -
                      jel."credit"
                    ELSE 0
                  END
                ),
                0
              ) AS expenses

            FROM
              "JournalEntryLine" jel

            INNER JOIN
              "JournalEntry" je
              ON
                je."id" =
                jel."journalEntryId"

            INNER JOIN
              "Account" a
              ON
                a."id" =
                jel."accountId"

            WHERE
              je."organizationId" =
              ${organizationId}

              AND
              a."organizationId" =
              ${organizationId}

              AND
              je."status"
              IN (
                'POSTED',
                'APPROVED'
              )

              AND
              je."transactionDate" >=
              ${startDate}

              AND
              je."transactionDate" <=
              ${endDate}

              AND
              a."type"
              IN (
                'INCOME',
                'EXPENSE'
              )

            GROUP BY
              DATE_TRUNC(
                'month',
                je."transactionDate"
              )

            ORDER BY
              month ASC
          `,
        );

      const byMonth =
        new Map<
          string,
          {
            revenue: number;
            expenses: number;
          }
        >();

      for (
        const row of rows
      ) {
        const monthDate =
          new Date(row.month);

        byMonth.set(
          monthDate
            .toISOString()
            .slice(0, 7),

          {
            revenue:
              round(
                getAmount(
                  row.revenue,
                ),
              ),

            expenses:
              round(
                getAmount(
                  row.expenses,
                ),
              ),
          },
        );
      }

      const months =
        Array.from(
          {
            length: 12,
          },

          (_, index) => {
            const monthDate =
              new Date(
                year,
                index,
                1,
              );

            const key =
              `${year}-${String(
                index + 1,
              ).padStart(
                2,
                "0",
              )}`;

            const values =
              byMonth.get(
                key,
              ) ?? {
                revenue: 0,
                expenses: 0,
              };

            const revenue =
              round(
                values.revenue,
              );

            const expenses =
              round(
                values.expenses,
              );

            return {
              month:
                new Intl.DateTimeFormat(
                  "en",
                  {
                    month: "short",
                  },
                ).format(
                  monthDate,
                ),

              monthNumber:
                index + 1,

              revenue,

              expenses,

              netProfit:
                round(
                  revenue -
                    expenses,
                ),
            };
          },
        );

      const totalRevenue =
        round(
          months.reduce(
            (sum, month) =>
              sum +
              month.revenue,
            0,
          ),
        );

      const totalExpenses =
        round(
          months.reduce(
            (sum, month) =>
              sum +
              month.expenses,
            0,
          ),
        );

      const netProfit =
        round(
          totalRevenue -
            totalExpenses,
        );

      const now =
        new Date();

      const currentMonthIndex =
        year ===
        now.getFullYear()
          ? now.getMonth()
          : 11;

      const previousMonthIndex =
        currentMonthIndex - 1;

      const currentMonth =
        months[
          currentMonthIndex
        ];

      const previousMonth =
        previousMonthIndex >=
        0
          ? months[
              previousMonthIndex
            ]
          : undefined;

      const profitGrowth =
        previousMonth
          ? round(
              percentageChange(
                currentMonth.netProfit,
                previousMonth.netProfit,
              ),
            )
          : 0;

      return res.status(200).json({
        success: true,

        data: months,

        totals: {
          revenue:
            totalRevenue,

          expenses:
            totalExpenses,

          netProfit,

          profitGrowthPercentage:
            profitGrowth,
        },

        controls: {
          months: 12,

          reportingBasis:
            "POSTED_AND_APPROVED",

          accountingBasis:
            "ACCRUAL",

          source:
            "JournalEntryLine",
        },

        meta: {
          organizationId,
          year,

          startDate:
            startDate.toISOString(),

          endDate:
            endDate.toISOString(),

          comparison:
            previousMonth
              ? {
                  currentMonth:
                    currentMonth.monthNumber,

                  previousMonth:
                    previousMonth.monthNumber,

                  metric:
                    "NET_PROFIT",
                }
              : null,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "MONTHLY PERFORMANCE ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate monthly performance report",
      });
    }
  };

/* =========================================================
   STATEMENT OF CHANGES IN EQUITY
========================================================= */

export const getChangesInEquity =
  async (
    req: AuthRequest,
    res: Response,
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

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          sendDateError(
            res,
            error,
          )
        ) {
          return;
        }

        throw error;
      }

      const reportEndDate =
        dateFilter.lte ??
        new Date();

      const openingEndDate =
        getOpeningEndDate(
          dateFilter.gte,
        );

      const equityAccounts =
        await prisma.account.findMany({
          where: {
            organizationId,
            type: "EQUITY",
          },

          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },

          orderBy: {
            code: "asc",
          },
        });

      const equityAccountIds =
        equityAccounts.map(
          (account) =>
            account.id,
        );

      if (
        equityAccountIds.length ===
        0
      ) {
        return res.status(200).json({
          success: true,

          data: [],

          totals: {
            openingEquity: 0,
            openingDirectEquity: 0,
            openingProfitLoss: 0,
            directEquityMovements: 0,
            revenue: 0,
            expenses: 0,
            profitForPeriod: 0,
            closingDirectEquity: 0,
            closingEquity: 0,
            cumulativeProfitLoss: 0,
            balanceSheetEquity: 0,
            reconciliationDifference: 0,
          },

          reconciliation: {
            status:
              "RECONCILED",

            difference: 0,

            tolerance:
              MONEY_TOLERANCE,

            message:
              "No equity accounts exist for this organization.",
          },

          controls: {
            equityAccounts: 0,
            periodJournalEntries: 0,
            openingJournalEntries: 0,

            reportingBasis:
              "POSTED_AND_APPROVED",

            accountingBasis:
              "ACCRUAL",

            source:
              "JournalEntryLine",
          },

          meta: {
            ...reportDateMeta(
              organizationId,
              dateFilter,
            ),
          },
        });
      }

      const periodFilter:
        DateFilter = {
          gte:
            dateFilter.gte ??
            new Date(0),

          lte:
            reportEndDate,
        };

      const [
        openingEquityAggregation,
        periodEquityAggregation,
        periodIncomeAggregation,
        openingIncomeAggregation,
        closingIncomeAggregation,
        periodJournalEntryCount,
        openingJournalEntryCount,
      ] = await Promise.all([
        openingEndDate
          ? prisma.journalEntryLine.groupBy(
              {
                by: [
                  "accountId",
                ],

                where: {
                  accountId: {
                    in:
                      equityAccountIds,
                  },

                  journalEntry: {
                    organizationId,

                    status: {
                      in: [
                        ...EFFECTIVE_STATUSES,
                      ],
                    },

                    transactionDate: {
                      lte:
                        openingEndDate,
                    },
                  },
                },

                _sum: {
                  debit: true,
                  credit: true,
                },
              },
            )
          : Promise.resolve(
              [],
            ),

        prisma.journalEntryLine.groupBy(
          {
            by: [
              "accountId",
            ],

            where: {
              accountId: {
                in:
                  equityAccountIds,
              },

              journalEntry: {
                organizationId,

                status: {
                  in: [
                    ...EFFECTIVE_STATUSES,
                  ],
                },

                transactionDate:
                  periodFilter,
              },
            },

            _sum: {
              debit: true,
              credit: true,
            },
          },
        ),

        getAccountTypeTotals(
          organizationId,
          [
            "INCOME",
            "EXPENSE",
          ],
          periodFilter,
        ),

        openingEndDate
          ? getAccountTypeTotals(
              organizationId,
              [
                "INCOME",
                "EXPENSE",
              ],
              {
                lte:
                  openingEndDate,
              },
            )
          : Promise.resolve(
              [],
            ),

        getAccountTypeTotals(
          organizationId,
          [
            "INCOME",
            "EXPENSE",
          ],
          {
            lte:
              reportEndDate,
          },
        ),

        prisma.journalEntry.count({
          where: {
            organizationId,

            status: {
              in: [
                ...EFFECTIVE_STATUSES,
              ],
            },

            transactionDate:
              periodFilter,
          },
        }),

        openingEndDate
          ? prisma.journalEntry.count(
              {
                where: {
                  organizationId,

                  status: {
                    in: [
                      ...EFFECTIVE_STATUSES,
                    ],
                  },

                  transactionDate: {
                    lte:
                      openingEndDate,
                  },
                },
              },
            )
          : Promise.resolve(
              0,
            ),
      ]);

      const openingEquityByAccount =
        getAccountBalanceMap(
          openingEquityAggregation,
          "CREDIT",
        );

      const periodEquityByAccount =
        getAccountBalanceMap(
          periodEquityAggregation,
          "CREDIT",
        );

      const accountTypeMap =
        new Map<
          string,
          string
        >();

      const incomeExpenseRows =
        [
          ...periodIncomeAggregation,
          ...openingIncomeAggregation,
          ...closingIncomeAggregation,
        ];

      const incomeExpenseIds =
        [
          ...new Set(
            incomeExpenseRows.map(
              (row) =>
                row.accountId,
            ),
          ),
        ];

      if (
        incomeExpenseIds.length
      ) {
        const incomeExpenseAccounts =
          await prisma.account.findMany(
            {
              where: {
                organizationId,

                id: {
                  in:
                    incomeExpenseIds,
                },

                type: {
                  in: [
                    "INCOME",
                    "EXPENSE",
                  ],
                },
              },

              select: {
                id: true,
                type: true,
              },
            },
          );

        for (
          const account of
            incomeExpenseAccounts
        ) {
          accountTypeMap.set(
            account.id,
            account.type,
          );
        }
      }

      const calculateProfitLoss =
        (
          rows: Array<{
            accountId: string;

            _sum: {
              debit: unknown;
              credit: unknown;
            };
          }>,
        ) => {
          let revenue = 0;
          let expenses = 0;

          for (
            const row of rows
          ) {
            const type =
              accountTypeMap.get(
                row.accountId,
              );

            const debit =
              getAmount(
                row._sum.debit,
              );

            const credit =
              getAmount(
                row._sum.credit,
              );

            if (
              type === "INCOME"
            ) {
              revenue +=
                credit - debit;
            }

            if (
              type === "EXPENSE"
            ) {
              expenses +=
                debit - credit;
            }
          }

          return {
            revenue:
              round(revenue),

            expenses:
              round(expenses),

            profit:
              round(
                revenue -
                  expenses,
              ),
          };
        };

      const periodProfitLoss =
        calculateProfitLoss(
          periodIncomeAggregation,
        );

      const openingProfitLoss =
        calculateProfitLoss(
          openingIncomeAggregation,
        );

      const closingProfitLoss =
        calculateProfitLoss(
          closingIncomeAggregation,
        );

      const accountRows =
        equityAccounts.map(
          (account) => {
            const openingBalance =
              round(
                openingEquityByAccount.get(
                  account.id,
                ) ?? 0,
              );

            const periodMovement =
              round(
                periodEquityByAccount.get(
                  account.id,
                ) ?? 0,
              );

            return {
              accountId:
                account.id,

              code:
                account.code,

              name:
                account.name,

              openingBalance,

              periodMovement,

              closingBalance:
                round(
                  openingBalance +
                    periodMovement,
                ),
            };
          },
        );

      const openingDirectEquity =
        round(
          accountRows.reduce(
            (sum, row) =>
              sum +
              row.openingBalance,

            0,
          ),
        );

      const directEquityMovements =
        round(
          accountRows.reduce(
            (sum, row) =>
              sum +
              row.periodMovement,

            0,
          ),
        );

      const closingDirectEquity =
        round(
          accountRows.reduce(
            (sum, row) =>
              sum +
              row.closingBalance,

            0,
          ),
        );

      const openingTotalEquity =
        round(
          openingDirectEquity +
            openingProfitLoss.profit,
        );

      const profitForPeriod =
        periodProfitLoss.profit;

      const closingTotalEquity =
        round(
          openingTotalEquity +
            directEquityMovements +
            profitForPeriod,
        );

      /*
       * Until the FOS has a formal fiscal-period
       * closing process, cumulative income and
       * expense balances represent the retained-
       * earnings-equivalent position.
       *
       * No artificial closing journal is created
       * by this reporting endpoint.
       */
      const balanceSheetEquity =
        round(
          closingDirectEquity +
            closingProfitLoss.profit,
        );

      const reconciliationDifference =
        round(
          balanceSheetEquity -
            closingTotalEquity,
        );

      const reconciled =
        Math.abs(
          reconciliationDifference,
        ) <=
        MONEY_TOLERANCE;

      return res.status(200).json({
        success: true,

        data: [
          {
            description:
              "Opening Equity",

            amount:
              openingTotalEquity,
          },

          {
            description:
              "Direct Equity Movements",

            amount:
              directEquityMovements,
          },

          {
            description:
              "Profit / Loss for Period",

            amount:
              profitForPeriod,
          },

          {
            description:
              "Closing Equity",

            amount:
              closingTotalEquity,
          },
        ],

        equityAccounts:
          accountRows,

        totals: {
          openingEquity:
            openingTotalEquity,

          openingDirectEquity:
            openingDirectEquity,

          openingProfitLoss:
            openingProfitLoss.profit,

          directEquityMovements:
            directEquityMovements,

          revenue:
            periodProfitLoss.revenue,

          expenses:
            periodProfitLoss.expenses,

          profitForPeriod:
            profitForPeriod,

          closingDirectEquity:
            closingDirectEquity,

          closingEquity:
            closingTotalEquity,

          cumulativeProfitLoss:
            closingProfitLoss.profit,

          balanceSheetEquity:
            balanceSheetEquity,

          reconciliationDifference:
            reconciliationDifference,
        },

        reconciliation: {
          status:
            reconciled
              ? "RECONCILED"
              : "NOT_RECONCILED",

          difference:
            reconciliationDifference,

          tolerance:
            MONEY_TOLERANCE,

          message:
            reconciled
              ? "Statement of Changes in Equity reconciles with the Balance Sheet equity position."
              : "Statement of Changes in Equity does not reconcile with the Balance Sheet equity position. Review posted journal entries and period closing activity.",
        },

        controls: {
          equityAccounts:
            equityAccounts.length,

          periodJournalEntries:
            periodJournalEntryCount,

          openingJournalEntries:
            openingJournalEntryCount,

          reportingBasis:
            "POSTED_AND_APPROVED",

          accountingBasis:
            "ACCRUAL",

          source:
            "JournalEntryLine",

          retainedEarningsModel:
            "CUMULATIVE_INCOME_AND_EXPENSE_UNTIL_FORMAL_FISCAL_CLOSE",
        },

        meta: {
          ...reportDateMeta(
            organizationId,
            dateFilter,
          ),
        },
      });
    } catch (error) {
      console.error(
        "CHANGES IN EQUITY ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate statement of changes in equity",
      });
    }
  };