import crypto from "crypto";

import {
  createBankPaymentBatchWithPayments,
  getBankPaymentBatch,
  updateBankPaymentStatus,
  type BankPaymentRow,
  type BankPaymentBatchRow,
} from "./bankPayment.repository";
import { bankPost } from "../bank.service";

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
   CONSTANTS
========================================================= */

const MAX_BATCH_SIZE = 100;
const MAX_PROVIDER_BATCH_SIZE = 1_000;
const MAX_AMOUNT = 999_999_999_999.99;
const MAX_TEXT_LENGTH = 500;
const MAX_REFERENCE_LENGTH = 100;
const MAX_PATH_LENGTH = 500;
const MAX_RESPONSE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 30_000;

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
];

const PRIVATE_IPV6_HOSTS = new Set(["::", "::1"]);

/* =========================================================
   VALIDATION
========================================================= */

function requireText(
  value: unknown,
  field: string,
  max = MAX_TEXT_LENGTH,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(`${field} is required.`);
  }

  const normalized = value.trim();

  if (normalized.length > max) {
    throw new Error(`${field} is too long.`);
  }

  return normalized;
}

function optionalText(
  value: unknown,
  field: string,
  max = MAX_TEXT_LENGTH,
): string | undefined {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} is invalid.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > max) {
    throw new Error(`${field} is too long.`);
  }

  return normalized;
}

function normalizeAmount(
  value: unknown,
  field = "Payment amount",
): number {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, "").trim())
        : NaN;

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {
    throw new Error(
      `${field} must be greater than zero and within the permitted limit.`,
    );
  }

  return Math.round(
    (amount + Number.EPSILON) * 100,
  ) / 100;
}

function normalizeCurrency(
  value: unknown,
  fallback: string,
): string {
  const currency =
    typeof value === "string" &&
    value.trim()
      ? value.trim().toUpperCase()
      : fallback.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Payment currency must be a valid ISO 4217 code.");
  }

  return currency;
}

function normalizePaymentType(
  value: unknown,
): BankPaymentType {
  const paymentType =
    String(value ?? "")
      .trim()
      .toUpperCase();

  if (
    paymentType !== "BANK_TRANSFER" &&
    paymentType !== "PAYBILL" &&
    paymentType !== "TILL"
  ) {
    throw new Error(
      `Unsupported payment type "${String(value ?? "")}".`,
    );
  }

  return paymentType as BankPaymentType;
}

function validateOrganizationId(
  organizationId: string,
): string {
  return requireText(
    organizationId,
    "Organization ID",
    100,
  );
}

function validateReference(
  value: string,
  field: string,
): string {
  const reference = requireText(
    value,
    field,
    MAX_REFERENCE_LENGTH,
  );

  if (!/^[A-Za-z0-9._:/-]+$/.test(reference)) {
    throw new Error(
      `${field} contains invalid characters.`,
    );
  }

  return reference;
}

function validateProvider(
  provider?: string | null,
): string | undefined {
  if (
    provider === null ||
    provider === undefined ||
    !String(provider).trim()
  ) {
    return undefined;
  }

  const normalized = String(provider).trim();

  if (
    normalized.length > 100 ||
    !/^[A-Za-z0-9._-]+$/.test(normalized)
  ) {
    throw new Error("Bank provider is invalid.");
  }

  return normalized;
}

/* =========================================================
   URL / PATH VALIDATION
========================================================= */

function isPrivateOrLocalHostname(
  hostname: string,
): boolean {
  const normalized =
    hostname.trim().toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    PRIVATE_IPV6_HOSTS.has(normalized)
  ) {
    return true;
  }

  return PRIVATE_IPV4_RANGES.some(
    (pattern) => pattern.test(normalized),
  );
}

function requireHttps(
  url: string,
): void {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      "Bank API endpoint must be a valid HTTPS URL.",
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      "Bank API endpoint must use HTTPS.",
    );
  }

  if (
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "Bank API endpoint must not contain embedded credentials.",
    );
  }

  if (
    parsed.hostname.endsWith(".local") ||
    isPrivateOrLocalHostname(parsed.hostname)
  ) {
    throw new Error(
      "Bank API endpoint cannot target a private or local address.",
    );
  }
}

function validateRelativePath(
  path: string,
): string {
  const normalized = requireText(
    path,
    "Bank payment endpoint",
    MAX_PATH_LENGTH,
  );

  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    normalized.includes("\0")
  ) {
    throw new Error(
      "Bank payment endpoint must be a safe relative path.",
    );
  }

  try {
    const parsed = new URL(
      normalized,
      "https://bank-api.invalid",
    );

    if (
      parsed.hostname !== "bank-api.invalid" ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "Bank payment endpoint is invalid.",
    );
  }

  return normalized;
}

/* =========================================================
   REFERENCES / IDEMPOTENCY
========================================================= */

function generateReference(
  prefix: string,
): string {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()}`;
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

/* =========================================================
   PAYMENT DESTINATION VALIDATION
========================================================= */

function validatePaymentDestination(
  recipient: BankPaymentRecipient,
  index?: number,
): void {
  const label =
    index === undefined
      ? "Payment"
      : `Recipient ${index + 1}`;

  const paymentType =
    normalizePaymentType(
      recipient.paymentType,
    );

  requireText(
    recipient.beneficiaryName,
    `${label}: beneficiary name`,
  );

  if (
    paymentType === "BANK_TRANSFER"
  ) {
    requireText(
      recipient.accountNumber,
      `${label}: account number`,
    );
  }

  if (
    paymentType === "PAYBILL"
  ) {
    requireText(
      recipient.paybillNumber,
      `${label}: PayBill number`,
    );

    requireText(
      recipient.accountReference,
      `${label}: account reference`,
    );
  }

  if (
    paymentType === "TILL"
  ) {
    requireText(
      recipient.tillNumber,
      `${label}: Till number`,
    );
  }

  if (
    recipient.bankCode !== undefined &&
    recipient.bankCode !== null
  ) {
    optionalText(
      recipient.bankCode,
      `${label}: bank code`,
    );
  }

  if (
    recipient.branchCode !== undefined &&
    recipient.branchCode !== null
  ) {
    optionalText(
      recipient.branchCode,
      `${label}: branch code`,
    );
  }
}

/* =========================================================
   PROVIDER ENDPOINT
========================================================= */

function getProviderPaymentPath(
  provider?: string | null,
): string {
  const normalized =
    String(provider ?? "")
      .trim()
      .toUpperCase();

  if (!normalized) {
    throw new Error(
      "Bank integration provider is not configured.",
    );
  }

  const configuredPath =
    process.env[
      `BANK_PAYMENT_PATH_${normalized}`
    ]?.trim() ||
    process.env.BANK_PAYMENT_PATH?.trim();

  if (!configuredPath) {
    throw new Error(
      `No payment endpoint configured for bank provider "${provider}".`,
    );
  }

  if (
    configuredPath.startsWith("http://") ||
    configuredPath.startsWith("https://")
  ) {
    requireHttps(configuredPath);
    throw new Error(
      "Bank payment endpoint must be configured as a relative provider path.",
    );
  }

  return validateRelativePath(
    configuredPath,
  );
}

/* =========================================================
   PROVIDER PAYLOAD
========================================================= */

function buildProviderPayload(
  request: BankTransferRequest,
): Record<string, unknown> {
  validatePaymentDestination(
    request.recipient,
  );

  const currency =
    normalizeCurrency(
      request.recipient.currency,
      request.bankAccount.currency,
    );

  const paymentType =
    normalizePaymentType(
      request.recipient.paymentType,
    );

  return {
    organizationId:
      request.organizationId,

    paymentReference:
      request.paymentReference,

    batchReference:
      request.batchReference,

    paymentType,

    sourceAccount: {
      accountName:
        requireText(
          request.bankAccount.accountName,
          "Source account name",
        ),
      accountNumber:
        requireText(
          request.bankAccount.accountNumber,
          "Source account number",
        ),
      currency:
        normalizeCurrency(
          request.bankAccount.currency,
          "KES",
        ),
    },

    beneficiary: {
      name:
        requireText(
          request.recipient.beneficiaryName,
          "Beneficiary name",
        ),
      paymentType,
      accountNumber:
        optionalText(
          request.recipient.accountNumber,
          "Beneficiary account number",
        ),
      bankCode:
        optionalText(
          request.recipient.bankCode,
          "Bank code",
        ),
      branchCode:
        optionalText(
          request.recipient.branchCode,
          "Branch code",
        ),
      paybillNumber:
        optionalText(
          request.recipient.paybillNumber,
          "PayBill number",
        ),
      accountReference:
        optionalText(
          request.recipient.accountReference,
          "Account reference",
        ),
      tillNumber:
        optionalText(
          request.recipient.tillNumber,
          "Till number",
        ),
    },

    amount:
      normalizeAmount(
        request.recipient.amount,
      ),

    currency,

    description:
      optionalText(
        request.recipient.description,
        "Payment description",
      ) ??
      `Ziya FOS payment ${request.paymentReference}`,
  };
}

/* =========================================================
   PROVIDER CALL
========================================================= */

async function callBankProvider(
  request: BankTransferRequest,
): Promise<BankTransferResult> {
  const organizationId =
    validateOrganizationId(
      request.organizationId,
    );

  const paymentReference =
    validateReference(
      request.paymentReference,
      "Payment reference",
    );

  const batchReference =
    validateReference(
      request.batchReference,
      "Batch reference",
    );

  if (
    !request.bankAccount.integrationEnabled
  ) {
    throw new Error(
      "Bank integration is not enabled for this account.",
    );
  }

  if (
    request.bankAccount.connectionStatus &&
    request.bankAccount.connectionStatus.toUpperCase() !==
      "CONNECTED"
  ) {
    throw new Error(
      "The funding bank account is not connected.",
    );
  }

  if (
    !request.bankAccount.integrationProvider
  ) {
    throw new Error(
      "Bank integration provider is not configured.",
    );
  }

  if (
    !request.bankAccount.apiBaseUrl
  ) {
    throw new Error(
      "Bank API base URL is not configured.",
    );
  }

  requireHttps(
    request.bankAccount.apiBaseUrl,
  );

  const paymentPath =
    getProviderPaymentPath(
      request.bankAccount.integrationProvider,
    );

  const payload =
    buildProviderPayload({
      ...request,
      organizationId,
      paymentReference,
      batchReference,
    });

  const idempotencyKey =
    buildIdempotencyKey(
      organizationId,
      paymentReference,
    );

  /*
   * The hardened bank service owns:
   * - credential handling
   * - HTTPS validation
   * - request limits
   * - path validation
   * - provider request transport
   * - tenant-scoped account loading
   */
  try {
    const response =
      await bankPost(
        organizationId,
        request.bankAccount.id,
        paymentPath,
        payload,
      );

    const data =
      response.data &&
      typeof response.data === "object" &&
      !Array.isArray(response.data)
        ? response.data as ProviderResponse
        : {};

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      return {
        accepted: false,
        status: "FAILED",
        providerReference:
          data.providerReference ??
          data.reference ??
          data.transactionId,
        providerStatus:
          typeof data.status === "string"
            ? data.status
            : undefined,
        providerMessage:
          typeof data.message === "string"
            ? data.message.slice(0, 500)
            : typeof data.error === "string"
              ? data.error.slice(0, 500)
              : `Bank provider returned HTTP ${response.status}.`,
        rawResponse: data,
      };
    }

    const providerStatus =
      String(
        data.status ?? "",
      )
        .trim()
        .toUpperCase();

    const providerAccepted =
      data.accepted === true ||
      data.success === true;

    const finalStatus =
      normalizeStatus(
        providerStatus,
      );

    /*
     * HTTP success alone does not mean funds have settled.
     * COMPLETED is used only when the provider explicitly
     * reports a completed/success state.
     */
    const status: BankPaymentStatus =
      finalStatus === "COMPLETED"
        ? "COMPLETED"
        : finalStatus === "FAILED"
          ? "FAILED"
          : "PROCESSING";

    return {
      accepted:
        providerAccepted ||
        status === "COMPLETED" ||
        status === "PROCESSING",
      status,
      providerReference:
        data.providerReference ??
        data.reference ??
        data.transactionId,
      providerStatus:
        typeof data.status === "string"
          ? data.status
          : undefined,
      providerMessage:
        typeof data.message === "string"
          ? data.message.slice(0, 500)
          : typeof data.responseDescription === "string"
            ? data.responseDescription.slice(0, 500)
            : undefined,
      rawResponse: data,
    };
  } catch (error) {
    return {
      accepted: false,
      status: "FAILED",
      providerMessage:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unable to communicate with bank provider.",
    };
  }
}

/* =========================================================
   SINGLE BANK PAYMENT
========================================================= */

function normalizeStatus(status: string): "COMPLETED" | "FAILED" | "PROCESSING" {
  const normalized = status.trim().toUpperCase();

  if (
    normalized === "COMPLETED" ||
    normalized === "COMPLETE" ||
    normalized === "SUCCESS" ||
    normalized === "SUCCEEDED" ||
    normalized === "SETTLED" ||
    normalized === "SETTLEMENT" ||
    normalized === "PAID"
  ) {
    return "COMPLETED";
  }

  if (
    normalized === "FAILED" ||
    normalized === "FAILURE" ||
    normalized === "REJECTED" ||
    normalized === "DECLINED" ||
    normalized === "CANCELLED" ||
    normalized === "CANCELED"
  ) {
    return "FAILED";
  }

  return "PROCESSING";
}
export async function executeBankPayment(
  request: BankTransferRequest,
): Promise<BankTransferResult> {
  validateOrganizationId(
    request.organizationId,
  );

  validateReference(
    request.batchReference,
    "Batch reference",
  );

  validateReference(
    request.paymentReference,
    "Payment reference",
  );

  validatePaymentDestination(
    request.recipient,
  );

  normalizeAmount(
    request.recipient.amount,
  );

  return callBankProvider({
    ...request,
    recipient: {
      ...request.recipient,
      amount:
        normalizeAmount(
          request.recipient.amount,
        ),
      paymentType:
        normalizePaymentType(
          request.recipient.paymentType,
        ),
      beneficiaryName:
        requireText(
          request.recipient.beneficiaryName,
          "Beneficiary name",
        ),
      currency:
        normalizeCurrency(
          request.recipient.currency,
          request.bankAccount.currency,
        ),
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
  validateOrganizationId(
    organizationId,
  );

  validateReference(
    batchReference,
    "Batch reference",
  );

  if (
    !Array.isArray(recipients) ||
    recipients.length === 0
  ) {
    throw new Error(
      "At least one payment recipient is required.",
    );
  }

  if (
    recipients.length >
    MAX_PROVIDER_BATCH_SIZE
  ) {
    throw new Error(
      `A maximum of ${MAX_PROVIDER_BATCH_SIZE} payments is allowed in one provider batch.`,
    );
  }

  const prepared =
    recipients.map(
      (recipient, index) => {
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

        return {
          ...recipient,
          paymentType:
            normalizePaymentType(
              recipient.paymentType,
            ),
          beneficiaryName:
            requireText(
              recipient.beneficiaryName,
              `Recipient ${index + 1}: beneficiary name`,
            ),
          amount:
            normalizeAmount(
              recipient.amount,
              `Recipient ${index + 1}: payment amount`,
            ),
          currency:
            normalizeCurrency(
              recipient.currency,
              bankAccount.currency,
            ),
        };
      },
    );

  const totalAmount =
    Math.round(
      prepared.reduce(
        (total, recipient) =>
          total + recipient.amount,
        0,
      ) * 100,
    ) / 100;

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
   * Sequential submission is intentional:
   * it avoids uncontrolled provider concurrency and makes
   * provider throttling predictable.
   */
  for (
    const recipient of prepared
  ) {
    const paymentReference =
      generatePaymentReference();

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
        recipient.amount,
    });

    if (
      result.status === "COMPLETED"
    ) {
      successful += 1;
    } else if (
      result.status === "FAILED"
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
      prepared.length,
    successful,
    failed,
    pending,
    results,
  };
}

/* =========================================================
   PERSISTED BATCH PAYMENT
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
  validateOrganizationId(
    organizationId,
  );

  validateReference(
    batchReference,
    "Batch reference",
  );

  if (
    !bankAccount.id
  ) {
    throw new Error(
      "Bank account ID is required.",
    );
  }

  if (
    !Array.isArray(recipients) ||
    recipients.length === 0
  ) {
    throw new Error(
      "At least one payment recipient is required.",
    );
  }

  if (
    recipients.length >
    MAX_BATCH_SIZE
  ) {
    throw new Error(
      `A maximum of ${MAX_BATCH_SIZE} payments is allowed in one persisted batch.`,
    );
  }

  const provider =
    validateProvider(
      options?.provider ??
      bankAccount.integrationProvider,
    );

  const description =
    optionalText(
      options?.description,
      "Batch description",
    );

  const idempotencyKey =
    optionalText(
      options?.idempotencyKey,
      "Batch idempotency key",
      200,
    );

  /*
   * Validate the entire batch before creating database records
   * or calling the external provider.
   */
  const preparedRecipients =
    recipients.map(
      (recipient, index) => {
        validatePaymentDestination(
          recipient,
          index,
        );

        return {
          ...recipient,
          beneficiaryName:
            requireText(
              recipient.beneficiaryName,
              `Recipient ${index + 1}: beneficiary name`,
            ),
          paymentType:
            normalizePaymentType(
              recipient.paymentType,
            ),
          amount:
            normalizeAmount(
              recipient.amount,
              `Recipient ${index + 1}: payment amount`,
            ),
          currency:
            normalizeCurrency(
              recipient.currency,
              bankAccount.currency,
            ),
          accountNumber:
            optionalText(
              recipient.accountNumber,
              `Recipient ${index + 1}: account number`,
            ),
          paybillNumber:
            optionalText(
              recipient.paybillNumber,
              `Recipient ${index + 1}: PayBill number`,
            ),
          tillNumber:
            optionalText(
              recipient.tillNumber,
              `Recipient ${index + 1}: Till number`,
            ),
          accountReference:
            optionalText(
              recipient.accountReference,
              `Recipient ${index + 1}: account reference`,
            ),
          bankCode:
            optionalText(
              recipient.bankCode,
              `Recipient ${index + 1}: bank code`,
            ),
          branchCode:
            optionalText(
              recipient.branchCode,
              `Recipient ${index + 1}: branch code`,
            ),
          description:
            optionalText(
              recipient.description,
              `Recipient ${index + 1}: description`,
            ) ?? description,
        };
      },
    );

  const paymentsInput =
    preparedRecipients.map(
      (recipient) => {
        const paymentReference =
          generatePaymentReference();

        return {
          paymentReference,
          beneficiaryName:
            recipient.beneficiaryName,
          paymentType:
            recipient.paymentType,
          accountNumber:
            recipient.accountNumber,
          paybillNumber:
            recipient.paybillNumber,
          tillNumber:
            recipient.tillNumber,
          accountReference:
            recipient.accountReference,
          bankCode:
            recipient.bankCode,
          branchCode:
            recipient.branchCode,
          amount:
            recipient.amount,
          currency:
            recipient.currency,
          description:
            recipient.description,
          idempotencyKey:
            buildIdempotencyKey(
              organizationId,
              paymentReference,
            ),
        };
      },
    );

  /*
   * Persist first. Provider calls are deliberately outside the
   * database transaction so an external network call can never
   * hold a database transaction open.
   */
  const persisted =
    await createBankPaymentBatchWithPayments({
      organizationId,
      bankAccountId:
        bankAccount.id,
      batchReference,
      description,
      provider:
        provider ??
        undefined,
      idempotencyKey,
      payments:
        paymentsInput,
    });

  const results:
    PersistedBankPaymentResult[] = [];

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
     * Never submit a final payment again.
     */
    if (
      payment.status === "COMPLETED" ||
      payment.status === "FAILED"
    ) {
      results.push({
        payment,
        providerResult: {
          accepted:
            payment.status === "COMPLETED",
          status:
            payment.status === "COMPLETED"
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
        recipient,
      });

    if (
      providerResult.status ===
      "COMPLETED"
    ) {
      const updated =
        await updateBankPaymentStatus({
          organizationId,
          paymentId:
            payment.id,
          status: "SUCCESS",
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
          status: "FAILED",
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

    const updated =
      await updateBankPaymentStatus({
        organizationId,
        paymentId:
          payment.id,
        status: "PROCESSING",
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

  const rows =
    await getBankPaymentBatch(
      organizationId,
      persisted.batch.id,
    );

  if (
    rows.length === 0
  ) {
    throw new Error(
      "Payment batch could not be retrieved after processing.",
    );
  }

  const finalBatch =
    rows[0];

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
