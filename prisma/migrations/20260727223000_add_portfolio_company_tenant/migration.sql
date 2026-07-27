/* =========================================================
   PORTFOLIO COMPANY TENANT OWNERSHIP
   =========================================================
   - Preserve existing PortfolioCompany records
   - Assign existing records to the initial Ziya organization
   - Make PortfolioCompany organization-aware
   - Allow company codes to repeat across different organizations
========================================================= */


/* =========================================================
   1. ADD ORGANIZATION ID AS NULLABLE
========================================================= */

ALTER TABLE "PortfolioCompany"
ADD COLUMN "organizationId" TEXT;


/* =========================================================
   2. ASSIGN EXISTING PORTFOLIO COMPANIES TO ZIYA
========================================================= */

UPDATE "PortfolioCompany"
SET "organizationId" = 'org_ziya_initial'
WHERE "organizationId" IS NULL;


/* =========================================================
   3. MAKE ORGANIZATION OWNERSHIP REQUIRED
========================================================= */

ALTER TABLE "PortfolioCompany"
ALTER COLUMN "organizationId" SET NOT NULL;


/* =========================================================
   4. REMOVE OLD GLOBAL COMPANY CODE UNIQUENESS
========================================================= */

DROP INDEX IF EXISTS "PortfolioCompany_companyCode_key";


/* =========================================================
   5. CREATE TENANT INDEX
========================================================= */

CREATE INDEX "PortfolioCompany_organizationId_idx"
ON "PortfolioCompany"("organizationId");


/* =========================================================
   6. COMPANY CODE UNIQUE WITHIN EACH ORGANIZATION
========================================================= */

CREATE UNIQUE INDEX
"PortfolioCompany_organizationId_companyCode_key"
ON "PortfolioCompany"(
    "organizationId",
    "companyCode"
);


/* =========================================================
   7. ORGANIZATION FOREIGN KEY
========================================================= */

ALTER TABLE "PortfolioCompany"
ADD CONSTRAINT "PortfolioCompany_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;