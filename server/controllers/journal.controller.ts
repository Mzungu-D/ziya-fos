import { Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { ACCOUNTING_TOLERANCE } from "../utils/accounting";

/* =========================================================
   JOURNAL CONTROLLER - PRODUCTION

   Principles:
   - Every operation is tenant-scoped.
   - JournalEntryLine is the authoritative accounting detail.
   - Posted/approved journals are immutable; corrections use reversals.
   - Debits and credits must balance before posting/approval.
   - Accounts must belong to the authenticated organization.
   - Monetary values are normalized to two decimal places while the
     current Prisma schema remains Float-based.
   - References are generated server-side under a PostgreSQL advisory
     transaction lock to prevent concurrent collisions per tenant.
   ========================================================= */

const DRAFT = "DRAFT" as const;
const POSTED = "POSTED" as const;
const APPROVED = "APPROVED" as const;
const REVERSED = "REVERSED" as const;
const MAX_LINES = 500;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_NOTES_LENGTH = 5000;
const MAX_MEMO_LENGTH = 1000;
const MAX_REVERSAL_REASON_LENGTH = 1000;

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) return null;
  return { userId: req.user.userId, organizationId: req.user.organizationId };
}

function cleanString(value: unknown, maxLength: number): string {
  return String(value ?? "").trim();
}

function validateStringLength(value: string, field: string, maxLength: number): string | null {
  if (value.length > maxLength) {
    return `${field} cannot exceed ${maxLength} characters`;
  }
  return null;
}

function parseTransactionDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return new Date();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type JournalLineInput = {
  accountId?: unknown;
  memo?: unknown;
  debit?: unknown;
  credit?: unknown;
};

function parseLines(value: unknown): JournalLineInput[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((line) => ({
    accountId: line?.accountId,
    memo: line?.memo,
    debit: line?.debit,
    credit: line?.credit,
  }));
}

function normalizeLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.map((line) => ({
    accountId: cleanString(line.accountId, 100),
    memo: cleanString(line.memo, MAX_MEMO_LENGTH) || null,
    debit: roundMoney(Number(line.debit ?? 0)),
    credit: roundMoney(Number(line.credit ?? 0)),
  }));
}

function lineTotals(lines: JournalLineInput[]) {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit = roundMoney(debit + Number(line.debit ?? 0));
    credit = roundMoney(credit + Number(line.credit ?? 0));
  }
  return { debit, credit, difference: roundMoney(Math.abs(debit - credit)) };
}

function validateLines(lines: JournalLineInput[], requireBalanced: boolean) {
  if (lines.length < 2) return "A journal entry must contain at least two lines";
  if (lines.length > MAX_LINES) {
    return `A journal entry cannot contain more than ${MAX_LINES} lines`;
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const accountId = cleanString(line.accountId, 100);
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    if (!accountId) return `Line ${index + 1}: account is required`;
    const memo = cleanString(line.memo, MAX_MEMO_LENGTH);
    if (memo.length > MAX_MEMO_LENGTH) {
      return `Line ${index + 1}: memo cannot exceed ${MAX_MEMO_LENGTH} characters`;
    }
    if (!Number.isFinite(debit) || debit < 0) {
      return `Line ${index + 1}: debit must be a valid non-negative amount`;
    }
    if (!Number.isFinite(credit) || credit < 0) {
      return `Line ${index + 1}: credit must be a valid non-negative amount`;
    }
    if (debit > 0 && credit > 0) {
      return `Line ${index + 1}: a line cannot contain both debit and credit`;
    }
    if (debit === 0 && credit === 0) {
      return `Line ${index + 1}: either debit or credit must be greater than zero`;
    }

    totalDebit = roundMoney(totalDebit + debit);
    totalCredit = roundMoney(totalCredit + credit);
  }

  if (requireBalanced && Math.abs(totalDebit - totalCredit) > ACCOUNTING_TOLERANCE) {
    return `Journal is not balanced. Debit: ${roundMoney(totalDebit)}, Credit: ${roundMoney(totalCredit)}`;
  }

  return null;
}

async function validateTenantAccounts(
  organizationId: string,
  lines: JournalLineInput[],
  db: Pick<Prisma.TransactionClient, "account"> = prisma
) {
  const accountIds = [...new Set(lines.map((line) => cleanString(line.accountId, 100)))];
  if (!accountIds.length) return null;

  const accounts = await db.account.findMany({
    where: { organizationId, id: { in: accountIds } },
    select: { id: true, code: true, name: true, type: true, parentId: true },
  });

  if (accounts.length !== accountIds.length) return null;
  return accounts;
}

function getFirstPostingAccounts(lines: JournalLineInput[]) {
  const debit = lines.find((line) => Number(line.debit ?? 0) > 0)?.accountId;
  const credit = lines.find((line) => Number(line.credit ?? 0) > 0)?.accountId;
  return {
    debitAccountId: cleanString(debit, 100),
    creditAccountId: cleanString(credit, 100),
  };
}

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function errorResponse(res: Response, error: unknown, fallback: string) {
  if (isPrismaKnownError(error, "P2002")) {
    return res.status(409).json({
      success: false,
      message: "The journal reference already exists. Please retry the operation.",
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

async function generateJournalReference(
  tx: Prisma.TransactionClient,
  organizationId: string,
  prefix = "JE"
): Promise<string> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${organizationId + ":" + prefix}, 0))
  `;

  const existing = await tx.journalEntry.findMany({
    where: {
      organizationId,
      reference: { startsWith: `${prefix}-` },
    },
    select: { reference: true },
  });

  let highest = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);

  for (const row of existing) {
    const match = pattern.exec(row.reference.trim());
    if (!match) continue;
    const number = Number(match[1]);
    if (Number.isSafeInteger(number) && number > highest) highest = number;
  }

  return `${prefix}-${String(highest + 1).padStart(6, "0")}`;
}

async function generateReversalReference(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<string> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${organizationId + ":REV"}, 0))
  `;

  const existing = await tx.journalEntry.findMany({
    where: { organizationId, reference: { startsWith: "REV-" } },
    select: { reference: true },
  });

  let highest = 0;
  for (const row of existing) {
    const match = /^REV-(\d+)$/.exec(row.reference.trim());
    if (!match) continue;
    const number = Number(match[1]);
    if (Number.isSafeInteger(number) && number > highest) highest = number;
  }

  return `REV-${String(highest + 1).padStart(6, "0")}`;
}

const journalInclude = {
  debitAccount: true,
  creditAccount: true,
  lines: {
    include: { account: true },
    orderBy: { lineNumber: "asc" as const },
  },
};

/* =========================================================
   CREATE
========================================================= */
export const createJournalEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = getTenantContext(req);
    if (!tenant) return res.status(401).json({ success: false, message: "Authentication required" });

    const description = cleanString(req.body?.description, MAX_DESCRIPTION_LENGTH);
    const notes = cleanString(req.body?.notes, MAX_NOTES_LENGTH);
    const parsedDate = parseTransactionDate(req.body?.transactionDate);
    const rawLines = parseLines(req.body?.lines);

    if (!description) return res.status(400).json({ success: false, message: "Description is required" });
    const descriptionLengthError = validateStringLength(description, "Description", MAX_DESCRIPTION_LENGTH);
    if (descriptionLengthError) return res.status(400).json({ success: false, message: descriptionLengthError });
    const notesLengthError = validateStringLength(notes, "Notes", MAX_NOTES_LENGTH);
    if (notesLengthError) return res.status(400).json({ success: false, message: notesLengthError });
    if (!rawLines) return res.status(400).json({ success: false, message: "Journal lines are required" });
    if (!parsedDate) return res.status(400).json({ success: false, message: "Invalid transaction date" });

    const lines = normalizeLines(rawLines);
    const lineError = validateLines(lines, false);
    if (lineError) return res.status(400).json({ success: false, message: lineError });

    const accounts = await validateTenantAccounts(tenant.organizationId, lines);
    if (!accounts) {
      return res.status(400).json({ success: false, message: "One or more accounts do not belong to this organization" });
    }

    const entry = await prisma.$transaction(async (tx) => {
      const reference = await generateJournalReference(tx, tenant.organizationId, "JE");
      const totals = lineTotals(lines);
      const postingAccounts = getFirstPostingAccounts(lines);

      if (!postingAccounts.debitAccountId || !postingAccounts.creditAccountId) {
        throw new Error("Journal must contain at least one debit and one credit line");
      }

      const created = await tx.journalEntry.create({
        data: {
          organizationId: tenant.organizationId,
          reference,
          transactionDate: parsedDate,
          description,
          debitAccountId: postingAccounts.debitAccountId,
          creditAccountId: postingAccounts.creditAccountId,
          amount: totals.debit,
          notes: notes || null,
          status: DRAFT,
          createdBy: tenant.userId,
          lines: {
            create: lines.map((line, index) => ({
              accountId: String(line.accountId),
              lineNumber: index + 1,
              memo: line.memo ? String(line.memo) : null,
              debit: Number(line.debit ?? 0),
              credit: Number(line.credit ?? 0),
            })),
          },
        },
        include: journalInclude,
      });

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "CREATE",
          module: "JOURNAL",
          details: `Created draft journal ${created.reference} (${created.id})`,
        },
      });

      return created;
    });

    return res.status(201).json({ success: true, message: "Journal entry created successfully", entry });
  } catch (error) {
    return errorResponse(res, error, "Failed to create journal entry");
  }
};

/* =========================================================
   LIST
========================================================= */
export const getJournalEntries = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = getTenantContext(req);
    if (!tenant) return res.status(401).json({ success: false, message: "Authentication required" });

    const requestedLimit = Number(req.query.limit ?? 100);
    const requestedOffset = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500)
      : 100;
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(Math.trunc(requestedOffset), 0)
      : 0;

    const status = cleanString(req.query.status, 30);
    const search = cleanString(req.query.search, 200);

    const where = {
      organizationId: tenant.organizationId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [entries, total] = await prisma.$transaction([
      prisma.journalEntry.findMany({
        where,
        include: journalInclude,
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: limit,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      entries,
      pagination: { total, limit, offset, hasMore: offset + entries.length < total },
    });
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch journal entries");
  }
};

/* =========================================================
   GET ONE
========================================================= */
export const getJournalEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = getTenantContext(req);
    if (!tenant) return res.status(401).json({ success: false, message: "Authentication required" });

    const id = cleanString(req.params.id, 100);
    const entry = await prisma.journalEntry.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: journalInclude,
    });

    if (!entry) return res.status(404).json({ success: false, message: "Journal entry not found" });
    return res.status(200).json({ success: true, entry });
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch journal entry");
  }
};

/* =========================================================
   UPDATE DRAFT
========================================================= */
export const updateJournalEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = getTenantContext(req);
    if (!tenant) return res.status(401).json({ success: false, message: "Authentication required" });

    const id = cleanString(req.params.id, 100);
    const existing = await prisma.journalEntry.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

    if (!existing) return res.status(404).json({ success: false, message: "Journal entry not found" });
    if (existing.status !== DRAFT) {
      return res.status(400).json({ success: false, message: "Only draft journal entries can be edited" });
    }

    const description = req.body?.description !== undefined
      ? cleanString(req.body.description, MAX_DESCRIPTION_LENGTH)
      : existing.description;
    const notes = req.body?.notes !== undefined
      ? cleanString(req.body.notes, MAX_NOTES_LENGTH)
      : existing.notes ?? "";
    const parsedDate = req.body?.transactionDate !== undefined
      ? parseTransactionDate(req.body.transactionDate)
      : existing.transactionDate;

    if (!description) return res.status(400).json({ success: false, message: "Description is required" });
    const descriptionLengthError = validateStringLength(description, "Description", MAX_DESCRIPTION_LENGTH);
    if (descriptionLengthError) return res.status(400).json({ success: false, message: descriptionLengthError });
    const notesLengthError = validateStringLength(notes, "Notes", MAX_NOTES_LENGTH);
    if (notesLengthError) return res.status(400).json({ success: false, message: notesLengthError });
    if (!parsedDate) return res.status(400).json({ success: false, message: "Invalid transaction date" });

    const rawLines = req.body?.lines !== undefined
      ? parseLines(req.body.lines)
      : existing.lines.map((line) => ({
          accountId: line.accountId,
          memo: line.memo,
          debit: line.debit,
          credit: line.credit,
        }));

    if (!rawLines) return res.status(400).json({ success: false, message: "Journal lines are required" });
    const lines = normalizeLines(rawLines);
    const lineError = validateLines(lines, false);
    if (lineError) return res.status(400).json({ success: false, message: lineError });

    const accounts = await validateTenantAccounts(tenant.organizationId, lines);
    if (!accounts) return res.status(400).json({ success: false, message: "One or more accounts do not belong to this organization" });

    const postingAccounts = getFirstPostingAccounts(lines);
    if (!postingAccounts.debitAccountId || !postingAccounts.creditAccountId) {
      return res.status(400).json({ success: false, message: "Journal must contain at least one debit and one credit line" });
    }

    const entry = await prisma.$transaction(async (tx) => {
      const locked = await tx.journalEntry.findFirst({
        where: { id, organizationId: tenant.organizationId },
        select: { id: true, status: true, reference: true },
      });
      if (!locked || locked.status !== DRAFT) throw new Error("Only draft journal entries can be edited");

      await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id } });

      const totals = lineTotals(lines);
      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          transactionDate: parsedDate,
          description,
          notes: notes || null,
          debitAccountId: postingAccounts.debitAccountId,
          creditAccountId: postingAccounts.creditAccountId,
          amount: totals.debit,
          lines: {
            create: lines.map((line, index) => ({
              accountId: String(line.accountId),
              lineNumber: index + 1,
              memo: line.memo ? String(line.memo) : null,
              debit: Number(line.debit ?? 0),
              credit: Number(line.credit ?? 0),
            })),
          },
        },
        include: journalInclude,
      });

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "UPDATE",
          module: "JOURNAL",
          details: `Updated draft journal ${updated.reference} (${updated.id})`,
        },
      });
      return updated;
    });

    return res.status(200).json({ success: true, message: "Journal entry updated successfully", entry });
  } catch (error) {
    return errorResponse(res, error, "Failed to update journal entry");
  }
};

/* =========================================================
   POST
========================================================= */
export const postJournalEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = getTenantContext(req);
    if (!tenant) return res.status(401).json({ success: false, message: "Authentication required" });

    const id = cleanString(req.params.id, 100);
    const existing = await prisma.journalEntry.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

    if (!existing) return res.status(404).json({ success: false, message: "Journal entry not found" });
    if (existing.status !== DRAFT) return res.status(400).json({ success: false, message: "Only draft entries can be posted" });

    const lines = normalizeLines(existing.lines.map((line) => ({
      accountId: line.accountId,
      memo: line.memo,
      debit: line.debit,
      credit: line.credit,
    })));
    const lineError = validateLines(lines, true);
    if (lineError) return res.status(400).json({ success: false, message: lineError });

    const accounts = await validateTenantAccounts(tenant.organizationId, lines);
    if (!accounts) return res.status(400).json({ success: false, message: "One or more journal accounts are invalid" });

    const result = await prisma.$transaction(async (tx) => {
      const postedAt = new Date();
      const updatedResult = await tx.journalEntry.updateMany({
        where: { id, organizationId: tenant.organizationId, status: DRAFT },
        data: { status: POSTED, postedAt, postedBy: tenant.userId },
      });
      if (updatedResult.count !== 1) throw new Error("Journal entry was already posted or is no longer available for posting");

      const updated = await tx.journalEntry.findFirst({
        where: { id, organizationId: tenant.organizationId },
        include: journalInclude,
      });
      if (!updated) throw new Error("Posted journal entry could not be retrieved");

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "POST",
          module: "JOURNAL",
          details: `Posted journal ${updated.reference} (${updated.id})`,
        },
      });
      return updated;
    });

    return res.status(200).json({ success: true, message: "Journal entry posted successfully", entry: result });
  } catch (error) {
    return errorResponse(res, error, "Failed to post journal entry");
  }
};

/* =========================================================
   APPROVE
========================================================= */
export const approveJournalEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = getTenantContext(req);
    if (!tenant) return res.status(401).json({ success: false, message: "Authentication required" });

    const id = cleanString(req.params.id, 100);
    const existing = await prisma.journalEntry.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

    if (!existing) return res.status(404).json({ success: false, message: "Journal entry not found" });
    if (existing.status !== POSTED) return res.status(400).json({ success: false, message: "Only posted journal entries can be approved" });

    const lines = normalizeLines(existing.lines.map((line) => ({
      accountId: line.accountId,
      memo: line.memo,
      debit: line.debit,
      credit: line.credit,
    })));
    const lineError = validateLines(lines, true);
    if (lineError) return res.status(400).json({ success: false, message: lineError });

    const accounts = await validateTenantAccounts(tenant.organizationId, lines);
    if (!accounts) return res.status(400).json({ success: false, message: "One or more journal accounts are invalid" });

    const result = await prisma.$transaction(async (tx) => {
      const approvedAt = new Date();
      const updatedResult = await tx.journalEntry.updateMany({
        where: { id, organizationId: tenant.organizationId, status: POSTED },
        data: { status: APPROVED, approvedAt, approvedBy: tenant.userId },
      });
      if (updatedResult.count !== 1) throw new Error("Journal entry was already approved or is no longer available for approval");

      const updated = await tx.journalEntry.findFirst({
        where: { id, organizationId: tenant.organizationId },
        include: journalInclude,
      });
      if (!updated) throw new Error("Approved journal entry could not be retrieved");

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "APPROVE",
          module: "JOURNAL",
          details: `Approved journal ${updated.reference} (${updated.id})`,
        },
      });
      return updated;
    });

    return res.status(200).json({ success: true, message: "Journal entry approved successfully", entry: result });
  } catch (error) {
    return errorResponse(res, error, "Failed to approve journal entry");
  }
};

/* =========================================================
   REVERSE APPROVED JOURNAL
========================================================= */
export const reverseJournalEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = getTenantContext(req);
    if (!tenant) return res.status(401).json({ success: false, message: "Authentication required" });

    const id = cleanString(req.params.id, 100);
    const reason = cleanString(req.body?.reason, MAX_REVERSAL_REASON_LENGTH) || "Journal reversal";
    const reasonLengthError = validateStringLength(reason, "Reversal reason", MAX_REVERSAL_REASON_LENGTH);
    if (reasonLengthError) return res.status(400).json({ success: false, message: reasonLengthError });
    const reversalDate = parseTransactionDate(req.body?.reversalDate);
    if (!reversalDate) return res.status(400).json({ success: false, message: "Invalid reversal date" });

    const original = await prisma.journalEntry.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

    if (!original) return res.status(404).json({ success: false, message: "Journal entry not found" });
    if (original.status !== APPROVED) return res.status(400).json({ success: false, message: "Only approved journal entries can be reversed" });
    if (original.reversedAt) {
      return res.status(400).json({ success: false, message: "Journal entry has already been reversed" });
    }
    if (original.lines.length < 2) {
      return res.status(409).json({ success: false, message: "This journal does not contain valid multi-line accounting data and cannot be reversed" });
    }

    const lines = normalizeLines(original.lines.map((line) => ({
      accountId: line.accountId,
      memo: line.memo,
      debit: line.credit,
      credit: line.debit,
    })));
    const lineError = validateLines(lines, true);
    if (lineError) return res.status(400).json({ success: false, message: lineError });

    const accounts = await validateTenantAccounts(tenant.organizationId, lines);
    if (!accounts) return res.status(409).json({ success: false, message: "Journal accounts are not valid for this organization" });

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${tenant.organizationId + ":REVERSAL:" + original.id}, 0))
      `;

      const lockedOriginal = await tx.journalEntry.findFirst({
        where: { id: original.id, organizationId: tenant.organizationId },
        include: { lines: { orderBy: { lineNumber: "asc" } } },
      });

      if (!lockedOriginal) throw new Error("Journal entry not found");
      if (lockedOriginal.status !== APPROVED || lockedOriginal.reversedAt) {
        throw new Error("Journal entry was already reversed or is no longer eligible for reversal");
      }

      const reversalReference = await generateReversalReference(tx, tenant.organizationId);
      const totals = lineTotals(lines);
      const postingAccounts = getFirstPostingAccounts(lines);
      if (!postingAccounts.debitAccountId || !postingAccounts.creditAccountId) {
        throw new Error("Unable to construct reversal lines");
      }

      const reversal = await tx.journalEntry.create({
        data: {
          organizationId: tenant.organizationId,
          reference: reversalReference,
          transactionDate: reversalDate,
          description: `Reversal: ${lockedOriginal.description}`.slice(0, MAX_DESCRIPTION_LENGTH),
          debitAccountId: postingAccounts.debitAccountId,
          creditAccountId: postingAccounts.creditAccountId,
          amount: totals.debit,
          status: APPROVED,
          createdBy: tenant.userId,
          postedBy: tenant.userId,
          approvedBy: tenant.userId,
          postedAt: reversalDate,
          approvedAt: reversalDate,
          reversalOfId: lockedOriginal.id,
          reversalReason: reason,
          notes: `Reversal of ${lockedOriginal.reference}`,
          lines: {
            create: lines.map((line, index) => ({
              accountId: String(line.accountId),
              lineNumber: index + 1,
              memo: line.memo ? `Reversal: ${String(line.memo)}`.slice(0, MAX_MEMO_LENGTH) : "Journal reversal",
              debit: Number(line.debit ?? 0),
              credit: Number(line.credit ?? 0),
            })),
          },
        },
        include: journalInclude,
      });

      const originalUpdate = await tx.journalEntry.updateMany({
        where: {
          id: lockedOriginal.id,
          organizationId: tenant.organizationId,
          status: APPROVED,
          reversedAt: null,
        },
        data: {
          status: REVERSED,
          reversedAt: reversalDate,
          reversedBy: tenant.userId,
          reversalReason: reason,
        },
      });

      if (originalUpdate.count !== 1) throw new Error("Journal entry was already reversed or is no longer eligible for reversal");

      const updatedOriginal = await tx.journalEntry.findFirst({
        where: { id: lockedOriginal.id, organizationId: tenant.organizationId },
        include: journalInclude,
      });
      if (!updatedOriginal) throw new Error("Reversed journal entry could not be retrieved");

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "REVERSE",
          module: "JOURNAL",
          details: `Reversed journal ${lockedOriginal.reference} (${lockedOriginal.id}) with ${reversal.reference} (${reversal.id}). Reason: ${reason}`,
        },
      });

      return { reversal, original: updatedOriginal };
    });

    return res.status(200).json({ success: true, message: "Journal entry reversed successfully", ...result });
  } catch (error) {
    return errorResponse(res, error, "Failed to reverse journal entry");
  }
};

/* =========================================================
   DELETE DRAFT ONLY
========================================================= */
export const deleteJournalEntry = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = getTenantContext(req);
    if (!tenant) return res.status(401).json({ success: false, message: "Authentication required" });

    const id = cleanString(req.params.id, 100);
    const entry = await prisma.journalEntry.findFirst({
      where: { id, organizationId: tenant.organizationId },
      select: { id: true, reference: true, status: true },
    });

    if (!entry) return res.status(404).json({ success: false, message: "Journal entry not found" });
    if (entry.status !== DRAFT) {
      return res.status(400).json({ success: false, message: "Only draft journal entries can be deleted. Posted records must follow the reversal process." });
    }

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.journalEntry.deleteMany({
        where: { id, organizationId: tenant.organizationId, status: DRAFT },
      });
      if (deleted.count !== 1) throw new Error("Journal entry was changed or is no longer available for deletion");

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "DELETE",
          module: "JOURNAL",
          details: `Deleted draft journal ${entry.reference} (${entry.id})`,
        },
      });
    });

    return res.status(200).json({ success: true, message: "Draft journal entry deleted successfully" });
  } catch (error) {
    return errorResponse(res, error, "Failed to delete journal entry");
  }
};
