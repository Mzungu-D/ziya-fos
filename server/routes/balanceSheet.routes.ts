import express from "express";

import { getBalanceSheet } from "../controllers/balanceSheet.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  requirePermission("reports.view"),
  getBalanceSheet
);

export default router;