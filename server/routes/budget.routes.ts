import { Router } from "express";
import {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
} from "../controllers/budget.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/*
 * Budget Management
 *
 * Authentication and organization isolation
 * are handled by the authenticated budget
 * controller using the tenant session.
 */

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