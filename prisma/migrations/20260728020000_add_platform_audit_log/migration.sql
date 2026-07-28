CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAuditLog_actorUserId_idx"
ON "PlatformAuditLog"("actorUserId");

CREATE INDEX "PlatformAuditLog_action_idx"
ON "PlatformAuditLog"("action");

CREATE INDEX "PlatformAuditLog_resource_idx"
ON "PlatformAuditLog"("resource");

CREATE INDEX "PlatformAuditLog_resourceId_idx"
ON "PlatformAuditLog"("resourceId");

CREATE INDEX "PlatformAuditLog_createdAt_idx"
ON "PlatformAuditLog"("createdAt");
