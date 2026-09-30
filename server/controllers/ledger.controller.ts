import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   ACCOUNTING CONSTANTS
========================================================= */

/**
 * These are the statuses currently treated as effective
 * accounting entries throughout the FOS.
 *
 * IMPORTANT:
 * Do not change this list in isolation. Journal lifecycle,
 * Trial Balance, financial statements and accounting integrity
 * must all use the same accounting-status policy.
 */
const EFFECTIVE_STATUSES = [
  "POSTED",
  "APPROVED",
] as const;

/**
 * Monetary reconciliation tolerance.
 */
const TOLERANCE = 0.01;

/**
 * Pagination defaults.
 */
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Maximum search length accepted by the API.
 */
const MAX_SEARCH_LENGTH = 100;

/* =========================================================
   TYPES
========================================================= */

type BalanceSide =
  | "DEBIT"
  | "CREDIT"
  | "ZERO";

type LedgerLine = {
  id: string;
  journalId: string;

  date: Date;
  transactionDate: Date;

  reference: string;
  description: string;

  accountId: string;
  accountCode: string;
  account: string;
  accountType: string;

  debit: number;
  credit: number;

  balance: number;
  normalBalance: number;
  balanceSide: BalanceSide;

  status: string;

  createdBy: string | null;
  postedBy: string | null;
  approvedBy: string | null;
  reversedBy: string | null;

  reversalOfId: string | null;
  reversalReason: string | null;

  memo: string | null;
  lineNumber: number;

  counterpartyAccounts: Array<{
    accountId: string;
    accountCode: string;
    account: string;
  }>;
};

type RawLedgerRow = {
  id: string;
  journalId: string;

  transactionDate: Date;
  createdAt: Date;

  reference: string;
  description: string;

  accountId: string;
  accountCode: string;
  account: string;
  accountType: string;

  debit: number | null;
  credit: number | null;

  balance: number | null;

  status: string;

  createdBy: string | null;
  postedBy: string | null;
  approvedBy: string | null;
  reversedBy: string | null;

  reversalOfId: string | null;
  reversalReason: string | null;

  memo: string | null;
  lineNumber: number;

  counterpartyAccounts:
    | unknown
    | null;
};

type OpeningBalanceRow = {
  accountId: string;
  accountCode: string;
  account: string;
  accountType: string;
  balance: number | null;
};

type AccountBalanceRow = {
  accountId: string;
  accountCode: string;
  account: string;
  accountType: string;

  debit: number | null;
  credit: number | null;
};

type LedgerTotals = {
  debit: number;
  credit: number;
  difference: number;
  balanced: boolean;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type QueryOptions = {
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;

  accountType?: string;
  fromAccount?: string;
  toAccount?: string;

  page: number;
  pageSize: number;

  sortOrder: "asc" | "desc";
};

/* =========================================================
   TENANT CONTEXT
========================================================= */

function getTenantContext(
  req: AuthRequest
) {
  if (
    !req.user?.userId ||
    !req.user?.organizationId
  ) {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId:
      req.user.organizationId,
  };
}

/* =========================================================
   QUERY HELPERS
========================================================= */

function getQueryString(
  value: unknown
): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0
      ? trimmed
      : undefined;
  }

  if (Array.isArray(value)) {
    const first = value[0];

    if (typeof first === "string") {
      const trimmed = first.trim();

      return trimmed.length > 0
        ? trimmed
        : undefined;
    }
  }

  return undefined;
}

/**
 * Parse dates consistently.
 *
 * Date-only start dates use 00:00:00.000 UTC.
 * Date-only end dates use 23:59:59.999 UTC.
 */
function parseDate(
  value: unknown,
  endOfDay = false
): Date | undefined {
  const raw = getQueryString(value);

  if (!raw) {
    return undefined;
  }

  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(
          `${raw}T${
            endOfDay
              ? "23:59:59.999"
              : "00:00:00.000"
          }Z`
        )
      : new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return undefined;
  }

  return date;
}

/**
 * Parse positive integer query parameters.
 */
function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
  maximum?: number
): number | null {
  const raw = getQueryString(value);

  if (!raw) {
    return defaultValue;
  }

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return null;
  }

  if (
    maximum !== undefined &&
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

/**
 * Escape SQL LIKE wildcard characters.
 *
 * Search is deliberately treated as literal text rather
 * than allowing callers to inject arbitrary wildcard patterns.
 */
function escapeLike(
  value: string
): string {
  return value.replace(
    /[\\%_]/g,
    (character) =>
      `\\${character}`
  );
}

/* =========================================================
   MONEY HELPERS
========================================================= */

function toNumber(
  value: unknown
): number {
  const numericValue =
    Number(value ?? 0);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : 0;
}

function round(
  value: number
): number {
  const numericValue =
    toNumber(value);

  return Math.round(
    (numericValue +
      Number.EPSILON) *
      100
  ) / 100;
}

/**
 * Returns the normal-side representation of a balance.
 *
 * Assets and Expenses normally have debit balances.
 * Liabilities, Equity and Income normally have credit balances.
 */
function getNormalBalance(
  accountType: string,
  signedBalance: number
): number {
  if (
    [
      "LIABILITY",
      "EQUITY",
      "INCOME",
    ].includes(accountType)
  ) {
    return -signedBalance;
  }

  return signedBalance;
}

function getBalanceSide(
  signedBalance: number
): BalanceSide {
  if (
    Math.abs(signedBalance) <
    TOLERANCE
  ) {
    return "ZERO";
  }

  return signedBalance > 0
    ? "DEBIT"
    : "CREDIT";
}

/* =========================================================
   STATUS SQL
========================================================= */

function getStatusListSql() {
  return Prisma.join(
    EFFECTIVE_STATUSES.map(
      (status) =>
        Prisma.sql`${status}`
    )
  );
}

/* =========================================================
   COMMON SQL FILTERS
========================================================= */

function buildLedgerFilters(
  organizationId: string,
  options: QueryOptions
) {
  const statusList =
    getStatusListSql();

  const accountCondition =
    options.accountId
      ? Prisma.sql`
          AND jel."accountId" =
            ${options.accountId}
        `
      : Prisma.empty;

  const startDateCondition =
    options.startDate
      ? Prisma.sql`
          AND je."transactionDate" >=
            ${options.startDate}
        `
      : Prisma.empty;

  const endDateCondition =
    options.endDate
      ? Prisma.sql`
          AND je."transactionDate" <=
            ${options.endDate}
        `
      : Prisma.empty;

  const accountTypeCondition =
    options.accountType
      ? Prisma.sql`
          AND a."type" =
            ${options.accountType}
        `
      : Prisma.empty;

  const fromAccountCondition =
    options.fromAccount
      ? Prisma.sql`
          AND a."code" >=
            ${options.fromAccount}
        `
      : Prisma.empty;

  const toAccountCondition =
    options.toAccount
      ? Prisma.sql`
          AND a."code" <=
            ${options.toAccount}
        `
      : Prisma.empty;

  return {
    statusList,

    organizationCondition:
      Prisma.sql`
        je."organizationId" =
          ${organizationId}
      `,

    accountOrganizationCondition:
      Prisma.sql`
        a."organizationId" =
          ${organizationId}
      `,

    accountCondition,
    startDateCondition,
    endDateCondition,
    accountTypeCondition,
    fromAccountCondition,
    toAccountCondition,
  };
}

/* =========================================================
   OPENING BALANCES
========================================================= */

/**
 * Calculates opening balances before the requested period.
 *
 * Search is intentionally NOT applied.
 *
 * This is critical:
 *
 * A search box must not change the accounting opening balance.
 */
async function getOpeningBalances(
  organizationId: string,
  options: QueryOptions
): Promise<
  Map<
    string,
    OpeningBalanceRow
  >
> {
  if (!options.startDate) {
    return new Map();
  }

  const filters =
    buildLedgerFilters(
      organizationId,
      {
        ...options,
        startDate: undefined,
        endDate: undefined,
      }
    );

  const rows =
    await prisma.$queryRaw<
      OpeningBalanceRow[]
    >(Prisma.sql`
      SELECT
        jel."accountId" AS "accountId",

        a."code" AS "accountCode",

        a."name" AS "account",

        a."type" AS "accountType",

        ROUND(
          COALESCE(
            SUM(
              jel."debit" -
              jel."credit"
            ),
            0
          )::numeric,
          2
        )::double precision
          AS "balance"

      FROM "JournalEntryLine" jel

      INNER JOIN "JournalEntry" je
        ON je."id" =
           jel."journalEntryId"

      INNER JOIN "Account" a
        ON a."id" =
           jel."accountId"

       AND a."organizationId" =
           je."organizationId"

      WHERE
        ${filters.organizationCondition}

        AND je."status" IN (
          ${filters.statusList}
        )

        AND je."transactionDate" <
          ${options.startDate}

        ${filters.accountCondition}

        ${filters.accountTypeCondition}

        ${filters.fromAccountCondition}

        ${filters.toAccountCondition}

      GROUP BY
        jel."accountId",
        a."code",
        a."name",
        a."type"

      ORDER BY
        a."code" ASC,
        jel."accountId" ASC
    `);

  return new Map(
    rows.map((row) => [
      row.accountId,
      {
        ...row,
        balance: round(
          toNumber(row.balance)
        ),
      },
    ])
  );
}

/* =========================================================
   PERIOD ACCOUNT BALANCES
========================================================= */

/**
 * Returns debit/credit movement for each account in the
 * selected accounting period.
 *
 * Search is deliberately excluded.
 */
async function getPeriodAccountBalances(
  organizationId: string,
  options: QueryOptions
): Promise<
  AccountBalanceRow[]
> {
  const filters =
    buildLedgerFilters(
      organizationId,
      options
    );

  return prisma.$queryRaw<
    AccountBalanceRow[]
  >(Prisma.sql`
    SELECT
      jel."accountId" AS "accountId",

      a."code" AS "accountCode",

      a."name" AS "account",

      a."type" AS "accountType",

      ROUND(
        COALESCE(
          SUM(jel."debit"),
          0
        )::numeric,
        2
      )::double precision
        AS "debit",

      ROUND(
        COALESCE(
          SUM(jel."credit"),
          0
        )::numeric,
        2
      )::double precision
        AS "credit"

    FROM "JournalEntryLine" jel

    INNER JOIN "JournalEntry" je
      ON je."id" =
         jel."journalEntryId"

    INNER JOIN "Account" a
      ON a."id" =
         jel."accountId"

     AND a."organizationId" =
         je."organizationId"

    WHERE
      ${filters.organizationCondition}

      AND je."status" IN (
        ${filters.statusList}
      )

      ${filters.accountCondition}

      ${filters.startDateCondition}

      ${filters.endDateCondition}

      ${filters.accountTypeCondition}

      ${filters.fromAccountCondition}

      ${filters.toAccountCondition}

    GROUP BY
      jel."accountId",
      a."code",
      a."name",
      a."type"

    ORDER BY
      a."code" ASC,
      jel."accountId" ASC
  `);
}

/* =========================================================
   LEDGER TOTALS
========================================================= */

/**
 * Calculates accounting totals without loading ledger rows
 * into Node.
 *
 * "totals" are accounting totals for the selected period.
 * "filteredTotals" apply the search filter.
 */
async function getLedgerTotals(
  organizationId: string,
  options: QueryOptions
) {
  const filters =
    buildLedgerFilters(
      organizationId,
      options
    );

  const search =
    options.search ?? "";

  const searchPattern =
    `%${escapeLike(search)}%`;

  const rows =
    await prisma.$queryRaw<
      Array<{
        totalRows: bigint;

        totalDebit: number | null;
        totalCredit: number | null;

        filteredRows: bigint;

        filteredDebit:
          | number
          | null;

        filteredCredit:
          | number
          | null;
      }>
    >(Prisma.sql`
      WITH period_lines AS (
        SELECT
          jel."id" AS "lineId",

          jel."debit" AS "debit",

          jel."credit" AS "credit",

          je."reference" AS "reference",

          je."description" AS "description"

        FROM "JournalEntryLine" jel

        INNER JOIN "JournalEntry" je
          ON je."id" =
             jel."journalEntryId"

        INNER JOIN "Account" a
          ON a."id" =
             jel."accountId"

         AND a."organizationId" =
             je."organizationId"

        WHERE
          ${filters.organizationCondition}

          AND je."status" IN (
            ${filters.statusList}
          )

          ${filters.accountCondition}

          ${filters.startDateCondition}

          ${filters.endDateCondition}

          ${filters.accountTypeCondition}

          ${filters.fromAccountCondition}

          ${filters.toAccountCondition}
      )

      SELECT

        COUNT(*)::bigint
          AS "totalRows",

        ROUND(
          COALESCE(
            SUM("debit"),
            0
          )::numeric,
          2
        )::double precision
          AS "totalDebit",

        ROUND(
          COALESCE(
            SUM("credit"),
            0
          )::numeric,
          2
        )::double precision
          AS "totalCredit",

        COUNT(*) FILTER (
          WHERE
            ${search
              ? Prisma.sql`
                  (
                    "reference" ILIKE
                      ${searchPattern}
                      ESCAPE '\\'

                    OR

                    "description" ILIKE
                      ${searchPattern}
                      ESCAPE '\\'
                  )
                `
              : Prisma.sql`TRUE`}
        )::bigint
          AS "filteredRows",

        ROUND(
          COALESCE(
            SUM("debit") FILTER (
              WHERE
                ${search
                  ? Prisma.sql`
                      (
                        "reference" ILIKE
                          ${searchPattern}
                          ESCAPE '\\'

                        OR

                        "description" ILIKE
                          ${searchPattern}
                          ESCAPE '\\'
                      )
                    `
                  : Prisma.sql`TRUE`}
            ),
            0
          )::numeric,
          2
        )::double precision
          AS "filteredDebit",

        ROUND(
          COALESCE(
            SUM("credit") FILTER (
              WHERE
                ${search
                  ? Prisma.sql`
                      (
                        "reference" ILIKE
                          ${searchPattern}
                          ESCAPE '\\'

                        OR

                        "description" ILIKE
                          ${searchPattern}
                          ESCAPE '\\'
                      )
                    `
                  : Prisma.sql`TRUE`}
            ),
            0
          )::numeric,
          2
        )::double precision
          AS "filteredCredit"

      FROM period_lines
    `);

  return (
    rows[0] ?? {
      totalRows: BigInt(0),
      totalDebit: 0,
      totalCredit: 0,
      filteredRows: BigInt(0),
      filteredDebit: 0,
      filteredCredit: 0,
    }
  );
}

/* =========================================================
   PAGINATED LEDGER
========================================================= */

/**
 * Retrieves only the requested ledger page.
 *
 * The important accounting design is:
 *
 * 1. base_period contains ALL accounting lines.
 * 2. running_period calculates balances over ALL lines.
 * 3. search is applied AFTER running balances are calculated.
 * 4. pagination happens last.
 *
 * Therefore searching or moving to page 2 does not corrupt
 * the running balance.
 */
async function getLedgerPage(
  organizationId: string,
  options: QueryOptions
): Promise<RawLedgerRow[]> {
  const filters =
    buildLedgerFilters(
      organizationId,
      options
    );

  const search =
    options.search ?? "";

  const searchPattern =
    `%${escapeLike(search)}%`;

  const offset =
    (options.page - 1) *
    options.pageSize;

  const orderDirection =
    options.sortOrder === "desc"
      ? Prisma.sql`DESC`
      : Prisma.sql`ASC`;

  return prisma.$queryRaw<
    RawLedgerRow[]
  >(Prisma.sql`
    WITH base_period AS (

      SELECT

        jel."id" AS "lineId",

        jel."journalEntryId"
          AS "journalId",

        jel."accountId"
          AS "accountId",

        jel."lineNumber"
          AS "lineNumber",

        jel."memo"
          AS "memo",

        jel."debit"
          AS "debit",

        jel."credit"
          AS "credit",

        je."transactionDate"
          AS "transactionDate",

        je."createdAt"
          AS "createdAt",

        je."reference"
          AS "reference",

        je."description"
          AS "description",

        je."status"
          AS "status",

        je."createdBy"
          AS "createdBy",

        je."postedBy"
          AS "postedBy",

        je."approvedBy"
          AS "approvedBy",

        je."reversedBy"
          AS "reversedBy",

        je."reversalOfId"
          AS "reversalOfId",

        je."reversalReason"
          AS "reversalReason",

        a."code"
          AS "accountCode",

        a."name"
          AS "account",

        a."type"
          AS "accountType",

        a."organizationId"
          AS "accountOrganizationId"

      FROM "JournalEntryLine" jel

      INNER JOIN "JournalEntry" je
        ON je."id" =
           jel."journalEntryId"

      INNER JOIN "Account" a
        ON a."id" =
           jel."accountId"

       AND a."organizationId" =
           je."organizationId"

      WHERE
        ${filters.organizationCondition}

        AND je."status" IN (
          ${filters.statusList}
        )

        ${filters.accountCondition}

        ${filters.startDateCondition}

        ${filters.endDateCondition}

        ${filters.accountTypeCondition}

        ${filters.fromAccountCondition}

        ${filters.toAccountCondition}
    ),

    running_period AS (

      SELECT

        bp.*,

        ROUND(
          (
            COALESCE(
              (
                SELECT
                  SUM(
                    openingLine."debit" -
                    openingLine."credit"
                  )

                FROM "JournalEntryLine"
                  openingLine

                INNER JOIN "JournalEntry"
                  openingJournal
                  ON openingJournal."id" =
                     openingLine."journalEntryId"

                WHERE
                  openingJournal."organizationId" =
                    ${organizationId}

                  AND openingJournal."status" IN (
                    ${filters.statusList}
                  )

                  AND openingJournal."transactionDate" <
                    ${options.startDate ?? new Date(0)}

                  AND openingLine."accountId" =
                    bp."accountId"
              ),
              0
            )

            +

            SUM(
              bp."debit" -
              bp."credit"
            ) OVER (
              PARTITION BY
                bp."accountId"

              ORDER BY
                bp."transactionDate" ASC,
                bp."createdAt" ASC,
                bp."journalId" ASC,
                bp."lineNumber" ASC,
                bp."lineId" ASC

              ROWS BETWEEN
                UNBOUNDED PRECEDING
                AND CURRENT ROW
            )
          )::numeric,
          2
        )::double precision
          AS "balance"

      FROM base_period bp
    )

    SELECT

      rp."lineId"
        AS "id",

      rp."journalId"
        AS "journalId",

      rp."transactionDate"
        AS "transactionDate",

      rp."createdAt"
        AS "createdAt",

      rp."reference"
        AS "reference",

      rp."description"
        AS "description",

      rp."accountId"
        AS "accountId",

      rp."accountCode"
        AS "accountCode",

      rp."account"
        AS "account",

      rp."accountType"
        AS "accountType",

      ROUND(
        rp."debit"::numeric,
        2
      )::double precision
        AS "debit",

      ROUND(
        rp."credit"::numeric,
        2
      )::double precision
        AS "credit",

      rp."balance"
        AS "balance",

      rp."status"
        AS "status",

      rp."createdBy"
        AS "createdBy",

      rp."postedBy"
        AS "postedBy",

      rp."approvedBy"
        AS "approvedBy",

      rp."reversedBy"
        AS "reversedBy",

      rp."reversalOfId"
        AS "reversalOfId",

      rp."reversalReason"
        AS "reversalReason",

      rp."memo"
        AS "memo",

      rp."lineNumber"
        AS "lineNumber",

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'accountId',
                  counterLine."accountId",

                'accountCode',
                  counterAccount."code",

                'account',
                  counterAccount."name"
              )

              ORDER BY
                counterLine."lineNumber" ASC,
                counterLine."id" ASC
            )

          FROM "JournalEntryLine"
            counterLine

          INNER JOIN "Account"
            counterAccount

            ON counterAccount."id" =
               counterLine."accountId"

           AND counterAccount."organizationId" =
               ${organizationId}

          WHERE
            counterLine."journalEntryId" =
              rp."journalId"

            AND counterLine."accountId" <>
              rp."accountId"
        ),
        '[]'::jsonb
      )
        AS "counterpartyAccounts"

    FROM running_period rp

    WHERE
      ${
        search
          ? Prisma.sql`
              (
                rp."reference" ILIKE
                  ${searchPattern}
                  ESCAPE '\\'

                OR

                rp."description" ILIKE
                  ${searchPattern}
                  ESCAPE '\\'
              )
            `
          : Prisma.sql`TRUE`
      }

    ORDER BY
      rp."transactionDate"
        ${orderDirection},

      rp."createdAt"
        ${orderDirection},

      rp."journalId"
        ${orderDirection},

      rp."lineNumber"
        ${orderDirection},

      rp."lineId"
        ${orderDirection}

    LIMIT ${options.pageSize}

    OFFSET ${offset}
  `);
}

/* =========================================================
   ROW MAPPING
========================================================= */

function normalizeCounterparties(
  value: unknown
): Array<{
  accountId: string;
  accountCode: string;
  account: string;
}> {
  if (Array.isArray(value)) {
    return value
      .filter(
        (
          item
        ): item is {
          accountId: string;
          accountCode: string;
          account: string;
        } =>
          typeof item === "object" &&
          item !== null &&
          typeof (
            item as {
              accountId?: unknown;
            }
          ).accountId ===
            "string" &&
          typeof (
            item as {
              accountCode?: unknown;
            }
          ).accountCode ===
            "string" &&
          typeof (
            item as {
              account?: unknown;
            }
          ).account ===
            "string"
      )
      .map((item) => ({
        accountId:
          item.accountId,
        accountCode:
          item.accountCode,
        account:
          item.account,
      }));
  }

  if (typeof value === "string") {
    try {
      const parsed =
        JSON.parse(value);

      return normalizeCounterparties(
        parsed
      );
    } catch {
      return [];
    }
  }

  return [];
}

function mapLedgerRows(
  rows: RawLedgerRow[]
): LedgerLine[] {
  return rows.map((row) => {
    const debit =
      round(
        toNumber(row.debit)
      );

    const credit =
      round(
        toNumber(row.credit)
      );

    const balance =
      round(
        toNumber(row.balance)
      );

    return {
      id: row.id,
      journalId:
        row.journalId,

      date:
        row.transactionDate,

      transactionDate:
        row.transactionDate,

      reference:
        row.reference,

      description:
        row.description,

      accountId:
        row.accountId,

      accountCode:
        row.accountCode,

      account:
        row.account,

      accountType:
        row.accountType,

      debit,
      credit,

      balance,

      normalBalance:
        round(
          getNormalBalance(
            row.accountType,
            balance
          )
        ),

      balanceSide:
        getBalanceSide(
          balance
        ),

      status:
        row.status,

      createdBy:
        row.createdBy,

      postedBy:
        row.postedBy,

      approvedBy:
        row.approvedBy,

      reversedBy:
        row.reversedBy,

      reversalOfId:
        row.reversalOfId,

      reversalReason:
        row.reversalReason,

      memo:
        row.memo,

      lineNumber:
        row.lineNumber,

      counterpartyAccounts:
        normalizeCounterparties(
          row.counterpartyAccounts
        ),
    };
  });
}

/* =========================================================
   PAGINATION
========================================================= */

function buildPagination(
  page: number,
  pageSize: number,
  total: number
): Pagination {
  const totalPages =
    total === 0
      ? 0
      : Math.ceil(
          total /
            pageSize
        );

  return {
    page,
    pageSize,
    total,
    totalPages,

    hasNextPage:
      page < totalPages,

    hasPreviousPage:
      page > 1 &&
      totalPages > 0,
  };
}

/* =========================================================
   TOTAL HELPERS
========================================================= */

function buildTotals(
  debit: number,
  credit: number
): LedgerTotals {
  const normalizedDebit =
    round(debit);

  const normalizedCredit =
    round(credit);

  const difference =
    round(
      normalizedDebit -
        normalizedCredit
    );

  return {
    debit:
      normalizedDebit,

    credit:
      normalizedCredit,

    difference,

    balanced:
      Math.abs(difference) <=
      TOLERANCE,
  };
}

/* =========================================================
   QUERY VALIDATION
========================================================= */

function parseLedgerOptions(
  req: AuthRequest
):
  | {
      options: QueryOptions;
    }
  | {
      error: string;
    } {
  const startDate =
    parseDate(
      req.query.startDate
    );

  const endDate =
    parseDate(
      req.query.endDate,
      true
    );

  if (
    (
      getQueryString(
        req.query.startDate
      ) &&
      !startDate
    ) ||
    (
      getQueryString(
        req.query.endDate
      ) &&
      !endDate
    )
  ) {
    return {
      error:
        "Invalid startDate or endDate.",
    };
  }

  if (
    startDate &&
    endDate &&
    startDate > endDate
  ) {
    return {
      error:
        "startDate cannot be after endDate.",
    };
  }

  const page =
    parsePositiveInteger(
      req.query.page,
      DEFAULT_PAGE
    );

  if (page === null) {
    return {
      error:
        "Invalid page. Page must be a positive integer.",
    };
  }

  const pageSize =
    parsePositiveInteger(
      req.query.pageSize,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

  if (pageSize === null) {
    return {
      error:
        `Invalid pageSize. Use a value between 1 and ${MAX_PAGE_SIZE}.`,
    };
  }

  const accountId =
    getQueryString(
      req.query.accountId
    );

  const search =
    getQueryString(
      req.query.search
    );

  if (
    search &&
    search.length >
      MAX_SEARCH_LENGTH
  ) {
    return {
      error:
        `Search cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
    };
  }

  const accountType =
    getQueryString(
      req.query.accountType
    );

  const fromAccount =
    getQueryString(
      req.query.fromAccount
    );

  const toAccount =
    getQueryString(
      req.query.toAccount
    );

  if (
    fromAccount &&
    toAccount &&
    fromAccount > toAccount
  ) {
    return {
      error:
        "fromAccount cannot be greater than toAccount.",
    };
  }

  const sortOrderRaw =
    getQueryString(
      req.query.sortOrder
    ) ?? "asc";

  if (
    sortOrderRaw !== "asc" &&
    sortOrderRaw !== "desc"
  ) {
    return {
      error:
        "sortOrder must be either asc or desc.",
    };
  }

  return {
    options: {
      accountId,

      startDate,
      endDate,

      search,

      accountType,

      fromAccount,
      toAccount,

      page,
      pageSize,

      sortOrder:
        sortOrderRaw,
    },
  };
}

/* =========================================================
   ACCOUNT VALIDATION
========================================================= */

async function validateAccount(
  organizationId: string,
  accountId: string
) {
  return prisma.account.findFirst({
    where: {
      id: accountId,
      organizationId,
    },

    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      description: true,
    },
  });
}

/* =========================================================
   ALL LEDGER
========================================================= */

export const getAllLedger = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* =====================================================
       TENANT
    ===================================================== */

    const tenant =
      getTenantContext(req);

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    /* =====================================================
       QUERY
    ===================================================== */

    const parsed =
      parseLedgerOptions(req);

    if ("error" in parsed) {
      return res.status(400).json({
        success: false,
        message:
          parsed.error,
      });
    }

    const options =
      parsed.options;

    /* =====================================================
       ACCOUNT VALIDATION
    ===================================================== */

    if (options.accountId) {
      const account =
        await validateAccount(
          tenant.organizationId,
          options.accountId
        );

      if (!account) {
        return res.status(404).json({
          success: false,
          message:
            "Account not found.",
        });
      }
    }

    /* =====================================================
       PARALLEL ACCOUNTING QUERIES
    ===================================================== */

    const [
      openingBalances,
      periodAccounts,
      totalsResult,
      rawRows,
    ] = await Promise.all([
      getOpeningBalances(
        tenant.organizationId,
        options
      ),

      getPeriodAccountBalances(
        tenant.organizationId,
        options
      ),

      getLedgerTotals(
        tenant.organizationId,
        options
      ),

      getLedgerPage(
        tenant.organizationId,
        options
      ),
    ]);

    /* =====================================================
       PAGE ROWS
    ===================================================== */

    const ledgerEntries =
      mapLedgerRows(
        rawRows
      );

    /* =====================================================
       ACCOUNT BALANCES
    ===================================================== */

    const accountBalanceMap =
      new Map<
        string,
        {
          accountId: string;
          accountCode: string;
          account: string;
          accountType: string;

          openingBalance: number;

          debit: number;
          credit: number;

          balance: number;
        }
      >();

    for (
      const opening of
        openingBalances.values()
    ) {
      accountBalanceMap.set(
        opening.accountId,
        {
          accountId:
            opening.accountId,

          accountCode:
            opening.accountCode,

          account:
            opening.account,

          accountType:
            opening.accountType,

          openingBalance:
            round(
              toNumber(
                opening.balance
              )
            ),

          debit: 0,
          credit: 0,

          balance:
            round(
              toNumber(
                opening.balance
              )
            ),
        }
      );
    }

    for (
      const period of
        periodAccounts
    ) {
      const existing =
        accountBalanceMap.get(
          period.accountId
        );

      const openingBalance =
        existing?.openingBalance ??
        0;

      const debit =
        round(
          toNumber(
            period.debit
          )
        );

      const credit =
        round(
          toNumber(
            period.credit
          )
        );

      accountBalanceMap.set(
        period.accountId,
        {
          accountId:
            period.accountId,

          accountCode:
            period.accountCode,

          account:
            period.account,

          accountType:
            period.accountType,

          openingBalance:
            round(
              openingBalance
            ),

          debit,
          credit,

          balance:
            round(
              openingBalance +
                debit -
                credit
            ),
        }
      );
    }

    const accountBalances =
      [
        ...accountBalanceMap.values(),
      ].sort(
        (a, b) =>
          a.accountCode.localeCompare(
            b.accountCode,
            undefined,
            {
              numeric: true,
            }
          )
      );

    /* =====================================================
       OPENING BALANCES RESPONSE
    ===================================================== */

    const openingBalanceResponse =
      [
        ...openingBalances.values(),
      ].map((item) => ({
        accountId:
          item.accountId,

        accountCode:
          item.accountCode,

        account:
          item.account,

        accountType:
          item.accountType,

        balance:
          round(
            toNumber(
              item.balance
            )
          ),
      }));

    /* =====================================================
       ACCOUNTING TOTALS
    ===================================================== */

    const totalDebit =
      round(
        toNumber(
          totalsResult.totalDebit
        )
      );

    const totalCredit =
      round(
        toNumber(
          totalsResult.totalCredit
        )
      );

    const filteredDebit =
      round(
        toNumber(
          totalsResult.filteredDebit
        )
      );

    const filteredCredit =
      round(
        toNumber(
          totalsResult.filteredCredit
        )
      );

    const pageDebit =
      round(
        ledgerEntries.reduce(
          (sum, row) =>
            sum + row.debit,
          0
        )
      );

    const pageCredit =
      round(
        ledgerEntries.reduce(
          (sum, row) =>
            sum + row.credit,
          0
        )
      );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      organizationId:
        tenant.organizationId,

      entries:
        ledgerEntries,

      openingBalances:
        openingBalanceResponse,

      accountBalances,

      totals:
        buildTotals(
          totalDebit,
          totalCredit
        ),

      filteredTotals:
        buildTotals(
          filteredDebit,
          filteredCredit
        ),

      pageTotals:
        buildTotals(
          pageDebit,
          pageCredit
        ),

      pagination:
        buildPagination(
          options.page,
          options.pageSize,
          Number(
            totalsResult.filteredRows ??
              0
          )
        ),

      filters: {
        accountId:
          options.accountId ??
          null,

        accountType:
          options.accountType ??
          null,

        fromAccount:
          options.fromAccount ??
          null,

        toAccount:
          options.toAccount ??
          null,

        startDate:
          options.startDate
            ?.toISOString() ??
          null,

        endDate:
          options.endDate
            ?.toISOString() ??
          null,

        search:
          options.search ??
          null,

        sortOrder:
          options.sortOrder,
      },

      meta: {
        effectiveStatuses: [
          ...EFFECTIVE_STATUSES,
        ],

        source:
          "JournalEntryLine",

        currency:
          "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "GENERAL LEDGER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch general ledger.",
    });
  }
};

/* =========================================================
   SINGLE ACCOUNT LEDGER
========================================================= */

export const getLedger = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* =====================================================
       TENANT
    ===================================================== */

    const tenant =
      getTenantContext(req);

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    /* =====================================================
       ACCOUNT
    ===================================================== */

    const accountId =
      getQueryString(
        req.params.accountId
      );

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message:
          "Account ID is required.",
      });
    }

    const account =
      await validateAccount(
        tenant.organizationId,
        accountId
      );

    if (!account) {
      return res.status(404).json({
        success: false,
        message:
          "Account not found.",
      });
    }

    /* =====================================================
       QUERY
    ===================================================== */

    const parsed =
      parseLedgerOptions(req);

    if ("error" in parsed) {
      return res.status(400).json({
        success: false,
        message:
          parsed.error,
      });
    }

    const options: QueryOptions = {
      ...parsed.options,
      accountId,
    };

    /* =====================================================
       ACCOUNTING QUERIES
    ===================================================== */

    const [
      openingBalances,
      totalsResult,
      rawRows,
    ] = await Promise.all([
      getOpeningBalances(
        tenant.organizationId,
        options
      ),

      getLedgerTotals(
        tenant.organizationId,
        options
      ),

      getLedgerPage(
        tenant.organizationId,
        options
      ),
    ]);

    /* =====================================================
       OPENING BALANCE
    ===================================================== */

    const openingBalance =
      round(
        toNumber(
          openingBalances.get(
            accountId
          )?.balance
        )
      );

    /* =====================================================
       LEDGER ROWS
    ===================================================== */

    const ledgerEntries =
      mapLedgerRows(
        rawRows
      );

    /* =====================================================
       PERIOD TOTALS
    ===================================================== */

    const totalDebit =
      round(
        toNumber(
          totalsResult.totalDebit
        )
      );

    const totalCredit =
      round(
        toNumber(
          totalsResult.totalCredit
        )
      );

    const filteredDebit =
      round(
        toNumber(
          totalsResult.filteredDebit
        )
      );

    const filteredCredit =
      round(
        toNumber(
          totalsResult.filteredCredit
        )
      );

    const pageDebit =
      round(
        ledgerEntries.reduce(
          (sum, row) =>
            sum + row.debit,
          0
        )
      );

    const pageCredit =
      round(
        ledgerEntries.reduce(
          (sum, row) =>
            sum + row.credit,
          0
        )
      );

    const closingBalance =
      round(
        openingBalance +
          totalDebit -
          totalCredit
      );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      organizationId:
        tenant.organizationId,

      account,

      entries:
        ledgerEntries,

      openingBalance,

      closingBalance,

      totals: {
        debit:
          totalDebit,

        credit:
          totalCredit,

        balance:
          closingBalance,

        movement:
          round(
            totalDebit -
              totalCredit
          ),
      },

      filteredTotals: {
        debit:
          filteredDebit,

        credit:
          filteredCredit,

        movement:
          round(
            filteredDebit -
              filteredCredit
          ),
      },

      pageTotals: {
        debit:
          pageDebit,

        credit:
          pageCredit,

        movement:
          round(
            pageDebit -
              pageCredit
          ),
      },

      pagination:
        buildPagination(
          options.page,
          options.pageSize,
          Number(
            totalsResult.filteredRows ??
              0
          )
        ),

      filters: {
        startDate:
          options.startDate
            ?.toISOString() ??
          null,

        endDate:
          options.endDate
            ?.toISOString() ??
          null,

        search:
          options.search ??
          null,

        sortOrder:
          options.sortOrder,
      },

      meta: {
        effectiveStatuses: [
          ...EFFECTIVE_STATUSES,
        ],

        source:
          "JournalEntryLine",

        currency:
          "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "ACCOUNT LEDGER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch ledger.",
    });
  }
};