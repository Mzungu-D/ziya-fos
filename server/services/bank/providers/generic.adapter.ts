import {
  BankAccountData,
  BankAdapter,
  BankAdapterConfig,
  BankConnectionTestResult,
  BankPaymentRequest,
  BankPaymentResponse,
  BankPaymentStatus,
  BankTransactionData,
} from "../bank.adapter";

import {
  BankHttpClient,
  BankHttpError,
} from "../bank.http";

export class GenericBankAdapter
  implements BankAdapter
{
  readonly provider: string;

  private readonly client: BankHttpClient;

  constructor(
    config: BankAdapterConfig,
  ) {
    const provider =
      config.provider?.trim();

    if (!provider) {
      throw new Error(
        "Bank integration provider is required.",
      );
    }

    const apiBaseUrl =
      config.apiBaseUrl?.trim();

    if (!apiBaseUrl) {
      throw new Error(
        "Bank API base URL is required.",
      );
    }

    this.provider = provider;

    this.client =
      new BankHttpClient({
        baseUrl: apiBaseUrl,

        apiKey:
          config.apiKey,

        apiSecret:
          config.apiSecret,

        clientId:
          config.clientId,

        clientSecret:
          config.clientSecret,

        accessToken:
          config.accessToken,
      });
  }

  async testConnection(): Promise<BankConnectionTestResult> {
    try {
      const response =
        await this.client.get(
          "/",
        );

      return {
        success: true,

        status:
          "CONNECTED",

        message:
          "Bank API connection successful.",

        provider:
          this.provider,

        httpStatus:
          response.status,
      };
    } catch (error) {
      return {
        success: false,

        status:
          "ERROR",

        message:
          this.getConnectionErrorMessage(
            error,
          ),

        provider:
          this.provider,

        httpStatus:
          error instanceof
          BankHttpError
            ? error.httpStatus
            : undefined,
      };
    }
  }

  async getAccounts(): Promise<BankAccountData[]> {
    throw new Error(
      `Account retrieval requires a provider-specific adapter for "${this.provider}".`,
    );
  }

  async getBalance(
    accountNumber: string,
  ): Promise<number> {
    void accountNumber;

    throw new Error(
      `Balance retrieval requires a provider-specific adapter for "${this.provider}".`,
    );
  }

  async getTransactions(
    accountNumber: string,
    from?: Date,
    to?: Date,
  ): Promise<BankTransactionData[]> {
    void accountNumber;
    void from;
    void to;

    throw new Error(
      `Transaction retrieval requires a provider-specific adapter for "${this.provider}".`,
    );
  }

  async initiatePayment(
    payment: BankPaymentRequest,
  ): Promise<BankPaymentResponse> {
    void payment;

    throw new Error(
      `Payment initiation requires a provider-specific adapter for "${this.provider}".`,
    );
  }

  async getPaymentStatus(
    providerReference: string,
  ): Promise<BankPaymentStatus> {
    return {
      providerReference,

      status:
        "UNKNOWN",

      message:
        `Payment status retrieval requires a provider-specific adapter for "${this.provider}".`,
    };
  }

  private getConnectionErrorMessage(
    error: unknown,
  ): string {
    if (
      error instanceof
      BankHttpError
    ) {
      switch (
        error.code
      ) {
        case "UNAUTHORIZED":
          return "Bank API authentication failed. Check the API credentials.";

        case "FORBIDDEN":
          return "Bank API rejected the supplied credentials or permissions.";

        case "NOT_FOUND":
          return "The configured bank API endpoint was not found.";

        case "RATE_LIMITED":
          return "The bank API rate limit has been reached. Please try again later.";

        case "TIMEOUT":
          return "The bank API request timed out.";

        case "DNS_ERROR":
          return "The bank API host could not be resolved.";

        case "CONNECTION_REFUSED":
          return "The bank API refused the connection.";

        case "BAD_REQUEST":
          return "The bank API rejected the connection request.";

        case "SERVER_ERROR":
          return "The bank API is currently experiencing a server error.";

        case "INVALID_URL":
          return "The configured bank API URL is invalid.";

        default:
          return error.message;
      }
    }

    if (
      error instanceof
      Error
    ) {
      return error.message;
    }

    return "Unable to connect to the bank API.";
  }
}