import { Router } from "express";

import {
  getBudgets,
  getBudget,
  getBudgetSummary,
  createBudget,
  updateBudget,
  deleteBudget,
} from "../controllers/budget.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/*
 * Budget Management
 *
 * Every endpoint requires an authenticated
 * tenant session.
 */

router.get(
  "/summary",
  authenticate,
  getBudgetSummary
);

router.get(
  "/",
  authenticate,
  getBudgets
);

router.get(
  "/:id",
  authenticate,
  getBudget
);

router.post(
  "/",
  authenticate,
  createBudget
);

router.put(
  "/:id",
  authenticate,
  updateBudget
);

router.delete(
  "/:id",
  authenticate,
  deleteBudget
);

export default router;