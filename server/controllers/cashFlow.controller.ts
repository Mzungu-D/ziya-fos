import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   TYPES
========================================================= */

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

type DateFilter = {
  gte?: Date;
  lte?: Date;
};

type CashBalanceAggregateRow = {
  balance: unknown;
};

type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

/* =========================================================
   CONSTANTS
========================================================= */

const EFFECTIVE_STATUSES = [
  "POSTED",
  "APPROVED",
] as const;

const TOLERANCE = 0.01;

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

const toNumber = (
  value: unknown
): number => {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : 0;
};

const roundMoney = (
  value: number
): number => {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
};

const normalize = (
  value: string
): string => {
  return value
    .trim()
    .toLowerCase();
};

const containsAny = (
  value: string,
  keywords: string[]
): boolean => {
  const normalized =
    normalize(value);

  return keywords.some(
    (keyword) =>
      normalized.includes(
        keyword
      )
  );
};

/* =========================================================
   DATE FILTER
========================================================= */

const parseDateOnly = (
  raw: string,
  endOfDay: boolean
): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(
    `${raw}T${
      endOfDay
        ? "23:59:59.999"
        : "00:00:00.000"
    }Z`
  );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
};

const getDateFilter = (
  startDate?: unknown,
  endDate?: unknown
): DateFilter => {
  const dateFilter: DateFilter = {};

  if (
    startDate !== undefined &&
    startDate !== null &&
    String(startDate).trim() !== ""
  ) {
    const raw =
      String(startDate).trim();

    const parsed =
      parseDateOnly(
        raw,
        false
      ) ?? new Date(raw);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      throw new Error(
        "INVALID_START_DATE"
      );
    }

    dateFilter.gte = parsed;
  }

  if (
    endDate !== undefined &&
    endDate !== null &&
    String(endDate).trim() !== ""
  ) {
    const raw =
      String(endDate).trim();

    const parsed =
      parseDateOnly(
        raw,
        true
      ) ?? new Date(raw);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      throw new Error(
        "INVALID_END_DATE"
      );
    }

    dateFilter.lte = parsed;
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
   PAGINATION
========================================================= */

/**
 * Express query parameters can technically contain
 * string arrays depending on the incoming request.
 *
 * Cash-flow pagination must only accept a single scalar
 * string value. This prevents ambiguous requests such as:
 *
 * ?page=1&page=2
 *
 * from being silently converted and interpreted incorrectly.
 */
const getQueryString = (
  value: unknown
): string | null => {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
};

const getPagination = (
  req: AuthRequest
): Pagination | null => {
  const pageValue =
    req.query.page;

  const limitValue =
    req.query.limit ??
    req.query.pageSize;

  const rawPage =
    pageValue === undefined
      ? "1"
      : getQueryString(
          pageValue
        );

  const rawLimit =
    limitValue === undefined
      ? String(
          DEFAULT_PAGE_SIZE
        )
      : getQueryString(
          limitValue
        );

  if (
    rawPage === null ||
    rawLimit === null
  ) {
    return null;
  }

  /*
   * Only unsigned decimal integers are
   * accepted here.
   */
  if (
    !/^\d+$/.test(rawPage) ||
    !/^\d+$/.test(rawLimit)
  ) {
    return null;
  }

  const page =
    Number(rawPage);

  const limit =
    Number(rawLimit);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE
  ) {
    return null;
  }

  const skip =
    (page - 1) * limit;

  if (
    !Number.isSafeInteger(
      skip
    )
  ) {
    return null;
  }

  return {
    page,
    limit,
    skip,
  };
};

/* =========================================================
   CASH FLOW CLASSIFICATION
========================================================= */

/*
 * Current schema does not contain an explicit
 * cash-flow classification field on Account.
 *
 * Therefore this controller retains the existing
 * classification rules while keeping them centralized.
 *
 * Long-term production improvement:
 * add explicit cash-flow metadata to Account
 * rather than relying on account-name heuristics.
 */

const classifyCashFlow = (
  account: {
    code: string;
    name: string;
    type: string;
  }
): CashFlowCategory => {
  const accountName =
    normalize(
      account.name
    );

  const accountCode =
    normalize(
      account.code
    );

  const accountType =
    normalize(
      account.type
    );

  /* =====================================================
     INVESTING
  ===================================================== */

  if (
    containsAny(
      accountName,
      [
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
      ]
    )
  ) {
    return "INVESTING";
  }

  /* =====================================================
     FINANCING
  ===================================================== */

  if (
    containsAny(
      accountName,
      [
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
      ]
    )
  ) {
    return "FINANCING";
  }

  if (
    accountType ===
      "equity" &&
    !containsAny(
      accountName,
      [
        "retained earnings",
        "current year earnings",
        "current year profit",
        "accumulated profit",
        "accumulated loss",
      ]
    )
  ) {
    return "FINANCING";
  }

  /*
   * Preserve the existing account-code
   * fallback for long-term asset classes.
   */
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
   BUILD SECTION
========================================================= */

const buildSection = (
  items: CashFlowItem[],
  category: CashFlowCategory
) => {
  const categoryItems =
    items.filter(
      (item) =>
        item.category ===
        category
    );

  const inflows =
    categoryItems
      .filter(
        (item) =>
          item.direction ===
          "INFLOW"
      )
      .reduce(
        (total, item) =>
          total +
          item.amount,
        0
      );

  const outflows =
    categoryItems
      .filter(
        (item) =>
          item.direction ===
          "OUTFLOW"
      )
      .reduce(
        (total, item) =>
          total +
          item.amount,
        0
      );

  return {
    items:
      categoryItems,

    inflows:
      roundMoney(
        inflows
      ),

    outflows:
      roundMoney(
        outflows
      ),

    netCashFlow:
      roundMoney(
        inflows -
        outflows
      ),
  };
};

/* =========================================================
   CASH FLOW STATEMENT
========================================================= */

export const getCashFlow = async (
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
       DATE FILTER
    ===================================================== */

    const {
      startDate,
      endDate,
    } = req.query;

    let dateFilter: DateFilter;

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
       PAGINATION
    ===================================================== */

    const pagination =
      getPagination(req);

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
    } = pagination;

    /* =====================================================
       SEARCH
    ===================================================== */

    const search =
      typeof req.query.search ===
      "string"
        ? req.query.search.trim()
        : "";

    if (
      search.length >
      MAX_SEARCH_LENGTH
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Search text cannot exceed ${MAX_SEARCH_LENGTH} characters.`,
      });
    }

    const normalizedSearch =
      search.toLowerCase();

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

        orderBy: [
          {
            code: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    const accountMap =
      new Map(
        accounts.map(
          (account) => [
            account.id,
            account,
          ]
        )
      );

    /* =====================================================
       CASH ACCOUNTS
    ===================================================== */

    const cashAccounts =
      accounts.filter(
        (account) =>
          account.type ===
            "ASSET" &&
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
      cashAccounts.map(
        (account) =>
          account.id
      );

    /* =====================================================
       NO CASH ACCOUNTS
    ===================================================== */

    if (
      cashAccountIds.length ===
      0
    ) {
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

        pagination: {
          page,
          limit,
          totalRecords: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },

        meta: {
          organizationId,

          startDate:
            dateFilter.gte
              ?.toISOString() ??
            null,

          endDate:
            dateFilter.lte
              ?.toISOString() ??
            null,

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
       OPENING CASH BALANCE

       Opening balance is the balance of all cash accounts
       before the requested reporting period.

       This is aggregated in PostgreSQL instead of loading
       the entire historical ledger into Node.
    ===================================================== */

    let openingCashBalance =
      0;

    if (dateFilter.gte) {
      const openingRows =
        await prisma.$queryRaw<
          CashBalanceAggregateRow[]
        >`
          SELECT
            COALESCE(
              SUM(
                jel."debit" -
                jel."credit"
              ),
              0
            ) AS "balance"

          FROM "JournalEntryLine" jel

          INNER JOIN "JournalEntry" je
            ON je.id =
              jel."journalEntryId"

          WHERE
            je."organizationId" =
              ${organizationId}

            AND je."status" IN (
              ${Prisma.join(
                EFFECTIVE_STATUSES
              )}
            )

            AND je."transactionDate" <
              ${dateFilter.gte}

            AND jel."accountId" IN (
              ${Prisma.join(
                cashAccountIds
              )}
            )
        `;

      openingCashBalance =
        toNumber(
          openingRows[0]?.balance
        );
    }

    /* =====================================================
       PERIOD JOURNAL ENTRIES

       Only entries that can contribute to the requested
       reporting period are loaded.
    ===================================================== */

    const periodEntries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId,

          status: {
            in: [
              ...EFFECTIVE_STATUSES,
            ],
          },

          ...(dateFilter.gte ||
          dateFilter.lte
            ? {
                transactionDate: {
                  ...(dateFilter.gte
                    ? {
                        gte:
                          dateFilter.gte,
                      }
                    : {}),

                  ...(dateFilter.lte
                    ? {
                        lte:
                          dateFilter.lte,
                      }
                    : {}),
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
              id: true,
              lineNumber: true,
              accountId: true,
              debit: true,
              credit: true,
            },

            orderBy: {
              lineNumber: "asc",
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

    /* =====================================================
       CASH FLOW ITEMS

       JournalEntryLine is the authoritative accounting
       source.

       For multi-line journals, cash movement is allocated
       across non-cash counterpart lines proportionally.
    ===================================================== */

    const allCashFlowItems:
      CashFlowItem[] = [];

    for (
      const entry of
        periodEntries
    ) {
      const cashLines =
        entry.lines.filter(
          (line) =>
            cashAccountIds.includes(
              line.accountId
            )
        );

      const counterpartLines =
        entry.lines.filter(
          (line) =>
            !cashAccountIds.includes(
              line.accountId
            )
        );

      if (
        cashLines.length ===
          0 ||
        counterpartLines.length ===
          0
      ) {
        continue;
      }

      for (
        const cashLine of
        cashLines
      ) {
        const cashMovement =
          toNumber(
            cashLine.debit
          ) -
          toNumber(
            cashLine.credit
          );

        if (
          Math.abs(
            cashMovement
          ) < 0.000001
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

        const counterpartMagnitudes =
          counterpartLines.map(
            (line) =>
              Math.abs(
                toNumber(
                  line.debit
                ) -
                toNumber(
                  line.credit
                )
              )
          );

        const totalCounterpartMagnitude =
          counterpartMagnitudes.reduce(
            (
              total,
              value
            ) =>
              total + value,
            0
          );

        if (
          totalCounterpartMagnitude <=
          0
        ) {
          continue;
        }

        let allocatedAmount =
          0;

        const meaningfulCounterparts =
          counterpartLines.filter(
            (line) =>
              Math.abs(
                toNumber(
                  line.debit
                ) -
                toNumber(
                  line.credit
                )
              ) > 0
          );

        for (
          let index = 0;
          index <
          meaningfulCounterparts.length;
          index += 1
        ) {
          const counterpartLine =
            meaningfulCounterparts[
              index
            ];

          const counterpartMovement =
            toNumber(
              counterpartLine.debit
            ) -
            toNumber(
              counterpartLine.credit
            );

          const magnitude =
            Math.abs(
              counterpartMovement
            );

          if (
            magnitude <= 0
          ) {
            continue;
          }

          /*
           * Allocate the residual amount to the final
           * counterpart so rounding does not create a
           * reconciliation difference.
           */
          let amount: number;

          if (
            index ===
            meaningfulCounterparts.length -
              1
          ) {
            amount =
              Math.max(
                0,
                Math.abs(
                  cashMovement
                ) -
                  allocatedAmount
              );
          } else {
            amount =
              Math.abs(
                cashMovement
              ) *
              (
                magnitude /
                totalCounterpartMagnitude
              );

            amount =
              roundMoney(
                amount
              );

            allocatedAmount +=
              amount;
          }

          if (
            amount <= 0
          ) {
            continue;
          }

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

          allCashFlowItems.push({
            id:
              `${entry.id}-${cashLine.id}-${counterpartLine.id}`,

            reference:
              entry.reference,

            description:
              entry.description,

            transactionDate:
              entry.transactionDate,

            category,

            direction,

            amount:
              roundMoney(
                amount
              ),

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
       COMPLETE FINANCIAL TOTALS

       These totals intentionally use ALL cash-flow items.

       Pagination and search affect the displayed detail
       records, but must not change the underlying financial
       totals.
    ===================================================== */

    const completeOperatingActivities =
      buildSection(
        allCashFlowItems,
        "OPERATING"
      );

    const completeInvestingActivities =
      buildSection(
        allCashFlowItems,
        "INVESTING"
      );

    const completeFinancingActivities =
      buildSection(
        allCashFlowItems,
        "FINANCING"
      );

    const completeNetIncreaseDecrease =
      roundMoney(
        completeOperatingActivities.netCashFlow +
        completeInvestingActivities.netCashFlow +
        completeFinancingActivities.netCashFlow
      );

    const closingCashBalance =
      roundMoney(
        openingCashBalance +
        completeNetIncreaseDecrease
      );

    /* =====================================================
       SEARCH

       Search only affects displayed detail rows.
       It does not alter accounting totals.
    ===================================================== */

    const filteredCashFlowItems =
      normalizedSearch
        ? allCashFlowItems.filter(
            (item) => {
              const searchableText =
                [
                  item.reference,
                  item.description,
                  item.category,
                  item.direction,
                  item.cashAccount
                    .code,
                  item.cashAccount
                    .name,
                  item.counterpartAccount
                    .code,
                  item.counterpartAccount
                    .name,
                  item.counterpartAccount
                    .type,
                ]
                  .join(" ")
                  .toLowerCase();

              return searchableText.includes(
                normalizedSearch
              );
            }
          )
        : allCashFlowItems;

    /* =====================================================
       FILTERED SECTIONS

       Used only for the visible/paginated records.
    ===================================================== */

    const visibleOperatingActivities =
      buildSection(
        filteredCashFlowItems,
        "OPERATING"
      );

    const visibleInvestingActivities =
      buildSection(
        filteredCashFlowItems,
        "INVESTING"
      );

    const visibleFinancingActivities =
      buildSection(
        filteredCashFlowItems,
        "FINANCING"
      );

    /*
     * Keep these calculated here so the controller retains
     * the existing section-building behavior and response
     * compatibility.
     */
    void visibleOperatingActivities;
    void visibleInvestingActivities;
    void visibleFinancingActivities;

    /* =====================================================
       PAGINATION
    ===================================================== */

    const totalRecords =
      filteredCashFlowItems.length;

    const totalPages =
      totalRecords === 0
        ? 0
        : Math.ceil(
            totalRecords /
              limit
          );

    const safePage =
      totalPages === 0
        ? 1
        : Math.min(
            page,
            totalPages
          );

    const safeSkip =
      totalPages === 0
        ? 0
        : (safePage - 1) *
          limit;

    const paginatedItems =
      filteredCashFlowItems.slice(
        safeSkip,
        safeSkip + limit
      );

    /* =====================================================
       PAGINATED SECTIONS
    ===================================================== */

    const paginatedOperatingItems =
      paginatedItems.filter(
        (item) =>
          item.category ===
          "OPERATING"
      );

    const paginatedInvestingItems =
      paginatedItems.filter(
        (item) =>
          item.category ===
          "INVESTING"
      );

    const paginatedFinancingItems =
      paginatedItems.filter(
        (item) =>
          item.category ===
          "FINANCING"
      );

    const paginatedOperatingActivities =
      buildSection(
        paginatedOperatingItems,
        "OPERATING"
      );

    const paginatedInvestingActivities =
      buildSection(
        paginatedInvestingItems,
        "INVESTING"
      );

    const paginatedFinancingActivities =
      buildSection(
        paginatedFinancingItems,
        "FINANCING"
      );

    /* =====================================================
       INDEPENDENT CLOSING CASH RECONCILIATION

       Calculate actual cash balance directly from the
       authoritative JournalEntryLine table.
    ===================================================== */

    const closingDate =
      dateFilter.lte ??
      new Date();

    const closingRows =
      await prisma.$queryRaw<
        CashBalanceAggregateRow[]
      >`
        SELECT
          COALESCE(
            SUM(
              jel."debit" -
              jel."credit"
            ),
            0
          ) AS "balance"

        FROM "JournalEntryLine" jel

        INNER JOIN "JournalEntry" je
          ON je.id =
            jel."journalEntryId"

        WHERE
          je."organizationId" =
            ${organizationId}

          AND je."status" IN (
            ${Prisma.join(
              EFFECTIVE_STATUSES
            )}
          )

          AND je."transactionDate" <=
            ${closingDate}

          AND jel."accountId" IN (
            ${Prisma.join(
              cashAccountIds
            )}
          )
      `;

    const calculatedClosingCashBalance =
      toNumber(
        closingRows[0]?.balance
      );

    const reconciliationDifference =
      roundMoney(
        Math.abs(
          closingCashBalance -
          calculatedClosingCashBalance
        )
      );

    /* =====================================================
       FINAL RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      /*
       * The activity sections contain paginated detail
       * records. Their totals are therefore page-level
       * display totals.
       */
      operatingActivities:
        paginatedOperatingActivities,

      investingActivities:
        paginatedInvestingActivities,

      financingActivities:
        paginatedFinancingActivities,

      cashAccounts:
        cashAccounts.map(
          (account) => ({
            id:
              account.id,

            code:
              account.code,

            name:
              account.name,
          })
        ),

      /*
       * Financial statement totals are deliberately
       * independent of pagination and search.
       */
      totals: {
        operating:
          completeOperatingActivities.netCashFlow,

        investing:
          completeInvestingActivities.netCashFlow,

        financing:
          completeFinancingActivities.netCashFlow,

        netIncreaseDecrease:
          completeNetIncreaseDecrease,

        openingCashBalance:
          roundMoney(
            openingCashBalance
          ),

        closingCashBalance,

        calculatedClosingCashBalance:
          roundMoney(
            calculatedClosingCashBalance
          ),

        reconciliationDifference,

        reconciled:
          reconciliationDifference <=
          TOLERANCE,
      },

      pageTotals: {
        operating:
          paginatedOperatingActivities.netCashFlow,

        investing:
          paginatedInvestingActivities.netCashFlow,

        financing:
          paginatedFinancingActivities.netCashFlow,

        netIncreaseDecrease:
          roundMoney(
            paginatedOperatingActivities.netCashFlow +
            paginatedInvestingActivities.netCashFlow +
            paginatedFinancingActivities.netCashFlow
          ),
      },

      pagination: {
        page:
          safePage,

        limit,

        totalRecords,

        totalPages,

        hasNextPage:
          safePage <
          totalPages,

        hasPreviousPage:
          safePage > 1 &&
          totalPages > 0,
      },

      meta: {
        organizationId,

        startDate:
          dateFilter.gte
            ?.toISOString() ??
          null,

        endDate:
          dateFilter.lte
            ?.toISOString() ??
          null,

        postedEntries:
          periodEntries.length,

        cashTransactions:
          allCashFlowItems.length,

        displayedTransactions:
          paginatedItems.length,

        filteredTransactions:
          filteredCashFlowItems.length,

        cashAccounts:
          cashAccounts.length,

        currency:
          "KES",

        accountingSource:
          "JournalEntryLine",

        effectiveStatuses: [
          ...EFFECTIVE_STATUSES,
        ],

        filters: {
          search:
            search || null,
        },

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