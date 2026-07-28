import express from "express";

import {
  getRoleTemplates,
} from "../controllers/role.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  requirePermission,
} from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   TENANT ROLE TEMPLATES

   Mounted at:

   /api/roles
========================================================= */

router.get(
  "/",
  authenticate,
  requirePermission("users.view"),
  getRoleTemplates
);

export default router;