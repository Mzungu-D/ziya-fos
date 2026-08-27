import express from "express";

import {
  getPayroll,
  getPayrollPeriod,
  getPayslip,
  runPayroll,
} from "../controllers/payroll.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   PAYROLL ROUTES
   ========================================================= */

router.use(authenticate);

/*
 * View payroll periods and payroll records.
 */
router.get(
  "/",
  requirePermission("payroll.view"),
  getPayroll
);

/*
 * View a specific payroll period.
 */
router.get(
  "/:id",
  requirePermission("payroll.view"),
  getPayrollPeriod
);

/*
 * View an individual employee payslip.
 *
 * Example:
 * GET /api/payroll/:payrollRecordId/payslip
 */
router.get(
  "/:id/payslip",
  requirePermission("payroll.view"),
  getPayslip
);

/*
 * Process/run payroll.
 */
router.post(
  "/run",
  requirePermission("payroll.run"),
  runPayroll
);

export default router;