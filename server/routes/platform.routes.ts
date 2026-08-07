import express from "express";

import {
  provisionOrganization,
  getPlatformOrganizations,
  getPlatformOrganization,
  getPlatformAuditLogs,
  approveOrganization,
  suspendOrganization,
  activateOrganization,
  deleteOrganization,
} from "../controllers/platform.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  requirePlatformAdmin,
} from "../middleware/platformAdmin.middleware";

const router = express.Router();

/* =========================================================
   ZIYA FOS PLATFORM ADMINISTRATION

   SECURITY BOUNDARY

   Every route below requires:

   1. Valid authenticated session
   2. PLATFORM session
   3. Active PLATFORM_ADMIN account

   Tenant OWNER permissions NEVER grant platform access.

   PLATFORM_ADMIN does NOT automatically receive:
   - tenant membership
   - tenant financial access
   - tenant OWNER permissions

   Platform administration is intentionally isolated
   from tenant financial operations.
========================================================= */

router.use(authenticate);
router.use(requirePlatformAdmin);

/* =========================================================
   PLATFORM AUDIT LOGS

   GET /api/platform/audit-logs

   Optional filters:

   ?action=ORGANIZATION_APPROVED
   ?resource=ORGANIZATION
   ?resourceId=<organization-id>
   ?limit=50

   These logs contain platform administrative activity only.

   Tenant financial audit trails remain separate.
========================================================= */

router.get(
  "/audit-logs",
  getPlatformAuditLogs
);

/* =========================================================
   ORGANIZATION COLLECTION
========================================================= */

/*
 * GET /api/platform/organizations
 *
 * Lists tenant administrative metadata.
 *
 * Optional filters:
 *
 * ?status=PENDING
 * ?status=ACTIVE
 * ?status=SUSPENDED
 *
 * Does NOT expose:
 * - accounts
 * - journal entries
 * - transactions
 * - expenses
 * - invoices
 * - bank records
 * - M-Pesa records
 * - financial reports
 * - balances
 */
router.get(
  "/organizations",
  getPlatformOrganizations
);

/*
 * POST /api/platform/organizations
 *
 * Platform-controlled organization provisioning.
 *
 * Creates:
 * - Organization
 * - Initial tenant OWNER
 * - OWNER membership
 *
 * Organizations provisioned directly by PLATFORM_ADMIN
 * are created as ACTIVE.
 *
 * PLATFORM_ADMIN does not receive membership in the
 * newly created organization.
 */
router.post(
  "/organizations",
  provisionOrganization
);

/* =========================================================
   ORGANIZATION DETAILS

   GET /api/platform/organizations/:organizationId

   Administrative metadata and membership information only.

   Keep this route before adding any future generic routes
   that could conflict with :organizationId.
========================================================= */

router.get(
  "/organizations/:organizationId",
  getPlatformOrganization
);

/* =========================================================
   ORGANIZATION APPROVAL

   PATCH
   /api/platform/organizations/:organizationId/approve

   Valid lifecycle:

   PENDING -> ACTIVE

   Used for organizations created through self-service
   registration.

   Suspended organizations must NOT use this endpoint.
========================================================= */

router.patch(
  "/organizations/:organizationId/approve",
  approveOrganization
);

/* =========================================================
   ORGANIZATION SUSPENSION

   PATCH
   /api/platform/organizations/:organizationId/suspend

   Valid lifecycle:

   ACTIVE -> SUSPENDED

   Suspension blocks tenant access without deleting
   organization or financial records.
========================================================= */

router.patch(
  "/organizations/:organizationId/suspend",
  suspendOrganization
);

/* =========================================================
   ORGANIZATION REACTIVATION

   PATCH
   /api/platform/organizations/:organizationId/activate

   Valid lifecycle:

   SUSPENDED -> ACTIVE

   PENDING organizations must use /approve instead.
========================================================= */

router.patch(
  "/organizations/:organizationId/activate",
  activateOrganization
);

/* =========================================================
   DELETE ORGANIZATION

   DELETE
   /api/platform/organizations/:organizationId
========================================================= */

router.delete(
  "/organizations/:organizationId",
  deleteOrganization
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
