import express from "express";

import {
  importBankStatement,
  parseBankStatementPdf,
  listBankStatements,
  getBankStatementLines,
  deleteBankStatement,
} from "../controllers/bankStatement.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermission("bankAccount.view"), listBankStatements);

router.get(
  "/:id/lines",
  requirePermission("bankAccount.view"),
  getBankStatementLines
);

router.post(
  "/parse-pdf",
  requirePermission("bankStatement.create"),
  parseBankStatementPdf
);

router.post(
  "/import",
  requirePermission("bankStatement.create"),
  importBankStatement
);

router.delete(
  "/:id",
  requirePermission("bankAccount.delete"),
  deleteBankStatement
);

export default router;
