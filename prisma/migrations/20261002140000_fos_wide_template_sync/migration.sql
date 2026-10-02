ALTER TABLE "Organization"
  ADD COLUMN "templateKey" TEXT,
  ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Organization_templateKey_key"
  ON "Organization"("templateKey");

CREATE TABLE "TenantTemplate" (
  "id" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "sourceOrganizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "publishedByUserId" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantTemplate_sourceOrganizationId_version_key"
  ON "TenantTemplate"("sourceOrganizationId", "version");
CREATE INDEX "TenantTemplate_sourceOrganizationId_idx"
  ON "TenantTemplate"("sourceOrganizationId");
CREATE INDEX "TenantTemplate_templateKey_idx"
  ON "TenantTemplate"("templateKey");
CREATE INDEX "TenantTemplate_templateKey_version_idx"
  ON "TenantTemplate"("templateKey", "version");
CREATE INDEX "TenantTemplate_publishedAt_idx"
  ON "TenantTemplate"("publishedAt");

ALTER TABLE "TenantTemplate"
  ADD CONSTRAINT "TenantTemplate_sourceOrganizationId_fkey"
  FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TenantTemplateApplication" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantTemplateApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantTemplateApplication_organizationId_key"
  ON "TenantTemplateApplication"("organizationId");
CREATE INDEX "TenantTemplateApplication_templateVersion_idx"
  ON "TenantTemplateApplication"("templateVersion");
CREATE INDEX "TenantTemplateApplication_appliedAt_idx"
  ON "TenantTemplateApplication"("appliedAt");

ALTER TABLE "TenantTemplateApplication"
  ADD CONSTRAINT "TenantTemplateApplication_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
