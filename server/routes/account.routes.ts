import express from "express";

import {
  createAccount,
  getAccounts,
  getAccount,
  updateAccount,
  deleteAccount,
} from "../controllers/account.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getAccounts
);

router.get(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  getAccount
);

router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createAccount
);

router.put(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  updateAccount
);

router.delete(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  deleteAccount
);

export default router;