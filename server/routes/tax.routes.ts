import express from "express";

import {
  listTaxObligations,
  listTaxFilings,
  createTaxFiling,
  listTaxPayments,
  createTaxPayment,
} from "../controllers/tax.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.use(authenticate);

/* Tax obligations */
router.get(
  "/obligations",
  listTaxObligations
);

/* Tax filings */
router.get(
  "/filings",
  listTaxFilings
);

router.post(
  "/filings",
  createTaxFiling
);

/* Tax payments */
router.get(
  "/payments",
  listTaxPayments
);

router.post(
  "/payments",
  createTaxPayment
);

export default router;