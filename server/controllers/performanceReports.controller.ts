import type { Request, Response } from "express";
import prisma from "../config/prisma";

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

/* =========================================================
   HELPERS
========================================================= */

const getDateFilter = (
  req: Request
): DateFilter => {
  const { startDate, endDate } = req.query;

  const filter: DateFilter = {};

  if (startDate) {
    const date = new Date(String(startDate));

    if (!Number.isNaN(date.getTime())) {
      date.setHours(0, 0, 0, 0);
      filter.gte = date;
    }
  }

  if (endDate) {
    const date = new Date(String(endDate));

    if (!Number.isNaN(date.getTime())) {
      date.setHours(23, 59, 59, 999);
      filter.lte = date;
    }
  }

  return filter;
};

const hasDateFilter = (
  filter: DateFilter
): boolean => {
  return Boolean(filter.gte || filter.lte);
};

const percentageChange = (
  current: number,
  previous: number
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

const round = (value: number): number => {
  return Math.round(value * 100) / 100;
};

/* =========================================================
   REVENUE ANALYSIS
========================================================= */

export const getRevenueAnalysis = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const accounts = await prisma.account.findMany({
      where: {
        type: "REVENUE",
      },
      orderBy: {
        code: "asc",
      },
    });

    const entries = await prisma.journalEntry.findMany({
      where: {
        status: "POSTED",

        ...(hasDateFilter(dateFilter)
          ? {
              transactionDate: dateFilter,
            }
          : {}),
      },

      select: {
        debitAccountId: true,
        creditAccountId: true,
        amount: true,
      },
    });

    const revenue: AccountSummary[] =
      accounts.map((account) => {
        let credits = 0;
        let debits = 0;

        for (const entry of entries) {
          if (
            entry.creditAccountId ===
            account.id
          ) {
            credits += entry.amount;
          }

          if (
            entry.debitAccountId ===
            account.id
          ) {
            debits += entry.amount;
          }
        }

        return {
          code: account.code,
          name: account.name,
          amount: round(
            credits - debits
          ),
        };
      });

    const filteredRevenue =
      revenue.filter(
        (item) => item.amount !== 0
      );

    const totalRevenue =
      filteredRevenue.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    return res.status(200).json({
      success: true,

      data: filteredRevenue,

      totals: {
        revenue: round(totalRevenue),
      },

      meta: {
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

export const getExpenseAnalysis = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const accounts =
      await prisma.account.findMany({
        where: {
          type: "EXPENSE",
        },
        orderBy: {
          code: "asc",
        },
      });

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate:
                  dateFilter,
              }
            : {}),
        },

        select: {
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },
      });

    const expenses: AccountSummary[] =
      accounts.map((account) => {
        let debits = 0;
        let credits = 0;

        for (const entry of entries) {
          if (
            entry.debitAccountId ===
            account.id
          ) {
            debits += entry.amount;
          }

          if (
            entry.creditAccountId ===
            account.id
          ) {
            credits += entry.amount;
          }
        }

        return {
          code: account.code,
          name: account.name,
          amount: round(
            debits - credits
          ),
        };
      });

    const filteredExpenses =
      expenses.filter(
        (item) => item.amount !== 0
      );

    const totalExpenses =
      filteredExpenses.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    return res.status(200).json({
      success: true,

      data: filteredExpenses,

      totals: {
        expenses: round(totalExpenses),
      },

      meta: {
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

export const getBudgetVsActual = async (
  req: Request,
  res: Response
) => {
  try {
    const requestedYear =
      Number(req.query.year) ||
      new Date().getFullYear();

    const budgets =
      await prisma.budget.findMany({
        where: {
          year: requestedYear,
        },
        orderBy: {
          department: "asc",
        },
      });

    const expenseAccounts =
      await prisma.account.findMany({
        where: {
          type: "EXPENSE",
        },
        select: {
          id: true,
        },
      });

    const expenseIds =
      expenseAccounts.map(
        (account) => account.id
      );

    const startDate = new Date(
      requestedYear,
      0,
      1
    );

    const endDate = new Date(
      requestedYear,
      11,
      31,
      23,
      59,
      59,
      999
    );

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          transactionDate: {
            gte: startDate,
            lte: endDate,
          },
        },

        select: {
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },
      });

    let actualExpenses = 0;

    for (const entry of entries) {
      if (
        expenseIds.includes(
          entry.debitAccountId
        )
      ) {
        actualExpenses += entry.amount;
      }

      if (
        expenseIds.includes(
          entry.creditAccountId
        )
      ) {
        actualExpenses -= entry.amount;
      }
    }

    const totalBudget =
      budgets.reduce(
        (sum, budget) =>
          sum + budget.amount,
        0
      );

    const variance =
      totalBudget - actualExpenses;

    const utilization =
      totalBudget > 0
        ? (actualExpenses /
            totalBudget) *
          100
        : 0;

    const data = budgets.map(
      (budget) => ({
        department:
          budget.department,
        year: budget.year,
        budget: round(
          budget.amount
        ),
      })
    );

    return res.status(200).json({
      success: true,

      data,

      totals: {
        budget: round(totalBudget),
        actual: round(
          actualExpenses
        ),
        variance: round(variance),
        utilizationPercentage:
          round(utilization),
      },

      meta: {
        year: requestedYear,
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

export const getBudgetVariance = async (
  req: Request,
  res: Response
) => {
  try {
    const requestedYear =
      Number(req.query.year) ||
      new Date().getFullYear();

    const budgets =
      await prisma.budget.findMany({
        where: {
          year: requestedYear,
        },
        orderBy: {
          department: "asc",
        },
      });

    const totalBudget =
      budgets.reduce(
        (sum, budget) =>
          sum + budget.amount,
        0
      );

    const expenseAccounts =
      await prisma.account.findMany({
        where: {
          type: "EXPENSE",
        },
        select: {
          id: true,
        },
      });

    const expenseIds =
      expenseAccounts.map(
        (account) => account.id
      );

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          transactionDate: {
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
          },
        },

        select: {
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },
      });

    let actual = 0;

    for (const entry of entries) {
      if (
        expenseIds.includes(
          entry.debitAccountId
        )
      ) {
        actual += entry.amount;
      }

      if (
        expenseIds.includes(
          entry.creditAccountId
        )
      ) {
        actual -= entry.amount;
      }
    }

    const variance =
      totalBudget - actual;

    const variancePercentage =
      totalBudget > 0
        ? (variance / totalBudget) *
          100
        : 0;

    return res.status(200).json({
      success: true,

      data: [
        {
          year: requestedYear,
          budget: round(totalBudget),
          actual: round(actual),
          variance: round(variance),
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
        budget: round(totalBudget),
        actual: round(actual),
        variance: round(variance),
      },

      meta: {
        year: requestedYear,
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

export const getFinancialKpis = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const accounts =
      await prisma.account.findMany();

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate:
                  dateFilter,
              }
            : {}),
        },

        select: {
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },
      });

    const accountMap = new Map(
      accounts.map((account) => [
        account.id,
        account,
      ])
    );

    let revenue = 0;
    let expenses = 0;
    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    for (const entry of entries) {
      const debitAccount =
        accountMap.get(
          entry.debitAccountId
        );

      const creditAccount =
        accountMap.get(
          entry.creditAccountId
        );

      if (
        debitAccount?.type ===
        "EXPENSE"
      ) {
        expenses += entry.amount;
      }

      if (
        creditAccount?.type ===
        "EXPENSE"
      ) {
        expenses -= entry.amount;
      }

      if (
        creditAccount?.type ===
        "REVENUE"
      ) {
        revenue += entry.amount;
      }

      if (
        debitAccount?.type ===
        "REVENUE"
      ) {
        revenue -= entry.amount;
      }

      if (
        debitAccount?.type ===
        "ASSET"
      ) {
        assets += entry.amount;
      }

      if (
        creditAccount?.type ===
        "ASSET"
      ) {
        assets -= entry.amount;
      }

      if (
        creditAccount?.type ===
        "LIABILITY"
      ) {
        liabilities +=
          entry.amount;
      }

      if (
        debitAccount?.type ===
        "LIABILITY"
      ) {
        liabilities -=
          entry.amount;
      }

      if (
        creditAccount?.type ===
        "EQUITY"
      ) {
        equity += entry.amount;
      }

      if (
        debitAccount?.type ===
        "EQUITY"
      ) {
        equity -= entry.amount;
      }
    }

    const netProfit =
      revenue - expenses;

    const netMargin =
      revenue !== 0
        ? (netProfit / revenue) *
          100
        : 0;

    const returnOnAssets =
      assets !== 0
        ? (netProfit / assets) *
          100
        : 0;

    const returnOnEquity =
      equity !== 0
        ? (netProfit / equity) *
          100
        : 0;

    return res.status(200).json({
      success: true,

      data: [
        {
          metric: "Revenue",
          value: round(revenue),
        },
        {
          metric: "Expenses",
          value: round(expenses),
        },
        {
          metric: "Net Profit",
          value: round(netProfit),
        },
        {
          metric: "Net Profit Margin",
          value: round(netMargin),
          unit: "%",
        },
        {
          metric: "Return on Assets",
          value:
            round(returnOnAssets),
          unit: "%",
        },
        {
          metric: "Return on Equity",
          value:
            round(returnOnEquity),
          unit: "%",
        },
      ],

      totals: {
        revenue: round(revenue),
        expenses: round(expenses),
        netProfit:
          round(netProfit),
        assets: round(assets),
        liabilities:
          round(liabilities),
        equity: round(equity),
      },

      meta: {
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

export const getFinancialRatios = async (
  _req: Request,
  res: Response
) => {
  try {
    const accounts =
      await prisma.account.findMany();

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",
        },

        select: {
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },
      });

    const accountMap = new Map(
      accounts.map((account) => [
        account.id,
        account,
      ])
    );

    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let revenue = 0;
    let expenses = 0;

    for (const entry of entries) {
      const debit =
        accountMap.get(
          entry.debitAccountId
        );

      const credit =
        accountMap.get(
          entry.creditAccountId
        );

      if (debit?.type === "ASSET") {
        assets += entry.amount;
      }

      if (credit?.type === "ASSET") {
        assets -= entry.amount;
      }

      if (
        credit?.type ===
        "LIABILITY"
      ) {
        liabilities +=
          entry.amount;
      }

      if (
        debit?.type ===
        "LIABILITY"
      ) {
        liabilities -=
          entry.amount;
      }

      if (
        credit?.type === "EQUITY"
      ) {
        equity += entry.amount;
      }

      if (
        debit?.type === "EQUITY"
      ) {
        equity -= entry.amount;
      }

      if (
        credit?.type ===
        "REVENUE"
      ) {
        revenue += entry.amount;
      }

      if (
        debit?.type ===
        "REVENUE"
      ) {
        revenue -= entry.amount;
      }

      if (
        debit?.type ===
        "EXPENSE"
      ) {
        expenses += entry.amount;
      }

      if (
        credit?.type ===
        "EXPENSE"
      ) {
        expenses -= entry.amount;
      }
    }

    const netProfit =
      revenue - expenses;

    const debtToEquity =
      equity !== 0
        ? liabilities / equity
        : 0;

    const debtRatio =
      assets !== 0
        ? liabilities / assets
        : 0;

    const returnOnAssets =
      assets !== 0
        ? (netProfit / assets) *
          100
        : 0;

    const returnOnEquity =
      equity !== 0
        ? (netProfit / equity) *
          100
        : 0;

    const profitMargin =
      revenue !== 0
        ? (netProfit / revenue) *
          100
        : 0;

    return res.status(200).json({
      success: true,

      data: [
        {
          ratio:
            "Debt to Equity",
          value:
            round(debtToEquity),
        },
        {
          ratio: "Debt Ratio",
          value:
            round(debtRatio),
        },
        {
          ratio:
            "Return on Assets",
          value:
            round(returnOnAssets),
          unit: "%",
        },
        {
          ratio:
            "Return on Equity",
          value:
            round(returnOnEquity),
          unit: "%",
        },
        {
          ratio:
            "Net Profit Margin",
          value:
            round(profitMargin),
          unit: "%",
        },
      ],

      meta: {
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

export const getMonthlyPerformance = async (
  req: Request,
  res: Response
) => {
  try {
    const year =
      Number(req.query.year) ||
      new Date().getFullYear();

    const accounts =
      await prisma.account.findMany();

    const accountMap = new Map(
      accounts.map((account) => [
        account.id,
        account,
      ])
    );

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          transactionDate: {
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
          },
        },

        select: {
          transactionDate: true,
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },
      });

    const months = Array.from(
      { length: 12 },
      (_, index) => ({
        month: new Intl.DateTimeFormat(
          "en",
          {
            month: "short",
          }
        ).format(
          new Date(year, index, 1)
        ),

        monthNumber: index + 1,
        revenue: 0,
        expenses: 0,
        netProfit: 0,
      })
    );

    for (const entry of entries) {
      const monthIndex =
        entry.transactionDate.getMonth();

      const debit =
        accountMap.get(
          entry.debitAccountId
        );

      const credit =
        accountMap.get(
          entry.creditAccountId
        );

      if (
        credit?.type ===
        "REVENUE"
      ) {
        months[monthIndex].revenue +=
          entry.amount;
      }

      if (
        debit?.type ===
        "REVENUE"
      ) {
        months[monthIndex].revenue -=
          entry.amount;
      }

      if (
        debit?.type ===
        "EXPENSE"
      ) {
        months[monthIndex].expenses +=
          entry.amount;
      }

      if (
        credit?.type ===
        "EXPENSE"
      ) {
        months[monthIndex].expenses -=
          entry.amount;
      }
    }

    for (const month of months) {
      month.netProfit =
        round(
          month.revenue -
            month.expenses
        );

      month.revenue =
        round(month.revenue);

      month.expenses =
        round(month.expenses);
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

    const previousMonth =
      months.length >= 2
        ? months[
            new Date().getMonth() - 1
          ]
        : undefined;

    const currentMonth =
      months[
        Math.min(
          new Date().getMonth(),
          11
        )
      ];

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
          round(totalRevenue),
        expenses:
          round(totalExpenses),
        netProfit:
          round(netProfit),
        profitGrowthPercentage:
          round(profitGrowth),
      },

      meta: {
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

export const getChangesInEquity = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const accounts =
      await prisma.account.findMany({
        where: {
          type: {
            in: [
              "EQUITY",
              "REVENUE",
              "EXPENSE",
            ],
          },
        },
      });

    const accountMap = new Map(
      accounts.map((account) => [
        account.id,
        account,
      ])
    );

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate:
                  dateFilter,
              }
            : {}),
        },

        select: {
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },
      });

    let equityMovement = 0;
    let revenue = 0;
    let expenses = 0;

    for (const entry of entries) {
      const debit =
        accountMap.get(
          entry.debitAccountId
        );

      const credit =
        accountMap.get(
          entry.creditAccountId
        );

      if (
        credit?.type === "EQUITY"
      ) {
        equityMovement +=
          entry.amount;
      }

      if (
        debit?.type === "EQUITY"
      ) {
        equityMovement -=
          entry.amount;
      }

      if (
        credit?.type ===
        "REVENUE"
      ) {
        revenue += entry.amount;
      }

      if (
        debit?.type ===
        "REVENUE"
      ) {
        revenue -= entry.amount;
      }

      if (
        debit?.type ===
        "EXPENSE"
      ) {
        expenses += entry.amount;
      }

      if (
        credit?.type ===
        "EXPENSE"
      ) {
        expenses -= entry.amount;
      }
    }

    const profitForPeriod =
      revenue - expenses;

    const closingEquity =
      equityMovement +
      profitForPeriod;

    return res.status(200).json({
      success: true,

      data: [
        {
          description:
            "Direct Equity Movements",
          amount:
            round(equityMovement),
        },
        {
          description:
            "Profit / Loss for Period",
          amount:
            round(profitForPeriod),
        },
        {
          description:
            "Closing Equity",
          amount:
            round(closingEquity),
        },
      ],

      totals: {
        equityMovement:
          round(equityMovement),

        profitForPeriod:
          round(profitForPeriod),

        closingEquity:
          round(closingEquity),
      },

      meta: {
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