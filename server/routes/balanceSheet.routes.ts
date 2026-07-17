import express from "express";
import { getBalanceSheet } from "../controllers/balanceSheet.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getBalanceSheet
);

export default router;