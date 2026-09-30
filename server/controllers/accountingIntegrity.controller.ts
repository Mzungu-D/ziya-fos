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

/**
 * Prevent an accounting-integrity response from becoming
 * unbounded if a tenant has a very large number of exceptions.
 *
 * The API still reports the total exception count while only
 * returning a bounded diagnostic sample.
 */
const MAX_EXCEPTION_DETAILS = 200;

/* =========================================================
   TYPES
========================================================= */

type AccountingAccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE"
  | string;

interface JournalControlRow {
  id: string;
  reference: string;
  status: string;
  debit: number | null;
  credit: number | null;
  lineCount: number | bigint | null;
}

interface InvalidLineRow {
  journalEntryId: string;
  reference: string;
  lineId: string;
  accountId: string;
  debit: number | null;
  credit: number | null;
  accountExists: boolean;
  reason: string | null;
}

interface AccountBalanceRow {
  accountId: string;
  debit: number | null;
  credit: number | null;
}

interface AccountRecord {
  id: string;
  code: string;
  name: string;
  type: AccountingAccountType;
  organizationId: string;
}

/* =========================================================
   HELPERS
========================================================= */

function round(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return (
    Math.round(
      (value + Number.EPSILON) * 100
    ) / 100
  );
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function balanced(
  debit: number,
  credit: number,
  tolerance = TOLERANCE
): boolean {
  return (
    Math.abs(debit - credit) <=
    tolerance
  );
}

function pushBounded<T>(
  target: T[],
  value: T
): void {
  if (
    target.length <
    MAX_EXCEPTION_DETAILS
  ) {
    target.push(value);
  }
}

function getExceptionCount(
  value: number
): number {
  return Math.max(0, value);
}

/**
 * Interpret an accounting as-of date.
 *
 * YYYY-MM-DD represents the complete
 * calendar day.
 *
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

  const raw =
    String(value).trim();

  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(
      raw
    )
      ? new Date(
          `${raw}T23:59:59.999`
        )
      : new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

/**
 * PostgreSQL aggregate values can be
 * returned as numbers or bigint depending
 * on the expression and driver.
 */
function normalizeAggregate(
  value: unknown
): number {
  return toNumber(value);
}

/* =========================================================
   ACCOUNTING INTEGRITY CHECK
========================================================= */

export const getAccountingIntegrity =
  async (
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
        (await prisma.account.findMany(
          {
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
          }
        )) as AccountRecord[];

      const accountMap =
        new Map<
          string,
          AccountRecord
        >(
          accounts.map(
            (account) => [
              account.id,
              account,
            ]
          )
        );

      /* =======================================================
         EFFECTIVE JOURNAL CONTROL

         Current FOS accounting policy:

         POSTED
         APPROVED

         are effective accounting statuses.

         DRAFT and REVERSED are excluded.

         JournalEntryLine remains the authoritative
         accounting source.
      ======================================================== */

      /*
       * Aggregate journal totals directly in PostgreSQL.
       *
       * This prevents the application from loading the
       * entire journal history into Node.js.
       */
      const journalControls =
        await prisma.$queryRaw<
          JournalControlRow[]
        >`
          SELECT
            je."id" AS "id",
            je."reference" AS "reference",
            je."status" AS "status",

            COALESCE(
              SUM(jel."debit"),
              0
            ) AS "debit",

            COALESCE(
              SUM(jel."credit"),
              0
            ) AS "credit",

            COUNT(jel."id") AS "lineCount"

          FROM "JournalEntry" je

          LEFT JOIN "JournalEntryLine" jel
            ON jel."journalEntryId" =
              je."id"

          WHERE
            je."organizationId" =
              ${organizationId}

            AND je."status" IN (
              'POSTED',
              'APPROVED'
            )

            AND je."transactionDate" <=
              ${asOfDate}

          GROUP BY
            je."id",
            je."reference",
            je."status"

          ORDER BY
            je."transactionDate" ASC,
            je."id" ASC
        `;

      /* =======================================================
         JOURNAL INTEGRITY EXCEPTIONS
      ======================================================== */

      const unbalancedEntries:
        Array<{
          id: string;
          reference: string;
          status: string;
          debit: number;
          credit: number;
          difference: number;
        }> = [];

      const missingLineEntries:
        Array<{
          id: string;
          reference: string;
          status: string;
        }> = [];

      let unbalancedEntryCount =
        0;

      let missingLineEntryCount =
        0;

      let journalDebit = 0;
      let journalCredit = 0;
      let totalLines = 0;

      for (
        const journal of
          journalControls
      ) {
        const debit =
          normalizeAggregate(
            journal.debit
          );

        const credit =
          normalizeAggregate(
            journal.credit
          );

        const lineCount =
          normalizeAggregate(
            journal.lineCount
          );

        totalLines +=
          lineCount;

        journalDebit +=
          debit;

        journalCredit +=
          credit;

        if (
          lineCount === 0
        ) {
          missingLineEntryCount++;

          pushBounded(
            missingLineEntries,
            {
              id: journal.id,
              reference:
                journal.reference,
              status:
                journal.status,
            }
          );

          continue;
        }

        if (
          !balanced(
            debit,
            credit
          )
        ) {
          unbalancedEntryCount++;

          pushBounded(
            unbalancedEntries,
            {
              id: journal.id,
              reference:
                journal.reference,
              status:
                journal.status,
              debit:
                round(debit),
              credit:
                round(credit),
              difference:
                round(
                  debit -
                    credit
                ),
            }
          );
        }
      }

      /* =======================================================
         INVALID JOURNAL-LINE VALIDATION
      ======================================================== */

      const invalidAccountLines:
        Array<{
          journalEntryId: string;
          reference: string;
          lineId: string;
          accountId: string;
        }> = [];

      const invalidLines:
        Array<{
          journalEntryId: string;
          reference: string;
          lineId: string;
          reason: string;
        }> = [];

      let invalidAccountLineCount =
        0;

      let invalidLineCount = 0;

      /*
       * Diagnostic query checks:
       *
       * - account existence
       * - negative debit
       * - negative credit
       * - both debit and credit
       * - zero-value lines
       * - PostgreSQL NaN values
       */
      const invalidRows =
        await prisma.$queryRaw<
          InvalidLineRow[]
        >`
          SELECT
            jel."journalEntryId"
              AS "journalEntryId",

            je."reference"
              AS "reference",

            jel."id"
              AS "lineId",

            jel."accountId"
              AS "accountId",

            jel."debit"
              AS "debit",

            jel."credit"
              AS "credit",

            (
              account."id"
              IS NOT NULL
            ) AS "accountExists",

            CASE

              WHEN account."id"
                IS NULL
                THEN
                  'Account does not belong to the tenant.'

              WHEN jel."debit"
                <> jel."debit"
                OR jel."credit"
                <> jel."credit"
                THEN
                  'Debit or credit is not a finite numeric value.'

              WHEN jel."debit" < 0
                OR jel."credit" < 0
                THEN
                  'Debit or credit cannot be negative.'

              WHEN jel."debit" > 0
                AND jel."credit" > 0
                THEN
                  'A journal line cannot contain both debit and credit.'

              WHEN jel."debit" = 0
                AND jel."credit" = 0
                THEN
                  'A journal line must contain either a debit or a credit.'

              ELSE NULL

            END AS "reason"

          FROM "JournalEntryLine" jel

          INNER JOIN "JournalEntry" je
            ON je."id" =
              jel."journalEntryId"

          LEFT JOIN "Account" account
            ON account."id" =
              jel."accountId"

            AND account."organizationId" =
              ${organizationId}

          WHERE
            je."organizationId" =
              ${organizationId}

            AND je."status" IN (
              'POSTED',
              'APPROVED'
            )

            AND je."transactionDate" <=
              ${asOfDate}

            AND (
              account."id" IS NULL

              OR jel."debit"
                <> jel."debit"

              OR jel."credit"
                <> jel."credit"

              OR jel."debit" < 0

              OR jel."credit" < 0

              OR (
                jel."debit" > 0
                AND jel."credit" > 0
              )

              OR (
                jel."debit" = 0
                AND jel."credit" = 0
              )
            )

          ORDER BY
            je."transactionDate" ASC,
            je."id" ASC,
            jel."lineNumber" ASC

          LIMIT
            ${MAX_EXCEPTION_DETAILS}
        `;

      /*
       * Obtain the actual invalid-account count.
       */
      const invalidAccountCountRows =
        await prisma.$queryRaw<
          Array<{
            count: bigint;
          }>
        >`
          SELECT
            COUNT(*) AS "count"

          FROM "JournalEntryLine" jel

          INNER JOIN "JournalEntry" je
            ON je."id" =
              jel."journalEntryId"

          LEFT JOIN "Account" account
            ON account."id" =
              jel."accountId"

            AND account."organizationId" =
              ${organizationId}

          WHERE
            je."organizationId" =
              ${organizationId}

            AND je."status" IN (
              'POSTED',
              'APPROVED'
            )

            AND je."transactionDate" <=
              ${asOfDate}

            AND account."id" IS NULL
        `;

      /*
       * Obtain the actual invalid-value count.
       */
      const invalidValueCountRows =
        await prisma.$queryRaw<
          Array<{
            count: bigint;
          }>
        >`
          SELECT
            COUNT(*) AS "count"

          FROM "JournalEntryLine" jel

          INNER JOIN "JournalEntry" je
            ON je."id" =
              jel."journalEntryId"

          LEFT JOIN "Account" account
            ON account."id" =
              jel."accountId"

            AND account."organizationId" =
              ${organizationId}

          WHERE
            je."organizationId" =
              ${organizationId}

            AND je."status" IN (
              'POSTED',
              'APPROVED'
            )

            AND je."transactionDate" <=
              ${asOfDate}

            AND account."id" IS NOT NULL

            AND (
              jel."debit"
                <> jel."debit"

              OR jel."credit"
                <> jel."credit"

              OR jel."debit" < 0

              OR jel."credit" < 0

              OR (
                jel."debit" > 0
                AND jel."credit" > 0
              )

              OR (
                jel."debit" = 0
                AND jel."credit" = 0
              )
            )
        `;

      invalidAccountLineCount =
        Number(
          invalidAccountCountRows[0]
            ?.count ?? 0
        );

      invalidLineCount =
        Number(
          invalidValueCountRows[0]
            ?.count ?? 0
        );

      for (
        const row of invalidRows
      ) {
        if (
          !row.accountExists
        ) {
          pushBounded(
            invalidAccountLines,
            {
              journalEntryId:
                row.journalEntryId,
              reference:
                row.reference,
              lineId:
                row.lineId,
              accountId:
                row.accountId,
            }
          );
        }

        if (row.reason) {
          pushBounded(
            invalidLines,
            {
              journalEntryId:
                row.journalEntryId,
              reference:
                row.reference,
              lineId:
                row.lineId,
              reason:
                row.reason,
            }
          );
        }
      }

      /* =======================================================
         ACCOUNT MOVEMENTS
         
         Aggregate directly in PostgreSQL.
      ======================================================== */

      const accountBalances =
        await prisma.$queryRaw<
          AccountBalanceRow[]
        >`
          SELECT
            jel."accountId"
              AS "accountId",

            COALESCE(
              SUM(jel."debit"),
              0
            ) AS "debit",

            COALESCE(
              SUM(jel."credit"),
              0
            ) AS "credit"

          FROM "JournalEntryLine" jel

          INNER JOIN "JournalEntry" je
            ON je."id" =
              jel."journalEntryId"

          INNER JOIN "Account" account
            ON account."id" =
              jel."accountId"

            AND account."organizationId" =
              ${organizationId}

          WHERE
            je."organizationId" =
              ${organizationId}

            AND je."status" IN (
              'POSTED',
              'APPROVED'
            )

            AND je."transactionDate" <=
              ${asOfDate}

            /*
             * Corrupt numeric values must not
             * contaminate financial controls.
             */
            AND jel."debit" =
              jel."debit"

            AND jel."credit" =
              jel."credit"

            AND jel."debit" >= 0
            AND jel."credit" >= 0

            AND NOT (
              jel."debit" > 0
              AND jel."credit" > 0
            )

            AND NOT (
              jel."debit" = 0
              AND jel."credit" = 0
            )

          GROUP BY
            jel."accountId"
        `;

      const balanceMap =
        new Map<
          string,
          {
            debit: number;
            credit: number;
          }
        >();

      for (
        const row of
          accountBalances
      ) {
        balanceMap.set(
          row.accountId,
          {
            debit:
              normalizeAggregate(
                row.debit
              ),
            credit:
              normalizeAggregate(
                row.credit
              ),
          }
        );
      }

      /* =======================================================
         TRIAL BALANCE
      ======================================================== */

      let trialBalanceDebit =
        0;

      let trialBalanceCredit =
        0;

      for (
        const account of accounts
      ) {
        const balance =
          balanceMap.get(
            account.id
          );

        if (!balance) {
          continue;
        }

        const net =
          balance.debit -
          balance.credit;

        if (net >= 0) {
          trialBalanceDebit +=
            net;
        } else {
          trialBalanceCredit +=
            Math.abs(net);
        }
      }

      /* =======================================================
         PROFIT & LOSS CONTROL

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
          balanceMap.get(
            account.id
          );

        if (!balance) {
          continue;
        }

        if (
          account.type ===
          "INCOME"
        ) {
          totalRevenue +=
            balance.credit -
            balance.debit;
        }

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
         BALANCE SHEET CONTROL

         Assets:
         Debit increases.

         Liabilities:
         Credit increases.

         Equity:
         Credit increases.
      ======================================================== */

      let assets = 0;
      let liabilities = 0;
      let equity = 0;

      for (
        const account of accounts
      ) {
        const balance =
          balanceMap.get(
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

          default:
            break;
        }
      }

      /*
       * Accounting equation:
       *
       * Assets + Expenses
       * =
       * Liabilities + Equity + Revenue
       *
       * This is a control calculation only.
       */
      const balanceSheetDifference =
        assets +
        totalExpenses -
        liabilities -
        equity -
        totalRevenue;

      /* =======================================================
         CASH CONTROL

         The current Account schema does not expose a dedicated
         cash classification field.

         Therefore this remains a diagnostic fallback based on
         account names.

         It must NOT be treated as authoritative financial
         classification.

         A future schema enhancement should introduce explicit
         account classification metadata.
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

      const cashAccounts:
        Array<{
          id: string;
          code: string;
          name: string;
          balance: number;
        }> = [];

      for (
        const account of accounts
      ) {
        if (
          account.type !==
          "ASSET"
        ) {
          continue;
        }

        const normalizedName =
          account.name
            .trim()
            .toLowerCase();

        const isCashAccount =
          cashKeywords.some(
            (keyword) =>
              normalizedName.includes(
                keyword
              )
          );

        if (!isCashAccount) {
          continue;
        }

        const balance =
          balanceMap.get(
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
          code: account.code,
          name: account.name,
          balance:
            round(
              signedBalance
            ),
        });
      }

      /* =======================================================
         CONTROL TOTALS
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

      /*
       * Journal integrity is intentionally independent from
       * the global GL/Trial Balance controls.
       *
       * A ledger can mathematically balance while still
       * containing structurally invalid journal lines.
       */
      const journalIntegrityPassed =
        unbalancedEntryCount === 0 &&
        missingLineEntryCount === 0 &&
        invalidAccountLineCount === 0 &&
        invalidLineCount === 0;

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
            journalControls.length,

          totalLines,

          exceptionCounts: {
            unbalancedEntries:
              getExceptionCount(
                unbalancedEntryCount
              ),

            missingLineEntries:
              getExceptionCount(
                missingLineEntryCount
              ),

            invalidAccountLines:
              getExceptionCount(
                invalidAccountLineCount
              ),

            invalidLines:
              getExceptionCount(
                invalidLineCount
              ),
          },

          unbalancedEntries,

          missingLineEntries,

          invalidAccountLines,

          invalidLines,

          exceptionSampleLimit:
            MAX_EXCEPTION_DETAILS,
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
           * This integrity control is cumulative through
           * the supplied asOfDate.
           *
           * It is NOT a date-range P&L report.
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
           * Control equation:
           *
           * Assets + Expenses
           * -
           * Liabilities - Equity - Revenue
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

          classification:
            "NAME_BASED_DIAGNOSTIC",

          authoritative:
            false,

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