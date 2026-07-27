import express from "express";

import { getUsers } from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * USER ROUTES
 * =========================================================
 *
 * Permission:
 * users.view
 *
 * OWNER has full access inside their own organization.
 * =========================================================
 */

router.get(
  "/users",
  authenticate,
  requirePermission("users.view"),
  getUsers
);

export default router;