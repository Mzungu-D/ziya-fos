-- AlterTable
ALTER TABLE "MpesaTransaction"
ADD COLUMN "batchId" TEXT,
ADD COLUMN "conversationId" TEXT,
ADD COLUMN "originatorConversationId" TEXT;

-- CreateTable
CREATE TABLE "MpesaPaymentBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "batchReference" TEXT NOT NULL,
    "description" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPayments" INTEGER NOT NULL DEFAULT 0,
    "successful" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaPaymentBatch_pkey"
        PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MpesaPaymentBatch_organizationId_idx"
ON "MpesaPaymentBatch"("organizationId");

-- CreateIndex
CREATE INDEX "MpesaPaymentBatch_organizationId_status_idx"
ON "MpesaPaymentBatch"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MpesaPaymentBatch_createdAt_idx"
ON "MpesaPaymentBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaPaymentBatch_organizationId_batchReference_key"
ON "MpesaPaymentBatch"("organizationId", "batchReference");

-- CreateIndex
CREATE INDEX "MpesaTransaction_organizationId_batchId_idx"
ON "MpesaTransaction"("organizationId", "batchId");

-- CreateIndex
CREATE INDEX "MpesaTransaction_conversationId_idx"
ON "MpesaTransaction"("conversationId");

-- CreateIndex
CREATE INDEX "MpesaTransaction_originatorConversationId_idx"
ON "MpesaTransaction"("originatorConversationId");

-- CreateIndex
CREATE INDEX "MpesaTransaction_status_idx"
ON "MpesaTransaction"("status");

-- AddForeignKey
ALTER TABLE "MpesaTransaction"
ADD CONSTRAINT "MpesaTransaction_batchId_fkey"
FOREIGN KEY ("batchId")
REFERENCES "MpesaPaymentBatch"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MpesaPaymentBatch"
ADD CONSTRAINT "MpesaPaymentBatch_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;