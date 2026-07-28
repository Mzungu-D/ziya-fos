ALTER TABLE "Account"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "JournalEntry"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Customer"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Loan"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Transaction"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Budget"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Asset"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "AuditTrail"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Approval"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Vendor"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "AccountsPayable"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "AccountsReceivable"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Expense"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "BankAccount"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Invoice"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "MpesaTransaction"
ALTER COLUMN "organizationId" SET NOT NULL;
