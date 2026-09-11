ALTER TABLE "ProcurementRequest"
ADD COLUMN "vendorId" TEXT;

CREATE INDEX "ProcurementRequest_vendorId_idx"
ON "ProcurementRequest"("vendorId");

ALTER TABLE "ProcurementRequest"
ADD CONSTRAINT "ProcurementRequest_vendorId_fkey"
FOREIGN KEY ("vendorId")
REFERENCES "Vendor"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
