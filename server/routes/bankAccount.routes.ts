import express from "express";

import {
  createBankAccount,
  getBankAccounts,
} from "../controllers/bankAccount.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("bankAccount.view"),
  getBankAccounts
);

router.post(
  "/",
  requirePermission("bankAccount.create"),
  createBankAccount
);

export default router;