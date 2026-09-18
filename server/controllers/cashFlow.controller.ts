import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

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

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
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

/* =========================================================
   CASH FLOW CLASSIFICATION
========================================================= */

const classifyCashFlow = (
  account: {
    code: string;
    name: string;
    type: string;
  }
): CashFlowCategory => {
  const accountName =
    normalize(account.name);

  const accountCode =
    normalize(account.code);

  const accountType =
    normalize(account.type);

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

  if (
    accountCode.startsWith("15") ||
    accountCode.startsWith("16") ||
    accountCode.startsWith("17")
  ) {
    return "INVESTING";
  }

  return "OPERATING";
};

/* =========================================================
   DATE FILTER
========================================================= */

const getDateFilter = (
  startDate?: unknown,
  endDate?: unknown
) => {
  const dateFilter: {
    gte?: Date;
    lte?: Date;
  } = {};

  if (startDate) {
    const parsedStartDate =
      new Date(String(startDate));

    if (
      Number.isNaN(
        parsedStartDate.getTime()
      )
    ) {
      throw new Error(
        "INVALID_START_DATE"
      );
    }

    parsedStartDate.setHours(
      0,
      0,
      0,
      0
    );

    dateFilter.gte =
      parsedStartDate;
  }

  if (endDate) {
    const parsedEndDate =
      new Date(String(endDate));

    if (
      Number.isNaN(
        parsedEndDate.getTime()
      )
    ) {
      throw new Error(
        "INVALID_END_DATE"
      );
    }

    parsedEndDate.setHours(
      23,
      59,
      59,
      999
    );

    dateFilter.lte =
      parsedEndDate;
  }

  if (
    dateFilter.gte &&
    dateFilter.lte &&
    dateFilter.gte >
      dateFilter.lte
  ) {
    throw new Error(
      "INVALID_DATE_RANGE"
    );
  }

  return dateFilter;
};

/* =========================================================
   CASH FLOW STATEMENT
========================================================= */

export const getCashFlow = async (
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

    const {
      startDate,
      endDate,
    } = req.query;

    let dateFilter: {
      gte?: Date;
      lte?: Date;
    };

    try {
      dateFilter =
        getDateFilter(
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

    /* =====================================================
       TENANT ACCOUNTS
    ===================================================== */

    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId,
        },

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

    /* =====================================================
       CASH ACCOUNTS
    ===================================================== */

    const cashAccounts =
      accounts.filter(
        (account) =>
          account.type === "ASSET" &&
          containsAny(
            account.name,
            [
              "cash",
              "bank",
              "mpesa",
              "m-pesa",
              "mobile money",
              "petty cash",
              "cash equivalent",
            ]
          )
      );

    const cashAccountIds =
      new Set(
        cashAccounts.map(
          (account) =>
            account.id
        )
      );

    /* =====================================================
       NO CASH ACCOUNTS
    ===================================================== */

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

        cashAccounts: [],

        totals: {
          operating: 0,
          investing: 0,
          financing: 0,
          netIncreaseDecrease: 0,
          openingCashBalance: 0,
          closingCashBalance: 0,
          calculatedClosingCashBalance: 0,
          reconciliationDifference: 0,
          reconciled: true,
        },

        meta: {
          organizationId,
          startDate:
            dateFilter.gte
              ?.toISOString() ?? null,
          endDate:
            dateFilter.lte
              ?.toISOString() ?? null,
          postedEntries: 0,
          cashTransactions: 0,
          cashAccounts: 0,
          currency: "KES",
          generatedAt:
            new Date().toISOString(),
        },
      });
    }

    /* =====================================================
       POSTED JOURNAL ENTRIES
       
       JournalEntryLine is authoritative.
    ===================================================== */

    const allPostedEntries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,
          status: { in: ["POSTED", "APPROVED"] },

          ...(dateFilter.lte
            ? {
                transactionDate: {
                  lte:
                    dateFilter.lte,
                },
              }
            : {}),
        },

        select: {
          id: true,
          reference: true,
          description: true,
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

    /* =====================================================
       OPENING CASH BALANCE
    ===================================================== */

    let openingCashBalance = 0;

    if (dateFilter.gte) {
      for (const entry of allPostedEntries) {
        if (
          entry.transactionDate >=
          dateFilter.gte
        ) {
          continue;
        }

        for (const line of entry.lines) {
          if (
            cashAccountIds.has(
              line.accountId
            )
          ) {
            openingCashBalance +=
              Number(line.debit) -
              Number(line.credit);
          }
        }
      }
    }

    /* =====================================================
       PERIOD ENTRIES
    ===================================================== */

    const periodEntries =
      allPostedEntries.filter(
        (entry) => {
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
        }
      );

    /* =====================================================
       CASH FLOW ITEMS
       
       For multi-line journals, cash movement is
       allocated across counterpart lines proportionally.
    ===================================================== */

    const cashFlowItems:
      CashFlowItem[] = [];

    for (const entry of periodEntries) {
      const cashLines =
        entry.lines.filter(
          (line) =>
            cashAccountIds.has(
              line.accountId
            )
        );

      const counterpartLines =
        entry.lines.filter(
          (line) =>
            !cashAccountIds.has(
              line.accountId
            )
        );

      if (
        cashLines.length === 0 ||
        counterpartLines.length === 0
      ) {
        continue;
      }

      for (const cashLine of cashLines) {
        const cashMovement =
          Number(cashLine.debit) -
          Number(cashLine.credit);

        if (
          Math.abs(cashMovement) <
          0.000001
        ) {
          continue;
        }

        const cashAccount =
          accountMap.get(
            cashLine.accountId
          );

        if (!cashAccount) {
          continue;
        }

        const direction:
          CashFlowDirection =
          cashMovement > 0
            ? "INFLOW"
            : "OUTFLOW";

        const totalCounterpartMagnitude =
          counterpartLines.reduce(
            (sum, line) =>
              sum +
              Math.abs(
                Number(line.debit) -
                Number(line.credit)
              ),
            0
          );

        if (
          totalCounterpartMagnitude ===
          0
        ) {
          continue;
        }

        for (
          const counterpartLine of
          counterpartLines
        ) {
          const counterpartMovement =
            Number(
              counterpartLine.debit
            ) -
            Number(
              counterpartLine.credit
            );

          const magnitude =
            Math.abs(
              counterpartMovement
            );

          if (magnitude === 0) {
            continue;
          }

          const amount =
            Math.abs(
              cashMovement
            ) *
            (magnitude /
              totalCounterpartMagnitude);

          const counterpartAccount =
            accountMap.get(
              counterpartLine.accountId
            );

          if (
            !counterpartAccount
          ) {
            continue;
          }

          const category =
            classifyCashFlow({
              code:
                counterpartAccount.code,
              name:
                counterpartAccount.name,
              type:
                counterpartAccount.type,
            });

          cashFlowItems.push({
            id: `${entry.id}-${cashLine.accountId}-${counterpartLine.accountId}`,
            reference:
              entry.reference,
            description:
              entry.description,
            transactionDate:
              entry.transactionDate,
            category,
            direction,
            amount,
            cashAccount: {
              id:
                cashAccount.id,
              code:
                cashAccount.code,
              name:
                cashAccount.name,
            },
            counterpartAccount: {
              id:
                counterpartAccount.id,
              code:
                counterpartAccount.code,
              name:
                counterpartAccount.name,
              type:
                counterpartAccount.type,
            },
          });
        }
      }
    }

    /* =====================================================
       BUILD SECTIONS
    ===================================================== */

    const buildSection = (
      category: CashFlowCategory
    ) => {
      const items =
        cashFlowItems.filter(
          (item) =>
            item.category ===
            category
        );

      const inflows =
        items
          .filter(
            (item) =>
              item.direction ===
              "INFLOW"
          )
          .reduce(
            (total, item) =>
              total +
              Number(item.amount),
            0
          );

      const outflows =
        items
          .filter(
            (item) =>
              item.direction ===
              "OUTFLOW"
          )
          .reduce(
            (total, item) =>
              total +
              Number(item.amount),
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

    /* =====================================================
       TOTAL CASH MOVEMENT
    ===================================================== */

    const netIncreaseDecrease =
      operatingActivities.netCashFlow +
      investingActivities.netCashFlow +
      financingActivities.netCashFlow;

    const closingCashBalance =
      openingCashBalance +
      netIncreaseDecrease;

    /* =====================================================
       INDEPENDENT RECONCILIATION
    ===================================================== */

    let calculatedClosingCashBalance =
      0;

    for (
      const entry of
      allPostedEntries
    ) {
      for (const line of entry.lines) {
        if (
          cashAccountIds.has(
            line.accountId
          )
        ) {
          calculatedClosingCashBalance +=
            Number(line.debit) -
            Number(line.credit);
        }
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

      cashAccounts:
        cashAccounts.map(
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
          reconciliationDifference <
          0.01,
      },

      meta: {
        organizationId,

        startDate:
          dateFilter.gte
            ?.toISOString() ?? null,

        endDate:
          dateFilter.lte
            ?.toISOString() ?? null,

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
