import prisma from "../config/prisma";
import { decryptSecret } from "../utils/encryption";

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

/* =========================================================
   HTTPS VALIDATION
========================================================= */

function requireHttps(url: string): void {
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

/* =========================================================
   BALANCE ENDPOINT
========================================================= */

function getBalancePath(
  provider?: string | null,
): string {
  const normalized = String(provider ?? "")
    .trim()
    .toUpperCase();

  const providerPath = normalized
    ? process.env[
        `BANK_BALANCE_PATH_${normalized}`
      ]
    : undefined;

  const path =
    providerPath?.trim() ||
    process.env.BANK_BALANCE_PATH?.trim();

  if (!path) {
    throw new Error(
      `No bank balance endpoint configured for provider "${provider ?? "unknown"}".`,
    );
  }

  return path;
}

/* =========================================================
   BALANCE NORMALIZATION
========================================================= */

function toBalance(
  value: unknown,
): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(
            value
              .replace(/,/g, "")
              .trim(),
          )
        : NaN;

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return (
    Math.round(parsed * 100) / 100
  );
}

/* =========================================================
   EXTRACT BALANCE FROM PROVIDER RESPONSE
========================================================= */

function extractBalance(
  data: BankBalanceResponse,
): number | null {
  const candidates: unknown[] = [
    data.availableBalance,
    data.currentBalance,
    data.balance,
    data.available_balance,
    data.accountBalance,
    data.data?.availableBalance,
    data.data?.currentBalance,
    data.data?.balance,
    data.data?.available_balance,
    data.data?.accountBalance,
  ];

  for (const candidate of candidates) {
    const balance =
      toBalance(candidate);

    if (balance !== null) {
      return balance;
    }
  }

  return null;
}

/* =========================================================
   RESPONSE PARSER
========================================================= */

function parseResponseBody(
  text: string,
): BankBalanceResponse {
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(
      text,
    ) as BankBalanceResponse;
  } catch {
    return {
      message: text,
    };
  }
}

/* =========================================================
   SYNC ONE BANK ACCOUNT
========================================================= */

export async function syncBankAccountBalance(
  organizationId: string,
  bankAccountId: string,
): Promise<SyncResult> {
  const bankAccount =
    await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        organizationId,
        status: "ACTIVE",
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

  if (!bankAccount.apiBaseUrl) {
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

  const configuredPath =
    getBalancePath(
      bankAccount.integrationProvider,
    );

  const endpoint =
    configuredPath.startsWith(
      "http://",
    ) ||
    configuredPath.startsWith(
      "https://",
    )
      ? configuredPath
      : `${baseUrl}/${configuredPath.replace(
          /^\/+/,
          "",
        )}`;

  requireHttps(endpoint);

  const headers: Record<
    string,
    string
  > = {
    Accept: "application/json",
  };

  if (bankAccount.apiKey) {
    headers["X-API-Key"] =
      decryptSecret(
        bankAccount.apiKey,
      );
  }

  if (bankAccount.apiSecret) {
    headers["X-API-Secret"] =
      decryptSecret(
        bankAccount.apiSecret,
      );
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    30_000,
  );

  try {
    const response =
      await fetch(endpoint, {
        method: "GET",
        headers,
        signal:
          controller.signal,
      });

    const data =
      parseResponseBody(
        await response.text(),
      );

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          `Bank balance request failed with HTTP ${response.status}.`,
      );
    }

    const currentBalance =
      extractBalance(data);

    if (currentBalance === null) {
      throw new Error(
        "Bank provider response did not contain a valid balance.",
      );
    }

    const lastSyncAt =
      new Date();

    await prisma.bankAccount.update({
      where: {
        id: bankAccount.id,
      },
      data: {
        currentBalance,
        lastSyncAt,
        connectionStatus:
          "CONNECTED",
      },
    });

    return {
      success: true,
      bankAccountId:
        bankAccount.id,
      currentBalance,
      currency:
        bankAccount.currency,
      lastSyncAt,
      provider:
        bankAccount.integrationProvider,
      message:
        "Bank balance synchronized successfully.",
    };
  } catch (error) {
    if (
      error instanceof
        DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "Bank balance request timed out.",
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Unable to synchronize bank balance.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   SYNC ALL ORGANIZATION BANK ACCOUNTS
========================================================= */

export async function syncOrganizationBankBalances(
  organizationId: string,
): Promise<SyncResult[]> {
  const accounts =
    await prisma.bankAccount.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        integrationEnabled: true,
        connectionStatus:
          "CONNECTED",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  const results: SyncResult[] = [];

  for (const account of accounts) {
    try {
      results.push(
        await syncBankAccountBalance(
          organizationId,
          account.id,
        ),
      );
    } catch (error) {
      results.push({
        success: false,
        bankAccountId:
          account.id,
        currency:
          account.currency,
        provider:
          account.integrationProvider,
        message:
          error instanceof Error
            ? error.message
            : "Unable to synchronize bank balance.",
      });
    }
  }

  return results;
}