import express from "express";
import { getIncomeStatement } from "../controllers/incomeStatement.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getIncomeStatement
);

export default router;