import express from "express";

import {
  createBankAccount,
  getBankAccounts
} from "../controllers/bankAccount.controller";

const router = express.Router();

router.post("/", createBankAccount);

router.get("/", getBankAccounts);

export default router;