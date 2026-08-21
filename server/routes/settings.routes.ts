import express from "express";

import {
  getSettings,
  updateProfile,
  getSessions,
  revokeSession,
} from "../controllers/settings.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

const router = express.Router();

/* =========================================================
   TENANT SETTINGS ROUTES

   These routes belong to the authenticated tenant workspace.

   SECURITY
   ---------------------------------------------------------
   - Authentication is required on every endpoint.
   - Tenant context comes from the authenticated session.
   - No organizationId is accepted from the browser.
   - Platform/admin settings are completely separate.
========================================================= */

router.use(authenticate);

/* =========================================================
   ORGANIZATION / USER SETTINGS

   GET /api/settings
========================================================= */

router.get(
  "/",
  getSettings
);

/* =========================================================
   CURRENT USER PROFILE

   PATCH /api/settings/profile
========================================================= */

router.patch(
  "/profile",
  updateProfile
);

/* =========================================================
   ACTIVE SESSIONS

   GET /api/settings/sessions
========================================================= */

router.get(
  "/sessions",
  getSessions
);

/* =========================================================
   REVOKE SESSION

   DELETE /api/settings/sessions/:sessionId
========================================================= */

router.delete(
  "/sessions/:sessionId",
  revokeSession
);

export default router;