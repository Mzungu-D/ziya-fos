import crypto from "crypto";
import {
  createBankPaymentBatchWithPayments,
  getBankPaymentBatch,
  updateBankPaymentStatus,
  type BankPaymentRow,
  type BankPaymentBatchRow,
} from "./bankPayment.repository";

/* =========================================================
   TYPES
========================================================= */

export type BankPaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "PARTIALLY_COMPLETED";

export type BankPaymentType =
  | "BANK_TRANSFER"
  | "PAYBILL"
  | "TILL";

export interface BankPaymentAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  integrationEnabled: boolean;
  integrationProvider?: string | null;
  apiBaseUrl?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  connectionStatus?: string | null;
}

export interface BankPaymentRecipient {
  beneficiaryName: string;

  paymentType: BankPaymentType;

  accountNumber?: string | null;
  paybillNumber?: string | null;
  tillNumber?: string | null;
  accountReference?: string | null;

  bankCode?: string | null;
  branchCode?: string | null;

  amount: number;
  currency?: string;
  description?: string | null;
}

export interface BankTransferRequest {
  organizationId: string;
  batchReference: string;
  paymentReference: string;
  bankAccount: BankPaymentAccount;
  recipient: BankPaymentRecipient;
}

export interface BankTransferResult {
  accepted: boolean;
  status: BankPaymentStatus;
  providerReference?: string;
  providerStatus?: string;
  providerMessage?: string;
  rawResponse?: unknown;
}

export interface PersistedBankPaymentResult {
  payment: BankPaymentRow;
  providerResult: BankTransferResult;
}

export interface BankPaymentBatchResult {
  batch: BankPaymentBatchRow;
  payments: PersistedBankPaymentResult[];
  totalAmount: number;
  totalPayments: number;
  successful: number;
  failed: number;
  pending: number;
}

/* =========================================================
   PROVIDER RESPONSE
========================================================= */

interface ProviderResponse {
  success?: boolean;
  accepted?: boolean;
  status?: string;
  reference?: string;
  transactionId?: string;
  providerReference?: string;
  message?: string;
  responseDescription?: string;
  error?: string;
  [key: string]: unknown;
}

/* =========================================================
   HELPERS
========================================================= */

function generateReference(
  prefix: string,
): string {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;
}

function normalizeStatus(
  value?: string,
): BankPaymentStatus {
  const status =
    String(value ?? "")
      .trim()
      .toUpperCase();

  if (
    status === "COMPLETED" ||
    status === "SUCCESS" ||
    status === "SUCCESSFUL"
  ) {
    return "COMPLETED";
  }

  if (
    status === "FAILED" ||
    status === "REJECTED" ||
    status === "ERROR"
  ) {
    return "FAILED";
  }

  if (
    status === "PROCESSING" ||
    status === "IN_PROGRESS"
  ) {
    return "PROCESSING";
  }

  return "PENDING";
}


/**
 * Validate the destination fields required by the selected
 * payment type before anything is persisted or submitted.
 */
function validatePaymentDestination(
  recipient: BankPaymentRecipient,
  index?: number,
): void {
  const label =
    index === undefined
      ? "Payment"
      : `Recipient ${index + 1}`;

  const paymentType =
    String(
      recipient.paymentType ?? "",
    )
      .trim()
      .toUpperCase() as BankPaymentType;

  if (
    paymentType !== "BANK_TRANSFER" &&
    paymentType !== "PAYBILL" &&
    paymentType !== "TILL"
  ) {
    throw new Error(
      `${label}: unsupported payment type "${recipient.paymentType}".`,
    );
  }

  if (
    paymentType === "BANK_TRANSFER" &&
    !recipient.accountNumber?.trim()
  ) {
    throw new Error(
      `${label}: account number is required for a bank transfer.`,
    );
  }

  if (
    paymentType === "PAYBILL" &&
    !recipient.paybillNumber?.trim()
  ) {
    throw new Error(
      `${label}: PayBill number is required for a PayBill payment.`,
    );
  }

  if (
    paymentType === "PAYBILL" &&
    !recipient.accountReference?.trim()
  ) {
    throw new Error(
      `${label}: account reference is required for a PayBill payment.`,
    );
  }

  if (
    paymentType === "TILL" &&
    !recipient.tillNumber?.trim()
  ) {
    throw new Error(
      `${label}: Till number is required for a Till payment.`,
    );
  }
}

function requireHttps(
  url: string,
): void {
  const parsed = new URL(url);

  if (
    parsed.protocol !== "https:" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  ) {
    throw new Error(
      "Bank API endpoint must use HTTPS.",
    );
  }
}

function buildIdempotencyKey(
  organizationId: string,
  paymentReference: string,
): string {
  return crypto
    .createHash("sha256")
    .update(
      `${organizationId}:${paymentReference}`,
    )
    .digest("hex");
}

function getProviderPaymentPath(
  provider?: string | null,
): string {
  const normalized =
    String(provider ?? "")
      .trim()
      .toLowerCase();

  const configuredPath =
    process.env[
      `BANK_PAYMENT_PATH_${normalized.toUpperCase()}`
    ];

  if (
    configuredPath &&
    configuredPath.trim()
  ) {
    return configuredPath.trim();
  }

  const genericPath =
    process.env.BANK_PAYMENT_PATH;

  if (
    genericPath &&
    genericPath.trim()
  ) {
    return genericPath.trim();
  }

  throw new Error(
    `No payment endpoint configured for bank provider "${provider ?? "unknown"}".`,
  );
}

/* =========================================================
   PROVIDER PAYLOAD
========================================================= */

function buildProviderPayload(
  request: BankTransferRequest,
) {
  const {
    organizationId,
    batchReference,
    paymentReference,
    bankAccount,
    recipient,
  } = request;

  validatePaymentDestination(
    recipient,
  );

  const paymentType =
    recipient.paymentType;

  return {
    organizationId,

    paymentReference,

    batchReference,

    paymentType,

    sourceAccount: {
      accountName:
        bankAccount.accountName,

      accountNumber:
        bankAccount.accountNumber,

      currency:
        bankAccount.currency,
    },

    beneficiary: {
      name:
        recipient.beneficiaryName,

      paymentType,

      accountNumber:
        recipient.accountNumber?.trim() ||
        undefined,

      bankCode:
        recipient.bankCode?.trim() ||
        undefined,

      branchCode:
        recipient.branchCode?.trim() ||
        undefined,

      paybillNumber:
        recipient.paybillNumber?.trim() ||
        undefined,

      accountReference:
        recipient.accountReference?.trim() ||
        undefined,

      tillNumber:
        recipient.tillNumber?.trim() ||
        undefined,
    },

    amount: Number(
      recipient.amount,
    ),

    currency:
      recipient.currency ??
      bankAccount.currency ??
      "KES",

    description:
      recipient.description ??
      `Ziya FOS payment ${paymentReference}`,
  };
}

/* =========================================================
   RESPONSE PARSER
========================================================= */

async function parseResponse(
  response: Response,
): Promise<ProviderResponse> {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text,
    ) as ProviderResponse;
  } catch {
    return {
      message: text,
    };
  }
}

/* =========================================================
   BANK PROVIDER CALL
========================================================= */

async function callBankProvider(
  request: BankTransferRequest,
): Promise<BankTransferResult> {
  const {
    bankAccount,
    paymentReference,
    organizationId,
  } = request;

  if (
    !bankAccount.integrationEnabled
  ) {
    throw new Error(
      "Bank integration is not enabled for this account.",
    );
  }

  if (
    bankAccount.connectionStatus &&
    bankAccount.connectionStatus !==
      "CONNECTED"
  ) {
    throw new Error(
      "The funding bank account is not connected.",
    );
  }

  if (
    !bankAccount.apiBaseUrl
  ) {
    throw new Error(
      "Bank API Base URL is not configured.",
    );
  }

  const baseUrl =
    bankAccount.apiBaseUrl.replace(
      /\/+$/,
      "",
    );

  requireHttps(baseUrl);

  const paymentPath =
    getProviderPaymentPath(
      bankAccount.integrationProvider,
    );

  const endpoint =
    paymentPath.startsWith(
      "http://",
    ) ||
    paymentPath.startsWith(
      "https://",
    )
      ? paymentPath
      : `${baseUrl}/${paymentPath.replace(
          /^\/+/,
          "",
        )}`;

  if (
    endpoint.startsWith(
      "http://",
    )
  ) {
    throw new Error(
      "Bank payment endpoint must use HTTPS.",
    );
  }

  const payload =
    buildProviderPayload(
      request,
    );

  const headers: Record<
    string,
    string
  > = {
    "Content-Type":
      "application/json",

    Accept:
      "application/json",

    "Idempotency-Key":
      buildIdempotencyKey(
        organizationId,
        paymentReference,
      ),
  };

  if (
    bankAccount.apiKey
  ) {
    headers[
      "X-API-Key"
    ] =
      bankAccount.apiKey;
  }

  if (
    bankAccount.apiSecret
  ) {
    headers[
      "X-API-Secret"
    ] =
      bankAccount.apiSecret;
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      30_000,
    );

  try {
    const response =
      await fetch(
        endpoint,
        {
          method: "POST",
          headers,
          body: JSON.stringify(
            payload,
          ),
          signal:
            controller.signal,
        },
      );

    const data =
      await parseResponse(
        response,
      );

    if (!response.ok) {
      return {
        accepted: false,
        status: "FAILED",

        providerReference:
          data.providerReference ??
          data.reference ??
          data.transactionId,

        providerStatus:
          data.status,

        providerMessage:
          data.message ??
          data.responseDescription ??
          data.error ??
          `Bank provider returned HTTP ${response.status}.`,

        rawResponse:
          data,
      };
    }

    const providerStatus =
      String(
        data.status ?? "",
      ).toUpperCase();

    const accepted =
      data.accepted === true ||
      data.success === true ||
      response.ok;

    /*
     * A successful HTTP response only confirms
     * that the provider accepted the request.
     *
     * Final completion may arrive later through
     * the provider callback/webhook.
     */
    const finalStatus =
      normalizeStatus(
        providerStatus,
      );

    return {
      accepted,

      status:
        finalStatus ===
        "COMPLETED"
          ? "COMPLETED"
          : "PROCESSING",

      providerReference:
        data.providerReference ??
        data.reference ??
        data.transactionId,

      providerStatus:
        data.status,

      providerMessage:
        data.message ??
        data.responseDescription,

      rawResponse:
        data,
    };
  } catch (error) {
    if (
      error instanceof
        DOMException &&
      error.name ===
        "AbortError"
    ) {
      return {
        accepted: false,
        status: "FAILED",
        providerMessage:
          "Bank provider request timed out.",
      };
    }

    if (
      error instanceof Error
    ) {
      return {
        accepted: false,
        status: "FAILED",
        providerMessage:
          error.message,
      };
    }

    return {
      accepted: false,
      status: "FAILED",
      providerMessage:
        "Unable to communicate with bank provider.",
    };
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

/* =========================================================
   SINGLE BANK PAYMENT
========================================================= */

export async function executeBankPayment(
  request: BankTransferRequest,
): Promise<BankTransferResult> {
  if (
    !request.organizationId
  ) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  if (
    !request.paymentReference
  ) {
    throw new Error(
      "Payment reference is required.",
    );
  }

  if (
    !request.batchReference
  ) {
    throw new Error(
      "Batch reference is required.",
    );
  }

  if (
    !request.recipient.beneficiaryName?.trim()
  ) {
    throw new Error(
      "Beneficiary name is required.",
    );
  }

  validatePaymentDestination(
    request.recipient,
  );

  const amount =
    Number(
      request.recipient.amount,
    );

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Payment amount must be greater than zero.",
    );
  }

  return callBankProvider({
    ...request,

    recipient: {
      ...request.recipient,
      amount,
    },
  });
}

/* =========================================================
   PROVIDER-ONLY BATCH EXECUTION
========================================================= */

export async function executeBankPaymentBatch(
  organizationId: string,
  batchReference: string,
  bankAccount: BankPaymentAccount,
  recipients: BankPaymentRecipient[],
): Promise<{
  batchReference: string;
  totalAmount: number;
  totalPayments: number;
  successful: number;
  failed: number;
  pending: number;
  results: Array<
    BankTransferResult & {
      paymentReference: string;
      beneficiaryName: string;
      amount: number;
    }
  >;
}> {
  if (
    !organizationId
  ) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  if (
    !batchReference
  ) {
    throw new Error(
      "Batch reference is required.",
    );
  }

  if (
    recipients.length === 0
  ) {
    throw new Error(
      "At least one payment recipient is required.",
    );
  }

  /*
   * FOS supports up to 1,000 recipients per batch.
   * A provider may impose a lower limit and should
   * reject an unsupported submission safely.
   */
  if (
    recipients.length > 1000
  ) {
    throw new Error(
      "A maximum of 1,000 payments is allowed in one batch.",
    );
  }

  const totalAmount =
    recipients.reduce(
      (
        total,
        recipient,
      ) =>
        total +
        Number(
          recipient.amount,
        ),
      0,
    );

  const results: Array<
    BankTransferResult & {
      paymentReference: string;
      beneficiaryName: string;
      amount: number;
    }
  > = [];

  let successful = 0;
  let failed = 0;
  let pending = 0;

  /*
   * Payments are processed sequentially.
   */
  for (
    const recipient of recipients
  ) {
    const paymentReference =
      generateReference(
        "BANK-PAY",
      );

    const result =
      await executeBankPayment({
        organizationId,
        batchReference,
        paymentReference,
        bankAccount,
        recipient,
      });

    results.push({
      ...result,

      paymentReference,

      beneficiaryName:
        recipient.beneficiaryName,

      amount:
        Number(
          recipient.amount,
        ),
    });

    if (
      result.status ===
      "COMPLETED"
    ) {
      successful += 1;
    } else if (
      result.status ===
      "FAILED"
    ) {
      failed += 1;
    } else {
      pending += 1;
    }
  }

  return {
    batchReference,

    totalAmount,

    totalPayments:
      recipients.length,

    successful,

    failed,

    pending,

    results,
  };
}

/* =========================================================
   PRODUCTION PERSISTED BATCH PAYMENT
========================================================= */

export async function createAndExecuteBankPaymentBatch(
  organizationId: string,
  bankAccount: BankPaymentAccount,
  batchReference: string,
  recipients: BankPaymentRecipient[],
  options?: {
    description?: string;
    provider?: string;
    idempotencyKey?: string;
  },
): Promise<BankPaymentBatchResult> {
  if (
    !organizationId
  ) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  if (
    !bankAccount.id
  ) {
    throw new Error(
      "Bank account ID is required.",
    );
  }

  if (
    !batchReference
  ) {
    throw new Error(
      "Batch reference is required.",
    );
  }

  if (
    recipients.length === 0
  ) {
    throw new Error(
      "At least one payment recipient is required.",
    );
  }

  if (
    recipients.length > 100
  ) {
    throw new Error(
      "A maximum of 100 payments is allowed in one batch.",
    );
  }

  /*
   * Validate every recipient BEFORE any provider
   * request is made.
   */
  for (
    let index = 0;
    index < recipients.length;
    index += 1
  ) {
    const recipient =
      recipients[index];

    if (
      !recipient.beneficiaryName?.trim()
    ) {
      throw new Error(
        `Recipient ${index + 1}: beneficiary name is required.`,
      );
    }

    validatePaymentDestination(
      recipient,
      index,
    );

    const amount =
      Number(
        recipient.amount,
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        `Recipient ${index + 1}: payment amount must be greater than zero.`,
      );
    }
  }

  /*
   * Generate references before persistence.
   */
  const preparedRecipients =
    recipients.map(
      (recipient) => ({
        ...recipient,

        amount:
          Number(
            recipient.amount,
          ),
      }),
    );

  const paymentsInput =
    preparedRecipients.map(
      (recipient) => {
        const paymentReference =
          generateReference(
            "BANK-PAY",
          );

        return {
          paymentReference,

          beneficiaryName:
            recipient.beneficiaryName.trim(),

          paymentType:
            recipient.paymentType,

          accountNumber:
            recipient.accountNumber?.trim() ??
            undefined,

          paybillNumber:
            recipient.paybillNumber?.trim() ??
            undefined,

          tillNumber:
            recipient.tillNumber?.trim() ??
            undefined,

          accountReference:
            recipient.accountReference?.trim() ??
            undefined,

          bankCode:
            recipient.bankCode?.trim() ??
            undefined,

          branchCode:
            recipient.branchCode?.trim() ??
            undefined,

          amount:
            recipient.amount,

          currency:
            recipient.currency ??
            bankAccount.currency ??
            "KES",

          description:
            recipient.description ??
            options?.description ??
            undefined,

          idempotencyKey:
            buildIdempotencyKey(
              organizationId,
              paymentReference,
            ),
        };
      },
    );

  /*
   * IMPORTANT:
   *
   * The repository creates the batch and ALL payment
   * records atomically.
   *
   * No bank API call happens inside the database
   * transaction.
   */
  const persisted =
    await createBankPaymentBatchWithPayments({
      organizationId,

      bankAccountId:
        bankAccount.id,

      batchReference,

      description:
        options?.description,

      provider:
        options?.provider ??
        bankAccount.integrationProvider ??
        undefined,

      idempotencyKey:
        options?.idempotencyKey,

      payments:
        paymentsInput,
    });

  const results: PersistedBankPaymentResult[] =
    [];

  /*
   * Submit each persisted payment to the bank provider.
   *
   * The database records already exist, so every
   * provider result can be recorded safely.
   */
  for (
    let index = 0;
    index <
    persisted.payments.length;
    index += 1
  ) {
    const payment =
      persisted.payments[index];

    const recipient =
      preparedRecipients[index];

    /*
     * Idempotent protection:
     * never submit a payment that has already reached
     * a final state.
     */
    if (
      payment.status ===
        "COMPLETED" ||
      payment.status ===
        "FAILED"
    ) {
      results.push({
        payment,

        providerResult: {
          accepted:
            payment.status ===
            "COMPLETED",

          status:
            payment.status ===
            "COMPLETED"
              ? "COMPLETED"
              : "FAILED",

          providerReference:
            payment.providerPaymentId ??
            undefined,

          providerStatus:
            payment.providerStatus ??
            undefined,

          providerMessage:
            payment.failureReason ??
            undefined,
        },
      });

      continue;
    }

    const providerResult =
      await executeBankPayment({
        organizationId,

        batchReference,

        paymentReference:
          payment.paymentReference,

        bankAccount,

        recipient: {
          ...recipient,

          amount:
            Number(
              recipient.amount,
            ),
        },
      });

    /*
     * Provider accepted the instruction.
     *
     * COMPLETED is only recorded when the provider
     * actually reports completion.
     */
    if (
      providerResult.status ===
      "COMPLETED"
    ) {
      const updated =
        await updateBankPaymentStatus({
          organizationId,

          paymentId:
            payment.id,

          status:
  "SUCCESS",

          providerPaymentId:
            providerResult.providerReference,

          providerStatus:
            providerResult.providerStatus,
        });

      results.push({
        payment:
          updated[0] ??
          payment,

        providerResult,
      });

      continue;
    }

    if (
      providerResult.status ===
      "FAILED"
    ) {
      const updated =
        await updateBankPaymentStatus({
          organizationId,

          paymentId:
            payment.id,

          status:
            "FAILED",

          providerPaymentId:
            providerResult.providerReference,

          providerStatus:
            providerResult.providerStatus,

          failureReason:
            providerResult.providerMessage ??
            "Bank provider rejected the payment.",
        });

      results.push({
        payment:
          updated[0] ??
          payment,

        providerResult,
      });

      continue;
    }

    /*
     * PROCESSING / PENDING
     *
     * The payment has been accepted for processing
     * but money has NOT been confirmed as delivered.
     */
    const updated =
      await updateBankPaymentStatus({
        organizationId,

        paymentId:
          payment.id,

        status:
          "PROCESSING",

        providerPaymentId:
          providerResult.providerReference,

        providerStatus:
          providerResult.providerStatus,
      });

    results.push({
      payment:
        updated[0] ??
        payment,

      providerResult,
    });
  }

  /*
   * Re-read the persisted batch through the repository
   * after all provider results have been recorded.
   */
  const rows =
    await getBankPaymentBatch(
      organizationId,
      persisted.batch.id,
    );

  if (rows.length === 0) {
    throw new Error(
      "Payment batch could not be retrieved after processing.",
    );
  }

  const finalBatch = rows[0];

  const finalPayments =
    results.map(
      (item) =>
        item.payment,
    );

  return {
    batch:
      finalBatch,

    payments:
      results,

    totalAmount:
      Number(
        finalBatch.totalAmount,
      ),

    totalPayments:
      finalBatch.totalPayments,

    successful:
      finalBatch.successful,

    failed:
      finalBatch.failed,

    pending:
      finalBatch.pending,
  };
}

/* =========================================================
   REFERENCE GENERATORS
========================================================= */

export function generateBatchReference(): string {
  return generateReference(
    "BANK-BATCH",
  );
}

export function generatePaymentReference(): string {
  return generateReference(
    "BANK-PAY",
  );
}