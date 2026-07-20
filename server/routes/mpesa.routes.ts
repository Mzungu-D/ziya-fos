import express from "express";

import {
  stkPush,
  c2bPayment,
  b2cPayment,
  b2bPayment,
  mpesaCallback,
  getTransactions,
  getTransactionById
} from "../controllers/mpesa.controller";

const router = express.Router();

router.post("/stk-push", stkPush);

router.post("/c2b", c2bPayment);

router.post("/b2c", b2cPayment);

router.post("/b2b", b2bPayment);

router.post("/callback", mpesaCallback);

router.get("/transactions", getTransactions);

router.get("/transactions/:id", getTransactionById);

export default router;