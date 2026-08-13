BEGIN;

CREATE TABLE IF NOT EXISTS "BankPaymentBatch" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "batchReference" TEXT NOT NULL,
    "description" TEXT,
    "totalAmount" NUMERIC(18,2) NOT NULL DEFAULT 0,
    "totalPayments" INTEGER NOT NULL DEFAULT 0,
    "successful" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerBatchId" TEXT,
    "idempotencyKey" TEXT,
    "submittedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankPaymentBatch_organizationId_fkey"
        FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id")
        ON DELETE CASCADE,

    CONSTRAINT "BankPaymentBatch_bankAccountId_fkey"
        FOREIGN KEY ("bankAccountId")
        REFERENCES "BankAccount"("id")
        ON DELETE RESTRICT,

    CONSTRAINT "BankPaymentBatch_totalAmount_check"
        CHECK ("totalAmount" >= 0),

    CONSTRAINT "BankPaymentBatch_totalPayments_check"
        CHECK ("totalPayments" >= 0),

    CONSTRAINT "BankPaymentBatch_successful_check"
        CHECK ("successful" >= 0),

    CONSTRAINT "BankPaymentBatch_failed_check"
        CHECK ("failed" >= 0),

    CONSTRAINT "BankPaymentBatch_pending_check"
        CHECK ("pending" >= 0),

    CONSTRAINT "BankPaymentBatch_counts_check"
        CHECK (
            "successful" + "failed" + "pending" = "totalPayments"
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankPaymentBatch_org_reference_key"
    ON "BankPaymentBatch" ("organizationId", "batchReference");

CREATE UNIQUE INDEX IF NOT EXISTS "BankPaymentBatch_org_idempotency_key"
    ON "BankPaymentBatch" ("organizationId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "BankPaymentBatch_org_idx"
    ON "BankPaymentBatch" ("organizationId");

CREATE INDEX IF NOT EXISTS "BankPaymentBatch_org_status_idx"
    ON "BankPaymentBatch" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "BankPaymentBatch_org_bank_idx"
    ON "BankPaymentBatch" ("organizationId", "bankAccountId");

CREATE INDEX IF NOT EXISTS "BankPaymentBatch_provider_batch_idx"
    ON "BankPaymentBatch" ("providerBatchId");

CREATE INDEX IF NOT EXISTS "BankPaymentBatch_created_idx"
    ON "BankPaymentBatch" ("createdAt");


CREATE TABLE IF NOT EXISTS "BankPayment" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "batchId" TEXT,
    "paymentReference" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankCode" TEXT,
    "branchCode" TEXT,
    "amount" NUMERIC(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "providerStatus" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT,
    "submittedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankPayment_organizationId_fkey"
        FOREIGN KEY ("organizationId")
        REFERENCES "Organization"("id")
        ON DELETE CASCADE,

    CONSTRAINT "BankPayment_bankAccountId_fkey"
        FOREIGN KEY ("bankAccountId")
        REFERENCES "BankAccount"("id")
        ON DELETE RESTRICT,

    CONSTRAINT "BankPayment_batchId_fkey"
        FOREIGN KEY ("batchId")
        REFERENCES "BankPaymentBatch"("id")
        ON DELETE SET NULL,

    CONSTRAINT "BankPayment_amount_check"
        CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankPayment_org_reference_key"
    ON "BankPayment" ("organizationId", "paymentReference");

CREATE UNIQUE INDEX IF NOT EXISTS "BankPayment_org_idempotency_key"
    ON "BankPayment" ("organizationId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "BankPayment_org_idx"
    ON "BankPayment" ("organizationId");

CREATE INDEX IF NOT EXISTS "BankPayment_org_status_idx"
    ON "BankPayment" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "BankPayment_org_bank_idx"
    ON "BankPayment" ("organizationId", "bankAccountId");

CREATE INDEX IF NOT EXISTS "BankPayment_batch_idx"
    ON "BankPayment" ("batchId");

CREATE INDEX IF NOT EXISTS "BankPayment_provider_idx"
    ON "BankPayment" ("providerPaymentId");

CREATE INDEX IF NOT EXISTS "BankPayment_created_idx"
    ON "BankPayment" ("createdAt");


CREATE OR REPLACE FUNCTION update_bank_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "BankPaymentBatch_updatedAt_trigger"
ON "BankPaymentBatch";

CREATE TRIGGER "BankPaymentBatch_updatedAt_trigger"
BEFORE UPDATE ON "BankPaymentBatch"
FOR EACH ROW
EXECUTE FUNCTION update_bank_payment_updated_at();

DROP TRIGGER IF EXISTS "BankPayment_updatedAt_trigger"
ON "BankPayment";

CREATE TRIGGER "BankPayment_updatedAt_trigger"
BEFORE UPDATE ON "BankPayment"
FOR EACH ROW
EXECUTE FUNCTION update_bank_payment_updated_at();

COMMIT;