-- Account subtype: what an account is used for (BANK, CASH, RECEIVABLE_CONTROL, ...)
ALTER TABLE "Account" ADD COLUMN "subtype" TEXT;

CREATE INDEX "Account_organizationId_subtype_idx" ON "Account"("organizationId", "subtype");

-- Every account that already has a bank profile is a bank account (all tenants)
UPDATE "Account"
SET "subtype" = 'BANK'
WHERE "id" IN (
  SELECT DISTINCT "glAccountId" FROM "BankAccount" WHERE "glAccountId" IS NOT NULL
);