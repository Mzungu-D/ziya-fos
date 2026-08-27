-- Add dedicated encrypted STK Push passkey.
ALTER TABLE "MpesaAccount"
ADD COLUMN "stkPasskeyEncrypted" TEXT;