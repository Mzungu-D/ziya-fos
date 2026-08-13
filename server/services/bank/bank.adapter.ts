export type BankPaymentState =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN";

export type BankConnectionStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR";

export interface BankAdapterConfig {
  provider: string;
  apiBaseUrl: string;

  apiKey?: string | null;
  apiSecret?: string | null;

  clientId?: string | null;
  clientSecret?: string | null;

  accessToken?: string | null;

  webhookUrl?: string | null;
}

export interface BankAccountData {
  id?: string;

  accountName: string;
  accountNumber: string;

  currency: string;

  balance: number;
  availableBalance?: number;
}

export interface BankTransactionData {
  id: string;

  reference: string;

  date: string;

  description: string;

  amount: number;

  type:
    | "CREDIT"
    | "DEBIT";

  currency: string;

  status: string;

  runningBalance?: number;
}

export interface BankPaymentRequest {
  recipientName: string;

  accountNumber: string;

  bankCode?: string;

  amount: number;

  currency: string;

  reference: string;

  description?: string;

  /*
   * Every payment request must have
   * a unique idempotency key.
   *
   * This prevents accidental duplicate
   * payments when a bank request times out
   * and Ziya FOS retries the operation.
   */
  idempotencyKey: string;
}

export interface BankPaymentResponse {
  success: boolean;

  providerReference?: string;

  status: BankPaymentState;

  message: string;
}

export interface BankPaymentStatus {
  providerReference: string;

  status: BankPaymentState;

  message?: string;
}

export interface BankConnectionTestResult {
  success: boolean;

  status: BankConnectionStatus;

  message: string;

  provider: string;

  httpStatus?: number;
}

/**
 * Standard interface that every supported
 * bank provider must implement.
 *
 * Provider-specific implementations must
 * follow this contract.
 */
export interface BankAdapter {
  readonly provider: string;

  /**
   * Verify that the configured bank API
   * can be reached and authenticated.
   */
  testConnection(): Promise<BankConnectionTestResult>;

  /**
   * Retrieve accounts available through
   * the customer's bank API.
   */
  getAccounts(): Promise<BankAccountData[]>;

  /**
   * Retrieve the current balance for
   * a specific bank account.
   */
  getBalance(
    accountNumber: string,
  ): Promise<number>;

  /**
   * Retrieve bank transactions.
   */
  getTransactions(
    accountNumber: string,
    from?: Date,
    to?: Date,
  ): Promise<BankTransactionData[]>;

  /**
   * Initiate a bank payment.
   */
  initiatePayment(
    payment: BankPaymentRequest,
  ): Promise<BankPaymentResponse>;

  /**
   * Check the status of a previously
   * initiated payment.
   */
  getPaymentStatus(
    providerReference: string,
  ): Promise<BankPaymentStatus>;
}