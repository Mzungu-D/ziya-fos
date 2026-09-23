import express from "express";

import {
  createEmployee,
  getEmployee,
  getEmployees,
  getEmployeeStats,
  getEmployeeHierarchy,
  updateEmployee,
  deleteEmployee,

  /* Employee earnings */
  getEmployeeEarnings,
  createEmployeeEarning,
  updateEmployeeEarning,
  deleteEmployeeEarning,

  /* Employee loans */
  getEmployeeLoans,
  createEmployeeLoan,
  updateEmployeeLoan,
  deleteEmployeeLoan,

  /* Salary advances */
  getEmployeeSalaryAdvances,
  createEmployeeSalaryAdvance,
  updateEmployeeSalaryAdvance,
  deleteEmployeeSalaryAdvance,
} from "../controllers/employee.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

/* =========================================================
   AUTHENTICATION

   Every employee endpoint requires an authenticated user.

   The employee controller additionally requires a valid
   TENANT session and scopes all database operations to
   the authenticated organization.
========================================================= */

router.use(authenticate);

/* =========================================================
   EMPLOYEE STATISTICS

   IMPORTANT:
   Keep this before /:id so "stats" is not interpreted
   as an employee ID.

   GET /api/employees/stats
========================================================= */

router.get(
  "/stats",
  getEmployeeStats
);

/* =========================================================
   EMPLOYEE DIRECTORY

   Supports:
   - pagination
   - search
   - department filtering
   - status filtering

   GET /api/employees
========================================================= */

router.get(
  "/",
  getEmployees
);

/* =========================================================
   REPORTING STRUCTURE

   IMPORTANT:
   Keep this before /:id so "hierarchy" is not interpreted
   as an employee ID.

   GET /api/employees/hierarchy
========================================================= */

router.get(
  "/hierarchy",
  getEmployeeHierarchy
);

/* =========================================================
   EMPLOYEE EARNINGS / COMPENSATION

   HR maintains employee earnings here.

   Examples:
   - Housing Allowance
   - Transport Allowance
   - Communication Allowance
   - Medical Allowance
   - Responsibility Allowance
   - Commission
   - Bonus
   - Overtime
   - Other Earnings

   Payroll reads active earnings from the employee's
   compensation records rather than requiring HR to
   manually type allowance figures during every payroll run.

   All tenant and employee ownership validation is handled
   inside the controller.
========================================================= */

/*
 * GET /api/employees/:id/earnings
 *
 * Returns all earnings configured for the employee.
 */
router.get(
  "/:id/earnings",
  getEmployeeEarnings
);

/*
 * POST /api/employees/:id/earnings
 *
 * Creates an employee earning.
 *
 * Example:
 *
 * {
 *   "type": "HOUSING_ALLOWANCE",
 *   "description": "Monthly housing allowance",
 *   "amount": 20000,
 *   "recurring": true,
 *   "taxable": true,
 *   "effectiveFrom": "2026-09-01",
 *   "effectiveTo": null,
 *   "status": "ACTIVE"
 * }
 */
router.post(
  "/:id/earnings",
  createEmployeeEarning
);

/*
 * PATCH /api/employees/:id/earnings/:earningId
 *
 * Updates an existing employee earning.
 */
router.patch(
  "/:id/earnings/:earningId",
  updateEmployeeEarning
);

/*
 * DELETE /api/employees/:id/earnings/:earningId
 *
 * Deletes an employee earning.
 *
 * The controller verifies:
 * - employee belongs to the authenticated organization
 * - earning belongs to the employee
 * - earning belongs to the authenticated organization
 */
router.delete(
  "/:id/earnings/:earningId",
  deleteEmployeeEarning
);

/* =========================================================
   EMPLOYEE LOANS

   Enterprise employee loan management.

   HR records the actual loan here.

   Payroll subsequently uses the active loan's configured
   repayment amount when calculating payroll.

   Loan information includes:
   - Reference
   - Description
   - Principal amount
   - Outstanding balance
   - Monthly repayment
   - Start date
   - End date
   - Status

   IMPORTANT:
   These routes must remain tenant-scoped inside the
   controller.
========================================================= */

/*
 * GET /api/employees/:id/loans
 *
 * Returns loans belonging to the employee.
 */
router.get(
  "/:id/loans",
  getEmployeeLoans
);

/*
 * POST /api/employees/:id/loans
 *
 * Creates an employee loan.
 *
 * Example:
 *
 * {
 *   "reference": "LOAN-001",
 *   "description": "Employee emergency loan",
 *   "principalAmount": 120000,
 *   "outstandingBalance": 120000,
 *   "monthlyRepayment": 10000,
 *   "startDate": "2026-10-01",
 *   "endDate": "2027-09-30",
 *   "status": "ACTIVE"
 * }
 */
router.post(
  "/:id/loans",
  createEmployeeLoan
);

/*
 * PATCH /api/employees/:id/loans/:loanId
 *
 * Updates an existing employee loan.
 */
router.patch(
  "/:id/loans/:loanId",
  updateEmployeeLoan
);

/*
 * DELETE /api/employees/:id/loans/:loanId
 *
 * Deletes an employee loan when permitted by the
 * controller's validation rules.
 */
router.delete(
  "/:id/loans/:loanId",
  deleteEmployeeLoan
);

/* =========================================================
   SALARY ADVANCES

   Salary advances are maintained separately from employee
   loans because they represent an advance against salary
   rather than a conventional employee loan.

   Information includes:
   - Reference
   - Amount
   - Outstanding balance
   - Monthly repayment
   - Issue date
   - Status
   - Notes

   Payroll uses active salary advances when calculating
   employee deductions.

   All tenant and employee ownership validation is handled
   inside the controller.
========================================================= */

/*
 * GET /api/employees/:id/advances
 *
 * Returns salary advances belonging to the employee.
 */
router.get(
  "/:id/advances",
  getEmployeeSalaryAdvances
);

/*
 * POST /api/employees/:id/advances
 *
 * Creates a salary advance.
 *
 * Example:
 *
 * {
 *   "reference": "ADV-001",
 *   "amount": 30000,
 *   "outstandingBalance": 30000,
 *   "monthlyRepayment": 10000,
 *   "issuedDate": "2026-09-15",
 *   "status": "ACTIVE",
 *   "notes": "Salary advance"
 * }
 */
router.post(
  "/:id/advances",
  createEmployeeSalaryAdvance
);

/*
 * PATCH /api/employees/:id/advances/:advanceId
 *
 * Updates an existing salary advance.
 */
router.patch(
  "/:id/advances/:advanceId",
  updateEmployeeSalaryAdvance
);

/*
 * DELETE /api/employees/:id/advances/:advanceId
 *
 * Deletes a salary advance when permitted by the
 * controller's validation rules.
 */
router.delete(
  "/:id/advances/:advanceId",
  deleteEmployeeSalaryAdvance
);

/* =========================================================
   SINGLE EMPLOYEE

   IMPORTANT:
   This remains AFTER all specific nested routes above.

   GET /api/employees/:id
========================================================= */

router.get(
  "/:id",
  getEmployee
);

/* =========================================================
   CREATE EMPLOYEE

   POST /api/employees
========================================================= */

router.post(
  "/",
  createEmployee
);

/* =========================================================
   UPDATE EMPLOYEE

   PATCH /api/employees/:id
========================================================= */

router.patch(
  "/:id",
  updateEmployee
);

/* =========================================================
   DELETE EMPLOYEE

   DELETE /api/employees/:id
========================================================= */

router.delete(
  "/:id",
  deleteEmployee
);

/* =========================================================
   EXPORT
========================================================= */

export default router;