import express from "express";

import {
  getOrganizationSettings,
  updateOrganizationSettings,
  getSecuritySessions,
  revokeSecuritySession,
  revokeOtherSecuritySessions,
  getTenantAuditLogs,
} from "../controllers/settings.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

const router = express.Router();

/* =========================================================
   TENANT SETTINGS ROUTES

   Mounted in app.ts at:

   /api/settings

   SECURITY:
   - Every endpoint requires authentication.
   - Tenant context comes from the authenticated session.
   - No client-supplied organizationId is trusted.
   - Platform administration is separate.
========================================================= */

router.use(authenticate);

/* =========================================================
   ORGANIZATION SETTINGS
========================================================= */

router.get(
  "/organization",
  getOrganizationSettings
);

router.patch(
  "/organization",
  updateOrganizationSettings
);

/* =========================================================
   SECURITY / SESSIONS
========================================================= */

router.get(
  "/security/sessions",
  getSecuritySessions
);

router.delete(
  "/security/sessions/:sessionId",
  revokeSecuritySession
);

router.delete(
  "/security/sessions",
  revokeOtherSecuritySessions
);

/* =========================================================
   TENANT AUDIT LOG
========================================================= */

router.get(
  "/audit",
  getTenantAuditLogs
);

export default router;