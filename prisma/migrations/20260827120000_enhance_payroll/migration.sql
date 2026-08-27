-- CreateTable
CREATE TABLE "EmployeePayrollProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kraPin" TEXT,
    "nssfNumber" TEXT,
    "shaNumber" TEXT,
    "helbNumber" TEXT,
    "payeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nssfEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "housingLevyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pensionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pensionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pensionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "helbEnabled" BOOLEAN NOT NULL DEFAULT false,
    "helbAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherDeductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherDeductionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayrollProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLoan" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "principalAmount" DECIMAL(14,2) NOT NULL,
    "outstandingBalance" DECIMAL(14,2) NOT NULL,
    "monthlyRepayment" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "outstandingBalance" DECIMAL(14,2) NOT NULL,
    "monthlyRepayment" DECIMAL(14,2) NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDeduction" (
    "id" TEXT NOT NULL,
    "payrollRecordId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEmployerContribution" (
    "id" TEXT NOT NULL,
    "payrollRecordId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEmployerContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayrollProfile_employeeId_key"
ON "EmployeePayrollProfile"("employeeId");

CREATE INDEX "EmployeePayrollProfile_organizationId_idx"
ON "EmployeePayrollProfile"("organizationId");

CREATE UNIQUE INDEX "EmployeeLoan_organizationId_reference_key"
ON "EmployeeLoan"("organizationId", "reference");

CREATE INDEX "EmployeeLoan_organizationId_idx"
ON "EmployeeLoan"("organizationId");

CREATE INDEX "EmployeeLoan_organizationId_employeeId_idx"
ON "EmployeeLoan"("organizationId", "employeeId");

CREATE INDEX "EmployeeLoan_organizationId_status_idx"
ON "EmployeeLoan"("organizationId", "status");

CREATE UNIQUE INDEX "SalaryAdvance_organizationId_reference_key"
ON "SalaryAdvance"("organizationId", "reference");

CREATE INDEX "SalaryAdvance_organizationId_idx"
ON "SalaryAdvance"("organizationId");

CREATE INDEX "SalaryAdvance_organizationId_employeeId_idx"
ON "SalaryAdvance"("organizationId", "employeeId");

CREATE INDEX "SalaryAdvance_organizationId_status_idx"
ON "SalaryAdvance"("organizationId", "status");

CREATE INDEX "PayrollDeduction_organizationId_idx"
ON "PayrollDeduction"("organizationId");

CREATE INDEX "PayrollDeduction_organizationId_payrollRecordId_idx"
ON "PayrollDeduction"("organizationId", "payrollRecordId");

CREATE INDEX "PayrollDeduction_organizationId_type_idx"
ON "PayrollDeduction"("organizationId", "type");

CREATE INDEX "PayrollEmployerContribution_organizationId_idx"
ON "PayrollEmployerContribution"("organizationId");

CREATE INDEX "PayrollEmployerContribution_organizationId_payrollRecordId_idx"
ON "PayrollEmployerContribution"("organizationId", "payrollRecordId");

CREATE INDEX "PayrollEmployerContribution_organizationId_type_idx"
ON "PayrollEmployerContribution"("organizationId", "type");

-- AddForeignKey
ALTER TABLE "EmployeePayrollProfile"
ADD CONSTRAINT "EmployeePayrollProfile_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeePayrollProfile"
ADD CONSTRAINT "EmployeePayrollProfile_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeLoan"
ADD CONSTRAINT "EmployeeLoan_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeLoan"
ADD CONSTRAINT "EmployeeLoan_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalaryAdvance"
ADD CONSTRAINT "SalaryAdvance_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalaryAdvance"
ADD CONSTRAINT "SalaryAdvance_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollDeduction"
ADD CONSTRAINT "PayrollDeduction_payrollRecordId_fkey"
FOREIGN KEY ("payrollRecordId") REFERENCES "PayrollRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollDeduction"
ADD CONSTRAINT "PayrollDeduction_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollEmployerContribution"
ADD CONSTRAINT "PayrollEmployerContribution_payrollRecordId_fkey"
FOREIGN KEY ("payrollRecordId") REFERENCES "PayrollRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollEmployerContribution"
ADD CONSTRAINT "PayrollEmployerContribution_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
