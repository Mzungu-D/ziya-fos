-- Integrate Expenses with accounting, approvals, and payment tracking.
-- Additive/data-preserving migration.

ALTER TABLE "Expense"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KES',
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "paymentDate" TIMESTAMP(3),
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "expenseAccountId" TEXT,
  ADD COLUMN "paymentAccountId" TEXT,
  ADD COLUMN "bankAccountId" TEXT,
  ADD COLUMN "approvalId" TEXT,
  ADD COLUMN "journalEntryId" TEXT;

CREATE UNIQUE INDEX "Expense_approvalId_key"
  ON "Expense"("approvalId");

CREATE UNIQUE INDEX "Expense_journalEntryId_key"
  ON "Expense"("journalEntryId");

CREATE INDEX "Expense_expenseAccountId_idx"
  ON "Expense"("expenseAccountId");

CREATE INDEX "Expense_paymentAccountId_idx"
  ON "Expense"("paymentAccountId");

CREATE INDEX "Expense_bankAccountId_idx"
  ON "Expense"("bankAccountId");

CREATE INDEX "Expense_status_idx"
  ON "Expense"("status");

CREATE INDEX "Expense_paymentStatus_idx"
  ON "Expense"("paymentStatus");

CREATE INDEX "Expense_expenseDate_idx"
  ON "Expense"("expenseDate");

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_expenseAccountId_fkey"
  FOREIGN KEY ("expenseAccountId")
  REFERENCES "Account"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_paymentAccountId_fkey"
  FOREIGN KEY ("paymentAccountId")
  REFERENCES "Account"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId")
  REFERENCES "BankAccount"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_approvalId_fkey"
  FOREIGN KEY ("approvalId")
  REFERENCES "Approval"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId")
  REFERENCES "JournalEntry"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
