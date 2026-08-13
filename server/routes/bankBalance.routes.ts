import express from "express";

import {
  syncBankAccountBalanceController,
  syncOrganizationBankBalancesController,
} from "../controllers/bankBalance.controller";

import { authenticate } from "../middleware/auth.middleware";

import {
  requirePermission,
} from "../middleware/permission.middleware";

const router =
  express.Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(authenticate);

/* =========================================================
   SYNC ALL ORGANIZATION BANK BALANCES
========================================================= */

router.post(
  "/sync",
  requirePermission(
    "bankAccount.view"
  ),
  syncOrganizationBankBalancesController
);

/* =========================================================
   SYNC ONE BANK ACCOUNT
========================================================= */

router.post(
  "/:id/sync",
  requirePermission(
    "bankAccount.view"
  ),
  syncBankAccountBalanceController
);

export default router;