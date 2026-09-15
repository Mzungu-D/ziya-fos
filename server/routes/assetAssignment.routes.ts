import { Router } from "express";
import {
  getAssignmentRegister,
  getCurrentAssignment,
  getAssignmentHistory,
  assignAsset,
  returnAsset,
  reassignAsset,
  getEmployeeAssignments,
} from "../controllers/assetAssignment.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/* =========================================================
   ASSET ASSIGNMENT REGISTER
========================================================= */

/*
 * Get the tenant's assignment register.
 *
 * Supports:
 * - Employee name search
 * - Employee number/email search
 * - Asset name/code search
 * - Serial number / IMEI / registration number search
 * - Status filtering
 * - Department filtering
 * - Pagination
 *
 * GET /api/asset-assignments
 */
router.get(
  "/",
  authenticate,
  getAssignmentRegister
);

/* =========================================================
   ASSET ASSIGNMENTS
========================================================= */

/*
 * Get the current active assignment for an asset.
 *
 * GET /api/asset-assignments/assets/:id/current
 */
router.get(
  "/assets/:id/current",
  authenticate,
  getCurrentAssignment
);

/*
 * Get the complete assignment history for an asset.
 *
 * GET /api/asset-assignments/assets/:id/history
 */
router.get(
  "/assets/:id/history",
  authenticate,
  getAssignmentHistory
);

/*
 * Assign an asset to an employee.
 *
 * POST /api/asset-assignments/assets/:id/assign
 */
router.post(
  "/assets/:id/assign",
  authenticate,
  assignAsset
);

/*
 * Return the currently assigned asset.
 *
 * POST /api/asset-assignments/assets/:id/return
 */
router.post(
  "/assets/:id/return",
  authenticate,
  returnAsset
);

/*
 * Reassign an asset to another employee.
 *
 * POST /api/asset-assignments/assets/:id/reassign
 */
router.post(
  "/assets/:id/reassign",
  authenticate,
  reassignAsset
);

/*
 * Get all assignments belonging to an employee.
 *
 * GET /api/asset-assignments/employees/:employeeId/assets
 */
router.get(
  "/employees/:employeeId/assets",
  authenticate,
  getEmployeeAssignments
);

export default router;