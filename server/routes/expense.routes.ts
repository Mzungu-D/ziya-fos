import express from "express";

import {
  createExpense,
  getExpenses,
} from "../controllers/expense.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("expense.view"),
  getExpenses
);

router.post(
  "/",
  requirePermission("expense.create"),
  createExpense
);

export default router;