import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const raw = process.env.MPESA_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error(
      "MPESA_ENCRYPTION_KEY is required."
    );
  }

  let key: Buffer;

  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error(
      "MPESA_ENCRYPTION_KEY must be base64 encoded."
    );
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      "MPESA_ENCRYPTION_KEY must decode to exactly 32 bytes."
    );
  }

  return key;
}

export function encryptSecret(value: string): string {
  if (!value?.trim()) {
    throw new Error("Cannot encrypt an empty secret.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  if (!payload?.trim()) {
    throw new Error("Encrypted secret is empty.");
  }

  const key = getEncryptionKey();

  const parts = payload.split(".");

  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted secret format."
    );
  }

  const [ivBase64, tagBase64, encryptedBase64] =
    parts;

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(tagBase64, "base64");
  const encrypted = Buffer.from(
    encryptedBase64,
    "base64"
  );

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid encryption IV.");
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encryption auth tag.");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}