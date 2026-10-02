import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  listTaxObligations,
  listTaxFilings,
  createTaxFiling,
  listTaxPayments,
  createTaxPayment,
} from "../controllers/tax.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * TAX ROUTES
 * =========================================================
 *
 * All tax operations are:
 *
 * - authenticated
 * - permission controlled
 * - tenant scoped
 *
 * Tenant identity is obtained exclusively from the authenticated
 * organization context. The client cannot select another tenant
 * through route parameters or request bodies.
 *
 * Permissions:
 *
 *   tax.view
 *   tax.file
 *   tax.payment
 *
 * This router exposes tax obligations, filings and payments.
 * Tax calculation, filing validation, period controls, duplicate
 * protection, payment controls and audit integrity remain in the
 * tax controller/service layer.
 *
 * Tax records must never be created, modified or exposed across
 * organization boundaries.
 */

/**
 * =========================================================
 * TENANT OVERRIDE PROTECTION
 * =========================================================
 *
 * Tax list/report queries must never allow a caller to select
 * another organization through a query parameter.
 *
 * The authenticated organization context is the sole tenant
 * selector.
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
        "Organization selection is not accepted through tax query parameters.",
    });
    return;
  }

  next();
}

/**
 * =========================================================
 * AUTHENTICATION
 * =========================================================
 *
 * Every tax endpoint requires an authenticated tenant member.
 */
router.use(authenticate);

/**
 * =========================================================
 * TAX OBLIGATIONS
 * =========================================================
 *
 * GET /api/tax/obligations
 *
 * Read-only list of tax obligations available to the
 * authenticated organization.
 *
 * The controller is responsible for tenant scoping, filtering,
 * pagination and deterministic ordering.
 */
router.get(
  "/obligations",
  requirePermission("tax.view"),
  rejectTenantOverride,
  listTaxObligations,
);

/**
 * =========================================================
 * TAX FILINGS
 * =========================================================
 *
 * GET /api/tax/filings
 *
 * Read-only list of tax filings.
 */
router.get(
  "/filings",
  requirePermission("tax.view"),
  rejectTenantOverride,
  listTaxFilings,
);

/**
 * POST /api/tax/filings
 *
 * Creates a tax filing for the authenticated organization.
 *
 * The tax controller/service must enforce:
 *
 * - tenant ownership
 * - valid tax obligation
 * - valid filing period
 * - valid tax amounts
 * - duplicate filing protection
 * - transaction atomicity
 * - audit logging
 */
router.post(
  "/filings",
  requirePermission("tax.file"),
  createTaxFiling,
);

/**
 * =========================================================
 * TAX PAYMENTS
 * =========================================================
 *
 * GET /api/tax/payments
 *
 * Read-only list of tax payments.
 */
router.get(
  "/payments",
  requirePermission("tax.view"),
  rejectTenantOverride,
  listTaxPayments,
);

/**
 * POST /api/tax/payments
 *
 * Records a tax payment.
 *
 * The tax controller/service must enforce:
 *
 * - tenant ownership
 * - valid tax filing/obligation
 * - valid payment amount
 * - no overpayment
 * - duplicate payment-reference protection
 * - valid payment date
 * - transactional persistence
 * - audit logging
 *
 * Where accounting integration exists, the accounting entry
 * must remain consistent with the tax payment.
 */
router.post(
  "/payments",
  requirePermission("tax.payment"),
  createTaxPayment,
);

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default router;
