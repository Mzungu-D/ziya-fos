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
   TRIAL BALANCE
========================================================= */

export const getTrialBalance = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* =====================================================
       TENANT
    ===================================================== */

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

    let reportDate: Date | null = null;

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

    /* =====================================================
       TENANT POSTED JOURNAL ENTRIES
    ===================================================== */

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,

          status: "POSTED",

          ...(reportDate
            ? {
                transactionDate: {
                  lte: reportDate,
                },
              }
            : {}),
        },

        select: {
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
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
      const amount =
        Number(entry.amount);

      const debitMovement =
        movements.get(
          entry.debitAccountId
        ) ?? {
          debit: 0,
          credit: 0,
        };

      debitMovement.debit += amount;

      movements.set(
        entry.debitAccountId,
        debitMovement
      );

      const creditMovement =
        movements.get(
          entry.creditAccountId
        ) ?? {
          debit: 0,
          credit: 0,
        };

      creditMovement.credit += amount;

      movements.set(
        entry.creditAccountId,
        creditMovement
      );
    }

    /* =====================================================
       TRIAL BALANCE
    ===================================================== */

    const trialBalance =
      accounts.map((account) => {
        const movement =
          movements.get(account.id) ?? {
            debit: 0,
            credit: 0,
          };

        const netBalance =
          movement.debit -
          movement.credit;

        /*
         * Trial balance displays the net balance
         * on its natural debit or credit side.
         */
        const debit =
          netBalance > 0
            ? netBalance
            : 0;

        const credit =
          netBalance < 0
            ? Math.abs(netBalance)
            : 0;

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          debit,
          credit,
        };
      });

    /* =====================================================
       TOTALS
    ===================================================== */

    const totalDebit =
      trialBalance.reduce(
        (sum, account) =>
          sum + account.debit,
        0
      );

    const totalCredit =
      trialBalance.reduce(
        (sum, account) =>
          sum + account.credit,
        0
      );

    const difference =
      Math.abs(
        totalDebit -
          totalCredit
      );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      trialBalance,

      totals: {
        debit: totalDebit,
        credit: totalCredit,
        difference,
        balanced:
          difference < 0.01,
      },

      meta: {
        organizationId,

        asOfDate:
          reportDate
            ?.toISOString() ??
          null,

        postedEntries:
          entries.length,

        currency: "KES",

        generatedAt:
          new Date()
            .toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "TRIAL BALANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate trial balance",
    });
  }
};