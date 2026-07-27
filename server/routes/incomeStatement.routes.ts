import express from "express";

import { getIncomeStatement } from "../controllers/incomeStatement.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  requirePermission("reports.view"),
  getIncomeStatement
);

export default router;