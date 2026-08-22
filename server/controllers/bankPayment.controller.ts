import type { Request, Response } from "express";

import prisma from "../config/prisma";

import {
  createBankPayment,
  getBankPayment,
  getBankPaymentBatch,
  listBankPaymentBatches,
  listBankPayments,
} from "../services/bank/bankPayment.repository";

import {
  createAndExecuteBankPaymentBatch,
  executeBankPayment,
  generateBatchReference,
  generatePaymentReference,
  type BankPaymentAccount,
  type BankPaymentRecipient,
  type BankPaymentType,
} from "../services/bank/bankPayment.service";

/* =========================================================
   AUTHENTICATED REQUEST
========================================================= */

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    organizationId?: string;
  };
};

/* =========================================================
   REQUEST TYPES
========================================================= */

type CreatePaymentBody = {
  bankAccountId: string;
  beneficiaryName: string;
  paymentType?: BankPaymentType;

  accountNumber?: string;
  paybillNumber?: string;
  tillNumber?: string;
  accountReference?: string;

  bankCode?: string;
  branchCode?: string;

  amount: number;
  currency?: string;
  description?: string;
  paymentReference?: string;
  provider?: string;
  idempotencyKey?: string;
};

type PaymentRecipient = {
  beneficiaryName: string;
  paymentType?: BankPaymentType;

  accountNumber?: string;
  paybillNumber?: string;
  tillNumber?: string;
  accountReference?: string;

  bankCode?: string;
  branchCode?: string;

  amount: number;
  currency?: string;
  description?: string;
};

type CreateBatchBody = {
  bankAccountId: string;
  batchReference?: string;
  description?: string;
  provider?: string;
  idempotencyKey?: string;
  recipients: PaymentRecipient[];
};

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(
  req: AuthenticatedRequest,
): string {
  const organizationId =
    req.user?.organizationId;

  if (!organizationId) {
    throw new Error(
      "Authenticated organization is required.",
    );
  }

  return organizationId;
}

function validateAmount(
  value: unknown,
): number {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Payment amount must be greater than zero.",
    );
  }

  return Math.round(amount * 100) / 100;
}

function errorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Bank payment operation failed.";
}

function normalizeParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizePaymentType(
  value: unknown,
): BankPaymentType {
  const paymentType =
    String(value ?? "BANK_TRANSFER")
      .trim()
      .toUpperCase();

  if (
    paymentType !== "BANK_TRANSFER" &&
    paymentType !== "PAYBILL" &&
    paymentType !== "TILL"
  ) {
    throw new Error(
      `Unsupported payment type "${value}".`,
    );
  }

  return paymentType as BankPaymentType;
}

function validatePaymentDestination(
  recipient: {
    paymentType: BankPaymentType;
    accountNumber?: string;
    paybillNumber?: string;
    tillNumber?: string;
    accountReference?: string;
  },
  label: string,
): void {
  if (
    recipient.paymentType === "BANK_TRANSFER" &&
    !recipient.accountNumber?.trim()
  ) {
    throw new Error(
      `${label}: beneficiary account number is required for a bank transfer.`,
    );
  }

  if (
    recipient.paymentType === "PAYBILL" &&
    !recipient.paybillNumber?.trim()
  ) {
    throw new Error(
      `${label}: PayBill number is required.`,
    );
  }

  if (
    recipient.paymentType === "PAYBILL" &&
    !recipient.accountReference?.trim()
  ) {
    throw new Error(
      `${label}: account reference is required for a PayBill payment.`,
    );
  }

  if (
    recipient.paymentType === "TILL" &&
    !recipient.tillNumber?.trim()
  ) {
    throw new Error(
      `${label}: Till number is required.`,
    );
  }
}

/* =========================================================
   LOAD FUNDING BANK ACCOUNT
========================================================= */

async function getFundingBankAccount(
  organizationId: string,
  bankAccountId: string,
): Promise<BankPaymentAccount> {
  const account =
    await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        organizationId,
      },
    });

  if (!account) {
    throw new Error(
      "Bank account not found for this organization.",
    );
  }

  if (
    account.status !== "ACTIVE"
  ) {
    throw new Error(
      "The selected bank account is not active.",
    );
  }

  if (
    !account.integrationEnabled
  ) {
    throw new Error(
      "Bank integration is not enabled for this account.",
    );
  }

  if (
    account.connectionStatus
      .trim()
      .toUpperCase() !== "CONNECTED"
  ) {
    throw new Error(
      "The selected bank account is not connected to the bank provider.",
    );
  }

  return {
    id: account.id,

    bankName:
      account.bankName,

    accountName:
      account.accountName,

    accountNumber:
      account.accountNumber,

    currency:
      account.currency,

    integrationEnabled:
      account.integrationEnabled,

    integrationProvider:
      account.integrationProvider,

    apiBaseUrl:
      account.apiBaseUrl,

    apiKey:
      account.apiKey,

    apiSecret:
      account.apiSecret,

    connectionStatus:
      account.connectionStatus,
  };
}

/* =========================================================
   CREATE AND EXECUTE SINGLE PAYMENT
   POST /api/bank-payments
========================================================= */

export async function createBankPaymentController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const body =
      req.body as CreatePaymentBody;

    if (!body.bankAccountId?.trim()) {
      res.status(400).json({
        success: false,
        message:
          "Bank account is required.",
      });

      return;
    }

    if (
      !body.beneficiaryName?.trim()
    ) {
      res.status(400).json({
        success: false,
        message:
          "Beneficiary name is required.",
      });

      return;
    }

    const paymentType =
      normalizePaymentType(
        body.paymentType,
      );

    validatePaymentDestination(
      {
        paymentType,
        accountNumber:
          body.accountNumber,
        paybillNumber:
          body.paybillNumber,
        tillNumber:
          body.tillNumber,
        accountReference:
          body.accountReference,
      },
      "Payment",
    );

    const amount =
      validateAmount(
        body.amount,
      );

    const bankAccount =
      await getFundingBankAccount(
        organizationId,
        body.bankAccountId.trim(),
      );

    const batchReference =
      generateBatchReference();

    const paymentReference =
      body.paymentReference?.trim() ||
      generatePaymentReference();

    /*
     * Persist the payment first.
     *
     * The database record exists before the external
     * bank provider is contacted.
     */
    const created =
      await createBankPayment({
        organizationId,

        bankAccountId:
          bankAccount.id,

        batchId:
          undefined,

        paymentReference,

        beneficiaryName:
          body.beneficiaryName.trim(),

        paymentType,

        accountNumber:
          body.accountNumber?.trim() ||
          undefined,

        paybillNumber:
          body.paybillNumber?.trim() ||
          undefined,

        tillNumber:
          body.tillNumber?.trim() ||
          undefined,

        accountReference:
          body.accountReference?.trim() ||
          undefined,

        bankCode:
          body.bankCode?.trim() ||
          undefined,

        branchCode:
          body.branchCode?.trim() ||
          undefined,

        amount,

        currency:
          body.currency?.trim() ||
          bankAccount.currency ||
          "KES",

        description:
          body.description?.trim() ||
          "Ziya FOS bank payment",

        provider:
          body.provider?.trim() ||
          bankAccount.integrationProvider ||
          undefined,

        idempotencyKey:
          body.idempotencyKey?.trim() ||
          undefined,
      });

    const payment =
      created[0];

    if (!payment) {
      throw new Error(
        "Unable to create bank payment.",
      );
    }

    /*
     * Submit the payment to the bank.
     */
    const providerResult =
      await executeBankPayment({
        organizationId,

        batchReference,

        paymentReference,

        bankAccount,

        recipient: {
          paymentType,
          beneficiaryName:
            body.beneficiaryName.trim(),

          accountNumber:
            body.accountNumber?.trim() ||
            undefined,

          paybillNumber:
            body.paybillNumber?.trim() ||
            undefined,

          tillNumber:
            body.tillNumber?.trim() ||
            undefined,

          accountReference:
            body.accountReference?.trim() ||
            undefined,

          bankCode:
            body.bankCode?.trim() ||
            undefined,

          branchCode:
            body.branchCode?.trim() ||
            undefined,

          amount,

          currency:
            body.currency?.trim() ||
            bankAccount.currency ||
            "KES",

          description:
            body.description?.trim() ||
            "Ziya FOS bank payment",
        },
      });

    res.status(201).json({
      success: true,

      message:
        providerResult.status ===
        "COMPLETED"
          ? "Bank payment completed successfully."
          : providerResult.status ===
            "FAILED"
            ? "Bank payment failed."
            : "Bank payment submitted for processing.",

      payment,

      provider: {
        accepted:
          providerResult.accepted,

        status:
          providerResult.status,

        reference:
          providerResult.providerReference,

        providerStatus:
          providerResult.providerStatus,

        message:
          providerResult.providerMessage,
      },
    });
  } catch (error) {
    console.error(
      "Create bank payment error:",
      error,
    );

    res.status(400).json({
      success: false,
      message:
        errorMessage(error),
    });
  }
}

/* =========================================================
   CREATE + EXECUTE PAYMENT BATCH
   POST /api/bank-payments/batches
========================================================= */

export async function createBankPaymentBatchController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const body =
      req.body as CreateBatchBody;

    if (
      !body.bankAccountId?.trim()
    ) {
      res.status(400).json({
        success: false,
        message:
          "Bank account is required.",
      });

      return;
    }

    if (
      !Array.isArray(
        body.recipients,
      ) ||
      body.recipients.length === 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "At least one payment recipient is required.",
      });

      return;
    }

    /*
     * Validate every recipient before anything
     * is persisted or sent to the bank.
     */
    const recipients: BankPaymentRecipient[] =
      body.recipients.map(
        (
          recipient,
          index,
        ) => {
          if (
            !recipient.beneficiaryName?.trim()
          ) {
            throw new Error(
              `Recipient ${index + 1}: beneficiary name is required.`,
            );
          }

          const paymentType =
            normalizePaymentType(
              recipient.paymentType,
            );

          validatePaymentDestination(
            {
              paymentType,
              accountNumber:
                recipient.accountNumber,
              paybillNumber:
                recipient.paybillNumber,
              tillNumber:
                recipient.tillNumber,
              accountReference:
                recipient.accountReference,
            },
            `Recipient ${index + 1}`,
          );

          const amount =
            validateAmount(
              recipient.amount,
            );

          return {
            paymentType,

            beneficiaryName:
              recipient.beneficiaryName.trim(),

            accountNumber:
              recipient.accountNumber?.trim() ||
              undefined,

            paybillNumber:
              recipient.paybillNumber?.trim() ||
              undefined,

            tillNumber:
              recipient.tillNumber?.trim() ||
              undefined,

            accountReference:
              recipient.accountReference?.trim() ||
              undefined,

            bankCode:
              recipient.bankCode?.trim() ||
              undefined,

            branchCode:
              recipient.branchCode?.trim() ||
              undefined,

            amount,

            currency:
              recipient.currency?.trim() ||
              undefined,

            description:
              recipient.description?.trim() ||
              undefined,
          };
        },
      );

    const bankAccount =
      await getFundingBankAccount(
        organizationId,
        body.bankAccountId.trim(),
      );

    const batchReference =
      body.batchReference?.trim() ||
      generateBatchReference();

    /*
     * ATOMIC DATABASE CREATION
     *
     * Creates the batch and every payment record
     * in one PostgreSQL transaction before any
     * external bank request.
     */
    const result =
      await createAndExecuteBankPaymentBatch(
        organizationId,

        bankAccount,

        batchReference,

        recipients,

        {
          description:
            body.description?.trim() ||
            undefined,

          provider:
            body.provider?.trim() ||
            bankAccount.integrationProvider ||
            undefined,

          idempotencyKey:
            body.idempotencyKey?.trim() ||
            undefined,
        },
      );

    res.status(201).json({
      success: true,

      message:
        result.batch.status ===
        "SUCCESS"
          ? "All bank payments completed successfully."
          : result.batch.status ===
            "FAILED"
            ? "Bank payment batch failed."
            : result.batch.status ===
              "PARTIAL"
              ? "Bank payment batch partially completed."
              : "Bank payment batch submitted for processing.",

      batch:
        result.batch,

      payments:
        result.payments,

      summary: {
        totalAmount:
          result.totalAmount,

        totalPayments:
          result.totalPayments,

        successful:
          result.successful,

        failed:
          result.failed,

        pending:
          result.pending,
      },
    });
  } catch (error) {
    console.error(
      "Create bank payment batch error:",
      error,
    );

    res.status(400).json({
      success: false,
      message:
        errorMessage(error),
    });
  }
}

/* =========================================================
   GET SINGLE PAYMENT
   GET /api/bank-payments/:paymentId
========================================================= */

export async function getBankPaymentController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const paymentId =
      normalizeParam(
        req.params.paymentId,
      );

    if (!paymentId) {
      res.status(400).json({
        success: false,
        message:
          "Payment ID is required.",
      });

      return;
    }

    const result =
      await getBankPayment(
        organizationId,
        paymentId,
      );

    const payment =
      result[0];

    if (!payment) {
      res.status(404).json({
        success: false,
        message:
          "Bank payment not found.",
      });

      return;
    }

    res.status(200).json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error(
      "Get bank payment error:",
      error,
    );

    res.status(400).json({
      success: false,
      message:
        errorMessage(error),
    });
  }
}

/* =========================================================
   GET PAYMENT BATCH
   GET /api/bank-payments/batches/:batchId
========================================================= */

export async function getBankPaymentBatchController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const batchId =
      normalizeParam(
        req.params.batchId,
      );

    if (!batchId) {
      res.status(400).json({
        success: false,
        message:
          "Batch ID is required.",
      });

      return;
    }

    const result =
      await getBankPaymentBatch(
        organizationId,
        batchId,
      );

    const batch =
      result[0];

    if (!batch) {
      res.status(404).json({
        success: false,
        message:
          "Payment batch not found.",
      });

      return;
    }

    res.status(200).json({
      success: true,
      batch,
    });
  } catch (error) {
    console.error(
      "Get bank payment batch error:",
      error,
    );

    res.status(400).json({
      success: false,
      message:
        errorMessage(error),
    });
  }
}

/* =========================================================
   LIST PAYMENT BATCHES
   GET /api/bank-payments/batches
========================================================= */

export async function listBankPaymentBatchesController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const rawLimit =
      req.query.limit;

    const rawOffset =
      req.query.offset;

    const limitValue =
      Array.isArray(rawLimit)
        ? rawLimit[0]
        : rawLimit;

    const offsetValue =
      Array.isArray(rawOffset)
        ? rawOffset[0]
        : rawOffset;

    const limit =
      Number(
        limitValue ?? 50,
      );

    const offset =
      Number(
        offsetValue ?? 0,
      );

    const batches =
      await listBankPaymentBatches(
        organizationId,
        Number.isFinite(limit)
          ? limit
          : 50,
        Number.isFinite(offset)
          ? offset
          : 0,
      );

    res.status(200).json({
      success: true,
      batches,
      count: batches.length,
    });
  } catch (error) {
    console.error(
      "List bank payment batches error:",
      error,
    );

    res.status(400).json({
      success: false,
      message:
        errorMessage(error),
    });
  }
}

/* =========================================================
   LIST PAYMENTS
   GET /api/bank-payments
========================================================= */

export async function listBankPaymentsController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const rawLimit =
      req.query.limit;

    const rawOffset =
      req.query.offset;

    const limitValue =
      Array.isArray(rawLimit)
        ? rawLimit[0]
        : rawLimit;

    const offsetValue =
      Array.isArray(rawOffset)
        ? rawOffset[0]
        : rawOffset;

    const limit =
      Number(
        limitValue ?? 50,
      );

    const offset =
      Number(
        offsetValue ?? 0,
      );

    const payments =
      await listBankPayments(
        organizationId,

        Number.isFinite(limit)
          ? limit
          : 50,

        Number.isFinite(offset)
          ? offset
          : 0,
      );

    res.status(200).json({
      success: true,

      payments,

      count:
        payments.length,
    });
  } catch (error) {
    console.error(
      "List bank payments error:",
      error,
    );

    res.status(400).json({
      success: false,
      message:
        errorMessage(error),
    });
  }
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  createBankPaymentController,
  createBankPaymentBatchController,
  getBankPaymentController,
  getBankPaymentBatchController,
  listBankPaymentBatchesController,
  listBankPaymentsController,
};