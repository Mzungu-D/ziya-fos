import type { Response } from "express";

import { AuthRequest } from "../middleware/auth.middleware";

import {
  syncBankAccountBalance,
  syncOrganizationBankBalances,
} from "../services/bankBalance.service";

/* =========================================================
   CONSTANTS
========================================================= */

const MAX_ID_LENGTH = 100;

/* =========================================================
   TYPES
========================================================= */

type ControllerError = {
  status: number;
  code: string;
  message: string;
};

/* =========================================================
   ORGANIZATION CONTEXT
========================================================= */

function getOrganizationId(
  req: AuthRequest,
): string | null {
  const organizationId =
    req.user?.organizationId;

  if (
    typeof organizationId !== "string"
  ) {
    return null;
  }

  const normalized =
    organizationId.trim();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_ID_LENGTH
  ) {
    return null;
  }

  return normalized;
}

/* =========================================================
   ROUTE ID
========================================================= */

function getRouteId(
  req: AuthRequest,
): string | null {
  const rawId = req.params.id;

  const id = Array.isArray(rawId)
    ? rawId[0]
    : rawId;

  if (
    typeof id !== "string"
  ) {
    return null;
  }

  const normalized =
    id.trim();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_ID_LENGTH
  ) {
    return null;
  }

  return normalized;
}

/* =========================================================
   ERROR MESSAGE
========================================================= */

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message.trim();
  }

  return "";
}

/* =========================================================
   ERROR CLASSIFICATION
========================================================= */

function classifySyncError(
  error: unknown,
): ControllerError {
  const message =
    getErrorMessage(error)
      .toLowerCase();

  if (
    message.includes("not found") ||
    message.includes("does not exist")
  ) {
    return {
      status: 404,
      code: "BANK_ACCOUNT_NOT_FOUND",
      message:
        "The requested bank account was not found.",
    };
  }

  if (
    message.includes("not enabled") ||
    message.includes("disabled")
  ) {
    return {
      status: 409,
      code:
        "BANK_INTEGRATION_DISABLED",
      message:
        "Bank integration is not enabled for this account.",
    };
  }

  if (
    message.includes("not connected")
  ) {
    return {
      status: 409,
      code: "BANK_NOT_CONNECTED",
      message:
        "The bank account is not connected.",
    };
  }

  if (
    message.includes("not configured")
  ) {
    return {
      status: 409,
      code:
        "BANK_INTEGRATION_NOT_CONFIGURED",
      message:
        "Bank integration is not fully configured.",
    };
  }

  if (
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return {
      status: 504,
      code: "BANK_PROVIDER_TIMEOUT",
      message:
        "The bank provider did not respond within the allowed time.",
    };
  }

  if (
    message.includes("https") ||
    message.includes("endpoint")
  ) {
    return {
      status: 502,
      code:
        "BANK_PROVIDER_CONFIGURATION_ERROR",
      message:
        "The configured bank provider endpoint is invalid.",
    };
  }

  if (
    message.includes("provider response") ||
    message.includes("provider") ||
    message.includes("http ")
  ) {
    return {
      status: 502,
      code: "BANK_PROVIDER_ERROR",
      message:
        "The bank provider could not complete the balance request.",
    };
  }

  return {
    status: 502,
    code:
      "BANK_BALANCE_SYNC_FAILED",
    message:
      "Unable to synchronize the bank balance.",
  };
}

/* =========================================================
   ERROR RESPONSE
========================================================= */

function sendSyncError(
  res: Response,
  error: unknown,
): void {
  const classified =
    classifySyncError(error);

  res.status(
    classified.status,
  ).json({
    success: false,
    code:
      classified.code,
    message:
      classified.message,
  });
}

/* =========================================================
   SYNC ONE BANK ACCOUNT
========================================================= */

export const syncBankAccountBalanceController =
  async (
    req: AuthRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Authentication required.",
        });

        return;
      }

      const bankAccountId =
        getRouteId(req);

      if (!bankAccountId) {
        res.status(400).json({
          success: false,
          code:
            "BANK_ACCOUNT_ID_REQUIRED",
          message:
            "A valid bank account ID is required.",
        });

        return;
      }

      const result =
        await syncBankAccountBalance(
          organizationId,
          bankAccountId,
        );

      res.status(200).json({
        success:
          result.success === true,
        code:
          result.success === true
            ? "BANK_BALANCE_SYNCED"
            : "BANK_BALANCE_SYNC_FAILED",
        message:
          result.message,
        bankAccount: {
          id:
            result.bankAccountId,
          currentBalance:
            result.currentBalance ??
            null,
          currency:
            result.currency,
          lastSyncAt:
            result.lastSyncAt ??
            null,
          provider:
            result.provider ??
            null,
        },
      });
    } catch (error: unknown) {
      console.error(
        "[BANK BALANCE] SINGLE ACCOUNT SYNC ERROR:",
        error,
      );

      sendSyncError(
        res,
        error,
      );
    }
  };

/* =========================================================
   SYNC ALL ORGANIZATION BANK ACCOUNTS
========================================================= */

export const syncOrganizationBankBalancesController =
  async (
    req: AuthRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Authentication required.",
        });

        return;
      }

      const results =
        await syncOrganizationBankBalances(
          organizationId,
        );

      const successful =
        results.filter(
          (result) =>
            result.success === true,
        ).length;

      const failed =
        results.length -
        successful;

      const responseResults =
        results.map(
          (result) => ({
            success:
              result.success === true,
            bankAccountId:
              result.bankAccountId,
            currentBalance:
              result.currentBalance ??
              null,
            currency:
              result.currency,
            lastSyncAt:
              result.lastSyncAt ??
              null,
            provider:
              result.provider ??
              null,
            message:
              result.success
                ? result.message
                : "Bank balance synchronization failed.",
          }),
        );

      const allSuccessful =
        failed === 0;

      res.status(200).json({
        success:
          allSuccessful,

        code:
          allSuccessful
            ? "BANK_BALANCES_SYNCED"
            : "BANK_BALANCES_PARTIALLY_SYNCED",

        message:
          allSuccessful
            ? "All eligible bank balances were synchronized successfully."
            : "Bank balance synchronization completed with some failures.",

        results:
          responseResults,

        meta: {
          total:
            results.length,
          successful,
          failed,
        },
      });
    } catch (error: unknown) {
      console.error(
        "[BANK BALANCE] ORGANIZATION SYNC ERROR:",
        error,
      );

      sendSyncError(
        res,
        error,
      );
    }
  };