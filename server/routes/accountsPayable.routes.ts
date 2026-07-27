import express from "express";

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
 * Tenant-aware RBAC permissions:
 *
 * accountsPayable.view
 * accountsPayable.create
 * accountsPayable.approve
 * accountsPayable.payment
 * accountsPayable.delete
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
   GET ALL PAYABLES
========================================================= */

router.get(
  "/",
  requirePermission("accountsPayable.view"),
  getPayables
);

/* =========================================================
   GET ONE PAYABLE
========================================================= */

router.get(
  "/:id",
  requirePermission("accountsPayable.view"),
  getPayableById
);

/* =========================================================
   CREATE PAYABLE
========================================================= */

router.post(
  "/",
  requirePermission("accountsPayable.create"),
  createPayable
);

/* =========================================================
   APPROVE PAYABLE
========================================================= */

router.patch(
  "/:id/approve",
  requirePermission("accountsPayable.approve"),
  approvePayable
);

/* =========================================================
   RECORD / UPDATE PAYMENT
========================================================= */

router.patch(
  "/:id/payment",
  requirePermission("accountsPayable.payment"),
  updatePayablePayment
);

/* =========================================================
   DELETE PAYABLE
========================================================= */

router.delete(
  "/:id",
  requirePermission("accountsPayable.delete"),
  deletePayable
);

/* =========================================================
   EXPORT
========================================================= */

export default router;