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