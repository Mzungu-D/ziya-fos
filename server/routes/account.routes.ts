import express from "express";

import {
  createAccount,
  getAccounts,
  getAccount,
  updateAccount,
  deleteAccount,
  initializeDefaultChartOfAccounts,
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
 * =========================================================
 * INITIALIZE STANDARD CHART
 * =========================================================
 *
 * IMPORTANT:
 * This route MUST appear before /:id.
 *
 * GET /api/accounts is strictly READ ONLY.
 *
 * Standard accounts are created only when an
 * authenticated tenant explicitly requests them.
 *
 * Endpoint:
 *
 * POST /api/accounts/initialize-defaults
 *
 * Permission:
 *
 * account.create
 * =========================================================
 */
router.post(
  "/initialize-defaults",
  authenticate,
  requirePermission("account.create"),
  initializeDefaultChartOfAccounts
);

/**
 * =========================================================
 * GET ALL ACCOUNTS
 * =========================================================
 *
 * GET /api/accounts
 *
 * This endpoint:
 * - Reads accounts
 * - Applies tenant isolation
 * - Supports pagination
 * - Supports search
 * - Supports type filtering
 * - Supports parent/subaccount filtering
 *
 * IMPORTANT:
 * This endpoint NEVER creates accounts.
 * =========================================================
 */
router.get(
  "/",
  authenticate,
  requirePermission("account.view"),
  getAccounts
);

/**
 * =========================================================
 * GET ONE ACCOUNT
 * =========================================================
 *
 * GET /api/accounts/:id
 *
 * The controller verifies that the account belongs
 * to the authenticated user's organization.
 * =========================================================
 */
router.get(
  "/:id",
  authenticate,
  requirePermission("account.view"),
  getAccount
);

/**
 * =========================================================
 * CREATE ACCOUNT
 * =========================================================
 *
 * POST /api/accounts
 *
 * Creates a custom account inside the authenticated
 * user's organization.
 * =========================================================
 */
router.post(
  "/",
  authenticate,
  requirePermission("account.create"),
  createAccount
);

/**
 * =========================================================
 * UPDATE ACCOUNT
 * =========================================================
 *
 * PUT /api/accounts/:id
 * =========================================================
 */
router.put(
  "/:id",
  authenticate,
  requirePermission("account.update"),
  updateAccount
);

/**
 * =========================================================
 * DELETE ACCOUNT
 * =========================================================
 *
 * DELETE /api/accounts/:id
 * =========================================================
 */
router.delete(
  "/:id",
  authenticate,
  requirePermission("account.delete"),
  deleteAccount
);

export default router;