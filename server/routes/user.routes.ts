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
  requireOwner,
} from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   TENANT USER & ACCESS MANAGEMENT

   Mounted at:

   /api/users

   SECURITY MODEL:
   - Authentication is mandatory.
   - A TENANT session is mandatory.
   - Only the tenant OWNER may manage organization users.
   - Current membership is resolved from the database.
   - JWT role claims are not trusted for authorization.
   - Platform accounts cannot use tenant user management.
   - Organization boundaries are enforced by the middleware
     and controllers.
   - OWNER cannot be modified through these endpoints.
   - User management is intentionally separated from the
     financial permission model.
========================================================= */

router.use(authenticate);
router.use(requireOwner);

/* =========================================================
   LIST ORGANIZATION USERS

   GET /api/users
========================================================= */

router.get(
  "/",
  getUsers
);

/* =========================================================
   CREATE / INVITE ORGANIZATION USER

   POST /api/users

   OWNER ONLY

   NOTE:
   The controller will be responsible for creating the
   pending invitation. It must NOT grant active tenant
   membership before the invitation is accepted.
========================================================= */

router.post(
  "/",
  addUser
);

/* =========================================================
   UPDATE USER ROLE / PERMISSIONS

   PATCH /api/users/:membershipId/access

   OWNER ONLY
========================================================= */

router.patch(
  "/:membershipId/access",
  updateUserAccess
);

/* =========================================================
   ACTIVATE / DEACTIVATE ORGANIZATION ACCESS

   PATCH /api/users/:membershipId/status

   OWNER ONLY
========================================================= */

router.patch(
  "/:membershipId/status",
  updateUserStatus
);

/* =========================================================
   REMOVE ORGANIZATION MEMBERSHIP

   DELETE /api/users/:membershipId

   OWNER ONLY

   SECURITY:
   - Controller must verify tenant ownership of membership.
   - OWNER membership cannot be removed.
   - Platform accounts cannot be removed here.
   - Owner cannot remove their own membership.
   - Removing a membership must not accidentally grant
     access to another organization.
========================================================= */

router.delete(
  "/:membershipId",
  deleteUser
);

export default router;
