-- AlterTable
ALTER TABLE "MpesaTransaction"
ADD COLUMN "destination" TEXT,
ADD COLUMN "destinationName" TEXT,
ADD COLUMN "destinationType" TEXT,
ADD COLUMN "paybillNumber" TEXT,
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "tillNumber" TEXT,
ALTER COLUMN "phoneNumber" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MpesaTransaction_organizationId_paymentMethod_idx"
ON "MpesaTransaction"("organizationId", "paymentMethod");

-- CreateIndex
CREATE INDEX "MpesaTransaction_organizationId_destinationType_idx"
ON "MpesaTransaction"("organizationId", "destinationType");
