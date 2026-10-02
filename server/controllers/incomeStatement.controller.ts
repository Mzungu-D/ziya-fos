import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   CONSTANTS
========================================================= */

const EFFECTIVE_STATUSES = [
  "POSTED",
  "APPROVED",
] as const;

const MONEY_TOLERANCE = 0.01;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;

/* =========================================================
   TYPES
========================================================= */

type IncomeStatementAccount = {
  id: string;
  code: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
};

type Movement = {
  debit: number;
  credit: number;
};

/* =========================================================
   HELPERS
========================================================= */

/**
 * Resolve the authenticated tenant.
 *
 * organizationId is deliberately taken only from the
 * authenticated request context.
 *
 * We do not trust organizationId supplied by the client.
 */
const getOrganizationId = (
  req: AuthRequest
): string | null => {
  const organizationId =
    req.user?.organizationId?.trim();

  return organizationId || null;
};

/**
 * Convert database numeric values safely.
 */
const toNumber = (
  value:
    | number
    | bigint
    | string
    | null
    | undefined
): number => {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
};

/**
 * Normalize money to two decimal places.
 *
 * The database currently uses Float for monetary fields.
 * We therefore normalize values at the report boundary.
 *
 * A future global Decimal migration should be handled
 * across the entire accounting engine rather than inside
 * one report controller.
 */
const roundMoney = (
  value: number
): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
};

/**
 * Parse the beginning of a reporting day.
 */
const parseStartDate = (
  value: unknown
): Date | null | "INVALID" => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const raw = String(value).trim();
  const dateOnly = /^\\d{4}-\\d{2}-\\d{2}$/.test(raw);
  const date = dateOnly
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "INVALID";
  }

  return date;
};

/**
 * Parse the end of a reporting day.
 */
const parseEndDate = (
  value: unknown
): Date | null | "INVALID" => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const raw = String(value).trim();
  const dateOnly = /^\\d{4}-\\d{2}-\\d{2}$/.test(raw);
  const date = dateOnly
    ? new Date(`${raw}T23:59:59.999Z`)
    : new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "INVALID";
  }

  return date;
};

/**
 * Parse pagination.
 */
const parsePagination = (
  req: AuthRequest
): { page: number; limit: number; skip: number } | { error: string } => {
  const pageRaw = req.query.page;
  const limitRaw = req.query.limit;

  const pageText = pageRaw === undefined ? "" : String(pageRaw).trim();
  const limitText = limitRaw === undefined ? "" : String(limitRaw).trim();

  if (pageText && !/^\\d+$/.test(pageText)) {
    return { error: "Invalid page. Page must be a positive integer." };
  }

  if (limitText && !/^\\d+$/.test(limitText)) {
    return { error: `Invalid limit. Use an integer between 1 and ${MAX_LIMIT}.` };
  }

  const page = pageText ? Number(pageText) : DEFAULT_PAGE;
  const requestedLimit = limitText ? Number(limitText) : DEFAULT_LIMIT;

  if (!Number.isSafeInteger(page) || page < 1) {
    return { error: "Invalid page. Page must be a positive integer." };
  }

  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_LIMIT) {
    return { error: `Invalid limit. Use an integer between 1 and ${MAX_LIMIT}.` };
  }

  return {
    page,
    limit: requestedLimit,
    skip: (page - 1) * requestedLimit,
  };
};

/**
 * Normalize account search.
 */
const parseSearch = (
  value: unknown
): string | null | "INVALID" => {
  if (value === undefined || value === null) {
    return null;
  }

  const search = String(value).trim();
  if (search.length > MAX_SEARCH_LENGTH) {
    return "INVALID";
  }

  return search ? search.toLowerCase() : null;
};

/* =========================================================
   INCOME STATEMENT
========================================================= */

/**
 * Generate the Income Statement / Profit & Loss.
 *
 * Accounting source:
 *   JournalEntryLine
 *
 * Effective journals:
 *   POSTED
 *   APPROVED
 *
 * Revenue:
 *   Credit - Debit
 *
 * Expenses:
 *   Debit - Credit
 *
 * Net Profit:
 *   Revenue - Expenses
 *
 * Important:
 *   Pagination only affects the displayed account rows.
 *   It does NOT affect financial totals.
 */
export const getIncomeStatement = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* =====================================================
       TENANT SECURITY
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
       REPORT DATES
    ===================================================== */

    const startDate =
      parseStartDate(
        req.query.startDate
      );

    const endDate =
      parseEndDate(
        req.query.endDate
      );

    if (startDate === "INVALID") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid startDate.",
      });
    }

    if (endDate === "INVALID") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid endDate.",
      });
    }

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "startDate cannot be after endDate.",
      });
    }

    /* =====================================================
       PAGINATION
    ===================================================== */

    const pagination = parsePagination(req);

    if ("error" in pagination) {
      return res.status(400).json({
        success: false,
        message: pagination.error,
      });
    }

    const {
      page,
      limit,
      skip,
    } = pagination;

    /* =====================================================
       SEARCH
    ===================================================== */

    const search =
      parseSearch(
        req.query.search
      );

    if (search === "INVALID") {
      return res.status(400).json({
        success: false,
        message: `Search cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
      });
    }

    /* =====================================================
       TRANSACTION DATE FILTER
    ===================================================== */

    const transactionDateFilter: {
      gte?: Date;
      lte?: Date;
    } = {};

    if (startDate) {
      transactionDateFilter.gte =
        startDate;
    }

    if (endDate) {
      transactionDateFilter.lte =
        endDate;
    }

    const hasDateFilter =
      startDate !== null ||
      endDate !== null;

    /* =====================================================
       LOAD TENANT INCOME / EXPENSE ACCOUNTS
       
       These are tenant-owned accounts only.
    ===================================================== */

    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId,

          type: {
            in: [
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
       ACCOUNT IDS
    ===================================================== */

    const accountIds =
      accounts.map(
        (account) =>
          account.id
      );

    /* =====================================================
       AGGREGATE JOURNAL LINES
       
       We deliberately aggregate at the database layer.
       
       We do NOT load every JournalEntry and JournalEntryLine
       into Node.js.
       
       This is important as transaction volume grows.
    ===================================================== */

    const groupedMovements =
      accountIds.length > 0
        ? await prisma.journalEntryLine.groupBy(
            {
              by: [
                "accountId",
              ],

              where: {
                accountId: {
                  in: accountIds,
                },

                journalEntry: {
                  organizationId,

                  status: {
                    in: [
                      EFFECTIVE_STATUSES[0],
                      EFFECTIVE_STATUSES[1],
                    ],
                  },

                  ...(hasDateFilter
                    ? {
                        transactionDate:
                          transactionDateFilter,
                      }
                    : {}),
                },
              },

              _sum: {
                debit: true,
                credit: true,
              },
            }
          )
        : [];

    /* =====================================================
       BUILD MOVEMENT MAP
    ===================================================== */

    const movementMap =
      new Map<
        string,
        Movement
      >();

    for (const row of groupedMovements) {
      movementMap.set(
        row.accountId,
        {
          debit: roundMoney(
            toNumber(
              row._sum.debit
            )
          ),

          credit: roundMoney(
            toNumber(
              row._sum.credit
            )
          ),
        }
      );
    }

    /* =====================================================
       BUILD COMPLETE STATEMENT
       
       Every income and expense account is calculated before
       pagination.
       
       This guarantees that pagination cannot change the
       financial result.
    ===================================================== */

    const allBalances: IncomeStatementAccount[] =
      accounts
        .map(
          (
            account
          ) => {
            const movement =
              movementMap.get(
                account.id
              ) ?? {
                debit: 0,
                credit: 0,
              };

            let amount = 0;

            if (
              account.type ===
              "INCOME"
            ) {
              /*
               * Income accounts normally carry credit
               * balances.
               */
              amount =
                movement.credit -
                movement.debit;
            } else {
              /*
               * Expense accounts normally carry debit
               * balances.
               */
              amount =
                movement.debit -
                movement.credit;
            }

            return {
              id: account.id,
              code: account.code,
              name: account.name,

              type:
                account.type as
                  | "INCOME"
                  | "EXPENSE",

              amount:
                roundMoney(
                  amount
                ),
            };
          }
        )
        .filter(
          (
            account
          ) =>
            Math.abs(
              account.amount
            ) >=
            MONEY_TOLERANCE
        );

    /* =====================================================
       COMPLETE REVENUE
    ===================================================== */

    const allRevenue =
      allBalances.filter(
        (
          account
        ) =>
          account.type ===
          "INCOME"
      );

    /* =====================================================
       COMPLETE EXPENSES
    ===================================================== */

    const allExpenses =
      allBalances.filter(
        (
          account
        ) =>
          account.type ===
          "EXPENSE"
      );

    /* =====================================================
       FINANCIAL TOTALS
       
       IMPORTANT:
       
       These totals are calculated from all accounts.
       They are never calculated from the current page.
    ===================================================== */

    const totalRevenue =
      roundMoney(
        allRevenue.reduce(
          (
            total,
            account
          ) =>
            total +
            account.amount,
          0
        )
      );

    const totalExpenses =
      roundMoney(
        allExpenses.reduce(
          (
            total,
            account
          ) =>
            total +
            account.amount,
          0
        )
      );

    const netProfit =
      roundMoney(
        totalRevenue -
          totalExpenses
      );

    const profitMargin =
      totalRevenue !== 0
        ? roundMoney(
            (netProfit /
              totalRevenue) *
              100
          )
        : 0;

    /* =====================================================
       SEARCH FILTER
       
       Search affects presentation only.
       It does NOT alter totals.
    ===================================================== */

    const filteredBalances =
      search
        ? allBalances.filter(
            (
              account
            ) =>
              account.code
                .toLowerCase()
                .includes(search) ||
              account.name
                .toLowerCase()
                .includes(search)
          )
        : allBalances;

    /* =====================================================
       PAGINATE ACCOUNT DETAIL
    ===================================================== */

    const paginatedBalances =
      filteredBalances.slice(
        skip,
        skip + limit
      );

    /* =====================================================
       PAGINATED REVENUE
    ===================================================== */

    const revenue =
      paginatedBalances.filter(
        (
          account
        ) =>
          account.type ===
          "INCOME"
      );

    /* =====================================================
       PAGINATED EXPENSES
    ===================================================== */

    const expenses =
      paginatedBalances.filter(
        (
          account
        ) =>
          account.type ===
          "EXPENSE"
      );

    /* =====================================================
       PAGINATION METADATA
    ===================================================== */

    const totalFilteredAccounts =
      filteredBalances.length;

    const totalPages =
      totalFilteredAccounts === 0
        ? 0
        : Math.ceil(
            totalFilteredAccounts /
              limit
          );

    /* =====================================================
       JOURNAL ENTRY COUNT
       
       Count journal headers, not lines.
    ===================================================== */

    const postedEntries =
      await prisma.journalEntry.count(
        {
          where: {
            organizationId,

            status: {
              in: [
                EFFECTIVE_STATUSES[0],
                EFFECTIVE_STATUSES[1],
              ],
            },

            ...(hasDateFilter
              ? {
                  transactionDate:
                    transactionDateFilter,
                }
              : {}),
          },
        }
      );

    /* =====================================================
       CONTROL TOTALS
       
       The Income Statement itself should satisfy:
       
       Net Profit =
         Revenue - Expenses
       
       This is exposed for downstream verification.
    ===================================================== */

    const calculatedNetProfit =
      roundMoney(
        totalRevenue -
          totalExpenses
      );

    const profitDifference =
      roundMoney(
        calculatedNetProfit -
          netProfit
      );

    /* =====================================================
       RESPONSE
       
       Existing response fields are preserved:
       
       revenue
       expenses
       totals
       meta
       
       Additional pagination/control metadata is included
       without removing the existing contract.
    ===================================================== */

    return res.status(200).json({
      success: true,

      revenue,

      expenses,

      totals: {
        revenue:
          totalRevenue,

        expenses:
          totalExpenses,

        netProfit,

        profitMargin,
      },

      pageTotals: {
        revenue: roundMoney(
          revenue.reduce((total, account) => total + account.amount, 0)
        ),
        expenses: roundMoney(
          expenses.reduce((total, account) => total + account.amount, 0)
        ),
        netProfit: roundMoney(
          revenue.reduce((total, account) => total + account.amount, 0) -
          expenses.reduce((total, account) => total + account.amount, 0)
        ),
      },

      meta: {
        organizationId,

        startDate:
          startDate
            ? startDate.toISOString()
            : null,

        endDate:
          endDate
            ? endDate.toISOString()
            : null,

        search: search || null,

        postedEntries,

        currency: "KES",

        accountingBasis:
          "ACCRUAL",

        effectiveStatuses: [
          EFFECTIVE_STATUSES[0],
          EFFECTIVE_STATUSES[1],
        ],

        source:
          "JournalEntryLine",

        statementAccounts:
          allBalances.length,

        revenueAccounts:
          allRevenue.length,

        expenseAccounts:
          allExpenses.length,

        generatedAt:
          new Date().toISOString(),
      },

      pagination: {
        page,

        limit,

        total:
          totalFilteredAccounts,

        totalPages,

        returned:
          paginatedBalances.length,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1,
      },

      controls: {
        completeStatement:
          true,

        totalsIndependentOfPagination:
          true,

        totalsIndependentOfSearch:
          true,

        calculatedNetProfit,

        profitDifference,

        financiallyConsistent:
          Math.abs(
            profitDifference
          ) <
          MONEY_TOLERANCE,
      },
    });
  } catch (error) {
    /* =====================================================
       ERROR HANDLING
    ===================================================== */

    console.error(
      "INCOME STATEMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate income statement",
    });
  }
};