import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import {
  TAX_OBLIGATIONS,
  getTaxObligation,
} from "../constants/tax-obligations";
import type { AuthRequest } from "../middleware/auth.middleware";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_TEXT_LENGTH = 255;
const MAX_NOTES_LENGTH = 5000;
const MAX_MONEY = 999999999999.99;
const MONEY_SCALE = 100;

const FILING_STATUSES = new Set([
  "DRAFT",
  "PREPARED",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
]);

const PAYMENT_STATUSES = new Set([
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
]);

const PAYMENT_RECORD_STATUSES = new Set([
  "COMPLETED",
  "VOID",
  "REVERSED",
]);

type TenantContext = {
  userId: string;
  organizationId: string;
};

function getTenantContext(req: AuthRequest): TenantContext | null {
  const userId = req.user?.userId?.trim();
  const organizationId = req.user?.organizationId?.trim();

  if (!userId || !organizationId) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  ).sessionType;

  if (sessionType && sessionType !== "TENANT") {
    return null;
  }

  return { userId, organizationId };
}

function textValue(
  value: unknown,
  maxLength = MAX_TEXT_LENGTH
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function optionalTextValue(
  value: unknown,
  maxLength = MAX_TEXT_LENGTH
): string | null {
  const valueText = textValue(value, maxLength);
  return valueText || null;
}

function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > MAX_MONEY
  ) {
    return null;
  }

  return Math.round(
    (parsed + Number.EPSILON) * MONEY_SCALE
  ) / MONEY_SCALE;
}

function decimalString(value: number): string {
  return value.toFixed(2);
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: unknown): number {
  const parsed = toNumber(value);

  return Math.round(
    (parsed + Number.EPSILON) * MONEY_SCALE
  ) / MONEY_SCALE;
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePagination(
  pageValue: unknown,
  limitValue: unknown
) {
  const pageRaw = pageValue === undefined
    ? 1
    : Number(pageValue);

  const limitRaw = limitValue === undefined
    ? DEFAULT_PAGE_SIZE
    : Number(limitValue);

  if (
    !Number.isInteger(pageRaw) ||
    pageRaw < 1
  ) {
    return null;
  }

  if (
    !Number.isInteger(limitRaw) ||
    limitRaw < 1 ||
    limitRaw > MAX_PAGE_SIZE
  ) {
    return null;
  }

  return {
    page: pageRaw,
    limit: limitRaw,
    skip: (pageRaw - 1) * limitRaw,
  };
}

function serializeTaxObligation(
  obligation: {
    id?: string;
    taxType?: string;
    name?: string;
    registrationNumber?: string | null;
    filingFrequency?: string;
    dueRule?: string | null;
    currency?: string;
    isActive?: boolean;
    notes?: string | null;
  } | null,
  fallbackCode?: string
) {
  if (!obligation) {
    const fallback = fallbackCode
      ? getTaxObligation(fallbackCode)
      : null;

    if (!fallback) {
      return {
        id: fallbackCode ?? "",
        code: fallbackCode ?? "",
        taxType: "UNKNOWN",
        name: fallbackCode || "Unknown tax obligation",
        registrationNumber: null,
        filingFrequency: "UNKNOWN",
        dueRule: null,
        currency: "KES",
        isActive: false,
        notes: null,
      };
    }

    return {
      id: fallback.code,
      code: fallback.code,
      taxType: fallback.taxType,
      name: fallback.name,
      registrationNumber: null,
      filingFrequency: fallback.filingFrequency,
      dueRule: null,
      currency: "KES",
      isActive: true,
      notes: null,
    };
  }

  return {
    id: obligation.id ?? fallbackCode ?? "",
    code: fallbackCode ?? obligation.id ?? "",
    taxType: obligation.taxType ?? "UNKNOWN",
    name: obligation.name ?? fallbackCode ?? "Unknown tax obligation",
    registrationNumber:
      obligation.registrationNumber ?? null,
    filingFrequency:
      obligation.filingFrequency ?? "UNKNOWN",
    dueRule: obligation.dueRule ?? null,
    currency: obligation.currency ?? "KES",
    isActive: obligation.isActive ?? false,
    notes: obligation.notes ?? null,
  };
}

function serializeTaxFiling<
  T extends { taxObligationCode: string }
>(filing: T) {
  return {
    ...filing,
    obligation: serializeTaxObligation(
      null,
      filing.taxObligationCode
    ),
  };
}

function serializeTaxPayment<
  T extends {
    amount: unknown;
  }
>(payment: T) {
  return {
    ...payment,
    amount: roundMoney(payment.amount),
  };
}

async function createAuditTrail(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  action: string,
  details: string
) {
  await tx.auditTrail.create({
    data: {
      organizationId,
      user: userId,
      action,
      module: "TAX",
      details,
    },
  });
}

/**
 * GET TAX OBLIGATIONS
 */
export const listTaxObligations = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const tenantObligations =
      await prisma.taxObligation.findMany({
        where: {
          organizationId: context.organizationId,
          isActive: true,
        },
        orderBy: [
          { taxType: "asc" },
          { name: "asc" },
          { id: "asc" },
        ],
      });

    const obligations =
      tenantObligations.length > 0
        ? tenantObligations.map((obligation) =>
            serializeTaxObligation(
              obligation,
              obligation.taxType
            )
          )
        : TAX_OBLIGATIONS.map((obligation) => ({
            id: obligation.code,
            code: obligation.code,
            taxType: obligation.taxType,
            name: obligation.name,
            registrationNumber: null,
            filingFrequency: obligation.filingFrequency,
            dueRule: null,
            currency: "KES",
            isActive: true,
            notes: null,
          }));

    return res.json({
      success: true,
      obligations,
      meta: {
        organizationId: context.organizationId,
        source:
          tenantObligations.length > 0
            ? "TENANT_CONFIGURATION"
            : "SYSTEM_DEFAULTS",
      },
    });
  } catch (error) {
    console.error(
      "[TAX] Failed to fetch obligations:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "TAX_OBLIGATIONS_FETCH_FAILED",
      message: "Failed to fetch tax obligations.",
    });
  }
};

/**
 * GET TAX FILINGS
 */
export const listTaxFilings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const pagination = parsePagination(
      req.query.page,
      req.query.limit
    );

    if (!pagination) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAGINATION",
        message:
          "Page must be a positive integer and limit must be between 1 and 100.",
      });
    }

    const search = textValue(
      req.query.search,
      100
    );

    const filingStatus = textValue(
      req.query.filingStatus,
      40
    ).toUpperCase();

    const paymentStatus = textValue(
      req.query.paymentStatus,
      40
    ).toUpperCase();

    if (
      filingStatus &&
      !FILING_STATUSES.has(filingStatus)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_FILING_STATUS",
        message: "Invalid filing status.",
      });
    }

    if (
      paymentStatus &&
      !PAYMENT_STATUSES.has(paymentStatus)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYMENT_STATUS",
        message: "Invalid payment status.",
      });
    }

    const where = {
      organizationId: context.organizationId,
      ...(filingStatus
        ? { filingStatus }
        : {}),
      ...(paymentStatus
        ? { paymentStatus }
        : {}),
      ...(search
        ? {
            OR: [
              {
                taxObligationCode: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                filingReference: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [
      totalRecords,
      filings,
    ] = await Promise.all([
      prisma.taxFiling.count({ where }),
      prisma.taxFiling.findMany({
        where,
        include: {
          payrollPeriod: true,
          payments: {
            orderBy: {
              paymentDate: "desc",
            },
          },
        },
        orderBy: [
          { dueDate: "asc" },
          { taxPeriodEnd: "desc" },
          { id: "asc" },
        ],
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    const enrichedFilings = filings.map(
      (filing) => ({
        ...serializeTaxFiling(filing),
        payments: filing.payments.map(
          serializeTaxPayment
        ),
      })
    );

    const totalPages =
      totalRecords === 0
        ? 0
        : Math.ceil(
            totalRecords / pagination.limit
          );

    return res.json({
      success: true,
      filings: enrichedFilings,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalRecords,
        totalPages,
        hasNextPage:
          pagination.page < totalPages,
        hasPreviousPage:
          pagination.page > 1 &&
          totalPages > 0,
      },
      meta: {
        organizationId:
          context.organizationId,
        filters: {
          search: search || null,
          filingStatus:
            filingStatus || null,
          paymentStatus:
            paymentStatus || null,
        },
      },
    });
  } catch (error) {
    console.error(
      "[TAX] Failed to fetch filings:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "TAX_FILINGS_FETCH_FAILED",
      message: "Failed to fetch tax filings.",
    });
  }
};

/**
 * CREATE TAX FILING
 */
export const createTaxFiling = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const taxObligationCode =
      textValue(
        req.body?.taxObligationCode,
        80
      ).toUpperCase();

    const payrollPeriodId =
      textValue(
        req.body?.payrollPeriodId,
        100
      );

    const taxPeriodStart =
      parseDate(
        req.body?.taxPeriodStart
      );

    const taxPeriodEnd =
      parseDate(
        req.body?.taxPeriodEnd
      );

    const dueDate =
      parseDate(req.body?.dueDate);

    if (
      !taxObligationCode ||
      !taxPeriodStart ||
      !taxPeriodEnd ||
      !dueDate
    ) {
      return res.status(400).json({
        success: false,
        code: "TAX_FILING_FIELDS_REQUIRED",
        message:
          "Tax obligation, tax period and due date are required.",
      });
    }

    if (
      taxPeriodEnd.getTime() <
      taxPeriodStart.getTime()
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TAX_PERIOD",
        message:
          "Tax period end date cannot be before the start date.",
      });
    }

    if (
      dueDate.getTime() <
      taxPeriodEnd.getTime()
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DUE_DATE",
        message:
          "Due date cannot be before the tax period end date.",
      });
    }

    const systemObligation =
      getTaxObligation(
        taxObligationCode
      );

    const tenantObligation =
      await prisma.taxObligation.findFirst({
        where: {
          organizationId:
            context.organizationId,
          isActive: true,
          OR: [
            { taxType: taxObligationCode },
            { id: taxObligationCode },
          ],
        },
      });

    if (
      !systemObligation &&
      !tenantObligation
    ) {
      return res.status(404).json({
        success: false,
        code: "TAX_OBLIGATION_NOT_FOUND",
        message: "Tax obligation was not found.",
      });
    }

    const taxableAmount =
      parseMoney(
        req.body?.taxableAmount
      );

    const taxAmount =
      parseMoney(
        req.body?.taxAmount
      );

    const adjustments =
      parseMoney(
        req.body?.adjustments
      );

    const penalties =
      parseMoney(
        req.body?.penalties
      );

    const interest =
      parseMoney(
        req.body?.interest
      );

    if (
      taxableAmount === null ||
      taxAmount === null ||
      adjustments === null ||
      penalties === null ||
      interest === null
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TAX_AMOUNT",
        message:
          "Tax amounts must be valid non-negative monetary values.",
      });
    }

    if (payrollPeriodId) {
      const payrollPeriod =
        await prisma.payrollPeriod.findFirst({
          where: {
            id: payrollPeriodId,
            organizationId:
              context.organizationId,
          },
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
          },
        });

      if (!payrollPeriod) {
        return res.status(404).json({
          success: false,
          code: "PAYROLL_PERIOD_NOT_FOUND",
          message:
            "Payroll period was not found.",
        });
      }

      if (
        payrollPeriod.periodStart.getTime() >
          taxPeriodStart.getTime() ||
        payrollPeriod.periodEnd.getTime() <
          taxPeriodEnd.getTime()
      ) {
        return res.status(400).json({
          success: false,
          code: "PAYROLL_PERIOD_MISMATCH",
          message:
            "The selected payroll period does not cover the tax period.",
        });
      }
    }

    const totalPayable =
      roundMoney(
        taxAmount +
          adjustments +
          penalties +
          interest
      );

    const filingReference =
      optionalTextValue(
        req.body?.filingReference,
        MAX_TEXT_LENGTH
      );

    const notes =
      optionalTextValue(
        req.body?.notes,
        MAX_NOTES_LENGTH
      );

    const filing =
      await prisma.$transaction(
        async (tx) => {
          const created =
            await tx.taxFiling.create({
              data: {
                organizationId:
                  context.organizationId,
                taxObligationCode,
                payrollPeriodId:
                  payrollPeriodId || null,
                taxPeriodStart,
                taxPeriodEnd,
                dueDate,
                taxableAmount:
                  decimalString(
                    taxableAmount
                  ),
                taxAmount:
                  decimalString(
                    taxAmount
                  ),
                adjustments:
                  decimalString(
                    adjustments
                  ),
                penalties:
                  decimalString(
                    penalties
                  ),
                interest:
                  decimalString(
                    interest
                  ),
                totalPayable:
                  decimalString(
                    totalPayable
                  ),
                filingReference,
                notes,
                preparedBy:
                  context.userId,
                filingStatus: "DRAFT",
                paymentStatus: "UNPAID",
              },
              include: {
                payrollPeriod: true,
                payments: true,
              },
            });

          await createAuditTrail(
            tx,
            context.organizationId,
            context.userId,
            "TAX_FILING_CREATED",
            JSON.stringify({
              taxFilingId: created.id,
              taxObligationCode,
              taxPeriodStart:
                taxPeriodStart.toISOString(),
              taxPeriodEnd:
                taxPeriodEnd.toISOString(),
              totalPayable,
            })
          );

          return created;
        }
      );

    return res.status(201).json({
      success: true,
      message:
        "Tax filing created successfully.",
      filing: serializeTaxFiling(filing),
    });
  } catch (error) {
    console.error(
      "[TAX] Failed to create filing:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "TAX_FILING_CREATE_FAILED",
      message: "Failed to create tax filing.",
    });
  }
};

/**
 * RECORD TAX PAYMENT
 *
 * Payment settlement is protected by a row lock on the filing,
 * so concurrent requests cannot overpay the same liability.
 */
export const createTaxPayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const taxFilingId =
      textValue(
        req.body?.taxFilingId,
        100
      );

    const paymentReference =
      optionalTextValue(
        req.body?.paymentReference,
        MAX_TEXT_LENGTH
      );

    const paymentMethod =
      textValue(
        req.body?.paymentMethod,
        80
      ).toUpperCase();

    const paymentDate =
      parseDate(
        req.body?.paymentDate
      );

    const amount =
      parseMoney(req.body?.amount);

    if (
      !taxFilingId ||
      !paymentDate ||
      !paymentMethod
    ) {
      return res.status(400).json({
        success: false,
        code: "TAX_PAYMENT_FIELDS_REQUIRED",
        message:
          "Tax filing, payment date and payment method are required.",
      });
    }

    if (
      amount === null ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TAX_PAYMENT_AMOUNT",
        message:
          "Payment amount must be greater than zero and within the supported monetary range.",
      });
    }

    const notes =
      optionalTextValue(
        req.body?.notes,
        MAX_NOTES_LENGTH
      );

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Lock the filing so two simultaneous payments cannot
           * both calculate the same outstanding balance.
           */
          const lockedRows =
            await tx.$queryRaw<
              Array<{ id: string }>
            >`
              SELECT "id"
              FROM "TaxFiling"
              WHERE "id" = ${taxFilingId}
                AND "organizationId" =
                  ${context.organizationId}
              FOR UPDATE
            `;

          if (lockedRows.length === 0) {
            return {
              kind: "NOT_FOUND" as const,
            };
          }

          const filing =
            await tx.taxFiling.findFirst({
              where: {
                id: taxFilingId,
                organizationId:
                  context.organizationId,
              },
              select: {
                id: true,
                totalPayable: true,
                paymentStatus: true,
                filingStatus: true,
              },
            });

          if (!filing) {
            return {
              kind: "NOT_FOUND" as const,
            };
          }

          if (
            filing.filingStatus ===
              "CANCELLED"
          ) {
            return {
              kind: "CANCELLED" as const,
            };
          }

          if (
            filing.filingStatus ===
              "REJECTED"
          ) {
            return {
              kind: "REJECTED" as const,
            };
          }

          if (
            paymentReference
          ) {
            /*
             * Serialize same-reference payments across the tenant.
             * This supplements the existing schema, which has no
             * unique payment-reference constraint.
             */
            await tx.$queryRaw`
              SELECT pg_advisory_xact_lock(
                hashtext(
                  ${`TAX-PAYMENT:${context.organizationId}:${paymentReference}`}
                )
              )
            `;

            const duplicate =
              await tx.taxPayment.findFirst({
                where: {
                  organizationId:
                    context.organizationId,
                  paymentReference,
                  status: "COMPLETED",
                },
                select: {
                  id: true,
                },
              });

            if (duplicate) {
              return {
                kind: "DUPLICATE_REFERENCE" as const,
                paymentId:
                  duplicate.id,
              };
            }
          }

          const paidAggregate =
            await tx.taxPayment.aggregate({
              where: {
                organizationId:
                  context.organizationId,
                taxFilingId,
                status: "COMPLETED",
              },
              _sum: {
                amount: true,
              },
            });

          const paidAmount =
            roundMoney(
              paidAggregate._sum.amount
            );

          const totalPayable =
            roundMoney(
              filing.totalPayable
            );

          const outstanding =
            roundMoney(
              totalPayable -
                paidAmount
            );

          if (
            outstanding <= 0
          ) {
            return {
              kind: "ALREADY_PAID" as const,
            };
          }

          if (
            amount > outstanding
          ) {
            return {
              kind: "EXCEEDS_BALANCE" as const,
              outstanding,
            };
          }

          const payment =
            await tx.taxPayment.create({
              data: {
                organizationId:
                  context.organizationId,
                taxFilingId,
                paymentReference,
                paymentDate,
                amount:
                  decimalString(amount),
                paymentMethod,
                status: "COMPLETED",
                notes,
              },
            });

          const newPaidAmount =
            roundMoney(
              paidAmount + amount
            );

          const newPaymentStatus =
            newPaidAmount >=
            totalPayable
              ? "PAID"
              : "PARTIALLY_PAID";

          await tx.taxFiling.update({
            where: {
              id: taxFilingId,
            },
            data: {
              paymentStatus:
                newPaymentStatus,
            },
          });

          await createAuditTrail(
            tx,
            context.organizationId,
            context.userId,
            "TAX_PAYMENT_RECORDED",
            JSON.stringify({
              taxFilingId,
              taxPaymentId:
                payment.id,
              amount,
              paymentReference,
              paymentMethod,
              paymentDate:
                paymentDate.toISOString(),
              paymentStatus:
                newPaymentStatus,
            })
          );

          return {
            kind: "SUCCESS" as const,
            payment,
            paymentStatus:
              newPaymentStatus,
          };
        }
      );

    if (result.kind === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        code: "TAX_FILING_NOT_FOUND",
        message:
          "Tax filing was not found.",
      });
    }

    if (
      result.kind === "CANCELLED" ||
      result.kind === "REJECTED"
    ) {
      return res.status(409).json({
        success: false,
        code:
          result.kind === "CANCELLED"
            ? "TAX_FILING_CANCELLED"
            : "TAX_FILING_REJECTED",
        message:
          result.kind === "CANCELLED"
            ? "A cancelled tax filing cannot receive payments."
            : "A rejected tax filing cannot receive payments.",
      });
    }

    if (
      result.kind ===
      "DUPLICATE_REFERENCE"
    ) {
      return res.status(409).json({
        success: false,
        code:
          "DUPLICATE_PAYMENT_REFERENCE",
        message:
          "A completed tax payment with this reference already exists.",
        paymentId:
          result.paymentId,
      });
    }

    if (
      result.kind === "ALREADY_PAID"
    ) {
      return res.status(409).json({
        success: false,
        code: "TAX_FILING_ALREADY_PAID",
        message:
          "The tax filing is already fully paid.",
      });
    }

    if (
      result.kind ===
      "EXCEEDS_BALANCE"
    ) {
      return res.status(400).json({
        success: false,
        code:
          "TAX_PAYMENT_EXCEEDS_BALANCE",
        message:
          "Payment amount cannot exceed the outstanding tax balance.",
        outstandingAmount:
          result.outstanding,
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Tax payment recorded successfully.",
      payment:
        serializeTaxPayment(
          result.payment
        ),
      paymentStatus:
        result.paymentStatus,
    });
  } catch (error) {
    console.error(
      "[TAX] Failed to record payment:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "TAX_PAYMENT_CREATE_FAILED",
      message:
        "Failed to record tax payment.",
    });
  }
};

/**
 * LIST TAX PAYMENTS
 */
export const listTaxPayments = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
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
        code: "INVALID_PAGINATION",
        message:
          "Page must be a positive integer and limit must be between 1 and 100.",
      });
    }

    const search =
      textValue(
        req.query.search,
        100
      );

    const where = {
      organizationId:
        context.organizationId,
      ...(search
        ? {
            OR: [
              {
                paymentReference: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                paymentMethod: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [
      totalRecords,
      payments,
    ] = await Promise.all([
      prisma.taxPayment.count({
        where,
      }),
      prisma.taxPayment.findMany({
        where,
        include: {
          filing: true,
        },
        orderBy: [
          { paymentDate: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    const totalPages =
      totalRecords === 0
        ? 0
        : Math.ceil(
            totalRecords /
              pagination.limit
          );

    return res.json({
      success: true,
      payments:
        payments.map(
          (payment) => ({
            ...serializeTaxPayment(
              payment
            ),
            filing:
              serializeTaxFiling(
                payment.filing
              ),
          })
        ),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalRecords,
        totalPages,
        hasNextPage:
          pagination.page < totalPages,
        hasPreviousPage:
          pagination.page > 1 &&
          totalPages > 0,
      },
      meta: {
        organizationId:
          context.organizationId,
        filters: {
          search: search || null,
        },
      },
    });
  } catch (error) {
    console.error(
      "[TAX] Failed to fetch payments:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "TAX_PAYMENTS_FETCH_FAILED",
      message:
        "Failed to fetch tax payments.",
    });
  }
};
