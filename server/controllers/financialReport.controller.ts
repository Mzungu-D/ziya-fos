import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MONEY_DECIMALS = 2;

/* =========================================================
   TYPES
========================================================= */

type AgingBucket =
  | "current"
  | "days1To30"
  | "days31To60"
  | "days61To90"
  | "daysOver90";

interface AgingTotals {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  daysOver90: number;
}

interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

interface RawAgingTotals {
  current: number | bigint | null;
  days1To30: number | bigint | null;
  days31To60: number | bigint | null;
  days61To90: number | bigint | null;
  daysOver90: number | bigint | null;
  outstanding: number | bigint | null;
}

/* =========================================================
   HELPERS
========================================================= */

/**
 * Tenant identity always comes from the authenticated
 * request context.
 *
 * organizationId supplied by a client is never trusted.
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
 * Normalize monetary values to two decimal places.
 */
const roundMoney = (
  value: number
): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** MONEY_DECIMALS;

  return (
    Math.round(
      (value + Number.EPSILON) *
        factor
    ) / factor
  );
};

/**
 * Parse report as-of date.
 *
 * YYYY-MM-DD means the complete day ending at
 * 23:59:59.999.
 */
const parseAsOfDate = (
  value: unknown
): Date | null => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return new Date();
  }

  const raw =
    String(value).trim();

  let date: Date;

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(raw)
  ) {
    date = new Date(
      `${raw}T23:59:59.999`
    );
  } else {
    date = new Date(raw);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      date.setHours(
        23,
        59,
        59,
        999
      );
    }
  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
};

/**
 * Parse pagination values safely.
 */
const parsePagination = (
  pageValue: unknown,
  limitValue: unknown
): Pagination => {
  const rawPage = Number(
    pageValue ?? 1
  );

  const rawLimit = Number(
    limitValue ??
      DEFAULT_PAGE_SIZE
  );

  const page =
    Number.isFinite(rawPage) &&
    rawPage >= 1
      ? Math.floor(rawPage)
      : 1;

  const limit =
    Number.isFinite(rawLimit) &&
    rawLimit >= 1
      ? Math.min(
          Math.floor(rawLimit),
          MAX_PAGE_SIZE
        )
      : DEFAULT_PAGE_SIZE;

  return {
    page,
    limit,
    skip:
      (page - 1) * limit,
  };
};

/**
 * Calculate elapsed whole days between two dates.
 */
const daysBetween = (
  earlier: Date,
  later: Date
): number => {
  const milliseconds =
    later.getTime() -
    earlier.getTime();

  return Math.max(
    0,
    Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24)
    )
  );
};

/**
 * Determine the standard aging bucket.
 */
const getBucket = (
  daysPastDue: number
): AgingBucket => {
  if (daysPastDue <= 0) {
    return "current";
  }

  if (daysPastDue <= 30) {
    return "days1To30";
  }

  if (daysPastDue <= 60) {
    return "days31To60";
  }

  if (daysPastDue <= 90) {
    return "days61To90";
  }

  return "daysOver90";
};

/**
 * Empty aging structure.
 */
const emptyAging = (): AgingTotals => ({
  current: 0,
  days1To30: 0,
  days31To60: 0,
  days61To90: 0,
  daysOver90: 0,
});

/**
 * Normalize database aging aggregates.
 */
const normalizeAgingTotals = (
  row:
    | RawAgingTotals
    | undefined
): AgingTotals & {
  outstanding: number;
} => {
  return {
    current: roundMoney(
      toNumber(
        row?.current
      )
    ),

    days1To30: roundMoney(
      toNumber(
        row?.days1To30
      )
    ),

    days31To60: roundMoney(
      toNumber(
        row?.days31To60
      )
    ),

    days61To90: roundMoney(
      toNumber(
        row?.days61To90
      )
    ),

    daysOver90: roundMoney(
      toNumber(
        row?.daysOver90
      )
    ),

    outstanding: roundMoney(
      toNumber(
        row?.outstanding
      )
    ),
  };
};

/**
 * Normalize free-text search.
 */
const getSearch = (
  value: unknown
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
};

/**
 * Escape LIKE wildcard characters.
 *
 * PostgreSQL ILIKE uses % and _ as wildcards.
 * Escaping them means a user searching for "100%"
 * actually searches for that literal text.
 */
const escapeLikePattern = (
  value: string
): string => {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
};

/**
 * Build a safe ILIKE search pattern.
 */
const getSearchPattern = (
  search: string
): string => {
  return `%${escapeLikePattern(
    search
  )}%`;
};

/* =========================================================
   ACCOUNTS RECEIVABLE AGING
========================================================= */

/**
 * Accounts Receivable Aging Report.
 *
 * Report date:
 *   asOfDate
 *
 * Tenant:
 *   authenticated organizationId
 *
 * Outstanding records:
 *   outstandingBalance > 0
 *
 * Aging:
 *   Current
 *   1-30
 *   31-60
 *   61-90
 *   90+
 *
 * Important:
 *   Pagination affects only displayed invoices.
 *   Aging totals always represent the complete filtered
 *   population.
 */
export const getReceivablesAging =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      /* ===================================================
         TENANT SECURITY
      =================================================== */

      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      /* ===================================================
         REPORT DATE
      =================================================== */

      const asOfDate =
        parseAsOfDate(
          req.query.asOfDate
        );

      if (!asOfDate) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid asOfDate. Use YYYY-MM-DD or a valid date.",
        });
      }

      /* ===================================================
         PAGINATION
      =================================================== */

      const {
        page,
        limit,
        skip,
      } = parsePagination(
        req.query.page,
        req.query.limit
      );

      /* ===================================================
         SEARCH
      =================================================== */

      const search =
        getSearch(
          req.query.search
        );

      const searchPattern =
        getSearchPattern(
          search
        );

      /* ===================================================
         BASE FILTER
      =================================================== */

      const where = {
        organizationId,

        outstandingBalance: {
          gt: 0,
        },

        ...(search
          ? {
              OR: [
                {
                  invoiceNumber: {
                    contains:
                      search,
                    mode:
                      "insensitive" as const,
                  },
                },
                {
                  customerName: {
                    contains:
                      search,
                    mode:
                      "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      };

      /* ===================================================
         RECORD COUNT + PAGE
      =================================================== */

      const [
        totalRecords,
        receivables,
      ] =
        await Promise.all([
          prisma.accountsReceivable.count(
            {
              where,
            }
          ),

          prisma.accountsReceivable.findMany(
            {
              where,

              select: {
                id: true,
                invoiceNumber: true,
                customerName: true,
                description: true,
                amount: true,
                outstandingBalance: true,
                dueDate: true,
                paymentStatus: true,
                status: true,
              },

              orderBy: [
                {
                  dueDate: "asc",
                },
                {
                  invoiceNumber:
                    "asc",
                },
                {
                  id: "asc",
                },
              ],

              skip,
              take: limit,
            }
          ),
        ]);

      /* ===================================================
         COMPLETE FILTERED AGING TOTALS
         
         We use one static parameterized SQL statement.
         
         The search predicate is controlled by a boolean
         parameter rather than dynamically inserting SQL.
      =================================================== */

      const aggregateRows =
        await prisma.$queryRaw<
          RawAgingTotals[]
        >`
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" > ${asOfDate}
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "current",

            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" <= ${asOfDate}
                    AND EXTRACT(
                      DAY FROM
                      (${asOfDate} - "dueDate")
                    ) BETWEEN 1 AND 30
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "days1To30",

            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" <= ${asOfDate}
                    AND EXTRACT(
                      DAY FROM
                      (${asOfDate} - "dueDate")
                    ) BETWEEN 31 AND 60
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "days31To60",

            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" <= ${asOfDate}
                    AND EXTRACT(
                      DAY FROM
                      (${asOfDate} - "dueDate")
                    ) BETWEEN 61 AND 90
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "days61To90",

            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" <= ${asOfDate}
                    AND EXTRACT(
                      DAY FROM
                      (${asOfDate} - "dueDate")
                    ) > 90
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "daysOver90",

            COALESCE(
              SUM("outstandingBalance"),
              0
            ) AS "outstanding"

          FROM "AccountsReceivable"

          WHERE
            "organizationId" =
              ${organizationId}

            AND "outstandingBalance" > 0

            AND (
              ${search === ""}

              OR
              "invoiceNumber"
                ILIKE ${searchPattern}
                ESCAPE '\\'

              OR
              "customerName"
                ILIKE ${searchPattern}
                ESCAPE '\\'
            )
        `;

      const normalized =
        normalizeAgingTotals(
          aggregateRows[0]
        );

      const aging: AgingTotals = {
        current:
          normalized.current,

        days1To30:
          normalized.days1To30,

        days31To60:
          normalized.days31To60,

        days61To90:
          normalized.days61To90,

        daysOver90:
          normalized.daysOver90,
      };

      /* ===================================================
         PAGE ITEMS
      =================================================== */

      const items =
        receivables.map(
          (receivable) => {
            const daysPastDue =
              receivable.dueDate <
              asOfDate
                ? daysBetween(
                    receivable.dueDate,
                    asOfDate
                  )
                : 0;

            return {
              id:
                receivable.id,

              invoiceNumber:
                receivable.invoiceNumber,

              customerName:
                receivable.customerName,

              description:
                receivable.description,

              originalAmount:
                roundMoney(
                  toNumber(
                    receivable.amount
                  )
                ),

              outstandingBalance:
                roundMoney(
                  toNumber(
                    receivable.outstandingBalance
                  )
                ),

              dueDate:
                receivable.dueDate,

              paymentStatus:
                receivable.paymentStatus,

              status:
                receivable.status,

              daysPastDue,

              bucket:
                getBucket(
                  daysPastDue
                ),
            };
          }
        );

      /* ===================================================
         PAGINATION METADATA
      =================================================== */

      const totalPages =
        totalRecords === 0
          ? 0
          : Math.ceil(
              totalRecords /
                limit
            );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res.status(200).json({
        success: true,

        items,

        aging,

        totals: {
          outstanding:
            normalized.outstanding,

          overdue:
            roundMoney(
              aging.days1To30 +
                aging.days31To60 +
                aging.days61To90 +
                aging.daysOver90
            ),
        },

        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,

          hasNextPage:
            page < totalPages,

          hasPreviousPage:
            page > 1 &&
            totalPages > 0,
        },

        meta: {
          organizationId,

          asOfDate:
            asOfDate.toISOString(),

          records:
            items.length,

          currency: "KES",

          reportBasis:
            "Outstanding Accounts Receivable",

          generatedAt:
            new Date().toISOString(),

          filters: {
            search:
              search || null,
          },
        },
      });
    } catch (error) {
      console.error(
        "RECEIVABLES AGING ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate receivables aging report",
      });
    }
  };

/* =========================================================
   ACCOUNTS PAYABLE AGING
========================================================= */

/**
 * Accounts Payable Aging Report.
 */
export const getPayablesAging =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      /* ===================================================
         TENANT SECURITY
      =================================================== */

      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      /* ===================================================
         REPORT DATE
      =================================================== */

      const asOfDate =
        parseAsOfDate(
          req.query.asOfDate
        );

      if (!asOfDate) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid asOfDate. Use YYYY-MM-DD or a valid date.",
        });
      }

      /* ===================================================
         PAGINATION
      =================================================== */

      const {
        page,
        limit,
        skip,
      } = parsePagination(
        req.query.page,
        req.query.limit
      );

      /* ===================================================
         SEARCH
      =================================================== */

      const search =
        getSearch(
          req.query.search
        );

      const searchPattern =
        getSearchPattern(
          search
        );

      /* ===================================================
         FILTER
      =================================================== */

      const where = {
        organizationId,

        outstandingBalance: {
          gt: 0,
        },

        ...(search
          ? {
              OR: [
                {
                  invoiceNumber: {
                    contains:
                      search,
                    mode:
                      "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      };

      /* ===================================================
         COUNT + PAGE
      =================================================== */

      const [
        totalRecords,
        payables,
      ] =
        await Promise.all([
          prisma.accountsPayable.count({
            where,
          }),

          prisma.accountsPayable.findMany({
            where,

            select: {
              id: true,
              invoiceNumber: true,
              description: true,
              amount: true,
              outstandingBalance: true,
              dueDate: true,
              paymentStatus: true,
              status: true,

              vendor: {
                select: {
                  id: true,
                  vendorCode: true,
                  name: true,
                },
              },
            },

            orderBy: [
              {
                dueDate: "asc",
              },
              {
                invoiceNumber:
                  "asc",
              },
              {
                id: "asc",
              },
            ],

            skip,
            take: limit,
          }),
        ]);

      /* ===================================================
         COMPLETE FILTERED AGING TOTALS
      =================================================== */

      const aggregateRows =
        await prisma.$queryRaw<
          RawAgingTotals[]
        >`
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" > ${asOfDate}
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "current",

            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" <= ${asOfDate}
                    AND EXTRACT(
                      DAY FROM
                      (${asOfDate} - "dueDate")
                    ) BETWEEN 1 AND 30
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "days1To30",

            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" <= ${asOfDate}
                    AND EXTRACT(
                      DAY FROM
                      (${asOfDate} - "dueDate")
                    ) BETWEEN 31 AND 60
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "days31To60",

            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" <= ${asOfDate}
                    AND EXTRACT(
                      DAY FROM
                      (${asOfDate} - "dueDate")
                    ) BETWEEN 61 AND 90
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "days61To90",

            COALESCE(
              SUM(
                CASE
                  WHEN "dueDate" <= ${asOfDate}
                    AND EXTRACT(
                      DAY FROM
                      (${asOfDate} - "dueDate")
                    ) > 90
                    THEN "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "daysOver90",

            COALESCE(
              SUM("outstandingBalance"),
              0
            ) AS "outstanding"

          FROM "AccountsPayable"

          WHERE
            "organizationId" =
              ${organizationId}

            AND "outstandingBalance" > 0

            AND (
              ${search === ""}

              OR
              "invoiceNumber"
                ILIKE ${searchPattern}
                ESCAPE '\\'
            )
        `;

      const normalized =
        normalizeAgingTotals(
          aggregateRows[0]
        );

      const aging: AgingTotals = {
        current:
          normalized.current,

        days1To30:
          normalized.days1To30,

        days31To60:
          normalized.days31To60,

        days61To90:
          normalized.days61To90,

        daysOver90:
          normalized.daysOver90,
      };

      /* ===================================================
         PAGE ITEMS
      =================================================== */

      const items =
        payables.map(
          (payable) => {
            const daysPastDue =
              payable.dueDate <
              asOfDate
                ? daysBetween(
                    payable.dueDate,
                    asOfDate
                  )
                : 0;

            return {
              id:
                payable.id,

              invoiceNumber:
                payable.invoiceNumber,

              vendor: {
                id:
                  payable.vendor.id,

                vendorCode:
                  payable.vendor
                    .vendorCode,

                name:
                  payable.vendor
                    .name,
              },

              description:
                payable.description,

              originalAmount:
                roundMoney(
                  toNumber(
                    payable.amount
                  )
                ),

              outstandingBalance:
                roundMoney(
                  toNumber(
                    payable.outstandingBalance
                  )
                ),

              dueDate:
                payable.dueDate,

              paymentStatus:
                payable.paymentStatus,

              status:
                payable.status,

              daysPastDue,

              bucket:
                getBucket(
                  daysPastDue
                ),
            };
          }
        );

      /* ===================================================
         PAGINATION
      =================================================== */

      const totalPages =
        totalRecords === 0
          ? 0
          : Math.ceil(
              totalRecords /
                limit
            );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res.status(200).json({
        success: true,

        items,

        aging,

        totals: {
          outstanding:
            normalized.outstanding,

          overdue:
            roundMoney(
              aging.days1To30 +
                aging.days31To60 +
                aging.days61To90 +
                aging.daysOver90
            ),
        },

        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,

          hasNextPage:
            page < totalPages,

          hasPreviousPage:
            page > 1 &&
            totalPages > 0,
        },

        meta: {
          organizationId,

          asOfDate:
            asOfDate.toISOString(),

          records:
            items.length,

          currency: "KES",

          reportBasis:
            "Outstanding Accounts Payable",

          generatedAt:
            new Date().toISOString(),

          filters: {
            search:
              search || null,
          },
        },
      });
    } catch (error) {
      console.error(
        "PAYABLES AGING ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate payables aging report",
      });
    }
  };

/* =========================================================
   CUSTOMER BALANCES
========================================================= */

/**
 * Customer Balance Summary.
 *
 * Customers are grouped case-insensitively and with leading /
 * trailing whitespace normalized.
 *
 * Totals are calculated from the complete filtered population,
 * never from the current page.
 */
export const getCustomerBalances =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      /* ===================================================
         TENANT SECURITY
      =================================================== */

      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      /* ===================================================
         REPORT DATE
         
         Customer balances do not require a date filter for
         outstanding balances, but overdue balances MUST use
         a consistent report date.
      =================================================== */

      const asOfDate =
        parseAsOfDate(
          req.query.asOfDate
        );

      if (!asOfDate) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid asOfDate. Use YYYY-MM-DD or a valid date.",
        });
      }

      /* ===================================================
         PAGINATION
      =================================================== */

      const {
        page,
        limit,
        skip,
      } = parsePagination(
        req.query.page,
        req.query.limit
      );

      /* ===================================================
         SEARCH
      =================================================== */

      const search =
        getSearch(
          req.query.search
        );

      const searchPattern =
        getSearchPattern(
          search
        );

      /* ===================================================
         CUSTOMER COUNT
         
         The boolean parameter prevents dynamic SQL
         fragments while preserving safe parameterization.
      =================================================== */

      const totalRows =
        await prisma.$queryRaw<
          Array<{
            count:
              | number
              | bigint;
          }>
        >`
          SELECT COUNT(*)
            AS count

          FROM (
            SELECT
              LOWER(
                TRIM("customerName")
              ) AS "customerKey"

            FROM "AccountsReceivable"

            WHERE
              "organizationId" =
                ${organizationId}

              AND (
                ${search === ""}

                OR
                "customerName"
                  ILIKE ${searchPattern}
                  ESCAPE '\\'
              )

            GROUP BY
              LOWER(
                TRIM("customerName")
              )
          ) grouped_customers
        `;

      const totalCustomers =
        toNumber(
          totalRows[0]?.count
        );

      /* ===================================================
         CUSTOMER PAGE
      =================================================== */

      const customers =
        await prisma.$queryRaw<
          Array<{
            customerName: string;
            invoices:
              | number
              | bigint;
            originalAmount:
              | number
              | bigint
              | null;
            outstandingBalance:
              | number
              | bigint
              | null;
            overdueBalance:
              | number
              | bigint
              | null;
          }>
        >`
          SELECT
            MIN("customerName")
              AS "customerName",

            COUNT(*)
              AS invoices,

            COALESCE(
              SUM("amount"),
              0
            ) AS "originalAmount",

            COALESCE(
              SUM(
                "outstandingBalance"
              ),
              0
            ) AS "outstandingBalance",

            COALESCE(
              SUM(
                CASE
                  WHEN
                    "dueDate" <= ${asOfDate}
                    AND
                    "outstandingBalance" > 0
                  THEN
                    "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "overdueBalance"

          FROM "AccountsReceivable"

          WHERE
            "organizationId" =
              ${organizationId}

            AND (
              ${search === ""}

              OR
              "customerName"
                ILIKE ${searchPattern}
                ESCAPE '\\'
            )

          GROUP BY
            LOWER(
              TRIM("customerName")
            )

          ORDER BY
            "outstandingBalance"
              DESC,
            "customerName"
              ASC

          LIMIT ${limit}
          OFFSET ${skip}
        `;

      /* ===================================================
         CUSTOMER PAGE MAPPING
      =================================================== */

      const items =
        customers.map(
          (customer) => ({
            customerName:
              customer.customerName,

            invoices:
              toNumber(
                customer.invoices
              ),

            originalAmount:
              roundMoney(
                toNumber(
                  customer.originalAmount
                )
              ),

            outstandingBalance:
              roundMoney(
                toNumber(
                  customer.outstandingBalance
                )
              ),

            overdueBalance:
              roundMoney(
                toNumber(
                  customer.overdueBalance
                )
              ),
          })
        );

      /* ===================================================
         COMPLETE FILTERED TOTALS
      =================================================== */

      const totalsRows =
        await prisma.$queryRaw<
          Array<{
            originalAmount:
              | number
              | bigint
              | null;

            outstandingBalance:
              | number
              | bigint
              | null;

            overdueBalance:
              | number
              | bigint
              | null;
          }>
        >`
          SELECT
            COALESCE(
              SUM("amount"),
              0
            ) AS "originalAmount",

            COALESCE(
              SUM(
                "outstandingBalance"
              ),
              0
            ) AS "outstandingBalance",

            COALESCE(
              SUM(
                CASE
                  WHEN
                    "dueDate" <= ${asOfDate}
                    AND
                    "outstandingBalance" > 0
                  THEN
                    "outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "overdueBalance"

          FROM "AccountsReceivable"

          WHERE
            "organizationId" =
              ${organizationId}

            AND (
              ${search === ""}

              OR
              "customerName"
                ILIKE ${searchPattern}
                ESCAPE '\\'
            )
        `;

      const totalRow =
        totalsRows[0];

      /* ===================================================
         PAGINATION
      =================================================== */

      const totalPages =
        totalCustomers === 0
          ? 0
          : Math.ceil(
              totalCustomers /
                limit
            );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res.status(200).json({
        success: true,

        items,

        totals: {
          originalAmount:
            roundMoney(
              toNumber(
                totalRow?.originalAmount
              )
            ),

          outstandingBalance:
            roundMoney(
              toNumber(
                totalRow?.outstandingBalance
              )
            ),

          overdueBalance:
            roundMoney(
              toNumber(
                totalRow?.overdueBalance
              )
            ),
        },

        pagination: {
          page,
          limit,

          totalRecords:
            totalCustomers,

          totalPages,

          hasNextPage:
            page < totalPages,

          hasPreviousPage:
            page > 1 &&
            totalPages > 0,
        },

        meta: {
          organizationId,

          asOfDate:
            asOfDate.toISOString(),

          customers:
            items.length,

          currency: "KES",

          reportBasis:
            "Accounts Receivable Customer Balances",

          generatedAt:
            new Date().toISOString(),

          filters: {
            search:
              search || null,
          },
        },
      });
    } catch (error) {
      console.error(
        "CUSTOMER BALANCES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate customer balances report",
      });
    }
  };

/* =========================================================
   VENDOR PAYABLES
========================================================= */

/**
 * Vendor Payables Summary.
 *
 * Vendor grouping is performed by vendor identity rather than
 * vendor name, preventing two vendors with similar names from
 * being incorrectly combined.
 */
export const getVendorPayables =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      /* ===================================================
         TENANT SECURITY
      =================================================== */

      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      /* ===================================================
         REPORT DATE
      =================================================== */

      const asOfDate =
        parseAsOfDate(
          req.query.asOfDate
        );

      if (!asOfDate) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid asOfDate. Use YYYY-MM-DD or a valid date.",
        });
      }

      /* ===================================================
         PAGINATION
      =================================================== */

      const {
        page,
        limit,
        skip,
      } = parsePagination(
        req.query.page,
        req.query.limit
      );

      /* ===================================================
         SEARCH
      =================================================== */

      const search =
        getSearch(
          req.query.search
        );

      const searchPattern =
        getSearchPattern(
          search
        );

      /* ===================================================
         VENDOR COUNT
         
         Only vendors with outstanding tenant payables
         participate in this report.
      =================================================== */

      const totalRows =
        await prisma.$queryRaw<
          Array<{
            count:
              | number
              | bigint;
          }>
        >`
          SELECT COUNT(*)
            AS count

          FROM "Vendor" v

          WHERE
            v."organizationId" =
              ${organizationId}

            AND (
              ${search === ""}

              OR
              v."name"
                ILIKE ${searchPattern}
                ESCAPE '\\'

              OR
              v."vendorCode"
                ILIKE ${searchPattern}
                ESCAPE '\\'
            )

            AND EXISTS (
              SELECT 1

              FROM "AccountsPayable" ap

              WHERE
                ap."vendorId" =
                  v.id

                AND
                ap."organizationId" =
                  ${organizationId}

                AND
                ap."outstandingBalance" >
                  0
            )
        `;

      const totalVendors =
        toNumber(
          totalRows[0]?.count
        );

      /* ===================================================
         VENDOR PAGE
      =================================================== */

      const vendors =
        await prisma.$queryRaw<
          Array<{
            id: string;
            vendorCode: string;
            vendorName: string;
            invoices:
              | number
              | bigint;
            originalAmount:
              | number
              | bigint
              | null;
            outstandingBalance:
              | number
              | bigint
              | null;
            overdueBalance:
              | number
              | bigint
              | null;
            status: string;
          }>
        >`
          SELECT
            v.id AS id,

            v."vendorCode"
              AS "vendorCode",

            v.name
              AS "vendorName",

            COUNT(ap.id)
              AS invoices,

            COALESCE(
              SUM(ap.amount),
              0
            ) AS "originalAmount",

            COALESCE(
              SUM(
                ap."outstandingBalance"
              ),
              0
            ) AS "outstandingBalance",

            COALESCE(
              SUM(
                CASE
                  WHEN
                    ap."dueDate" <= ${asOfDate}
                    AND
                    ap."outstandingBalance" > 0
                  THEN
                    ap."outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "overdueBalance",

            v.status AS status

          FROM "Vendor" v

          INNER JOIN
            "AccountsPayable" ap

            ON
              ap."vendorId" =
                v.id

              AND
              ap."organizationId" =
                ${organizationId}

              AND
              ap."outstandingBalance" >
                0

          WHERE
            v."organizationId" =
              ${organizationId}

            AND (
              ${search === ""}

              OR
              v."name"
                ILIKE ${searchPattern}
                ESCAPE '\\'

              OR
              v."vendorCode"
                ILIKE ${searchPattern}
                ESCAPE '\\'
            )

          GROUP BY
            v.id,
            v."vendorCode",
            v.name,
            v.status

          ORDER BY
            "outstandingBalance"
              DESC,

            v.name
              ASC,

            v.id
              ASC

          LIMIT ${limit}
          OFFSET ${skip}
        `;

      /* ===================================================
         VENDOR PAGE MAPPING
      =================================================== */

      const items =
        vendors.map(
          (vendor) => ({
            id:
              vendor.id,

            vendorCode:
              vendor.vendorCode,

            vendorName:
              vendor.vendorName,

            invoices:
              toNumber(
                vendor.invoices
              ),

            originalAmount:
              roundMoney(
                toNumber(
                  vendor.originalAmount
                )
              ),

            outstandingBalance:
              roundMoney(
                toNumber(
                  vendor.outstandingBalance
                )
              ),

            overdueBalance:
              roundMoney(
                toNumber(
                  vendor.overdueBalance
                )
              ),

            status:
              vendor.status,
          })
        );

      /* ===================================================
         COMPLETE FILTERED TOTALS
      =================================================== */

      const totalsRows =
        await prisma.$queryRaw<
          Array<{
            originalAmount:
              | number
              | bigint
              | null;

            outstandingBalance:
              | number
              | bigint
              | null;

            overdueBalance:
              | number
              | bigint
              | null;
          }>
        >`
          SELECT
            COALESCE(
              SUM(ap.amount),
              0
            ) AS "originalAmount",

            COALESCE(
              SUM(
                ap."outstandingBalance"
              ),
              0
            ) AS "outstandingBalance",

            COALESCE(
              SUM(
                CASE
                  WHEN
                    ap."dueDate" <= ${asOfDate}
                    AND
                    ap."outstandingBalance" > 0
                  THEN
                    ap."outstandingBalance"
                  ELSE 0
                END
              ),
              0
            ) AS "overdueBalance"

          FROM "AccountsPayable" ap

          INNER JOIN
            "Vendor" v

            ON
              v.id =
                ap."vendorId"

          WHERE
            ap."organizationId" =
              ${organizationId}

            AND
              v."organizationId" =
                ${organizationId}

            AND
              ap."outstandingBalance" >
                0

            AND (
              ${search === ""}

              OR
              v."name"
                ILIKE ${searchPattern}
                ESCAPE '\\'

              OR
              v."vendorCode"
                ILIKE ${searchPattern}
                ESCAPE '\\'
            )
        `;

      const totalRow =
        totalsRows[0];

      /* ===================================================
         PAGINATION
      =================================================== */

      const totalPages =
        totalVendors === 0
          ? 0
          : Math.ceil(
              totalVendors /
                limit
            );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res.status(200).json({
        success: true,

        items,

        totals: {
          originalAmount:
            roundMoney(
              toNumber(
                totalRow?.originalAmount
              )
            ),

          outstandingBalance:
            roundMoney(
              toNumber(
                totalRow?.outstandingBalance
              )
            ),

          overdueBalance:
            roundMoney(
              toNumber(
                totalRow?.overdueBalance
              )
            ),
        },

        pagination: {
          page,
          limit,

          totalRecords:
            totalVendors,

          totalPages,

          hasNextPage:
            page < totalPages,

          hasPreviousPage:
            page > 1 &&
            totalPages > 0,
        },

        meta: {
          organizationId,

          asOfDate:
            asOfDate.toISOString(),

          vendors:
            items.length,

          currency: "KES",

          reportBasis:
            "Accounts Payable Vendor Balances",

          generatedAt:
            new Date().toISOString(),

          filters: {
            search:
              search || null,
          },
        },
      });
    } catch (error) {
      console.error(
        "VENDOR PAYABLES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to generate vendor payables report",
      });
    }
  };