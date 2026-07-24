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
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

/* =========================================================
   ACCOUNTS RECEIVABLE
========================================================= */

/*
 * GET /api/accounts-receivable
 * Get all receivables
 */
router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getReceivables
);

/*
 * POST /api/accounts-receivable
 * Create a receivable
 */
router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createReceivable
);

/*
 * PATCH /api/accounts-receivable/:id/approve
 * Approve a receivable
 *
 * IMPORTANT:
 * Keep this before /:id.
 */
router.patch(
  "/:id/approve",
  authenticate,
  authorize("SUPER_ADMIN"),
  approveReceivable
);

/*
 * POST /api/accounts-receivable/:id/payment
 * Record a customer payment
 */
router.post(
  "/:id/payment",
  authenticate,
  authorize("SUPER_ADMIN"),
  recordReceivablePayment
);

/*
 * GET /api/accounts-receivable/:id
 * Get one receivable
 */
router.get(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  getReceivableById
);

/*
 * PATCH /api/accounts-receivable/:id
 * Edit a receivable
 */
router.patch(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  updateReceivable
);

/*
 * DELETE /api/accounts-receivable/:id
 * Delete a receivable
 */
router.delete(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  deleteReceivable
);

export default router;