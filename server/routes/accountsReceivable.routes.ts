import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  approveReceivable,
  createReceivable,
  deleteReceivable,
  getReceivableById,
  getReceivables,
  recordReceivablePayment,
  updateReceivable,
} from "../controllers/accountsReceivable.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * ACCOUNTS RECEIVABLE ROUTES
 * =========================================================
 *
 * All Accounts Receivable operations are:
 *
 * - authenticated
 * - permission controlled
 * - tenant scoped
 *
 * Tenant identity comes exclusively from the authenticated
 * organization context. The client cannot select another
 * organization through a route parameter or request body.
 *
 * Permissions:
 *
 *   accountsReceivable.view
 *   accountsReceivable.create
 *   accountsReceivable.update
 *   accountsReceivable.approve
 *   accountsReceivable.payment
 *   accountsReceivable.delete
 *
 * Accounting integrity belongs to the controller/service layer.
 * This router is responsible for authentication, authorization,
 * safe route matching and identifier validation.
 */

/**
 * =========================================================
 * RECEIVABLE ID VALIDATION
 * =========================================================
 *
 * Validates identifier shape before the request reaches the
 * accounting controller.
 *
 * This does NOT replace tenant ownership validation. The
 * controller/service must verify that the receivable belongs
 * to the authenticated organization.
 */
function validateReceivableId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const receivableId =
    typeof req.params.id === "string"
      ? req.params.id.trim()
      : "";

  if (!receivableId) {
    res.status(400).json({
      success: false,
      message: "Receivable ID is required.",
    });
    return;
  }

  if (receivableId.length > 128) {
    res.status(400).json({
      success: false,
      message: "Invalid receivable ID.",
    });
    return;
  }

  req.params.id = receivableId;

  next();
}

/**
 * =========================================================
 * AUTHENTICATION
 * =========================================================
 *
 * Every Accounts Receivable endpoint requires an authenticated
 * tenant member.
 */
router.use(authenticate);

/**
 * =========================================================
 * GET ALL RECEIVABLES
 * =========================================================
 *
 * GET /api/accounts-receivable
 *
 * The controller is responsible for:
 *
 * - tenant isolation
 * - pagination
 * - search/filtering
 * - status filtering
 * - customer filtering
 * - due-date filtering
 * - deterministic ordering
 * - safe financial aggregation
 */
router.get(
  "/",
  requirePermission("accountsReceivable.view"),
  getReceivables,
);

/**
 * =========================================================
 * CREATE RECEIVABLE
 * =========================================================
 *
 * POST /api/accounts-receivable
 *
 * The accounting layer is responsible for:
 *
 * - tenant ownership
 * - customer validation
 * - invoice/reference uniqueness
 * - amount validation
 * - due-date validation
 * - currency validation
 * - transaction atomicity
 * - audit logging
 * - correct accounting integration
 */
router.post(
  "/",
  requirePermission("accountsReceivable.create"),
  createReceivable,
);

/**
 * =========================================================
 * APPROVE RECEIVABLE
 * =========================================================
 *
 * PATCH /api/accounts-receivable/:id/approve
 *
 * This route intentionally appears before /:id.
 *
 * Approval is a controlled workflow transition. The accounting
 * layer must validate the current state and reject duplicate,
 * invalid or unauthorized state transitions.
 */
router.patch(
  "/:id/approve",
  requirePermission("accountsReceivable.approve"),
  validateReceivableId,
  approveReceivable,
);

/**
 * =========================================================
 * RECORD CUSTOMER PAYMENT
 * =========================================================
 *
 * POST /api/accounts-receivable/:id/payment
 *
 * Payment processing must be tenant-scoped and transactional.
 *
 * The accounting layer is responsible for:
 *
 * - preventing overpayment
 * - preventing payment against cancelled/void records
 * - duplicate payment-reference protection
 * - correct outstanding-balance calculation
 * - journal integration
 * - audit logging
 */
router.post(
  "/:id/payment",
  requirePermission("accountsReceivable.payment"),
  validateReceivableId,
  recordReceivablePayment,
);

/**
 * =========================================================
 * GET ONE RECEIVABLE
 * =========================================================
 *
 * GET /api/accounts-receivable/:id
 *
 * The controller/service MUST verify tenant ownership before
 * returning the receivable or related financial information.
 */
router.get(
  "/:id",
  requirePermission("accountsReceivable.view"),
  validateReceivableId,
  getReceivableById,
);

/**
 * =========================================================
 * UPDATE RECEIVABLE
 * =========================================================
 *
 * PATCH /api/accounts-receivable/:id
 *
 * The accounting layer must protect posted/accounted history
 * from unsafe mutation and enforce valid workflow transitions.
 */
router.patch(
  "/:id",
  requirePermission("accountsReceivable.update"),
  validateReceivableId,
  updateReceivable,
);

/**
 * =========================================================
 * DELETE RECEIVABLE
 * =========================================================
 *
 * DELETE /api/accounts-receivable/:id
 *
 * Destructive deletion must be rejected where accounting history,
 * payments or posted journal activity exists.
 *
 * Where appropriate, the accounting layer should use controlled
 * void/write-off workflows instead of destroying financial history.
 */
router.delete(
  "/:id",
  requirePermission("accountsReceivable.delete"),
  validateReceivableId,
  deleteReceivable,
);

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default router;
