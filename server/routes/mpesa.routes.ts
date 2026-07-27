import express from "express";

import {
  stkPush,
  c2bPayment,
  b2cPayment,
  b2bPayment,
  mpesaCallback,
  getTransactions,
  getTransactionById,
} from "../controllers/mpesa.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   PUBLIC CALLBACK

   Safaricom must be able to reach this endpoint without
   a Ziya user JWT.
========================================================= */

router.post(
  "/callback",
  mpesaCallback
);

/* =========================================================
   PROTECTED M-PESA ROUTES
========================================================= */

router.use(authenticate);

router.get(
  "/transactions",
  requirePermission("mpesa.view"),
  getTransactions
);

router.get(
  "/transactions/:id",
  requirePermission("mpesa.view"),
  getTransactionById
);

router.post(
  "/stk-push",
  requirePermission("mpesa.create"),
  stkPush
);

router.post(
  "/c2b",
  requirePermission("mpesa.create"),
  c2bPayment
);

router.post(
  "/b2c",
  requirePermission("mpesa.create"),
  b2cPayment
);

router.post(
  "/b2b",
  requirePermission("mpesa.create"),
  b2bPayment
);

export default router;