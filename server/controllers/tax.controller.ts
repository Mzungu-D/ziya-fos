import type { Response } from "express";
import prisma from "../config/prisma";
import { TAX_OBLIGATIONS, getTaxObligation } from "../constants/tax-obligations";
import type { AuthRequest } from "../middleware/auth.middleware";

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) {
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

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

function numberValue(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : NaN;
}

function dateValue(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
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
        message:
          "A tenant session is required.",
      });
    }

    const obligations =
      TAX_OBLIGATIONS.map(
        (obligation) => ({
          id: obligation.code,
          code: obligation.code,
          taxType: obligation.taxType,
          name: obligation.name,
          registrationNumber: null,
          filingFrequency:
            obligation.filingFrequency,
          dueRule: null,
          currency: "KES",
          isActive: true,
        })
      );

    return res.json({
      success: true,
      obligations,
    });
  } catch (error) {
    console.error(
      "[TAX] Failed to fetch obligations:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "TAX_OBLIGATIONS_FETCH_FAILED",
      message:
        "Failed to fetch tax obligations.",
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

    const filings = await prisma.taxFiling.findMany({
      where: {
        organizationId: context.organizationId,
      },
      include: {
        payrollPeriod: true,
        payments: true,
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    return res.json({
      success: true,
      filings,
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
      typeof req.body?.taxObligationCode === "string"
        ? req.body.taxObligationCode.trim()
        : "";

    const payrollPeriodId =
      typeof req.body?.payrollPeriodId === "string"
        ? req.body.payrollPeriodId.trim()
        : "";

    const taxPeriodStart = dateValue(
      req.body?.taxPeriodStart
    );

    const taxPeriodEnd = dateValue(
      req.body?.taxPeriodEnd
    );

    const dueDate = dateValue(
      req.body?.dueDate
    );

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

    const obligation =
      getTaxObligation(
        taxObligationCode
      );

    if (!obligation) {
      return res.status(404).json({
        success: false,
        code: "TAX_OBLIGATION_NOT_FOUND",
        message: "Tax obligation was not found.",
      });
    }

    const taxableAmount = numberValue(
      req.body?.taxableAmount
    );

    const taxAmount = numberValue(
      req.body?.taxAmount
    );

    const adjustments = numberValue(
      req.body?.adjustments
    );

    const penalties = numberValue(
      req.body?.penalties
    );

    const interest = numberValue(
      req.body?.interest
    );

    const amounts = [
      taxableAmount,
      taxAmount,
      adjustments,
      penalties,
      interest,
    ];

    if (
      amounts.some(
        (value) =>
          !Number.isFinite(value) ||
          value < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TAX_AMOUNT",
        message:
          "Tax amounts must be valid non-negative numbers.",
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
        });

      if (!payrollPeriod) {
        return res.status(404).json({
          success: false,
          code: "PAYROLL_PERIOD_NOT_FOUND",
          message: "Payroll period was not found.",
        });
      }
    }

    const totalPayable =
      taxAmount +
      adjustments +
      penalties +
      interest;

    const filing =
      await prisma.taxFiling.create({
        data: {
          organizationId:
            context.organizationId,

          taxObligationCode,

          payrollPeriodId:
            payrollPeriodId || null,

          taxPeriodStart,

          taxPeriodEnd,

          dueDate,

          taxableAmount,

          taxAmount,

          adjustments,

          penalties,

          interest,

          totalPayable,

          filingReference:
            typeof req.body?.filingReference ===
            "string"
              ? req.body.filingReference.trim() ||
                null
              : null,

          notes:
            typeof req.body?.notes ===
            "string"
              ? req.body.notes.trim() ||
                null
              : null,
        },

        include: {
          payrollPeriod: true,
          payments: true,
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Tax filing created successfully.",
      filing,
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
      typeof req.body?.taxFilingId === "string"
        ? req.body.taxFilingId.trim()
        : "";

    const paymentReference =
      typeof req.body?.paymentReference ===
      "string"
        ? req.body.paymentReference.trim()
        : "";

    const paymentMethod =
      typeof req.body?.paymentMethod ===
      "string"
        ? req.body.paymentMethod.trim()
        : "";

    const paymentDate = dateValue(
      req.body?.paymentDate
    );

    const amount = numberValue(
      req.body?.amount
    );

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
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TAX_PAYMENT_AMOUNT",
        message:
          "Payment amount must be a valid number greater than zero.",
      });
    }

    const filing =
      await prisma.taxFiling.findFirst({
        where: {
          id: taxFilingId,
          organizationId:
            context.organizationId,
        },
        include: {
          payments: true,
        },
      });

    if (!filing) {
      return res.status(404).json({
        success: false,
        code: "TAX_FILING_NOT_FOUND",
        message: "Tax filing was not found.",
      });
    }

    const existingPaidAmount =
      filing.payments
        .filter(
          (payment) =>
            payment.status === "COMPLETED"
        )
        .reduce(
          (total, payment) =>
            total + Number(payment.amount),
          0
        );

    const outstandingAmount =
      Number(filing.totalPayable) -
      existingPaidAmount;

    if (amount > outstandingAmount) {
      return res.status(400).json({
        success: false,
        code: "TAX_PAYMENT_EXCEEDS_BALANCE",
        message:
          "Payment amount cannot exceed the outstanding tax balance.",
      });
    }

    const payment =
      await prisma.$transaction(
        async (tx) => {
          const createdPayment =
            await tx.taxPayment.create({
              data: {
                organizationId:
                  context.organizationId,

                taxFilingId,

                paymentReference:
                  paymentReference || null,

                paymentDate,

                amount,

                paymentMethod,

                status: "COMPLETED",

                notes:
                  typeof req.body?.notes ===
                  "string"
                    ? req.body.notes.trim() ||
                      null
                    : null,
              },
            });

          const newPaidAmount =
            existingPaidAmount + amount;

          const newPaymentStatus =
            newPaidAmount >=
            Number(filing.totalPayable)
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

          return createdPayment;
        }
      );

    return res.status(201).json({
      success: true,
      message:
        "Tax payment recorded successfully.",
      payment,
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
        message: "A tenant session is required.",
      });
    }

    const payments =
      await prisma.taxPayment.findMany({
        where: {
          organizationId:
            context.organizationId,
        },

        include: {
          filing: true,
        },

        orderBy: {
          paymentDate: "desc",
        },
      });

    return res.json({
      success: true,
      payments,
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