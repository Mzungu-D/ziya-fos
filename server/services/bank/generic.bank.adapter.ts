/* =========================================================
   BANK ADAPTER CONTRACT

   This file defines the common contract between Ziya FOS
   and external banking/payment providers.

   Supported payment destinations:

   1. BANK_TRANSFER
   2. PAYBILL
   3. TILL

   IMPORTANT:
   - This contract does not assume that every provider
     supports every payment destination.
   - Provider-specific adapters are responsible for
     implementing the actual provider capabilities.
   - M-Pesa remains a separate module.
========================================================= */

/* =========================================================
   PAYMENT STATES
========================================================= */

export type BankPaymentState =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN";

/* =========================================================
   CONNECTION STATES
========================================================= */

export type BankConnectionStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR";

/* =========================================================
   PAYMENT DESTINATION TYPES
========================================================= */

export type BankPaymentType =
  | "BANK_TRANSFER"
  | "PAYBILL"
  | "TILL";

/* =========================================================
   ADAPTER CONFIGURATION
========================================================= */

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

/* =========================================================
   BANK ACCOUNT
========================================================= */

export interface BankAccountData {
  id?: string;

  accountName: string;

  accountNumber: string;

  currency: string;

  balance: number;

  availableBalance?: number;
}

/* =========================================================
   BANK TRANSACTION
========================================================= */

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

/* =========================================================
   BANK PAYMENT DESTINATION
========================================================= */

/**
 * Common payment destination information.
 *
 * Only the fields applicable to the selected
 * paymentType should be populated.
 *
 * BANK_TRANSFER:
 *   accountNumber
 *   bankCode
 *   branchCode
 *
 * PAYBILL:
 *   paybillNumber
 *   accountReference
 *
 * TILL:
 *   tillNumber
 */
export interface BankPaymentDestination {
  paymentType: BankPaymentType;

  accountNumber?: string | null;

  bankCode?: string | null;

  branchCode?: string | null;

  paybillNumber?: string | null;

  accountReference?: string | null;

  tillNumber?: string | null;
}

/* =========================================================
   BANK PAYMENT REQUEST
========================================================= */

export interface BankPaymentRequest {
  /**
   * Name of the person, company or merchant
   * receiving the payment.
   */
  recipientName: string;

  /**
   * Destination type.
   */
  paymentType: BankPaymentType;

  /**
   * Bank transfer destination.
   *
   * Required when paymentType is BANK_TRANSFER.
   */
  accountNumber?: string | null;

  /**
   * Bank identifier.
   *
   * Required by providers that use bank codes
   * for bank transfers.
   */
  bankCode?: string | null;

  /**
   * Optional branch identifier for bank transfers.
   */
  branchCode?: string | null;

  /**
   * PayBill number.
   *
   * Required when paymentType is PAYBILL.
   */
  paybillNumber?: string | null;

  /**
   * Customer/account reference used with a PayBill.
   *
   * Required when paymentType is PAYBILL.
   */
  accountReference?: string | null;

  /**
   * Till number.
   *
   * Required when paymentType is TILL.
   */
  tillNumber?: string | null;

  /**
   * Payment amount.
   */
  amount: number;

  /**
   * ISO currency code.
   *
   * Ziya FOS currently defaults to KES at the
   * database level, but adapters should not assume
   * that every future payment is KES.
   */
  currency: string;

  /**
   * Internal FOS payment reference.
   */
  reference: string;

  /**
   * Optional payment description.
   */
  description?: string | null;

  /**
   * Unique idempotency key.
   *
   * This is mandatory and prevents accidental
   * duplicate payments when requests time out
   * and are retried.
   */
  idempotencyKey: string;
}

/* =========================================================
   BANK PAYMENT RESPONSE
========================================================= */

export interface BankPaymentResponse {
  success: boolean;

  providerReference?: string;

  status: BankPaymentState;

  message: string;
}

/* =========================================================
   BANK PAYMENT STATUS
========================================================= */

export interface BankPaymentStatus {
  providerReference: string;

  status: BankPaymentState;

  message?: string;
}

/* =========================================================
   CONNECTION TEST RESULT
========================================================= */

export interface BankConnectionTestResult {
  success: boolean;

  status: BankConnectionStatus;

  message: string;

  provider: string;

  httpStatus?: number;
}

/* =========================================================
   BANK ADAPTER
========================================================= */

/**
 * Standard interface that every supported bank
 * provider must implement.
 *
 * Provider-specific implementations must follow
 * this contract.
 *
 * IMPORTANT:
 *
 * The adapter must not assume that every provider
 * supports:
 *
 *   BANK_TRANSFER
 *   PAYBILL
 *   TILL
 *
 * Unsupported payment destinations must return
 * a controlled failure rather than pretending that
 * the payment was submitted.
 */
export interface BankAdapter {
  /**
   * Provider identifier.
   */
  readonly provider: string;

  /**
   * Verify that the configured bank API can be
   * reached and authenticated.
   */
  testConnection(): Promise<BankConnectionTestResult>;

  /**
   * Retrieve accounts available through the
   * customer's bank API.
   */
  getAccounts(): Promise<BankAccountData[]>;

  /**
   * Retrieve the current balance for a specific
   * bank account.
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
   * Initiate a payment.
   *
   * The payment destination is determined by
   * payment.paymentType.
   */
  initiatePayment(
    payment: BankPaymentRequest,
  ): Promise<BankPaymentResponse>;

  /**
   * Check the status of a previously initiated
   * payment.
   */
  getPaymentStatus(
    providerReference: string,
  ): Promise<BankPaymentStatus>;
}