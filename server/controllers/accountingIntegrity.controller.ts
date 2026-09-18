import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   ACCOUNTING CONTROL CONSTANTS
========================================================= */

const TOLERANCE = 0.01;

const EFFECTIVE_STATUSES = [
  "POSTED",
  "APPROVED",
] as const;

/* =========================================================
   HELPERS
========================================================= */

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function balanced(
  debit: number,
  credit: number,
  tolerance = TOLERANCE
): boolean {
  return Math.abs(debit - credit) <= tolerance;
}

/**
 * Interpret a query date safely.
 *
 * YYYY-MM-DD is treated as the complete calendar day.
 * ISO timestamps are accepted as supplied.
 */
function parseAsOfDate(
  value: unknown
): Date | null {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    const now = new Date();

    now.setHours(
      23,
      59,
      59,
      999
    );

    return now;
  }

  const raw = String(value).trim();

  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(
          `${raw}T23:59:59.999`
        )
      : new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/* =========================================================
   ACCOUNTING INTEGRITY CHECK
========================================================= */

export const getAccountingIntegrity = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* =======================================================
       TENANT CONTEXT
    ======================================================== */

    const organizationId =
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    /* =======================================================
       AS-OF DATE
    ======================================================== */

    const asOfDate =
      parseAsOfDate(
        req.query.asOfDate
      );

    if (!asOfDate) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid asOfDate.",
      });
    }

    /* =======================================================
       LOAD TENANT ACCOUNTS
    ======================================================== */

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
          organizationId: true,
        },

        orderBy: {
          code: "asc",
        },
      });

    /*
     * Map account IDs for fast validation and calculations.
     */
    const accountMap = new Map(
      accounts.map(
        (account) => [
          account.id,
          account,
        ]
      )
    );

    /* =======================================================
       LOAD EFFECTIVE JOURNAL ENTRIES
       
       IMPORTANT:
       JournalEntryLine is the authoritative accounting source.

       DRAFT     -> excluded
       POSTED    -> included
       APPROVED  -> included
       REVERSED  -> excluded
    ======================================================== */

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,

          status: {
            in: [
              ...EFFECTIVE_STATUSES,
            ],
          },

          transactionDate: {
            lte: asOfDate,
          },
        },

        select: {
          id: true,
          reference: true,
          description: true,
          status: true,
          transactionDate: true,
          reversalOfId: true,

          lines: {
            orderBy: {
              lineNumber: "asc",
            },

            select: {
              id: true,
              journalEntryId: true,
              accountId: true,
              lineNumber: true,
              debit: true,
              credit: true,
              memo: true,
            },
          },
        },

        orderBy: [
          {
            transactionDate:
              "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    /* =======================================================
       JOURNAL INTEGRITY CHECKS
    ======================================================== */

    const unbalancedEntries: Array<{
      id: string;
      reference: string;
      status: string;
      debit: number;
      credit: number;
      difference: number;
    }> = [];

    const missingLineEntries: Array<{
      id: string;
      reference: string;
      status: string;
    }> = [];

    const invalidAccountLines: Array<{
      journalEntryId: string;
      reference: string;
      lineId: string;
      accountId: string;
    }> = [];

    const invalidLines: Array<{
      journalEntryId: string;
      reference: string;
      lineId: string;
      reason: string;
    }> = [];

    /* =======================================================
       CONTROL TOTALS
    ======================================================== */

    let journalDebit = 0;
    let journalCredit = 0;

    let totalLines = 0;

    /* =======================================================
       VALIDATE EACH EFFECTIVE JOURNAL
    ======================================================== */

    for (const entry of entries) {
      /*
       * Every effective journal must contain accounting lines.
       */

      if (entry.lines.length === 0) {
        missingLineEntries.push({
          id: entry.id,
          reference: entry.reference,
          status: entry.status,
        });

        continue;
      }

      let entryDebit = 0;
      let entryCredit = 0;

      for (const line of entry.lines) {
        totalLines++;

        const debit =
          Number(line.debit);

        const credit =
          Number(line.credit);

        /* =================================================
           NUMERIC VALIDATION
        ================================================== */

        if (
          !Number.isFinite(debit) ||
          !Number.isFinite(credit)
        ) {
          invalidLines.push({
            journalEntryId:
              entry.id,

            reference:
              entry.reference,

            lineId: line.id,

            reason:
              "Debit or credit is not a finite number.",
          });

          /*
           * Do not allow corrupted values
           * into accounting control totals.
           */

          continue;
        }

        /* =================================================
           NEGATIVE VALUE
        ================================================== */

        if (
          debit < 0 ||
          credit < 0
        ) {
          invalidLines.push({
            journalEntryId:
              entry.id,

            reference:
              entry.reference,

            lineId: line.id,

            reason:
              "Debit or credit cannot be negative.",
          });
        }

        /* =================================================
           BOTH DEBIT AND CREDIT
        ================================================== */

        if (
          debit > 0 &&
          credit > 0
        ) {
          invalidLines.push({
            journalEntryId:
              entry.id,

            reference:
              entry.reference,

            lineId: line.id,

            reason:
              "A journal line cannot contain both debit and credit.",
          });
        }

        /* =================================================
           ZERO LINE
        ================================================== */

        if (
          debit === 0 &&
          credit === 0
        ) {
          invalidLines.push({
            journalEntryId:
              entry.id,

            reference:
              entry.reference,

            lineId: line.id,

            reason:
              "A journal line must contain either a debit or a credit.",
          });
        }

        /* =================================================
           TENANT ACCOUNT VALIDATION
        ================================================== */

        const account =
          accountMap.get(
            line.accountId
          );

        if (!account) {
          invalidAccountLines.push({
            journalEntryId:
              entry.id,

            reference:
              entry.reference,

            lineId:
              line.id,

            accountId:
              line.accountId,
          });
        }

        /* =================================================
           ACCOUNTING TOTALS
        ================================================== */

        entryDebit += debit;
        entryCredit += credit;

        journalDebit += debit;
        journalCredit += credit;
      }

      /* =====================================================
         JOURNAL BALANCE
      ====================================================== */

      if (
        !balanced(
          entryDebit,
          entryCredit
        )
      ) {
        unbalancedEntries.push({
          id: entry.id,

          reference:
            entry.reference,

          status:
            entry.status,

          debit:
            round(entryDebit),

          credit:
            round(entryCredit),

          difference:
            round(
              entryDebit -
                entryCredit
            ),
        });
      }
    }

    /* =======================================================
       ACCOUNT MOVEMENTS
       
       Every JournalEntryLine contributes to exactly one
       account movement.
    ======================================================== */

    const balances = new Map<
      string,
      {
        debit: number;
        credit: number;
      }
    >();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const debit =
          Number(line.debit);

        const credit =
          Number(line.credit);

        /*
         * Invalid numeric values have already been detected.
         * They must not contaminate account balances.
         */

        if (
          !Number.isFinite(debit) ||
          !Number.isFinite(credit)
        ) {
          continue;
        }

        const current =
          balances.get(
            line.accountId
          ) ?? {
            debit: 0,
            credit: 0,
          };

        current.debit += debit;
        current.credit += credit;

        balances.set(
          line.accountId,
          current
        );
      }
    }

    /* =======================================================
       TRIAL BALANCE
       
       Each account is represented by its net debit/credit
       balance.
    ======================================================== */

    let trialBalanceDebit = 0;
    let trialBalanceCredit = 0;

    for (
      const balance of
        balances.values()
    ) {
      const net =
        balance.debit -
        balance.credit;

      if (net >= 0) {
        trialBalanceDebit += net;
      } else {
        trialBalanceCredit +=
          Math.abs(net);
      }
    }

    /* =======================================================
       PROFIT & LOSS
       
       Revenue:
       Credit increases revenue.
       Debit decreases revenue.

       Expense:
       Debit increases expense.
       Credit decreases expense.
    ======================================================== */

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (
      const account of accounts
    ) {
      const balance =
        balances.get(
          account.id
        );

      if (!balance) {
        continue;
      }

      /* Revenue */

      if (
        account.type ===
        "REVENUE"
      ) {
        totalRevenue +=
          balance.credit -
          balance.debit;
      }

      /* Expenses */

      if (
        account.type ===
        "EXPENSE"
      ) {
        totalExpenses +=
          balance.debit -
          balance.credit;
      }
    }

    const netProfit =
      totalRevenue -
      totalExpenses;

    /* =======================================================
       BALANCE SHEET
       
       Asset:
       Debit increases asset.
       Credit decreases asset.

       Liability:
       Credit increases liability.
       Debit decreases liability.

       Equity:
       Credit increases equity.
       Debit decreases equity.
    ======================================================== */

    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    for (
      const account of accounts
    ) {
      const balance =
        balances.get(
          account.id
        );

      if (!balance) {
        continue;
      }

      switch (
        account.type
      ) {
        case "ASSET":
          assets +=
            balance.debit -
            balance.credit;
          break;

        case "LIABILITY":
          liabilities +=
            balance.credit -
            balance.debit;
          break;

        case "EQUITY":
          equity +=
            balance.credit -
            balance.debit;
          break;
      }
    }

    /*
     * Accounting equation:
     *
     * Assets =
     * Liabilities +
     * Equity +
     * Current Earnings
     *
     * Current Earnings are represented by:
     *
     * Revenue - Expenses
     *
     * Therefore:
     *
     * Assets + Expenses =
     * Liabilities + Equity + Revenue
     *
     * This is a CONTROL calculation only.
     *
     * It does not alter the actual Balance Sheet report.
     */

    const balanceSheetDifference =
      assets +
      totalExpenses -
      liabilities -
      equity -
      totalRevenue;

    /* =======================================================
       CASH CONTROL
       
       This is a diagnostic control only.
       
       The long-term production solution should have explicit
       account classification metadata for cash/bank accounts.
    ======================================================== */

    const cashKeywords = [
      "cash",
      "bank",
      "mpesa",
      "m-pesa",
      "mobile money",
      "petty cash",
      "cash equivalent",
    ];

    let cashBalance = 0;

    const cashAccounts: Array<{
      id: string;
      code: string;
      name: string;
      balance: number;
    }> = [];

    for (
      const account of accounts
    ) {
      /*
       * Cash must be an asset.
       */

      if (
        account.type !==
        "ASSET"
      ) {
        continue;
      }

      const name =
        account.name
          .trim()
          .toLowerCase();

      const isCashAccount =
        cashKeywords.some(
          (keyword) =>
            name.includes(
              keyword
            )
        );

      if (!isCashAccount) {
        continue;
      }

      const balance =
        balances.get(
          account.id
        );

      if (!balance) {
        continue;
      }

      const signedBalance =
        balance.debit -
        balance.credit;

      cashBalance +=
        signedBalance;

      cashAccounts.push({
        id: account.id,

        code:
          account.code,

        name:
          account.name,

        balance:
          round(
            signedBalance
          ),
      });
    }

    /* =======================================================
       CONTROL CHECK RESULTS
    ======================================================== */

    const journalDifference =
      journalDebit -
      journalCredit;

    const glBalanced =
      balanced(
        journalDebit,
        journalCredit
      );

    const trialBalanceDifference =
      trialBalanceDebit -
      trialBalanceCredit;

    const trialBalanceReconciled =
      balanced(
        trialBalanceDebit,
        trialBalanceCredit
      );

    const balanceSheetReconciled =
      Math.abs(
        balanceSheetDifference
      ) <= TOLERANCE;

    const journalIntegrityPassed =
      unbalancedEntries.length ===
        0 &&
      missingLineEntries.length ===
        0 &&
      invalidAccountLines.length ===
        0 &&
      invalidLines.length ===
        0;

    const overallHealthy =
      journalIntegrityPassed &&
      glBalanced &&
      trialBalanceReconciled &&
      balanceSheetReconciled;

    /* =======================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({
      success: true,

      /* =====================================================
         OVERALL HEALTH
      ====================================================== */

      health: {
        status:
          overallHealthy
            ? "HEALTHY"
            : "EXCEPTIONS",

        healthy:
          overallHealthy,

        tolerance:
          TOLERANCE,
      },

      /* =====================================================
         JOURNAL INTEGRITY
      ====================================================== */

      journalIntegrity: {
        passed:
          journalIntegrityPassed,

        effectiveEntries:
          entries.length,

        totalLines,

        unbalancedEntries,

        missingLineEntries,

        invalidAccountLines,

        invalidLines,
      },

      /* =====================================================
         GENERAL LEDGER CONTROL
      ====================================================== */

      generalLedger: {
        debit:
          round(
            journalDebit
          ),

        credit:
          round(
            journalCredit
          ),

        difference:
          round(
            journalDifference
          ),

        balanced:
          glBalanced,
      },

      /* =====================================================
         TRIAL BALANCE CONTROL
      ====================================================== */

      trialBalance: {
        debit:
          round(
            trialBalanceDebit
          ),

        credit:
          round(
            trialBalanceCredit
          ),

        difference:
          round(
            trialBalanceDifference
          ),

        reconciled:
          trialBalanceReconciled,
      },

      /* =====================================================
         PROFIT & LOSS CONTROL
      ====================================================== */

      profitAndLoss: {
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

        /*
         * The integrity endpoint is intentionally cumulative
         * through the supplied asOfDate.
         *
         * This should not be confused with a date-range P&L.
         */
        basis:
          "CUMULATIVE_EFFECTIVE_HISTORY",
      },

      /* =====================================================
         BALANCE SHEET CONTROL
      ====================================================== */

      balanceSheet: {
        assets:
          round(
            assets
          ),

        liabilities:
          round(
            liabilities
          ),

        equity:
          round(
            equity
          ),

        /*
         * Revenue and expenses are returned separately above.
         * This value is the accounting-equation control result,
         * not a replacement for the presentation Balance Sheet.
         */
        controlDifference:
          round(
            balanceSheetDifference
          ),

        reconciled:
          balanceSheetReconciled,
      },

      /* =====================================================
         CASH CONTROL
      ====================================================== */

      cash: {
        balance:
          round(
            cashBalance
          ),

        accounts:
          cashAccounts,
      },

      /* =====================================================
         METADATA
      ====================================================== */

      meta: {
        organizationId,

        asOfDate:
          asOfDate.toISOString(),

        effectiveStatuses:
          [
            ...EFFECTIVE_STATUSES,
          ],

        accountingSource:
          "JournalEntryLine",

        currency:
          "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "ACCOUNTING INTEGRITY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to run accounting integrity check.",
    });
  }
};