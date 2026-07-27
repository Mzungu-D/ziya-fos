import express from "express";

import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
} from "../controllers/vendor.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * VENDOR ROUTES
 * =========================================================
 *
 * Permissions:
 * vendor.view
 * vendor.create
 * vendor.update
 * vendor.status
 * vendor.delete
 *
 * OWNER has full access inside their own organization.
 * =========================================================
 */

router.use(authenticate);

/* GET ALL VENDORS */
router.get(
  "/",
  requirePermission("vendor.view"),
  getVendors
);

/* GET ONE VENDOR */
router.get(
  "/:id",
  requirePermission("vendor.view"),
  getVendorById
);

/* CREATE VENDOR */
router.post(
  "/",
  requirePermission("vendor.create"),
  createVendor
);

/* UPDATE VENDOR */
router.put(
  "/:id",
  requirePermission("vendor.update"),
  updateVendor
);

/* ACTIVATE / DEACTIVATE VENDOR */
router.patch(
  "/:id/status",
  requirePermission("vendor.status"),
  updateVendorStatus
);

/* DELETE VENDOR */
router.delete(
  "/:id",
  requirePermission("vendor.delete"),
  deleteVendor
);

export default router;