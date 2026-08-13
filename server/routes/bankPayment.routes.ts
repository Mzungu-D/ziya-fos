import express from "express";

import {
  createBankPaymentController,
  createBankPaymentBatchController,
  getBankPaymentController,
  getBankPaymentBatchController,
  listBankPaymentsController,
} from "../controllers/bankPayment.controller";

import { authenticate } from "../middleware/auth.middleware";
import {
  requirePermission,
} from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(authenticate);

/* =========================================================
   LIST BANK PAYMENTS
   GET /api/bank-payments
========================================================= */

router.get(
  "/",
  requirePermission("bankPayment.view"),
  listBankPaymentsController
);

/* =========================================================
   CREATE SINGLE BANK PAYMENT
   POST /api/bank-payments
========================================================= */

router.post(
  "/",
  requirePermission("bankPayment.create"),
  createBankPaymentController
);

/* =========================================================
   CREATE BANK PAYMENT BATCH
   POST /api/bank-payments/batches
========================================================= */

router.post(
  "/batches",
  requirePermission("bankPayment.create"),
  createBankPaymentBatchController
);

/* =========================================================
   GET BANK PAYMENT BATCH
   GET /api/bank-payments/batches/:batchId
========================================================= */

router.get(
  "/batches/:batchId",
  requirePermission("bankPayment.view"),
  getBankPaymentBatchController
);

/* =========================================================
   GET SINGLE BANK PAYMENT
   GET /api/bank-payments/:paymentId
========================================================= */

router.get(
  "/:paymentId",
  requirePermission("bankPayment.view"),
  getBankPaymentController
);

export default router;