import { Prisma, PrismaClient } from "@prisma/client";

export type ChartOfAccountsDb =
  | Prisma.TransactionClient
  | PrismaClient;

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
] as const;

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