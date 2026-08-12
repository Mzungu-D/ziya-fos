import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(
  req: AuthRequest
): string | null {
  return req.user?.organizationId ?? null;
}

/**
 * Express route params can be represented as string|string[]
 * depending on the Express/TypeScript definitions.
 *
 * Prisma IDs must always receive a single string.
 */
function getRouteId(
  req: AuthRequest
): string | null {
  const rawId = req.params.id;

  if (Array.isArray(rawId)) {
    return rawId[0] ?? null;
  }

  return rawId ?? null;
}

/**
 * Never expose bank integration credentials
 * to the browser.
 */
function sanitizeBankAccount(
  bankAccount: {
    id: string;
    organizationId: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchName: string | null;
    currency: string;
    openingBalance: number;
    currentBalance: number;
    integrationEnabled: boolean;
    integrationProvider: string | null;
    apiBaseUrl: string | null;
    apiKey: string | null;
    apiSecret: string | null;
    webhookUrl: string | null;
    connectionStatus: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  const {
    apiKey: _apiKey,
    apiSecret: _apiSecret,
    ...safeBankAccount
  } = bankAccount;

  return safeBankAccount;
}

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
        code: "AUTH_REQUIRED",
        message:
          "Authentication required.",
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

    const normalizedBankName =
      typeof bankName === "string"
        ? bankName.trim()
        : "";

    const normalizedAccountName =
      typeof accountName === "string"
        ? accountName.trim()
        : "";

    const normalizedAccountNumber =
      typeof accountNumber === "string"
        ? accountNumber.trim()
        : "";

    if (
      !normalizedBankName ||
      !normalizedAccountName ||
      !normalizedAccountNumber
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
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
        code: "INVALID_OPENING_BALANCE",
        message:
          "Opening balance must be a valid number.",
      });
    }

    const normalizedCurrency =
      typeof currency === "string" &&
      currency.trim()
        ? currency.trim().toUpperCase()
        : "KES";

    const bankAccount =
      await prisma.bankAccount.create({
        data: {
          organizationId,

          bankName:
            normalizedBankName,

          accountName:
            normalizedAccountName,

          accountNumber:
            normalizedAccountNumber,

          branchName:
            typeof branchName === "string" &&
            branchName.trim()
              ? branchName.trim()
              : null,

          currency:
            normalizedCurrency,

          openingBalance:
            normalizedOpeningBalance,

          currentBalance:
            normalizedOpeningBalance,

          integrationEnabled:
            Boolean(
              integrationEnabled
            ),

          integrationProvider:
            typeof integrationProvider ===
              "string" &&
            integrationProvider.trim()
              ? integrationProvider.trim()
              : null,

          apiBaseUrl:
            typeof apiBaseUrl ===
              "string" &&
            apiBaseUrl.trim()
              ? apiBaseUrl.trim()
              : null,

          apiKey:
            typeof apiKey === "string" &&
            apiKey.trim()
              ? apiKey.trim()
              : null,

          apiSecret:
            typeof apiSecret ===
              "string" &&
            apiSecret.trim()
              ? apiSecret.trim()
              : null,

          webhookUrl:
            typeof webhookUrl ===
              "string" &&
            webhookUrl.trim()
              ? webhookUrl.trim()
              : null,

          connectionStatus:
            "DISCONNECTED",

          status: "ACTIVE",
        },
      });

    return res.status(201).json({
      success: true,
      bankAccount:
        sanitizeBankAccount(
          bankAccount
        ),
    });
  } catch (error: unknown) {
    console.error(
      "[BANK ACCOUNT] CREATE ERROR:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "BANK_ACCOUNT_EXISTS",
        message:
          "A bank account with this account number already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "BANK_ACCOUNT_CREATE_FAILED",
      message:
        "Failed to create bank account.",
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
        code: "AUTH_REQUIRED",
        message:
          "Authentication required.",
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

      bankAccounts:
        bankAccounts.map(
          sanitizeBankAccount
        ),

      meta: {
        organizationId,
        count:
          bankAccounts.length,
      },
    });
  } catch (error: unknown) {
    console.error(
      "[BANK ACCOUNT] GET ALL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "BANK_ACCOUNT_FETCH_FAILED",
      message:
        "Failed to fetch bank accounts.",
    });
  }
};

/* =========================================================
   GET ONE BANK ACCOUNT
========================================================= */

export const getBankAccountById =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Authentication required.",
        });
      }

      const id =
        getRouteId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          code: "BANK_ACCOUNT_ID_REQUIRED",
          message:
            "Bank account ID is required.",
        });
      }

      const bankAccount =
        await prisma.bankAccount.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!bankAccount) {
        return res.status(404).json({
          success: false,
          code: "BANK_ACCOUNT_NOT_FOUND",
          message:
            "Bank account not found.",
        });
      }

      return res.status(200).json({
        success: true,

        bankAccount:
          sanitizeBankAccount(
            bankAccount
          ),
      });
    } catch (error: unknown) {
      console.error(
        "[BANK ACCOUNT] GET ONE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code: "BANK_ACCOUNT_FETCH_FAILED",
        message:
          "Failed to fetch bank account.",
      });
    }
  };

/* =========================================================
   UPDATE BANK ACCOUNT
========================================================= */

export const updateBankAccount =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Authentication required.",
        });
      }

      const id =
        getRouteId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          code: "BANK_ACCOUNT_ID_REQUIRED",
          message:
            "Bank account ID is required.",
        });
      }

      /*
       * Always locate the account using BOTH
       * the ID and organization ID.
       *
       * This prevents one tenant from updating
       * another tenant's bank account.
       */
      const existing =
        await prisma.bankAccount.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          code: "BANK_ACCOUNT_NOT_FOUND",
          message:
            "Bank account not found.",
        });
      }

      const {
        bankName,
        accountName,
        accountNumber,
        branchName,
        currency,
        integrationEnabled,
        integrationProvider,
        apiBaseUrl,
        apiKey,
        apiSecret,
        webhookUrl,
      } = req.body;

      const data: Prisma.BankAccountUpdateInput =
        {};

      /* -----------------------------------------------------
         BASIC ACCOUNT INFORMATION
      ----------------------------------------------------- */

      if (bankName !== undefined) {
        if (
          typeof bankName !== "string" ||
          !bankName.trim()
        ) {
          return res.status(400).json({
            success: false,
            code: "INVALID_BANK_NAME",
            message:
              "Bank name cannot be empty.",
          });
        }

        data.bankName =
          bankName.trim();
      }

      if (accountName !== undefined) {
        if (
          typeof accountName !==
            "string" ||
          !accountName.trim()
        ) {
          return res.status(400).json({
            success: false,
            code: "INVALID_ACCOUNT_NAME",
            message:
              "Account name cannot be empty.",
          });
        }

        data.accountName =
          accountName.trim();
      }

      if (accountNumber !== undefined) {
        if (
          typeof accountNumber !==
            "string" ||
          !accountNumber.trim()
        ) {
          return res.status(400).json({
            success: false,
            code: "INVALID_ACCOUNT_NUMBER",
            message:
              "Account number cannot be empty.",
          });
        }

        data.accountNumber =
          accountNumber.trim();
      }

      if (branchName !== undefined) {
        data.branchName =
          typeof branchName ===
            "string" &&
          branchName.trim()
            ? branchName.trim()
            : null;
      }

      if (currency !== undefined) {
        if (
          typeof currency !==
            "string" ||
          !currency.trim()
        ) {
          return res.status(400).json({
            success: false,
            code: "INVALID_CURRENCY",
            message:
              "Currency cannot be empty.",
          });
        }

        data.currency =
          currency.trim().toUpperCase();
      }

      /* -----------------------------------------------------
         INTEGRATION CONFIGURATION
      ----------------------------------------------------- */

      if (
        integrationEnabled !==
        undefined
      ) {
        data.integrationEnabled =
          Boolean(
            integrationEnabled
          );
      }

      if (
        integrationProvider !==
        undefined
      ) {
        data.integrationProvider =
          typeof integrationProvider ===
            "string" &&
          integrationProvider.trim()
            ? integrationProvider.trim()
            : null;
      }

      if (apiBaseUrl !== undefined) {
        data.apiBaseUrl =
          typeof apiBaseUrl ===
            "string" &&
          apiBaseUrl.trim()
            ? apiBaseUrl.trim()
            : null;
      }

      /*
       * Empty credential values do NOT overwrite
       * existing credentials.
       *
       * This allows the frontend to edit other
       * fields without destroying stored secrets.
       */
      if (
        typeof apiKey === "string" &&
        apiKey.trim()
      ) {
        data.apiKey =
          apiKey.trim();
      }

      if (
        typeof apiSecret ===
          "string" &&
        apiSecret.trim()
      ) {
        data.apiSecret =
          apiSecret.trim();
      }

      if (webhookUrl !== undefined) {
        data.webhookUrl =
          typeof webhookUrl ===
            "string" &&
          webhookUrl.trim()
            ? webhookUrl.trim()
            : null;
      }

      /*
       * Any integration configuration change
       * invalidates the previous connection state.
       *
       * We deliberately do NOT claim the account
       * is connected until an actual provider
       * connection test succeeds.
       */
      const integrationChanged =
        integrationEnabled !==
          undefined ||
        integrationProvider !==
          undefined ||
        apiBaseUrl !== undefined ||
        apiKey !== undefined ||
        apiSecret !== undefined ||
        webhookUrl !== undefined;

      if (integrationChanged) {
        data.connectionStatus =
          "DISCONNECTED";
      }

      const updatedBankAccount =
        await prisma.bankAccount.update({
          where: {
            id,
          },

          data,
        });

      return res.status(200).json({
        success: true,

        bankAccount:
          sanitizeBankAccount(
            updatedBankAccount
          ),
      });
    } catch (error: unknown) {
      console.error(
        "[BANK ACCOUNT] UPDATE ERROR:",
        error
      );

      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          success: false,
          code: "BANK_ACCOUNT_EXISTS",
          message:
            "A bank account with this account number already exists in this organization.",
        });
      }

      return res.status(500).json({
        success: false,
        code: "BANK_ACCOUNT_UPDATE_FAILED",
        message:
          "Failed to update bank account.",
      });
    }
  };