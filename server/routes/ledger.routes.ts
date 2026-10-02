import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  getAllLedger,
  getLedger,
} from "../controllers/ledger.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * GENERAL LEDGER ROUTES
 * =========================================================
 *
 * All ledger access is:
 *
 * - authenticated
 * - permission controlled
 * - tenant scoped
 *
 * The organization/tenant is taken exclusively from the
 * authenticated request context. Clients must never supply an
 * organizationId to select another tenant's ledger.
 *
 * Permission:
 *
 *   ledger.view
 *
 * The controller/service layer remains responsible for:
 *
 * - tenant ownership validation
 * - posted-journal filtering
 * - account ownership validation
 * - accounting-date filtering
 * - opening/closing balance calculations
 * - debit/credit calculations
 * - pagination
 * - deterministic ordering
 * - report consistency
 *
 * This router is deliberately read-only. It does not create,
 * update or delete accounting records.
 */

/**
 * =========================================================
 * ACCOUNT ID VALIDATION
 * =========================================================
 *
 * Ledger account identifiers are validated before reaching the
 * controller. This does not replace tenant ownership checks.
 */
function validateAccountId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const accountId =
    typeof req.params.accountId === "string"
      ? req.params.accountId.trim()
      : "";

  if (!accountId) {
    res.status(400).json({
      success: false,
      message: "Account ID is required.",
    });
    return;
  }

  if (accountId.length > 128) {
    res.status(400).json({
      success: false,
      message: "Invalid account ID.",
    });
    return;
  }

  req.params.accountId = accountId;

  next();
}

/**
 * =========================================================
 * GET GENERAL LEDGER
 * =========================================================
 *
 * GET /api/ledger
 *
 * Returns the tenant's General Ledger.
 *
 * The controller MUST scope all journal/account queries to the
 * authenticated organization and must not accept a client-
 * supplied organization identifier as an override.
 */
router.get(
  "/",
  authenticate,
  requirePermission("ledger.view"),
  getAllLedger,
);

/**
 * =========================================================
 * GET ACCOUNT LEDGER
 * =========================================================
 *
 * GET /api/ledger/:accountId
 *
 * Returns ledger activity for one account belonging to the
 * authenticated tenant.
 *
 * The controller MUST verify account ownership before reading
 * journal lines for the account.
 */
router.get(
  "/:accountId",
  authenticate,
  requirePermission("ledger.view"),
  validateAccountId,
  getLedger,
);

export default router;
