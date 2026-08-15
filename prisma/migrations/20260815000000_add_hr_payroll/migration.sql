-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "department" TEXT,
    "jobTitle" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "basicSalary" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "basicSalary" DECIMAL(14,2) NOT NULL,
    "allowances" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_employeeNumber_key"
ON "Employee"("organizationId", "employeeNumber");

CREATE INDEX "Employee_organizationId_idx"
ON "Employee"("organizationId");

CREATE INDEX "Employee_organizationId_status_idx"
ON "Employee"("organizationId", "status");

CREATE INDEX "Employee_organizationId_department_idx"
ON "Employee"("organizationId", "department");

CREATE INDEX "Employee_organizationId_email_idx"
ON "Employee"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_organizationId_periodStart_periodEnd_key"
ON "PayrollPeriod"("organizationId", "periodStart", "periodEnd");

CREATE INDEX "PayrollPeriod_organizationId_idx"
ON "PayrollPeriod"("organizationId");

CREATE INDEX "PayrollPeriod_organizationId_status_idx"
ON "PayrollPeriod"("organizationId", "status");

CREATE INDEX "PayrollPeriod_periodStart_periodEnd_idx"
ON "PayrollPeriod"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_payrollPeriodId_employeeId_key"
ON "PayrollRecord"("payrollPeriodId", "employeeId");

CREATE INDEX "PayrollRecord_organizationId_idx"
ON "PayrollRecord"("organizationId");

CREATE INDEX "PayrollRecord_organizationId_payrollPeriodId_idx"
ON "PayrollRecord"("organizationId", "payrollPeriodId");

CREATE INDEX "PayrollRecord_organizationId_employeeId_idx"
ON "PayrollRecord"("organizationId", "employeeId");

CREATE INDEX "PayrollRecord_status_idx"
ON "PayrollRecord"("status");

-- AddForeignKey
ALTER TABLE "Employee"
ADD CONSTRAINT "Employee_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "PayrollPeriod"
ADD CONSTRAINT "PayrollPeriod_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "PayrollRecord"
ADD CONSTRAINT "PayrollRecord_payrollPeriodId_fkey"
FOREIGN KEY ("payrollPeriodId")
REFERENCES "PayrollPeriod"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "PayrollRecord"
ADD CONSTRAINT "PayrollRecord_employeeId_fkey"
FOREIGN KEY ("employeeId")
REFERENCES "Employee"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "PayrollRecord"
ADD CONSTRAINT "PayrollRecord_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;