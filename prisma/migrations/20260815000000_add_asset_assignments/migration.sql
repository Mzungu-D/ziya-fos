-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "conditionAtAssignment" TEXT,
    "conditionAtReturn" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetAssignment_organizationId_idx"
ON "AssetAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "AssetAssignment_organizationId_employeeId_idx"
ON "AssetAssignment"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "AssetAssignment_organizationId_assetId_idx"
ON "AssetAssignment"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "AssetAssignment_assetId_returnedAt_idx"
ON "AssetAssignment"("assetId", "returnedAt");

-- AddForeignKey
ALTER TABLE "AssetAssignment"
ADD CONSTRAINT "AssetAssignment_assetId_fkey"
FOREIGN KEY ("assetId")
REFERENCES "Asset"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment"
ADD CONSTRAINT "AssetAssignment_employeeId_fkey"
FOREIGN KEY ("employeeId")
REFERENCES "Employee"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment"
ADD CONSTRAINT "AssetAssignment_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;