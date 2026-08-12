import axios from "axios";

/* =========================================================
   M-PESA ENVIRONMENT
========================================================= */

const MPESA_ENVIRONMENT =
  process.env.MPESA_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";

const BASE_URL =
  MPESA_ENVIRONMENT === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

/* =========================================================
   TYPES
========================================================= */

export type MpesaB2BCommand =
  | "BusinessPayBill"
  | "BusinessBuyGoods";

/* =========================================================
   HELPERS
========================================================= */

function requiredEnv(
  name: string
): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(
      `Missing required M-Pesa environment variable: ${name}`
    );
  }

  return value.trim();
}

function normalizeShortcode(
  value: unknown
): string {
  const shortcode =
    typeof value === "string"
      ? value.trim()
      : String(value ?? "").trim();

  if (!/^\d{5,7}$/.test(shortcode)) {
    throw new Error(
      "M-Pesa shortcode must contain 5 to 7 digits."
    );
  }

  return shortcode;
}

function normalizeAmount(
  value: unknown
): number {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "M-Pesa amount must be greater than zero."
    );
  }

  return Math.round(amount);
}

/* =========================================================
   ACCESS TOKEN
========================================================= */

export async function getMpesaAccessToken(): Promise<string> {
  const consumerKey =
    requiredEnv(
      "MPESA_CONSUMER_KEY"
    );

  const consumerSecret =
    requiredEnv(
      "MPESA_CONSUMER_SECRET"
    );

  const credentials =
    Buffer.from(
      `${consumerKey}:${consumerSecret}`
    ).toString("base64");

  const response =
    await axios.get(
      `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization:
            `Basic ${credentials}`,

          Accept:
            "application/json",
        },

        timeout: 15000,
      }
    );

  const token =
    response.data?.access_token;

  if (!token) {
    throw new Error(
      "Safaricom did not return an access token."
    );
  }

  return token;
}

/* =========================================================
   B2C PAYMENT
========================================================= */

export async function initiateB2CPayment(
  params: {
    amount: number;

    phoneNumber: string;

    remarks: string;

    occasion?: string;
  }
) {
  const token =
    await getMpesaAccessToken();

  const shortcode =
    normalizeShortcode(
      requiredEnv(
        "MPESA_B2C_SHORTCODE"
      )
    );

  const initiatorName =
    requiredEnv(
      "MPESA_B2C_INITIATOR_NAME"
    );

  const securityCredential =
    requiredEnv(
      "MPESA_B2C_SECURITY_CREDENTIAL"
    );

  const resultUrl =
    requiredEnv(
      "MPESA_B2C_RESULT_URL"
    );

  const timeoutUrl =
    requiredEnv(
      "MPESA_B2C_TIMEOUT_URL"
    );

  const response =
    await axios.post(
      `${BASE_URL}/mpesa/b2c/v1/paymentrequest`,

      {
        InitiatorName:
          initiatorName,

        SecurityCredential:
          securityCredential,

        CommandID:
          "BusinessPayment",

        Amount:
          normalizeAmount(
            params.amount
          ),

        PartyA:
          shortcode,

        PartyB:
          params.phoneNumber,

        Remarks:
          params.remarks,

        QueueTimeOutURL:
          timeoutUrl,

        ResultURL:
          resultUrl,

        Occasion:
          params.occasion ??
          "ZIYA-FOS",
      },

      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        timeout: 20000,
      }
    );

  return response.data;
}

/* =========================================================
   B2B PAYMENT
========================================================= */

/**
 * Sends money from Ziya's M-Pesa business shortcode
 * to another business shortcode / PayBill / Till.
 *
 * Supported commands:
 *
 * BusinessPayBill
 * BusinessBuyGoods
 */
export async function initiateB2BPayment(
  params: {
    amount: number;

    partyB: string;

    accountReference?: string;

    remarks: string;

    commandId?: MpesaB2BCommand;

    occasion?: string;
  }
) {
  const token =
    await getMpesaAccessToken();

  /* -------------------------------------------------------
     ZIYA SENDING SHORTCODE
  ------------------------------------------------------- */

  const partyA =
    normalizeShortcode(
      requiredEnv(
        "MPESA_B2B_SHORTCODE"
      )
    );

  /* -------------------------------------------------------
     INITIATOR
  ------------------------------------------------------- */

  const initiatorName =
    requiredEnv(
      "MPESA_B2B_INITIATOR_NAME"
    );

  /* -------------------------------------------------------
     SECURITY CREDENTIAL
  ------------------------------------------------------- */

  const securityCredential =
    requiredEnv(
      "MPESA_B2B_SECURITY_CREDENTIAL"
    );

  /* -------------------------------------------------------
     CALLBACK URLS
  ------------------------------------------------------- */

  const resultUrl =
    requiredEnv(
      "MPESA_B2B_RESULT_URL"
    );

  const timeoutUrl =
    requiredEnv(
      "MPESA_B2B_TIMEOUT_URL"
    );

  /* -------------------------------------------------------
     RECIPIENT
  ------------------------------------------------------- */

  const partyB =
    normalizeShortcode(
      params.partyB
    );

  /* -------------------------------------------------------
     COMMAND
  ------------------------------------------------------- */

  const commandId =
    params.commandId ??
    "BusinessPayBill";

  if (
    commandId !==
      "BusinessPayBill" &&
    commandId !==
      "BusinessBuyGoods"
  ) {
    throw new Error(
      "Invalid M-Pesa B2B command."
    );
  }

  /* -------------------------------------------------------
     AMOUNT
  ------------------------------------------------------- */

  const amount =
    normalizeAmount(
      params.amount
    );

  /* -------------------------------------------------------
     ACCOUNT REFERENCE
  ------------------------------------------------------- */

  const accountReference =
    String(
      params.accountReference ??
        "ZIYA-FOS"
    )
      .trim()
      .slice(0, 20);

  /* -------------------------------------------------------
     REMARKS
  ------------------------------------------------------- */

  const remarks =
    String(
      params.remarks ??
        "ZIYA-FOS B2B PAYMENT"
    )
      .trim()
      .slice(0, 100);

  /* -------------------------------------------------------
     SAFARICOM B2B REQUEST
  ------------------------------------------------------- */

  const response =
    await axios.post(
      `${BASE_URL}/mpesa/b2b/v1/paymentrequest`,

      {
        Initiator:
          initiatorName,

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
          partyA,

        PartyB:
          partyB,

        AccountReference:
          accountReference,

        Remarks:
          remarks,

        QueueTimeOutURL:
          timeoutUrl,

        ResultURL:
          resultUrl,

        Occasion:
          params.occasion ??
          "ZIYA-FOS",
      },

      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        timeout: 20000,
      }
    );

  return response.data;
}