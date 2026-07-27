import express from "express";

import {
  getBankAccountSummary,
  getBankReconciliation,
  getCashPosition,
  getMpesaReport,
} from "../controllers/cashReports.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * CASH REPORTS
 * =========================================================
 *
 * All routes require:
 * reports.view
 *
 * OWNER automatically has access inside their organization.
 * =========================================================
 */

router.use(authenticate);
router.use(requirePermission("reports.view"));

router.get(
  "/cash-position",
  getCashPosition
);

router.get(
  "/bank-summary",
  getBankAccountSummary
);

router.get(
  "/bank-reconciliation",
  getBankReconciliation
);

router.get(
  "/mpesa",
  getMpesaReport
);

export default router;