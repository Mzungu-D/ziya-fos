ALTER TABLE "OtpVerification"
ADD COLUMN IF NOT EXISTS "code" TEXT;

ALTER TABLE "OtpVerification"
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

ALTER TABLE "OtpVerification"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "OtpVerification"
ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE "OtpVerification"
ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;

ALTER TABLE "OtpVerification"
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

ALTER TABLE "OtpVerification"
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "OtpVerification_userId_idx"
ON "OtpVerification"("userId");

CREATE INDEX IF NOT EXISTS "OtpVerification_email_idx"
ON "OtpVerification"("email");

CREATE INDEX IF NOT EXISTS "OtpVerification_phoneNumber_idx"
ON "OtpVerification"("phoneNumber");

CREATE INDEX IF NOT EXISTS "OtpVerification_expiresAt_idx"
ON "OtpVerification"("expiresAt");
