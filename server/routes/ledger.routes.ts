import express from "express";

import {
  getAllLedger,
  getLedger,
} from "../controllers/ledger.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * GENERAL LEDGER ROUTES
 * =========================================================
 *
 * Tenant security:
 * - Authentication identifies the user + organization.
 * - Permission middleware verifies active membership.
 * - Access is controlled per organization.
 * - No SUPER_ADMIN restriction.
 */

/**
 * GET FULL GENERAL LEDGER
 *
 * Permission:
 * ledger.view
 */
router.get(
  "/",
  authenticate,
  requirePermission("ledger.view"),
  getAllLedger
);

/**
 * GET LEDGER FOR SPECIFIC ACCOUNT
 *
 * Permission:
 * ledger.view
 */
router.get(
  "/:accountId",
  authenticate,
  requirePermission("ledger.view"),
  getLedger
);

export default router;