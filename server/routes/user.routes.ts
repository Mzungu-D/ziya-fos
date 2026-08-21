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
   TENANT USER MANAGEMENT

   Mounted in app.ts at:

   /api/users

   SECURITY MODEL:
   - Authentication is mandatory.
   - Requests must come from a TENANT session.
   - Controllers verify the authenticated organization.
   - Every membership lookup is organization-scoped.
   - OWNER cannot be modified through these endpoints.
   - Platform accounts cannot be managed here.
   - Tenant users cannot cross organization boundaries.
========================================================= */

/* =========================================================
   LIST ORGANIZATION USERS

   GET /api/users
========================================================= */

router.get(
  "/",
  authenticate,
  requirePermission("users.view"),
  getUsers
);

/* =========================================================
   ADD ORGANIZATION USER

   POST /api/users

   Required permission:
   users.create
========================================================= */

router.post(
  "/",
  authenticate,
  requirePermission("users.create"),
  addUser
);

/* =========================================================
   UPDATE USER ROLE / PERMISSIONS

   PATCH /api/users/:membershipId/access

   Required permission:
   users.manageAccess
========================================================= */

router.patch(
  "/:membershipId/access",
  authenticate,
  requirePermission(
    "users.manageAccess"
  ),
  updateUserAccess
);

/* =========================================================
   ACTIVATE / DEACTIVATE ORGANIZATION ACCESS

   PATCH /api/users/:membershipId/status

   Required permission:
   users.manageStatus
========================================================= */

router.patch(
  "/:membershipId/status",
  authenticate,
  requirePermission(
    "users.manageStatus"
  ),
  updateUserStatus
);

/* =========================================================
   PERMANENTLY DELETE ORGANIZATION USER

   DELETE /api/users/:membershipId

   Required permission:
   users.manageAccess

   SECURITY:
   - Authentication required.
   - Organization membership is verified by the controller.
   - OWNER cannot be deleted.
   - Platform accounts cannot be deleted here.
   - A user cannot delete themselves.
   - The controller permanently removes the membership.
   - If it is the user's final organization membership,
     the User identity is permanently removed as well.

   If the person needs access again later, they must be
   invited again through the normal user onboarding flow.
========================================================= */

router.delete(
  "/:membershipId",
  authenticate,
  requirePermission(
    "users.manageAccess"
  ),
  deleteUser
);

export default router;