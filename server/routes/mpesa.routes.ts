import express from "express";

import {
  stkPush,
  c2bPayment,
  b2cPayment,
  bulkB2CPayment,
  b2bPayment,
  mpesaCallback,
  getTransactions,
  getTransactionById,
  getPaymentBatches,
  getPaymentBatchById,
} from "../controllers/mpesa.controller";

import { authenticate } from "../middleware/auth.middleware";

import {
  requirePermission,
} from "../middleware/permission.middleware";

const router =
  express.Router();

/* =========================================================
   PUBLIC SAFARICOM CALLBACK
========================================================= */

router.post(
  "/callback",
  mpesaCallback,
);

/* =========================================================
   PROTECTED ROUTES
========================================================= */

router.use(authenticate);

/* =========================================================
   TRANSACTIONS
========================================================= */

router.get(
  "/transactions",
  requirePermission("mpesa.view"),
  getTransactions,
);

router.get(
  "/transactions/:id",
  requirePermission("mpesa.view"),
  getTransactionById,
);

/* =========================================================
   PAYMENT BATCHES
========================================================= */

router.get(
  "/batches",
  requirePermission("mpesa.view"),
  getPaymentBatches,
);

router.get(
  "/batches/:id",
  requirePermission("mpesa.view"),
  getPaymentBatchById,
);

/* =========================================================
   STK
========================================================= */

router.post(
  "/stk-push",
  requirePermission("mpesa.create"),
  stkPush,
);

/* =========================================================
   C2B
========================================================= */

router.post(
  "/c2b",
  requirePermission("mpesa.create"),
  c2bPayment,
);

/* =========================================================
   SINGLE B2C
========================================================= */

router.post(
  "/b2c",
  requirePermission("mpesa.create"),
  b2cPayment,
);

/* =========================================================
   BULK B2C

   Multiple phone numbers.
   Each recipient can have a different amount.
========================================================= */

router.post(
  "/b2c/bulk",
  requirePermission("mpesa.create"),
  bulkB2CPayment,
);

/* =========================================================
   B2B
========================================================= */

router.post(
  "/b2b",
  requirePermission("mpesa.create"),
  b2bPayment,
);

export default router;