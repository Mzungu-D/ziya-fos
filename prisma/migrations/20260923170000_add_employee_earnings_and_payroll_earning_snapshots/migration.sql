-- DropIndex
DROP INDEX "Employee_organizationId_kraPin_idx";

-- DropIndex
DROP INDEX "Employee_organizationId_nssfNumber_idx";

-- DropIndex
DROP INDEX "Employee_organizationId_shaNumber_idx";

-- CreateTable
CREATE TABLE "EmployeeEarning" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEarning" (
    "id" TEXT NOT NULL,
    "payrollRecordId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceEarningId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeEarning_organizationId_idx"
ON "EmployeeEarning"("organizationId");

-- CreateIndex
CREATE INDEX "EmployeeEarning_organizationId_employeeId_idx"
ON "EmployeeEarning"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeEarning_organizationId_employeeId_status_idx"
ON "EmployeeEarning"("organizationId", "employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeEarning_organizationId_type_idx"
ON "EmployeeEarning"("organizationId", "type");

-- CreateIndex
CREATE INDEX "EmployeeEarning_employeeId_effectiveFrom_idx"
ON "EmployeeEarning"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PayrollEarning_organizationId_idx"
ON "PayrollEarning"("organizationId");

-- CreateIndex
CREATE INDEX "PayrollEarning_organizationId_payrollRecordId_idx"
ON "PayrollEarning"("organizationId", "payrollRecordId");

-- CreateIndex
CREATE INDEX "PayrollEarning_organizationId_sourceEarningId_idx"
ON "PayrollEarning"("organizationId", "sourceEarningId");

-- CreateIndex
CREATE INDEX "PayrollEarning_payrollRecordId_idx"
ON "PayrollEarning"("payrollRecordId");

-- AddForeignKey
ALTER TABLE "EmployeeEarning"
ADD CONSTRAINT "EmployeeEarning_employeeId_fkey"
FOREIGN KEY ("employeeId")
REFERENCES "Employee"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEarning"
ADD CONSTRAINT "EmployeeEarning_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEarning"
ADD CONSTRAINT "PayrollEarning_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEarning"
ADD CONSTRAINT "PayrollEarning_payrollRecordId_fkey"
FOREIGN KEY ("payrollRecordId")
REFERENCES "PayrollRecord"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEarning"
ADD CONSTRAINT "PayrollEarning_sourceEarningId_fkey"
FOREIGN KEY ("sourceEarningId")
REFERENCES "EmployeeEarning"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;