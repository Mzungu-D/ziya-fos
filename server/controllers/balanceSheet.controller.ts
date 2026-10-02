import { Response } from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   CONSTANTS
========================================================= */

const TOLERANCE = 0.01;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const EFFECTIVE_STATUSES = [
  "POSTED",
  "APPROVED",
] as const;

const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;

type BalanceSheetAccountType =
  (typeof ACCOUNT_TYPES)[number];

/* =========================================================
   TYPES
========================================================= */

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AggregateRow {
  accountId: string;
  debit: number | bigint | null;
  credit: number | bigint | null;
}

interface ReportTotals {
  assets: number;
  liabilities: number;
  equity: number;
  currentNetIncome: number;
  totalEquityAndNetIncome: number;
  liabilitiesAndEquity: number;
  difference: number;
  balanced: boolean;
}

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

/**
 * Converts PostgreSQL aggregate values safely to numbers.
 *
 * PostgreSQL drivers can return COUNT/BIGINT-style values
 * as bigint depending on the query and driver configuration.
 */
const toNumber = (
  value: number | bigint | null | undefined
): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : 0;
};

/**
 * Prevents floating-point noise from appearing in
 * financial-report output.
 */
const roundMoney = (
  value: number
): number => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round(
    (numericValue + Number.EPSILON) * 100
  ) / 100;
};

/**
 * Parses the report date safely.
 *
 * YYYY-MM-DD is treated as the entire calendar day,
 * ending at 23:59:59.999.
 */
const parseReportDate = (
  value: unknown
): Date | null => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return new Date();
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(
      `${raw}T23:59:59.999Z`
    );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

/**
 * Escapes SQL LIKE wildcard characters so search remains literal.
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
 * Normalizes pagination input.
 */
const parsePagination = (
  pageValue: unknown,
  limitValue: unknown
):
  | {
      page: number;
      limit: number;
      skip: number;
    }
  | null => {
  const rawPage =
    pageValue === undefined ||
    pageValue === null ||
    String(pageValue).trim() === ""
      ? "1"
      : String(pageValue).trim();

  const rawLimit =
    limitValue === undefined ||
    limitValue === null ||
    String(limitValue).trim() === ""
      ? String(DEFAULT_PAGE_SIZE)
      : String(limitValue).trim();

  if (!/^\d+$/.test(rawPage) || !/^\d+$/.test(rawLimit)) {
    return null;
  }

  const page = Number(rawPage);
  const limit = Number(rawLimit);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE
  ) {
    return null;
  }

  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    return null;
  }

  return { page, limit, skip };
};

/**
 * Validates account type filters.
 */
const parseAccountType = (
  value: unknown
): BalanceSheetAccountType | null => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toUpperCase();

  if (
    !ACCOUNT_TYPES.includes(
      normalized as BalanceSheetAccountType
    )
  ) {
    return null;
  }

  return normalized as BalanceSheetAccountType;
};

/* =========================================================
   BALANCE SHEET
========================================================= */

export const getBalanceSheet = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* =====================================================
       TENANT CONTEXT
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
       REPORT PARAMETERS
    ===================================================== */

    const reportDate =
      parseReportDate(
        req.query.asOfDate
      );

    if (!reportDate) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid asOfDate. Use YYYY-MM-DD or a valid date.",
      });
    }

    const pagination =
      parsePagination(
        req.query.page,
        req.query.limit
      );

    if (!pagination) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid pagination. page must be a positive integer and limit must be between 1 and ${MAX_PAGE_SIZE}.`,
      });
    }

    const {
      page,
      limit,
      skip,
    } = pagination;

    const search =
      typeof req.query.search ===
      "string"
        ? req.query.search.trim()
        : "";

    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Search text cannot exceed 100 characters.",
      });
    }

    const accountType =
      parseAccountType(
        req.query.accountType
      );

    if (
      req.query.accountType !==
        undefined &&
      req.query.accountType !== null &&
      String(
        req.query.accountType
      ).trim() !== "" &&
      !accountType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid accountType.",
      });
    }

    /* =====================================================
       ACCOUNT FILTER
    ===================================================== */

    const accountWhere = {
      organizationId,

      type: {
        in: [
          "ASSET",
          "LIABILITY",
          "EQUITY",
          "INCOME",
          "EXPENSE",
        ],
      },

      ...(accountType
        ? {
            type: accountType,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                code: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    /* =====================================================
       COUNT ACCOUNTS
       
       Pagination must apply to the account rows,
       not to the financial calculations.
    ===================================================== */

    const totalAccounts =
      await prisma.account.count({
        where: accountWhere,
      });

    /* =====================================================
       PAGINATED ACCOUNTS
       
       Only tenant accounts are ever exposed.
    ===================================================== */

    const paginatedAccounts =
      await prisma.account.findMany({
        where: accountWhere,

        orderBy: [
          {
            code: "asc",
          },
          {
            id: "asc",
          },
        ],

        skip,
        take: limit,

        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      });

    /* =====================================================
       ALL REPORT ACCOUNTS
       
       Used for complete financial calculations.
       
       IMPORTANT:
       This query is NOT paginated.
       The user-visible account list is paginated,
       while the accounting totals are calculated over
       the entire tenant.
    ===================================================== */

    const allReportAccounts =
      await prisma.account.findMany({
        where: {
          organizationId,
          type: {
            in: [
              "ASSET",
              "LIABILITY",
              "EQUITY",
              "INCOME",
              "EXPENSE",
            ],
          },
        },

        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },

        orderBy: [
          {
            code: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    /* =====================================================
       ACCOUNT MOVEMENTS
       
       JournalEntryLine is authoritative.
       
       Aggregation happens in PostgreSQL instead of loading
       every journal entry and line into application memory.
    ===================================================== */

    const movementRows =
      await prisma.$queryRaw<AggregateRow[]>`
        SELECT
          jel."accountId" AS "accountId",

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
          ON je.id = jel."journalEntryId"

        INNER JOIN "Account" a
          ON a.id = jel."accountId"

        WHERE
          je."organizationId" = ${organizationId}

          AND je."status" IN (
            ${EFFECTIVE_STATUSES[0]},
            ${EFFECTIVE_STATUSES[1]}
          )

          AND je."transactionDate" <= ${reportDate}

          AND a."organizationId" = ${organizationId}

          AND a."type" IN (
            'ASSET',
            'LIABILITY',
            'EQUITY',
            'INCOME',
            'EXPENSE'
          )

        GROUP BY
          jel."accountId"
      `;

    /* =====================================================
       MOVEMENT MAP
    ===================================================== */

    const movementMap =
      new Map<
        string,
        {
          debit: number;
          credit: number;
        }
      >();

    for (const row of movementRows) {
      movementMap.set(
        row.accountId,
        {
          debit: toNumber(
            row.debit
          ),
          credit: toNumber(
            row.credit
          ),
        }
      );
    }

    /* =====================================================
       BUILD COMPLETE ACCOUNT BALANCES
       
       This contains all report accounts, regardless of
       pagination or search.
    ===================================================== */

    const allBalances: AccountBalance[] =
      allReportAccounts.map(
        (account) => {
          const movement =
            movementMap.get(
              account.id
            ) ?? {
              debit: 0,
              credit: 0,
            };

          let balance = 0;

          switch (account.type) {
            case "ASSET":
              balance =
                movement.debit -
                movement.credit;
              break;

            case "LIABILITY":
            case "EQUITY":
            case "INCOME":
              balance =
                movement.credit -
                movement.debit;
              break;

            case "EXPENSE":
              balance =
                movement.debit -
                movement.credit;
              break;

            default:
              balance = 0;
          }

          return {
            id: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            debit: roundMoney(
              movement.debit
            ),
            credit: roundMoney(
              movement.credit
            ),
            balance: roundMoney(
              balance
            ),
          };
        }
      );

    /* =====================================================
       BALANCE SHEET ACCOUNTS
    ===================================================== */

    const assets =
      allBalances.filter(
        (account) =>
          account.type ===
          "ASSET" &&
          Math.abs(
            account.balance
          ) >= TOLERANCE
      );

    const liabilities =
      allBalances.filter(
        (account) =>
          account.type ===
          "LIABILITY" &&
          Math.abs(
            account.balance
          ) >= TOLERANCE
      );

    const equity =
      allBalances.filter(
        (account) =>
          account.type ===
          "EQUITY" &&
          Math.abs(
            account.balance
          ) >= TOLERANCE
      );

    /* =====================================================
       CURRENT NET INCOME
       
       Revenue - Expenses
       
       NOTE:
       This is explicitly named currentNetIncome in the
       response. It is not falsely represented as a
       permanent retained-earnings account.
    ===================================================== */

    const revenue =
      allBalances
        .filter(
          (account) =>
            account.type ===
            "INCOME"
        )
        .reduce(
          (
            total,
            account
          ) =>
            total +
            account.balance,
          0
        );

    const expenses =
      allBalances
        .filter(
          (account) =>
            account.type ===
            "EXPENSE"
        )
        .reduce(
          (
            total,
            account
          ) =>
            total +
            account.balance,
          0
        );

    const currentNetIncome =
      roundMoney(
        revenue - expenses
      );

    /* =====================================================
       TOTALS
    ===================================================== */

    const totalAssets =
      roundMoney(
        assets.reduce(
          (
            total,
            account
          ) =>
            total +
            account.balance,
          0
        )
      );

    const totalLiabilities =
      roundMoney(
        liabilities.reduce(
          (
            total,
            account
          ) =>
            total +
            account.balance,
          0
        )
      );

    const totalEquity =
      roundMoney(
        equity.reduce(
          (
            total,
            account
          ) =>
            total +
            account.balance,
          0
        )
      );

    const totalEquityAndNetIncome =
      roundMoney(
        totalEquity +
        currentNetIncome
      );

    const liabilitiesAndEquity =
      roundMoney(
        totalLiabilities +
        totalEquityAndNetIncome
      );

    const difference =
      roundMoney(
        totalAssets -
          liabilitiesAndEquity
      );

    const balanced =
      Math.abs(difference) <= TOLERANCE;

    const postedEntries =
      await prisma.journalEntry.count({
        where: {
          organizationId,
          status: {
            in: [...EFFECTIVE_STATUSES],
          },
          transactionDate: {
            lte: reportDate,
          },
        },
      });

    /* =====================================================
       PAGINATED ACCOUNT ROWS
       
       IMPORTANT:
       Pagination is applied AFTER complete balances have
       been calculated.
       
       This prevents page totals from being mistaken for
       financial-statement totals.
    ===================================================== */

    const visibleAccountIds =
      new Set(
        paginatedAccounts.map(
          (account) =>
            account.id
        )
      );

    const paginatedBalances =
      allBalances.filter(
        (account) =>
          visibleAccountIds.has(
            account.id
          )
      );

    const paginatedAssets =
      paginatedBalances.filter(
        (account) =>
          account.type ===
            "ASSET" &&
          Math.abs(
            account.balance
          ) >= TOLERANCE
      );

    const paginatedLiabilities =
      paginatedBalances.filter(
        (account) =>
          account.type ===
            "LIABILITY" &&
          Math.abs(
            account.balance
          ) >= TOLERANCE
      );

    const paginatedEquity =
      paginatedBalances.filter(
        (account) =>
          account.type ===
            "EQUITY" &&
          Math.abs(
            account.balance
          ) >= TOLERANCE
      );

    /* =====================================================
       REPORT TOTALS
    ===================================================== */

    const totals: ReportTotals = {
      assets: totalAssets,
      liabilities:
        totalLiabilities,
      equity: totalEquity,
      currentNetIncome,
      totalEquityAndNetIncome,
      liabilitiesAndEquity,
      difference,
      balanced,
    };

    /* =====================================================
       PAGINATION METADATA
    ===================================================== */

    const totalPages =
      totalAccounts === 0
        ? 0
        : Math.ceil(
            totalAccounts /
              limit
          );

    const hasNextPage =
      page <
      totalPages;

    const hasPreviousPage =
      page > 1 &&
      totalPages > 0;

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      report: {
        name: "Balance Sheet",
        basis: "ACCRUAL",
        accountingSource: "JournalEntryLine",
        reportDate:
          reportDate.toISOString(),
        currency: "KES",
      },

      /* ===================================================
         PAGINATED ACCOUNT DATA
         
         These are the rows for the requested page.
      =================================================== */

      assets:
        paginatedAssets,

      liabilities:
        paginatedLiabilities,

      equity:
        paginatedEquity,

      /* ===================================================
         CURRENT NET INCOME
      =================================================== */

      currentNetIncome,

      /*
       * Backward-compatible alias.
       *
       * Existing frontend consumers may still expect
       * retainedEarnings.
       *
       * This is deliberately documented as current net
       * income until the accounting-period/closing engine
       * is introduced.
       */
      retainedEarnings:
        currentNetIncome,

      /* ===================================================
         FINANCIAL STATEMENT TOTALS
         
         These are ALWAYS for the entire report, not
         merely the current page.
      =================================================== */

      totals,

      pageTotals: {
        assets: roundMoney(
          paginatedAssets.reduce(
            (total, account) =>
              total + account.balance,
            0
          )
        ),
        liabilities: roundMoney(
          paginatedLiabilities.reduce(
            (total, account) =>
              total + account.balance,
            0
          )
        ),
        equity: roundMoney(
          paginatedEquity.reduce(
            (total, account) =>
              total + account.balance,
            0
          )
        ),
      },

      /* ===================================================
         RECONCILIATION
      =================================================== */

      reconciliation: {
        equation:
          "Assets = Liabilities + Equity + Current Net Income",

        assets: totalAssets,

        liabilities:
          totalLiabilities,

        equity:
          totalEquity,

        currentNetIncome,

        liabilitiesAndEquity:
          liabilitiesAndEquity,

        difference,

        balanced,

        tolerance: TOLERANCE,
      },

      /* ===================================================
         PAGINATION
      =================================================== */

      pagination: {
        page,
        limit,

        totalAccounts,

        totalPages,

        hasNextPage,
        hasPreviousPage,

        returnedAccounts:
          paginatedBalances.length,

        filters: {
          search:
            search || null,

          accountType:
            accountType || null,
        },
      },

      /* ===================================================
         META
      =================================================== */

      meta: {
        organizationId,

        asOfDate:
          reportDate.toISOString(),

        effectiveStatuses:
          [...EFFECTIVE_STATUSES],

        postedEntries,

        currency: "KES",

        generatedAt:
          new Date().toISOString(),

        source:
          "JournalEntryLine",

        accountingBasis:
          "ACCRUAL",

        paginationNote:
          "Account rows are paginated; financial totals are calculated across the complete tenant report dataset.",
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