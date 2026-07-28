import express from "express";

import {
  getUsers,
  addUser,
  updateUserAccess,
  updateUserStatus,
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
   - Authentication establishes the tenant session.
   - Membership is verified against the database.
   - Every operation remains inside the authenticated tenant.
   - OWNER has full tenant access.
   - Non-OWNER members require explicit permissions.
   - Platform administration remains separate.
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
   ACTIVATE / DEACTIVATE MEMBERSHIP

   PATCH /api/users/:membershipId/status
========================================================= */

router.patch(
  "/:membershipId/status",
  authenticate,
  requirePermission(
    "users.manageStatus"
  ),
  updateUserStatus
);

export default router;