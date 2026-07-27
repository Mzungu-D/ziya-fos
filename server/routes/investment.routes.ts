import { Router } from "express";

import {
  createInvestment,
  getInvestments,
} from "../controllers/investment.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("investment.view"),
  getInvestments
);

router.post(
  "/",
  requirePermission("investment.create"),
  createInvestment
);

export default router;