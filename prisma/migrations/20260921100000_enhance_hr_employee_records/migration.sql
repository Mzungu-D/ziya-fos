-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "address" TEXT,
ADD COLUMN     "alternativePhone" TEXT,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "county" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyContactEmail" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT,
ADD COLUMN     "employmentNotes" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "mobileMoneyNumber" TEXT,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "probationEndDate" TIMESTAMP(3),
ADD COLUMN     "terminationDate" TIMESTAMP(3),
ADD COLUMN     "workLocation" TEXT;

-- CreateIndex
CREATE INDEX "Employee_organizationId_employeeNumber_idx" ON "Employee"("organizationId", "employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_organizationId_hireDate_idx" ON "Employee"("organizationId", "hireDate");

-- CreateIndex
CREATE INDEX "Employee_organizationId_jobTitle_idx" ON "Employee"("organizationId", "jobTitle");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
