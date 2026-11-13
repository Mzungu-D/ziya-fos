-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementBalance" DOUBLE PRECISION NOT NULL,
    "bookBalance" DOUBLE PRECISION NOT NULL,
    "adjustedBalance" DOUBLE PRECISION NOT NULL,
    "clearedCount" INTEGER NOT NULL DEFAULT 0,
    "outstandingCount" INTEGER NOT NULL DEFAULT 0,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "BankStatementLine" ADD COLUMN "reconciliationId" TEXT;

-- CreateIndex
CREATE INDEX "BankRecon_org_bank_date_idx" ON "BankReconciliation"("organizationId", "bankAccountId", "statementDate");

-- A ledger line can be matched to at most one statement line
CREATE UNIQUE INDEX "BankStatementLine_matchedJournalLineId_key" ON "BankStatementLine"("matchedJournalLineId");

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (a matched journal line cannot be deleted)
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_matchedJournalLineId_fkey" FOREIGN KEY ("matchedJournalLineId") REFERENCES "JournalEntryLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;