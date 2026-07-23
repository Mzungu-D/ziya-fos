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
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

/* =========================================================
   SECURITY
========================================================= */

router.use(authenticate);
router.use(authorize("SUPER_ADMIN"));

/* =========================================================
   ACCOUNTS PAYABLE
========================================================= */

/**
 * GET
 * /api/accounts-payable
 *
 * Get all supplier bills.
 */
router.get(
  "/",
  getPayables
);

/**
 * GET
 * /api/accounts-payable/:id
 *
 * Get a single supplier bill.
 */
router.get(
  "/:id",
  getPayableById
);

/**
 * POST
 * /api/accounts-payable
 *
 * Create a supplier bill.
 */
router.post(
  "/",
  createPayable
);

/**
 * PATCH
 * /api/accounts-payable/:id/approve
 *
 * Approve a supplier bill.
 */
router.patch(
  "/:id/approve",
  approvePayable
);

/**
 * PATCH
 * /api/accounts-payable/:id/payment
 *
 * Record a payment against an approved bill.
 */
router.patch(
  "/:id/payment",
  updatePayablePayment
);

/**
 * DELETE
 * /api/accounts-payable/:id
 *
 * Delete an unapproved bill with no payments.
 */
router.delete(
  "/:id",
  deletePayable
);

/* =========================================================
   EXPORT
========================================================= */

export default router;