-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "positionId" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");

-- CreateIndex
CREATE INDEX "Department_organizationId_status_idx" ON "Department"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Position_organizationId_idx" ON "Position"("organizationId");

-- CreateIndex
CREATE INDEX "Position_organizationId_status_idx" ON "Position"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Position_organizationId_departmentId_idx" ON "Position"("organizationId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_organizationId_title_key" ON "Position"("organizationId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Position_organizationId_code_key" ON "Position"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Employee_organizationId_departmentId_idx" ON "Employee"("organizationId", "departmentId");

-- CreateIndex
CREATE INDEX "Employee_organizationId_positionId_idx" ON "Employee"("organizationId", "positionId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
