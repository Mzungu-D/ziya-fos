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

/*
|--------------------------------------------------------------------------
| GET ALL ACCOUNTS
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  getAccounts
);

/*
|--------------------------------------------------------------------------
| GET ONE ACCOUNT
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  getAccount
);

/*
|--------------------------------------------------------------------------
| CREATE ACCOUNT
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN"),
  createAccount
);

/*
|--------------------------------------------------------------------------
| UPDATE ACCOUNT
|--------------------------------------------------------------------------
*/

router.put(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  updateAccount
);

/*
|--------------------------------------------------------------------------
| DELETE ACCOUNT
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  deleteAccount
);

export default router;