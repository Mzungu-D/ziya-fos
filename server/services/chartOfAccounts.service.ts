import { Prisma, PrismaClient } from "@prisma/client";

export type ChartOfAccountsDb =
  | Prisma.TransactionClient
  | PrismaClient;

/**
 * Ziya FOS — Canonical Standard Chart of Accounts
 *
 * IMPORTANT:
 * - This is the single global source of truth for standard accounts.
 * - Accounts are always created within an organization/tenant.
 * - Existing tenant accounts are never overwritten.
 * - Demo Company is NOT treated specially.
 * - New tenants receive this baseline during provisioning.
 * - Existing tenants receive missing accounts during reconciliation.
 */
export const STANDARD_CHART_OF_ACCOUNTS = [
  // =========================================================
  // ASSETS
  // =========================================================
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

  // =========================================================
  // LIABILITIES
  // =========================================================
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
    description: "Borrowings and other financing obligations.",
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

  // =========================================================
  // EQUITY
  // =========================================================
  {
    code: "3100",
    name: "Share Capital",
    type: "EQUITY",
    description: "Capital contributed by shareholders.",
  },
  {
    code: "3200",
    name: "Retained Earnings",
    type: "EQUITY",
    description: "Accumulated profits retained in the business.",
  },
  {
    code: "3300",
    name: "Owner's Capital",
    type: "EQUITY",
    description: "Capital contributed by owners.",
  },
  {
    code: "3400",
    name: "Drawings / Distributions",
    type: "EQUITY",
    description: "Owner withdrawals or distributions.",
  },

  // =========================================================
  // INCOME
  // =========================================================
  {
    code: "4100",
    name: "Sales Revenue",
    type: "INCOME",
    description: "Income generated from sale of goods.",
  },
  {
    code: "4200",
    name: "Service Revenue",
    type: "INCOME",
    description: "Income generated from services provided.",
  },
  {
    code: "4300",
    name: "Other Income",
    type: "INCOME",
    description: "Other operating and non-operating income.",
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

  // =========================================================
  // EXPENSES
  // =========================================================
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
    description: "Employee salaries and wages.",
  },
  {
    code: "5200",
    name: "Rent Expense",
    type: "EXPENSE",
    description: "Premises and office rent.",
  },
  {
    code: "5300",
    name: "Utilities Expense",
    type: "EXPENSE",
    description: "Electricity, water, internet and other utilities.",
  },
  {
    code: "5400",
    name: "Marketing and Advertising",
    type: "EXPENSE",
    description: "Marketing, advertising and promotional costs.",
  },
  {
    code: "5500",
    name: "Office Expenses",
    type: "EXPENSE",
    description: "General office operating expenses.",
  },
  {
    code: "5600",
    name: "Software and Subscriptions",
    type: "EXPENSE",
    description: "Software licences and recurring subscriptions.",
  },
  {
    code: "5700",
    name: "Professional Fees",
    type: "EXPENSE",
    description: "Legal, accounting and professional services.",
  },
  {
    code: "5800",
    name: "Insurance",
    type: "EXPENSE",
    description: "Business insurance costs.",
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

/**
 * Compatibility alias.
 *
 * There must be only one actual source of truth.
 * Existing consumers using DEFAULT_CHART_OF_ACCOUNTS
 * therefore point to the canonical standard definition above.
 */
export const DEFAULT_CHART_OF_ACCOUNTS =
  STANDARD_CHART_OF_ACCOUNTS;

export async function ensureStandardChartOfAccounts(
  db: ChartOfAccountsDb,
  organizationId: string
) {
  const normalizedOrganizationId = organizationId?.trim();

  if (!normalizedOrganizationId) {
    throw new Error(
      "Organization context is required to initialize the chart of accounts."
    );
  }

  const organization = await db.organization.findUnique({
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

  const existingAccounts = await db.account.findMany({
    where: {
      organizationId: normalizedOrganizationId,
    },
    select: {
      code: true,
    },
  });

  const existingCodes = new Set(
    existingAccounts.map((account) => account.code)
  );

  const missingAccounts = STANDARD_CHART_OF_ACCOUNTS.filter(
    (account) => !existingCodes.has(account.code)
  );

  if (missingAccounts.length > 0) {
    await db.account.createMany({
      data: missingAccounts.map((account) => ({
        code: account.code,
        name: account.name,
        type: account.type,
        description: account.description,
        organizationId: normalizedOrganizationId,
      })),
      skipDuplicates: true,
    });
  }

  const totalStandardAccounts = await db.account.count({
    where: {
      organizationId: normalizedOrganizationId,
      code: {
        in: STANDARD_CHART_OF_ACCOUNTS.map(
          (account) => account.code
        ),
      },
    },
  });

  return {
    createdCount: missingAccounts.length,
    totalStandardAccounts,
  };
}