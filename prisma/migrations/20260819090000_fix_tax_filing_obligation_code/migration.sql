-- Fix TaxFiling to use the tax obligation catalogue code
-- instead of the old TaxObligation foreign-key relationship.

ALTER TABLE "TaxFiling"
DROP CONSTRAINT IF EXISTS "TaxFiling_taxObligationId_fkey";

DROP INDEX IF EXISTS "TaxFiling_organizationId_taxObligationId_idx";

ALTER TABLE "TaxFiling"
RENAME COLUMN "taxObligationId" TO "taxObligationCode";

CREATE INDEX "TaxFiling_organizationId_taxObligationCode_idx"
ON "TaxFiling"("organizationId", "taxObligationCode");