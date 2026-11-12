import { applyStandardSubtypes } from "./accountRoles.service";
import { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../config/prisma";

/* =========================================================
   DATABASE TYPES
========================================================= */

export type ChartOfAccountsDb =
  | Prisma.TransactionClient
  | PrismaClient;


const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;

const MAX_ORGANIZATION_ID_LENGTH = 128;

function normalizeOrganizationId(organizationId: string): string {
  const normalized = String(organizationId ?? "").trim();

  if (!normalized) {
    throw new Error(
      "Organization context is required to initialize the chart of accounts.",
    );
  }

  if (normalized.length > MAX_ORGANIZATION_ID_LENGTH) {
    throw new Error("Invalid organization context.");
  }

  return normalized;
}

function assertStandardChartDefinition(): void {
  const seenCodes = new Set<string>();

  for (const account of STANDARD_CHART_OF_ACCOUNTS) {
    if (!/^[0-9]{4,10}$/.test(account.code)) {
      throw new Error(`Invalid standard account code: ${account.code}`);
    }

    if (seenCodes.has(account.code)) {
      throw new Error(`Duplicate standard account code: ${account.code}`);
    }

    if (!ACCOUNT_TYPES.includes(account.type as (typeof ACCOUNT_TYPES)[number])) {
      throw new Error(
        `Invalid standard account type for ${account.code}: ${account.type}`,
      );
    }

    seenCodes.add(account.code);
  }

  for (const code of Object.keys(STANDARD_ACCOUNT_REPORTING_METADATA)) {
    if (!seenCodes.has(code)) {
      throw new Error(
        `Reporting metadata exists for unknown standard account ${code}.`,
      );
    }
  }

  for (const code of seenCodes) {
    if (!STANDARD_ACCOUNT_REPORTING_METADATA[code]) {
      throw new Error(
        `Missing reporting metadata for standard account ${code}.`,
      );
    }
  }
}

/* =========================================================
   STANDARD CHART OF ACCOUNTS
========================================================= */

export const STANDARD_CHART_OF_ACCOUNTS = [
  {
    code: "1100",
    name: "Cash at Bank",
    type: "ASSET",
    description: "Cash held in bank accounts.",
  },
  {
    code: "1110",
    name: "Petty Cash",
    type: "ASSET",
    description: "Physical cash held for minor expenses.",
  },
  {
    code: "1200",
    name: "Accounts Receivable",
    type: "ASSET",
    description: "Amounts owed by customers.",
  },
  {
    code: "1300",
    name: "Inventory",
    type: "ASSET",
    description: "Inventory held for sale or operations.",
  },
  {
    code: "1400",
    name: "Prepaid Expenses",
    type: "ASSET",
    description: "Expenses paid in advance.",
  },
  {
    code: "1500",
    name: "Property, Plant & Equipment",
    type: "ASSET",
    description: "Long-term tangible business assets.",
  },
  {
    code: "1600",
    name: "Customer Loans Receivable",
    type: "ASSET",
    description:
      "Principal amounts receivable from customers under loan arrangements.",
  },
  {
    code: "1700",
    name: "Accumulated Depreciation",
    type: "ASSET",
    description:
      "Cumulative depreciation recorded against depreciable fixed assets.",
  },
  {
    code: "1800",
    name: "Other Current Assets",
    type: "ASSET",
    description:
      "Other assets expected to be realized or used within the normal operating cycle.",
  },
  {
    code: "1900",
    name: "Other Non-Current Assets",
    type: "ASSET",
    description:
      "Other long-term assets not classified under specific non-current asset accounts.",
  },

  {
    code: "2100",
    name: "Accounts Payable",
    type: "LIABILITY",
    description: "Amounts owed to suppliers and vendors.",
  },
  {
    code: "2200",
    name: "Accrued Expenses",
    type: "LIABILITY",
    description: "Expenses incurred but not yet paid.",
  },
  {
    code: "2300",
    name: "Tax Payable",
    type: "LIABILITY",
    description: "Taxes owed to tax authorities.",
  },
  {
    code: "2400",
    name: "Loans Payable",
    type: "LIABILITY",
    description:
      "Borrowings and other financing obligations.",
  },
  {
    code: "2500",
    name: "Interest Payable",
    type: "LIABILITY",
    description:
      "Interest incurred and payable on loans and other financing obligations.",
  },
  {
    code: "2600",
    name: "Other Current Liabilities",
    type: "LIABILITY",
    description:
      "Other obligations expected to be settled within the normal operating cycle.",
  },
  {
    code: "2700",
    name: "Long-Term Liabilities",
    type: "LIABILITY",
    description:
      "Long-term obligations due beyond the normal current liability period.",
  },

  {
    code: "3100",
    name: "Share Capital",
    type: "EQUITY",
    description:
      "Capital contributed by shareholders.",
  },
  {
    code: "3200",
    name: "Retained Earnings",
    type: "EQUITY",
    description:
      "Accumulated profits retained in the business.",
  },
  {
    code: "3300",
    name: "Owner's Capital",
    type: "EQUITY",
    description:
      "Capital contributed by owners.",
  },
  {
    code: "3400",
    name: "Drawings / Distributions",
    type: "EQUITY",
    description:
      "Owner withdrawals or distributions.",
  },

  {
    code: "4100",
    name: "Sales Revenue",
    type: "INCOME",
    description:
      "Income generated from sale of goods.",
  },
  {
    code: "4200",
    name: "Service Revenue",
    type: "INCOME",
    description:
      "Income generated from services provided.",
  },
  {
    code: "4300",
    name: "Other Income",
    type: "INCOME",
    description:
      "Other operating and non-operating income.",
  },
  {
    code: "4400",
    name: "Interest Income",
    type: "INCOME",
    description:
      "Income earned from interest on loans, deposits, investments, and other financial assets.",
  },
  {
    code: "4500",
    name: "Loan Fees and Charges",
    type: "INCOME",
    description:
      "Income generated from loan-related fees, charges, and service fees.",
  },

  {
    code: "5000",
    name: "Cost of Goods Sold",
    type: "EXPENSE",
    description:
      "Direct costs attributable to goods sold during the reporting period.",
  },
  {
    code: "5100",
    name: "Salaries and Wages",
    type: "EXPENSE",
    description:
      "Employee salaries and wages.",
  },
  {
    code: "5200",
    name: "Rent Expense",
    type: "EXPENSE",
    description:
      "Premises and office rent.",
  },
  {
    code: "5300",
    name: "Utilities Expense",
    type: "EXPENSE",
    description:
      "Electricity, water, internet and other utilities.",
  },
  {
    code: "5400",
    name: "Marketing and Advertising",
    type: "EXPENSE",
    description:
      "Marketing, advertising and promotional costs.",
  },
  {
    code: "5500",
    name: "Office Expenses",
    type: "EXPENSE",
    description:
      "General office operating expenses.",
  },
  {
    code: "5600",
    name: "Software and Subscriptions",
    type: "EXPENSE",
    description:
      "Software licences and recurring subscriptions.",
  },
  {
    code: "5700",
    name: "Professional Fees",
    type: "EXPENSE",
    description:
      "Legal, accounting and professional services.",
  },
  {
    code: "5800",
    name: "Insurance",
    type: "EXPENSE",
    description:
      "Business insurance costs.",
  },
  {
    code: "5900",
    name: "Depreciation Expense",
    type: "EXPENSE",
    description:
      "Depreciation expense recognized on depreciable fixed assets.",
  },
  {
    code: "6000",
    name: "Interest Expense",
    type: "EXPENSE",
    description:
      "Interest incurred on loans, borrowings, and other financing obligations.",
  },
  {
    code: "6100",
    name: "Bank Charges and Transaction Fees",
    type: "EXPENSE",
    description:
      "Bank fees, transaction charges, payment processing fees, and related costs.",
  },
  {
    code: "6200",
    name: "Taxes and Licenses",
    type: "EXPENSE",
    description:
      "Business taxes, statutory charges, licenses, permits, and related government fees.",
  },
  {
    code: "6300",
    name: "Bad Debt Expense",
    type: "EXPENSE",
    description:
      "Expense recognized for amounts receivable that are expected to be uncollectible.",
  },
] as const;

/* =========================================================
   IFRS-ORIENTED REPORTING METADATA
========================================================= */

export type IFRSStatementSection =
  | "CURRENT_ASSET"
  | "NON_CURRENT_ASSET"
  | "CURRENT_LIABILITY"
  | "NON_CURRENT_LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "COST_OF_SALES"
  | "OPERATING_EXPENSE"
  | "FINANCE_INCOME"
  | "FINANCE_COST"
  | "TAX";

export interface StandardAccountReportingMetadata {
  statementSection: IFRSStatementSection;
  normalBalance: "DEBIT" | "CREDIT";
  cashFlowCategory?:
    | "OPERATING"
    | "INVESTING"
    | "FINANCING"
    | "NON_CASH";
  current: boolean;
  contra: boolean;
  postingAllowed: boolean;
}

const ASSET_METADATA: StandardAccountReportingMetadata = {
  statementSection: "CURRENT_ASSET",
  normalBalance: "DEBIT",
  current: true,
  contra: false,
  postingAllowed: true,
};

export const STANDARD_ACCOUNT_REPORTING_METADATA: Record<
  string,
  StandardAccountReportingMetadata
> = {
  "1100": {
    ...ASSET_METADATA,
    cashFlowCategory: "OPERATING",
  },

  "1110": {
    ...ASSET_METADATA,
    cashFlowCategory: "OPERATING",
  },

  "1200": {
    ...ASSET_METADATA,
    cashFlowCategory: "OPERATING",
  },

  "1300": {
    ...ASSET_METADATA,
    cashFlowCategory: "OPERATING",
  },

  "1400": {
    ...ASSET_METADATA,
    cashFlowCategory: "OPERATING",
  },

  "1500": {
    statementSection: "NON_CURRENT_ASSET",
    normalBalance: "DEBIT",
    cashFlowCategory: "INVESTING",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "1600": {
    ...ASSET_METADATA,
    cashFlowCategory: "OPERATING",
  },

  "1700": {
    statementSection: "NON_CURRENT_ASSET",
    normalBalance: "CREDIT",
    cashFlowCategory: "NON_CASH",
    current: false,
    contra: true,
    postingAllowed: true,
  },

  "1800": {
    ...ASSET_METADATA,
    cashFlowCategory: "OPERATING",
  },

  "1900": {
    statementSection: "NON_CURRENT_ASSET",
    normalBalance: "DEBIT",
    cashFlowCategory: "INVESTING",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "2100": {
    statementSection: "CURRENT_LIABILITY",
    normalBalance: "CREDIT",
    current: true,
    contra: false,
    postingAllowed: true,
  },

  "2200": {
    statementSection: "CURRENT_LIABILITY",
    normalBalance: "CREDIT",
    current: true,
    contra: false,
    postingAllowed: true,
  },

  "2300": {
    statementSection: "CURRENT_LIABILITY",
    normalBalance: "CREDIT",
    current: true,
    contra: false,
    postingAllowed: true,
  },

  "2400": {
    statementSection: "NON_CURRENT_LIABILITY",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "2500": {
    statementSection: "CURRENT_LIABILITY",
    normalBalance: "CREDIT",
    current: true,
    contra: false,
    postingAllowed: true,
  },

  "2600": {
    statementSection: "CURRENT_LIABILITY",
    normalBalance: "CREDIT",
    current: true,
    contra: false,
    postingAllowed: true,
  },

  "2700": {
    statementSection: "NON_CURRENT_LIABILITY",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "3100": {
    statementSection: "EQUITY",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "3200": {
    statementSection: "EQUITY",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "3300": {
    statementSection: "EQUITY",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "3400": {
    statementSection: "EQUITY",
    normalBalance: "DEBIT",
    current: false,
    contra: true,
    postingAllowed: true,
  },

  "4100": {
    statementSection: "REVENUE",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "4200": {
    statementSection: "REVENUE",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "4300": {
    statementSection: "REVENUE",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "4400": {
    statementSection: "FINANCE_INCOME",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "4500": {
    statementSection: "REVENUE",
    normalBalance: "CREDIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5000": {
    statementSection: "COST_OF_SALES",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5100": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5200": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5300": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5400": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5500": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5600": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5700": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5800": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "5900": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "6000": {
    statementSection: "FINANCE_COST",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "6100": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "6200": {
    statementSection: "TAX",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },

  "6300": {
    statementSection: "OPERATING_EXPENSE",
    normalBalance: "DEBIT",
    current: false,
    contra: false,
    postingAllowed: true,
  },
};

/* =========================================================
   ACCOUNT HELPERS
========================================================= */

export function getStandardAccountReportingMetadata(
  code: string
): StandardAccountReportingMetadata | null {
  return (
    STANDARD_ACCOUNT_REPORTING_METADATA[
      String(code).trim()
    ] ?? null
  );
}

export function isStandardAccountCode(
  code: string
): boolean {
  const normalizedCode =
    String(code).trim();

  return STANDARD_CHART_OF_ACCOUNTS.some(
    (account) =>
      account.code === normalizedCode
  );
}

/* =========================================================
   COMPATIBILITY ALIAS
========================================================= */

export const DEFAULT_CHART_OF_ACCOUNTS =
  STANDARD_CHART_OF_ACCOUNTS;

/* =========================================================
   RESULT TYPE
========================================================= */

export interface StandardChartReconciliationResult {
  createdCount: number;
  updatedCount: number;
  typeChanges: number;
  totalStandardAccounts: number;
}

/* =========================================================
   ENSURE STANDARD CHART OF ACCOUNTS
========================================================= */

export async function ensureStandardChartOfAccounts(
  db: ChartOfAccountsDb,
  organizationId: string
): Promise<StandardChartReconciliationResult> {
  const normalizedOrganizationId =
    normalizeOrganizationId(organizationId);

  assertStandardChartDefinition();

  const organization =
    await db.organization.findUnique({
      where: {
        id: normalizedOrganizationId,
      },
      select: {
        id: true,
      },
    });

  if (!organization) {
    throw new Error(
      `Organization ${normalizedOrganizationId} was not found.`
    );
  }

  const standardCodes =
    STANDARD_CHART_OF_ACCOUNTS.map(
      (account) => account.code
    );

  const existingAccounts =
    await db.account.findMany({
      where: {
        organizationId:
          normalizedOrganizationId,
        code: {
          in: standardCodes,
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        description: true,
        _count: {
          select: {
            journalLines: true,
            debitEntries: true,
            creditEntries: true,
            expenseAccounts: true,
            paymentExpenses: true,
            invoiceLines: true,
            budgets: true,
          },
        },
      },
    });

  const existingByCode =
    new Map(
      existingAccounts.map(
        (account) => [
          account.code,
          account,
        ]
      )
    );

  const missingAccounts =
    STANDARD_CHART_OF_ACCOUNTS.filter(
      (account) =>
        !existingByCode.has(
          account.code
        )
    );

  let createdCount = 0;

  if (
    missingAccounts.length > 0
  ) {
    const createResult =
      await db.account.createMany({
        data:
          missingAccounts.map(
            (account) => ({
              code: account.code,
              name: account.name,
              type: account.type,
              description:
                account.description,
              organizationId:
                normalizedOrganizationId,
            })
          ),
        skipDuplicates: true,
      });

    createdCount =
      createResult.count;
  }

  await applyStandardSubtypes(db, normalizedOrganizationId);

  const accounts =
    await db.account.findMany({
      where: {
        organizationId:
          normalizedOrganizationId,
        code: {
          in: standardCodes,
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        description: true,
        _count: {
          select: {
            journalLines: true,
            debitEntries: true,
            creditEntries: true,
            expenseAccounts: true,
            paymentExpenses: true,
            invoiceLines: true,
            budgets: true,
          },
        },
      },
    });

  const accountsByCode =
    new Map(
      accounts.map(
        (account) => [
          account.code,
          account,
        ]
      )
    );

  let updatedCount = 0;
  let typeChanges = 0;

  for (
    const standardAccount of
      STANDARD_CHART_OF_ACCOUNTS
  ) {
    const existingAccount =
      accountsByCode.get(
        standardAccount.code
      );

    if (!existingAccount) {
      throw new Error(
        `Standard account ${standardAccount.code} could not be initialized for organization ${normalizedOrganizationId}.`
      );
    }

    const typeChanged =
      existingAccount.type !==
      standardAccount.type;

    if (!typeChanged) {
      // Existing tenant account names/descriptions are tenant configuration.
      // Never overwrite those values during standard-chart reconciliation.
      continue;
    }

    const hasAccountingActivity =
      existingAccount._count.journalLines > 0 ||
      existingAccount._count.debitEntries > 0 ||
      existingAccount._count.creditEntries > 0;

    const hasOperationalReferences =
      existingAccount._count.expenseAccounts > 0 ||
      existingAccount._count.paymentExpenses > 0 ||
      existingAccount._count.invoiceLines > 0 ||
      existingAccount._count.budgets > 0;

    if (hasAccountingActivity || hasOperationalReferences) {
      throw new Error(
        `Unsafe chart-of-accounts reconciliation for organization ${normalizedOrganizationId}: ` +
          `standard account ${standardAccount.code} ` +
          `"${existingAccount.name}" has type "${existingAccount.type}", ` +
          `but the standard requires "${standardAccount.type}". ` +
          `The account already has accounting or operational references. ` +
          `Historical account classification must be reviewed before this reconciliation can be applied.`,
      );
    }

    await db.account.update({
      where: { id: existingAccount.id },
      data: { type: standardAccount.type },
    });

    updatedCount++;
    typeChanges++;
  }

  const finalAccounts =
    await db.account.findMany({
      where: {
        organizationId:
          normalizedOrganizationId,
        code: {
          in: standardCodes,
        },
      },
      select: {
        code: true,
        name: true,
        type: true,
        description: true,
      },
    });

  const finalAccountsByCode =
    new Map(
      finalAccounts.map(
        (account) => [
          account.code,
          account,
        ]
      )
    );

  const inconsistentAccounts =
    STANDARD_CHART_OF_ACCOUNTS.filter(
      (standardAccount) => {
        const actual =
          finalAccountsByCode.get(
            standardAccount.code
          );

        return (
          !actual ||
          actual.type !== standardAccount.type
        );
      }
    );

  if (
    inconsistentAccounts.length > 0
  ) {
    throw new Error(
      `Chart of accounts verification failed for organization ${normalizedOrganizationId}. ` +
        `Inconsistent standard account codes: ` +
        `${inconsistentAccounts
          .map(
            (account) =>
              account.code
          )
          .join(", ")}.`
    );
  }

  return {
    createdCount,
    updatedCount,
    typeChanges,
    totalStandardAccounts:
      finalAccounts.length,
  };
}

/* =========================================================
   EXPLICIT INITIALIZATION
========================================================= */

export async function initializeStandardChartOfAccounts(
  organizationId: string
): Promise<StandardChartReconciliationResult> {
  return prisma.$transaction(
    async (tx) =>
      ensureStandardChartOfAccounts(
        tx,
        organizationId
      )
  );
}