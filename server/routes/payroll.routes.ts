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

/*
 * Every payroll endpoint requires an authenticated user.
 */
router.use(authenticate);

/* =========================================================
   VIEW PAYROLL
   ========================================================= */

/*
 * GET /api/payroll
 *
 * View payroll periods and payroll records.
 */
router.get(
  "/",
  requirePermission("payroll.view"),
  getPayroll
);

/* =========================================================
   VIEW INDIVIDUAL PAYSLIP
   ========================================================= */

/*
 * GET /api/payroll/:id/payslip
 *
 * Here :id is the PayrollRecord ID, NOT the PayrollPeriod ID.
 *
 * The controller additionally verifies that the payroll record
 * belongs to the authenticated tenant organization.
 */
router.get(
  "/:id/payslip",
  requirePermission("payroll.view"),
  getPayslip
);

/* =========================================================
   VIEW PAYROLL PERIOD
   ========================================================= */

/*
 * GET /api/payroll/:id
 *
 * Here :id is the PayrollPeriod ID.
 */
router.get(
  "/:id",
  requirePermission("payroll.view"),
  getPayrollPeriod
);

/* =========================================================
   RUN PAYROLL
   ========================================================= */

/*
 * POST /api/payroll/run
 *
 * Processing payroll requires the separate payroll.run
 * permission.
 */
router.post(
  "/run",
  requirePermission("payroll.run"),
  runPayroll
);

/* =========================================================
   EXPORT
   ========================================================= */

export default router;