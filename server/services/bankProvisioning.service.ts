import { Prisma, PrismaClient } from "@prisma/client";
import type { Response } from "express";

import { roundAccounting } from "../utils/accounting";
import {
  AccountRoleError,
  AccountType,
  assertSubtypeAvailable,
  normalizeSubtype,
} from "./accountRoles.service";

/* =========================================================
   BANK PROVISIONING (multi-tenant)

   The Chart of Accounts is the single source of truth.
   A bank account is a COA account (subtype BANK) with a
   BankAccount profile attached through BankAccount.glAccountId.

   - every query is scoped by organizationId
   - everything runs in one transaction
   - idempotent: saving twice never duplicates the bank
     profile or the opening-balance journal
========================================================= */

type Tx = Prisma.TransactionClient;
type Ctx = { organizationId: string; userId: string | null };

const CODE_RANGES: Record<AccountType, [number, number]> = {
  ASSET: [1000, 1999],
  LIABILITY: [2000, 2999],
  EQUITY: [3000, 3999],
  INCOME: [4000, 4999],
  EXPENSE: [5000, 6999],
};

export type BankDetails = {
  bankName: string;
  accountNumber: string;
  branchName: string | null;
  currency: string;
  openingBalance: number;
  openingBalanceDate: Date;
};

const bad = (code: string, message: string, status = 400) => new AccountRoleError(code, message, status);

/* Maps our errors (and duplicate bank numbers) to an HTTP response. */
export function handleAccountError(res: Response, error: unknown): boolean {
  if (error instanceof AccountRoleError) {
    res.status(error.status).json({ success: false, code: error.code, message: error.message });
    return true;
  }

  const e = error as { code?: string; meta?: { target?: unknown } };
  if (e?.code === "P2002" && String(e.meta?.target ?? "").includes("accountNumber")) {
    res.status(409).json({
      success: false,
      code: "BANK_ACCOUNT_EXISTS",
      message: "A bank account with this account number already exists in this organization.",
    });
    return true;
  }

  return false;
}

/* =========================================================
   VALIDATION
========================================================= */

export function parseBankDetails(input: unknown, required: boolean): Partial<BankDetails> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => String(v ?? "").trim();

  const bankName = text(raw.bankName);
  const accountNumber = text(raw.accountNumber);

  if (required && !bankName) throw bad("BANK_NAME_REQUIRED", "Bank name is required for a bank account.");
  if (required && !accountNumber) {
    throw bad("ACCOUNT_NUMBER_REQUIRED", "Bank account number is required for a bank account.");
  }

  const currency = text(raw.currency).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw bad("INVALID_CURRENCY", "Currency must be a valid 3-letter ISO code.");
  }

  const opening = Number(raw.openingBalance ?? 0);
  if (!Number.isFinite(opening) || opening < 0) {
    throw bad("INVALID_OPENING_BALANCE", "Opening balance must be a valid non-negative number.");
  }

  let openingBalanceDate = new Date();
  if (raw.openingBalanceDate) {
    const parsed = new Date(String(raw.openingBalanceDate));
    if (Number.isNaN(parsed.getTime())) throw bad("INVALID_OPENING_BALANCE_DATE", "Opening balance date is not valid.");
    openingBalanceDate = parsed;
  }

  return {
    bankName: bankName || undefined,
    accountNumber: accountNumber || undefined,
    branchName: raw.branchName === undefined ? undefined : text(raw.branchName) || null,
    currency: currency || "KES",
    openingBalance: roundAccounting(opening),
    openingBalanceDate,
  };
}

/* =========================================================
   ACCOUNT CODES
   Same advisory-lock key as the account controller, per tenant.
========================================================= */

export async function allocateAccountCode(tx: Tx, organizationId: string, type: AccountType): Promise<string> {
  const [start, end] = CODE_RANGES[type];

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:account-code:${type}`}))`;

  const rows = await tx.account.findMany({ where: { organizationId }, select: { code: true } });
  const used = new Set<number>();
  for (const { code } of rows) {
    const n = Number.parseInt(code, 10);
    if (Number.isInteger(n) && n >= start && n <= end) used.add(n);
  }

  let next = start + 1;
  while (used.has(next) && next <= end) next += 1;
  if (next > end) throw bad("NO_ACCOUNT_CODES_LEFT", `No available account codes remain for ${type} accounts.`, 409);

  return String(next);
}

/* Cash & Banking created a bank first: make its ledger account. */
export async function createLedgerAccountForBank(tx: Tx, organizationId: string, name: string) {
  await assertSubtypeAvailable(tx, organizationId, "BANK");
  const code = await allocateAccountCode(tx, organizationId, "ASSET");

  return tx.account.create({
    data: { organizationId, code, name, type: "ASSET", subtype: "BANK", description: "Bank account (created automatically)." },
    select: { id: true, name: true },
  });
}

async function ensureOpeningBalanceEquity(tx: Tx, organizationId: string) {
  const existing = await tx.account.findFirst({
    where: {
      organizationId,
      type: "EQUITY",
      OR: [{ subtype: "OPENING_BALANCE" }, { name: { equals: "Opening Balance Equity", mode: "insensitive" } }],
    },
    select: { id: true },
  });
  if (existing) return existing;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:account-code:EQUITY`}))`;

  const used = new Set((await tx.account.findMany({ where: { organizationId, type: "EQUITY" }, select: { code: true } })).map((a) => a.code));
  let code = 3900;
  while (used.has(String(code)) && code > 3000) code -= 1;

  return tx.account.create({
    data: {
      organizationId,
      code: String(code),
      name: "Opening Balance Equity",
      type: "EQUITY",
      subtype: "OPENING_BALANCE",
      description: "Offset for opening balances entered when accounts are set up.",
    },
    select: { id: true },
  });
}

/* =========================================================
   PROVISION: COA ACCOUNT -> BANK PROFILE (+ OPENING JOURNAL)
========================================================= */

type ExtraBankData = Omit<
  Prisma.BankAccountUncheckedCreateInput,
  "organizationId" | "bankName" | "accountName" | "accountNumber" | "branchName" | "currency" | "openingBalance" | "currentBalance" | "glAccountId"
>;

export async function provisionBankForLedgerAccount(
  tx: Tx,
  ctx: Ctx,
  account: { id: string; name: string },
  details: Partial<BankDetails>,
  extra: ExtraBankData = {}
) {
  const { organizationId, userId } = ctx;

  const existing = await tx.bankAccount.findFirst({ where: { organizationId, glAccountId: account.id } });

  if (existing) {
    const bankAccount = await tx.bankAccount.update({
      where: { id: existing.id },
      data: {
        accountName: account.name,
        ...(details.bankName ? { bankName: details.bankName } : {}),
        ...(details.branchName !== undefined ? { branchName: details.branchName } : {}),
        // account number, currency and opening balance are locked after creation
      },
    });
    return { bankAccount, created: false };
  }

  if (!details.bankName || !details.accountNumber) {
    throw bad("BANK_DETAILS_REQUIRED", "Bank name and account number are required to link a bank account.");
  }

  const opening = roundAccounting(details.openingBalance ?? 0);

  const bankAccount = await tx.bankAccount.create({
    data: {
      ...extra,
      organizationId,
      bankName: details.bankName,
      accountName: account.name,
      accountNumber: details.accountNumber,
      branchName: details.branchName ?? null,
      currency: details.currency ?? "KES",
      openingBalance: opening,
      currentBalance: opening,
      glAccountId: account.id,
      status: "ACTIVE",
    },
  });

  if (opening > 0) {
    await postOpeningBalanceJournal(tx, ctx, {
      bankAccountId: bankAccount.id,
      label: `${bankAccount.bankName} ${bankAccount.accountNumber}`,
      ledgerAccountId: account.id,
      amount: opening,
      date: details.openingBalanceDate ?? new Date(),
    });
  }

  await tx.auditTrail.create({
    data: {
      organizationId,
      user: userId ?? "system",
      action: "PROVISION",
      module: "BANK",
      details: `Linked bank ${bankAccount.bankName} ${bankAccount.accountNumber} (${bankAccount.id}) to ledger account ${account.id}`,
    },
  });

  return { bankAccount, created: true };
}

/* Dr bank ledger / Cr Opening Balance Equity. OPENING-<bankId> is unique per tenant. */
async function postOpeningBalanceJournal(
  tx: Tx,
  { organizationId, userId }: Ctx,
  i: { bankAccountId: string; label: string; ledgerAccountId: string; amount: number; date: Date }
) {
  const reference = `OPENING-${i.bankAccountId}`;
  const already = await tx.journalEntry.findFirst({ where: { organizationId, reference }, select: { id: true } });
  if (already) return already;

  const equity = await ensureOpeningBalanceEquity(tx, organizationId);

  return tx.journalEntry.create({
    data: {
      organizationId,
      reference,
      description: `Opening balance - ${i.label}`,
      debitAccountId: i.ledgerAccountId,
      creditAccountId: equity.id,
      amount: i.amount,
      transactionDate: i.date,
      status: "POSTED",
      postedAt: new Date(),
      postedBy: userId,
      createdBy: userId,
      notes: "Automatic opening balance from bank account setup",
      lines: {
        create: [
          { accountId: i.ledgerAccountId, lineNumber: 1, memo: "Opening balance", debit: i.amount, credit: 0 },
          { accountId: equity.id, lineNumber: 2, memo: "Opening balance", debit: 0, credit: i.amount },
        ],
      },
    },
    select: { id: true },
  });
}

/* Activity other than the automatic opening balance. */
export async function countBankActivity(tx: Tx, organizationId: string, bankAccountId: string, ledgerAccountId: string) {
  const [lines, payments, batches, statements, expenses] = await Promise.all([
    tx.journalEntryLine.count({
      where: { accountId: ledgerAccountId, journalEntry: { organizationId, reference: { not: `OPENING-${bankAccountId}` } } },
    }),
    tx.bankPayment.count({ where: { organizationId, bankAccountId } }),
    tx.bankPaymentBatch.count({ where: { organizationId, bankAccountId } }),
    tx.bankStatement.count({ where: { organizationId, bankAccountId } }),
    tx.expense.count({ where: { organizationId, bankAccountId } }),
  ]);
  return lines + payments + batches + statements + expenses;
}

/* An account stops being BANK: block if the bank has activity, else unlink. */
async function releaseBankLink(tx: Tx, organizationId: string, ledgerAccountId: string) {
  const bank = await tx.bankAccount.findFirst({
    where: { organizationId, glAccountId: ledgerAccountId },
    select: { id: true, bankName: true, accountNumber: true },
  });
  if (!bank) return;

  if ((await countBankActivity(tx, organizationId, bank.id, ledgerAccountId)) > 0) {
    throw bad(
      "BANK_HAS_ACTIVITY",
      `This account is linked to bank ${bank.bankName} (${bank.accountNumber}) which has transactions, payments or statements. It cannot stop being a bank account.`,
      409
    );
  }

  await tx.bankAccount.update({ where: { id: bank.id }, data: { glAccountId: null, status: "INACTIVE" } });
}

/* =========================================================
   CREATE / UPDATE ACCOUNT (called by account.controller)
========================================================= */

const accountInclude = (organizationId: string) =>
  ({
    parent: { select: { id: true, code: true, name: true } },
    children: { where: { organizationId }, select: { id: true, code: true, name: true, type: true } },
    bankAccounts: {
      select: { id: true, bankName: true, accountNumber: true, branchName: true, currency: true, openingBalance: true, status: true },
    },
  }) satisfies Prisma.AccountInclude;

export async function createAccountWithLinks(
  db: PrismaClient,
  input: {
    organizationId: string;
    userId: string | null;
    name: string;
    type: AccountType;
    description: string | null;
    parentId: string | null;
    subtype: unknown;
    bank: unknown;
  }
) {
  const { organizationId, userId } = input;
  const subtype = normalizeSubtype(input.type, input.subtype);
  const bank = subtype === "BANK" ? parseBankDetails(input.bank, true) : null;

  return db.$transaction(async (tx) => {
    await assertSubtypeAvailable(tx, organizationId, subtype);
    const code = await allocateAccountCode(tx, organizationId, input.type);

    const created = await tx.account.create({
      data: {
        organizationId,
        code,
        name: input.name,
        type: input.type,
        subtype,
        description: input.description,
        parentId: input.parentId,
      },
      include: { parent: true, children: true },
    });

    const bankAccount = bank ? (await provisionBankForLedgerAccount(tx, { organizationId, userId }, created, bank)).bankAccount : null;

    return { ...created, bankAccount };
  });
}

export async function updateAccountWithLinks(
  db: PrismaClient,
  input: {
    organizationId: string;
    userId: string | null;
    id: string;
    existing: { code: string; subtype: string | null };
    code: string;
    name: string;
    type: AccountType;
    description: string | null;
    parentId: string | null;
    subtype: unknown;
    bank: unknown;
  }
) {
  const { organizationId, userId, id, existing } = input;

  const subtype = input.subtype === undefined ? existing.subtype : normalizeSubtype(input.type, input.subtype);
  const wasBank = existing.subtype === "BANK";

  if (wasBank && subtype === "BANK" && input.type !== "ASSET") {
    throw bad("BANK_MUST_STAY_ASSET", "A bank account must remain an Asset account.", 409);
  }

  /* The code is an identifier other modules rely on: lock it once there is history. */
  if (input.code !== existing.code) {
    const posted = await db.journalEntryLine.count({
      where: { accountId: id, journalEntry: { organizationId, status: { in: ["POSTED", "APPROVED"] } } },
    });
    if (posted > 0) {
      throw bad("ACCOUNT_CODE_LOCKED", "The account code cannot be changed because this account has posted or approved journal entries.", 409);
    }
  }

  if (subtype === "BANK") {
    const children = await db.account.count({ where: { organizationId, parentId: id } });
    if (children > 0) throw bad("BANK_CANNOT_HAVE_CHILDREN", "A bank account must be a posting account. Remove its child accounts first.");
  }

  return db.$transaction(async (tx) => {
    await assertSubtypeAvailable(tx, organizationId, subtype, id);

    if (wasBank && subtype !== "BANK") await releaseBankLink(tx, organizationId, id);

    const updated = await tx.account.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        subtype,
        description: input.description,
        parentId: input.parentId,
      },
    });

    if (subtype === "BANK") {
      const linked = await tx.bankAccount.count({ where: { organizationId, glAccountId: id } });
      await provisionBankForLedgerAccount(tx, { organizationId, userId }, updated, parseBankDetails(input.bank, linked === 0));
    }

    return tx.account.findFirstOrThrow({ where: { id, organizationId }, include: accountInclude(organizationId) });
  });
}

/* Used by account.controller list/get so the screen can show bank details. */
export const accountBankSelect = accountInclude;