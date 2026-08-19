CREATE TABLE "FraudAlert" (
    "id" TEXT NOT NULL,
    "alertCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "riskScore" DOUBLE PRECISION NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "amount" DOUBLE PRECISION,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FraudAlert_organizationId_alertCode_key"
ON "FraudAlert"("organizationId", "alertCode");

CREATE INDEX "FraudAlert_organizationId_idx"
ON "FraudAlert"("organizationId");

CREATE INDEX "FraudAlert_organizationId_status_idx"
ON "FraudAlert"("organizationId", "status");

CREATE INDEX "FraudAlert_organizationId_severity_idx"
ON "FraudAlert"("organizationId", "severity");

CREATE INDEX "FraudAlert_organizationId_detectedAt_idx"
ON "FraudAlert"("organizationId", "detectedAt");

CREATE INDEX "FraudAlert_organizationId_sourceType_idx"
ON "FraudAlert"("organizationId", "sourceType");

CREATE INDEX "FraudAlert_organizationId_sourceId_idx"
ON "FraudAlert"("organizationId", "sourceId");

ALTER TABLE "FraudAlert"
ADD CONSTRAINT "FraudAlert_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
