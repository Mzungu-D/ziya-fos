ALTER TABLE "Investment"
ADD COLUMN "organizationId" TEXT;

UPDATE "Investment" AS investment
SET "organizationId" = company."organizationId"
FROM "PortfolioCompany" AS company
WHERE investment."portfolioCompanyId" = company."id"
AND investment."organizationId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Investment"
    WHERE "organizationId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Investment records exist without organization ownership';
  END IF;
END $$;

ALTER TABLE "Investment"
ALTER COLUMN "organizationId" SET NOT NULL;

DROP INDEX IF EXISTS "Investment_investmentCode_key";

CREATE INDEX "Investment_organizationId_idx"
ON "Investment"("organizationId");

CREATE UNIQUE INDEX
"Investment_organizationId_investmentCode_key"
ON "Investment"("organizationId", "investmentCode");

ALTER TABLE "Investment"
ADD CONSTRAINT "Investment_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;