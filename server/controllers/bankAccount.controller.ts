import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { encryptSecret } from "../utils/encryption";
import {
  testBankConnection,
} from "../services/bank.service";
import { AccountRoleError } from "../services/accountRoles.service";
import {
  createLedgerAccountForBank,
  handleAccountError,
  parseBankDetails,
  provisionBankForLedgerAccount,
} from "../services/bankProvisioning.service";

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(
  req: AuthRequest
): string | null {
  return req.user?.organizationId ?? null;
}

function getRouteId(
  req: AuthRequest
): string | null {
  const rawId = req.params.id;

  if (Array.isArray(rawId)) {
    return rawId[0] ?? null;
  }

  return rawId ?? null;
}

function isNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function normalizeOptionalString(
  value: unknown
): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
}

function normalizeCurrency(
  value: unknown
): string {
  if (!isNonEmptyString(value)) {
    return "KES";
  }

  const currency =
    value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      "Currency must be a valid 3-letter ISO currency code."
    );
  }

  return currency;
}

function parseBoolean(
  value: unknown,
  defaultValue = false
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized =
      value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return defaultValue;
}

function parseNonNegativeNumber(
  value: unknown,
  fieldName: string
): number {
  const parsed = Number(
    value ?? 0
  );

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${fieldName} must be a valid non-negative number.`
    );
  }

  return parsed;
}

function validateHttpsUrl(
  value: string,
  fieldName: string
): string {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1"
    ) {
      throw new Error(
        `${fieldName} must use HTTPS.`
      );
    }

    return value;
  } catch {
    throw new Error(
      `${fieldName} must be a valid HTTPS URL.`
    );
  }
}

/**
 * Never expose API credentials to the frontend.
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
    lastSyncAt: Date | null;
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

export const createBankAccount =
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
        glAccountId,
        openingBalanceDate,
      } = req.body ?? {};

      if (!isNonEmptyString(bankName)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_BANK_NAME",
          message:
            "Bank name is required.",
        });
      }

      if (!isNonEmptyString(accountName)) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_ACCOUNT_NAME",
          message:
            "Account name is required.",
        });
      }

      if (
        !isNonEmptyString(
          accountNumber
        )
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_ACCOUNT_NUMBER",
          message:
            "Account number is required.",
        });
      }

      let normalizedCurrency: string;

      try {
        normalizedCurrency =
          normalizeCurrency(currency);
      } catch (error) {
        return res.status(400).json({
          success: false,
          code: "INVALID_CURRENCY",
          message:
            error instanceof Error
              ? error.message
              : "Invalid currency.",
        });
      }

      let normalizedOpeningBalance: number;

      try {
        normalizedOpeningBalance =
          parseNonNegativeNumber(
            openingBalance,
            "Opening balance"
          );
      } catch (error) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_OPENING_BALANCE",
          message:
            error instanceof Error
              ? error.message
              : "Invalid opening balance.",
        });
      }

      let normalizedApiBaseUrl:
        | string
        | null = null;

      if (
        isNonEmptyString(apiBaseUrl)
      ) {
        try {
          normalizedApiBaseUrl =
            validateHttpsUrl(
              apiBaseUrl.trim(),
              "Bank API base URL"
            );
        } catch (error) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_API_BASE_URL",
            message:
              error instanceof Error
                ? error.message
                : "Invalid bank API URL.",
          });
        }
      }

      let validatedGlAccountId: string | null = null;

      if (isNonEmptyString(glAccountId)) {
        const ledgerAccount =
          await prisma.account.findFirst({
            where: {
              id: glAccountId.trim(),
              organizationId,
              type: "ASSET",
            },
            select: { id: true },
          });

        if (!ledgerAccount) {
          return res.status(400).json({
            success: false,
            code: "INVALID_LEDGER_ACCOUNT",
            message:
              "The selected ledger account must be an Asset account in your Chart of Accounts.",
          });
        }

        validatedGlAccountId = ledgerAccount.id;
      }

      /*
       * API credentials are encrypted before
       * being stored in PostgreSQL.
       */
      const encryptedApiKey =
        isNonEmptyString(apiKey)
          ? encryptSecret(
              apiKey.trim()
            )
          : null;

      const encryptedApiSecret =
        isNonEmptyString(apiSecret)
          ? encryptSecret(
              apiSecret.trim()
            )
          : null;

      /*
       * One transaction: link to the chosen ledger account (or create it in
       * the Chart of Accounts), create the bank profile, post the opening
       * balance. The user never creates the account twice.
       */
      const details = parseBankDetails(
        {
          bankName,
          accountNumber,
          branchName,
          currency: normalizedCurrency,
          openingBalance: normalizedOpeningBalance,
          openingBalanceDate,
        },
        true
      );

      const { bankAccount } = await prisma.$transaction(async (tx) => {
        let ledger: { id: string; name: string };

        if (validatedGlAccountId) {
          const chosen = await tx.account.findFirst({
            where: { id: validatedGlAccountId, organizationId },
            select: { id: true, name: true, subtype: true },
          });

          if (!chosen) {
            throw new AccountRoleError("INVALID_LEDGER_ACCOUNT", "The selected ledger account was not found.");
          }

          if (chosen.subtype && chosen.subtype !== "BANK") {
            throw new AccountRoleError(
              "LEDGER_ACCOUNT_NOT_BANK",
              "The selected ledger account is marked " + chosen.subtype + ", not BANK."
            );
          }

          const taken = await tx.bankAccount.count({
            where: { organizationId, glAccountId: chosen.id },
          });

          if (taken > 0) {
            throw new AccountRoleError(
              "LEDGER_ACCOUNT_ALREADY_LINKED",
              "This ledger account is already linked to another bank account.",
              409
            );
          }

          if (!chosen.subtype) {
            await tx.account.update({ where: { id: chosen.id }, data: { subtype: "BANK" } });
          }

          ledger = chosen;
        } else {
          ledger = await createLedgerAccountForBank(
            tx,
            organizationId,
            bankName.trim() + " - " + accountName.trim()
          );
        }

        return provisionBankForLedgerAccount(
          tx,
          { organizationId, userId: req.user?.userId ?? null },
          ledger,
          details,
          {
            integrationEnabled: parseBoolean(integrationEnabled),
            integrationProvider: normalizeOptionalString(integrationProvider),
            apiBaseUrl: normalizedApiBaseUrl,
            apiKey: encryptedApiKey,
            apiSecret: encryptedApiSecret,
            webhookUrl: normalizeOptionalString(webhookUrl),
            connectionStatus: "DISCONNECTED",
          }
        );
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

      if (handleAccountError(res, error)) return;

      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "BANK_ACCOUNT_EXISTS",
          message:
            "A bank account with this account number already exists in this organization.",
        });
      }

      return res.status(500).json({
        success: false,
        code:
          "BANK_ACCOUNT_CREATE_FAILED",
        message:
          "Failed to create bank account.",
      });
    }
  };

/* =========================================================
   GET BANK ACCOUNTS
========================================================= */

export const getBankAccounts =
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

      const bankAccounts =
        await prisma.bankAccount.findMany({
          where: {
            organizationId,
            status: "ACTIVE",
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
        code:
          "BANK_ACCOUNT_FETCH_FAILED",
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
          code:
            "BANK_ACCOUNT_ID_REQUIRED",
          message:
            "Bank account ID is required.",
        });
      }

      const bankAccount =
        await prisma.bankAccount.findFirst({
          where: {
            id,
            organizationId,
            status: "ACTIVE",
          },
        });

      if (!bankAccount) {
        return res.status(404).json({
          success: false,
          code:
            "BANK_ACCOUNT_NOT_FOUND",
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
        code:
          "BANK_ACCOUNT_FETCH_FAILED",
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
          code:
            "BANK_ACCOUNT_ID_REQUIRED",
          message:
            "Bank account ID is required.",
        });
      }

      /*
       * Tenant isolation:
       * the account must belong to the
       * authenticated organization.
       */
      const existing =
        await prisma.bankAccount.findFirst({
          where: {
            id,
            organizationId,
            status: "ACTIVE",
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          code:
            "BANK_ACCOUNT_NOT_FOUND",
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
        glAccountId,
      } = req.body ?? {};

      const data: Prisma.BankAccountUpdateInput =
        {};

      if (glAccountId !== undefined) {
        if (
          glAccountId === null ||
          (typeof glAccountId === "string" &&
            glAccountId.trim() === "")
        ) {
          data.glAccount = { disconnect: true };
        } else if (isNonEmptyString(glAccountId)) {
          const ledgerAccount =
            await prisma.account.findFirst({
              where: {
                id: glAccountId.trim(),
                organizationId,
                type: "ASSET",
              },
              select: { id: true },
            });

          if (!ledgerAccount) {
            return res.status(400).json({
              success: false,
              code: "INVALID_LEDGER_ACCOUNT",
              message:
                "The selected ledger account must be an Asset account in your Chart of Accounts.",
            });
          }

          data.glAccount = {
            connect: { id: ledgerAccount.id },
          };
        }
      }

      /* -----------------------------------------------------
         BASIC ACCOUNT INFORMATION
      ----------------------------------------------------- */

      if (bankName !== undefined) {
        if (
          !isNonEmptyString(bankName)
        ) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_BANK_NAME",
            message:
              "Bank name cannot be empty.",
          });
        }

        data.bankName =
          bankName.trim();
      }

      if (accountName !== undefined) {
        if (
          !isNonEmptyString(
            accountName
          )
        ) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_ACCOUNT_NAME",
            message:
              "Account name cannot be empty.",
          });
        }

        data.accountName =
          accountName.trim();
      }

      if (accountNumber !== undefined) {
        if (
          !isNonEmptyString(
            accountNumber
          )
        ) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_ACCOUNT_NUMBER",
            message:
              "Account number cannot be empty.",
          });
        }

        data.accountNumber =
          accountNumber.trim();
      }

      if (branchName !== undefined) {
        data.branchName =
          normalizeOptionalString(
            branchName
          );
      }

      if (currency !== undefined) {
        try {
          data.currency =
            normalizeCurrency(
              currency
            );
        } catch (error) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_CURRENCY",
            message:
              error instanceof Error
                ? error.message
                : "Invalid currency.",
          });
        }
      }

      /* -----------------------------------------------------
         INTEGRATION CONFIGURATION
      ----------------------------------------------------- */

      if (
        integrationEnabled !==
        undefined
      ) {
        data.integrationEnabled =
          parseBoolean(
            integrationEnabled,
            existing.integrationEnabled
          );
      }

      if (
        integrationProvider !==
        undefined
      ) {
        data.integrationProvider =
          normalizeOptionalString(
            integrationProvider
          );
      }

      if (apiBaseUrl !== undefined) {
        const normalizedApiBaseUrl =
          normalizeOptionalString(
            apiBaseUrl
          );

        if (normalizedApiBaseUrl) {
          try {
            data.apiBaseUrl =
              validateHttpsUrl(
                normalizedApiBaseUrl,
                "Bank API base URL"
              );
          } catch (error) {
            return res.status(400).json({
              success: false,
              code:
                "INVALID_API_BASE_URL",
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid bank API URL.",
            });
          }
        } else {
          data.apiBaseUrl = null;
        }
      }

      /*
       * New credentials are encrypted before
       * being stored.
       *
       * Empty values do not overwrite existing
       * credentials.
       */
      if (
        typeof apiKey === "string" &&
        apiKey.trim()
      ) {
        data.apiKey =
          encryptSecret(
            apiKey.trim()
          );
      }

      if (
        typeof apiSecret === "string" &&
        apiSecret.trim()
      ) {
        data.apiSecret =
          encryptSecret(
            apiSecret.trim()
          );
      }

      if (webhookUrl !== undefined) {
        data.webhookUrl =
          normalizeOptionalString(
            webhookUrl
          );
      }

      /*
       * Any integration configuration change
       * invalidates the previous connection.
       */
      const integrationChanged =
        integrationEnabled !==
          undefined ||
        integrationProvider !==
          undefined ||
        apiBaseUrl !==
          undefined ||
        apiKey !== undefined ||
        apiSecret !== undefined ||
        webhookUrl !==
          undefined;

      if (integrationChanged) {
        data.connectionStatus =
          "DISCONNECTED";

        data.lastSyncAt = null;
      }

      const updatedBankAccount =
        await prisma.bankAccount.update({
          where: {
            id: existing.id,
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
          code:
            "BANK_ACCOUNT_EXISTS",
          message:
            "A bank account with this account number already exists in this organization.",
        });
      }

      return res.status(500).json({
        success: false,
        code:
          "BANK_ACCOUNT_UPDATE_FAILED",
        message:
          "Failed to update bank account.",
      });
    }
  };

/* =========================================================
   TEST BANK CONNECTION
========================================================= */

export const testBankAccountConnection =
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
          code:
            "BANK_ACCOUNT_ID_REQUIRED",
          message:
            "Bank account ID is required.",
        });
      }

      const result =
        await testBankConnection(
          organizationId,
          id
        );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          code:
            "BANK_CONNECTION_FAILED",
          message:
            result.message,
          status:
            result.status,
          provider:
            result.provider ?? null,
          details:
            result.details ?? null,
        });
      }

      return res.status(200).json({
        success: true,
        code:
          "BANK_CONNECTION_SUCCESSFUL",
        message:
          result.message,
        status:
          result.status,
        provider:
          result.provider ?? null,
        details:
          result.details ?? null,
      });
    } catch (error: unknown) {
      console.error(
        "[BANK ACCOUNT] CONNECTION TEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "BANK_CONNECTION_TEST_FAILED",
        message:
          "Failed to test bank connection.",
      });
    }
  };


/* =========================================================
   DELETE BANK ACCOUNT
   - No activity: permanently deleted.
   - Has payments / expenses: deactivated so history stays intact.
========================================================= */

export const deleteBankAccount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required.",
      });
    }

    const id = getRouteId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "BANK_ACCOUNT_ID_REQUIRED",
        message: "Bank account ID is required.",
      });
    }

    const existing = await prisma.bankAccount.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        _count: {
          select: {
            bankPayments: true,
            bankPaymentBatches: true,
            expenses: true,
            statements: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "BANK_ACCOUNT_NOT_FOUND",
        message: "Bank account not found.",
      });
    }

    const hasActivity =
      existing._count.bankPayments > 0 ||
      existing._count.bankPaymentBatches > 0 ||
      existing._count.expenses > 0 ||
      existing._count.statements > 0;

    if (hasActivity) {
      await prisma.bankAccount.update({
        where: { id: existing.id },
        data: { status: "INACTIVE" },
      });

      return res.status(200).json({
        success: true,
        deactivated: true,
        message:
          "This account has transactions, so it was deactivated instead of deleted.",
      });
    }

    await prisma.bankAccount.delete({
      where: { id: existing.id },
    });

    return res.status(200).json({
      success: true,
      deactivated: false,
      message: "Bank account deleted.",
    });
  } catch (error: unknown) {
    console.error("[BANK ACCOUNT] DELETE ERROR:", error);

    return res.status(500).json({
      success: false,
      code: "BANK_ACCOUNT_DELETE_FAILED",
      message: "Failed to delete bank account.",
    });
  }
};
