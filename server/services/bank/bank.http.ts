import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

export type BankHttpErrorCode =
  | "INVALID_URL"
  | "TIMEOUT"
  | "DNS_ERROR"
  | "CONNECTION_REFUSED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "BAD_REQUEST"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface BankHttpErrorDetails {
  code: BankHttpErrorCode;
  message: string;
  httpStatus?: number;
  retryable: boolean;
  retryAfterSeconds?: number;
}

export class BankHttpError extends Error {
  public readonly code: BankHttpErrorCode;
  public readonly httpStatus?: number;
  public readonly retryable: boolean;
  public readonly retryAfterSeconds?: number;

  constructor(
    details: BankHttpErrorDetails,
  ) {
    super(details.message);

    this.name = "BankHttpError";
    this.code = details.code;
    this.httpStatus =
      details.httpStatus;
    this.retryable =
      details.retryable;
    this.retryAfterSeconds =
      details.retryAfterSeconds;

    Object.setPrototypeOf(
      this,
      BankHttpError.prototype,
    );
  }
}

export interface BankHttpClientOptions {
  baseUrl: string;

  apiKey?: string | null;
  apiSecret?: string | null;

  clientId?: string | null;
  clientSecret?: string | null;

  accessToken?: string | null;

  timeoutMs?: number;

  userAgent?: string;
}

export interface BankHttpResponse<T> {
  data: T;
  status: number;
  headers: Record<
    string,
    string
  >;
}

const DEFAULT_TIMEOUT_MS = 15_000;

const DEFAULT_USER_AGENT =
  "Ziya-FOS-Bank-Integration/1.0";

function validateBaseUrl(
  baseUrl: string,
): URL {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new BankHttpError({
      code: "INVALID_URL",
      message:
        "Bank API base URL is invalid.",
      retryable: false,
    });
  }

  const isLocal =
    url.hostname ===
      "localhost" ||
    url.hostname ===
      "127.0.0.1";

  if (
    url.protocol !== "https:" &&
    !isLocal
  ) {
    throw new BankHttpError({
      code: "INVALID_URL",
      message:
        "Bank API base URL must use HTTPS.",
      retryable: false,
    });
  }

  return url;
}

function parseRetryAfter(
  value: unknown,
): number | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const seconds =
    Number(value);

  if (
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return Math.ceil(seconds);
  }

  const date =
    Date.parse(value);

  if (
    Number.isNaN(date)
  ) {
    return undefined;
  }

  const difference =
    Math.ceil(
      (date - Date.now()) /
        1000,
    );

  return Math.max(
    difference,
    0,
  );
}

function extractMessage(
  error: AxiosError,
): string {
  const responseData =
    error.response?.data;

  if (
    responseData &&
    typeof responseData ===
      "object"
  ) {
    const body =
      responseData as Record<
        string,
        unknown
      >;

    const candidates = [
      body.message,
      body.error,
      body.detail,
      body.error_description,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate ===
        "string"
      ) {
        return candidate;
      }
    }
  }

  if (
    typeof responseData ===
    "string"
  ) {
    return responseData;
  }

  return (
    error.message ||
    "Bank API request failed."
  );
}

function createHttpError(
  error: AxiosError,
): BankHttpError {
  const status =
    error.response?.status;

  const retryAfter =
    parseRetryAfter(
      error.response?.headers?.[
        "retry-after"
      ],
    );

  if (
    error.code ===
    "ECONNABORTED" ||
    error.code ===
    "ETIMEDOUT"
  ) {
    return new BankHttpError({
      code: "TIMEOUT",
      message:
        "Bank API request timed out.",
      retryable: true,
    });
  }

  if (
    error.code ===
    "ENOTFOUND"
  ) {
    return new BankHttpError({
      code: "DNS_ERROR",
      message:
        "Bank API host could not be resolved.",
      retryable: true,
    });
  }

  if (
    error.code ===
    "ECONNREFUSED"
  ) {
    return new BankHttpError({
      code: "CONNECTION_REFUSED",
      message:
        "Connection to the bank API was refused.",
      retryable: true,
    });
  }

  if (status === 400) {
    return new BankHttpError({
      code: "BAD_REQUEST",
      message:
        extractMessage(error),
      httpStatus: status,
      retryable: false,
    });
  }

  if (status === 401) {
    return new BankHttpError({
      code: "UNAUTHORIZED",
      message:
        "Bank API authentication failed.",
      httpStatus: status,
      retryable: false,
    });
  }

  if (status === 403) {
    return new BankHttpError({
      code: "FORBIDDEN",
      message:
        "Bank API rejected the request.",
      httpStatus: status,
      retryable: false,
    });
  }

  if (status === 404) {
    return new BankHttpError({
      code: "NOT_FOUND",
      message:
        "Bank API endpoint was not found.",
      httpStatus: status,
      retryable: false,
    });
  }

  if (status === 429) {
    return new BankHttpError({
      code: "RATE_LIMITED",
      message:
        "Bank API rate limit was reached.",
      httpStatus: status,
      retryable: true,
      retryAfterSeconds:
        retryAfter,
    });
  }

  if (
    status !== undefined &&
    status >= 500
  ) {
    return new BankHttpError({
      code: "SERVER_ERROR",
      message:
        "Bank API returned a server error.",
      httpStatus: status,
      retryable: true,
      retryAfterSeconds:
        retryAfter,
    });
  }

  if (!status) {
    return new BankHttpError({
      code: "NETWORK_ERROR",
      message:
        "Unable to communicate with the bank API.",
      retryable: true,
    });
  }

  return new BankHttpError({
    code: "UNKNOWN",
    message:
      extractMessage(error),
    httpStatus: status,
    retryable: false,
  });
}

function sanitizeHeaderValue(
  value: string,
): string {
  return value
    .replace(
      /[\r\n]/g,
      "",
    )
    .trim();
}

export class BankHttpClient {
  private readonly client: AxiosInstance;

  constructor(
    options: BankHttpClientOptions,
  ) {
    const url =
      validateBaseUrl(
        options.baseUrl,
      );

    const headers: Record<
      string,
      string
    > = {
      Accept:
        "application/json",
      "Content-Type":
        "application/json",
      "User-Agent":
        sanitizeHeaderValue(
          options.userAgent ||
            DEFAULT_USER_AGENT,
        ),
    };

    if (options.apiKey) {
      headers[
        "X-API-Key"
      ] =
        sanitizeHeaderValue(
          options.apiKey,
        );
    }

    if (options.apiSecret) {
      headers[
        "X-API-Secret"
      ] =
        sanitizeHeaderValue(
          options.apiSecret,
        );
    }

    if (options.clientId) {
      headers[
        "X-Client-Id"
      ] =
        sanitizeHeaderValue(
          options.clientId,
        );
    }

    if (options.clientSecret) {
      headers[
        "X-Client-Secret"
      ] =
        sanitizeHeaderValue(
          options.clientSecret,
        );
    }

    if (options.accessToken) {
      headers.Authorization =
        `Bearer ${sanitizeHeaderValue(
          options.accessToken,
        )}`;
    }

    this.client =
      axios.create({
        baseURL:
          url.toString().replace(
            /\/+$/,
            "",
          ),

        timeout:
          options.timeoutMs ??
          DEFAULT_TIMEOUT_MS,

        headers,

        validateStatus:
          () => true,
      });
  }

  async request<T>(
    config: AxiosRequestConfig,
  ): Promise<
    BankHttpResponse<T>
  > {
    try {
      const response =
        await this.client.request<T>(
          config,
        );

      if (
        response.status < 200 ||
        response.status >= 300
      ) {
        throw createHttpError(
          new AxiosError(
            `Bank API returned HTTP ${response.status}`,
            undefined,
            response.config,
            response.request,
            response,
          ),
        );
      }

      return {
        data: response.data,
        status:
          response.status,
        headers:
          this.extractHeaders(
            response,
          ),
      };
    } catch (error) {
      if (
        error instanceof
        BankHttpError
      ) {
        throw error;
      }

      if (
        axios.isAxiosError(
          error,
        )
      ) {
        throw createHttpError(
          error,
        );
      }

      throw new BankHttpError({
        code: "UNKNOWN",
        message:
          error instanceof Error
            ? error.message
            : "Unknown bank API error.",
        retryable: false,
      });
    }
  }

  async get<T>(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<
    BankHttpResponse<T>
  > {
    return this.request<T>({
      ...config,
      method: "GET",
      url: path,
    });
  }

  async post<T>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<
    BankHttpResponse<T>
  > {
    return this.request<T>({
      ...config,
      method: "POST",
      url: path,
      data,
    });
  }

  async put<T>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<
    BankHttpResponse<T>
  > {
    return this.request<T>({
      ...config,
      method: "PUT",
      url: path,
      data,
    });
  }

  async patch<T>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<
    BankHttpResponse<T>
  > {
    return this.request<T>({
      ...config,
      method: "PATCH",
      url: path,
      data,
    });
  }

  async delete<T>(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<
    BankHttpResponse<T>
  > {
    return this.request<T>({
      ...config,
      method: "DELETE",
      url: path,
    });
  }

  private extractHeaders(
    response: AxiosResponse,
  ): Record<
    string,
    string
  > {
    const headers: Record<
      string,
      string
    > = {};

    for (const [key, value] of Object.entries(
      response.headers,
    )) {
      if (
        typeof value ===
        "string"
      ) {
        headers[key] = value;
      } else if (
        Array.isArray(value)
      ) {
        headers[key] =
          value.join(",");
      }
    }

    return headers;
  }
}