ALTER TABLE "Employee"
  ADD COLUMN "kraPin" TEXT,
  ADD COLUMN "nssfNumber" TEXT,
  ADD COLUMN "shaNumber" TEXT,
  ADD COLUMN "payeApplicable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "housingLevyApplicable" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Employee_organizationId_kraPin_idx"
  ON "Employee"("organizationId", "kraPin");

CREATE INDEX "Employee_organizationId_nssfNumber_idx"
  ON "Employee"("organizationId", "nssfNumber");

CREATE INDEX "Employee_organizationId_shaNumber_idx"
  ON "Employee"("organizationId", "shaNumber");
