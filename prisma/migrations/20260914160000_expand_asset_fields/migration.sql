ALTER TABLE "Asset"
  ADD COLUMN "manufacturer" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "serialNumber" TEXT,
  ADD COLUMN "serviceTag" TEXT,
  ADD COLUMN "purchaseDate" TIMESTAMP(3),
  ADD COLUMN "purchaseCost" DOUBLE PRECISION,
  ADD COLUMN "currentBookValue" DOUBLE PRECISION,
  ADD COLUMN "condition" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "vendor" TEXT,
  ADD COLUMN "warrantyStart" TIMESTAMP(3),
  ADD COLUMN "warrantyEnd" TIMESTAMP(3),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "processor" TEXT,
  ADD COLUMN "ram" TEXT,
  ADD COLUMN "storage" TEXT,
  ADD COLUMN "storageType" TEXT,
  ADD COLUMN "operatingSystem" TEXT,
  ADD COLUMN "osVersion" TEXT,
  ADD COLUMN "macAddress" TEXT,
  ADD COLUMN "hostname" TEXT,
  ADD COLUMN "imei" TEXT,
  ADD COLUMN "imei2" TEXT,
  ADD COLUMN "phoneNumber" TEXT,
  ADD COLUMN "simIccid" TEXT,
  ADD COLUMN "carrier" TEXT,
  ADD COLUMN "storageCapacity" TEXT,
  ADD COLUMN "color" TEXT,
  ADD COLUMN "enrollmentStatus" TEXT,
  ADD COLUMN "mdmDeviceId" TEXT,
  ADD COLUMN "registrationNumber" TEXT,
  ADD COLUMN "vin" TEXT,
  ADD COLUMN "chassisNumber" TEXT,
  ADD COLUMN "engineNumber" TEXT,
  ADD COLUMN "year" INTEGER,
  ADD COLUMN "vehicleType" TEXT,
  ADD COLUMN "bodyType" TEXT,
  ADD COLUMN "fuelType" TEXT,
  ADD COLUMN "fuelCapacity" DOUBLE PRECISION,
  ADD COLUMN "transmission" TEXT,
  ADD COLUMN "odometer" DOUBLE PRECISION,
  ADD COLUMN "engineHours" DOUBLE PRECISION,
  ADD COLUMN "insurancePolicyNumber" TEXT,
  ADD COLUMN "insuranceExpiry" TIMESTAMP(3),
  ADD COLUMN "registrationExpiry" TIMESTAMP(3),
  ADD COLUMN "inspectionExpiry" TIMESTAMP(3),
  ADD COLUMN "lastServiceDate" TIMESTAMP(3),
  ADD COLUMN "nextServiceDate" TIMESTAMP(3),
  ADD COLUMN "maintenanceNotes" TEXT;

CREATE INDEX "Asset_organizationId_category_idx"
  ON "Asset"("organizationId", "category");

CREATE INDEX "Asset_organizationId_status_idx"
  ON "Asset"("organizationId", "status");

CREATE INDEX "Asset_organizationId_serialNumber_idx"
  ON "Asset"("organizationId", "serialNumber");

CREATE INDEX "Asset_organizationId_registrationNumber_idx"
  ON "Asset"("organizationId", "registrationNumber");
