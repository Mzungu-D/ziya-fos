import express from "express";
import {
  createAccount,
  getAccounts,
} from "../controllers/account.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createAccount
);

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getAccounts
);

export default router;