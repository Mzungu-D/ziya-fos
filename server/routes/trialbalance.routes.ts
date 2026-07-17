import express from "express";
import { getTrialBalance } from "../controllers/trialbalance.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getTrialBalance
);

export default router;