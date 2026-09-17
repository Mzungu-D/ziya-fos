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

/* =========================================================
   BALANCE SHEET
========================================================= */

export const getBalanceSheet = async (
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

    /* =====================================================
       REPORT DATE
    ===================================================== */

    const { asOfDate } = req.query;

    let reportDate = new Date();

    if (asOfDate) {
      reportDate = new Date(
        String(asOfDate)
      );

      if (
        Number.isNaN(
          reportDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid asOfDate",
        });
      }

      reportDate.setHours(
        23,
        59,
        59,
        999
      );
    }

    /* =====================================================
       TENANT ACCOUNTS
    ===================================================== */

    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId,
          type: {
            in: [
              "ASSET",
              "LIABILITY",
              "EQUITY",
              "REVENUE",
              "EXPENSE",
            ],
          },
        },

        orderBy: {
          code: "asc",
        },
      });

    /* =====================================================
       POSTED JOURNAL ENTRIES
       
       JournalEntryLine is authoritative.
    ===================================================== */

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,
          status: "POSTED",

          transactionDate: {
            lte: reportDate,
          },
        },

        select: {
          lines: {
            select: {
              accountId: true,
              debit: true,
              credit: true,
            },
          },
        },
      });

    /* =====================================================
       ACCOUNT MOVEMENTS
    ===================================================== */

    const movements = new Map<
      string,
      {
        debit: number;
        credit: number;
      }
    >();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const movement =
          movements.get(line.accountId) ?? {
            debit: 0,
            credit: 0,
          };

        movement.debit +=
          Number(line.debit);

        movement.credit +=
          Number(line.credit);

        movements.set(
          line.accountId,
          movement
        );
      }
    }

    /* =====================================================
       ASSETS
    ===================================================== */

    const assets = accounts
      .filter(
        (account) =>
          account.type === "ASSET"
      )
      .map((account) => {
        const movement =
          movements.get(account.id) ?? {
            debit: 0,
            credit: 0,
          };

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          balance:
            movement.debit -
            movement.credit,
        };
      })
      .filter(
        (account) =>
          Math.abs(account.balance) >=
          0.01
      );

    /* =====================================================
       LIABILITIES
    ===================================================== */

    const liabilities = accounts
      .filter(
        (account) =>
          account.type === "LIABILITY"
      )
      .map((account) => {
        const movement =
          movements.get(account.id) ?? {
            debit: 0,
            credit: 0,
          };

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          balance:
            movement.credit -
            movement.debit,
        };
      })
      .filter(
        (account) =>
          Math.abs(account.balance) >=
          0.01
      );

    /* =====================================================
       EQUITY
    ===================================================== */

    const equity = accounts
      .filter(
        (account) =>
          account.type === "EQUITY"
      )
      .map((account) => {
        const movement =
          movements.get(account.id) ?? {
            debit: 0,
            credit: 0,
          };

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          balance:
            movement.credit -
            movement.debit,
        };
      })
      .filter(
        (account) =>
          Math.abs(account.balance) >=
          0.01
      );

    /* =====================================================
       CURRENT YEAR / RETAINED EARNINGS
    ===================================================== */

    const revenue =
      accounts
        .filter(
          (account) =>
            account.type ===
            "REVENUE"
        )
        .reduce(
          (total, account) => {
            const movement =
              movements.get(
                account.id
              ) ?? {
                debit: 0,
                credit: 0,
              };

            return (
              total +
              movement.credit -
              movement.debit
            );
          },
          0
        );

    const expenses =
      accounts
        .filter(
          (account) =>
            account.type ===
            "EXPENSE"
        )
        .reduce(
          (total, account) => {
            const movement =
              movements.get(
                account.id
              ) ?? {
                debit: 0,
                credit: 0,
              };

            return (
              total +
              movement.debit -
              movement.credit
            );
          },
          0
        );

    const retainedEarnings =
      revenue - expenses;

    /* =====================================================
       TOTALS
    ===================================================== */

    const totalAssets =
      assets.reduce(
        (total, account) =>
          total + account.balance,
        0
      );

    const totalLiabilities =
      liabilities.reduce(
        (total, account) =>
          total + account.balance,
        0
      );

    const totalEquity =
      equity.reduce(
        (total, account) =>
          total + account.balance,
        0
      );

    const totalEquityAndRetainedEarnings =
      totalEquity +
      retainedEarnings;

    const totalLiabilitiesAndEquity =
      totalLiabilities +
      totalEquityAndRetainedEarnings;

    const difference = Math.abs(
      totalAssets -
      totalLiabilitiesAndEquity
    );

    return res.status(200).json({
      success: true,

      assets,
      liabilities,
      equity,

      retainedEarnings,

      totals: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: totalEquity,
        retainedEarnings,
        totalEquityAndRetainedEarnings,
        liabilitiesAndEquity:
          totalLiabilitiesAndEquity,
        difference,
        balanced:
          difference < 0.01,
      },

      meta: {
        organizationId,

        asOfDate:
          reportDate.toISOString(),

        postedEntries:
          entries.length,

        currency: "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "BALANCE SHEET ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate balance sheet",
    });
  }
};