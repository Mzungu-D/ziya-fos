-- Preserve any existing OTP value before removing legacy fields.
UPDATE "OtpVerification"
SET "code" = "otp"
WHERE "code" IS NULL;

-- Preserve verification state where possible.
UPDATE "OtpVerification"
SET "verifiedAt" = CURRENT_TIMESTAMP
WHERE "verified" = TRUE
  AND "verifiedAt" IS NULL;

-- Old OTP records without a usable code are no longer valid.
DELETE FROM "OtpVerification"
WHERE "code" IS NULL;

-- New authentication schema requires code.
ALTER TABLE "OtpVerification"
ALTER COLUMN "code" SET NOT NULL;

-- Remove legacy OTP implementation.
ALTER TABLE "OtpVerification"
DROP COLUMN IF EXISTS "otp";

ALTER TABLE "OtpVerification"
DROP COLUMN IF EXISTS "verified";

ALTER TABLE "OtpVerification"
DROP COLUMN IF EXISTS "channel";
