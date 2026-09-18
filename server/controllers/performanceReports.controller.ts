import { Response } from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   TYPES
========================================================= */

type DateFilter = {
  gte?: Date;
  lte?: Date;
};

type AccountSummary = {
  code: string;
  name: string;
  amount: number;
};

type JournalLine = {
  accountId: string;
  debit: unknown;
  credit: unknown;
};

type JournalEntryWithLines = {
  transactionDate: Date;
  lines: JournalLine[];
};

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

/**
 * Parse and validate report dates.
 *
 * Invalid dates must never be silently ignored.
 */
const getDateFilter = (
  req: AuthRequest
): DateFilter => {
  const {
    startDate,
    endDate,
  } = req.query;

  const filter: DateFilter = {};

  if (startDate) {
    const date =
      new Date(String(startDate));

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      throw new Error(
        "INVALID_START_DATE"
      );
    }

    date.setHours(
      0,
      0,
      0,
      0
    );

    filter.gte = date;
  }

  if (endDate) {
    const date =
      new Date(String(endDate));

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      throw new Error(
        "INVALID_END_DATE"
      );
    }

    date.setHours(
      23,
      59,
      59,
      999
    );

    filter.lte = date;
  }

  if (
    filter.gte &&
    filter.lte &&
    filter.gte > filter.lte
  ) {
    throw new Error(
      "INVALID_DATE_RANGE"
    );
  }

  return filter;
};

const hasDateFilter = (
  filter: DateFilter
): boolean => {
  return Boolean(
    filter.gte ||
    filter.lte
  );
};

const percentageChange = (
  current: number,
  previous: number
): number => {
  if (previous === 0) {
    return current === 0
      ? 0
      : 100;
  }

  return (
    ((current - previous) /
      Math.abs(previous)) *
    100
  );
};

const round = (
  value: number
): number => {
  return (
    Math.round(
      value * 100
    ) / 100
  );
};

/**
 * JournalEntryLine is the authoritative accounting source.
 *
 * Only POSTED and APPROVED journal entries are included in
 * financial reporting. DRAFT and REVERSED entries are excluded.
 */
const getPostedJournalEntries =
  async (
    organizationId: string,
    dateFilter?: DateFilter
  ): Promise<
    JournalEntryWithLines[]
  > => {
    return prisma.journalEntry.findMany({
      where: {
        organizationId,

        status: {
          in: [
            "POSTED",
            "APPROVED",
          ],
        },

        ...(dateFilter &&
        hasDateFilter(
          dateFilter
        )
          ? {
              transactionDate:
                dateFilter,
            }
          : {}),
      },

      select: {
        transactionDate: true,

        lines: {
          select: {
            accountId: true,
            debit: true,
            credit: true,
          },
        },
      },

      orderBy: {
        transactionDate:
          "asc",
      },
    });
  };

const getAmount = (
  value: unknown
): number => {
  const amount =
    Number(value);

  return Number.isFinite(
    amount
  )
    ? amount
    : 0;
};

/**
 * Return a date filter containing everything before
 * the supplied start date.
 */
const getOpeningDateFilter = (
  startDate?: Date
): DateFilter | undefined => {
  if (!startDate) {
    return undefined;
  }

  return {
    lte: new Date(
      startDate.getTime() -
        1
    ),
  };
};

/* =========================================================
   REVENUE ANALYSIS
========================================================= */

export const getRevenueAnalysis =
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
            "Authentication required.",
        });
      }

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "INVALID_START_DATE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid startDate",
          });
        }

        if (
          error instanceof Error &&
          error.message ===
            "INVALID_END_DATE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid endDate",
          });
        }

        return res.status(400).json({
          success: false,
          message:
            "startDate cannot be after endDate",
        });
      }

      const accounts =
        await prisma.account.findMany({
          where: {
            organizationId,
            type: "INCOME",
          },

          orderBy: {
            code: "asc",
          },
        });

      const entries =
        await getPostedJournalEntries(
          organizationId,
          dateFilter
        );

      const revenue: AccountSummary[] =
        accounts.map(
          (account) => {
            let credits = 0;
            let debits = 0;

            for (const entry of entries) {
              for (const line of entry.lines) {
                if (
                  line.accountId !==
                  account.id
                ) {
                  continue;
                }

                credits += getAmount(
                  line.credit
                );

                debits += getAmount(
                  line.debit
                );
              }
            }

            return {
              code: account.code,
              name: account.name,
              amount: round(
                credits - debits
              ),
            };
          }
        );

      const filteredRevenue =
        revenue.filter(
          (item) =>
            item.amount !== 0
        );

      const totalRevenue =
        filteredRevenue.reduce(
          (sum, item) =>
            sum + item.amount,
          0
        );

      return res.status(200).json({
        success: true,

        data:
          filteredRevenue,

        totals: {
          revenue:
            round(totalRevenue),
        },

        meta: {
          organizationId,

          accounts:
            filteredRevenue.length,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "REVENUE ANALYSIS ERROR:",
        error
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

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "INVALID_START_DATE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid startDate",
          });
        }

        if (
          error instanceof Error &&
          error.message ===
            "INVALID_END_DATE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid endDate",
          });
        }

        return res.status(400).json({
          success: false,
          message:
            "startDate cannot be after endDate",
        });
      }

      const accounts =
        await prisma.account.findMany({
          where: {
            organizationId,
            type: "EXPENSE",
          },

          orderBy: {
            code: "asc",
          },
        });

      const entries =
        await getPostedJournalEntries(
          organizationId,
          dateFilter
        );

      const expenses: AccountSummary[] =
        accounts.map(
          (account) => {
            let debits = 0;
            let credits = 0;

            for (const entry of entries) {
              for (const line of entry.lines) {
                if (
                  line.accountId !==
                  account.id
                ) {
                  continue;
                }

                debits += getAmount(
                  line.debit
                );

                credits += getAmount(
                  line.credit
                );
              }
            }

            return {
              code: account.code,
              name: account.name,
              amount: round(
                debits - credits
              ),
            };
          }
        );

      const filteredExpenses =
        expenses.filter(
          (item) =>
            item.amount !== 0
        );

      const totalExpenses =
        filteredExpenses.reduce(
          (sum, item) =>
            sum + item.amount,
          0
        );

      return res.status(200).json({
        success: true,

        data:
          filteredExpenses,

        totals: {
          expenses:
            round(totalExpenses),
        },

        meta: {
          organizationId,

          accounts:
            filteredExpenses.length,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "EXPENSE ANALYSIS ERROR:",
        error
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

      const requestedYear =
        Number(req.query.year) ||
        new Date().getFullYear();

      const budgets =
        await prisma.budget.findMany({
          where: {
            organizationId,
            year: requestedYear,
          },

          orderBy: {
            department: "asc",
          },
        });

      const expenseAccounts =
        await prisma.account.findMany({
          where: {
            organizationId,
            type: "EXPENSE",
          },

          select: {
            id: true,
          },
        });

      const expenseIds =
        new Set(
          expenseAccounts.map(
            (account) =>
              account.id
          )
        );

      const startDate =
        new Date(
          requestedYear,
          0,
          1
        );

      const endDate =
        new Date(
          requestedYear,
          11,
          31,
          23,
          59,
          59,
          999
        );

      const entries =
        await getPostedJournalEntries(
          organizationId,
          {
            gte: startDate,
            lte: endDate,
          }
        );

      let actualExpenses = 0;

      for (const entry of entries) {
        for (const line of entry.lines) {
          if (
            !expenseIds.has(
              line.accountId
            )
          ) {
            continue;
          }

          actualExpenses +=
            getAmount(line.debit) -
            getAmount(line.credit);
        }
      }

      const totalBudget =
        budgets.reduce(
          (sum, budget) =>
            sum +
            getAmount(
              budget.amount
            ),
          0
        );

      const variance =
        totalBudget -
        actualExpenses;

      const utilization =
        totalBudget > 0
          ? (actualExpenses /
              totalBudget) *
            100
          : 0;

      const data =
        budgets.map(
          (budget) => ({
            department:
              budget.department,

            year:
              budget.year,

            budget:
              round(
                getAmount(
                  budget.amount
                )
              ),
          })
        );

      return res.status(200).json({
        success: true,

        data,

        totals: {
          budget:
            round(totalBudget),

          actual:
            round(actualExpenses),

          variance:
            round(variance),

          utilizationPercentage:
            round(utilization),
        },

        meta: {
          organizationId,
          year:
            requestedYear,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "BUDGET VS ACTUAL ERROR:",
        error
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

      const requestedYear =
        Number(req.query.year) ||
        new Date().getFullYear();

      const budgets =
        await prisma.budget.findMany({
          where: {
            organizationId,
            year: requestedYear,
          },

          orderBy: {
            department: "asc",
          },
        });

      const totalBudget =
        budgets.reduce(
          (sum, budget) =>
            sum +
            getAmount(
              budget.amount
            ),
          0
        );

      const expenseAccounts =
        await prisma.account.findMany({
          where: {
            organizationId,
            type: "EXPENSE",
          },

          select: {
            id: true,
          },
        });

      const expenseIds =
        new Set(
          expenseAccounts.map(
            (account) =>
              account.id
          )
        );

      const entries =
        await getPostedJournalEntries(
          organizationId,
          {
            gte: new Date(
              requestedYear,
              0,
              1
            ),

            lte: new Date(
              requestedYear,
              11,
              31,
              23,
              59,
              59,
              999
            ),
          }
        );

      let actual = 0;

      for (const entry of entries) {
        for (const line of entry.lines) {
          if (
            !expenseIds.has(
              line.accountId
            )
          ) {
            continue;
          }

          actual +=
            getAmount(line.debit) -
            getAmount(line.credit);
        }
      }

      const variance =
        totalBudget -
        actual;

      const variancePercentage =
        totalBudget > 0
          ? (variance /
              totalBudget) *
            100
          : 0;

      return res.status(200).json({
        success: true,

        data: [
          {
            year:
              requestedYear,

            budget:
              round(totalBudget),

            actual:
              round(actual),

            variance:
              round(variance),

            variancePercentage:
              round(
                variancePercentage
              ),

            status:
              variance >= 0
                ? "FAVORABLE"
                : "UNFAVORABLE",
          },
        ],

        totals: {
          budget:
            round(totalBudget),

          actual:
            round(actual),

          variance:
            round(variance),
        },

        meta: {
          organizationId,
          year:
            requestedYear,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "BUDGET VARIANCE ERROR:",
        error
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

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "INVALID_START_DATE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid startDate",
          });
        }

        if (
          error instanceof Error &&
          error.message ===
            "INVALID_END_DATE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid endDate",
          });
        }

        return res.status(400).json({
          success: false,
          message:
            "startDate cannot be after endDate",
        });
      }

      const accounts =
        await prisma.account.findMany({
          where: {
            organizationId,
          },
        });

      const entries =
        await getPostedJournalEntries(
          organizationId,
          dateFilter
        );

      const accountMap =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              account,
            ]
          )
        );

      let revenue = 0;
      let expenses = 0;
      let assets = 0;
      let liabilities = 0;
      let equity = 0;

      for (const entry of entries) {
        for (const line of entry.lines) {
          const amountDebit =
            getAmount(line.debit);

          const amountCredit =
            getAmount(line.credit);

          const account =
            accountMap.get(
              line.accountId
            );

          if (!account) {
            continue;
          }

          if (
            account.type ===
            "EXPENSE"
          ) {
            expenses +=
              amountDebit -
              amountCredit;
          }

          if (
            account.type ===
            "INCOME"
          ) {
            revenue +=
              amountCredit -
              amountDebit;
          }

          if (
            account.type ===
            "ASSET"
          ) {
            assets +=
              amountDebit -
              amountCredit;
          }

          if (
            account.type ===
            "LIABILITY"
          ) {
            liabilities +=
              amountCredit -
              amountDebit;
          }

          if (
            account.type ===
            "EQUITY"
          ) {
            equity +=
              amountCredit -
              amountDebit;
          }
        }
      }

      const netProfit =
        revenue -
        expenses;

      const netMargin =
        revenue !== 0
          ? (netProfit /
              revenue) *
            100
          : 0;

      const returnOnAssets =
        assets !== 0
          ? (netProfit /
              assets) *
            100
          : 0;

      const returnOnEquity =
        equity !== 0
          ? (netProfit /
              equity) *
            100
          : 0;

      return res.status(200).json({
        success: true,

        data: [
          {
            metric:
              "Revenue",
            value:
              round(revenue),
          },

          {
            metric:
              "Expenses",
            value:
              round(expenses),
          },

          {
            metric:
              "Net Profit",
            value:
              round(netProfit),
          },

          {
            metric:
              "Net Profit Margin",
            value:
              round(netMargin),
            unit: "%",
          },

          {
            metric:
              "Return on Assets",
            value:
              round(
                returnOnAssets
              ),
            unit: "%",
          },

          {
            metric:
              "Return on Equity",
            value:
              round(
                returnOnEquity
              ),
            unit: "%",
          },
        ],

        totals: {
          revenue:
            round(revenue),

          expenses:
            round(expenses),

          netProfit:
            round(netProfit),

          assets:
            round(assets),

          liabilities:
            round(liabilities),

          equity:
            round(equity),
        },

        meta: {
          organizationId,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "FINANCIAL KPI ERROR:",
        error
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

      const accounts =
        await prisma.account.findMany({
          where: {
            organizationId,
          },
        });

      const entries =
        await getPostedJournalEntries(
          organizationId
        );

      const accountMap =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              account,
            ]
          )
        );

      let assets = 0;
      let liabilities = 0;
      let equity = 0;
      let revenue = 0;
      let expenses = 0;

      for (const entry of entries) {
        for (const line of entry.lines) {
          const debitAmount =
            getAmount(line.debit);

          const creditAmount =
            getAmount(line.credit);

          const account =
            accountMap.get(
              line.accountId
            );

          if (!account) {
            continue;
          }

          if (
            account.type ===
            "ASSET"
          ) {
            assets +=
              debitAmount -
              creditAmount;
          }

          if (
            account.type ===
            "LIABILITY"
          ) {
            liabilities +=
              creditAmount -
              debitAmount;
          }

          if (
            account.type ===
            "EQUITY"
          ) {
            equity +=
              creditAmount -
              debitAmount;
          }

          if (
            account.type ===
            "INCOME"
          ) {
            revenue +=
              creditAmount -
              debitAmount;
          }

          if (
            account.type ===
            "EXPENSE"
          ) {
            expenses +=
              debitAmount -
              creditAmount;
          }
        }
      }

      const netProfit =
        revenue -
        expenses;

      const debtToEquity =
        equity !== 0
          ? liabilities /
            equity
          : 0;

      const debtRatio =
        assets !== 0
          ? liabilities /
            assets
          : 0;

      const returnOnAssets =
        assets !== 0
          ? (netProfit /
              assets) *
            100
          : 0;

      const returnOnEquity =
        equity !== 0
          ? (netProfit /
              equity) *
            100
          : 0;

      const profitMargin =
        revenue !== 0
          ? (netProfit /
              revenue) *
            100
          : 0;

      return res.status(200).json({
        success: true,

        data: [
          {
            ratio:
              "Debt to Equity",

            value:
              round(
                debtToEquity
              ),
          },

          {
            ratio:
              "Debt Ratio",

            value:
              round(
                debtRatio
              ),
          },

          {
            ratio:
              "Return on Assets",

            value:
              round(
                returnOnAssets
              ),

            unit: "%",
          },

          {
            ratio:
              "Return on Equity",

            value:
              round(
                returnOnEquity
              ),

            unit: "%",
          },

          {
            ratio:
              "Net Profit Margin",

            value:
              round(
                profitMargin
              ),

            unit: "%",
          },
        ],

        meta: {
          organizationId,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "FINANCIAL RATIOS ERROR:",
        error
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

      const year =
        Number(req.query.year) ||
        new Date().getFullYear();

      const accounts =
        await prisma.account.findMany({
          where: {
            organizationId,
          },
        });

      const accountMap =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              account,
            ]
          )
        );

      const entries =
        await getPostedJournalEntries(
          organizationId,
          {
            gte: new Date(
              year,
              0,
              1
            ),

            lte: new Date(
              year,
              11,
              31,
              23,
              59,
              59,
              999
            ),
          }
        );

      const months =
        Array.from(
          { length: 12 },
          (_, index) => ({
            month:
              new Intl.DateTimeFormat(
                "en",
                {
                  month: "short",
                }
              ).format(
                new Date(
                  year,
                  index,
                  1
                )
              ),

            monthNumber:
              index + 1,

            revenue: 0,
            expenses: 0,
            netProfit: 0,
          })
        );

      for (const entry of entries) {
        const monthIndex =
          entry.transactionDate.getMonth();

        if (
          monthIndex < 0 ||
          monthIndex > 11
        ) {
          continue;
        }

        for (const line of entry.lines) {
          const account =
            accountMap.get(
              line.accountId
            );

          if (!account) {
            continue;
          }

          const debit =
            getAmount(line.debit);

          const credit =
            getAmount(line.credit);

          if (
            account.type ===
            "INCOME"
          ) {
            months[
              monthIndex
            ].revenue +=
              credit - debit;
          }

          if (
            account.type ===
            "EXPENSE"
          ) {
            months[
              monthIndex
            ].expenses +=
              debit - credit;
          }
        }
      }

      for (const month of months) {
        month.netProfit =
          round(
            month.revenue -
              month.expenses
          );

        month.revenue =
          round(
            month.revenue
          );

        month.expenses =
          round(
            month.expenses
          );
      }

      const totalRevenue =
        months.reduce(
          (sum, month) =>
            sum + month.revenue,
          0
        );

      const totalExpenses =
        months.reduce(
          (sum, month) =>
            sum + month.expenses,
          0
        );

      const netProfit =
        totalRevenue -
        totalExpenses;

      const now =
        new Date();

      /*
       * If the requested year is the current
       * year, compare the current month with
       * the previous month.
       *
       * For another year, compare December
       * with November.
       */
      const currentMonthIndex =
        year === now.getFullYear()
          ? now.getMonth()
          : 11;

      const previousMonthIndex =
        currentMonthIndex - 1;

      const currentMonth =
        months[
          currentMonthIndex
        ];

      const previousMonth =
        previousMonthIndex >= 0
          ? months[
              previousMonthIndex
            ]
          : undefined;

      const profitGrowth =
        previousMonth
          ? percentageChange(
              currentMonth.netProfit,
              previousMonth.netProfit
            )
          : 0;

      return res.status(200).json({
        success: true,

        data: months,

        totals: {
          revenue:
            round(
              totalRevenue
            ),

          expenses:
            round(
              totalExpenses
            ),

          netProfit:
            round(
              netProfit
            ),

          profitGrowthPercentage:
            round(
              profitGrowth
            ),
        },

        meta: {
          organizationId,
          year,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "MONTHLY PERFORMANCE ERROR:",
        error
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

      let dateFilter: DateFilter;

      try {
        dateFilter =
          getDateFilter(req);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "INVALID_START_DATE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid startDate",
          });
        }

        if (
          error instanceof Error &&
          error.message ===
            "INVALID_END_DATE"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid endDate",
          });
        }

        return res.status(400).json({
          success: false,
          message:
            "startDate cannot be after endDate",
        });
      }

      const accounts =
        await prisma.account.findMany({
          where: {
            organizationId,

            type: {
              in: [
                "EQUITY",
                "INCOME",
                "EXPENSE",
              ],
            },
          },
        });

      const accountMap =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              account,
            ]
          )
        );

      /*
       * Period entries are the entries inside the
       * requested reporting period.
       */
      const periodEntries =
        await getPostedJournalEntries(
          organizationId,
          dateFilter
        );

      /*
       * Opening entries are everything posted before
       * the start of the requested period.
       *
       * When no startDate is supplied there is no
       * separate opening period; the requested report
       * is treated as cumulative from available history.
       */
      const openingDateFilter =
        getOpeningDateFilter(
          dateFilter.gte
        );

      const openingEntries =
        openingDateFilter
          ? await getPostedJournalEntries(
              organizationId,
              openingDateFilter
            )
          : [];

      let openingEquity = 0;

      /*
       * Direct equity movements brought forward
       * from before the reporting period.
       */
      for (const entry of openingEntries) {
        for (const line of entry.lines) {
          const account =
            accountMap.get(
              line.accountId
            );

          if (
            !account ||
            account.type !==
              "EQUITY"
          ) {
            continue;
          }

          const debit =
            getAmount(line.debit);

          const credit =
            getAmount(line.credit);

          openingEquity +=
            credit - debit;
        }
      }

      /*
       * If there is no start date, periodEntries already
       * represent all available posted history through
       * the requested end date. In that case opening
       * equity starts at zero.
       */
      let equityMovement = 0;
      let revenue = 0;
      let expenses = 0;

      for (const entry of periodEntries) {
        for (const line of entry.lines) {
          const account =
            accountMap.get(
              line.accountId
            );

          if (!account) {
            continue;
          }

          const debit =
            getAmount(line.debit);

          const credit =
            getAmount(line.credit);

          if (
            account.type ===
            "EQUITY"
          ) {
            equityMovement +=
              credit - debit;
          }

          if (
            account.type ===
            "INCOME"
          ) {
            revenue +=
              credit - debit;
          }

          if (
            account.type ===
            "EXPENSE"
          ) {
            expenses +=
              debit - credit;
          }
        }
      }

      const profitForPeriod =
        revenue -
        expenses;

      /*
       * Closing equity is the opening equity plus:
       *
       *   Direct equity movements
       *   + profit/loss for the period
       */
      const closingEquity =
        openingEquity +
        equityMovement +
        profitForPeriod;

      return res.status(200).json({
        success: true,

        data: [
          {
            description:
              "Opening Equity",

            amount:
              round(
                openingEquity
              ),
          },

          {
            description:
              "Direct Equity Movements",

            amount:
              round(
                equityMovement
              ),
          },

          {
            description:
              "Profit / Loss for Period",

            amount:
              round(
                profitForPeriod
              ),
          },

          {
            description:
              "Closing Equity",

            amount:
              round(
                closingEquity
              ),
          },
        ],

        totals: {
          openingEquity:
            round(
              openingEquity
            ),

          equityMovement:
            round(
              equityMovement
            ),

          profitForPeriod:
            round(
              profitForPeriod
            ),

          closingEquity:
            round(
              closingEquity
            ),
        },

        meta: {
          organizationId,

          startDate:
            dateFilter.gte
              ?.toISOString() ??
            null,

          endDate:
            dateFilter.lte
              ?.toISOString() ??
            null,

          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "CHANGES IN EQUITY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate statement of changes in equity",
      });
    }
  };