import { Prisma, PrismaClient } from "@prisma/client";

import { roundAccounting } from "../utils/accounting";
import { AccountRoleError } from "./accountRoles.service";

/* =========================================================
   BANK RECONCILIATION (multi-tenant)

   Sign convention: a statement line amount is positive for money
   IN and negative for money OUT. For the bank's ledger account
   that equals (debit - credit) of the matching journal line.

   Reconciled when, as of the statement date:

     adjusted bank = statement balance + unmatched ledger items
                     (deposits in transit +, outstanding payments -)
     adjusted book = book balance + unmatched statement items
                     (bank fees -, interest +)
     difference    = adjusted bank - adjusted book  must be 0

   and every statement line up to that date is matched
   (bank-only items must first be recorded in the books).
========================================================= */

const EFFECTIVE = ["POSTED", "APPROVED"];
const MATCH_WINDOW_DAYS = 3;
const MAX_LIST = 500;
const OPENING_PREFIX = "OPENING-";

type Tx = Prisma.TransactionClient;
type Ctx = { organizationId: string; userId: string | null };

const bad = (code: string, message: string, status = 400) => new AccountRoleError(code, message, status);
export const cents = (n: number) => Math.round(n * 100);

/* =========================================================
   PURE LOGIC (unit tested)
========================================================= */

export type StmtLine = { id: string; date: Date; amount: number; reference: string | null; description: string };
export type LedgerLine = { id: string; date: Date; net: number; reference: string | null; text: string };

const DAY = 86_400_000;
const dayDiff = (a: Date, b: Date) => Math.abs(Math.round((a.getTime() - b.getTime()) / DAY));

function referenceHit(stmt: StmtLine, ledger: LedgerLine): boolean {
  const ref = (stmt.reference ?? "").trim().toLowerCase();
  if (ref.length < 3) return false;
  const hay = `${ledger.reference ?? ""} ${ledger.text}`.toLowerCase();
  return hay.includes(ref) || (ledger.reference ? ref.includes(ledger.reference.toLowerCase()) : false);
}

/*
 * One-to-one proposals. Same signed amount, date within the window.
 * Ambiguous cases (two equally good candidates) are left for a human.
 */
export function proposeMatches(stmt: StmtLine[], ledger: LedgerLine[], windowDays = MATCH_WINDOW_DAYS) {
  const used = new Set<string>();
  const out: { statementLineId: string; journalLineId: string }[] = [];

  const ordered = [...stmt].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));

  for (const s of ordered) {
    const candidates = ledger
      .filter((l) => !used.has(l.id) && cents(l.net) === cents(s.amount) && dayDiff(l.date, s.date) <= windowDays)
      .map((l) => ({ l, ref: referenceHit(s, l) ? 0 : 1, dist: dayDiff(l.date, s.date) }))
      .sort((a, b) => a.ref - b.ref || a.dist - b.dist || a.l.id.localeCompare(b.l.id));

    if (candidates.length === 0) continue;
    if (candidates.length > 1 && candidates[0].ref === candidates[1].ref && candidates[0].dist === candidates[1].dist) continue;

    used.add(candidates[0].l.id);
    out.push({ statementLineId: s.id, journalLineId: candidates[0].l.id });
  }

  return out;
}

export function computeSummary(i: {
  statementBalance: number;
  bookBalance: number;
  unmatchedLedgerNet: number;
  unmatchedStatementNet: number;
}) {
  const adjustedBank = roundAccounting(i.statementBalance + i.unmatchedLedgerNet);
  const adjustedBook = roundAccounting(i.bookBalance + i.unmatchedStatementNet);
  const difference = roundAccounting((cents(adjustedBank) - cents(adjustedBook)) / 100);
  return { adjustedBank, adjustedBook, difference };
}

/* =========================================================
   DATA ACCESS (always scoped by organizationId)
========================================================= */

const endOfDay = (ymd: string) => new Date(`${ymd}T23:59:59.999Z`);

export function parseAsOf(value: unknown): Date {
  const text = String(value ?? "").trim();
  if (!text) return endOfDay(new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(endOfDay(text).getTime())) {
    throw bad("INVALID_DATE", "Date must be in YYYY-MM-DD format.");
  }
  return endOfDay(text);
}

async function loadBank(db: Pick<Tx, "bankAccount">, organizationId: string, bankAccountId: string) {
  const bank = await db.bankAccount.findFirst({
    where: { id: bankAccountId, organizationId },
    select: { id: true, bankName: true, accountNumber: true, currency: true, glAccountId: true },
  });
  if (!bank) throw bad("BANK_ACCOUNT_NOT_FOUND", "Bank account not found.", 404);
  if (!bank.glAccountId) {
    throw bad("NO_LEDGER_ACCOUNT", "Link this bank to a ledger account in the Chart of Accounts before reconciling.", 409);
  }
  return { ...bank, glAccountId: bank.glAccountId };
}

const lock = (tx: Tx, organizationId: string, bankAccountId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:bankrec:${bankAccountId}`}))`;

const ledgerWhere = (organizationId: string, glAccountId: string): Prisma.JournalEntryLineWhereInput => ({
  accountId: glAccountId,
  journalEntry: { organizationId, status: { in: EFFECTIVE } },
});

const net = (l: { debit: number; credit: number }) => roundAccounting(l.debit - l.credit);

async function summarize(db: Tx | PrismaClient, organizationId: string, bank: { id: string; glAccountId: string }, asOf: Date, statementBalance: number | null) {
  const base = ledgerWhere(organizationId, bank.glAccountId);

  const [booked, lateMatched, unmatchedLedger, unmatchedStmt] = await Promise.all([
    db.journalEntryLine.aggregate({
      where: { ...base, journalEntry: { ...(base.journalEntry as object), transactionDate: { lte: asOf } } },
      _sum: { debit: true, credit: true },
    }),
    /* ledger lines dated after asOf but already cleared by a statement line on/before asOf */
    db.journalEntryLine.aggregate({
      where: {
        ...base,
        journalEntry: { ...(base.journalEntry as object), transactionDate: { gt: asOf } },
        statementMatch: { is: { organizationId, bankAccountId: bank.id, transactionDate: { lte: asOf } } },
      },
      _sum: { debit: true, credit: true },
    }),
    db.journalEntryLine.aggregate({
      where: {
        ...base,
        journalEntry: {
          ...(base.journalEntry as object),
          transactionDate: { lte: asOf },
          NOT: { reference: { startsWith: OPENING_PREFIX } },
        },
        statementMatch: { is: null },
      },
      _sum: { debit: true, credit: true },
      _count: true,
    }),
    db.bankStatementLine.aggregate({
      where: { organizationId, bankAccountId: bank.id, matchStatus: "UNMATCHED", transactionDate: { lte: asOf } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const bookBalance = roundAccounting(
    net({ debit: booked._sum.debit ?? 0, credit: booked._sum.credit ?? 0 }) +
      net({ debit: lateMatched._sum.debit ?? 0, credit: lateMatched._sum.credit ?? 0 })
  );
  const unmatchedLedgerNet = net({ debit: unmatchedLedger._sum.debit ?? 0, credit: unmatchedLedger._sum.credit ?? 0 });
  const unmatchedStatementNet = roundAccounting(unmatchedStmt._sum.amount ?? 0);

  const computed =
    statementBalance === null
      ? null
      : computeSummary({ statementBalance, bookBalance, unmatchedLedgerNet, unmatchedStatementNet });

  return {
    bookBalance,
    unmatchedLedgerNet,
    unmatchedLedgerCount: unmatchedLedger._count,
    unmatchedStatementNet,
    unmatchedStatementCount: unmatchedStmt._count,
    statementBalance,
    ...(computed ?? { adjustedBank: null, adjustedBook: null, difference: null }),
  };
}

/* ---------------------------------------------------------
   WORKSPACE
--------------------------------------------------------- */

export async function getWorkspace(
  db: PrismaClient,
  input: { organizationId: string; bankAccountId: string; asOf: Date; statementBalance: number | null }
) {
  const { organizationId } = input;
  const bank = await loadBank(db, organizationId, input.bankAccountId);

  const lastReconciliation = await db.bankReconciliation.findFirst({
    where: { organizationId, bankAccountId: bank.id },
    orderBy: { statementDate: "desc" },
    select: { id: true, statementDate: true, statementBalance: true, completedAt: true },
  });

  let statementBalance = input.statementBalance;
  let suggested: number | null = null;
  if (statementBalance === null) {
    const latest = await db.bankStatement.findFirst({
      where: { organizationId, bankAccountId: bank.id, closingBalance: { not: null }, periodEnd: { lte: input.asOf } },
      orderBy: { periodEnd: "desc" },
      select: { closingBalance: true },
    });
    suggested = latest?.closingBalance ?? null;
    statementBalance = suggested;
  }

  const [account, stmtLines, ledgerLines, summary, matched, counterAccounts] = await Promise.all([
    db.account.findFirst({ where: { id: bank.glAccountId, organizationId }, select: { id: true, code: true, name: true } }),
    db.bankStatementLine.findMany({
      where: { organizationId, bankAccountId: bank.id, matchStatus: "UNMATCHED", transactionDate: { lte: input.asOf } },
      orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
      take: MAX_LIST,
      select: { id: true, transactionDate: true, description: true, reference: true, amount: true },
    }),
    db.journalEntryLine.findMany({
      where: {
        ...ledgerWhere(organizationId, bank.glAccountId),
        journalEntry: {
          organizationId,
          status: { in: EFFECTIVE },
          transactionDate: { lte: input.asOf },
          NOT: { reference: { startsWith: OPENING_PREFIX } },
        },
        statementMatch: { is: null },
      },
      orderBy: [{ journalEntry: { transactionDate: "asc" } }, { id: "asc" }],
      take: MAX_LIST,
      select: {
        id: true,
        debit: true,
        credit: true,
        memo: true,
        journalEntry: { select: { reference: true, description: true, transactionDate: true } },
      },
    }),
    summarize(db, organizationId, bank, input.asOf, statementBalance),
    db.bankStatementLine.findMany({
      where: { organizationId, bankAccountId: bank.id, matchStatus: "MATCHED", reconciliationId: null, transactionDate: { lte: input.asOf } },
      orderBy: [{ transactionDate: "desc" }, { id: "asc" }],
      take: 200,
      select: {
        id: true,
        transactionDate: true,
        description: true,
        amount: true,
        matchedJournalLine: { select: { journalEntry: { select: { reference: true } } } },
      },
    }),
    db.account.findMany({
      where: { organizationId, id: { not: bank.glAccountId }, OR: [{ subtype: null }, { subtype: { not: "BANK" } }] },
      orderBy: { code: "asc" },
      take: 500,
      select: { id: true, code: true, name: true, type: true },
    }),
  ]);

  return {
    bank: { id: bank.id, bankName: bank.bankName, accountNumber: bank.accountNumber, currency: bank.currency },
    ledgerAccount: account,
    asOf: input.asOf.toISOString().slice(0, 10),
    suggestedStatementBalance: suggested,
    lastReconciliation,
    summary,
    statementLines: stmtLines.map((l) => ({ ...l, transactionDate: l.transactionDate.toISOString().slice(0, 10) })),
    ledgerLines: ledgerLines.map((l) => ({
      id: l.id,
      date: l.journalEntry.transactionDate.toISOString().slice(0, 10),
      reference: l.journalEntry.reference,
      description: l.memo || l.journalEntry.description,
      net: net(l),
    })),
    matchedLines: matched.map((m) => ({
      id: m.id,
      transactionDate: m.transactionDate.toISOString().slice(0, 10),
      description: m.description,
      amount: m.amount,
      ledgerReference: m.matchedJournalLine?.journalEntry.reference ?? null,
    })),
    counterAccounts,
    truncated: stmtLines.length === MAX_LIST || ledgerLines.length === MAX_LIST,
  };
}

/* ---------------------------------------------------------
   MATCH / UNMATCH / AUTO-MATCH
--------------------------------------------------------- */

async function audit(tx: Tx, ctx: Ctx, action: string, details: string) {
  await tx.auditTrail.create({
    data: { organizationId: ctx.organizationId, user: ctx.userId ?? "system", action, module: "BANK_RECONCILIATION", details },
  });
}

export async function matchLines(
  db: PrismaClient,
  ctx: Ctx,
  input: { bankAccountId: string; statementLineId: string; journalLineId: string }
) {
  const { organizationId } = ctx;

  return db.$transaction(async (tx) => {
    const bank = await loadBank(tx, organizationId, input.bankAccountId);
    await lock(tx, organizationId, bank.id);

    const stmt = await tx.bankStatementLine.findFirst({
      where: { id: input.statementLineId, organizationId, bankAccountId: bank.id },
      select: { id: true, amount: true, matchStatus: true, reconciliationId: true },
    });
    if (!stmt) throw bad("STATEMENT_LINE_NOT_FOUND", "Statement line not found.", 404);
    if (stmt.matchStatus !== "UNMATCHED") throw bad("ALREADY_MATCHED", "This statement line is already matched.", 409);

    const line = await tx.journalEntryLine.findFirst({
      where: { id: input.journalLineId, ...ledgerWhere(organizationId, bank.glAccountId) },
      select: { id: true, debit: true, credit: true, statementMatch: { select: { id: true } } },
    });
    if (!line) throw bad("LEDGER_LINE_NOT_FOUND", "Ledger entry not found for this bank account.", 404);
    if (line.statementMatch) throw bad("ALREADY_MATCHED", "This ledger entry is already matched to another statement line.", 409);

    if (cents(net(line)) !== cents(stmt.amount)) {
      throw bad("AMOUNT_MISMATCH", "The statement line and the ledger entry must have the same amount and direction.");
    }

    await tx.bankStatementLine.update({
      where: { id: stmt.id },
      data: { matchStatus: "MATCHED", matchedJournalLineId: line.id },
    });
    await audit(tx, ctx, "MATCH", `Matched statement line ${stmt.id} to journal line ${line.id}`);

    return { statementLineId: stmt.id, journalLineId: line.id };
  });
}

export async function unmatchLine(db: PrismaClient, ctx: Ctx, input: { bankAccountId: string; statementLineId: string }) {
  const { organizationId } = ctx;

  return db.$transaction(async (tx) => {
    const bank = await loadBank(tx, organizationId, input.bankAccountId);
    await lock(tx, organizationId, bank.id);

    const stmt = await tx.bankStatementLine.findFirst({
      where: { id: input.statementLineId, organizationId, bankAccountId: bank.id },
      select: { id: true, matchStatus: true, reconciliationId: true },
    });
    if (!stmt) throw bad("STATEMENT_LINE_NOT_FOUND", "Statement line not found.", 404);
    if (stmt.reconciliationId) {
      throw bad("RECONCILED_LOCKED", "This line belongs to a completed reconciliation. Reopen the reconciliation first.", 409);
    }
    if (stmt.matchStatus === "UNMATCHED") return { statementLineId: stmt.id };

    await tx.bankStatementLine.update({ where: { id: stmt.id }, data: { matchStatus: "UNMATCHED", matchedJournalLineId: null } });
    await audit(tx, ctx, "UNMATCH", `Unmatched statement line ${stmt.id}`);
    return { statementLineId: stmt.id };
  });
}

export async function autoMatch(db: PrismaClient, ctx: Ctx, input: { bankAccountId: string; asOf: Date }) {
  const { organizationId } = ctx;

  return db.$transaction(async (tx) => {
    const bank = await loadBank(tx, organizationId, input.bankAccountId);
    await lock(tx, organizationId, bank.id);

    const reach = new Date(input.asOf.getTime() + MATCH_WINDOW_DAYS * DAY);

    const [stmts, ledger] = await Promise.all([
      tx.bankStatementLine.findMany({
        where: { organizationId, bankAccountId: bank.id, matchStatus: "UNMATCHED", transactionDate: { lte: input.asOf } },
        select: { id: true, transactionDate: true, amount: true, reference: true, description: true },
        take: 5000,
      }),
      tx.journalEntryLine.findMany({
        where: {
          accountId: bank.glAccountId,
          journalEntry: {
            organizationId,
            status: { in: EFFECTIVE },
            transactionDate: { lte: reach },
            NOT: { reference: { startsWith: OPENING_PREFIX } },
          },
          statementMatch: { is: null },
        },
        select: { id: true, debit: true, credit: true, memo: true, journalEntry: { select: { reference: true, description: true, transactionDate: true } } },
        take: 10000,
      }),
    ]);

    const pairs = proposeMatches(
      stmts.map((s) => ({ id: s.id, date: s.transactionDate, amount: s.amount, reference: s.reference, description: s.description })),
      ledger.map((l) => ({
        id: l.id,
        date: l.journalEntry.transactionDate,
        net: net(l),
        reference: l.journalEntry.reference,
        text: `${l.memo ?? ""} ${l.journalEntry.description}`,
      }))
    );

    for (const p of pairs) {
      await tx.bankStatementLine.update({
        where: { id: p.statementLineId },
        data: { matchStatus: "MATCHED", matchedJournalLineId: p.journalLineId },
      });
    }

    await audit(tx, ctx, "AUTO_MATCH", `Auto-matched ${pairs.length} of ${stmts.length} statement lines for bank ${bank.id}`);
    return { matched: pairs.length, remaining: stmts.length - pairs.length };
  });
}

/* ---------------------------------------------------------
   RECORD A BANK-ONLY ITEM (fees, interest, ...) AND MATCH IT
--------------------------------------------------------- */

export async function createEntryForStatementLine(
  db: PrismaClient,
  ctx: Ctx,
  input: { bankAccountId: string; statementLineId: string; counterAccountId: string; description?: string }
) {
  const { organizationId, userId } = ctx;

  return db.$transaction(async (tx) => {
    const bank = await loadBank(tx, organizationId, input.bankAccountId);
    await lock(tx, organizationId, bank.id);

    const stmt = await tx.bankStatementLine.findFirst({
      where: { id: input.statementLineId, organizationId, bankAccountId: bank.id },
      select: { id: true, amount: true, description: true, transactionDate: true, matchStatus: true },
    });
    if (!stmt) throw bad("STATEMENT_LINE_NOT_FOUND", "Statement line not found.", 404);
    if (stmt.matchStatus !== "UNMATCHED") throw bad("ALREADY_MATCHED", "This statement line is already matched.", 409);

    if (input.counterAccountId === bank.glAccountId) {
      throw bad("INVALID_COUNTER_ACCOUNT", "Choose a different account from the bank's own ledger account.");
    }

    const counter = await tx.account.findFirst({
      where: { id: input.counterAccountId, organizationId },
      select: { id: true, subtype: true },
    });
    if (!counter) throw bad("COUNTER_ACCOUNT_NOT_FOUND", "The selected account was not found.", 404);
    if (counter.subtype === "BANK") {
      throw bad("INVALID_COUNTER_ACCOUNT", "To record a transfer between banks, use a journal entry and match both sides.");
    }

    const amount = roundAccounting(Math.abs(stmt.amount));
    const moneyIn = stmt.amount > 0;
    const reference = `BANKREC-${stmt.id}`;

    const existing = await tx.journalEntry.findFirst({ where: { organizationId, reference }, select: { id: true } });
    if (existing) throw bad("ENTRY_EXISTS", "An entry was already created for this statement line.", 409);

    const entry = await tx.journalEntry.create({
      data: {
        organizationId,
        reference,
        description: (input.description?.trim() || stmt.description).slice(0, 250),
        debitAccountId: moneyIn ? bank.glAccountId : counter.id,
        creditAccountId: moneyIn ? counter.id : bank.glAccountId,
        amount,
        transactionDate: stmt.transactionDate,
        status: "POSTED",
        postedAt: new Date(),
        postedBy: userId,
        createdBy: userId,
        notes: "Created from bank reconciliation",
        lines: {
          create: [
            { accountId: bank.glAccountId, lineNumber: 1, memo: "Bank", debit: moneyIn ? amount : 0, credit: moneyIn ? 0 : amount },
            { accountId: counter.id, lineNumber: 2, memo: "Bank reconciliation", debit: moneyIn ? 0 : amount, credit: moneyIn ? amount : 0 },
          ],
        },
      },
      select: { id: true, lines: { where: { lineNumber: 1 }, select: { id: true } } },
    });

    await tx.bankStatementLine.update({
      where: { id: stmt.id },
      data: { matchStatus: "MATCHED", matchedJournalLineId: entry.lines[0].id },
    });
    await audit(tx, ctx, "CREATE_ENTRY", `Posted ${reference} for statement line ${stmt.id} (${stmt.amount})`);

    return { journalEntryId: entry.id, reference };
  });
}

/* ---------------------------------------------------------
   COMPLETE / REOPEN / HISTORY
--------------------------------------------------------- */

export async function completeReconciliation(
  db: PrismaClient,
  ctx: Ctx,
  input: { bankAccountId: string; asOf: Date; statementBalance: number }
) {
  const { organizationId, userId } = ctx;

  return db.$transaction(async (tx) => {
    const bank = await loadBank(tx, organizationId, input.bankAccountId);
    await lock(tx, organizationId, bank.id);

    const last = await tx.bankReconciliation.findFirst({
      where: { organizationId, bankAccountId: bank.id },
      orderBy: { statementDate: "desc" },
      select: { statementDate: true },
    });
    if (last && input.asOf.getTime() <= last.statementDate.getTime()) {
      throw bad("DATE_BEFORE_LAST_RECONCILIATION", "The statement date must be after the last completed reconciliation.", 409);
    }

    const s = await summarize(tx, organizationId, bank, input.asOf, input.statementBalance);

    if (s.unmatchedStatementCount > 0) {
      throw bad(
        "UNMATCHED_STATEMENT_LINES",
        `${s.unmatchedStatementCount} statement line(s) are not matched yet. Match them, or record them in the books first.`,
        409
      );
    }
    if (s.difference === null || cents(s.difference) !== 0) {
      throw bad("NOT_BALANCED", `The reconciliation is out by ${s.difference}. It must be 0 to complete.`, 409);
    }

    const toClear = await tx.bankStatementLine.findMany({
      where: {
        organizationId,
        bankAccountId: bank.id,
        matchStatus: "MATCHED",
        reconciliationId: null,
        transactionDate: { lte: input.asOf },
      },
      select: { id: true },
    });

    const reconciliation = await tx.bankReconciliation.create({
      data: {
        organizationId,
        bankAccountId: bank.id,
        statementDate: input.asOf,
        statementBalance: input.statementBalance,
        bookBalance: s.bookBalance,
        adjustedBalance: s.adjustedBank ?? 0,
        clearedCount: toClear.length,
        outstandingCount: s.unmatchedLedgerCount,
        completedBy: userId,
      },
      select: { id: true },
    });

    await tx.bankStatementLine.updateMany({
      where: { id: { in: toClear.map((l) => l.id) }, organizationId },
      data: { reconciliationId: reconciliation.id, reconciledAt: new Date() },
    });

    await audit(tx, ctx, "COMPLETE", `Reconciled bank ${bank.id} as of ${input.asOf.toISOString().slice(0, 10)} (${toClear.length} items)`);
    return { reconciliationId: reconciliation.id, cleared: toClear.length, outstanding: s.unmatchedLedgerCount };
  });
}

/* Only the most recent reconciliation can be reopened. */
export async function reopenReconciliation(db: PrismaClient, ctx: Ctx, input: { bankAccountId: string; reconciliationId: string }) {
  const { organizationId } = ctx;

  return db.$transaction(async (tx) => {
    const bank = await loadBank(tx, organizationId, input.bankAccountId);
    await lock(tx, organizationId, bank.id);

    const latest = await tx.bankReconciliation.findFirst({
      where: { organizationId, bankAccountId: bank.id },
      orderBy: { statementDate: "desc" },
      select: { id: true },
    });
    if (!latest || latest.id !== input.reconciliationId) {
      throw bad("NOT_LATEST", "Only the most recent reconciliation can be reopened.", 409);
    }

    await tx.bankStatementLine.updateMany({
      where: { organizationId, reconciliationId: latest.id },
      data: { reconciliationId: null, reconciledAt: null },
    });
    await tx.bankReconciliation.delete({ where: { id: latest.id } });
    await audit(tx, ctx, "REOPEN", `Reopened reconciliation ${latest.id} for bank ${bank.id}`);

    return { reconciliationId: latest.id };
  });
}

export async function listReconciliations(db: PrismaClient, organizationId: string, bankAccountId: string) {
  const bank = await loadBank(db, organizationId, bankAccountId);

  return db.bankReconciliation.findMany({
    where: { organizationId, bankAccountId: bank.id },
    orderBy: { statementDate: "desc" },
    take: 60,
    select: {
      id: true,
      statementDate: true,
      statementBalance: true,
      bookBalance: true,
      adjustedBalance: true,
      clearedCount: true,
      outstandingCount: true,
      completedBy: true,
      completedAt: true,
    },
  });
}