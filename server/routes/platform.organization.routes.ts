import express from "express";

import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  approveOrganization,
  suspendOrganization,
  activateOrganization,
} from "../controllers/platform.organization.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

/* =========================================================
   PLATFORM ORGANIZATION ROUTES

   Mounted at: /api/platform/organizations

   All routes require a valid PLATFORM session JWT.
   Enforcement is inside each controller handler.
========================================================= */

router.get("/", authenticate, listOrganizations);

router.get("/:id", authenticate, getOrganization);

router.post("/", authenticate, createOrganization);

router.patch("/:id", authenticate, updateOrganization);

router.delete("/:id", authenticate, deleteOrganization);

router.patch("/:id/approve", authenticate, approveOrganization);

router.patch("/:id/suspend", authenticate, suspendOrganization);

router.patch("/:id/activate", authenticate, activateOrganization);

export default router;