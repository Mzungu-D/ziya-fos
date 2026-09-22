import express from "express";

import {
  getUsers,
  addUser,
  updateUserAccess,
  updateUserStatus,
  deleteUser,
} from "../controllers/user.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  requirePermission,
} from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   TENANT USER & ACCESS MANAGEMENT

   Mounted at:

   /api/users

   SECURITY MODEL:

   - Authentication is mandatory.
   - A TENANT session is mandatory.
   - Authorization is permission-based.
   - Current tenant membership is resolved by the
     permission middleware.
   - JWT role claims are NOT trusted for authorization.
   - Platform accounts cannot use tenant user management.
   - Organization boundaries are enforced by middleware
     and controllers.
   - OWNER remains protected by the controller and cannot
     be modified or removed.
   - VIEW permission is strictly read-only.
   - User administration actions require their own
     explicit permissions.
========================================================= */

router.use(authenticate);

/* =========================================================
   LIST ORGANIZATION USERS

   GET /api/users

   Permission:
   users.view

   READ ONLY
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

   This endpoint creates the invitation/access process.

   It MUST NOT grant active tenant membership before
   the invitation is accepted.
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

   This is a sensitive operation.

   The controller must:
   - Verify the target membership belongs to the
     current organization.
   - Prevent modification of the OWNER membership.
   - Validate the requested role.
   - Validate requested permissions.
   - Prevent unauthorized cross-module permissions.
   - Never allow a normal user to escalate themselves.
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

   The controller must:
   - Verify tenant ownership of membership.
   - Prevent changing OWNER status.
   - Prevent unauthorized cross-tenant changes.
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
   users.manageStatus

   SECURITY:
   - Controller must verify tenant ownership.
   - OWNER membership cannot be removed.
   - Platform accounts cannot be removed here.
   - A user cannot remove their own protected OWNER
     membership.
   - Removing membership must not affect another
     organization.
========================================================= */

router.delete(
  "/:membershipId",
  requirePermission("users.manageStatus"),
  deleteUser
);

export default router;