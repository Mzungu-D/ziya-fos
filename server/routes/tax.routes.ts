import express from "express";

import {
  listTaxObligations,
  listTaxFilings,
  createTaxFiling,
  listTaxPayments,
  createTaxPayment,
} from "../controllers/tax.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.use(authenticate);

/* =========================================================
   TAX OBLIGATIONS
   ========================================================= */

router.get(
  "/obligations",
  requirePermission("tax.view"),
  listTaxObligations
);

/* =========================================================
   TAX FILINGS
   ========================================================= */

router.get(
  "/filings",
  requirePermission("tax.view"),
  listTaxFilings
);

router.post(
  "/filings",
  requirePermission("tax.file"),
  createTaxFiling
);

/* =========================================================
   TAX PAYMENTS
   ========================================================= */

router.get(
  "/payments",
  requirePermission("tax.view"),
  listTaxPayments
);

router.post(
  "/payments",
  requirePermission("tax.payment"),
  createTaxPayment
);

export default router;