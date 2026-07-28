CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvitation_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key"
ON "OrganizationInvitation"("tokenHash");

CREATE UNIQUE INDEX "OrganizationInvitation_organizationId_email_key"
ON "OrganizationInvitation"("organizationId", "email");

CREATE INDEX "OrganizationInvitation_organizationId_idx"
ON "OrganizationInvitation"("organizationId");

CREATE INDEX "OrganizationInvitation_email_idx"
ON "OrganizationInvitation"("email");

CREATE INDEX "OrganizationInvitation_status_idx"
ON "OrganizationInvitation"("status");

CREATE INDEX "OrganizationInvitation_expiresAt_idx"
ON "OrganizationInvitation"("expiresAt");

CREATE INDEX "OrganizationInvitation_invitedByUserId_idx"
ON "OrganizationInvitation"("invitedByUserId");

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
