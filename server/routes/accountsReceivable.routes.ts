import express from "express";

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
 * Tenant-aware RBAC permissions:
 *
 * accountsReceivable.view
 * accountsReceivable.create
 * accountsReceivable.update
 * accountsReceivable.approve
 * accountsReceivable.payment
 * accountsReceivable.delete
 *
 * OWNER has full access inside their own organization.
 * Other members require the relevant permission.
 * =========================================================
 */

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(authenticate);

/* =========================================================
   GET ALL RECEIVABLES
========================================================= */

router.get(
  "/",
  requirePermission("accountsReceivable.view"),
  getReceivables
);

/* =========================================================
   CREATE RECEIVABLE
========================================================= */

router.post(
  "/",
  requirePermission("accountsReceivable.create"),
  createReceivable
);

/* =========================================================
   APPROVE RECEIVABLE

   IMPORTANT:
   Keep this before /:id.
========================================================= */

router.patch(
  "/:id/approve",
  requirePermission("accountsReceivable.approve"),
  approveReceivable
);

/* =========================================================
   RECORD CUSTOMER PAYMENT
========================================================= */

router.post(
  "/:id/payment",
  requirePermission("accountsReceivable.payment"),
  recordReceivablePayment
);

/* =========================================================
   GET ONE RECEIVABLE
========================================================= */

router.get(
  "/:id",
  requirePermission("accountsReceivable.view"),
  getReceivableById
);

/* =========================================================
   UPDATE RECEIVABLE
========================================================= */

router.patch(
  "/:id",
  requirePermission("accountsReceivable.update"),
  updateReceivable
);

/* =========================================================
   DELETE RECEIVABLE
========================================================= */

router.delete(
  "/:id",
  requirePermission("accountsReceivable.delete"),
  deleteReceivable
);

/* =========================================================
   EXPORT
========================================================= */

export default router;