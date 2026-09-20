import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   ACCOUNTS RECEIVABLE CONTROLLER
   =========================================================

   Production responsibilities:

   - Strict organization / tenant isolation
   - Customer receivable register
   - Server-side pagination
   - Server-side search
   - Server-side status filtering
   - Server-side aging filtering
   - Receivable approval
   - Customer payment recording
   - Invoice payment-status synchronization
   - Receivable update
   - Receivable deletion
   - Stable pagination ordering

   IMPORTANT:

   The Invoice Engine is the primary production workflow for
   normal customer invoices.

   This controller continues supporting the existing
   Accounts Receivable API and its legacy/opening-balance
   creation workflow.

========================================================= */


/* =========================================================
   HELPERS
========================================================= */

/**
 * Get the authenticated organization.
 *
 * Never trust organizationId supplied by the browser.
 */
const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};


/**
 * Safely resolve a route parameter.
 */
const getReceivableId = (
  req: AuthRequest
): string | null => {
  const value = req.params.id;

  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return String(value);
};


/**
 * Normalize text input.
 */
const normalizeText = (
  value: unknown
): string => {
  return typeof value === "string"
    ? value.trim()
    : "";
};


/**
 * Normalize optional text.
 */
const normalizeOptionalText = (
  value: unknown
): string | null => {
  const normalized =
    normalizeText(value);

  return normalized || null;
};


/**
 * Parse a positive monetary amount.
 */
const parsePositiveAmount = (
  value: unknown
): number | null => {
  const amount =
    typeof value === "string"
      ? Number(
          value.replace(/,/g, "")
        )
      : Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return Math.round(
    (amount + Number.EPSILON) * 100
  ) / 100;
};


/**
 * Parse a date.
 */
const parseDate = (
  value: unknown
): Date | null => {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const date =
    new Date(value);

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
 * Determine payment status from the original
 * receivable amount and current outstanding balance.
 */
const getPaymentStatus = (
  originalAmount: number,
  outstandingBalance: number
): string => {
  if (
    outstandingBalance <= 0
  ) {
    return "PAID";
  }

  if (
    outstandingBalance <
    originalAmount
  ) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
};


/**
 * Check Prisma unique constraint errors.
 */
const isPrismaUniqueError = (
  error: unknown
): boolean => {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
};


/**
 * Convert a query parameter into a safe positive
 * integer.
 */
const parsePositiveInteger = (
  value: unknown,
  fallback: number
): number => {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return Math.floor(parsed);
};


/**
 * Normalize status query values.
 */
const normalizeQueryStatus = (
  value: unknown
): string => {
  return normalizeText(value)
    .toUpperCase()
    .replaceAll("_", " ");
};


/**
 * Normalize aging query values.
 *
 * Supports both ASCII hyphens and the en-dash used
 * by the frontend.
 */
const normalizeQueryAging = (
  value: unknown
): string => {
  return normalizeText(value)
    .toUpperCase()
    .replaceAll("–", "-");
};


/* =========================================================
   GET ALL RECEIVABLES
========================================================= */

/**
 * Production A/R register.
 *
 * Query parameters:
 *
 * page
 * pageSize
 * search
 * status
 * aging
 *
 * Supported page sizes:
 *
 * 10
 * 25
 * 50
 * 100
 *
 * Example:
 *
 * GET /api/accounts-receivable?page=1&pageSize=25
 *
 * GET /api/accounts-receivable
 *   ?page=2
 *   &pageSize=25
 *   &search=ABC
 *   &status=OVERDUE
 *   &aging=31-60
 */
export const getReceivables = async (
  req: AuthRequest,
  res: Response
) => {
  try {
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
       PAGINATION
    ===================================================== */

    const requestedPage =
      parsePositiveInteger(
        req.query.page,
        1
      );

    const requestedPageSize =
      parsePositiveInteger(
        req.query.pageSize,
        25
      );

    const allowedPageSizes = [
      10,
      25,
      50,
      100,
    ];

    const pageSize =
      allowedPageSizes.includes(
        requestedPageSize
      )
        ? requestedPageSize
        : 25;

    /* =====================================================
       SEARCH
    ===================================================== */

    const search =
      normalizeText(
        req.query.search
      );

    /* =====================================================
       STATUS
    ===================================================== */

    const status =
      normalizeQueryStatus(
        req.query.status
      ) || "ALL";

    /* =====================================================
       AGING
    ===================================================== */

    const aging =
      normalizeQueryAging(
        req.query.aging
      ) || "ALL";

    /* =====================================================
       DATE BOUNDARIES
    ===================================================== */

    const now =
      new Date();

    const startOfToday =
      new Date();

    startOfToday.setHours(
      0,
      0,
      0,
      0
    );

    const startOf30DaysAgo =
      new Date(
        startOfToday
      );

    startOf30DaysAgo.setDate(
      startOf30DaysAgo.getDate() -
        30
    );

    const startOf60DaysAgo =
      new Date(
        startOfToday
      );

    startOf60DaysAgo.setDate(
      startOf60DaysAgo.getDate() -
        60
    );

    const startOf90DaysAgo =
      new Date(
        startOfToday
      );

    startOf90DaysAgo.setDate(
      startOf90DaysAgo.getDate() -
        90
    );

    /* =====================================================
       BASE WHERE
    ===================================================== */

    const where: Prisma.AccountsReceivableWhereInput =
      {
        organizationId,
      };

    /* =====================================================
       SEARCH FILTER
    ===================================================== */

    if (search) {
      where.OR = [
        {
          invoiceNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    /* =====================================================
       AND CONDITIONS
    ===================================================== */

    const andConditions: Prisma.AccountsReceivableWhereInput[] =
      [];

    /* =====================================================
       STATUS FILTER
    ===================================================== */

    switch (status) {
      case "PAID":
        andConditions.push({
          OR: [
            {
              paymentStatus:
                "PAID",
            },
            {
              outstandingBalance: {
                lte: 0,
              },
            },
          ],
        });
        break;

      case "PARTIALLY PAID":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          paymentStatus: {
            in: [
              "PARTIALLY_PAID",
              "PARTIAL",
            ],
          },
        });
        break;

      case "APPROVED":
        andConditions.push({
          status:
            "APPROVED",
        });
        break;

      case "OVERDUE":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          dueDate: {
            lt: now,
          },
        });

        andConditions.push({
          paymentStatus: {
            notIn: [
              "PAID",
              "PARTIALLY_PAID",
              "PARTIAL",
            ],
          },
        });
        break;

      case "OUTSTANDING":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          dueDate: {
            gte: now,
          },
        });

        andConditions.push({
          status:
            "APPROVED",
        });
        break;

      case "PENDING APPROVAL":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          status: {
            not:
              "APPROVED",
          },
        });

        andConditions.push({
          paymentStatus: {
            notIn: [
              "PAID",
              "PARTIALLY_PAID",
              "PARTIAL",
            ],
          },
        });
        break;

      case "ALL":
      default:
        break;
    }

    /* =====================================================
       AGING FILTER
    ===================================================== */

    switch (aging) {
      case "CURRENT":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          dueDate: {
            gte: startOfToday,
          },
        });
        break;

      case "1-30":
      case "1-30 DAYS":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          dueDate: {
            gte:
              startOf30DaysAgo,
            lt:
              startOfToday,
          },
        });
        break;

      case "31-60":
      case "31-60 DAYS":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          dueDate: {
            gte:
              startOf60DaysAgo,
            lt:
              startOf30DaysAgo,
          },
        });
        break;

      case "61-90":
      case "61-90 DAYS":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          dueDate: {
            gte:
              startOf90DaysAgo,
            lt:
              startOf60DaysAgo,
          },
        });
        break;

      case "90+":
      case "90+ DAYS":
        andConditions.push({
          outstandingBalance: {
            gt: 0,
          },
        });

        andConditions.push({
          dueDate: {
            lt:
              startOf90DaysAgo,
          },
        });
        break;

      case "ALL":
      default:
        break;
    }

    /* =====================================================
       APPLY AND CONDITIONS
    ===================================================== */

    if (
      andConditions.length > 0
    ) {
      where.AND =
        andConditions;
    }

    /* =====================================================
       COUNT
    ===================================================== */

    const total =
      await prisma.accountsReceivable.count({
        where,
      });

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total / pageSize
        )
      );

    /*
     * If the requested page is beyond the available
     * range, return the last valid page.
     */
    const page =
      Math.min(
        requestedPage,
        totalPages
      );

    /* =====================================================
       PAGINATED DATA
    ===================================================== */

    const receivables =
      await prisma.accountsReceivable.findMany({
        where,

        orderBy: [
          {
            createdAt:
              "desc",
          },
          {
            id: "desc",
          },
        ],

        skip:
          (page - 1) *
          pageSize,

        take:
          pageSize,
      });

    /* =====================================================
       PORTFOLIO SUMMARY
    =====================================================

       Summary intentionally uses the complete organization
       rather than only the current page.

       This means the KPI cards remain portfolio-level even
       when the table is paginated.
    ===================================================== */

    const [
      portfolioTotals,
      overdueTotals,
    ] =
      await Promise.all([
        prisma.accountsReceivable.aggregate({
          where: {
            organizationId,
          },

          _sum: {
            amount: true,
            outstandingBalance:
              true,
          },
        }),

        prisma.accountsReceivable.aggregate({
          where: {
            organizationId,

            outstandingBalance: {
              gt: 0,
            },

            dueDate: {
              lt: now,
            },
          },

          _sum: {
            outstandingBalance:
              true,
          },

          _count: {
            _all: true,
          },
        }),
      ]);

    const totalInvoiced =
      Number(
        portfolioTotals._sum
          .amount
      ) || 0;

    const totalOutstanding =
      Number(
        portfolioTotals._sum
          .outstandingBalance
      ) || 0;

    const totalCollected =
      Math.max(
        0,
        totalInvoiced -
          totalOutstanding
      );

    const totalOverdue =
      Number(
        overdueTotals._sum
          .outstandingBalance
      ) || 0;

    const overdueCount =
      overdueTotals._count
        ._all;

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      count: total,

      receivables,

      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },

      summary: {
        totalInvoiced,
        totalOutstanding,
        totalCollected,
        totalOverdue,
        overdueCount,
      },
    });
  } catch (error) {
    console.error(
      "Fetch receivables error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch receivables",
    });
  }
};


/* =========================================================
   CREATE RECEIVABLE
========================================================= */

/**
 * Creates a standalone A/R entry.
 *
 * The normal production invoice workflow should use the
 * Invoice Engine, which creates the A/R record as part of
 * invoice posting/finalization.
 *
 * This endpoint remains available for the existing
 * opening-balance / standalone receivable workflow.
 */
export const createReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const invoiceNumber =
      normalizeText(
        req.body.invoiceNumber
      );

    const customerName =
      normalizeText(
        req.body.customerName
      );

    const description =
      normalizeText(
        req.body.description
      );

    const amount =
      parsePositiveAmount(
        req.body.amount
      );

    const dueDate =
      parseDate(
        req.body.dueDate
      );

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice number is required.",
      });
    }

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message:
          "Customer name is required.",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message:
          "Description is required.",
      });
    }

    if (amount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message:
          "A valid due date is required.",
      });
    }

    /* =====================================================
       DUPLICATE CHECK
    ===================================================== */

    const existing =
      await prisma.accountsReceivable.findFirst({
        where: {
          organizationId,
          invoiceNumber,
        },
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "An invoice with this invoice number already exists in this organization.",
      });
    }

    /* =====================================================
       CREATE
    ===================================================== */

    const receivable =
      await prisma.accountsReceivable.create({
        data: {
          organizationId,

          invoiceNumber,

          customerName,

          description,

          amount,

          outstandingBalance:
            amount,

          dueDate,

          paymentStatus:
            "UNPAID",

          status:
            "PENDING",
        },
      });

    return res.status(201).json({
      success: true,

      message:
        "Customer invoice created successfully",

      receivable,
    });
  } catch (error) {
    console.error(
      "Create receivable error:",
      error
    );

    if (
      isPrismaUniqueError(error)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An invoice with this invoice number already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create customer invoice",
    });
  }
};


/* =========================================================
   GET SINGLE RECEIVABLE
========================================================= */

export const getReceivableById =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const receivable =
        await prisma.accountsReceivable.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!receivable) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      return res.status(200).json({
        success: true,
        receivable,
      });
    } catch (error) {
      console.error(
        "Fetch receivable error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch customer invoice",
      });
    }
  };


/* =========================================================
   UPDATE RECEIVABLE
========================================================= */

export const updateReceivable =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const invoiceNumber =
        normalizeText(
          req.body.invoiceNumber
        );

      const customerName =
        normalizeText(
          req.body.customerName
        );

      const description =
        normalizeText(
          req.body.description
        );

      const amount =
        parsePositiveAmount(
          req.body.amount
        );

      const dueDate =
        parseDate(
          req.body.dueDate
        );

      /* ===================================================
         VALIDATION
      =================================================== */

      if (!invoiceNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice number is required.",
        });
      }

      if (!customerName) {
        return res.status(400).json({
          success: false,
          message:
            "Customer name is required.",
        });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message:
            "Description is required.",
        });
      }

      if (amount === null) {
        return res.status(400).json({
          success: false,
          message:
            "Amount must be greater than zero.",
        });
      }

      if (!dueDate) {
        return res.status(400).json({
          success: false,
          message:
            "A valid due date is required.",
        });
      }

      /* ===================================================
         EXISTING RECORD
      =================================================== */

      const existing =
        await prisma.accountsReceivable.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      /* ===================================================
         DUPLICATE INVOICE NUMBER
      =================================================== */

      const duplicate =
        await prisma.accountsReceivable.findFirst({
          where: {
            organizationId,

            invoiceNumber,

            NOT: {
              id,
            },
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "An invoice with this invoice number already exists in this organization",
        });
      }

      /* ===================================================
         UPDATE
      =================================================== */

      const updated =
        await prisma.accountsReceivable.updateMany({
          where: {
            id,
            organizationId,
          },

          data: {
            invoiceNumber,

            customerName,

            description,

            amount,

            /*
             * Preserve the current controller behaviour:
             * editing the receivable resets its outstanding
             * balance to the edited invoice amount.
             *
             * Payment-aware editing will be hardened later
             * when the dedicated payment/application model
             * is introduced.
             */
            outstandingBalance:
              amount,

            dueDate,
          },
        });

      if (
        updated.count !== 1
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      /* ===================================================
         FETCH UPDATED RECORD
      =================================================== */

      const receivable =
        await prisma.accountsReceivable.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      return res.status(200).json({
        success: true,

        message:
          "Customer invoice updated successfully",

        receivable,
      });
    } catch (error) {
      console.error(
        "Update receivable error:",
        error
      );

      if (
        isPrismaUniqueError(error)
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An invoice with this invoice number already exists in this organization.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to update customer invoice",
      });
    }
  };


/* =========================================================
   APPROVE RECEIVABLE
========================================================= */

export const approveReceivable =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const existing =
        await prisma.accountsReceivable.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      if (
        existing.status ===
        "APPROVED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Customer invoice is already approved",
        });
      }

      const approvedBy =
        req.user?.userId ??
        "SYSTEM";

      const updated =
        await prisma.accountsReceivable.updateMany({
          where: {
            id,
            organizationId,
          },

          data: {
            status:
              "APPROVED",

            approvedBy,
          },
        });

      if (
        updated.count !== 1
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      const receivable =
        await prisma.accountsReceivable.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      return res.status(200).json({
        success: true,

        message:
          "Customer invoice approved successfully",

        receivable,
      });
    } catch (error) {
      console.error(
        "Approve receivable error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to approve customer invoice",
      });
    }
  };


/* =========================================================
   RECORD CUSTOMER PAYMENT
========================================================= */

export const recordReceivablePayment =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const paymentAmount =
        parsePositiveAmount(
          req.body.amount
        );

      if (
        paymentAmount === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment amount must be greater than zero",
        });
      }

      /* ===================================================
         TRANSACTION
      =================================================== */

      const receivable =
        await prisma.$transaction(
          async (tx) => {
            const existing =
              await tx.accountsReceivable.findFirst({
                where: {
                  id,
                  organizationId,
                },
              });

            if (!existing) {
              throw new Error(
                "RECEIVABLE_NOT_FOUND"
              );
            }

            if (
              existing.status !==
              "APPROVED"
            ) {
              throw new Error(
                "RECEIVABLE_NOT_APPROVED"
              );
            }

            const currentBalance =
              Number(
                existing.outstandingBalance
              ) || 0;

            if (
              currentBalance <= 0
            ) {
              throw new Error(
                "RECEIVABLE_ALREADY_PAID"
              );
            }

            if (
              paymentAmount >
              currentBalance
            ) {
              throw new Error(
                "PAYMENT_EXCEEDS_BALANCE"
              );
            }

            const newBalance =
              Math.max(
                0,
                Math.round(
                  (
                    currentBalance -
                    paymentAmount +
                    Number.EPSILON
                  ) * 100
                ) / 100
              );

            const paymentStatus =
              getPaymentStatus(
                Number(
                  existing.amount
                ),
                newBalance
              );

            /* ---------------------------------------------
               UPDATE RECEIVABLE
            --------------------------------------------- */

            const updated =
              await tx.accountsReceivable.updateMany({
                where: {
                  id,
                  organizationId,
                },

                data: {
                  outstandingBalance:
                    newBalance,

                  paymentStatus,
                },
              });

            if (
              updated.count !== 1
            ) {
              throw new Error(
                "RECEIVABLE_NOT_FOUND"
              );
            }

            /* ---------------------------------------------
               SYNCHRONIZE RELATED INVOICE
            --------------------------------------------- */

            const invoice =
              await tx.invoice.findFirst({
                where: {
                  organizationId,

                  invoiceNumber:
                    existing.invoiceNumber,
                },
              });

            if (invoice) {
              await tx.invoice.update({
                where: {
                  id:
                    invoice.id,
                },

                data: {
                  paymentStatus,
                },
              });
            }

            /* ---------------------------------------------
               RETURN UPDATED RECEIVABLE
            --------------------------------------------- */

            return tx.accountsReceivable.findFirst({
              where: {
                id,
                organizationId,
              },
            });
          }
        );

      return res.status(200).json({
        success: true,

        message:
          receivable?.paymentStatus ===
          "PAID"
            ? "Customer invoice paid in full"
            : "Customer payment recorded successfully",

        receivable,
      });
    } catch (error) {
      console.error(
        "Record payment error:",
        error
      );

      if (
        error instanceof Error
      ) {
        if (
          error.message ===
          "RECEIVABLE_NOT_FOUND"
        ) {
          return res.status(404).json({
            success: false,
            message:
              "Customer invoice not found",
          });
        }

        if (
          error.message ===
          "RECEIVABLE_NOT_APPROVED"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Approve the invoice before recording a payment",
          });
        }

        if (
          error.message ===
          "RECEIVABLE_ALREADY_PAID"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "This invoice is already fully paid",
          });
        }

        if (
          error.message ===
          "PAYMENT_EXCEEDS_BALANCE"
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Payment cannot exceed the outstanding balance",
          });
        }
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to record customer payment",
      });
    }
  };


/* =========================================================
   DELETE RECEIVABLE
========================================================= */

export const deleteReceivable =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
      }

      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const existing =
        await prisma.accountsReceivable.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      /*
       * Tenant isolation is enforced through both:
       *
       * id
       * organizationId
       *
       * Permission middleware decides whether the
       * authenticated member has delete permission.
       */
      const deletion =
        await prisma.accountsReceivable.deleteMany({
          where: {
            id,
            organizationId,
          },
        });

      if (
        deletion.count !== 1
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Customer invoice deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete receivable error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete customer invoice",
      });
    }
  };