import express from "express";

import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../controllers/transaction.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("reports.view"),
  getTransactions
);

router.get(
  "/:id",
  requirePermission("reports.view"),
  getTransactionById
);

router.post(
  "/",
  requirePermission("reports.view"),
  createTransaction
);

router.patch(
  "/:id",
  requirePermission("reports.view"),
  updateTransaction
);

router.delete(
  "/:id",
  requirePermission("reports.view"),
  deleteTransaction
);

export default router;