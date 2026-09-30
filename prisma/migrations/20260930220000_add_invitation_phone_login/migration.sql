ALTER TABLE "OrganizationInvitation"
ADD COLUMN "phoneNumber" TEXT;

CREATE UNIQUE INDEX "OrganizationInvitation_organizationId_phoneNumber_key"
ON "OrganizationInvitation"("organizationId", "phoneNumber");

CREATE INDEX "OrganizationInvitation_phoneNumber_idx"
ON "OrganizationInvitation"("phoneNumber");
