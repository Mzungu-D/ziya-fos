import express from "express";

import {
  getRecentTransactions,
} from "../controllers/dashboard.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  requirePermission,
} from "../middleware/permission.middleware";

/**
 * =========================================================
 * DASHBOARD ROUTES
 * =========================================================
 *
 * Base path:
 *
 * /api/dashboard
 *
 * Current endpoints:
 *
 * GET /api/dashboard/recent-transactions
 *
 * All routes are authenticated and permission controlled.
 *
 * =========================================================
 */

const router = express.Router();

/**
 * ---------------------------------------------------------
 * RECENT TRANSACTIONS
 * ---------------------------------------------------------
 *
 * Returns the latest effective accounting transactions
 * belonging to the authenticated tenant.
 *
 * Permission:
 * reports.view
 */
router.get(
  "/recent-transactions",
  authenticate,
  requirePermission("reports.view"),
  getRecentTransactions
);

export default router;