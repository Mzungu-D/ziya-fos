import { Request, Response } from "express";
import prisma from "../config/prisma";

type CashFlowCategory =
  | "OPERATING"
  | "INVESTING"
  | "FINANCING";

type CashFlowDirection =
  | "INFLOW"
  | "OUTFLOW";

type CashFlowItem = {
  id: string;
  reference: string;
  description: string;
  transactionDate: Date;
  category: CashFlowCategory;
  direction: CashFlowDirection;
  amount: number;
  cashAccount: {
    id: string;
    code: string;
    name: string;
  };
  counterpartAccount: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
};

const normalize = (value: string) =>
  value.trim().toLowerCase();

const containsAny = (
  value: string,
  keywords: string[]
) => {
  const normalized = normalize(value);

  return keywords.some((keyword) =>
    normalized.includes(keyword)
  );
};

const classifyCashFlow = (
  account: {
    code: string;
    name: string;
    type: string;
  }
): CashFlowCategory => {
  const accountName = normalize(account.name);
  const accountCode = normalize(account.code);
  const accountType = normalize(account.type);

  /*
   * INVESTING ACTIVITIES
   *
   * Acquisition/disposal of long-term assets
   * and investments.
   */
  if (
    containsAny(accountName, [
      "property",
      "plant",
      "equipment",
      "ppe",
      "fixed asset",
      "motor vehicle",
      "vehicle",
      "computer equipment",
      "office equipment",
      "furniture",
      "land",
      "building",
      "intangible",
      "software asset",
      "investment",
      "portfolio investment",
      "investment property",
    ])
  ) {
    return "INVESTING";
  }

  /*
   * FINANCING ACTIVITIES
   *
   * Changes in borrowings and owners' capital.
   */
  if (
    containsAny(accountName, [
      "share capital",
      "ordinary shares",
      "preference shares",
      "additional paid",
      "capital contribution",
      "owner contribution",
      "shareholder contribution",
      "borrowings",
      "borrowing",
      "bank loan",
      "term loan",
      "long term loan",
      "long-term loan",
      "short term loan",
      "short-term loan",
      "finance lease",
      "lease liability",
      "debenture",
      "bond payable",
      "shareholder loan",
    ])
  ) {
    return "FINANCING";
  }

  /*
   * Equity movements generally represent financing,
   * unless they are retained earnings/current-period
   * profit movements that do not themselves represent
   * a cash transaction.
   */
  if (
    accountType === "equity" &&
    !containsAny(accountName, [
      "retained earnings",
      "current year earnings",
      "current year profit",
      "accumulated profit",
      "accumulated loss",
    ])
  ) {
    return "FINANCING";
  }

  /*
   * Optional code conventions.
   *
   * These are secondary safeguards only.
   */
  if (
    accountCode.startsWith("15") ||
    accountCode.startsWith("16") ||
    accountCode.startsWith("17")
  ) {
    return "INVESTING";
  }

  /*
   * Revenue, expenses, receivables, payables,
   * inventory and ordinary working-capital movements
   * are operating activities by default.
   */
  return "OPERATING";
};

const getDateFilter = (
  startDate?: unknown,
  endDate?: unknown
) => {
  const dateFilter: {
    gte?: Date;
    lte?: Date;
  } = {};

  if (startDate) {
    const parsedStartDate = new Date(
      String(startDate)
    );

    if (
      Number.isNaN(parsedStartDate.getTime())
    ) {
      throw new Error("INVALID_START_DATE");
    }

    parsedStartDate.setHours(0, 0, 0, 0);

    dateFilter.gte = parsedStartDate;
  }

  if (endDate) {
    const parsedEndDate = new Date(
      String(endDate)
    );

    if (
      Number.isNaN(parsedEndDate.getTime())
    ) {
      throw new Error("INVALID_END_DATE");
    }

    parsedEndDate.setHours(
      23,
      59,
      59,
      999
    );

    dateFilter.lte = parsedEndDate;
  }

  if (
    dateFilter.gte &&
    dateFilter.lte &&
    dateFilter.gte > dateFilter.lte
  ) {
    throw new Error("INVALID_DATE_RANGE");
  }

  return dateFilter;
};

export const getCashFlow = async (
  req: Request,
  res: Response
) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter: {
      gte?: Date;
      lte?: Date;
    };

    try {
      dateFilter = getDateFilter(
        startDate,
        endDate
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "INVALID_START_DATE"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate",
        });
      }

      if (
        error instanceof Error &&
        error.message ===
          "INVALID_END_DATE"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid endDate",
        });
      }

      return res.status(400).json({
        success: false,
        message:
          "startDate cannot be after endDate",
      });
    }

    /*
     * Load all accounts because we need both
     * cash/bank accounts and counterpart accounts.
     */
    const accounts =
      await prisma.account.findMany({
        orderBy: {
          code: "asc",
        },
      });

    const accountMap = new Map(
      accounts.map((account) => [
        account.id,
        account,
      ])
    );

    /*
     * Identify cash and cash-equivalent accounts.
     *
     * We avoid relying exclusively on account codes.
     */
    const cashAccounts = accounts.filter(
      (account) => {
        if (account.type !== "ASSET") {
          return false;
        }

        return containsAny(account.name, [
          "cash",
          "bank",
          "mpesa",
          "m-pesa",
          "mobile money",
          "petty cash",
          "cash equivalent",
        ]);
      }
    );

    const cashAccountIds = new Set(
      cashAccounts.map(
        (account) => account.id
      )
    );

    /*
     * If no cash account exists, return a valid
     * zero-value cash flow statement.
     */
    if (cashAccountIds.size === 0) {
      return res.status(200).json({
        success: true,

        operatingActivities: {
          items: [],
          inflows: 0,
          outflows: 0,
          netCashFlow: 0,
        },

        investingActivities: {
          items: [],
          inflows: 0,
          outflows: 0,
          netCashFlow: 0,
        },

        financingActivities: {
          items: [],
          inflows: 0,
          outflows: 0,
          netCashFlow: 0,
        },

        totals: {
          operating: 0,
          investing: 0,
          financing: 0,
          netIncreaseDecrease: 0,
          openingCashBalance: 0,
          closingCashBalance: 0,
        },

        meta: {
          startDate:
            dateFilter.gte?.toISOString() ??
            null,

          endDate:
            dateFilter.lte?.toISOString() ??
            null,

          postedEntries: 0,
          cashAccounts: 0,
          currency: "KES",
          generatedAt:
            new Date().toISOString(),
        },
      });
    }

    /*
     * Get ALL posted entries up to the end date.
     *
     * We need transactions before the selected
     * period to calculate opening cash balance.
     */
    const allPostedEntries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          ...(dateFilter.lte
            ? {
                transactionDate: {
                  lte: dateFilter.lte,
                },
              }
            : {}),
        },

        select: {
          id: true,
          reference: true,
          description: true,
          transactionDate: true,
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },

        orderBy: {
          transactionDate: "asc",
        },
      });

    /*
     * Opening balance:
     *
     * Cash movements strictly before startDate.
     */
    let openingCashBalance = 0;

    if (dateFilter.gte) {
      for (const entry of allPostedEntries) {
        if (
          entry.transactionDate >=
          dateFilter.gte
        ) {
          continue;
        }

        if (
          cashAccountIds.has(
            entry.debitAccountId
          )
        ) {
          openingCashBalance +=
            entry.amount;
        }

        if (
          cashAccountIds.has(
            entry.creditAccountId
          )
        ) {
          openingCashBalance -=
            entry.amount;
        }
      }
    }

    /*
     * Select transactions belonging to the
     * requested reporting period.
     */
    const periodEntries =
      allPostedEntries.filter((entry) => {
        if (
          dateFilter.gte &&
          entry.transactionDate <
            dateFilter.gte
        ) {
          return false;
        }

        if (
          dateFilter.lte &&
          entry.transactionDate >
            dateFilter.lte
        ) {
          return false;
        }

        return true;
      });

    const cashFlowItems: CashFlowItem[] =
      [];

    for (const entry of periodEntries) {
      const debitIsCash =
        cashAccountIds.has(
          entry.debitAccountId
        );

      const creditIsCash =
        cashAccountIds.has(
          entry.creditAccountId
        );

      /*
       * Ignore transactions with no cash side.
       */
      if (!debitIsCash && !creditIsCash) {
        continue;
      }

      /*
       * Cash-to-cash transfers do not change the
       * organization's total cash position and
       * therefore are excluded from the cash
       * flow statement.
       */
      if (debitIsCash && creditIsCash) {
        continue;
      }

      const direction: CashFlowDirection =
        debitIsCash
          ? "INFLOW"
          : "OUTFLOW";

      const cashAccountId = debitIsCash
        ? entry.debitAccountId
        : entry.creditAccountId;

      const counterpartAccountId =
        debitIsCash
          ? entry.creditAccountId
          : entry.debitAccountId;

      const cashAccount =
        accountMap.get(cashAccountId);

      const counterpartAccount =
        accountMap.get(
          counterpartAccountId
        );

      if (
        !cashAccount ||
        !counterpartAccount
      ) {
        continue;
      }

      const category =
        classifyCashFlow({
          code: counterpartAccount.code,
          name: counterpartAccount.name,
          type: counterpartAccount.type,
        });

      cashFlowItems.push({
        id: entry.id,
        reference: entry.reference,
        description: entry.description,
        transactionDate:
          entry.transactionDate,
        category,
        direction,
        amount: entry.amount,

        cashAccount: {
          id: cashAccount.id,
          code: cashAccount.code,
          name: cashAccount.name,
        },

        counterpartAccount: {
          id: counterpartAccount.id,
          code: counterpartAccount.code,
          name: counterpartAccount.name,
          type: counterpartAccount.type,
        },
      });
    }

    const buildSection = (
      category: CashFlowCategory
    ) => {
      const items =
        cashFlowItems.filter(
          (item) =>
            item.category === category
        );

      const inflows = items
        .filter(
          (item) =>
            item.direction === "INFLOW"
        )
        .reduce(
          (total, item) =>
            total + item.amount,
          0
        );

      const outflows = items
        .filter(
          (item) =>
            item.direction === "OUTFLOW"
        )
        .reduce(
          (total, item) =>
            total + item.amount,
          0
        );

      return {
        items,
        inflows,
        outflows,
        netCashFlow:
          inflows - outflows,
      };
    };

    const operatingActivities =
      buildSection("OPERATING");

    const investingActivities =
      buildSection("INVESTING");

    const financingActivities =
      buildSection("FINANCING");

    const netIncreaseDecrease =
      operatingActivities.netCashFlow +
      investingActivities.netCashFlow +
      financingActivities.netCashFlow;

    /*
     * When no start date is supplied, opening
     * cash is treated as zero because the report
     * represents all available history.
     */
    const closingCashBalance =
      openingCashBalance +
      netIncreaseDecrease;

    /*
     * Independent closing-balance verification
     * using all posted cash movements up to
     * the report end date.
     */
    let calculatedClosingCashBalance = 0;

    for (const entry of allPostedEntries) {
      if (
        cashAccountIds.has(
          entry.debitAccountId
        )
      ) {
        calculatedClosingCashBalance +=
          entry.amount;
      }

      if (
        cashAccountIds.has(
          entry.creditAccountId
        )
      ) {
        calculatedClosingCashBalance -=
          entry.amount;
      }
    }

    const reconciliationDifference =
      Math.abs(
        closingCashBalance -
          calculatedClosingCashBalance
      );

    return res.status(200).json({
      success: true,

      operatingActivities,
      investingActivities,
      financingActivities,

      cashAccounts: cashAccounts.map(
        (account) => ({
          id: account.id,
          code: account.code,
          name: account.name,
        })
      ),

      totals: {
        operating:
          operatingActivities.netCashFlow,

        investing:
          investingActivities.netCashFlow,

        financing:
          financingActivities.netCashFlow,

        netIncreaseDecrease,

        openingCashBalance,

        closingCashBalance,

        calculatedClosingCashBalance,

        reconciliationDifference,

        reconciled:
          reconciliationDifference < 0.01,
      },

      meta: {
        startDate:
          dateFilter.gte?.toISOString() ??
          null,

        endDate:
          dateFilter.lte?.toISOString() ??
          null,

        postedEntries:
          periodEntries.length,

        cashTransactions:
          cashFlowItems.length,

        cashAccounts:
          cashAccounts.length,

        currency: "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "CASH FLOW STATEMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate cash flow statement",
    });
  }
};