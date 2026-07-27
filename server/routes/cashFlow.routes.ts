import express from "express";

import { getCashFlow } from "../controllers/cashFlow.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  requirePermission("reports.view"),
  getCashFlow
);

export default router;