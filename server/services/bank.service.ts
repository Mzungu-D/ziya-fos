import axios, {
  AxiosError,
  AxiosInstance,
} from "axios";

import prisma from "../config/prisma";
import {
  decryptSecret,
} from "../utils/encryption";

/* =========================================================
   TYPES
========================================================= */

export interface BankConnectionResult {
  success: boolean;
  status:
    | "CONNECTED"
    | "DISCONNECTED";
  message: string;
  provider?: string;
  details?: Record<
    string,
    unknown
  >;
}

export interface BankAccountConfig {
  id: string;
  organizationId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string | null;
  currency: string;

  integrationEnabled: boolean;
  integrationProvider: string | null;

  apiBaseUrl: string | null;

  /*
   * These values are decrypted only inside
   * this service and are never returned to
   * the frontend.
   */
  apiKey: string | null;
  apiSecret: string | null;

  webhookUrl: string | null;

  connectionStatus: string;
  status: string;
}

interface ProviderResponse {
  status: number;
  data: unknown;
}

/* =========================================================
   CONSTANTS
========================================================= */

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_API_RESPONSE_BYTES = 2_000_000;
const MAX_PATH_LENGTH = 500;
const MAX_PROVIDER_NAME_LENGTH = 100;
const MAX_ERROR_MESSAGE_LENGTH = 500;
const ALLOWED_METHODS = new Set(["GET", "POST"] as const);

/*
 * We intentionally do not treat a successful
 * response from "/" as proof that bank credentials
 * are authenticated.
 *
 * Provider-specific authentication must eventually
 * be implemented by the provider adapter.
 */
const GENERIC_CONNECTION_PATH = "/";

/* =========================================================
   URL HELPERS
========================================================= */

function normalizeBaseUrl(
  value: string
): string {
  return value.replace(
    /\/+$/,
    ""
  );
}

function isValidUrl(
  value: string
): boolean {
  try {
    const url = new URL(value);

    if (
      url.username ||
      url.password
    ) {
      return false;
    }

    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/* =========================================================
   CREDENTIAL HELPERS
========================================================= */

/**
 * Decrypts a stored credential.
 *
 * New credentials use AES-256-GCM/base64.
 * Existing legacy credentials are also supported
 * by decryptSecret().
 *
 * A null or empty value remains null.
 */
function decryptOptionalSecret(
  value: string | null
): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    return null;
  }

  return decryptSecret(value);
}

/* =========================================================
   HTTP CLIENT
========================================================= */

function createHttpClient(
  config: BankAccountConfig
): AxiosInstance {
  if (!config.apiBaseUrl) {
    throw new Error(
      "Bank API base URL is not configured."
    );
  }

  validateProvider(
    config.integrationProvider
  );

  if (
    !isValidUrl(
      config.apiBaseUrl
    )
  ) {
    throw new Error(
      "Bank API base URL must be a valid HTTPS URL."
    );
  }

  const headers: Record<
    string,
    string
  > = {
    Accept:
      "application/json",
    "Content-Type":
      "application/json",
    "User-Agent":
      "Ziya-FOS-Bank-Integration/1.0",
  };

  /*
   * IMPORTANT:
   *
   * The values in BankAccount are encrypted.
   * At this point they have already been
   * decrypted by getBankAccountForOrganization().
   */
  if (config.apiKey) {
    headers["X-API-Key"] =
      config.apiKey;
  }

  if (config.apiSecret) {
    headers["X-API-Secret"] =
      config.apiSecret;
  }

  return axios.create({
    baseURL:
      normalizeBaseUrl(
        config.apiBaseUrl
      ),
    timeout:
      REQUEST_TIMEOUT_MS,
    maxContentLength:
      MAX_API_RESPONSE_BYTES,
    maxBodyLength:
      MAX_API_RESPONSE_BYTES,
    headers,

    /*
     * We handle HTTP status codes ourselves.
     */
    validateStatus:
      () => true,
  });
}

function truncateMessage(
  value: string
): string {
  const normalized =
    String(value || "").trim();

  return normalized.length <=
    MAX_ERROR_MESSAGE_LENGTH
    ? normalized
    : `${normalized.slice(
        0,
        MAX_ERROR_MESSAGE_LENGTH
      )}`;
}

/* =========================================================
   ERROR HANDLING
========================================================= */

function extractErrorMessage(
  error: unknown
): string {
  if (
    axios.isAxiosError(error)
  ) {
    const axiosError =
      error as AxiosError;

    const responseData =
      axiosError.response
        ?.data;

    if (
      responseData &&
      typeof responseData ===
        "object"
    ) {
      const data =
        responseData as Record<
          string,
          unknown
        >;

      if (
        typeof data.message ===
        "string"
      ) {
        return data.message;
      }

      if (
        typeof data.error ===
        "string"
      ) {
        return data.error;
      }
    }

    if (
      axiosError.code ===
      "ECONNABORTED"
    ) {
      return "Bank API request timed out.";
    }

    if (
      axiosError.code ===
      "ETIMEDOUT"
    ) {
      return "Connection to the bank API timed out.";
    }

    if (
      axiosError.code ===
      "ENOTFOUND"
    ) {
      return "Bank API host could not be resolved.";
    }

    if (
      axiosError.code ===
      "ECONNREFUSED"
    ) {
      return "Connection to the bank API was refused.";
    }

    return truncateMessage(
      axiosError.message ||
        "Bank API request failed."
    );
  }

  if (
    error instanceof Error
  ) {
    return truncateMessage(
      error.message
    );
  }

  return "Unknown bank integration error.";
}

function validateProvider(
  provider: string | null
): asserts provider is string {
  if (
    !provider ||
    provider.trim().length === 0
  ) {
    throw new Error(
      "Bank integration provider is not configured."
    );
  }

  if (
    provider.length >
    MAX_PROVIDER_NAME_LENGTH
  ) {
    throw new Error(
      "Bank integration provider is invalid."
    );
  }
}

function validatePath(
  path: string
): string {
  const normalized =
    String(path || "").trim();

  if (
    !normalized ||
    normalized.length >
      MAX_PATH_LENGTH ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    normalized.includes("\0")
  ) {
    throw new Error(
      "Bank API path is invalid."
    );
  }

  try {
    const parsed =
      new URL(normalized, "https://bank.invalid");

    if (
      parsed.origin !==
        "https://bank.invalid" ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "Bank API path is invalid."
    );
  }

  return normalized;
}

function assertSafePayload(
  payload: unknown
): void {
  if (payload === undefined) {
    return;
  }

  try {
    const serialized =
      JSON.stringify(payload);

    if (
      serialized &&
      Buffer.byteLength(
        serialized,
        "utf8"
      ) > MAX_API_RESPONSE_BYTES
    ) {
      throw new Error(
        "Bank API payload is too large."
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "Bank API payload is too large."
    ) {
      throw error;
    }

    throw new Error(
      "Bank API payload is invalid."
    );
  }
}

/* =========================================================
   STATUS HELPERS
========================================================= */

function isSuccessfulStatus(
  status: number
): boolean {
  return (
    status >= 200 &&
    status < 300
  );
}

/* =========================================================
   LOAD BANK ACCOUNT
========================================================= */

/**
 * Retrieves an ACTIVE bank account belonging
 * to the supplied organization.
 *
 * Tenant isolation is enforced here.
 *
 * Stored credentials are decrypted only inside
 * this service.
 */
export async function getBankAccountForOrganization(
  organizationId: string,
  bankAccountId: string
): Promise<
  BankAccountConfig | null
> {
  const account =
    await prisma.bankAccount.findFirst(
      {
        where: {
          id: bankAccountId,
          organizationId,
          status: "ACTIVE",
        },
      }
    );

  if (!account) {
    return null;
  }

  let decryptedApiKey:
    | string
    | null = null;

  let decryptedApiSecret:
    | string
    | null = null;

  /*
   * Decryption happens only after the account
   * has passed the organization ownership check.
   */
  try {
    decryptedApiKey =
      decryptOptionalSecret(
        account.apiKey
      );

    decryptedApiSecret =
      decryptOptionalSecret(
        account.apiSecret
      );
  } catch {
    /*
     * Do not expose cryptographic details.
     *
     * Returning null here allows the connection
     * test to report a configuration problem
     * without leaking secret information.
     */
    decryptedApiKey = null;
    decryptedApiSecret =
      null;
  }

  return {
    id: account.id,

    organizationId:
      account.organizationId,

    bankName:
      account.bankName,

    accountName:
      account.accountName,

    accountNumber:
      account.accountNumber,

    branchName:
      account.branchName,

    currency:
      account.currency,

    integrationEnabled:
      account.integrationEnabled,

    integrationProvider:
      account.integrationProvider,

    apiBaseUrl:
      account.apiBaseUrl,

    apiKey:
      decryptedApiKey,

    apiSecret:
      decryptedApiSecret,

    webhookUrl:
      account.webhookUrl,

    connectionStatus:
      account.connectionStatus,

    status:
      account.status,
  };
}

/* =========================================================
   TEST BANK CONNECTION
========================================================= */

/**
 * Tests connectivity to the configured bank API.
 *
 * IMPORTANT:
 *
 * A successful HTTP response from the generic
 * base URL proves API reachability only.
 *
 * It does NOT prove that a provider-specific
 * payment credential is valid.
 *
 * Provider-specific authentication should be
 * implemented through adapters.
 */
export async function testBankConnection(
  organizationId: string,
  bankAccountId: string
): Promise<BankConnectionResult> {
  const account =
    await getBankAccountForOrganization(
      organizationId,
      bankAccountId
    );

  if (!account) {
    return {
      success: false,
      status: "DISCONNECTED",
      message:
        "Bank account not found.",
    };
  }

  if (
    !account.integrationEnabled
  ) {
    return {
      success: false,
      status: "DISCONNECTED",
      message:
        "Bank integration is disabled.",
    };
  }

  if (
    !account.integrationProvider
  ) {
    return {
      success: false,
      status: "DISCONNECTED",
      message:
        "Bank integration provider is not configured.",
    };
  }

  if (!account.apiBaseUrl) {
    return {
      success: false,
      status: "DISCONNECTED",
      message:
        "Bank API base URL is not configured.",
    };
  }

  /*
   * If credentials were configured but could
   * not be decrypted, do not attempt a request.
   */
  if (
    account.apiKey === null &&
    account.apiSecret === null
  ) {
    return {
      success: false,
      status: "DISCONNECTED",
      message:
        "Bank API credentials are not configured or could not be decrypted.",
      provider:
        account.integrationProvider,
    };
  }

  try {
    const client =
      createHttpClient(
        account
      );

    const response =
      await client.get(
        GENERIC_CONNECTION_PATH
      );

    /*
     * We deliberately distinguish between
     * reachability and provider authentication.
     *
     * For now, a successful HTTP response means
     * the configured API endpoint is reachable.
     *
     * Provider adapters will later perform the
     * actual authentication test.
     */
    const reachable =
      isSuccessfulStatus(
        response.status
      );

    if (!reachable) {
      await prisma.bankAccount.update(
        {
          where: {
            id: account.id,
            organizationId:
              account.organizationId,
          },
          data: {
            connectionStatus:
              "DISCONNECTED",
          },
        }
      );

      return {
        success: false,
        status: "DISCONNECTED",
        message:
          `Bank API returned HTTP ${response.status}.`,
        provider:
          account.integrationProvider,
        details: {
          httpStatus:
            response.status,
        },
      };
    }

    await prisma.bankAccount.update(
      {
        where: {
          id: account.id,
          organizationId:
            account.organizationId,
        },
        data: {
          connectionStatus:
            "CONNECTED",
          lastSyncAt:
            new Date(),
        },
      }
    );

    return {
      success: true,
      status: "CONNECTED",
      message:
        "Bank API endpoint is reachable.",
      provider:
        account.integrationProvider,
      details: {
        httpStatus:
          response.status,
        authentication:
          "Provider-specific authentication should be verified by the provider adapter.",
      },
    };
  } catch (error: unknown) {
    await prisma.bankAccount.update(
      {
        where: {
          id: account.id,
          organizationId:
            account.organizationId,
        },
        data: {
          connectionStatus:
            "DISCONNECTED",
        },
      }
    );

    return {
      success: false,
      status: "DISCONNECTED",
      message:
        extractErrorMessage(
          error
        ),
      provider:
        account.integrationProvider,
    };
  }
}

/* =========================================================
   PROVIDER REQUEST
========================================================= */

/**
 * Internal provider request helper.
 *
 * Credentials are already decrypted in memory
 * and are never returned in the response.
 */
async function providerRequest(
  account: BankAccountConfig,
  method:
    | "GET"
    | "POST",
  path: string,
  payload?: unknown
): Promise<ProviderResponse> {
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(
      "Bank API method is not supported."
    );
  }

  const safePath =
    validatePath(path);

  if (method === "POST") {
    assertSafePayload(payload);
  }

  const client =
    createHttpClient(
      account
    );

  try {
    const response =
      method === "GET"
        ? await client.get(
            safePath
          )
        : await client.post(
            safePath,
            payload
          );

    return {
      status:
        response.status,
      data:
        response.data,
    };
  } catch (error: unknown) {
    throw new Error(
      extractErrorMessage(
        error
      )
    );
  }
}

/* =========================================================
   BANK GET
========================================================= */

/**
 * Generic authenticated GET helper.
 *
 * Intended for provider adapters.
 */
export async function bankGet(
  organizationId: string,
  bankAccountId: string,
  path: string
): Promise<ProviderResponse> {
  const safePath =
    validatePath(path);

  const account =
    await getBankAccountForOrganization(
      organizationId,
      bankAccountId
    );

  if (!account) {
    throw new Error(
      "Bank account not found."
    );
  }

  if (
    !account.integrationEnabled
  ) {
    throw new Error(
      "Bank integration is disabled."
    );
  }

  if (!account.integrationProvider) {
    throw new Error(
      "Bank integration provider is not configured."
    );
  }

  return providerRequest(
    account,
    "GET",
    safePath
  );
}

/* =========================================================
   BANK POST
========================================================= */

/**
 * Generic authenticated POST helper.
 *
 * Intended for provider adapters and future
 * payment operations.
 */
export async function bankPost(
  organizationId: string,
  bankAccountId: string,
  path: string,
  payload: unknown
): Promise<ProviderResponse> {
  const safePath =
    validatePath(path);

  const account =
    await getBankAccountForOrganization(
      organizationId,
      bankAccountId
    );

  if (!account) {
    throw new Error(
      "Bank account not found."
    );
  }

  if (
    !account.integrationEnabled
  ) {
    throw new Error(
      "Bank integration is disabled."
    );
  }

  if (!account.integrationProvider) {
    throw new Error(
      "Bank integration provider is not configured."
    );
  }

  return providerRequest(
    account,
    "POST",
    safePath,
    payload
  );
}

/* =========================================================
   DECRYPT BANK SECRET
========================================================= */

/**
 * Decrypts a stored bank secret for a trusted
 * internal provider adapter.
 *
 * Controllers should never call this function.
 */
export function decryptBankSecret(
  encryptedSecret: string
): string {
  return decryptSecret(
    encryptedSecret
  );
}