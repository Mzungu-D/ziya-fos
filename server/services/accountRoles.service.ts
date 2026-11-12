import { Prisma } from "@prisma/client";

/* =========================================================
   ACCOUNT ROLES (multi-tenant)

   The accounting engine must never assume a tenant's chart
   looks like the standard one. Every lookup here is scoped to
   one organizationId and resolves an account by what it is FOR
   (its subtype) first, and only then falls back to the
   standard code so tenants that were never tagged keep working.
========================================================= */

type Db = Pick<Prisma.TransactionClient, "account" | "bankAccount">;

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

/* Subtype -> the account type it is allowed on. */
export const SUBTYPE_RULES: Record<string, AccountType> = {
  BANK: "ASSET",
  CASH: "ASSET",
  MOBILE_MONEY: "ASSET",
  RECEIVABLE_CONTROL: "ASSET",
  PAYABLE_CONTROL: "LIABILITY",
  TAX_PAYABLE: "LIABILITY",
  OPENING_BALANCE: "EQUITY",
  SALES_REVENUE: "INCOME",
  BAD_DEBT: "EXPENSE",
};

/* Only one account per organization may hold these. */
export const SINGLETON_SUBTYPES = new Set([
  "RECEIVABLE_CONTROL",
  "PAYABLE_CONTROL",
  "TAX_PAYABLE",
  "OPENING_BALANCE",
  "SALES_REVENUE",
  "BAD_DEBT",
]);

export type RoleKey =
  | "RECEIVABLE_CONTROL"
  | "PAYABLE_CONTROL"
  | "TAX_PAYABLE"
  | "SALES_REVENUE"
  | "BAD_DEBT"
  | "DEFAULT_CASH";

type RoleDef = { subtype: string; type: AccountType; code: string; name: RegExp };

const ROLES: Record<Exclude<RoleKey, "DEFAULT_CASH">, RoleDef> = {
  RECEIVABLE_CONTROL: { subtype: "RECEIVABLE_CONTROL", type: "ASSET", code: "1200", name: /receivable/i },
  PAYABLE_CONTROL: { subtype: "PAYABLE_CONTROL", type: "LIABILITY", code: "2100", name: /payable/i },
  TAX_PAYABLE: { subtype: "TAX_PAYABLE", type: "LIABILITY", code: "2300", name: /tax/i },
  SALES_REVENUE: { subtype: "SALES_REVENUE", type: "INCOME", code: "4100", name: /(sales|revenue)/i },
  BAD_DEBT: { subtype: "BAD_DEBT", type: "EXPENSE", code: "6300", name: /bad debt/i },
};

/* Standard petty cash, tagged by backfill/self-heal. */
export const EXTRA_STANDARD_TAGS: { code: string; subtype: string; type: AccountType; name: RegExp }[] = [
  { code: "1110", subtype: "CASH", type: "ASSET", name: /(petty cash|cash on hand)/i },
];

export const STANDARD_TAGS = [
  ...Object.values(ROLES).map((r) => ({ code: r.code, subtype: r.subtype, type: r.type, name: r.name })),
  ...EXTRA_STANDARD_TAGS,
];

const ROLE_BY_CODE: Record<string, RoleKey> = Object.fromEntries(
  Object.entries(ROLES).map(([key, r]) => [r.code, key as RoleKey])
);

/*
 * Resolve the account that plays `role` for ONE organization.
 * 1. account tagged with the role's subtype
 * 2. the standard code (keeps untagged tenants working), tagged on the way
 */
export async function resolveRoleAccount(db: Db, organizationId: string, role: RoleKey) {
  if (role === "DEFAULT_CASH") return resolveDefaultCashAccount(db, organizationId);

  const def = ROLES[role];

  const tagged = await db.account.findFirst({
    where: { organizationId, subtype: def.subtype, type: def.type },
    orderBy: { code: "asc" },
  });
  if (tagged) return tagged;

  const byCode = await db.account.findFirst({
    where: { organizationId, code: def.code, type: def.type },
  });
  if (!byCode) return null;

  if (def.name.test(byCode.name) && !byCode.subtype) {
    await db.account.updateMany({ where: { id: byCode.id, subtype: null }, data: { subtype: def.subtype } });
    return { ...byCode, subtype: def.subtype };
  }

  return byCode;
}

/* Same as above for callers that still pass a standard code constant. */
export async function resolveRoleByStandardCode(db: Db, organizationId: string, code: string) {
  const role = ROLE_BY_CODE[code];
  if (role) return resolveRoleAccount(db, organizationId, role);
  return db.account.findFirst({ where: { organizationId, code } });
}

/*
 * Default account for receipts when the caller names none:
 * the first active bank's ledger account, else a CASH account,
 * else the standard 1100 only if it really is a cash/bank account.
 */
export async function resolveDefaultCashAccount(db: Db, organizationId: string) {
  const bank = await db.bankAccount.findFirst({
    where: { organizationId, status: "ACTIVE", glAccountId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { glAccountId: true },
  });

  if (bank?.glAccountId) {
    const account = await db.account.findFirst({
      where: { id: bank.glAccountId, organizationId, type: "ASSET" },
    });
    if (account) return account;
  }

  const tagged = await db.account.findFirst({
    where: { organizationId, type: "ASSET", subtype: { in: ["BANK", "CASH"] } },
    orderBy: { code: "asc" },
  });
  if (tagged) return tagged;

  const byCode = await db.account.findFirst({ where: { organizationId, code: "1100", type: "ASSET" } });
  return byCode && /(cash|bank)/i.test(byCode.name) ? byCode : null;
}

/* Subtype can be held by one account only (control accounts). */
export async function assertSubtypeAvailable(
  db: Pick<Prisma.TransactionClient, "account">,
  organizationId: string,
  subtype: string | null,
  excludeAccountId?: string
) {
  if (!subtype || !SINGLETON_SUBTYPES.has(subtype)) return;

  const other = await db.account.findFirst({
    where: { organizationId, subtype, ...(excludeAccountId ? { id: { not: excludeAccountId } } : {}) },
    select: { code: true, name: true },
  });

  if (other) {
    throw new AccountRoleError(
      "SUBTYPE_ALREADY_ASSIGNED",
      `${other.code} - ${other.name} is already the ${subtype.replace(/_/g, " ").toLowerCase()} account for this organization. Only one account can hold this role.`,
      409
    );
  }
}

export class AccountRoleError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AccountRoleError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeSubtype(type: string, subtype: unknown): string | null {
  const value = String(subtype ?? "").trim().toUpperCase();
  if (!value) return null;

  const required = SUBTYPE_RULES[value];
  if (!required) throw new AccountRoleError("INVALID_SUBTYPE", `Unknown account subtype "${value}".`);
  if (required !== type) {
    throw new AccountRoleError("SUBTYPE_TYPE_MISMATCH", `Subtype ${value} can only be used on ${required} accounts.`);
  }
  return value;
}

/* Tags the standard accounts of one organization. Safe to run repeatedly. */
export async function applyStandardSubtypes(
  db: Pick<Prisma.TransactionClient, "account">,
  organizationId: string
): Promise<number> {
  let tagged = 0;

  for (const tag of STANDARD_TAGS) {
    if (SINGLETON_SUBTYPES.has(tag.subtype)) {
      const taken = await db.account.count({ where: { organizationId, subtype: tag.subtype } });
      if (taken > 0) continue;
    }

    const account = await db.account.findFirst({
      where: { organizationId, code: tag.code, type: tag.type, subtype: null },
      select: { id: true, name: true },
    });

    if (account && tag.name.test(account.name)) {
      await db.account.update({ where: { id: account.id }, data: { subtype: tag.subtype } });
      tagged += 1;
    }
  }

  return tagged;
}