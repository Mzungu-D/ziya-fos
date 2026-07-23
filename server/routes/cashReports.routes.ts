import express from "express";

import {
  getBankAccountSummary,
  getBankReconciliation,
  getCashPosition,
  getMpesaReport,
} from "../controllers/cashReports.controller";

import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

router.use(authenticate);
router.use(authorize("SUPER_ADMIN"));

router.get("/cash-position", getCashPosition);
router.get("/bank-summary", getBankAccountSummary);
router.get("/bank-reconciliation", getBankReconciliation);
router.get("/mpesa", getMpesaReport);

export default router;