import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   CONSTANTS
========================================================= */

const EFFECTIVE_STATUSES = ["POSTED", "APPROVED"] as const;

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const ACCOUNTING_TOLERANCE = 0.01;
const MAX_SEARCH_LENGTH = 100;
const ACCOUNT_TYPES = new Set([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
]);

/* =========================================================
   TYPES
========================================================= */

type TrialBalanceRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

type TrialBalanceDbRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number | null;
  credit: number | null;
};

type TrialBalanceTotals = {
  debit: number;
  credit: number;
  difference: number;
  balanced: boolean;
};

type ParsedQuery = {
  asOfDate: Date | null;
  search: string;
  accountType: string | null;
  fromAccount: string | null;
  toAccount: string | null;
  page: number;
  pageSize: number;
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
 * Converts a value to a finite number.
 *
 * Accounting responses should never expose NaN or Infinity.
 */
const toSafeNumber = (
  value: unknown
): number => {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return numericValue;
};

/**
 * Monetary rounding.
 *
 * The current schema uses Float, so we normalize
 * presentation/calculation values to two decimal places.
 */
const roundMoney = (
  value: number
): number => {
  return Math.round(
    (toSafeNumber(value) + Number.EPSILON) * 100
  ) / 100;
};

/**
 * Safely extracts a query-string value.
 */
const getQueryString = (
  value: unknown
): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0
      ? trimmed
      : null;
  }

  if (Array.isArray(value)) {
    const first = value[0];

    if (typeof first === "string") {
      const trimmed = first.trim();

      return trimmed.length > 0
        ? trimmed
        : null;
    }
  }

  return null;
};

/**
 * Parses a positive integer query parameter.
 */
const parsePositiveInteger = (
  value: unknown,
  defaultValue: number,
  maximum?: number
): number | null => {
  const raw = getQueryString(value);

  if (raw === null) {
    return defaultValue;
  }

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }

  if (
    maximum !== undefined &&
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
};

/**
 * Parses an accounting report date.
 *
 * YYYY-MM-DD is interpreted as the full calendar day.
 * ISO timestamps are also accepted.
 */
const parseAsOfDate = (
  value: unknown
): Date | null | "INVALID" => {
  const raw = getQueryString(value);

  if (!raw) {
    return null;
  }

  /*
   * Date-only input should represent the end of that
   * calendar day rather than midnight.
   */
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(
      `${raw}T23:59:59.999Z`
    );

    if (Number.isNaN(date.getTime())) {
      return "INVALID";
    }

    return date;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "INVALID";
  }

  /*
   * For timestamp input, respect the supplied timestamp.
   */
  return date;
};

/**
 * Escapes LIKE wildcard characters so a search term behaves
 * like a literal search string.
 */
const escapeLike = (
  value: string
): string => {
  return value.replace(
    /[\\%_]/g,
    (character) => `\\${character}`
  );
};

/**
 * Builds the parsed Trial Balance query.
 */
const parseQuery = (
  req: AuthRequest
): ParsedQuery | { error: string } => {
  const parsedDate = parseAsOfDate(
    req.query.asOfDate
  );

  if (parsedDate === "INVALID") {
    return {
      error:
        "Invalid asOfDate. Use YYYY-MM-DD or a valid ISO date.",
    };
  }

  const page = parsePositiveInteger(
    req.query.page,
    1
  );

  if (page === null) {
    return {
      error:
        "Invalid page. Page must be a positive integer.",
    };
  }

  const pageSize = parsePositiveInteger(
    req.query.pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  if (pageSize === null) {
    return {
      error:
        `Invalid pageSize. Use an integer between 1 and ${MAX_PAGE_SIZE}.`,
    };
  }

  const search =
    getQueryString(req.query.search) ?? "";

  if (search.length > MAX_SEARCH_LENGTH) {
    return {
      error:
        "Search text cannot exceed 100 characters.",
    };
  }

  const accountType =
    getQueryString(req.query.accountType);

  const fromAccount =
    getQueryString(req.query.fromAccount);

  const toAccount =
    getQueryString(req.query.toAccount);

  if (accountType && !ACCOUNT_TYPES.has(accountType.toUpperCase())) {
    return {
      error:
        "Invalid accountType. Use ASSET, LIABILITY, EQUITY, INCOME, or EXPENSE.",
    };
  }

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

  return {
    asOfDate: parsedDate,
    search,
    accountType: accountType?.toUpperCase() ?? null,
    fromAccount,
    toAccount,
    page,
    pageSize,
  };
};

/* =========================================================
   ACCOUNTING QUERY HELPERS
========================================================= */

/**
 * Builds the common tenant/account/date predicates.
 *
 * JournalEntryLine is the authoritative accounting source.
 *
 * Search is deliberately NOT included here because search
 * must not change the underlying accounting totals.
 */
const buildBaseConditions = (
  organizationId: string,
  asOfDate: Date | null,
  accountType: string | null,
  fromAccount: string | null,
  toAccount: string | null
) => {
  const statusList = Prisma.join(
    EFFECTIVE_STATUSES.map(
      (status) => Prisma.sql`${status}`
    )
  );

  const accountTypeCondition =
    accountType
      ? Prisma.sql`
          AND a."type" = ${accountType}
        `
      : Prisma.empty;

  const fromAccountCondition =
    fromAccount
      ? Prisma.sql`
          AND a."code" >= ${fromAccount}
        `
      : Prisma.empty;

  const toAccountCondition =
    toAccount
      ? Prisma.sql`
          AND a."code" <= ${toAccount}
        `
      : Prisma.empty;

  const asOfDateCondition =
    asOfDate
      ? Prisma.sql`
          AND je."transactionDate" <= ${asOfDate}
        `
      : Prisma.empty;

  return {
    statusList,
    accountTypeCondition,
    fromAccountCondition,
    toAccountCondition,
    asOfDateCondition,

    organizationCondition: Prisma.sql`
      je."organizationId" = ${organizationId}
    `,

    accountOrganizationCondition: Prisma.sql`
      a."organizationId" = ${organizationId}
    `,
  };
};

/**
 * Fetches the number of accounts and accounting totals
 * independently of pagination.
 */
const getAccountingTotals = async (
  organizationId: string,
  asOfDate: Date | null,
  accountType: string | null,
  fromAccount: string | null,
  toAccount: string | null,
  search: string
) => {
  const conditions = buildBaseConditions(
    organizationId,
    asOfDate,
    accountType,
    fromAccount,
    toAccount
  );

  const searchPattern = `%${escapeLike(search)}%`;

  const result = await prisma.$queryRaw<
    Array<{
      totalAccounts: bigint;
      totalDebit: number | null;
      totalCredit: number | null;

      filteredAccounts: bigint;
      filteredDebit: number | null;
      filteredCredit: number | null;
    }>
  >(Prisma.sql`
    WITH account_movements AS (
      SELECT
        a."id",
        a."code",
        a."name",
        a."type",

        COALESCE(
          SUM(jel."debit"),
          0
        ) AS debit,

        COALESCE(
          SUM(jel."credit"),
          0
        ) AS credit

      FROM "Account" a

      LEFT JOIN "JournalEntryLine" jel
        ON jel."accountId" = a."id"

      LEFT JOIN "JournalEntry" je
        ON je."id" = jel."journalEntryId"

      WHERE
        ${conditions.accountOrganizationCondition}

        AND (
          je."organizationId" = ${organizationId}
          OR je."id" IS NULL
        )

        AND (
          je."status" IN (${conditions.statusList})
          OR je."id" IS NULL
        )

        ${conditions.asOfDateCondition}

        ${conditions.accountTypeCondition}

        ${conditions.fromAccountCondition}

        ${conditions.toAccountCondition}

      GROUP BY
        a."id",
        a."code",
        a."name",
        a."type"
    )

    SELECT

      COUNT(*)::bigint
        AS "totalAccounts",

      COALESCE(
        SUM(
          CASE
            WHEN debit - credit > 0
              THEN debit - credit
            ELSE 0
          END
        ),
        0
      )::double precision
        AS "totalDebit",

      COALESCE(
        SUM(
          CASE
            WHEN credit - debit > 0
              THEN credit - debit
            ELSE 0
          END
        ),
        0
      )::double precision
        AS "totalCredit",

      COUNT(*) FILTER (
        WHERE
          (
            ${searchPattern} = '%%'
            OR "code" ILIKE ${searchPattern} ESCAPE '\\'
            OR "name" ILIKE ${searchPattern} ESCAPE '\\'
            OR "type" ILIKE ${searchPattern} ESCAPE '\\'
          )
      )::bigint
        AS "filteredAccounts",

      COALESCE(
        SUM(
          CASE
            WHEN debit - credit > 0
              THEN debit - credit
            ELSE 0
          END
        ) FILTER (
          WHERE
            (
              ${searchPattern} = '%%'
              OR "code" ILIKE ${searchPattern} ESCAPE '\\'
              OR "name" ILIKE ${searchPattern} ESCAPE '\\'
              OR "type" ILIKE ${searchPattern} ESCAPE '\\'
            )
        ),
        0
      )::double precision
        AS "filteredDebit",

      COALESCE(
        SUM(
          CASE
            WHEN credit - debit > 0
              THEN credit - debit
            ELSE 0
          END
        ) FILTER (
          WHERE
            (
              ${searchPattern} = '%%'
              OR "code" ILIKE ${searchPattern} ESCAPE '\\'
              OR "name" ILIKE ${searchPattern} ESCAPE '\\'
              OR "type" ILIKE ${searchPattern} ESCAPE '\\'
            )
        ),
        0
      )::double precision
        AS "filteredCredit"

    FROM account_movements
  `);

  return result[0] ?? {
    totalAccounts: BigInt(0),
    totalDebit: 0,
    totalCredit: 0,
    filteredAccounts: BigInt(0),
    filteredDebit: 0,
    filteredCredit: 0,
  };
};

/**
 * Fetches the requested page directly from PostgreSQL.
 *
 * Pagination happens after account balances have been
 * calculated, so the server never loads every account into
 * application memory.
 */
const getTrialBalancePage = async (
  organizationId: string,
  asOfDate: Date | null,
  accountType: string | null,
  fromAccount: string | null,
  toAccount: string | null,
  search: string,
  page: number,
  pageSize: number
): Promise<TrialBalanceDbRow[]> => {
  const conditions = buildBaseConditions(
    organizationId,
    asOfDate,
    accountType,
    fromAccount,
    toAccount
  );

  const searchPattern = `%${escapeLike(search)}%`;

  const offset =
    (page - 1) * pageSize;

  return prisma.$queryRaw<
    TrialBalanceDbRow[]
  >(Prisma.sql`
    WITH account_movements AS (
      SELECT
        a."id",
        a."code",
        a."name",
        a."type",

        COALESCE(
          SUM(jel."debit"),
          0
        ) AS debit,

        COALESCE(
          SUM(jel."credit"),
          0
        ) AS credit

      FROM "Account" a

      LEFT JOIN "JournalEntryLine" jel
        ON jel."accountId" = a."id"

      LEFT JOIN "JournalEntry" je
        ON je."id" = jel."journalEntryId"

      WHERE
        ${conditions.accountOrganizationCondition}

        AND (
          je."organizationId" = ${organizationId}
          OR je."id" IS NULL
        )

        AND (
          je."status" IN (${conditions.statusList})
          OR je."id" IS NULL
        )

        ${conditions.asOfDateCondition}

        ${conditions.accountTypeCondition}

        ${conditions.fromAccountCondition}

        ${conditions.toAccountCondition}

      GROUP BY
        a."id",
        a."code",
        a."name",
        a."type"
    ),

    trial_balance AS (
      SELECT
        "id",
        "code",
        "name",
        "type",

        ROUND(
          CASE
            WHEN debit - credit > 0
              THEN debit - credit
            ELSE 0
          END::numeric,
          2
        )::double precision AS debit,

        ROUND(
          CASE
            WHEN credit - debit > 0
              THEN credit - debit
            ELSE 0
          END::numeric,
          2
        )::double precision AS credit

      FROM account_movements
    )

    SELECT
      "id",
      "code",
      "name",
      "type",
      debit,
      credit,

      ROUND(
        (debit - credit)::numeric,
        2
      )::double precision AS balance

    FROM trial_balance

    WHERE
      (
        ${searchPattern} = '%%'
        OR "code" ILIKE ${searchPattern} ESCAPE '\\'
        OR "name" ILIKE ${searchPattern} ESCAPE '\\'
        OR "type" ILIKE ${searchPattern} ESCAPE '\\'
      )

    ORDER BY
      "code" ASC,
      "id" ASC

    LIMIT ${pageSize}
    OFFSET ${offset}
  `);
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
        message:
          "Authentication required.",
      });
    }

    /* =====================================================
       QUERY
    ===================================================== */

    const parsedQuery =
      parseQuery(req);

    if ("error" in parsedQuery) {
      return res.status(400).json({
        success: false,
        message: parsedQuery.error,
      });
    }

    const {
      asOfDate,
      search,
      accountType,
      fromAccount,
      toAccount,
      page,
      pageSize,
    } = parsedQuery;

    /* =====================================================
       DATABASE QUERIES

       Totals and page rows are calculated by PostgreSQL.
       No tenant-wide accounting history is loaded into Node.
    ===================================================== */

    const [
      totalsResult,
      pageRows,
    ] = await Promise.all([
      getAccountingTotals(
        organizationId,
        asOfDate,
        accountType,
        fromAccount,
        toAccount,
        search
      ),

      getTrialBalancePage(
        organizationId,
        asOfDate,
        accountType,
        fromAccount,
        toAccount,
        search,
        page,
        pageSize
      ),
    ]);

    /* =====================================================
       ACCOUNTING TOTALS
    ===================================================== */

    const totalDebit =
      roundMoney(
        toSafeNumber(
          totalsResult.totalDebit
        )
      );

    const totalCredit =
      roundMoney(
        toSafeNumber(
          totalsResult.totalCredit
        )
      );

    const difference =
      roundMoney(
        Math.abs(
          totalDebit -
          totalCredit
        )
      );

    const balanced =
      difference <=
      ACCOUNTING_TOLERANCE;

    /* =====================================================
       FILTERED TOTALS
    ===================================================== */

    const filteredDebit =
      roundMoney(
        toSafeNumber(
          totalsResult.filteredDebit
        )
      );

    const filteredCredit =
      roundMoney(
        toSafeNumber(
          totalsResult.filteredCredit
        )
      );

    const filteredDifference =
      roundMoney(
        Math.abs(
          filteredDebit -
          filteredCredit
        )
      );

    /* =====================================================
       RESPONSE ROWS
    ===================================================== */

    const trialBalance: TrialBalanceRow[] =
      pageRows.map((row) => {
        const debit =
          roundMoney(
            toSafeNumber(row.debit)
          );

        const credit =
          roundMoney(
            toSafeNumber(row.credit)
          );

        return {
          id: row.id,
          code: row.code,
          name: row.name,
          type: row.type,
          debit,
          credit,
          balance: roundMoney(
            debit - credit
          ),
        };
      });

    /* =====================================================
       PAGE TOTALS
    ===================================================== */

    const pageDebit =
      roundMoney(
        trialBalance.reduce(
          (sum, account) =>
            sum + account.debit,
          0
        )
      );

    const pageCredit =
      roundMoney(
        trialBalance.reduce(
          (sum, account) =>
            sum + account.credit,
          0
        )
      );

    const pageDifference =
      roundMoney(
        Math.abs(
          pageDebit -
          pageCredit
        )
      );

    /* =====================================================
       PAGINATION
    ===================================================== */

    const totalAccounts =
      Number(
        totalsResult.filteredAccounts ??
        0
      );

    const totalPages =
      totalAccounts === 0
        ? 0
        : Math.ceil(
            totalAccounts /
            pageSize
          );

    const hasNextPage =
      page < totalPages;

    const hasPreviousPage =
      page > 1 &&
      totalPages > 0;

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
        balanced,
      },

      filteredTotals: {
        debit: filteredDebit,
        credit: filteredCredit,
        difference:
          filteredDifference,
        balanced:
          filteredDifference <=
          ACCOUNTING_TOLERANCE,
      },

      pageTotals: {
        debit: pageDebit,
        credit: pageCredit,
        difference:
          pageDifference,
      },

      pagination: {
        page,
        pageSize,
        total:
          totalAccounts,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },

      filters: {
        asOfDate:
          asOfDate?.toISOString() ??
          null,
        search:
          search || null,
        accountType,
        fromAccount,
        toAccount,
      },

      meta: {
        organizationId,

        asOfDate:
          asOfDate?.toISOString() ??
          null,

        effectiveStatuses: [
          ...EFFECTIVE_STATUSES,
        ],

        accountingSource:
          "JournalEntryLine",

        currency: "KES",

        generatedAt:
          new Date().toISOString(),
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
        "Failed to generate trial balance.",
    });
  }
};
