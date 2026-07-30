const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const models = [
    ["Account", prisma.account],
    ["JournalEntry", prisma.journalEntry],
    ["Customer", prisma.customer],
    ["Loan", prisma.loan],
    ["Transaction", prisma.transaction],
    ["Budget", prisma.budget],
    ["Asset", prisma.asset],
    ["AuditTrail", prisma.auditTrail],
    ["Approval", prisma.approval],
    ["Vendor", prisma.vendor],
    ["AccountsPayable", prisma.accountsPayable],
    ["AccountsReceivable", prisma.accountsReceivable],
    ["Expense", prisma.expense],
    ["BankAccount", prisma.bankAccount],
    ["Invoice", prisma.invoice],
    ["MpesaTransaction", prisma.mpesaTransaction],
  ];

  console.log("\nNULL organizationId audit\n");

  let total = 0;

  for (const [name, model] of models) {
    const count = await model.count({
      where: {
        organizationId: null,
      },
    });

    total += count;

    console.log(
      `${name.padEnd(22)} ${count}`
    );
  }

  console.log(
    "\nTotal NULL organizationId records:",
    total
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
