import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

/* =========================================================
   CREATE BANK ACCOUNT
========================================================= */

export const createBankAccount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      bankName,
      accountName,
      accountNumber,
      branchName,
      currency,
      openingBalance,
      integrationEnabled,
      integrationProvider,
      apiBaseUrl,
      apiKey,
      apiSecret,
      webhookUrl,
    } = req.body;

    if (
      !bankName ||
      !accountName ||
      !accountNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Bank name, account name and account number are required.",
      });
    }

    const normalizedOpeningBalance =
      Number(openingBalance ?? 0);

    if (
      !Number.isFinite(
        normalizedOpeningBalance
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Opening balance must be a valid number.",
      });
    }

    const bankAccount =
      await prisma.bankAccount.create({
        data: {
          organizationId,

          bankName:
            String(bankName).trim(),

          accountName:
            String(accountName).trim(),

          accountNumber:
            String(accountNumber).trim(),

          branchName:
            branchName
              ? String(branchName).trim()
              : null,

          currency:
            currency
              ? String(currency)
                  .trim()
                  .toUpperCase()
              : "KES",

          openingBalance:
            normalizedOpeningBalance,

          currentBalance:
            normalizedOpeningBalance,

          integrationEnabled:
            Boolean(
              integrationEnabled
            ),

          integrationProvider:
            integrationProvider
              ? String(
                  integrationProvider
                ).trim()
              : null,

          apiBaseUrl:
            apiBaseUrl
              ? String(apiBaseUrl).trim()
              : null,

          apiKey:
            apiKey
              ? String(apiKey).trim()
              : null,

          apiSecret:
            apiSecret
              ? String(apiSecret).trim()
              : null,

          webhookUrl:
            webhookUrl
              ? String(webhookUrl).trim()
              : null,

          connectionStatus:
            "DISCONNECTED",

          status:
            "ACTIVE",
        },
      });

    return res.status(201).json({
      success: true,
      bankAccount,
    });
  } catch (error: any) {
    console.error(
      "CREATE BANK ACCOUNT ERROR:",
      error
    );

    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message:
          "A bank account with this account number already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create bank account",
    });
  }
};

/* =========================================================
   GET BANK ACCOUNTS
========================================================= */

export const getBankAccounts = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const bankAccounts =
      await prisma.bankAccount.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      bankAccounts,

      meta: {
        organizationId,
        count: bankAccounts.length,
      },
    });
  } catch (error) {
    console.error(
      "GET BANK ACCOUNTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch bank accounts",
    });
  }
};