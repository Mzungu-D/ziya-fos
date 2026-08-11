import express from "express";

import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  approveOrganization,
  rejectOrganization,
  suspendOrganization,
  activateOrganization,
} from "../controllers/platform.organization.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

const router = express.Router();

/* =========================================================
   PLATFORM ORGANIZATION ROUTES

   Mounted at:

   /api/platform/organizations

   Every route requires a valid PLATFORM session JWT.
   The controller enforces this via requirePlatformSession().
========================================================= */

router.get("/", authenticate, listOrganizations);
router.get("/:id", authenticate, getOrganization);
router.post("/", authenticate, createOrganization);
router.patch("/:id", authenticate, updateOrganization);
router.delete("/:id", authenticate, deleteOrganization);

// PENDING → ACTIVE
router.patch("/:id/approve", authenticate, approveOrganization);

// PENDING → REJECTED
router.patch("/:id/reject", authenticate, rejectOrganization);

// ACTIVE → SUSPENDED
router.patch("/:id/suspend", authenticate, suspendOrganization);

// SUSPENDED → ACTIVE
router.patch("/:id/activate", authenticate, activateOrganization);

export default router;