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
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

/* =========================================================
   VENDOR ROUTES
========================================================= */

/*
 * GET /api/vendors
 * Get all vendors
 */
router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getVendors
);

/*
 * GET /api/vendors/:id
 * Get one vendor and its financial history
 */
router.get(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  getVendorById
);

/*
 * POST /api/vendors
 * Create a new vendor
 */
router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createVendor
);

/*
 * PUT /api/vendors/:id
 * Update vendor details
 */
router.put(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  updateVendor
);

/*
 * PATCH /api/vendors/:id/status
 * Activate or deactivate vendor
 */
router.patch(
  "/:id/status",
  authenticate,
  authorize("SUPER_ADMIN"),
  updateVendorStatus
);

/*
 * DELETE /api/vendors/:id
 *
 * Controller prevents deletion when the vendor
 * already has financial transactions.
 */
router.delete(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  deleteVendor
);

export default router;