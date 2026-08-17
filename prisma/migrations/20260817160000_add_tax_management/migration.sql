-- CreateTable
CREATE TABLE "TaxObligation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "filingFrequency" TEXT NOT NULL,
    "dueRule" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFiling" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxObligationId" TEXT NOT NULL,
    "payrollPeriodId" TEXT,
    "taxPeriodStart" TIMESTAMP(3) NOT NULL,
    "taxPeriodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustments" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "penalties" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPayable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "filingReference" TEXT,
    "filingDate" TIMESTAMP(3),
    "filingStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "preparedBy" TEXT,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxFilingId" TEXT NOT NULL,
    "paymentReference" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxObligation_organizationId_idx" ON "TaxObligation"("organizationId");

-- CreateIndex
CREATE INDEX "TaxObligation_organizationId_isActive_idx" ON "TaxObligation"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxObligation_organizationId_taxType_key" ON "TaxObligation"("organizationId", "taxType");

-- CreateIndex
CREATE INDEX "TaxFiling_organizationId_idx" ON "TaxFiling"("organizationId");

-- CreateIndex
CREATE INDEX "TaxFiling_organizationId_taxObligationId_idx" ON "TaxFiling"("organizationId", "taxObligationId");

-- CreateIndex
CREATE INDEX "TaxFiling_organizationId_dueDate_idx" ON "TaxFiling"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "TaxFiling_organizationId_filingStatus_idx" ON "TaxFiling"("organizationId", "filingStatus");

-- CreateIndex
CREATE INDEX "TaxFiling_organizationId_paymentStatus_idx" ON "TaxFiling"("organizationId", "paymentStatus");

-- CreateIndex
CREATE INDEX "TaxFiling_payrollPeriodId_idx" ON "TaxFiling"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "TaxPayment_organizationId_idx" ON "TaxPayment"("organizationId");

-- CreateIndex
CREATE INDEX "TaxPayment_organizationId_taxFilingId_idx" ON "TaxPayment"("organizationId", "taxFilingId");

-- CreateIndex
CREATE INDEX "TaxPayment_paymentDate_idx" ON "TaxPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "TaxPayment_status_idx" ON "TaxPayment"("status");

-- AddForeignKey
ALTER TABLE "TaxObligation" ADD CONSTRAINT "TaxObligation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFiling" ADD CONSTRAINT "TaxFiling_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFiling" ADD CONSTRAINT "TaxFiling_taxObligationId_fkey" FOREIGN KEY ("taxObligationId") REFERENCES "TaxObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFiling" ADD CONSTRAINT "TaxFiling_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPayment" ADD CONSTRAINT "TaxPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPayment" ADD CONSTRAINT "TaxPayment_taxFilingId_fkey" FOREIGN KEY ("taxFilingId") REFERENCES "TaxFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
