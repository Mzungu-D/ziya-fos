import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { getTrialBalance } from "../controllers/trialbalance.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * TRIAL BALANCE ROUTES
 * =========================================================
 *
 * Trial Balance is a read-only accounting report.
 *
 * Security:
 *
 * - Authentication is required.
 * - reports.view permission is required.
 * - Tenant identity is taken exclusively from the authenticated
 *   organization context.
 * - The client cannot select another organization through query
 *   parameters.
 *
 * Accounting responsibilities remain in the controller/service:
 *
 * - tenant-scoped account and journal queries
 * - posted-entry filtering
 * - debit/credit aggregation
 * - account-level balances
 * - accounting-date handling
 * - currency handling
 * - report-period validation
 * - deterministic ordering
 * - reconciliation of total debits and credits
 *
 * The route itself performs no accounting mutations.
 */

/**
 * =========================================================
 * TENANT OVERRIDE PROTECTION
 * =========================================================
 *
 * Organization selection must never be controlled by a report
 * query parameter. The authenticated tenant context is the only
 * valid source of organization identity.
 */
function rejectTenantOverride(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const forbiddenParameters = [
    "organizationId",
    "organizationID",
    "orgId",
  ];

  const hasTenantOverride =
    forbiddenParameters.some((parameter) =>
      Object.prototype.hasOwnProperty.call(
        req.query,
        parameter,
      ),
    );

  if (hasTenantOverride) {
    res.status(400).json({
      success: false,
      message:
        "Organization selection is not accepted through report query parameters.",
    });
    return;
  }

  next();
}

/**
 * =========================================================
 * TRIAL BALANCE
 * =========================================================
 *
 * GET /api/trialbalance
 *
 * Returns the authenticated tenant's Trial Balance.
 *
 * The controller must scope all database access to the
 * authenticated organization and must never trust a client-
 * supplied organization identifier.
 */
router.get(
  "/",
  authenticate,
  requirePermission("reports.view"),
  rejectTenantOverride,
  getTrialBalance,
);

export default router;
