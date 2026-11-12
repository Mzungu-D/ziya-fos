/* =========================================================
   ACCOUNTING ENGINE HEALTH CHECK - READ ONLY, ALL TENANTS
   Run:  npx tsx scripts/check-accounting-engine.ts
   Changes nothing. Exit code 1 if a FAIL check finds rows.
========================================================= */

import prisma from "../server/config/prisma";

type Check = { name: string; severity: "FAIL" | "WARN" | "INFO"; hint: string; sql: string };

const EFF = `('POSTED','APPROVED')`;

const ROLE_VALUES = `(VALUES
  ('RECEIVABLE_CONTROL','ASSET','1200'),
  ('PAYABLE_CONTROL','LIABILITY','2100'),
  ('SALES_REVENUE','INCOME','4100'),
  ('TAX_PAYABLE','LIABILITY','2300')
) AS r(role, type, code)`;

const checks: Check[] = [
  {
    name: "Posted/approved journals where debits != credits",
    severity: "FAIL",
    hint: "Books are out of balance. Reverse and repost the journal.",
    sql: `SELECT je."organizationId", je."reference", je."status",
            ROUND(SUM(l."debit")::numeric,2) AS debit, ROUND(SUM(l."credit")::numeric,2) AS credit
          FROM "JournalEntry" je JOIN "JournalEntryLine" l ON l."journalEntryId" = je."id"
          WHERE je."status" IN ${EFF}
          GROUP BY je."id" HAVING ABS(SUM(l."debit") - SUM(l."credit")) > 0.01`,
  },
  {
    name: "Posted/approved journals with fewer than 2 lines",
    severity: "FAIL",
    hint: "A posted journal needs a debit and a credit line.",
    sql: `SELECT je."organizationId", je."reference", COUNT(l."id")::int AS lines
          FROM "JournalEntry" je LEFT JOIN "JournalEntryLine" l ON l."journalEntryId" = je."id"
          WHERE je."status" IN ${EFF}
          GROUP BY je."id" HAVING COUNT(l."id") < 2`,
  },
  {
    name: "Journal lines pointing at ANOTHER organization's account",
    severity: "FAIL",
    hint: "Tenant isolation breach. Investigate immediately.",
    sql: `SELECT je."organizationId" AS journal_org, a."organizationId" AS account_org, je."reference", a."code"
          FROM "JournalEntryLine" l
          JOIN "JournalEntry" je ON je."id" = l."journalEntryId"
          JOIN "Account" a ON a."id" = l."accountId"
          WHERE je."organizationId" <> a."organizationId"`,
  },
  {
    name: "Trial balance: total debits != total credits (per organization)",
    severity: "FAIL",
    hint: "The trial balance cannot balance until this is fixed.",
    sql: `SELECT je."organizationId", ROUND(SUM(l."debit")::numeric,2) AS debit, ROUND(SUM(l."credit")::numeric,2) AS credit
          FROM "JournalEntryLine" l JOIN "JournalEntry" je ON je."id" = l."journalEntryId"
          WHERE je."status" IN ${EFF}
          GROUP BY je."organizationId" HAVING ABS(SUM(l."debit") - SUM(l."credit")) > 0.01`,
  },
  {
    name: "Journal header amount differs from its line total",
    severity: "WARN",
    hint: "Older screens read the header amount. Lines are authoritative.",
    sql: `SELECT je."organizationId", je."reference", je."amount", ROUND(SUM(l."debit")::numeric,2) AS line_debit
          FROM "JournalEntry" je JOIN "JournalEntryLine" l ON l."journalEntryId" = je."id"
          WHERE je."status" IN ${EFF}
          GROUP BY je."id" HAVING ABS(je."amount" - SUM(l."debit")) > 0.01`,
  },
  {
    name: "Organizations missing a role account the engine needs",
    severity: "FAIL",
    hint: "Receivables/Payables/Invoices cannot post. Tag an account (Chart of Accounts > edit > What is this account for?).",
    sql: `SELECT o."id" AS "organizationId", r.role
          FROM "Organization" o CROSS JOIN ${ROLE_VALUES}
          WHERE NOT EXISTS (
            SELECT 1 FROM "Account" a
            WHERE a."organizationId" = o."id" AND a."type" = r.type AND (a."subtype" = r.role OR a."code" = r.code)
          )`,
  },
  {
    name: "Role account found only by standard code but named like something else",
    severity: "WARN",
    hint: "e.g. code 1200 renamed to something unrelated. Tag the correct account.",
    sql: `SELECT a."organizationId", a."code", a."name", r.role
          FROM "Account" a JOIN ${ROLE_VALUES} ON a."code" = r.code AND a."type" = r.type
          WHERE a."subtype" IS NULL
            AND NOT EXISTS (SELECT 1 FROM "Account" t WHERE t."organizationId" = a."organizationId" AND t."subtype" = r.role)
            AND a."name" !~* CASE r.role
                  WHEN 'RECEIVABLE_CONTROL' THEN 'receivable'
                  WHEN 'PAYABLE_CONTROL' THEN 'payable'
                  WHEN 'TAX_PAYABLE' THEN 'tax'
                  ELSE '(sales|revenue)' END`,
  },
  {
    name: "Role subtype held by more than one account in an organization",
    severity: "FAIL",
    hint: "Control roles must be unique per organization.",
    sql: `SELECT "organizationId", "subtype", COUNT(*)::int AS accounts, STRING_AGG("code", ', ') AS codes
          FROM "Account"
          WHERE "subtype" IN ('RECEIVABLE_CONTROL','PAYABLE_CONTROL','TAX_PAYABLE','SALES_REVENUE','BAD_DEBT','OPENING_BALANCE')
          GROUP BY "organizationId", "subtype" HAVING COUNT(*) > 1`,
  },
  {
    name: "Active bank accounts with no ledger (COA) account",
    severity: "FAIL",
    hint: "Payments from these banks cannot post. Open the account in Chart of Accounts and mark it Bank.",
    sql: `SELECT "organizationId", "bankName", "accountNumber" FROM "BankAccount"
          WHERE "glAccountId" IS NULL AND "status" = 'ACTIVE'`,
  },
  {
    name: "Two bank accounts on the same ledger account",
    severity: "FAIL",
    hint: "Each bank needs its own ledger account to reconcile.",
    sql: `SELECT "organizationId", "glAccountId", COUNT(*)::int AS banks FROM "BankAccount"
          WHERE "glAccountId" IS NOT NULL GROUP BY "organizationId", "glAccountId" HAVING COUNT(*) > 1`,
  },
  {
    name: "Bank ledger account is not an ASSET marked BANK",
    severity: "WARN",
    hint: "The migration tags linked accounts; edit the account if this still shows.",
    sql: `SELECT b."organizationId", b."bankName", a."code", a."name", a."type", a."subtype"
          FROM "BankAccount" b JOIN "Account" a ON a."id" = b."glAccountId"
          WHERE a."type" <> 'ASSET' OR a."subtype" IS DISTINCT FROM 'BANK'`,
  },
  {
    name: "Bank has an opening balance but the ledger has no entries for it",
    severity: "WARN",
    hint: "The bank shows money the ledger does not know about.",
    sql: `SELECT b."organizationId", b."bankName", b."accountNumber", b."openingBalance" FROM "BankAccount" b
          WHERE b."openingBalance" > 0 AND b."glAccountId" IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM "JournalEntryLine" l JOIN "JournalEntry" je ON je."id" = l."journalEntryId"
              WHERE l."accountId" = b."glAccountId" AND je."organizationId" = b."organizationId" AND je."status" IN ${EFF})`,
  },
  {
    name: "Bank currentBalance differs from ledger balance",
    severity: "INFO",
    hint: "Expected when currentBalance is synced from the bank. Otherwise reconcile.",
    sql: `SELECT b."organizationId", b."bankName", b."accountNumber",
            ROUND(b."currentBalance"::numeric,2) AS bank_balance,
            ROUND(COALESCE(SUM(l."debit" - l."credit"),0)::numeric,2) AS ledger_balance
          FROM "BankAccount" b
          LEFT JOIN "JournalEntryLine" l ON l."accountId" = b."glAccountId"
            AND EXISTS (SELECT 1 FROM "JournalEntry" je WHERE je."id" = l."journalEntryId" AND je."status" IN ${EFF})
          WHERE b."glAccountId" IS NOT NULL
          GROUP BY b."id" HAVING ABS(b."currentBalance" - COALESCE(SUM(l."debit" - l."credit"),0)) > 0.01`,
  },
  {
    name: "Duplicate account names within an organization",
    severity: "WARN",
    hint: "Rename or merge. Duplicate names cause wrong account selection.",
    sql: `SELECT "organizationId", LOWER(TRIM("name")) AS name, COUNT(*)::int AS accounts, STRING_AGG("code", ', ' ORDER BY "code") AS codes
          FROM "Account" GROUP BY "organizationId", LOWER(TRIM("name")) HAVING COUNT(*) > 1`,
  },
  {
    name: "Reversed journals with no reversal entry",
    severity: "WARN",
    hint: "A REVERSED journal should have a REV- entry.",
    sql: `SELECT je."organizationId", je."reference" FROM "JournalEntry" je
          WHERE je."status" = 'REVERSED' AND NOT EXISTS (SELECT 1 FROM "JournalEntry" r WHERE r."reversalOfId" = je."id")`,
  },
];

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const names = new Map(orgs.map((o) => [o.id, o.name]));
  let failures = 0;

  console.log(`\nZIYA FOS - accounting engine health check (${orgs.length} organizations)\n`);

  for (const check of checks) {
    const rows = (await prisma.$queryRawUnsafe(check.sql)) as Record<string, unknown>[];
    const ok = rows.length === 0;

    console.log(`[${ok ? "PASS" : check.severity}] ${check.name}${ok ? "" : ` (${rows.length})`}`);
    if (ok) continue;

    console.log(`       ${check.hint}`);
    console.table(
      rows.slice(0, 20).map((row) => {
        const id = row.organizationId as string | undefined;
        return id ? { organization: names.get(id) ?? id, ...row, organizationId: undefined } : row;
      })
    );
    if (rows.length > 20) console.log(`       ...and ${rows.length - 20} more`);
    if (check.severity === "FAIL") failures += 1;
  }

  console.log(failures === 0 ? "\nNo blocking problems found.\n" : `\n${failures} blocking check(s) failed.\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("Health check crashed:", error);
  await prisma.$disconnect();
  process.exit(2);
});