import express from "express";

import {
  provisionOrganization,
} from "../controllers/platform.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  requirePlatformAdmin,
} from "../middleware/platformAdmin.middleware";

const router = express.Router();

/* =========================================================
   ZIYA PLATFORM ADMINISTRATION

   Every route below requires:
   1. Valid authenticated session
   2. Active PLATFORM_ADMIN account

   Tenant OWNER permissions do not grant access here.
========================================================= */

router.use(authenticate);
router.use(requirePlatformAdmin);

/* =========================================================
   ORGANIZATION PROVISIONING
========================================================= */

router.post(
  "/organizations",
  provisionOrganization
);

export default router;