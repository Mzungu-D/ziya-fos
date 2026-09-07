import express from "express";

import {
  createExpense,
  getExpenses,
  getExpense,
  submitExpense,
  postExpense,
  recordExpensePayment,
  deleteExpense,
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

router.get(
  "/:id",
  requirePermission("expense.view"),
  getExpense
);

router.post(
  "/:id/submit",
  requirePermission("expense.create"),
  submitExpense
);

router.post(
  "/:id/post",
  requirePermission("expense.create"),
  postExpense
);

router.post(
  "/:id/payment",
  requirePermission("expense.create"),
  recordExpensePayment
);

router.delete(
  "/:id",
  requirePermission("expense.create"),
  deleteExpense
);

export default router;
