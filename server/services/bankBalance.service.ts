import prisma from "../config/prisma";
import { bankGet } from "./bank.service";

/* =========================================================
   TYPES
========================================================= */

interface BankBalanceResponse {
  success?: boolean;
  balance?: number | string;
  currentBalance?: number | string;
  availableBalance?: number | string;
  available_balance?: number | string;
  accountBalance?: number | string;
  data?: {
    balance?: number | string;
    currentBalance?: number | string;
    availableBalance?: number | string;
    available_balance?: number | string;
    accountBalance?: number | string;
  };
  message?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SyncResult {
  success: boolean;
  bankAccountId: string;
  currentBalance?: number;
  currency: string;
  lastSyncAt?: Date;
  provider?: string | null;
  message: string;
}

const DEFAULT_BALANCE_PATH = "/balance";
const MAX_BALANCE = 999_999_999_999_999.99;
const MAX_PROVIDER_LENGTH = 100;
const MAX_PATH_LENGTH = 500;
const MAX_RESPONSE_TEXT_LENGTH = 2_000_000;
const SYNC_CONCURRENCY = 4;

/* =========================================================
   VALIDATION
========================================================= */

function requireContext(
  organizationId: string,
  bankAccountId?: string,
): void {
  if (
    typeof organizationId !== "string" ||
    !organizationId.trim()
  ) {
    throw new Error("Organization context is required.");
  }

  if (
    bankAccountId !== undefined &&
    (
      typeof bankAccountId !== "string" ||
      !bankAccountId.trim()
    )
  ) {
    throw new Error("Bank account ID is required.");
  }
}

function validateProvider(
  provider?: string | null,
): string | null {
  const normalized = String(provider ?? "").trim();

  if (!normalized) {
    return null;
  }

  if (
    normalized.length > MAX_PROVIDER_LENGTH ||
    !/^[A-Za-z0-9._-]+$/.test(normalized)
  ) {
    throw new Error("Bank integration provider is invalid.");
  }

  return normalized;
}

/* =========================================================
   BALANCE ENDPOINT
========================================================= */

function getBalancePath(
  provider?: string | null,
): string {
  const normalizedProvider =
    validateProvider(provider);

  const providerPath = normalizedProvider
    ? process.env[
        `BANK_BALANCE_PATH_${normalizedProvider.toUpperCase()}`
      ]
    : undefined;

  const configuredPath =
    providerPath?.trim() ||
    process.env.BANK_BALANCE_PATH?.trim() ||
    DEFAULT_BALANCE_PATH;

  if (
    configuredPath.length > MAX_PATH_LENGTH ||
    !configuredPath.startsWith("/") ||
    configuredPath.startsWith("//") ||
    configuredPath.includes("\\") ||
    configuredPath.includes("\0")
  ) {
    throw new Error("Configured bank balance endpoint is invalid.");
  }

  /*
   * Only relative API paths are accepted here.
   * Absolute URLs are deliberately rejected because
   * bank.service owns the validated bank base URL.
   */
  try {
    const parsed = new URL(
      configuredPath,
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
    throw new Error("Configured bank balance endpoint is invalid.");
  }

  return configuredPath;
}

/* =========================================================
   MONEY NORMALIZATION
========================================================= */

function toBalance(
  value: unknown,
): number | null {
  let parsed: number;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string") {
    const normalized = value
      .replace(/,/g, "")
      .trim();

    if (!normalized) {
      return null;
    }

    parsed = Number(normalized);
  } else {
    return null;
  }

  if (
    !Number.isFinite(parsed) ||
    Math.abs(parsed) > MAX_BALANCE
  ) {
    return null;
  }

  /*
   * Bank accounts can legitimately have a negative available
   * or current balance because of overdrafts. Do not reject
   * signed balances.
   */
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

/* =========================================================
   RESPONSE EXTRACTION
========================================================= */

function extractBalance(
  data: BankBalanceResponse,
): number | null {
  const candidates: unknown[] = [
    data.currentBalance,
    data.balance,
    data.availableBalance,
    data.available_balance,
    data.accountBalance,
    data.data?.currentBalance,
    data.data?.balance,
    data.data?.availableBalance,
    data.data?.available_balance,
    data.data?.accountBalance,
  ];

  for (const candidate of candidates) {
    const balance = toBalance(candidate);

    if (balance !== null) {
      return balance;
    }
  }

  return null;
}

function parseResponseBody(
  text: string,
): BankBalanceResponse {
  const normalized = text.trim();

  if (!normalized) {
    return {};
  }

  if (
    Buffer.byteLength(normalized, "utf8") >
    MAX_RESPONSE_TEXT_LENGTH
  ) {
    throw new Error("Bank balance response is too large.");
  }

  try {
    const parsed: unknown = JSON.parse(normalized);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }

    return parsed as BankBalanceResponse;
  } catch {
    return {
      message: normalized.slice(0, 500),
    };
  }
}

/* =========================================================
   PROVIDER ERROR
========================================================= */

function extractProviderMessage(
  data: BankBalanceResponse,
): string {
  const message =
    typeof data.message === "string"
      ? data.message.trim()
      : typeof data.error === "string"
        ? data.error.trim()
        : "";

  return message
    ? message.slice(0, 500)
    : "Bank provider rejected the balance request.";
}

/* =========================================================
   SYNC ONE BANK ACCOUNT
========================================================= */

export async function syncBankAccountBalance(
  organizationId: string,
  bankAccountId: string,
): Promise<SyncResult> {
  requireContext(
    organizationId,
    bankAccountId,
  );

  const bankAccount =
    await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        organizationId: true,
        currency: true,
        integrationEnabled: true,
        integrationProvider: true,
        connectionStatus: true,
      },
    });

  if (!bankAccount) {
    throw new Error(
      "Active bank account not found for this organization.",
    );
  }

  if (!bankAccount.integrationEnabled) {
    throw new Error(
      "Bank integration is not enabled for this account.",
    );
  }

  if (
    bankAccount.connectionStatus.toUpperCase() !==
    "CONNECTED"
  ) {
    throw new Error(
      "The bank account is not connected.",
    );
  }

  const balancePath =
    getBalancePath(
      bankAccount.integrationProvider,
    );

  try {
    const response = await bankGet(
      organizationId,
      bankAccount.id,
      balancePath,
    );

    const data =
      response.data &&
      typeof response.data === "object" &&
      !Array.isArray(response.data)
        ? response.data as BankBalanceResponse
        : parseResponseBody(
            typeof response.data === "string"
              ? response.data
              : "",
          );

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw new Error(
        extractProviderMessage(data),
      );
    }

    const currentBalance =
      extractBalance(data);

    if (currentBalance === null) {
      throw new Error(
        "Bank provider response did not contain a valid balance.",
      );
    }

    const lastSyncAt = new Date();

    /*
     * Tenant-scoped update prevents a stale or reused account ID
     * from modifying another organization's bank record.
     */
    const updated =
      await prisma.bankAccount.updateMany({
        where: {
          id: bankAccount.id,
          organizationId,
          status: "ACTIVE",
        },
        data: {
          currentBalance,
          lastSyncAt,
          connectionStatus: "CONNECTED",
        },
      });

    if (updated.count !== 1) {
      throw new Error(
        "Bank account changed or is no longer active.",
      );
    }

    return {
      success: true,
      bankAccountId: bankAccount.id,
      currentBalance,
      currency: bankAccount.currency,
      lastSyncAt,
      provider: bankAccount.integrationProvider,
      message:
        "Bank balance synchronized successfully.",
    };
  } catch (error) {
    /*
     * A balance sync failure must never overwrite the last known
     * balance. The account remains connected unless the lower
     * integration layer has explicitly determined that the
     * connection is invalid.
     */
    return Promise.reject(
      error instanceof Error
        ? error
        : new Error(
            "Unable to synchronize bank balance.",
          ),
    );
  }
}

/* =========================================================
   SYNC ALL ORGANIZATION BANK ACCOUNTS
========================================================= */

export async function syncOrganizationBankBalances(
  organizationId: string,
): Promise<SyncResult[]> {
  requireContext(organizationId);

  const accounts =
    await prisma.bankAccount.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        integrationEnabled: true,
        connectionStatus: "CONNECTED",
      },
      select: {
        id: true,
        currency: true,
        integrationProvider: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  const results: SyncResult[] = [];

  /*
   * Controlled concurrency avoids opening an unbounded number
   * of external bank requests for organizations with many accounts.
   */
  for (
    let index = 0;
    index < accounts.length;
    index += SYNC_CONCURRENCY
  ) {
    const batch = accounts.slice(
      index,
      index + SYNC_CONCURRENCY,
    );

    const batchResults =
      await Promise.all(
        batch.map(async (account) => {
          try {
            return await syncBankAccountBalance(
              organizationId,
              account.id,
            );
          } catch (error) {
            return {
              success: false,
              bankAccountId: account.id,
              currency: account.currency,
              provider: account.integrationProvider,
              message:
                error instanceof Error
                  ? error.message
                  : "Unable to synchronize bank balance.",
            } satisfies SyncResult;
          }
        }),
      );

    results.push(...batchResults);
  }

  return results;
}
