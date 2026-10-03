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

import {
  getTaxConfiguration,
  createTaxRegime,
  updateTaxRegime,
  createTaxCode,
  updateTaxCode,
  createTaxRate,
  updateTaxRate,
  createTaxRule,
  updateTaxRule,
  createTaxAccountMapping,
  updateTaxAccountMapping,
  deactivateTaxAccountMapping,
  createTaxPeriod,
  updateTaxPeriodStatus,
  createOrRefreshTaxReturn,
  updateTaxReturnStatus,
  createFilingFromTaxReturn,
} from "../controllers/tax.configuration.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * TAX MANAGEMENT ROUTES
 * =========================================================
 *
 * All tax operations are:
 *
 * - authenticated
 * - tenant scoped
 * - permission controlled
 *
 * Tenant identity is obtained exclusively from the
 * authenticated organization context.
 *
 * The client cannot select another organization through:
 *
 * - organizationId
 * - organizationID
 * - orgId
 *
 * query parameters.
 *
 * Tax configuration and tax accounting data must always remain
 * isolated by organizationId.
 */

/**
 * =========================================================
 * TENANT OVERRIDE PROTECTION
 * =========================================================
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

  const hasTenantOverride = forbiddenParameters.some((parameter) =>
    Object.prototype.hasOwnProperty.call(req.query, parameter),
  );

  if (hasTenantOverride) {
    res.status(400).json({
      success: false,
      code: "TENANT_OVERRIDE_NOT_ALLOWED",
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
 * Every tax endpoint requires authentication.
 */
router.use(authenticate);

/**
 * =========================================================
 * TAX CONFIGURATION
 * =========================================================
 *
 * GET /api/tax/configuration
 *
 * Returns tenant-scoped:
 *
 * - tax regimes
 * - tax codes
 * - tax rates
 * - tax rules
 * - account mappings
 * - tax periods
 * - tax transactions
 * - tax returns
 * - ledger accounts
 */
router.get(
  "/configuration",
  requirePermission("tax.view"),
  rejectTenantOverride,
  getTaxConfiguration,
);

/**
 * =========================================================
 * TAX REGIMES
 * =========================================================
 */

router.post(
  "/regimes",
  requirePermission("tax.file"),
  createTaxRegime,
);

router.patch(
  "/regimes/:id",
  requirePermission("tax.file"),
  updateTaxRegime,
);

/**
 * =========================================================
 * TAX CODES
 * =========================================================
 */

router.post(
  "/codes",
  requirePermission("tax.file"),
  createTaxCode,
);

router.patch(
  "/codes/:id",
  requirePermission("tax.file"),
  updateTaxCode,
);

/**
 * =========================================================
 * TAX RATES
 * =========================================================
 *
 * Effective-dated tax rates.
 */
router.post(
  "/rates",
  requirePermission("tax.file"),
  createTaxRate,
);

router.patch(
  "/rates/:id",
  requirePermission("tax.file"),
  updateTaxRate,
);

/**
 * =========================================================
 * TAX RULES
 * =========================================================
 *
 * Rules determine which tax treatment/code applies to a
 * transaction.
 */
router.post(
  "/rules",
  requirePermission("tax.file"),
  createTaxRule,
);

router.patch(
  "/rules/:id",
  requirePermission("tax.file"),
  updateTaxRule,
);

/**
 * =========================================================
 * TAX ACCOUNT MAPPINGS
 * =========================================================
 *
 * Maps tax codes to the organization's chart of accounts.
 */
router.post(
  "/mappings",
  requirePermission("tax.file"),
  createTaxAccountMapping,
);

router.patch(
  "/mappings/:id",
  requirePermission("tax.file"),
  updateTaxAccountMapping,
);

router.delete(
  "/mappings/:id",
  requirePermission("tax.file"),
  deactivateTaxAccountMapping,
);

/**
 * =========================================================
 * TAX PERIODS
 * =========================================================
 *
 * Period lifecycle:
 *
 * OPEN
 *   ↓
 * UNDER_REVIEW
 *   ↓
 * READY_TO_FILE
 *   ↓
 * CLOSED
 *
 * The controller is responsible for validating legal
 * transitions and preventing changes to closed periods.
 */
router.post(
  "/periods",
  requirePermission("tax.file"),
  createTaxPeriod,
);

router.patch(
  "/periods/:id/status",
  requirePermission("tax.file"),
  updateTaxPeriodStatus,
);

/**
 * =========================================================
 * TAX RETURNS
 * =========================================================
 *
 * Returns are calculated from TaxTransaction records.
 *
 * This prevents users from simply entering arbitrary tax
 * totals and bypassing the tax engine.
 */
router.post(
  "/returns/calculate",
  requirePermission("tax.file"),
  createOrRefreshTaxReturn,
);

router.patch(
  "/returns/:id/status",
  requirePermission("tax.file"),
  updateTaxReturnStatus,
);

/**
 * =========================================================
 * CREATE FILING FROM TAX RETURN
 * =========================================================
 *
 * Filing is generated from an approved tax return.
 *
 * This preserves the chain:
 *
 * Tax Transactions
 *       ↓
 * Tax Period
 *       ↓
 * Tax Return
 *       ↓
 * Approval
 *       ↓
 * Tax Filing
 */
router.post(
  "/returns/:id/create-filing",
  requirePermission("tax.file"),
  createFilingFromTaxReturn,
);

/**
 * =========================================================
 * LEGACY / COMPATIBILITY TAX OBLIGATIONS
 * =========================================================
 *
 * Kept because the existing FOS tax controller and existing
 * Tax Management functionality still depend on these endpoints.
 */

/**
 * GET /api/tax/obligations
 */
router.get(
  "/obligations",
  requirePermission("tax.view"),
  rejectTenantOverride,
  listTaxObligations,
);

/**
 * =========================================================
 * LEGACY TAX FILINGS
 * =========================================================
 *
 * GET /api/tax/filings
 *
 * Existing filing records remain available for:
 *
 * - historical filings
 * - compatibility
 * - payment tracking
 * - existing reports
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
 * Existing endpoint retained for compatibility.
 *
 * New Tax Management UI should use:
 *
 * POST /api/tax/returns/:id/create-filing
 *
 * so that filings originate from calculated tax returns.
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
 */

/**
 * GET /api/tax/payments
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
 * Existing payment controller remains responsible for:
 *
 * - tenant validation
 * - filing validation
 * - duplicate protection
 * - payment amount validation
 * - payment status
 * - transaction integrity
 * - audit trail
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