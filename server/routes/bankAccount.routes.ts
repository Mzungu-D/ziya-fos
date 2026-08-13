import express from "express";

import {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  updateBankAccount,
  testBankAccountConnection,
} from "../controllers/bankAccount.controller";

import { authenticate } from "../middleware/auth.middleware";
import {
  requirePermission,
} from "../middleware/permission.middleware";

const router =
  express.Router();

/*
 * Every bank operation requires:
 *
 * 1. Authentication
 * 2. Tenant session
 * 3. Active organization membership
 * 4. Appropriate tenant permission
 *
 * requirePermission() already enforces
 * the tenant boundary.
 */
router.use(authenticate);

/* =========================================================
   LIST BANK ACCOUNTS
========================================================= */

router.get(
  "/",
  requirePermission(
    "bankAccount.view"
  ),
  getBankAccounts
);

/* =========================================================
   CREATE BANK ACCOUNT
========================================================= */

router.post(
  "/",
  requirePermission(
    "bankAccount.create"
  ),
  createBankAccount
);

/* =========================================================
   GET BANK ACCOUNT
========================================================= */

router.get(
  "/:id",
  requirePermission(
    "bankAccount.view"
  ),
  getBankAccountById
);

/* =========================================================
   UPDATE BANK ACCOUNT
========================================================= */

router.patch(
  "/:id",
  requirePermission(
    "bankAccount.update"
  ),
  updateBankAccount
);

/*
 * PUT is also supported for clients that use
 * conventional REST replacement semantics.
 *
 * The controller still performs a partial update.
 */
router.put(
  "/:id",
  requirePermission(
    "bankAccount.update"
  ),
  updateBankAccount
);

/* =========================================================
   TEST BANK CONNECTION
========================================================= */

router.post(
  "/:id/test-connection",
  requirePermission(
    "bankAccount.update"
  ),
  testBankAccountConnection
);

export default router;