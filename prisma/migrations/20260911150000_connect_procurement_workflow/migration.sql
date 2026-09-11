-- Connect Procurement Requests to Approval and Budget
ALTER TABLE "ProcurementRequest"
ADD COLUMN "approvalId" TEXT,
ADD COLUMN "budgetId" TEXT;

CREATE UNIQUE INDEX "ProcurementRequest_approvalId_key"
ON "ProcurementRequest"("approvalId");

CREATE INDEX "ProcurementRequest_budgetId_idx"
ON "ProcurementRequest"("budgetId");

ALTER TABLE "ProcurementRequest"
ADD CONSTRAINT "ProcurementRequest_approvalId_fkey"
FOREIGN KEY ("approvalId")
REFERENCES "Approval"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "ProcurementRequest"
ADD CONSTRAINT "ProcurementRequest_budgetId_fkey"
FOREIGN KEY ("budgetId")
REFERENCES "Budget"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;


-- Connect Accounts Payable to Procurement Request
ALTER TABLE "AccountsPayable"
ADD COLUMN "procurementRequestId" TEXT;

CREATE UNIQUE INDEX "AccountsPayable_procurementRequestId_key"
ON "AccountsPayable"("procurementRequestId");

ALTER TABLE "AccountsPayable"
ADD CONSTRAINT "AccountsPayable_procurementRequestId_fkey"
FOREIGN KEY ("procurementRequestId")
REFERENCES "ProcurementRequest"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;


-- Connect Expense to Procurement Request
ALTER TABLE "Expense"
ADD COLUMN "procurementRequestId" TEXT;

CREATE UNIQUE INDEX "Expense_procurementRequestId_key"
ON "Expense"("procurementRequestId");

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_procurementRequestId_fkey"
FOREIGN KEY ("procurementRequestId")
REFERENCES "ProcurementRequest"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;


-- Connect Asset to Procurement Request
ALTER TABLE "Asset"
ADD COLUMN "procurementRequestId" TEXT;

CREATE UNIQUE INDEX "Asset_procurementRequestId_key"
ON "Asset"("procurementRequestId");

ALTER TABLE "Asset"
ADD CONSTRAINT "Asset_procurementRequestId_fkey"
FOREIGN KEY ("procurementRequestId")
REFERENCES "ProcurementRequest"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;


-- Helpful Procurement workflow indexes
CREATE INDEX "ProcurementRequest_approvalId_idx"
ON "ProcurementRequest"("approvalId");
