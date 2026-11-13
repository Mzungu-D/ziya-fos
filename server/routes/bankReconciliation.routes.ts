import express from "express";

import {
  autoMatchStatementLines,
  completeBankReconciliation,
  createEntryFromStatementLine,
  getReconciliationHistory,
  getReconciliationWorkspace,
  matchStatementLine,
  reopenBankReconciliation,
  unmatchStatementLine,
} from "../controllers/bankReconciliation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.use(authenticate);

const view = requirePermission("bankAccount.view");
const change = requirePermission("bankAccount.update");

router.get("/:bankAccountId/workspace", view, getReconciliationWorkspace);
router.get("/:bankAccountId/history", view, getReconciliationHistory);

router.post("/:bankAccountId/match", change, matchStatementLine);
router.post("/:bankAccountId/unmatch", change, unmatchStatementLine);
router.post("/:bankAccountId/auto-match", change, autoMatchStatementLines);
router.post("/:bankAccountId/create-entry", change, createEntryFromStatementLine);
router.post("/:bankAccountId/complete", change, completeBankReconciliation);
router.delete("/:bankAccountId/:reconciliationId", change, reopenBankReconciliation);

export default router;