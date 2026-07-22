import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const accounts = [
  // =========================================================
  // ASSETS - 1000 SERIES
  // =========================================================
  {
    code: "1000",
    name: "Cash",
    type: "Asset",
    description: "Cash on hand and petty cash",
  },
  {
    code: "1010",
    name: "Bank Accounts",
    type: "Asset",
    description: "Cash held in company bank accounts",
  },
  {
    code: "1020",
    name: "M-Pesa Clearing Account",
    type: "Asset",
    description: "M-Pesa transactions awaiting settlement or reconciliation",
  },
  {
    code: "1100",
    name: "Accounts Receivable",
    type: "Asset",
    description: "Amounts receivable from customers and other parties",
  },
  {
    code: "1200",
    name: "Loans Receivable",
    type: "Asset",
    description: "Outstanding principal on customer loans",
  },
  {
    code: "1300",
    name: "Prepaid Expenses",
    type: "Asset",
    description: "Expenses paid in advance",
  },
  {
    code: "1400",
    name: "Other Current Assets",
    type: "Asset",
    description: "Other short-term assets",
  },
  {
    code: "1500",
    name: "Property and Equipment",
    type: "Asset",
    description: "Company property, equipment and other fixed assets",
  },
  {
    code: "1510",
    name: "Accumulated Depreciation",
    type: "Asset",
    description: "Accumulated depreciation of property and equipment",
  },

  // =========================================================
  // LIABILITIES - 2000 SERIES
  // =========================================================
  {
    code: "2000",
    name: "Accounts Payable",
    type: "Liability",
    description: "Amounts owed to suppliers and vendors",
  },
  {
    code: "2100",
    name: "Accrued Expenses",
    type: "Liability",
    description: "Expenses incurred but not yet paid",
  },
  {
    code: "2200",
    name: "Taxes Payable",
    type: "Liability",
    description: "Taxes due to tax authorities",
  },
  {
    code: "2210",
    name: "PAYE Payable",
    type: "Liability",
    description: "PAYE deductions payable",
  },
  {
    code: "2220",
    name: "VAT Payable",
    type: "Liability",
    description: "VAT liability payable",
  },
  {
    code: "2300",
    name: "Payroll Liabilities",
    type: "Liability",
    description: "Employee and payroll-related liabilities",
  },
  {
    code: "2400",
    name: "Other Current Liabilities",
    type: "Liability",
    description: "Other short-term company liabilities",
  },

  // =========================================================
  // EQUITY - 3000 SERIES
  // =========================================================
  {
    code: "3000",
    name: "Share Capital",
    type: "Equity",
    description: "Capital contributed by shareholders",
  },
  {
    code: "3100",
    name: "Retained Earnings",
    type: "Equity",
    description: "Accumulated retained profits and losses",
  },
  {
    code: "3200",
    name: "Current Year Earnings",
    type: "Equity",
    description: "Current financial year profit or loss",
  },

  // =========================================================
  // INCOME - 4000 SERIES
  // =========================================================
  {
    code: "4000",
    name: "Operating Revenue",
    type: "Income",
    description: "Revenue generated from normal business operations",
  },
  {
    code: "4100",
    name: "Service Income",
    type: "Income",
    description: "Income earned from company services",
  },
  {
    code: "4200",
    name: "Other Income",
    type: "Income",
    description: "Income earned outside primary operations",
  },

  // =========================================================
  // EXPENSES - 5000 SERIES
  // =========================================================
  {
    code: "5000",
    name: "Salaries and Wages",
    type: "Expense",
    description: "Employee salaries and wages",
  },
  {
    code: "5010",
    name: "Employee Benefits",
    type: "Expense",
    description: "Employee benefits and staff-related costs",
  },
  {
    code: "5100",
    name: "Rent Expense",
    type: "Expense",
    description: "Office and premises rental expenses",
  },
  {
    code: "5200",
    name: "Utilities Expense",
    type: "Expense",
    description: "Electricity, water and other utilities",
  },
  {
    code: "5300",
    name: "Transport and Travel",
    type: "Expense",
    description: "Business transport and travel expenses",
  },
  {
    code: "5400",
    name: "Technology and Software",
    type: "Expense",
    description: "Software subscriptions and technology expenses",
  },
  {
    code: "5500",
    name: "Professional Fees",
    type: "Expense",
    description: "Legal, accounting, consulting and professional services",
  },
  {
    code: "5600",
    name: "Bank Charges",
    type: "Expense",
    description: "Bank fees and transaction charges",
  },
  {
    code: "5610",
    name: "M-Pesa Transaction Charges",
    type: "Expense",
    description: "M-Pesa and mobile-money transaction fees",
  },
  {
    code: "5700",
    name: "Marketing and Advertising",
    type: "Expense",
    description: "Marketing, promotion and advertising expenses",
  },
  {
    code: "5800",
    name: "Office and Administrative Expenses",
    type: "Expense",
    description: "General office and administrative expenditure",
  },
  {
    code: "5900",
    name: "Depreciation Expense",
    type: "Expense",
    description: "Periodic depreciation expense",
  },
  {
    code: "5990",
    name: "Other Operating Expenses",
    type: "Expense",
    description: "Other operating expenses not separately classified",
  },
];

async function main() {
  console.log("Seeding Ziya FOS Chart of Accounts...");

  for (const account of accounts) {
    await prisma.account.upsert({
      where: {
        code: account.code,
      },
      update: {
        name: account.name,
        type: account.type,
        description: account.description,
      },
      create: account,
    });
  }

  console.log(
    `Chart of Accounts ready. ${accounts.length} accounts processed.`
  );
}

main()
  .catch((error) => {
    console.error("Chart of Accounts seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });