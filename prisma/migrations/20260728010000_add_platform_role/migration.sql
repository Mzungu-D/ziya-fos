ALTER TABLE "User"
ADD COLUMN "platformRole" TEXT;

CREATE INDEX "User_platformRole_idx"
ON "User"("platformRole");
