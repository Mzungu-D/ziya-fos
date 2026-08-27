// server/services/mpesa.service.ts

import axios, {
  AxiosError,
} from "axios";

import prisma from "../config/prisma";

import {
  decryptSecret,
} from "../utils/encryption";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export type MpesaEnvironment =
  | "sandbox"
  | "production";

export interface MpesaAccountCredentials {
  id: string;
  organizationId: string;

  name: string;
  accountType: string;
  shortcode: string;
  environment: string;

  consumerKeyEncrypted: string;
  consumerSecretEncrypted: string;

  initiatorName: string;
  securityCredentialEncrypted: string;
  stkPasskeyEncrypted: string | null;

  resultUrl: string;
  timeoutUrl: string;

  isActive: boolean;
  isDefault: boolean;
}

export interface B2CPaymentRequest {
  mpesaAccountId: string;

  phoneNumber: string;
  amount: number;

  reference?: string;
  description?: string;
}

export interface B2CPaymentResponse {
  ConversationID?: string;
  OriginatorConversationID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;

  [key: string]: unknown;
}


/*
|--------------------------------------------------------------------------
| Payment Hub
|--------------------------------------------------------------------------
|
| Unified outbound M-Pesa payment destinations.
|
| PHONE   -> B2C
| PAYBILL -> BusinessPayBill
| TILL    -> BusinessBuyGoods
| B2B     -> BusinessPayment
|
*/

export type PaymentHubDestinationType =
  | "PHONE"
  | "PAYBILL"
  | "TILL"
  | "B2B";

export interface PaymentHubPaymentRequest {
  mpesaAccountId: string;
  destinationType: PaymentHubDestinationType;
  destination: string;
  amount: number;
  destinationName?: string;
  accountReference?: string;
  remarks?: string;
  occasion?: string;
}

export interface PaymentHubPaymentResponse {
  success: boolean;
  status: "SUBMITTED" | "FAILED";
  transactionId?: string;
  destinationType: PaymentHubDestinationType;
  destination: string;
  amount: number;
  conversationId?: string | null;
  originatorConversationId?: string | null;
  responseCode?: string | null;
  resultDescription?: string | null;
}


export type STKTransactionType =
  | "CustomerPayBillOnline"
  | "CustomerBuyGoodsOnline";

export interface STKPushRequest {
  mpesaAccountId: string;
  phoneNumber: string;
  amount: number;
  transactionType?: STKTransactionType;
  accountReference?: string;
  transactionDesc?: string;
}

export interface STKPushResponse {
  success: boolean;
  status: "SUBMITTED" | "FAILED";
  merchantRequestId?: string | null;
  checkoutRequestId?: string | null;
  responseCode?: string | null;
  responseDescription?: string | null;
  customerMessage?: string | null;
}

export interface STKCallbackResult {
  merchantRequestId?: string | null;
  checkoutRequestId?: string | null;
  resultCode?: number | null;
  resultDescription?: string | null;
  amount?: number | null;
  mpesaReceiptNumber?: string | null;
  transactionDate?: string | null;
  phoneNumber?: string | null;
  accountReference?: string | null;
}

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const DARAJA_TIMEOUT_MS = 30_000;

/*
|--------------------------------------------------------------------------
| Environment
|--------------------------------------------------------------------------
*/

function getBaseUrl(
  environment: string,
): string {
  if (
    environment ===
    "production"
  ) {
    return "https://api.safaricom.co.ke";
  }

  if (
    environment ===
    "sandbox"
  ) {
    return "https://sandbox.safaricom.co.ke";
  }

  throw new Error(
    "Invalid M-Pesa environment. Expected sandbox or production.",
  );
}

function validateEnvironment(
  value: string,
): MpesaEnvironment {
  if (
    value !== "sandbox" &&
    value !== "production"
  ) {
    throw new Error(
      "Invalid M-Pesa environment. Expected sandbox or production.",
    );
  }

  return value;
}

/*
|--------------------------------------------------------------------------
| Account lookup
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Every lookup is scoped by organizationId.
|
| We never allow one tenant to access another tenant's
| M-Pesa credentials.
|
|--------------------------------------------------------------------------
*/

export async function getMpesaAccountForOrganization(
  organizationId: string,
  mpesaAccountId: string,
): Promise<MpesaAccountCredentials> {
  if (!organizationId?.trim()) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  if (!mpesaAccountId?.trim()) {
    throw new Error(
      "M-Pesa account ID is required.",
    );
  }

  const account =
    await prisma.mpesaAccount.findFirst(
      {
        where: {
          id: mpesaAccountId,
          organizationId,
        },
      },
    );

  if (!account) {
    throw new Error(
      "M-Pesa account not found.",
    );
  }

  return account;
}

/*
|--------------------------------------------------------------------------
| Default active B2C account
|--------------------------------------------------------------------------
|
| Used only when an operation explicitly chooses to use the
| organization's default account.
|
|--------------------------------------------------------------------------
*/

export async function getDefaultMpesaAccount(
  organizationId: string,
): Promise<MpesaAccountCredentials> {
  if (!organizationId?.trim()) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  const account =
    await prisma.mpesaAccount.findFirst(
      {
        where: {
          organizationId,
          accountType: "B2C",
          isActive: true,
        },

        orderBy: [
          {
            isDefault:
              "desc",
          },
          {
            createdAt:
              "asc",
          },
        ],
      },
    );

  if (!account) {
    throw new Error(
      "No active B2C M-Pesa account is configured for this organization.",
    );
  }

  return account;
}

/*
|--------------------------------------------------------------------------
| Access token
|--------------------------------------------------------------------------
*/

async function getAccessToken(
  account: MpesaAccountCredentials,
): Promise<string> {
  const consumerKey =
    decryptSecret(
      account.consumerKeyEncrypted,
    );

  const consumerSecret =
    decryptSecret(
      account.consumerSecretEncrypted,
    );

  if (
    !consumerKey ||
    !consumerSecret
  ) {
    throw new Error(
      "M-Pesa Consumer Key or Consumer Secret is invalid.",
    );
  }

  const environment =
    validateEnvironment(
      account.environment,
    );

  const baseUrl =
    getBaseUrl(
      environment,
    );

  const credentials =
    Buffer.from(
      `${consumerKey}:${consumerSecret}`,
      "utf8",
    ).toString(
      "base64",
    );

  try {
    const response =
      await axios.get(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization:
              `Basic ${credentials}`,

            Accept:
              "application/json",
          },

          timeout:
            15_000,

          validateStatus:
            () => true,
        },
      );

    if (
      response.status <
        200 ||
      response.status >=
        300
    ) {
      throw new Error(
        "Safaricom authentication failed. Check the tenant's Consumer Key and Consumer Secret.",
      );
    }

    const accessToken =
      response.data
        ?.access_token;

    if (
      typeof accessToken !==
        "string" ||
      !accessToken.trim()
    ) {
      throw new Error(
        "Safaricom did not return an access token.",
      );
    }

    return accessToken;
  } catch (error) {
    if (
      error instanceof Error &&
      !(
        error instanceof
        AxiosError
      )
    ) {
      throw error;
    }

    throw new Error(
      "Unable to connect to Safaricom M-Pesa services.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Test tenant M-Pesa connection
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This tests the specific account selected by the tenant.
|
|--------------------------------------------------------------------------
*/

export async function testMpesaAccountConnection(
  organizationId: string,
  mpesaAccountId: string,
) {
  const account =
    await getMpesaAccountForOrganization(
      organizationId,
      mpesaAccountId,
    );

  const accessToken =
    await getAccessToken(
      account,
    );

  return {
    success: true,
    accountId:
      account.id,
    environment:
      account.environment,
    shortcode:
      account.shortcode,
    tokenVerified:
      Boolean(accessToken),
  };
}

/*
|--------------------------------------------------------------------------
| Backwards-compatible tenant connection test
|--------------------------------------------------------------------------
|
| Uses the organization's active default B2C account.
|
|--------------------------------------------------------------------------
*/

export async function testTenantMpesaConnection(
  organizationId: string,
) {
  const account =
    await getDefaultMpesaAccount(
      organizationId,
    );

  const accessToken =
    await getAccessToken(
      account,
    );

  return {
    success: true,
    accountId:
      account.id,
    environment:
      account.environment,
    shortcode:
      account.shortcode,
    tokenVerified:
      Boolean(accessToken),
  };
}

/*
|--------------------------------------------------------------------------
| B2C payment
|--------------------------------------------------------------------------
*/

export async function initiateB2CPayment(
  organizationId: string,
  params: B2CPaymentRequest,
): Promise<B2CPaymentResponse> {
  if (
    !organizationId?.trim()
  ) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  if (
    !params.mpesaAccountId?.trim()
  ) {
    throw new Error(
      "M-Pesa account ID is required.",
    );
  }

  if (
    !params.phoneNumber?.trim()
  ) {
    throw new Error(
      "Recipient phone number is required.",
    );
  }

  const amount =
    Number(
      params.amount,
    );

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount <= 0
  ) {
    throw new Error(
      "Payment amount must be greater than zero.",
    );
  }

  const account =
    await getMpesaAccountForOrganization(
      organizationId,
      params.mpesaAccountId,
    );

  if (
    !account.isActive
  ) {
    throw new Error(
      "The selected M-Pesa account is inactive.",
    );
  }

  if (
    account.accountType !==
    "B2C"
  ) {
    throw new Error(
      "The selected M-Pesa account is not configured for B2C payments.",
    );
  }

  const accessToken =
    await getAccessToken(
      account,
    );

  const securityCredential =
    decryptSecret(
      account.securityCredentialEncrypted,
    );

  if (
    !securityCredential
  ) {
    throw new Error(
      "M-Pesa security credential is invalid.",
    );
  }

  const environment =
    validateEnvironment(
      account.environment,
    );

  const baseUrl =
    getBaseUrl(
      environment,
    );

  const payload = {
    InitiatorName:
      account.initiatorName,

    SecurityCredential:
      securityCredential,

    CommandID:
      "BusinessPayment",

    Amount:
      Math.round(
        amount,
      ),

    PartyA:
      account.shortcode,

    PartyB:
      params.phoneNumber.trim(),

    Remarks:
      (
        params.description ||
        "Ziya FOS payment"
      ).trim(),

    QueueTimeOutURL:
      account.timeoutUrl,

    ResultURL:
      account.resultUrl,

    Occasion:
      (
        params.reference ||
        "ZIYA-FOS"
      ).trim(),
  };

  try {
    const response =
      await axios.post(
        `${baseUrl}/mpesa/b2c/v3/paymentrequest`,
        payload,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          timeout:
            DARAJA_TIMEOUT_MS,

          validateStatus:
            () => true,
        },
      );

    const data =
      response.data as
        B2CPaymentResponse;

    if (
      response.status <
        200 ||
      response.status >=
        300
    ) {
      throw new Error(
        data?.ResponseDescription ||
          "M-Pesa B2C payment request failed.",
      );
    }

    if (
      data?.ResponseCode &&
      data.ResponseCode !==
        "0"
    ) {
      throw new Error(
        data.ResponseDescription ||
          "M-Pesa rejected the payment request.",
      );
    }

    return data;
  } catch (error) {
    if (
      error instanceof
      AxiosError
    ) {
      const responseData =
        error.response
          ?.data as
          | B2CPaymentResponse
          | undefined;

      throw new Error(
        responseData
          ?.ResponseDescription ||
          error.message ||
          "M-Pesa B2C payment request failed.",
      );
    }

    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      "M-Pesa B2C payment request failed.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Alias used by existing code
|--------------------------------------------------------------------------
*/

export async function initiateTenantB2CPayment(
  organizationId: string,
  params: {
    mpesaAccountId?: string;
    amount: number;
    phoneNumber: string;
    remarks?: string;
    occasion?: string;
  },
) {
  let mpesaAccountId =
    params.mpesaAccountId;

  /*
   * If the caller does not explicitly provide an account,
   * use the organization's default active B2C account.
   */
  if (
    !mpesaAccountId
  ) {
    const account =
      await getDefaultMpesaAccount(
        organizationId,
      );

    mpesaAccountId =
      account.id;
  }

  return initiateB2CPayment(
    organizationId,
    {
      mpesaAccountId,
      amount:
        params.amount,
      phoneNumber:
        params.phoneNumber,
      reference:
        params.occasion,
      description:
        params.remarks,
    },
  );
}


/*
|--------------------------------------------------------------------------
| STK Push
|--------------------------------------------------------------------------
|
| Customer-initiated M-Pesa collection.
|
| CustomerPayBillOnline -> PayBill
| CustomerBuyGoodsOnline -> Till
|
| This is deliberately separate from B2C/B2B disbursement.
|--------------------------------------------------------------------------
*/

function normalizeStkPhoneNumber(
  phoneNumber: string,
): string {
  const value =
    phoneNumber
      .trim()
      .replace(/[\s-]/g, "");

  if (!/^(?:254|0)?7\d{8}$/.test(value)) {
    throw new Error(
      "Invalid Kenyan phone number. Use 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX.",
    );
  }

  if (value.startsWith("0")) {
    return `254${value.slice(1)}`;
  }

  if (value.startsWith("7")) {
    return `254${value}`;
  }

  return value;
}

function createStkTimestamp(): string {
  /*
   * Daraja STK Push expects the timestamp in
   * yyyyMMddHHmmss using Kenya local time (EAT / UTC+03:00).
   *
   * Do not use UTC getters here: doing so produces a timestamp
   * three hours behind the Kenyan time used by the STK password.
   */
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function createStkPassword(
  shortcode: string,
  passkey: string,
  timestamp: string,
): string {
  return Buffer.from(
    `${shortcode}${passkey}${timestamp}`,
    "utf8",
  ).toString("base64");
}

export async function initiateSTKPush(
  organizationId: string,
  params: STKPushRequest,
): Promise<STKPushResponse> {
  if (!organizationId?.trim()) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  if (!params.mpesaAccountId?.trim()) {
    throw new Error(
      "M-Pesa account ID is required.",
    );
  }

  const phoneNumber =
    normalizeStkPhoneNumber(
      params.phoneNumber,
    );

  const amount =
    validatePaymentHubAmount(
      params.amount,
    );

  const account =
    await getMpesaAccountForOrganization(
      organizationId,
      params.mpesaAccountId,
    );

  if (!account.isActive) {
    throw new Error(
      "The selected M-Pesa account is inactive.",
    );
  }

  /*
   * STK Push uses the tenant's dedicated encrypted
   * Daraja STK Passkey. The B2C/B2B security
   * credential remains separate.
   */
  const passkey =
    account.stkPasskeyEncrypted
      ? decryptSecret(
          account.stkPasskeyEncrypted,
        )
      : null;

  if (!passkey) {
    throw new Error(
      "M-Pesa STK Passkey is not configured for this account.",
    );
  }

  const environment =
    validateEnvironment(
      account.environment,
    );

  const baseUrl =
    getBaseUrl(
      environment,
    );

  const accessToken =
    await getAccessToken(
      account,
    );

  const timestamp =
    createStkTimestamp();

  const password =
    createStkPassword(
      account.shortcode,
      passkey,
      timestamp,
    );

  const transactionType =
    params.transactionType ||
    "CustomerPayBillOnline";

  const payload = {
    BusinessShortCode:
      account.shortcode,

    Password:
      password,

    Timestamp:
      timestamp,

    TransactionType:
      transactionType,

    Amount:
      amount,

    PartyA:
      phoneNumber,

    PartyB:
      account.shortcode,

    PhoneNumber:
      phoneNumber,

    CallBackURL:
      account.resultUrl,

    AccountReference:
      (
        params.accountReference ||
        "ZIYA-FOS"
      ).trim(),

    TransactionDesc:
      (
        params.transactionDesc ||
        "Ziya FOS payment"
      ).trim(),
  };

  try {
    const response =
      await axios.post(
        `${baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          timeout:
            DARAJA_TIMEOUT_MS,

          validateStatus:
            () => true,
        },
      );

    const data =
      response.data as {
        MerchantRequestID?: string;
        CheckoutRequestID?: string;
        ResponseCode?: string;
        ResponseDescription?: string;
        CustomerMessage?: string;
      };

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw new Error(
        data?.ResponseDescription ||
          "M-Pesa STK Push request failed.",
      );
    }

    const accepted =
      data?.ResponseCode === "0";

    return {
      success:
        accepted,

      status:
        accepted
          ? "SUBMITTED"
          : "FAILED",

      merchantRequestId:
        data?.MerchantRequestID ??
        null,

      checkoutRequestId:
        data?.CheckoutRequestID ??
        null,

      responseCode:
        data?.ResponseCode ??
        null,

      responseDescription:
        data?.ResponseDescription ??
        null,

      customerMessage:
        data?.CustomerMessage ??
        null,
    };
  } catch (error) {
    if (
      error instanceof AxiosError
    ) {
      const data =
        error.response
          ?.data as
          | {
              ResponseDescription?: string;
            }
          | undefined;

      throw new Error(
        data?.ResponseDescription ||
          error.message ||
          "M-Pesa STK Push request failed.",
      );
    }

    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      "M-Pesa STK Push request failed.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Persist STK Push transaction
|--------------------------------------------------------------------------
*/

export async function createSTKPushTransaction(
  organizationId: string,
  params: STKPushRequest,
): Promise<STKPushResponse & {
  transactionId?: string;
}> {
  const phoneNumber =
    normalizeStkPhoneNumber(
      params.phoneNumber,
    );

  const amount =
    validatePaymentHubAmount(
      params.amount,
    );

  const transaction =
    await prisma.mpesaTransaction.create({
      data: {
        organizationId,

        mpesaAccountId:
          params.mpesaAccountId,

        transactionType:
          "STK_PUSH",

        phoneNumber,

        amount,

        destination:
          phoneNumber,

        destinationName:
          null,

        destinationType:
          "PHONE",

        paymentMethod:
          "MPESA_STK_PUSH",

        accountReference:
          params.accountReference ??
          null,

        transactionDesc:
          params.transactionDesc ??
          null,

        counterparty:
          phoneNumber,

        status:
          "PENDING",
      },
    });

  try {
    const result =
      await initiateSTKPush(
        organizationId,
        params,
      );

    const updated =
      await prisma.mpesaTransaction.update({
        where: {
          id: transaction.id,
        },

        data: {
          merchantRequestId:
            result.merchantRequestId ??
            null,

          checkoutRequestId:
            result.checkoutRequestId ??
            null,

          resultCode:
            result.responseCode
              ? Number(
                  result.responseCode,
                )
              : null,

          resultDescription:
            result.responseDescription ??
            null,

          status:
            result.status,
        },
      });

    return {
      ...result,
      transactionId:
        updated.id,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "M-Pesa STK Push failed.";

    await prisma.mpesaTransaction.update({
      where: {
        id: transaction.id,
      },

      data: {
        status: "FAILED",
        resultDescription: message,
      },
    });

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| STK callback normalization
|--------------------------------------------------------------------------
*/

export function parseSTKCallback(
  body: unknown,
): STKCallbackResult {
  const callback =
    body as {
      Body?: {
        stkCallback?: {
          MerchantRequestID?: string;
          CheckoutRequestID?: string;
          ResultCode?: number;
          ResultDesc?: string;
          CallbackMetadata?: {
            Item?: Array<{
              Name?: string;
              Value?: string | number;
            }>;
          };
        };
      };
    };

  const stk =
    callback?.Body?.stkCallback;

  if (!stk) {
    throw new Error(
      "Invalid M-Pesa STK callback payload.",
    );
  }

  const items =
    stk.CallbackMetadata?.Item ||
    [];

  const getValue = (
    name: string,
  ): string | number | null => {
    const item =
      items.find(
        (entry) =>
          entry.Name === name,
      );

    return item?.Value ??
      null;
  };

  const amount =
    getValue("Amount");

  const transactionDate =
    getValue("TransactionDate");

  const phoneNumber =
    getValue("PhoneNumber");

  return {
    merchantRequestId:
      stk.MerchantRequestID ??
      null,

    checkoutRequestId:
      stk.CheckoutRequestID ??
      null,

    resultCode:
      typeof stk.ResultCode ===
      "number"
        ? stk.ResultCode
        : null,

    resultDescription:
      stk.ResultDesc ??
      null,

    amount:
      typeof amount ===
      "number"
        ? amount
        : amount !== null
          ? Number(amount)
          : null,

    mpesaReceiptNumber:
      getValue(
        "MpesaReceiptNumber",
      )?.toString() ??
      null,

    transactionDate:
      transactionDate !== null
        ? transactionDate.toString()
        : null,

    phoneNumber:
      phoneNumber !== null
        ? phoneNumber.toString()
        : null,

    accountReference:
      getValue(
        "AccountReference",
      )?.toString() ??
      null,
  };
}

/*
|--------------------------------------------------------------------------
| Apply STK callback to transaction
|--------------------------------------------------------------------------
*/

export async function handleSTKCallback(
  body: unknown,
): Promise<STKCallbackResult> {
  const callback =
    parseSTKCallback(
      body,
    );

  if (
    !callback.checkoutRequestId &&
    !callback.merchantRequestId
  ) {
    throw new Error(
      "STK callback does not contain a transaction identifier.",
    );
  }

  const transaction =
    await prisma.mpesaTransaction.findFirst({
      where: {
        transactionType: "STK_PUSH",
        OR: [
          callback.checkoutRequestId
            ? {
                checkoutRequestId:
                  callback.checkoutRequestId,
              }
            : undefined,

          callback.merchantRequestId
            ? {
                merchantRequestId:
                  callback.merchantRequestId,
              }
            : undefined,
        ].filter(
          Boolean,
        ) as Array<{
          checkoutRequestId?: string;
          merchantRequestId?: string;
        }>,
      },
    });

  if (!transaction) {
    /*
     * Do not manufacture a tenant relationship from
     * an unrecognized Safaricom callback.
     */
    throw new Error(
      "STK transaction not found.",
    );
  }

  const successful =
    callback.resultCode === 0;

  /*
   * Build the update selectively. Safaricom's failed STK callback
   * normally has no CallbackMetadata, so we must not erase the
   * original phone number or amount with null values.
   */
  const updateData: Record<string, unknown> = {
    resultCode:
      callback.resultCode ??
      null,

    resultDescription:
      callback.resultDescription ??
      null,

    status:
      successful
        ? "COMPLETED"
        : "FAILED",
  };

  if (callback.mpesaReceiptNumber) {
    updateData.mpesaReceiptNumber =
      callback.mpesaReceiptNumber;
  }

  if (callback.transactionDate) {
    const parsedTransactionDate =
      parseDarajaTransactionDate(
        callback.transactionDate,
      );

    if (parsedTransactionDate) {
      updateData.transactionDate =
        parsedTransactionDate;
    }
  }

  if (callback.phoneNumber) {
    updateData.phoneNumber =
      normalizeStkPhoneNumber(
        callback.phoneNumber,
      );
  }

  if (
    typeof callback.amount ===
      "number" &&
    Number.isFinite(callback.amount) &&
    callback.amount > 0
  ) {
    updateData.amount =
      Math.round(callback.amount);
  }

  if (callback.accountReference) {
    updateData.accountReference =
      callback.accountReference;
  }

  await prisma.mpesaTransaction.update({
    where: {
      id: transaction.id,
    },
    data: updateData,
  });

  return callback;
}

function parseDarajaTransactionDate(
  value: string,
): Date | null {
  if (!/^\d{14}$/.test(value)) {
    return null;
  }

  const year =
    Number(value.slice(0, 4));

  const month =
    Number(value.slice(4, 6)) - 1;

  const day =
    Number(value.slice(6, 8));

  const hour =
    Number(value.slice(8, 10));

  const minute =
    Number(value.slice(10, 12));

  const second =
    Number(value.slice(12, 14));

  /*
   * Daraja transaction dates are represented in Kenya local time
   * (EAT / UTC+03:00). Store them as an absolute UTC DateTime.
   */
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      hour - 3,
      minute,
      second,
    ),
  );
}

/*
|--------------------------------------------------------------------------
| Payment Hub helpers
|--------------------------------------------------------------------------
*/

function validatePaymentHubDestinationType(
  value: string,
): PaymentHubDestinationType {
  const normalized = value.trim().toUpperCase();

  if (
    normalized !== "PHONE" &&
    normalized !== "PAYBILL" &&
    normalized !== "TILL" &&
    normalized !== "B2B"
  ) {
    throw new Error(
      "Unsupported payment destination. Expected PHONE, PAYBILL, TILL, or B2B.",
    );
  }

  return normalized as PaymentHubDestinationType;
}

function validatePaymentHubDestination(
  destinationType: PaymentHubDestinationType,
  destination: string,
): string {
  const value = destination.trim();

  if (!value) {
    throw new Error("Payment destination is required.");
  }

  if (destinationType === "PHONE") {
    const normalized = value.replace(/[\s-]/g, "");

    if (!/^(?:254|0)?7\d{8}$/.test(normalized)) {
      throw new Error(
        "Invalid Kenyan phone number. Use 07XXXXXXXX, 7XXXXXXXX, or 2547XXXXXXXX.",
      );
    }

    if (normalized.startsWith("0")) {
      return `254${normalized.slice(1)}`;
    }

    if (normalized.startsWith("7")) {
      return `254${normalized}`;
    }

    return normalized;
  }

  if (destinationType === "PAYBILL") {
    if (!/^\d{5,7}$/.test(value)) {
      throw new Error(
        "Invalid PayBill number. PayBill must contain 5 to 7 digits.",
      );
    }

    return value;
  }

  if (destinationType === "TILL") {
    if (!/^\d{5,7}$/.test(value)) {
      throw new Error(
        "Invalid Till number. Till number must contain 5 to 7 digits.",
      );
    }

    return value;
  }

  if (!/^\d{5,15}$/.test(value)) {
    throw new Error(
      "Invalid B2B destination shortcode. Use 5 to 15 digits.",
    );
  }

  return value;
}

function validatePaymentHubAmount(
  amountValue: number,
): number {
  const amount = Number(amountValue);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Payment amount must be greater than zero.",
    );
  }

  return Math.round(amount);
}

async function submitPaymentHubRequest(
  account: MpesaAccountCredentials,
  params: PaymentHubPaymentRequest,
): Promise<PaymentHubPaymentResponse> {
  const destinationType =
    validatePaymentHubDestinationType(
      params.destinationType,
    );

  const destination =
    validatePaymentHubDestination(
      destinationType,
      params.destination,
    );

  const amount =
    validatePaymentHubAmount(
      params.amount,
    );

  const accessToken =
    await getAccessToken(
      account,
    );

  const securityCredential =
    decryptSecret(
      account.securityCredentialEncrypted,
    );

  if (!securityCredential) {
    throw new Error(
      "M-Pesa security credential is invalid.",
    );
  }

  const environment =
    validateEnvironment(
      account.environment,
    );

  const baseUrl =
    getBaseUrl(
      environment,
    );

  let commandId: string;

  if (destinationType === "PAYBILL") {
    commandId = "BusinessPayBill";
  } else if (destinationType === "TILL") {
    commandId = "BusinessBuyGoods";
  } else {
    commandId = "BusinessPayment";
  }

  /*
   * The Business-to-Business family of Daraja requests
   * requires the sender and receiver identifier types.
   * A shortcode is identifier type 4.
   *
   * Safaricom's B2B contract spells the receiver field
   * "RecieverIdentifierType" (with the historical spelling).
   */
  if (
    destinationType === "PAYBILL" &&
    !params.accountReference?.trim()
  ) {
    throw new Error(
      "Account reference is required for PayBill payments.",
    );
  }

  const payload: Record<string, unknown> = {
    InitiatorName:
      account.initiatorName,

    SecurityCredential:
      securityCredential,

    CommandID:
      commandId,

    SenderIdentifierType:
      "4",

    RecieverIdentifierType:
      "4",

    Amount:
      amount,

    PartyA:
      account.shortcode,

    PartyB:
      destination,

    AccountReference:
      (
        params.accountReference ||
        "ZIYA-FOS"
      ).trim(),

    Remarks:
      (
        params.remarks ||
        "Ziya FOS payment"
      ).trim(),

    QueueTimeOutURL:
      account.timeoutUrl,

    ResultURL:
      account.resultUrl,

    Occasion:
      (
        params.occasion ||
        "ZIYA-FOS"
      ).trim(),
  };

  try {
    const response =
      await axios.post(
        `${baseUrl}/mpesa/b2b/v1/paymentrequest`,
        payload,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          timeout:
            DARAJA_TIMEOUT_MS,

          validateStatus:
            () => true,
        },
      );

    const data =
      response.data as B2CPaymentResponse;

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw new Error(
        data?.ResponseDescription ||
          "M-Pesa Payment Hub request failed.",
      );
    }

    const responseCode =
      data?.ResponseCode ?? null;

    const accepted =
      responseCode === null ||
      responseCode === "0";

    if (!accepted) {
      return {
        success: false,
        status: "FAILED",
        destinationType,
        destination,
        amount,
        conversationId:
          data?.ConversationID ?? null,
        originatorConversationId:
          data?.OriginatorConversationID ?? null,
        responseCode,
        resultDescription:
          data?.ResponseDescription ||
          "M-Pesa rejected the payment request.",
      };
    }

    return {
      success: true,
      status: "SUBMITTED",
      destinationType,
      destination,
      amount,
      conversationId:
        data?.ConversationID ?? null,
      originatorConversationId:
        data?.OriginatorConversationID ?? null,
      responseCode,
      resultDescription:
        data?.ResponseDescription ?? null,
    };
  } catch (error) {
    if (
      error instanceof AxiosError
    ) {
      const responseData =
        error.response
          ?.data as
          | B2CPaymentResponse
          | undefined;

      throw new Error(
        responseData
          ?.ResponseDescription ||
          error.message ||
          "M-Pesa Payment Hub request failed.",
      );
    }

    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      "M-Pesa Payment Hub request failed.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Unified Payment Hub payment
|--------------------------------------------------------------------------
*/

export async function initiatePaymentHubPayment(
  organizationId: string,
  params: PaymentHubPaymentRequest,
): Promise<PaymentHubPaymentResponse> {
  if (!organizationId?.trim()) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  if (!params.mpesaAccountId?.trim()) {
    throw new Error(
      "M-Pesa account ID is required.",
    );
  }

  const destinationType =
    validatePaymentHubDestinationType(
      params.destinationType,
    );

  const destination =
    validatePaymentHubDestination(
      destinationType,
      params.destination,
    );

  const amount =
    validatePaymentHubAmount(
      params.amount,
    );

  const account =
    await getMpesaAccountForOrganization(
      organizationId,
      params.mpesaAccountId,
    );

  if (!account.isActive) {
    throw new Error(
      "The selected M-Pesa account is inactive.",
    );
  }

  /*
   * PHONE payments deliberately continue through
   * the existing B2C implementation so the established
   * B2C callback flow remains unchanged.
   */
  if (destinationType === "PHONE") {
    const response =
      await initiateB2CPayment(
        organizationId,
        {
          mpesaAccountId:
            account.id,

          phoneNumber:
            destination,

          amount,

          reference:
            params.occasion ||
            params.accountReference ||
            "ZIYA-FOS",

          description:
            params.remarks ||
            "Ziya FOS payment",
        },
      );

    return {
      success:
        response?.ResponseCode ===
        undefined ||
        response?.ResponseCode ===
        "0",

      status:
        response?.ResponseCode ===
          undefined ||
        response?.ResponseCode === "0"
          ? "SUBMITTED"
          : "FAILED",

      destinationType,
      destination,

      amount,

      conversationId:
        response?.ConversationID ??
        null,

      originatorConversationId:
        response?.OriginatorConversationID ??
        null,

      responseCode:
        response?.ResponseCode ??
        null,

      resultDescription:
        response?.ResponseDescription ??
        null,
    };
  }

  return submitPaymentHubRequest(
    account,
    {
      ...params,
      destinationType,
      destination,
      amount,
    },
  );
}

/*
|--------------------------------------------------------------------------
| Payment Hub transaction persistence
|--------------------------------------------------------------------------
|
| The schema already contains:
|   destination
|   destinationName
|   destinationType
|   paybillNumber
|   paymentMethod
|   tillNumber
|
| We persist the Payment Hub transaction under the
| tenant organization and selected M-Pesa account.
|--------------------------------------------------------------------------
*/

export async function createPaymentHubTransaction(
  organizationId: string,
  params: PaymentHubPaymentRequest,
): Promise<PaymentHubPaymentResponse> {
  if (!organizationId?.trim()) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  const destinationType =
    validatePaymentHubDestinationType(
      params.destinationType,
    );

  const destination =
    validatePaymentHubDestination(
      destinationType,
      params.destination,
    );

  const amount =
    validatePaymentHubAmount(
      params.amount,
    );

  const transaction =
    await prisma.mpesaTransaction.create({
      data: {
        organizationId,

        mpesaAccountId:
          params.mpesaAccountId,

        transactionType:
          destinationType === "PHONE"
            ? "B2C"
            : "B2B",

        phoneNumber:
          destinationType === "PHONE"
            ? destination
            : null,

        amount,

        destination,

        destinationName:
          params.destinationName ??
          null,

        destinationType,

        paybillNumber:
          destinationType === "PAYBILL"
            ? destination
            : null,

        tillNumber:
          destinationType === "TILL"
            ? destination
            : null,

        paymentMethod:
          "MPESA",

        accountReference:
          params.accountReference ??
          null,

        transactionDesc:
          params.remarks ??
          null,

        counterparty:
          params.destinationName ??
          null,

        status:
          "PENDING",
      },
    });

  try {
    const result =
      await initiatePaymentHubPayment(
        organizationId,
        params,
      );

    const updated =
      await prisma.mpesaTransaction.update({
        where: {
          id: transaction.id,
        },

        data: {
          conversationId:
            result.conversationId ??
            null,

          originatorConversationId:
            result.originatorConversationId ??
            null,

          resultDescription:
            result.resultDescription ??
            null,

          status:
            result.status,
        },
      });

    return {
      ...result,
      transactionId:
        updated.id,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Payment Hub payment failed.";

    await prisma.mpesaTransaction.update({
      where: {
        id: transaction.id,
      },

      data: {
        status: "FAILED",
        resultDescription: message,
      },
    });

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Payment Hub bulk payment
|--------------------------------------------------------------------------
*/

export interface PaymentHubBulkPaymentItem
  extends PaymentHubPaymentRequest {}

export async function processPaymentHubBatch(
  organizationId: string,
  payments: PaymentHubBulkPaymentItem[],
): Promise<
  PaymentHubPaymentResponse[]
> {
  if (!organizationId?.trim()) {
    throw new Error(
      "Organization ID is required.",
    );
  }

  if (!Array.isArray(payments)) {
    throw new Error(
      "Payments must be an array.",
    );
  }

  if (payments.length === 0) {
    return [];
  }

  const results: PaymentHubPaymentResponse[] =
    [];

  for (const payment of payments) {
    try {
      const result =
        await createPaymentHubTransaction(
          organizationId,
          payment,
        );

      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        status: "FAILED",
        destinationType:
          validatePaymentHubDestinationType(
            payment.destinationType,
          ),
        destination:
          payment.destination,
        amount:
          Number(payment.amount),
        resultDescription:
          error instanceof Error
            ? error.message
            : "Payment Hub payment failed.",
      });
    }
  }

  return results;
}