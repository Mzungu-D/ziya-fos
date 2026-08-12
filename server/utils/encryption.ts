import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.MPESA_CREDENTIAL_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error(
      "MPESA_CREDENTIAL_ENCRYPTION_KEY is not configured"
    );
  }

  const key = Buffer.from(secret, "hex");

  if (key.length !== 32) {
    throw new Error(
      "MPESA_CREDENTIAL_ENCRYPTION_KEY must be a 32-byte hex key"
    );
  }

  return key;
}

export function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    getKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, encryptedHex] =
    payload.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted credential");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}