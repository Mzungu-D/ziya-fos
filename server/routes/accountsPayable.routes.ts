import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  approvePayable,
  createPayable,
  deletePayable,
  getPayableById,
  getPayables,
  updatePayablePayment,
} from "../controllers/accountsPayable.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * ACCOUNTS PAYABLE ROUTES
 * =========================================================
 *
 * All payable operations are:
 *
 * - authenticated
 * - permission controlled
 * - tenant scoped
 *
 * Tenant identity is obtained exclusively from the authenticated
 * organization context. The client cannot select another
 * organization through route parameters or request bodies.
 *
 * Permissions:
 *
 *   accountsPayable.view
 *   accountsPayable.create
 *   accountsPayable.approve
 *   accountsPayable.payment
 *   accountsPayable.delete
 *
 * Accounting integrity remains in the controller/service layer.
 * This router is responsible for transport-level authentication,
 * authorization and safe route parameter validation.
 */

/**
 * =========================================================
 * PAYABLE ID VALIDATION
 * =========================================================
 *
 * This validates identifier shape only.
 * The controller/service must still verify that the payable
 * belongs to the authenticated organization.
 */
function validatePayableId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const payableId =
    typeof req.params.id === "string"
      ? req.params.id.trim()
      : "";

  if (!payableId) {
    res.status(400).json({
      success: false,
      message: "Payable ID is required.",
    });
    return;
  }

  if (payableId.length > 128) {
    res.status(400).json({
      success: false,
      message: "Invalid payable ID.",
    });
    return;
  }

  req.params.id = payableId;

  next();
}

/**
 * =========================================================
 * AUTHENTICATION
 * =========================================================
 *
 * Every Accounts Payable endpoint requires an authenticated
 * tenant member.
 */
router.use(authenticate);

/**
 * =========================================================
 * GET ALL PAYABLES
 * =========================================================
 *
 * GET /api/accounts-payable
 *
 * The controller is responsible for:
 *
 * - tenant isolation
 * - pagination
 * - search/filtering
 * - status filtering
 * - due-date filtering
 * - deterministic ordering
 * - safe financial aggregation
 */
router.get(
  "/",
  requirePermission("accountsPayable.view"),
  getPayables,
);

/**
 * =========================================================
 * GET ONE PAYABLE
 * =========================================================
 *
 * GET /api/accounts-payable/:id
 *
 * The controller/service MUST verify tenant ownership before
 * returning the payable or any related financial information.
 */
router.get(
  "/:id",
  requirePermission("accountsPayable.view"),
  validatePayableId,
  getPayableById,
);

/**
 * =========================================================
 * CREATE PAYABLE
 * =========================================================
 *
 * POST /api/accounts-payable
 *
 * The accounting layer is responsible for:
 *
 * - tenant ownership
 * - vendor validation
 * - invoice/reference uniqueness
 * - amount validation
 * - due-date validation
 * - currency validation
 * - transaction atomicity
 * - audit logging
 *
 * Creation must not create financial records in another tenant.
 */
router.post(
  "/",
  requirePermission("accountsPayable.create"),
  createPayable,
);

/**
 * =========================================================
 * APPROVE PAYABLE
 * =========================================================
 *
 * PATCH /api/accounts-payable/:id/approve
 *
 * Approval is a controlled workflow transition.
 *
 * The accounting layer must verify the current payable state
 * and prevent invalid or duplicate approvals.
 */
router.patch(
  "/:id/approve",
  requirePermission("accountsPayable.approve"),
  validatePayableId,
  approvePayable,
);

/**
 * =========================================================
 * RECORD / UPDATE PAYMENT
 * =========================================================
 *
 * PATCH /api/accounts-payable/:id/payment
 *
 * Payment processing must remain transactional and tenant
 * scoped.
 *
 * The accounting layer is responsible for:
 *
 * - preventing overpayment
 * - preventing payment against cancelled/deleted records
 * - duplicate payment-reference protection
 * - correct outstanding-balance calculation
 * - accounting journal integration where configured
 * - audit logging
 */
router.patch(
  "/:id/payment",
  requirePermission("accountsPayable.payment"),
  validatePayableId,
  updatePayablePayment,
);

/**
 * =========================================================
 * DELETE PAYABLE
 * =========================================================
 *
 * DELETE /api/accounts-payable/:id
 *
 * Destructive deletion must be rejected by the controller/service
 * where accounting history or payment activity exists.
 *
 * Posted financial history must not be silently destroyed.
 * Where appropriate, the accounting layer should use a controlled
 * cancellation/void workflow instead.
 */
router.delete(
  "/:id",
  requirePermission("accountsPayable.delete"),
  validatePayableId,
  deletePayable,
);

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default router;
