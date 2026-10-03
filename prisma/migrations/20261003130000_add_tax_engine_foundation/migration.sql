-- AlterTable
ALTER TABLE "TaxFiling" ADD COLUMN     "taxPeriodId" TEXT,
ADD COLUMN     "taxReturnId" TEXT;

-- CreateTable
CREATE TABLE "TaxRegime" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'KE',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "description" TEXT,
    "registrationNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRegime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxRegimeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'OUTPUT',
    "treatment" TEXT NOT NULL DEFAULT 'STANDARD',
    "calculationMethod" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "defaultRate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "isInclusive" BOOLEAN NOT NULL DEFAULT false,
    "isRecoverable" BOOLEAN NOT NULL DEFAULT false,
    "recoverabilityRate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "isWithholding" BOOLEAN NOT NULL DEFAULT false,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "isZeroRated" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxCodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "roundingScale" INTEGER NOT NULL DEFAULT 2,
    "roundingMode" TEXT NOT NULL DEFAULT 'HALF_UP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxRegimeId" TEXT NOT NULL,
    "taxCodeId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "transactionType" TEXT,
    "customerType" TEXT,
    "vendorType" TEXT,
    "supplyType" TEXT,
    "jurisdiction" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "conditions" JSONB,
    "actions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxAccountMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxCodeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mappingType" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxCodeId" TEXT NOT NULL,
    "taxRateId" TEXT,
    "taxRuleId" TEXT,
    "taxPeriodId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLineId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "taxableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recoverableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "nonRecoverableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxBaseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "direction" TEXT NOT NULL DEFAULT 'OUTPUT',
    "calculationMethod" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "rateApplied" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "isInclusive" BOOLEAN NOT NULL DEFAULT false,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "idempotencyKey" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxTransactionLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxTransactionId" TEXT NOT NULL,
    "taxCodeId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "taxableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recoverableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "nonRecoverableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "rateApplied" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxTransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxRegimeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "filingDueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReturn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxRegimeId" TEXT NOT NULL,
    "taxPeriodId" TEXT NOT NULL,
    "taxObligationId" TEXT,
    "returnType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "taxableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outputTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inputTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalties" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netTaxPayable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "filingReference" TEXT,
    "filedAt" TIMESTAMP(3),
    "preparedBy" TEXT,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxRegime_organizationId_idx" ON "TaxRegime"("organizationId");

-- CreateIndex
CREATE INDEX "TaxRegime_organizationId_taxType_idx" ON "TaxRegime"("organizationId", "taxType");

-- CreateIndex
CREATE INDEX "TaxRegime_organizationId_isActive_idx" ON "TaxRegime"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRegime_organizationId_code_key" ON "TaxRegime"("organizationId", "code");

-- CreateIndex
CREATE INDEX "TaxCode_organizationId_idx" ON "TaxCode"("organizationId");

-- CreateIndex
CREATE INDEX "TaxCode_organizationId_taxRegimeId_idx" ON "TaxCode"("organizationId", "taxRegimeId");

-- CreateIndex
CREATE INDEX "TaxCode_organizationId_direction_idx" ON "TaxCode"("organizationId", "direction");

-- CreateIndex
CREATE INDEX "TaxCode_organizationId_isActive_idx" ON "TaxCode"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCode_organizationId_code_key" ON "TaxCode"("organizationId", "code");

-- CreateIndex
CREATE INDEX "TaxRate_organizationId_idx" ON "TaxRate"("organizationId");

-- CreateIndex
CREATE INDEX "TaxRate_organizationId_taxCodeId_idx" ON "TaxRate"("organizationId", "taxCodeId");

-- CreateIndex
CREATE INDEX "TaxRate_organizationId_effectiveFrom_effectiveTo_idx" ON "TaxRate"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "TaxRate_organizationId_isActive_idx" ON "TaxRate"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "TaxRule_organizationId_idx" ON "TaxRule"("organizationId");

-- CreateIndex
CREATE INDEX "TaxRule_organizationId_taxRegimeId_idx" ON "TaxRule"("organizationId", "taxRegimeId");

-- CreateIndex
CREATE INDEX "TaxRule_organizationId_taxCodeId_idx" ON "TaxRule"("organizationId", "taxCodeId");

-- CreateIndex
CREATE INDEX "TaxRule_organizationId_effectiveFrom_effectiveTo_idx" ON "TaxRule"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "TaxRule_organizationId_priority_idx" ON "TaxRule"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "TaxRule_organizationId_isActive_idx" ON "TaxRule"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_organizationId_code_key" ON "TaxRule"("organizationId", "code");

-- CreateIndex
CREATE INDEX "TaxAccountMapping_organizationId_idx" ON "TaxAccountMapping"("organizationId");

-- CreateIndex
CREATE INDEX "TaxAccountMapping_organizationId_taxCodeId_idx" ON "TaxAccountMapping"("organizationId", "taxCodeId");

-- CreateIndex
CREATE INDEX "TaxAccountMapping_organizationId_accountId_idx" ON "TaxAccountMapping"("organizationId", "accountId");

-- CreateIndex
CREATE INDEX "TaxAccountMapping_organizationId_mappingType_idx" ON "TaxAccountMapping"("organizationId", "mappingType");

-- CreateIndex
CREATE INDEX "TaxAccountMapping_organizationId_effectiveFrom_effectiveTo_idx" ON "TaxAccountMapping"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "TaxAccountMapping_organizationId_taxCodeId_mappingType_acco_key" ON "TaxAccountMapping"("organizationId", "taxCodeId", "mappingType", "accountId");

-- CreateIndex
CREATE INDEX "TaxTransaction_organizationId_idx" ON "TaxTransaction"("organizationId");

-- CreateIndex
CREATE INDEX "TaxTransaction_organizationId_taxCodeId_idx" ON "TaxTransaction"("organizationId", "taxCodeId");

-- CreateIndex
CREATE INDEX "TaxTransaction_organizationId_taxPeriodId_idx" ON "TaxTransaction"("organizationId", "taxPeriodId");

-- CreateIndex
CREATE INDEX "TaxTransaction_organizationId_transactionDate_idx" ON "TaxTransaction"("organizationId", "transactionDate");

-- CreateIndex
CREATE INDEX "TaxTransaction_organizationId_sourceType_sourceId_idx" ON "TaxTransaction"("organizationId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "TaxTransaction_organizationId_status_idx" ON "TaxTransaction"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TaxTransaction_organizationId_direction_idx" ON "TaxTransaction"("organizationId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "TaxTransaction_organizationId_idempotencyKey_key" ON "TaxTransaction"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TaxTransactionLine_organizationId_idx" ON "TaxTransactionLine"("organizationId");

-- CreateIndex
CREATE INDEX "TaxTransactionLine_organizationId_taxTransactionId_idx" ON "TaxTransactionLine"("organizationId", "taxTransactionId");

-- CreateIndex
CREATE INDEX "TaxTransactionLine_organizationId_taxCodeId_idx" ON "TaxTransactionLine"("organizationId", "taxCodeId");

-- CreateIndex
CREATE INDEX "TaxTransactionLine_organizationId_accountId_idx" ON "TaxTransactionLine"("organizationId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxTransactionLine_taxTransactionId_lineNumber_key" ON "TaxTransactionLine"("taxTransactionId", "lineNumber");

-- CreateIndex
CREATE INDEX "TaxPeriod_organizationId_idx" ON "TaxPeriod"("organizationId");

-- CreateIndex
CREATE INDEX "TaxPeriod_organizationId_taxRegimeId_idx" ON "TaxPeriod"("organizationId", "taxRegimeId");

-- CreateIndex
CREATE INDEX "TaxPeriod_organizationId_periodStart_periodEnd_idx" ON "TaxPeriod"("organizationId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "TaxPeriod_organizationId_status_idx" ON "TaxPeriod"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TaxPeriod_organizationId_filingDueDate_idx" ON "TaxPeriod"("organizationId", "filingDueDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPeriod_organizationId_taxRegimeId_code_key" ON "TaxPeriod"("organizationId", "taxRegimeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPeriod_organizationId_taxRegimeId_periodStart_periodEnd_key" ON "TaxPeriod"("organizationId", "taxRegimeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "TaxReturn_organizationId_idx" ON "TaxReturn"("organizationId");

-- CreateIndex
CREATE INDEX "TaxReturn_organizationId_taxRegimeId_idx" ON "TaxReturn"("organizationId", "taxRegimeId");

-- CreateIndex
CREATE INDEX "TaxReturn_organizationId_taxPeriodId_idx" ON "TaxReturn"("organizationId", "taxPeriodId");

-- CreateIndex
CREATE INDEX "TaxReturn_organizationId_status_idx" ON "TaxReturn"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TaxReturn_organizationId_filingReference_idx" ON "TaxReturn"("organizationId", "filingReference");

-- CreateIndex
CREATE UNIQUE INDEX "TaxReturn_organizationId_taxPeriodId_returnType_key" ON "TaxReturn"("organizationId", "taxPeriodId", "returnType");

-- CreateIndex
CREATE INDEX "TaxFiling_organizationId_taxPeriodId_idx" ON "TaxFiling"("organizationId", "taxPeriodId");

-- CreateIndex
CREATE INDEX "TaxFiling_organizationId_taxReturnId_idx" ON "TaxFiling"("organizationId", "taxReturnId");

-- AddForeignKey
ALTER TABLE "TaxFiling" ADD CONSTRAINT "TaxFiling_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "TaxPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFiling" ADD CONSTRAINT "TaxFiling_taxReturnId_fkey" FOREIGN KEY ("taxReturnId") REFERENCES "TaxReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRegime" ADD CONSTRAINT "TaxRegime_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_taxRegimeId_fkey" FOREIGN KEY ("taxRegimeId") REFERENCES "TaxRegime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_taxRegimeId_fkey" FOREIGN KEY ("taxRegimeId") REFERENCES "TaxRegime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxAccountMapping" ADD CONSTRAINT "TaxAccountMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxAccountMapping" ADD CONSTRAINT "TaxAccountMapping_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxAccountMapping" ADD CONSTRAINT "TaxAccountMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_taxRuleId_fkey" FOREIGN KEY ("taxRuleId") REFERENCES "TaxRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "TaxPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransactionLine" ADD CONSTRAINT "TaxTransactionLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransactionLine" ADD CONSTRAINT "TaxTransactionLine_taxTransactionId_fkey" FOREIGN KEY ("taxTransactionId") REFERENCES "TaxTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransactionLine" ADD CONSTRAINT "TaxTransactionLine_taxCodeId_fkey" FOREIGN KEY ("taxCodeId") REFERENCES "TaxCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxTransactionLine" ADD CONSTRAINT "TaxTransactionLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPeriod" ADD CONSTRAINT "TaxPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPeriod" ADD CONSTRAINT "TaxPeriod_taxRegimeId_fkey" FOREIGN KEY ("taxRegimeId") REFERENCES "TaxRegime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_taxRegimeId_fkey" FOREIGN KEY ("taxRegimeId") REFERENCES "TaxRegime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "TaxPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_taxObligationId_fkey" FOREIGN KEY ("taxObligationId") REFERENCES "TaxObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
