import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const expenses = await prisma.expense.findMany({
    where: { status: "POSTED" },
    orderBy: { expenseDate: "desc" },
    take: 20,
    select: {
      id: true,
      organizationId: true,
      expenseCode: true,
      description: true,
      amount: true,
      currency: true,
      expenseDate: true,
      status: true,
      paymentStatus: true,
      expenseAccountId: true,
      paymentAccountId: true,
      journalEntryId: true,
    },
  });

  console.log("\n=== RECENT POSTED EXPENSES ===");
  console.table(expenses.map((e) => ({
    ...e,
    amount: String(e.amount),
    expenseDate: e.expenseDate.toISOString(),
  })));

  const journalIds = expenses
    .map((e) => e.journalEntryId)
    .filter((id): id is string => Boolean(id));

  const journals = journalIds.length
    ? await prisma.journalEntry.findMany({
        where: { id: { in: journalIds } },
        select: {
          id: true,
          organizationId: true,
          reference: true,
          status: true,
          transactionDate: true,
          lines: {
            select: {
              accountId: true,
              debit: true,
              credit: true,
              account: {
                select: { code: true, name: true, type: true },
              },
            },
          },
        },
      })
    : [];

  console.log("\n=== EXPENSE JOURNALS AND ACCOUNT CLASSIFICATION ===");
  console.dir(journals.map((j) => ({
    id: j.id,
    organizationId: j.organizationId,
    reference: j.reference,
    status: j.status,
    transactionDate: j.transactionDate,
    lines: j.lines.map((line) => ({
      accountId: line.accountId,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      debit: String(line.debit),
      credit: String(line.credit),
    })),
  })), { depth: null });

  console.log("\n=== POSTED EXPENSES WITHOUT JOURNALS ===");
  console.table(expenses.filter((e) => !e.journalEntryId).map((e) => ({
    id: e.id,
    organizationId: e.organizationId,
    expenseCode: e.expenseCode,
    amount: String(e.amount),
  })));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
