import express from "express";

import {
  createAccount,
  getAccounts,
  getAccount,
  updateAccount,
  deleteAccount,
} from "../controllers/account.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * CHART OF ACCOUNTS ROUTES
 * =========================================================
 *
 * Tenant-aware RBAC permissions:
 *
 * account.view
 * account.create
 * account.update
 * account.delete
 *
 * OWNER has full access inside their own organization.
 * Other members require the relevant permission.
 * =========================================================
 */

/**
 * GET ALL ACCOUNTS
 */
router.get(
  "/",
  authenticate,
  requirePermission("account.view"),
  getAccounts
);

/**
 * GET ONE ACCOUNT
 */
router.get(
  "/:id",
  authenticate,
  requirePermission("account.view"),
  getAccount
);

/**
 * CREATE ACCOUNT
 */
router.post(
  "/",
  authenticate,
  requirePermission("account.create"),
  createAccount
);

/**
 * UPDATE ACCOUNT
 */
router.put(
  "/:id",
  authenticate,
  requirePermission("account.update"),
  updateAccount
);

/**
 * DELETE ACCOUNT
 */
router.delete(
  "/:id",
  authenticate,
  requirePermission("account.delete"),
  deleteAccount
);

export default router;