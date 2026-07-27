import express from "express";

import { getTrialBalance } from "../controllers/trialbalance.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  requirePermission("reports.view"),
  getTrialBalance
);

export default router;