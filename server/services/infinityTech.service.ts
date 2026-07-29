import crypto from "crypto";

/* =========================================================
   TYPES
========================================================= */

interface InfinityTechSmsResponse {
  status?: string;
  statusCode?: string;
  desc?: string;
  to?: string;
  msgId?: string;
  cost?: string;
  balance?: string;
  mcc?: string;
  mnc?: string;

  [key: string]: unknown;
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  description?: string;
}

/* =========================================================
   CONFIGURATION
========================================================= */

function getRequiredEnv(
  name: string
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured.`
    );
  }

  return value.replace(
    /^["']|["']$/g,
    ""
  );
}

function getInfinityConfig() {
  const apiKey =
    getRequiredEnv(
      "INFINITY_TECH_API_KEY"
    );

  const host =
    getRequiredEnv(
      "INFINITY_TECH_HOST_URL"
    );

  const path =
    getRequiredEnv(
      "INFINITY_TECH_PATH_URL"
    );

  const senderId =
    getRequiredEnv(
      "INFINITY_TECH_SENDER_ID"
    );

  return {
    apiKey,
    host,
    path,
    senderId,
  };
}

/* =========================================================
   PHONE NORMALIZATION

   Supports Kenyan formats such as:

   0712345678
   0112345678
   254712345678
   +254712345678

   Infinity Tech receives:
   254712345678
========================================================= */

export function normalizeKenyanPhoneNumber(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error(
      "Phone number is required."
    );
  }

  let phone =
    value
      .trim()
      .replace(/[\s()-]/g, "");

  if (phone.startsWith("+")) {
    phone =
      phone.substring(1);
  }

  if (
    /^0(7|1)\d{8}$/.test(phone)
  ) {
    phone =
      `254${phone.substring(1)}`;
  }

  if (
    !/^254(7|1)\d{8}$/.test(phone)
  ) {
    throw new Error(
      "Invalid Kenyan mobile phone number."
    );
  }

  return phone;
}

/* =========================================================
   BUILD ENDPOINT
========================================================= */

function buildInfinityUrl(
  host: string,
  path: string
): string {
  const normalizedHost =
    host
      .replace(/\/+$/, "");

  const normalizedPath =
    path.startsWith("/")
      ? path
      : `/${path}`;

  /*
   * If Infinity supplied only an IP/hostname,
   * default to HTTPS.
   */
  if (
    /^https?:\/\//i.test(
      normalizedHost
    )
  ) {
    return (
      normalizedHost +
      normalizedPath
    );
  }

  return (
    `https://${normalizedHost}` +
    normalizedPath
  );
}

/* =========================================================
   SEND SMS
========================================================= */

export async function sendSms(
  phoneNumber: string,
  message: string
): Promise<SendSmsResult> {
  const {
    apiKey,
    host,
    path,
    senderId,
  } = getInfinityConfig();

  const recipient =
    normalizeKenyanPhoneNumber(
      phoneNumber
    );

  const normalizedMessage =
    typeof message === "string"
      ? message.trim()
      : "";

  if (!normalizedMessage) {
    throw new Error(
      "SMS message cannot be empty."
    );
  }

  const url =
    buildInfinityUrl(
      host,
      path
    );

  const refId =
    crypto.randomUUID();

  const response =
    await fetch(url, {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${apiKey}`,

        "Content-Type":
          "application/json",

        Accept:
          "application/json",
      },

      body: JSON.stringify({
        from: senderId,
        to: recipient,
        message:
          normalizedMessage,
        refId,
      }),
    });

  let payload:
    | InfinityTechSmsResponse
    | null = null;

  try {
    payload =
      (await response.json()) as
        InfinityTechSmsResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    console.error(
      "[INFINITY TECH] SMS HTTP failure:",
      {
        status:
          response.status,

        recipient,

        response:
          payload,
      }
    );

    throw new Error(
      payload?.desc ||
        `Infinity Tech SMS request failed with HTTP ${response.status}.`
    );
  }

  const successful =
    payload?.status ===
      "SUCCESS" &&
    payload?.statusCode ===
      "0";

  if (!successful) {
    console.error(
      "[INFINITY TECH] SMS rejected:",
      {
        recipient,

        status:
          payload?.status,

        statusCode:
          payload?.statusCode,

        description:
          payload?.desc,
      }
    );

    throw new Error(
      payload?.desc ||
        "Infinity Tech rejected the SMS request."
    );
  }

  return {
    success: true,

    messageId:
      payload?.msgId,

    recipient,

    description:
      payload?.desc,
  };
}

/* =========================================================
   SEND PHONE OTP
========================================================= */

export async function sendPhoneOtp(
  phoneNumber: string,
  otp: string
): Promise<SendSmsResult> {
  if (
    !/^\d{6}$/.test(otp)
  ) {
    throw new Error(
      "OTP must contain exactly 6 digits."
    );
  }

  return sendSms(
    phoneNumber,
    `Your Ziya FOS verification code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`
  );
}