import axios, {
  AxiosError,
  AxiosInstance,
} from "axios";

const MPESA_ENV =
  process.env.MPESA_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";

const BASE_URL =
  MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(
      `Missing required M-Pesa environment variable: ${name}`,
    );
  }

  return value.trim();
}

function createMpesaClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 20_000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

function normalizePhoneNumber(phoneNumber: string): string {
  const value = String(phoneNumber ?? "").trim();

  if (/^2547\d{8}$/.test(value)) {
    return value;
  }

  if (/^07\d{8}$/.test(value)) {
    return `254${value.slice(1)}`;
  }

  if (/^\+2547\d{8}$/.test(value)) {
    return value.slice(1);
  }

  throw new Error(
    "Invalid Kenyan phone number. Use 07XXXXXXXX, +2547XXXXXXXX or 2547XXXXXXXX.",
  );
}

export function normalizeMpesaPhoneNumber(
  phoneNumber: string,
): string {
  return normalizePhoneNumber(phoneNumber);
}

export async function getMpesaAccessToken(): Promise<string> {
  const consumerKey =
    requiredEnv("MPESA_CONSUMER_KEY");

  const consumerSecret =
    requiredEnv("MPESA_CONSUMER_SECRET");

  const credentials = Buffer.from(
    `${consumerKey}:${consumerSecret}`,
  ).toString("base64");

  const client = createMpesaClient();

  try {
    const response = await client.get(
      "/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        timeout: 15_000,
      },
    );

    const token =
      response.data?.access_token;

    if (!token) {
      throw new Error(
        "Safaricom did not return an access token.",
      );
    }

    return token;
  } catch (error) {
    const axiosError =
      error as AxiosError;

    console.error(
      "[MPESA] Access token request failed:",
      axiosError.response?.data ??
        axiosError.message,
    );

    throw new Error(
      "Unable to authenticate with Safaricom M-Pesa.",
    );
  }
}

export interface B2CPaymentParams {
  amount: number;
  phoneNumber: string;
  remarks: string;
  occasion?: string;
}

export interface B2CResponse {
  ResponseCode?: string | number;
  ResponseDescription?: string;
  OriginatorConversationID?: string;
  ConversationID?: string;
  [key: string]: unknown;
}

export async function initiateB2CPayment(
  params: B2CPaymentParams,
): Promise<B2CResponse> {
  const amount = Math.round(
    Number(params.amount),
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "M-Pesa B2C amount must be greater than zero.",
    );
  }

  const phoneNumber =
    normalizePhoneNumber(
      params.phoneNumber,
    );

  const token =
    await getMpesaAccessToken();

  const shortcode =
    requiredEnv("MPESA_B2C_SHORTCODE");

  const initiatorName =
    requiredEnv(
      "MPESA_B2C_INITIATOR_NAME",
    );

  const securityCredential =
    requiredEnv(
      "MPESA_B2C_SECURITY_CREDENTIAL",
    );

  const resultUrl =
    requiredEnv(
      "MPESA_B2C_RESULT_URL",
    );

  const timeoutUrl =
    requiredEnv(
      "MPESA_B2C_TIMEOUT_URL",
    );

  const client = createMpesaClient();

  try {
    const response =
      await client.post<B2CResponse>(
        "/mpesa/b2c/v1/paymentrequest",
        {
          InitiatorName:
            initiatorName,

          SecurityCredential:
            securityCredential,

          CommandID:
            "BusinessPayment",

          Amount: amount,

          PartyA:
            shortcode,

          PartyB:
            phoneNumber,

          Remarks:
            String(
              params.remarks || "ZIYA-FOS",
            ).slice(0, 100),

          QueueTimeOutURL:
            timeoutUrl,

          ResultURL:
            resultUrl,

          Occasion:
            String(
              params.occasion ||
                "ZIYA-FOS",
            ).slice(0, 100),
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        },
      );

    return response.data;
  } catch (error) {
    const axiosError =
      error as AxiosError;

    console.error(
      "[MPESA] B2C request failed:",
      axiosError.response?.data ??
        axiosError.message,
    );

    throw new Error(
      "Safaricom B2C payment request failed.",
    );
  }
}