import { Response } from "express";
import { createHash } from "crypto";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   BANK STATEMENTS
   - Import statement lines for a bank account
   - Read PDF statements with Claude (preview only)
   - List, view and delete statements
========================================================= */

const MAX_LINES_PER_IMPORT = 5000;
const MAX_PDF_BASE64_LENGTH = 9_000_000;

function getOrganizationId(req: AuthRequest): string | null {
  return req.user?.organizationId ?? null;
}

function getUserId(req: AuthRequest): string | null {
  return req.user?.userId ?? null;
}

function getRouteId(req: AuthRequest): string | null {
  const rawId = req.params.id;

  if (Array.isArray(rawId)) return rawId[0] ?? null;

  return rawId ?? null;
}

function fail(
  res: Response,
  status: number,
  code: string,
  message: string
) {
  return res.status(status).json({ success: false, code, message });
}

function isValidYmd(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

interface IncomingLine {
  date?: unknown;
  description?: unknown;
  reference?: unknown;
  amount?: unknown;
  balance?: unknown;
}

/* =========================================================
   IMPORT STATEMENT
   POST /api/bank-statements/import
========================================================= */

export const importBankStatement = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication required.");
    }

    const {
      bankAccountId,
      fileName,
      sourceType,
      lines,
      openingBalance,
      closingBalance,
    } = req.body ?? {};

    if (typeof bankAccountId !== "string" || !bankAccountId.trim()) {
      return fail(res, 400, "BANK_ACCOUNT_REQUIRED", "Select a bank account.");
    }

    if (!["CSV", "EXCEL", "PDF"].includes(String(sourceType))) {
      return fail(res, 400, "INVALID_SOURCE", "Invalid statement source type.");
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return fail(
        res,
        400,
        "NO_LINES",
        "The statement has no transactions to import."
      );
    }

    if (lines.length > MAX_LINES_PER_IMPORT) {
      return fail(
        res,
        400,
        "TOO_MANY_LINES",
        `A statement can have at most ${MAX_LINES_PER_IMPORT} transactions.`
      );
    }

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId.trim(), organizationId, status: "ACTIVE" },
      select: { id: true },
    });

    if (!bankAccount) {
      return fail(res, 404, "BANK_ACCOUNT_NOT_FOUND", "Bank account not found.");
    }

    const seen = new Map<string, number>();
    const rows: {
      transactionDate: Date;
      description: string;
      reference: string | null;
      amount: number;
      balance: number | null;
      fingerprint: string;
    }[] = [];

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] as IncomingLine;
      const amount = toNumberOrNull(line.amount);

      if (!isValidYmd(line.date)) {
        return fail(
          res,
          400,
          "INVALID_DATE",
          `Row ${i + 1} has an invalid date.`
        );
      }

      if (amount === null || amount === 0) {
        return fail(
          res,
          400,
          "INVALID_AMOUNT",
          `Row ${i + 1} has an invalid amount.`
        );
      }

      const description = String(line.description ?? "")
        .trim()
        .slice(0, 500);
      const reference = String(line.reference ?? "").trim().slice(0, 100);
      const balance = toNumberOrNull(line.balance);

      const baseKey = [
        line.date,
        amount.toFixed(2),
        description.toLowerCase().replace(/\s+/g, " "),
        reference.toLowerCase(),
        balance === null ? "" : balance.toFixed(2),
      ].join("|");

      /*
       * Two genuine identical transactions in the same file get
       * different fingerprints, while importing the same file
       * twice is still detected as a duplicate.
       */
      const occurrence = (seen.get(baseKey) ?? 0) + 1;
      seen.set(baseKey, occurrence);

      rows.push({
        transactionDate: new Date(`${line.date}T00:00:00.000Z`),
        description: description || "(no description)",
        reference: reference || null,
        amount: Math.round(amount * 100) / 100,
        balance,
        fingerprint: createHash("sha256")
          .update(`${baseKey}#${occurrence}`)
          .digest("hex"),
      });
    }

    const dates = rows.map((r) => r.transactionDate.getTime());
    const periodStart = new Date(Math.min(...dates));
    const periodEnd = new Date(Math.max(...dates));

    const result = await prisma.$transaction(async (tx) => {
      const statement = await tx.bankStatement.create({
        data: {
          organizationId,
          bankAccountId: bankAccount.id,
          fileName:
            typeof fileName === "string" && fileName.trim()
              ? fileName.trim().slice(0, 255)
              : "statement",
          sourceType: String(sourceType),
          periodStart,
          periodEnd,
          openingBalance: toNumberOrNull(openingBalance),
          closingBalance: toNumberOrNull(closingBalance),
          lineCount: 0,
          importedBy: getUserId(req),
        },
      });

      const created = await tx.bankStatementLine.createMany({
        data: rows.map((r) => ({
          organizationId,
          bankAccountId: bankAccount.id,
          statementId: statement.id,
          ...r,
        })),
        skipDuplicates: true,
      });

      if (created.count === 0) {
        await tx.bankStatement.delete({ where: { id: statement.id } });

        return { statement: null, imported: 0 };
      }

      const updated = await tx.bankStatement.update({
        where: { id: statement.id },
        data: { lineCount: created.count },
      });

      return { statement: updated, imported: created.count };
    });

    if (!result.statement) {
      return fail(
        res,
        409,
        "ALREADY_IMPORTED",
        "All of these transactions were already imported for this bank account."
      );
    }

    return res.status(201).json({
      success: true,
      statement: result.statement,
      imported: result.imported,
      skipped: rows.length - result.imported,
    });
  } catch (error: unknown) {
    console.error("[BANK STATEMENT] IMPORT ERROR:", error);

    return fail(
      res,
      500,
      "STATEMENT_IMPORT_FAILED",
      "Failed to import the bank statement."
    );
  }
};

/* =========================================================
   READ PDF STATEMENT WITH CLAUDE (PREVIEW ONLY)
   POST /api/bank-statements/parse-pdf
========================================================= */

const PDF_SYSTEM_PROMPT =
  "You are a precise data extraction tool for bank statements. " +
  "Extract every transaction row from the attached bank statement PDF. " +
  "Respond with ONLY a JSON object, with no prose and no markdown, in this exact shape: " +
  '{"transactions":[{"date":"YYYY-MM-DD","description":"text","reference":"text or empty","amount":0,"balance":0}]}. ' +
  "Rules: amount is positive for money received (credits, deposits) and negative for money paid out (debits, withdrawals). " +
  "Dates on the statement are day-first (DD/MM/YYYY) unless the statement clearly uses another format; always output YYYY-MM-DD. " +
  "Do not include opening or closing balance rows, totals or headings. " +
  "Use null for balance when the statement does not show a running balance. " +
  "Never invent or guess transactions.";

export const parseBankStatementPdf = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication required.");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

    if (!apiKey) {
      return fail(
        res,
        503,
        "AI_API_KEY_NOT_CONFIGURED",
        "Reading PDF statements needs the AI service. Please upload a CSV or Excel statement instead."
      );
    }

    const { contentBase64 } = req.body ?? {};

    if (typeof contentBase64 !== "string" || !contentBase64.startsWith("JVBER")) {
      return fail(res, 400, "INVALID_PDF", "Please upload a valid PDF file.");
    }

    if (contentBase64.length > MAX_PDF_BASE64_LENGTH) {
      return fail(
        res,
        413,
        "PDF_TOO_LARGE",
        "This PDF is too large. Upload a smaller file or a CSV/Excel statement."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let response: globalThis.Response;

    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5",
          max_tokens: 12000,
          system: PDF_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: contentBase64,
                  },
                },
                { type: "text", text: "Extract all transactions as JSON." },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return fail(res, 504, "AI_TIMEOUT", "Reading the PDF took too long. Try a CSV or Excel statement.");
      }

      console.error("[BANK STATEMENT] CLAUDE NETWORK ERROR:", error);

      return fail(res, 502, "AI_NETWORK_ERROR", "Could not reach the AI service.");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");

      console.error("[BANK STATEMENT] CLAUDE ERROR:", response.status, body.slice(0, 500));

      if (response.status === 401 || response.status === 403) {
        return fail(res, 502, "AI_API_KEY_INVALID", "The AI service key is not valid.");
      }

      if (response.status === 429) {
        return fail(res, 429, "AI_RATE_LIMITED", "The AI service is busy. Try again shortly.");
      }

      return fail(res, 502, "AI_REQUEST_FAILED", "The AI service could not read this PDF.");
    }

    const data = (await response.json()) as {
      stop_reason?: string;
      content?: { type?: string; text?: string }[];
    };

    if (data.stop_reason === "max_tokens") {
      return fail(
        res,
        422,
        "PDF_TOO_LONG",
        "This statement is too long to read in one go. Split it into smaller PDFs or use CSV/Excel."
      );
    }

    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n");

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    let parsed: { transactions?: IncomingLine[] } = {};

    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      return fail(res, 422, "PDF_UNREADABLE", "Could not read transactions from this PDF.");
    }

    const lines = (parsed.transactions ?? [])
      .map((t) => ({
        date: t.date,
        description: String(t.description ?? "").trim(),
        reference: String(t.reference ?? "").trim(),
        amount: toNumberOrNull(t.amount),
        balance: toNumberOrNull(t.balance),
      }))
      .filter((t) => isValidYmd(t.date) && t.amount !== null && t.amount !== 0);

    if (lines.length === 0) {
      return fail(res, 422, "NO_TRANSACTIONS_FOUND", "No transactions were found in this PDF.");
    }

    return res.status(200).json({ success: true, lines });
  } catch (error: unknown) {
    console.error("[BANK STATEMENT] PDF PARSE ERROR:", error);

    return fail(res, 500, "PDF_PARSE_FAILED", "Failed to read the PDF statement.");
  }
};

/* =========================================================
   LIST STATEMENTS
   GET /api/bank-statements?bankAccountId=
========================================================= */

export const listBankStatements = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication required.");
    }

    const bankAccountId =
      typeof req.query.bankAccountId === "string"
        ? req.query.bankAccountId.trim()
        : "";

    const statements = await prisma.bankStatement.findMany({
      where: {
        organizationId,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return res.status(200).json({ success: true, statements });
  } catch (error: unknown) {
    console.error("[BANK STATEMENT] LIST ERROR:", error);

    return fail(res, 500, "STATEMENT_LIST_FAILED", "Failed to load statements.");
  }
};

/* =========================================================
   STATEMENT LINES
   GET /api/bank-statements/:id/lines
========================================================= */

export const getBankStatementLines = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication required.");
    }

    const id = getRouteId(req);

    if (!id) {
      return fail(res, 400, "STATEMENT_ID_REQUIRED", "Statement ID is required.");
    }

    const statement = await prisma.bankStatement.findFirst({
      where: { id, organizationId },
    });

    if (!statement) {
      return fail(res, 404, "STATEMENT_NOT_FOUND", "Statement not found.");
    }

    const lines = await prisma.bankStatementLine.findMany({
      where: { statementId: statement.id, organizationId },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
      take: MAX_LINES_PER_IMPORT,
    });

    return res.status(200).json({ success: true, statement, lines });
  } catch (error: unknown) {
    console.error("[BANK STATEMENT] LINES ERROR:", error);

    return fail(res, 500, "STATEMENT_LINES_FAILED", "Failed to load statement lines.");
  }
};

/* =========================================================
   DELETE STATEMENT
   DELETE /api/bank-statements/:id
   Blocked once any line has been matched or reconciled.
========================================================= */

export const deleteBankStatement = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return fail(res, 401, "AUTH_REQUIRED", "Authentication required.");
    }

    const id = getRouteId(req);

    if (!id) {
      return fail(res, 400, "STATEMENT_ID_REQUIRED", "Statement ID is required.");
    }

    const statement = await prisma.bankStatement.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!statement) {
      return fail(res, 404, "STATEMENT_NOT_FOUND", "Statement not found.");
    }

    const matched = await prisma.bankStatementLine.count({
      where: {
        statementId: statement.id,
        organizationId,
        matchStatus: { not: "UNMATCHED" },
      },
    });

    if (matched > 0) {
      return fail(
        res,
        409,
        "STATEMENT_IN_USE",
        "This statement has matched or reconciled transactions and cannot be deleted."
      );
    }

    await prisma.bankStatement.delete({ where: { id: statement.id } });

    return res.status(200).json({ success: true, message: "Statement deleted." });
  } catch (error: unknown) {
    console.error("[BANK STATEMENT] DELETE ERROR:", error);

    return fail(res, 500, "STATEMENT_DELETE_FAILED", "Failed to delete the statement.");
  }
};
