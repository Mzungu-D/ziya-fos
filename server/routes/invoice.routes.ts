import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  createInvoice,
  updateInvoice,
  finalizeInvoice,
  getInvoices,
  getInvoiceById,
  deleteInvoice,
  voidInvoice,
  getInvoiceStats,
} from "../controllers/invoice.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * INVOICE ROUTES
 * =========================================================
 *
 * All invoice operations are:
 *
 * - authenticated
 * - permission controlled
 * - tenant scoped
 *
 * Tenant identity is obtained exclusively from the authenticated
 * organization context. The client must never be able to select
 * another organization through a route parameter or request body.
 *
 * Permissions:
 *
 *   invoice.view
 *   invoice.create
 *   invoice.edit
 *   invoice.post
 *   invoice.void
 *   invoice.delete
 *
 * Invoice lifecycle:
 *
 *   DRAFT
 *      |
 *      v
 *   FINALIZE
 *      |
 *      +--> Accounts Receivable
 *      |
 *      +--> General Ledger
 *      |
 *      +--> Audit Trail
 *      |
 *      v
 *   POSTED
 *      |
 *      v
 *   VOID
 *
 * Posted invoices are not deleted. Voiding is a controlled
 * accounting reversal workflow.
 *
 * Accounting integrity belongs to the controller/service layer:
 *
 * - tenant ownership
 * - customer validation
 * - invoice numbering
 * - line validation
 * - tax calculation
 * - currency validation
 * - journal balancing
 * - AR synchronization
 * - duplicate-post protection
 * - reversal handling
 * - audit logging
 * - transaction atomicity
 */

/**
 * =========================================================
 * INVOICE ID VALIDATION
 * =========================================================
 *
 * Validates identifier shape before the request reaches the
 * accounting controller.
 *
 * This does NOT replace tenant ownership validation.
 */
function validateInvoiceId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const invoiceId =
    typeof req.params.id === "string"
      ? req.params.id.trim()
      : "";

  if (!invoiceId) {
    res.status(400).json({
      success: false,
      message: "Invoice ID is required.",
    });
    return;
  }

  if (invoiceId.length > 128) {
    res.status(400).json({
      success: false,
      message: "Invalid invoice ID.",
    });
    return;
  }

  req.params.id = invoiceId;

  next();
}

/**
 * =========================================================
 * TENANT OVERRIDE PROTECTION
 * =========================================================
 *
 * Tenant selection must come from the authenticated session.
 * Report/list queries must never allow a caller to select a
 * different organization through query parameters.
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
        "Organization selection is not accepted through invoice query parameters.",
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
 * Every invoice endpoint requires an authenticated tenant
 * member.
 */
router.use(authenticate);

/**
 * =========================================================
 * INVOICE DASHBOARD / STATISTICS
 * =========================================================
 *
 * GET /api/invoices/stats
 *
 * Read-only invoice statistics.
 */
router.get(
  "/stats",
  requirePermission("invoice.view"),
  rejectTenantOverride,
  getInvoiceStats,
);

/**
 * =========================================================
 * LIST INVOICES
 * =========================================================
 *
 * GET /api/invoices
 *
 * Supported filters are handled by the controller, including:
 *
 * - page
 * - pageSize
 * - search
 * - status
 * - paymentStatus
 *
 * The controller must apply tenant isolation to every query.
 */
router.get(
  "/",
  requirePermission("invoice.view"),
  rejectTenantOverride,
  getInvoices,
);

/**
 * =========================================================
 * GET SINGLE INVOICE
 * =========================================================
 *
 * GET /api/invoices/:id
 *
 * The controller/service MUST verify invoice ownership against
 * the authenticated organization before returning any invoice,
 * customer, tax or accounting information.
 */
router.get(
  "/:id",
  requirePermission("invoice.view"),
  validateInvoiceId,
  getInvoiceById,
);

/**
 * =========================================================
 * CREATE DRAFT INVOICE
 * =========================================================
 *
 * POST /api/invoices
 *
 * Creates a tenant-owned draft invoice.
 *
 * The accounting layer is responsible for:
 *
 * - customer ownership
 * - invoice number generation
 * - line validation
 * - tax validation
 * - currency validation
 * - totals
 * - duplicate protection
 * - transaction atomicity
 * - audit logging
 */
router.post(
  "/",
  requirePermission("invoice.create"),
  createInvoice,
);

/**
 * =========================================================
 * UPDATE DRAFT INVOICE
 * =========================================================
 *
 * PATCH /api/invoices/:id
 *
 * Only eligible draft invoices may be modified.
 *
 * Posted invoices must be protected from destructive mutation.
 */
router.patch(
  "/:id",
  requirePermission("invoice.edit"),
  validateInvoiceId,
  updateInvoice,
);

/**
 * =========================================================
 * FINALIZE / POST INVOICE
 * =========================================================
 *
 * POST /api/invoices/:id/finalize
 *
 * Draft
 *   ↓
 * Accounts Receivable
 *   +
 * General Ledger
 *   +
 * Audit Trail
 *
 * The controller/service must perform the entire operation
 * transactionally and must prevent duplicate posting.
 */
router.post(
  "/:id/finalize",
  requirePermission("invoice.post"),
  validateInvoiceId,
  finalizeInvoice,
);

/**
 * =========================================================
 * VOID POSTED INVOICE
 * =========================================================
 *
 * POST /api/invoices/:id/void
 *
 * Voiding is an accounting correction workflow.
 *
 * The original invoice must remain preserved. The accounting
 * layer is responsible for creating the appropriate reversal,
 * preventing duplicate voids and maintaining the audit trail.
 */
router.post(
  "/:id/void",
  requirePermission("invoice.void"),
  validateInvoiceId,
  voidInvoice,
);

/**
 * =========================================================
 * DELETE DRAFT INVOICE
 * =========================================================
 *
 * DELETE /api/invoices/:id
 *
 * Destructive deletion is delegated to the controller/service.
 *
 * Posted/accounted invoices must not be silently deleted.
 * Where financial history exists, controlled void/reversal
 * workflows must be used instead.
 */
router.delete(
  "/:id",
  requirePermission("invoice.delete"),
  validateInvoiceId,
  deleteInvoice,
);

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default router;
