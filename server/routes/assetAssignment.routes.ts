import { Router } from "express";

import {
  getAssignmentRegister,
  getAvailableAssets,
  getCurrentAssignment,
  getAssignmentHistory,
  assignAsset,
  returnAsset,
  reassignAsset,
  getEmployeeAssignments,
} from "../controllers/assetAssignment.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/**
 * ============================================================
 * ASSET ASSIGNMENTS
 * ============================================================
 *
 * All Asset Assignment routes require an authenticated
 * tenant user.
 *
 * Tenant isolation and authorization are enforced inside
 * the controllers.
 */
router.use(authenticate);

/**
 * ============================================================
 * ASSIGNMENT REGISTER
 * ============================================================
 *
 * GET /api/asset-assignments
 *
 * Returns the tenant-scoped assignment register with:
 * - Search
 * - Status filtering
 * - Department filtering
 * - Pagination
 * - Assignment summary
 */
router.get(
  "/",
  getAssignmentRegister
);

/**
 * ============================================================
 * AVAILABLE ASSETS
 * ============================================================
 *
 * GET /api/asset-assignments/available-assets
 *
 * Returns assets that are:
 * - Owned by the active tenant
 * - Active/available
 * - Not currently assigned
 *
 * Used by the Assign Asset workflow.
 */
router.get(
  "/available-assets",
  getAvailableAssets
);

/**
 * ============================================================
 * CURRENT ASSET ASSIGNMENT
 * ============================================================
 *
 * GET /api/asset-assignments/assets/:id/current
 *
 * Returns the currently active assignment for an asset.
 */
router.get(
  "/assets/:id/current",
  getCurrentAssignment
);

/**
 * ============================================================
 * ASSET ASSIGNMENT HISTORY
 * ============================================================
 *
 * GET /api/asset-assignments/assets/:id/history
 *
 * Returns the complete assignment history for an asset.
 */
router.get(
  "/assets/:id/history",
  getAssignmentHistory
);

/**
 * ============================================================
 * ASSIGN ASSET
 * ============================================================
 *
 * POST /api/asset-assignments/assets/:id/assign
 *
 * Assigns an available asset to an active employee.
 */
router.post(
  "/assets/:id/assign",
  assignAsset
);

/**
 * ============================================================
 * RETURN ASSET
 * ============================================================
 *
 * POST /api/asset-assignments/assets/:id/return
 *
 * Closes the currently active assignment and records
 * the return details.
 */
router.post(
  "/assets/:id/return",
  returnAsset
);

/**
 * ============================================================
 * REASSIGN ASSET
 * ============================================================
 *
 * POST /api/asset-assignments/assets/:id/reassign
 *
 * Closes the current assignment and assigns the asset
 * to another employee.
 */
router.post(
  "/assets/:id/reassign",
  reassignAsset
);

/**
 * ============================================================
 * EMPLOYEE ASSET ASSIGNMENTS
 * ============================================================
 *
 * GET /api/asset-assignments/employees/:employeeId/assets
 *
 * Returns all assignments associated with a tenant employee.
 */
router.get(
  "/employees/:employeeId/assets",
  getEmployeeAssignments
);

export default router;