import { Response } from "express";

import { AuthRequest } from "../middleware/auth.middleware";

import {
  syncBankAccountBalance,
  syncOrganizationBankBalances,
} from "../services/bankBalance.service";

/* =========================================================
   ORGANIZATION CONTEXT
========================================================= */

function getOrganizationId(
  req: AuthRequest
): string | null {
  return req.user?.organizationId ?? null;
}

/* =========================================================
   ROUTE ID
========================================================= */

function getRouteId(
  req: AuthRequest
): string | null {
  const rawId = req.params.id;

  if (Array.isArray(rawId)) {
    return rawId[0] ?? null;
  }

  return rawId ?? null;
}

/* =========================================================
   SYNC ONE BANK ACCOUNT
========================================================= */

export const syncBankAccountBalanceController =
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

      const bankAccountId =
        getRouteId(req);

      if (!bankAccountId) {
        return res.status(400).json({
          success: false,
          code:
            "BANK_ACCOUNT_ID_REQUIRED",
          message:
            "Bank account ID is required.",
        });
      }

      const result =
        await syncBankAccountBalance(
          organizationId,
          bankAccountId
        );

      return res.status(200).json(
        result
      );
    } catch (error) {
      console.error(
        "[BANK BALANCE] SYNC ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        code:
          "BANK_BALANCE_SYNC_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Failed to synchronize bank balance.",
      });
    }
  };

/* =========================================================
   SYNC ALL ORGANIZATION BANK ACCOUNTS
========================================================= */

export const syncOrganizationBankBalancesController =
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

      const results =
        await syncOrganizationBankBalances(
          organizationId
        );

      const successful =
        results.filter(
          (result) => result.success
        ).length;

      const failed =
        results.length - successful;

      return res.status(200).json({
        success: failed === 0,
        results,
        meta: {
          total: results.length,
          successful,
          failed,
        },
      });
    } catch (error) {
      console.error(
        "[BANK BALANCE] ORGANIZATION SYNC ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "BANK_BALANCE_SYNC_FAILED",
        message:
          "Failed to synchronize organizational bank balances.",
      });
    }
  };