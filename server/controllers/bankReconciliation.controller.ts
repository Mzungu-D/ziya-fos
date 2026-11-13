import { Response } from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { handleAccountError } from "../services/bankProvisioning.service";
import {
  autoMatch,
  completeReconciliation,
  createEntryForStatementLine,
  getWorkspace,
  listReconciliations,
  matchLines,
  parseAsOf,
  reopenReconciliation,
  unmatchLine,
} from "../services/bankReconciliation.service";

/* =========================================================
   BANK RECONCILIATION CONTROLLER
   Thin layer: tenant + input checks, then the service.
========================================================= */

const param = (req: AuthRequest, name: string): string => {
  const raw = req.params[name];
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function context(req: AuthRequest, res: Response) {
  const organizationId = req.user?.organizationId ?? null;
  if (!organizationId) {
    res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Authentication required." });
    return null;
  }
  return { organizationId, userId: req.user?.userId ?? null };
}

function failure(res: Response, error: unknown, label: string) {
  console.error(`[BANK RECONCILIATION] ${label}:`, error);
  if (handleAccountError(res, error)) return;
  res.status(500).json({ success: false, message: "Bank reconciliation failed." });
}

const required = (res: Response, ok: boolean, message: string) => {
  if (!ok) res.status(400).json({ success: false, code: "INVALID_INPUT", message });
  return ok;
};

export const getReconciliationWorkspace = async (req: AuthRequest, res: Response) => {
  const ctx = context(req, res);
  if (!ctx) return;

  try {
    const balanceRaw = req.query.statementBalance;
    const balance = balanceRaw === undefined || balanceRaw === "" ? null : Number(balanceRaw);
    if (!required(res, balance === null || Number.isFinite(balance), "Statement balance must be a number.")) return;

    const workspace = await getWorkspace(prisma, {
      organizationId: ctx.organizationId,
      bankAccountId: param(req, "bankAccountId"),
      asOf: parseAsOf(req.query.asOf),
      statementBalance: balance,
    });
    res.json({ success: true, workspace });
  } catch (error) {
    failure(res, error, "WORKSPACE");
  }
};

export const matchStatementLine = async (req: AuthRequest, res: Response) => {
  const ctx = context(req, res);
  if (!ctx) return;

  try {
    const statementLineId = text(req.body?.statementLineId);
    const journalLineId = text(req.body?.journalLineId);
    if (!required(res, Boolean(statementLineId && journalLineId), "Select a statement line and a ledger entry.")) return;

    const result = await matchLines(prisma, ctx, { bankAccountId: param(req, "bankAccountId"), statementLineId, journalLineId });
    res.json({ success: true, ...result });
  } catch (error) {
    failure(res, error, "MATCH");
  }
};

export const unmatchStatementLine = async (req: AuthRequest, res: Response) => {
  const ctx = context(req, res);
  if (!ctx) return;

  try {
    const statementLineId = text(req.body?.statementLineId);
    if (!required(res, Boolean(statementLineId), "Select a statement line.")) return;

    const result = await unmatchLine(prisma, ctx, { bankAccountId: param(req, "bankAccountId"), statementLineId });
    res.json({ success: true, ...result });
  } catch (error) {
    failure(res, error, "UNMATCH");
  }
};

export const autoMatchStatementLines = async (req: AuthRequest, res: Response) => {
  const ctx = context(req, res);
  if (!ctx) return;

  try {
    const result = await autoMatch(prisma, ctx, { bankAccountId: param(req, "bankAccountId"), asOf: parseAsOf(req.body?.asOf) });
    res.json({ success: true, ...result });
  } catch (error) {
    failure(res, error, "AUTO MATCH");
  }
};

export const createEntryFromStatementLine = async (req: AuthRequest, res: Response) => {
  const ctx = context(req, res);
  if (!ctx) return;

  try {
    const statementLineId = text(req.body?.statementLineId);
    const counterAccountId = text(req.body?.counterAccountId);
    if (!required(res, Boolean(statementLineId && counterAccountId), "Select the statement line and the account to post against.")) return;

    const result = await createEntryForStatementLine(prisma, ctx, {
      bankAccountId: param(req, "bankAccountId"),
      statementLineId,
      counterAccountId,
      description: text(req.body?.description),
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    failure(res, error, "CREATE ENTRY");
  }
};

export const completeBankReconciliation = async (req: AuthRequest, res: Response) => {
  const ctx = context(req, res);
  if (!ctx) return;

  try {
    const statementBalance = Number(req.body?.statementBalance);
    if (!required(res, req.body?.statementBalance !== "" && Number.isFinite(statementBalance), "Enter the statement closing balance.")) return;

    const result = await completeReconciliation(prisma, ctx, {
      bankAccountId: param(req, "bankAccountId"),
      asOf: parseAsOf(req.body?.asOf),
      statementBalance,
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    failure(res, error, "COMPLETE");
  }
};

export const reopenBankReconciliation = async (req: AuthRequest, res: Response) => {
  const ctx = context(req, res);
  if (!ctx) return;

  try {
    const result = await reopenReconciliation(prisma, ctx, {
      bankAccountId: param(req, "bankAccountId"),
      reconciliationId: param(req, "reconciliationId"),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    failure(res, error, "REOPEN");
  }
};

export const getReconciliationHistory = async (req: AuthRequest, res: Response) => {
  const ctx = context(req, res);
  if (!ctx) return;

  try {
    const history = await listReconciliations(prisma, ctx.organizationId, param(req, "bankAccountId"));
    res.json({ success: true, history });
  } catch (error) {
    failure(res, error, "HISTORY");
  }
};