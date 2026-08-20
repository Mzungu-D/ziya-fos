CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "documentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_organizationId_documentCode_key"
ON "Document"("organizationId", "documentCode");

CREATE INDEX "Document_organizationId_idx"
ON "Document"("organizationId");

CREATE INDEX "Document_organizationId_category_idx"
ON "Document"("organizationId", "category");

CREATE INDEX "Document_organizationId_createdAt_idx"
ON "Document"("organizationId", "createdAt");

ALTER TABLE "Document"
ADD CONSTRAINT "Document_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
