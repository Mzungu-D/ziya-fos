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

import {
  requirePermission,
} from "../middleware/permission.middleware";

const router =
  express.Router();

/* =========================================================
   PUBLIC M-PESA CALLBACK
========================================================= */

/*
 * Safaricom must be able to call this endpoint without
 * a Ziya user JWT.
 */

router.post(
  "/callback",
  mpesaCallback
);

/* =========================================================
   PROTECTED M-PESA ROUTES
========================================================= */

router.use(
  authenticate
);

/* =========================================================
   TRANSACTIONS
========================================================= */

router.get(
  "/transactions",
  requirePermission(
    "mpesa.view"
  ),
  getTransactions
);

router.get(
  "/transactions/:id",
  requirePermission(
    "mpesa.view"
  ),
  getTransactionById
);

/* =========================================================
   STK PUSH
========================================================= */

router.post(
  "/stk-push",
  requirePermission(
    "mpesa.create"
  ),
  stkPush
);

/* =========================================================
   C2B
========================================================= */

router.post(
  "/c2b",
  requirePermission(
    "mpesa.create"
  ),
  c2bPayment
);

/* =========================================================
   B2C
========================================================= */

router.post(
  "/b2c",
  requirePermission(
    "mpesa.create"
  ),
  b2cPayment
);

/* =========================================================
   B2B
========================================================= */

router.post(
  "/b2b",
  requirePermission(
    "mpesa.create"
  ),
  b2bPayment
);

/* =========================================================
   EXPORT
========================================================= */

export default router;