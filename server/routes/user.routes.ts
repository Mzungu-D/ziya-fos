import express from "express";

import {
  getUsers,
  addUser,
  updateUserAccess,
  updateUserStatus,
  deleteUser,
} from "../controllers/user.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   TENANT USER & ACCESS MANAGEMENT

   Mounted at:

   /api/users

   SECURITY MODEL

   - Authentication is mandatory.
   - A TENANT session is mandatory.
   - Authorization is permission based.
   - The authenticated organization is the tenant boundary.
   - JWT role claims are not trusted by themselves.
   - Permission middleware validates the current tenant
     membership against the database.
   - Controllers independently validate the target tenant
     membership for mutations.
   - OWNER is protected from modification/removal.
   - Platform accounts cannot be managed as tenant users.
   - Every operation is tenant scoped.
   - Backend authorization is authoritative; frontend
     visibility is not a security boundary.

   IMPORTANT:

   This router must remain intentionally thin.

   Business rules, validation, tenant ownership checks,
   OWNER protection, permission escalation prevention,
   invitation creation and membership mutations belong
   to the controller/service layer.

   Authentication and permission middleware remain the
   first authorization boundary at the route level.
========================================================= */

/* =========================================================
   AUTHENTICATION BOUNDARY

   Every /api/users endpoint requires an authenticated
   tenant session.

   The permission middleware subsequently verifies:

   - tenant session
   - user identity
   - organization membership
   - membership status
   - user status
   - organization status
   - effective permissions
========================================================= */

router.use(authenticate);

/* =========================================================
   LIST ORGANIZATION USERS

   GET /api/users

   Permission:
   users.view

   READ ONLY

   The controller is responsible for returning users from
   the currently authenticated organization only.

   No platform-wide user listing is permitted through this
   tenant endpoint.
========================================================= */

router.get(
  "/",
  requirePermission("users.view"),
  getUsers
);

/* =========================================================
   CREATE / INVITE ORGANIZATION USER

   POST /api/users

   Permission:
   users.create

   IMPORTANT:

   addUser() creates the pending invitation/access process.

   It does NOT create an active organization membership
   before the invitation is accepted.

   The controller is responsible for:

   - tenant validation
   - input validation
   - email/phone validation
   - role validation
   - permission validation
   - permission escalation prevention
   - duplicate invitation prevention
   - invitation token generation
   - invitation persistence
   - invitation delivery

   The invited user's permissions must be determined by
   the authorized inviter and must not be self-selected
   by the invited user.
========================================================= */

router.post(
  "/",
  requirePermission("users.create"),
  addUser
);

/* =========================================================
   UPDATE USER ROLE / PERMISSIONS

   PATCH /api/users/:membershipId/access

   Permission:
   users.manageAccess

   The controller is responsible for:

   - tenant ownership verification
   - target membership validation
   - OWNER protection
   - platform-account protection
   - role validation
   - permission validation
   - permission escalation prevention
   - self-access modification prevention

   IMPORTANT:

   The membershipId is resolved within the authenticated
   organization. A membership belonging to another tenant
   must never be modified.
========================================================= */

router.patch(
  "/:membershipId/access",
  requirePermission("users.manageAccess"),
  updateUserAccess
);

/* =========================================================
   ACTIVATE / DEACTIVATE ORGANIZATION ACCESS

   PATCH /api/users/:membershipId/status

   Permission:
   users.manageStatus

   The controller is responsible for:

   - tenant ownership verification
   - target membership validation
   - OWNER protection
   - platform-account protection
   - self-status protection
   - active/inactive state validation

   Deactivating a membership must affect only that
   user's membership in the current organization.
========================================================= */

router.patch(
  "/:membershipId/status",
  requirePermission("users.manageStatus"),
  updateUserStatus
);

/* =========================================================
   REMOVE ORGANIZATION MEMBERSHIP

   DELETE /api/users/:membershipId

   Permission:
   users.delete

   IMPORTANT:

   This is intentionally NOT users.manageStatus.

   Deletion is a separate privileged operation and must
   have its own explicit permission.

   deleteUser is an alias for the tenant-safe
   deleteOrganizationUser implementation.

   The controller is responsible for:

   - tenant ownership verification
   - target membership validation
   - OWNER protection
   - platform-account protection
   - self-removal protection
   - deleting only the organization membership
   - preserving the global User identity where required

   Removing a membership must never delete or modify
   another organization's membership for the same user.
========================================================= */

router.delete(
  "/:membershipId",
  requirePermission("users.delete"),
  deleteUser
);

export default router;