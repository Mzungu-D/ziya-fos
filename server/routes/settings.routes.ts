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

import {
  requireOwner,
} from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   TENANT SETTINGS ROUTES

   Mounted at:
   /api/settings

   SECURITY:
   - Tenant authentication is required.
   - Settings are OWNER-only.
   - Tenant context comes from the authenticated session.
   - No client-supplied organizationId is trusted.
   - Platform sessions cannot access tenant settings.
========================================================= */

router.use(authenticate);

/* =========================================================
   OWNER-ONLY SETTINGS BOUNDARY

   Owner / Company Admin is the highest tenant-side
   administrative role.

   This protects:
   - Organization settings
   - Security sessions
   - Tenant audit logs
   - Future Users & Access settings
========================================================= */

router.use(requireOwner);

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
