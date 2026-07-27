import express from "express";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/**
 * =========================================================
 * PROTECTED WORKSPACE ROUTES
 * =========================================================
 *
 * Any authenticated ACTIVE organization member may access
 * the organization dashboard.
 *
 * Individual modules inside the dashboard are protected
 * by their own permissions.
 * =========================================================
 */

router.get(
  "/dashboard",
  authenticate,
  requirePermission(),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome to Ziya FOS Dashboard",
    });
  }
);

export default router;