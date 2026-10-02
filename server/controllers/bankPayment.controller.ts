import type { Request, Response } from "express";

import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

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
   CONSTANTS
========================================================= */

const MAX_ID_LENGTH = 100;
const MAX_TEXT_LENGTH = 200;
const MAX_REFERENCE_LENGTH = 100;
const MAX_ACCOUNT_NUMBER_LENGTH = 100;

const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_OFFSET = 1_000_000;

const MAX_PAYMENT_AMOUNT = 999_999_999_999.99;
const MAX_BATCH_RECIPIENTS = 500;

/* =========================================================
   HTTP ERROR
========================================================= */

class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(
    statusCode: number,
    code: string,
    message: string,
  ) {
    super(message);

    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/* =========================================================
   ORGANIZATION CONTEXT
========================================================= */

function getOrganizationId(
  req: AuthenticatedRequest,
): string {
  const organizationId =
    req.user?.organizationId?.trim();

  if (!organizationId) {
    throw new HttpError(
      401,
      "AUTH_REQUIRED",
      "Authenticated organization is required.",
    );
  }

  if (organizationId.length > MAX_ID_LENGTH) {
    throw new HttpError(
      401,
      "AUTH_INVALID",
      "Authenticated organization is invalid.",
    );
  }

  return organizationId;
}

/* =========================================================
   ACTOR CONTEXT
========================================================= */

function getActorId(
  req: AuthenticatedRequest,
): string {
  const actorId =
    req.user?.userId?.trim() ||
    req.user?.id?.trim();

  if (!actorId) {
    throw new HttpError(
      401,
      "AUTH_REQUIRED",
      "Authenticated user is required.",
    );
  }

  return actorId;
}

/* =========================================================
   STRING VALIDATION
========================================================= */

function normalizeText(
  value: unknown,
  field: string,
  maxLength = MAX_TEXT_LENGTH,
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} must be a string.`,
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} exceeds the maximum allowed length.`,
    );
  }

  return normalized;
}

function normalizeRequiredText(
  value: unknown,
  field: string,
  maxLength = MAX_TEXT_LENGTH,
): string {
  const normalized = normalizeText(
    value,
    field,
    maxLength,
  );

  if (!normalized) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} is required.`,
    );
  }

  return normalized;
}

/* =========================================================
   MONEY VALIDATION
========================================================= */

function validateAmount(
  value: unknown,
): number {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : NaN;

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > MAX_PAYMENT_AMOUNT
  ) {
    throw new HttpError(
      400,
      "INVALID_AMOUNT",
      "Payment amount must be greater than zero and within the permitted limit.",
    );
  }

  return (
    Math.round(
      (amount + Number.EPSILON) * 100,
    ) / 100
  );
}

/* =========================================================
   ROUTE PARAMETER
========================================================= */

function normalizeParam(
  value: string | string[] | undefined,
  field: string,
): string | undefined {
  const normalized = Array.isArray(value)
    ? value[0]
    : value;

  if (
    normalized === undefined ||
    normalized === null
  ) {
    return undefined;
  }

  if (typeof normalized !== "string") {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} is invalid.`,
    );
  }

  const trimmed = normalized.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > MAX_ID_LENGTH) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} is invalid.`,
    );
  }

  return trimmed;
}

/* =========================================================
   CURRENCY
========================================================= */

function normalizeCurrency(
  value: unknown,
  fallback: string,
): string {
  const currency =
    normalizeText(
      value,
      "Currency",
      3,
    ) ?? fallback;

  const normalized =
    currency.toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new HttpError(
      400,
      "INVALID_CURRENCY",
      "Currency must be a valid three-letter ISO currency code.",
    );
  }

  return normalized;
}

/* =========================================================
   PAYMENT TYPE
========================================================= */

function normalizePaymentType(
  value: unknown,
): BankPaymentType {
  const paymentType =
    String(
      value ?? "BANK_TRANSFER",
    )
      .trim()
      .toUpperCase();

  if (
    paymentType !== "BANK_TRANSFER" &&
    paymentType !== "PAYBILL" &&
    paymentType !== "TILL"
  ) {
    throw new HttpError(
      400,
      "INVALID_PAYMENT_TYPE",
      "Unsupported payment type.",
    );
  }

  return paymentType as BankPaymentType;
}

/* =========================================================
   PAYMENT DESTINATION
========================================================= */

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
    recipient.paymentType ===
      "BANK_TRANSFER" &&
    !recipient.accountNumber?.trim()
  ) {
    throw new HttpError(
      400,
      "INVALID_DESTINATION",
      `${label}: beneficiary account number is required for a bank transfer.`,
    );
  }

  if (
    recipient.paymentType ===
      "PAYBILL" &&
    !recipient.paybillNumber?.trim()
  ) {
    throw new HttpError(
      400,
      "INVALID_DESTINATION",
      `${label}: PayBill number is required.`,
    );
  }

  if (
    recipient.paymentType ===
      "PAYBILL" &&
    !recipient.accountReference?.trim()
  ) {
    throw new HttpError(
      400,
      "INVALID_DESTINATION",
      `${label}: account reference is required for a PayBill payment.`,
    );
  }

  if (
    recipient.paymentType === "TILL" &&
    !recipient.tillNumber?.trim()
  ) {
    throw new HttpError(
      400,
      "INVALID_DESTINATION",
      `${label}: Till number is required.`,
    );
  }
}

/* =========================================================
   PAGINATION
========================================================= */

function parsePagination(
  value: string | string[] | undefined,
  field: string,
  defaultValue: number,
  max: number,
  minimum: number,
): number {
  const raw = Array.isArray(value)
    ? value[0]
    : value;

  if (
    raw === undefined ||
    raw === null ||
    raw === ""
  ) {
    return defaultValue;
  }

  if (!/^\d+$/.test(raw)) {
    throw new HttpError(
      400,
      "INVALID_PAGINATION",
      `${field} must be a non-negative integer.`,
    );
  }

  const parsed = Number(raw);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    parsed > max
  ) {
    throw new HttpError(
      400,
      "INVALID_PAGINATION",
      `${field} is outside the permitted range.`,
    );
  }

  return parsed;
}

/* =========================================================
   ERROR NORMALIZATION
========================================================= */

function getErrorResponse(
  error: unknown,
): {
  status: number;
  code: string;
  message: string;
} {
  if (error instanceof HttpError) {
    return {
      status: error.statusCode,
      code: error.code,
      message: error.message,
    };
  }

  if (
    error instanceof
      Prisma.PrismaClientKnownRequestError
  ) {
    if (error.code === "P2002") {
      return {
        status: 409,
        code: "DUPLICATE_PAYMENT",
        message:
          "A payment with the supplied unique reference already exists.",
      };
    }

    if (error.code === "P2025") {
      return {
        status: 404,
        code: "PAYMENT_NOT_FOUND",
        message:
          "The requested bank payment was not found.",
      };
    }
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : "";

  if (
    message.includes("idempotency")
  ) {
    return {
      status: 409,
      code: "IDEMPOTENCY_CONFLICT",
      message:
        "The supplied idempotency key conflicts with an existing payment operation.",
    };
  }

  if (
    message.includes("not found")
  ) {
    return {
      status: 404,
      code: "RESOURCE_NOT_FOUND",
      message:
        "The requested banking resource was not found.",
    };
  }

  if (
    message.includes("not active") ||
    message.includes("not connected") ||
    message.includes("not enabled")
  ) {
    return {
      status: 409,
      code: "BANK_ACCOUNT_NOT_READY",
      message:
        "The selected bank account is not ready for payment processing.",
    };
  }

  if (
    message.includes("provider") ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return {
      status: 502,
      code: "BANK_PROVIDER_ERROR",
      message:
        "The bank provider could not complete the payment request.",
    };
  }

  return {
    status: 500,
    code: "BANK_PAYMENT_OPERATION_FAILED",
    message:
      "The bank payment operation could not be completed.",
  };
}

function sendError(
  res: Response,
  error: unknown,
): void {
  const response =
    getErrorResponse(error);

  res.status(response.status).json({
    success: false,
    code: response.code,
    message: response.message,
  });
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
    throw new HttpError(
      404,
      "BANK_ACCOUNT_NOT_FOUND",
      "Bank account not found for this organization.",
    );
  }

  if (
    account.status !== "ACTIVE"
  ) {
    throw new HttpError(
      409,
      "BANK_ACCOUNT_INACTIVE",
      "The selected bank account is not active.",
    );
  }

  if (
    !account.integrationEnabled
  ) {
    throw new HttpError(
      409,
      "BANK_INTEGRATION_DISABLED",
      "Bank integration is not enabled for this account.",
    );
  }

  if (
    account.connectionStatus
      .trim()
      .toUpperCase() !==
    "CONNECTED"
  ) {
    throw new HttpError(
      409,
      "BANK_NOT_CONNECTED",
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
========================================================= */

export async function createBankPaymentController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const actorId =
      getActorId(req);

    const body =
      (req.body ?? {}) as Partial<CreatePaymentBody>;

    const bankAccountId =
      normalizeRequiredText(
        body.bankAccountId,
        "Bank account ID",
        MAX_ID_LENGTH,
      );

    const beneficiaryName =
      normalizeRequiredText(
        body.beneficiaryName,
        "Beneficiary name",
      );

    const paymentType =
      normalizePaymentType(
        body.paymentType,
      );

    const accountNumber =
      normalizeText(
        body.accountNumber,
        "Account number",
        MAX_ACCOUNT_NUMBER_LENGTH,
      );

    const paybillNumber =
      normalizeText(
        body.paybillNumber,
        "PayBill number",
        MAX_ACCOUNT_NUMBER_LENGTH,
      );

    const tillNumber =
      normalizeText(
        body.tillNumber,
        "Till number",
        MAX_ACCOUNT_NUMBER_LENGTH,
      );

    const accountReference =
      normalizeText(
        body.accountReference,
        "Account reference",
        MAX_REFERENCE_LENGTH,
      );

    const bankCode =
      normalizeText(
        body.bankCode,
        "Bank code",
        50,
      );

    const branchCode =
      normalizeText(
        body.branchCode,
        "Branch code",
        50,
      );

    const amount =
      validateAmount(body.amount);

    const description =
      normalizeText(
        body.description,
        "Description",
      ) ??
      "Bank payment";

    const paymentReference =
      normalizeText(
        body.paymentReference,
        "Payment reference",
        MAX_REFERENCE_LENGTH,
      );

    const provider =
      normalizeText(
        body.provider,
        "Provider",
      );

    const idempotencyKey =
      normalizeText(
        body.idempotencyKey,
        "Idempotency key",
        MAX_REFERENCE_LENGTH,
      );

    validatePaymentDestination(
      {
        paymentType,
        accountNumber,
        paybillNumber,
        tillNumber,
        accountReference,
      },
      "Payment",
    );

    const bankAccount =
      await getFundingBankAccount(
        organizationId,
        bankAccountId,
      );

    const currency =
      normalizeCurrency(
        body.currency,
        bankAccount.currency ||
          "KES",
      );

    if (
      currency !==
      bankAccount.currency.toUpperCase()
    ) {
      throw new HttpError(
        400,
        "CURRENCY_MISMATCH",
        "Payment currency must match the funding bank account currency.",
      );
    }

    const batchReference =
      generateBatchReference();

    const generatedPaymentReference =
      paymentReference ??
      generatePaymentReference();

    const created =
      await createBankPayment({
        organizationId,
        bankAccountId:
          bankAccount.id,
        batchId:
          undefined,
        paymentReference:
          generatedPaymentReference,
        beneficiaryName,
        paymentType,
        accountNumber,
        paybillNumber,
        tillNumber,
        accountReference,
        bankCode,
        branchCode,
        amount,
        currency,
        description,
        provider:
          provider ??
          bankAccount.integrationProvider ??
          undefined,
        idempotencyKey,
      });

    const payment =
      created[0];

    if (!payment) {
      throw new HttpError(
        500,
        "PAYMENT_CREATION_FAILED",
        "Unable to create bank payment.",
      );
    }

    const providerResult =
      await executeBankPayment({
        organizationId,
        batchReference,
        paymentReference:
          generatedPaymentReference,
        bankAccount,
        recipient: {
          paymentType,
          beneficiaryName,
          accountNumber,
          paybillNumber,
          tillNumber,
          accountReference,
          bankCode,
          branchCode,
          amount,
          currency,
          description,
        },
      });

    void actorId;

    const providerStatus =
      String(
        providerResult.status ??
          "",
      ).toUpperCase();

    res.status(
      providerStatus === "FAILED"
        ? 200
        : providerStatus ===
            "COMPLETED"
          ? 200
          : 202,
    ).json({
      success:
        providerStatus ===
        "COMPLETED",

      code:
        providerStatus ===
        "COMPLETED"
          ? "BANK_PAYMENT_COMPLETED"
          : providerStatus ===
              "FAILED"
            ? "BANK_PAYMENT_FAILED"
            : "BANK_PAYMENT_PROCESSING",

      message:
        providerStatus ===
        "COMPLETED"
          ? "Bank payment completed successfully."
          : providerStatus ===
              "FAILED"
            ? "Bank payment failed."
            : "Bank payment submitted for processing.",

      payment,

      provider: {
        accepted:
          providerResult.accepted,

        status:
          providerStatus,

        reference:
          providerResult.providerReference ??
          null,

        providerStatus:
          providerResult.providerStatus ??
          null,

        message:
          providerResult.providerMessage ??
          null,
      },
    });
  } catch (error: unknown) {
    console.error(
      "[BANK PAYMENT] CREATE ERROR:",
      error,
    );

    sendError(
      res,
      error,
    );
  }
}

/* =========================================================
   CREATE + EXECUTE PAYMENT BATCH
========================================================= */

export async function createBankPaymentBatchController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const actorId =
      getActorId(req);

    const body =
      (req.body ?? {}) as Partial<CreateBatchBody>;

    const bankAccountId =
      normalizeRequiredText(
        body.bankAccountId,
        "Bank account ID",
        MAX_ID_LENGTH,
      );

    if (
      !Array.isArray(body.recipients) ||
      body.recipients.length === 0
    ) {
      throw new HttpError(
        400,
        "RECIPIENTS_REQUIRED",
        "At least one payment recipient is required.",
      );
    }

    if (
      body.recipients.length >
      MAX_BATCH_RECIPIENTS
    ) {
      throw new HttpError(
        400,
        "RECIPIENT_LIMIT_EXCEEDED",
        `A payment batch cannot contain more than ${MAX_BATCH_RECIPIENTS} recipients.`,
      );
    }

    const bankAccount =
      await getFundingBankAccount(
        organizationId,
        bankAccountId,
      );

    const recipients:
      BankPaymentRecipient[] =
      body.recipients.map(
        (recipient, index) => {
          if (
            !recipient ||
            typeof recipient !==
              "object"
          ) {
            throw new HttpError(
              400,
              "INVALID_RECIPIENT",
              `Recipient ${index + 1} is invalid.`,
            );
          }

          const beneficiaryName =
            normalizeRequiredText(
              recipient.beneficiaryName,
              `Recipient ${index + 1} beneficiary name`,
            );

          const paymentType =
            normalizePaymentType(
              recipient.paymentType,
            );

          const accountNumber =
            normalizeText(
              recipient.accountNumber,
              `Recipient ${index + 1} account number`,
              MAX_ACCOUNT_NUMBER_LENGTH,
            );

          const paybillNumber =
            normalizeText(
              recipient.paybillNumber,
              `Recipient ${index + 1} PayBill number`,
              MAX_ACCOUNT_NUMBER_LENGTH,
            );

          const tillNumber =
            normalizeText(
              recipient.tillNumber,
              `Recipient ${index + 1} Till number`,
              MAX_ACCOUNT_NUMBER_LENGTH,
            );

          const accountReference =
            normalizeText(
              recipient.accountReference,
              `Recipient ${index + 1} account reference`,
              MAX_REFERENCE_LENGTH,
            );

          const bankCode =
            normalizeText(
              recipient.bankCode,
              `Recipient ${index + 1} bank code`,
              50,
            );

          const branchCode =
            normalizeText(
              recipient.branchCode,
              `Recipient ${index + 1} branch code`,
              50,
            );

          const amount =
            validateAmount(
              recipient.amount,
            );

          const currency =
            recipient.currency
              ? normalizeCurrency(
                  recipient.currency,
                  bankAccount.currency,
                )
              : bankAccount.currency.toUpperCase();

          if (
            currency !==
            bankAccount.currency.toUpperCase()
          ) {
            throw new HttpError(
              400,
              "CURRENCY_MISMATCH",
              `Recipient ${index + 1} currency must match the funding bank account currency.`,
            );
          }

          const description =
            normalizeText(
              recipient.description,
              `Recipient ${index + 1} description`,
            );

          validatePaymentDestination(
            {
              paymentType,
              accountNumber,
              paybillNumber,
              tillNumber,
              accountReference,
            },
            `Recipient ${index + 1}`,
          );

          return {
            paymentType,
            beneficiaryName,
            accountNumber,
            paybillNumber,
            tillNumber,
            accountReference,
            bankCode,
            branchCode,
            amount,
            currency,
            description,
          };
        },
      );

    const batchReference =
      normalizeText(
        body.batchReference,
        "Batch reference",
        MAX_REFERENCE_LENGTH,
      ) ??
      generateBatchReference();

    const description =
      normalizeText(
        body.description,
        "Description",
      );

    const provider =
      normalizeText(
        body.provider,
        "Provider",
      );

    const idempotencyKey =
      normalizeText(
        body.idempotencyKey,
        "Idempotency key",
        MAX_REFERENCE_LENGTH,
      );

    const result =
      await createAndExecuteBankPaymentBatch(
        organizationId,
        bankAccount,
        batchReference,
        recipients,
        {
          description,
          provider:
            provider ??
            bankAccount.integrationProvider ??
            undefined,
          idempotencyKey,
        },
      );

    void actorId;

    const status =
      String(
        result.batch.status ??
          "",
      ).toUpperCase();

    const httpStatus =
      status === "FAILED"
        ? 200
        : status === "SUCCESS"
          ? 200
          : 202;

    res.status(httpStatus).json({
      success:
        status === "SUCCESS",

      code:
        status === "SUCCESS"
          ? "BANK_PAYMENT_BATCH_COMPLETED"
          : status === "FAILED"
            ? "BANK_PAYMENT_BATCH_FAILED"
            : "BANK_PAYMENT_BATCH_PROCESSING",

      message:
        status === "SUCCESS"
          ? "All bank payments completed successfully."
          : status === "FAILED"
            ? "Bank payment batch failed."
            : status === "PARTIAL"
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
  } catch (error: unknown) {
    console.error(
      "[BANK PAYMENT] BATCH CREATE ERROR:",
      error,
    );

    sendError(
      res,
      error,
    );
  }
}

/* =========================================================
   GET SINGLE PAYMENT
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
        "Payment ID",
      );

    if (!paymentId) {
      throw new HttpError(
        400,
        "PAYMENT_ID_REQUIRED",
        "Payment ID is required.",
      );
    }

    const result =
      await getBankPayment(
        organizationId,
        paymentId,
      );

    const payment =
      result[0];

    if (!payment) {
      throw new HttpError(
        404,
        "PAYMENT_NOT_FOUND",
        "Bank payment not found.",
      );
    }

    res.status(200).json({
      success: true,
      payment,
    });
  } catch (error: unknown) {
    console.error(
      "[BANK PAYMENT] GET ERROR:",
      error,
    );

    sendError(
      res,
      error,
    );
  }
}

/* =========================================================
   GET PAYMENT BATCH
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
        "Batch ID",
      );

    if (!batchId) {
      throw new HttpError(
        400,
        "BATCH_ID_REQUIRED",
        "Batch ID is required.",
      );
    }

    const result =
      await getBankPaymentBatch(
        organizationId,
        batchId,
      );

    const batch =
      result[0];

    if (!batch) {
      throw new HttpError(
        404,
        "BATCH_NOT_FOUND",
        "Payment batch not found.",
      );
    }

    res.status(200).json({
      success: true,
      batch,
    });
  } catch (error: unknown) {
    console.error(
      "[BANK PAYMENT] GET BATCH ERROR:",
      error,
    );

    sendError(
      res,
      error,
    );
  }
}

/* =========================================================
   LIST PAYMENT BATCHES
========================================================= */

export async function listBankPaymentBatchesController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const limit =
      parsePagination(
        (typeof req.query.limit === "string" ? req.query.limit : undefined),
        "limit",
        DEFAULT_PAGE_LIMIT,
        MAX_PAGE_LIMIT,
        1,
      );

    const offset =
      parsePagination(
        (typeof req.query.offset === "string" ? req.query.offset : undefined),
        "offset",
        0,
        MAX_PAGE_OFFSET,
        0,
      );

    const batches =
      await listBankPaymentBatches(
        organizationId,
        limit,
        offset,
      );

    res.status(200).json({
      success: true,
      batches,
      count:
        batches.length,
      pagination: {
        limit,
        offset,
        returned:
          batches.length,
        hasMore:
          batches.length === limit,
      },
    });
  } catch (error: unknown) {
    console.error(
      "[BANK PAYMENT] LIST BATCHES ERROR:",
      error,
    );

    sendError(
      res,
      error,
    );
  }
}

/* =========================================================
   LIST PAYMENTS
========================================================= */

export async function listBankPaymentsController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const organizationId =
      getOrganizationId(req);

    const limit =
      parsePagination(
        (typeof req.query.limit === "string" ? req.query.limit : undefined),
        "limit",
        DEFAULT_PAGE_LIMIT,
        MAX_PAGE_LIMIT,
        1,
      );

    const offset =
      parsePagination(
        (typeof req.query.offset === "string" ? req.query.offset : undefined),
        "offset",
        0,
        MAX_PAGE_OFFSET,
        0,
      );

    const payments =
      await listBankPayments(
        organizationId,
        limit,
        offset,
      );

    res.status(200).json({
      success: true,
      payments,
      count:
        payments.length,
      pagination: {
        limit,
        offset,
        returned:
          payments.length,
        hasMore:
          payments.length === limit,
      },
    });
  } catch (error: unknown) {
    console.error(
      "[BANK PAYMENT] LIST ERROR:",
      error,
    );

    sendError(
      res,
      error,
    );
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