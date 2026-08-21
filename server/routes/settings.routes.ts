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
  requirePermission,
} from "../middleware/permission.middleware";

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

   VIEW:
   - Requires security.sessions.view

   REVOKE:
   - Requires security.sessions.revoke

   OWNER:
   - Existing permission middleware grants OWNER
     full access inside the current tenant only.

   IMPORTANT:
   - Platform sessions cannot pass the tenant
     permission boundary.
   - Organization isolation remains enforced
     by the controller.
========================================================= */

router.get(
  "/security/sessions",
  requirePermission(
    "security.sessions.view"
  ),
  getSecuritySessions
);

router.delete(
  "/security/sessions/:sessionId",
  requirePermission(
    "security.sessions.revoke"
  ),
  revokeSecuritySession
);

router.delete(
  "/security/sessions",
  requirePermission(
    "security.sessions.revoke"
  ),
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