import axios from "axios";
import prisma from "../config/prisma";
import { decryptSecret } from "../utils/encryption";

type MpesaAccountCredentials = {
  id: string;
  organizationId: string;
  shortcode: string;
  environment: string;
  consumerKeyEncrypted: string;
  consumerSecretEncrypted: string;
  initiatorName: string;
  securityCredentialEncrypted: string;
  resultUrl: string;
  timeoutUrl: string;
  isActive: boolean;
};

function getBaseUrl(environment: string): string {
  return environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

async function getTenantMpesaAccount(
  organizationId: string
): Promise<MpesaAccountCredentials> {
  const account =
    await prisma.mpesaAccount.findFirst({
      where: {
        organizationId,
        isActive: true,
        accountType: "B2C",
      },
      orderBy: [
        {
          isDefault: "desc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

  if (!account) {
    throw new Error(
      "No active B2C M-Pesa account is configured for this organization."
    );
  }

  return account;
}

async function getTenantAccessToken(
  account: MpesaAccountCredentials
): Promise<string> {
  const consumerKey = decryptSecret(
    account.consumerKeyEncrypted
  );

  const consumerSecret = decryptSecret(
    account.consumerSecretEncrypted
  );

  const credentials = Buffer.from(
    `${consumerKey}:${consumerSecret}`
  ).toString("base64");

  const baseUrl = getBaseUrl(
    account.environment
  );

  const response = await axios.get(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
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

export async function testTenantMpesaConnection(
  organizationId: string
) {
  const account =
    await getTenantMpesaAccount(
      organizationId
    );

  await getTenantAccessToken(account);

  return {
    success: true,
    accountId: account.id,
    environment: account.environment,
    shortcode: account.shortcode,
  };
}

export async function initiateTenantB2CPayment(
  organizationId: string,
  params: {
    amount: number;
    phoneNumber: string;
    remarks: string;
    occasion?: string;
  }
) {
  const account =
    await getTenantMpesaAccount(
      organizationId
    );

  const token =
    await getTenantAccessToken(account);

  const securityCredential =
    decryptSecret(
      account.securityCredentialEncrypted
    );

  const baseUrl = getBaseUrl(
    account.environment
  );

  const response = await axios.post(
    `${baseUrl}/mpesa/b2c/v1/paymentrequest`,
    {
      InitiatorName:
        account.initiatorName,

      SecurityCredential:
        securityCredential,

      CommandID:
        "BusinessPayment",

      Amount:
        Math.round(params.amount),

      PartyA:
        account.shortcode,

      PartyB:
        params.phoneNumber,

      Remarks:
        params.remarks,

      QueueTimeOutURL:
        account.timeoutUrl,

      ResultURL:
        account.resultUrl,

      Occasion:
        params.occasion ||
        "ZIYA-FOS",
    },
    {
      headers: {
        Authorization:
          `Bearer ${token}`,

        "Content-Type":
          "application/json",
      },

      timeout: 20000,
    }
  );

  return response.data;
}