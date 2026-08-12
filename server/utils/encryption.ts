// server/utils/encryption.ts

import crypto from "crypto";

/*
|--------------------------------------------------------------------------
| M-PESA / APPLICATION SECRET ENCRYPTION
|--------------------------------------------------------------------------
|
| AES-256-GCM
|
| New encrypted values use:
|
|   base64(iv).base64(authTag).base64(ciphertext)
|
| The decrypt function also supports the legacy format:
|
|   hex(iv):hex(authTag):hex(ciphertext)
|
| This allows existing encrypted tenant credentials to continue
| working during deployment/migration.
|
|--------------------------------------------------------------------------
*/

const ALGORITHM =
  "aes-256-gcm";

const KEY_LENGTH =
  32;

const IV_LENGTH =
  12;

const AUTH_TAG_LENGTH =
  16;

/*
|--------------------------------------------------------------------------
| Encryption key
|--------------------------------------------------------------------------
|
| Preferred:
|
|   MPESA_ENCRYPTION_KEY
|
| Supported formats:
|
| 1. 64 hexadecimal characters = 32 bytes
| 2. Base64 encoding of exactly 32 bytes
|
| The same key MUST remain unchanged after credentials have been
| encrypted. Changing it makes previously encrypted credentials
| impossible to decrypt.
|
|--------------------------------------------------------------------------
*/

function getEncryptionKey(): Buffer {
  const raw =
    process.env.MPESA_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error(
      "MPESA_ENCRYPTION_KEY is required.",
    );
  }

  /*
   * First support the existing Ziya format:
   *
   * 64 hexadecimal characters.
   */
  if (
    /^[a-fA-F0-9]{64}$/.test(
      raw,
    )
  ) {
    const key =
      Buffer.from(
        raw,
        "hex",
      );

    if (
      key.length !==
      KEY_LENGTH
    ) {
      throw new Error(
        "MPESA_ENCRYPTION_KEY must decode to exactly 32 bytes.",
      );
    }

    return key;
  }

  /*
   * Also support base64 encoded 32-byte keys.
   */
  try {
    const key =
      Buffer.from(
        raw,
        "base64",
      );

    /*
     * Buffer.from(..., "base64") is permissive, so make sure
     * the supplied value actually represents a valid base64
     * string rather than accepting arbitrary text.
     */
    const normalized =
      raw.replace(
        /\s+/g,
        "",
      );

    const canonical =
      key
        .toString("base64")
        .replace(
          /=+$/,
          "",
        );

    const supplied =
      normalized
        .replace(
          /=+$/,
          "",
        );

    if (
      canonical !==
      supplied
    ) {
      throw new Error(
        "Invalid base64 key.",
      );
    }

    if (
      key.length !==
      KEY_LENGTH
    ) {
      throw new Error(
        "MPESA_ENCRYPTION_KEY must decode to exactly 32 bytes.",
      );
    }

    return key;
  } catch {
    throw new Error(
      "MPESA_ENCRYPTION_KEY must be either 64 hexadecimal characters or base64 encoded 32 bytes.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Validation helpers
|--------------------------------------------------------------------------
*/

function assertSecret(
  value: string,
): string {
  if (
    typeof value !==
      "string" ||
    value.length ===
      0
  ) {
    throw new Error(
      "Cannot encrypt an empty secret.",
    );
  }

  return value;
}

function decodeBase64(
  value: string,
): Buffer {
  if (
    !value ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(
      value,
    )
  ) {
    throw new Error(
      "Invalid base64 encrypted value.",
    );
  }

  return Buffer.from(
    value,
    "base64",
  );
}

function decodeHex(
  value: string,
): Buffer {
  if (
    !value ||
    !/^[a-fA-F0-9]+$/.test(
      value,
    ) ||
    value.length % 2 !==
      0
  ) {
    throw new Error(
      "Invalid hexadecimal encrypted value.",
    );
  }

  return Buffer.from(
    value,
    "hex",
  );
}

/*
|--------------------------------------------------------------------------
| Encrypt
|--------------------------------------------------------------------------
|
| Canonical production format:
|
| base64(iv).base64(authTag).base64(ciphertext)
|
|--------------------------------------------------------------------------
*/

export function encryptSecret(
  value: string,
): string {
  const secret =
    assertSecret(value);

  const key =
    getEncryptionKey();

  const iv =
    crypto.randomBytes(
      IV_LENGTH,
    );

  const cipher =
    crypto.createCipheriv(
      ALGORITHM,
      key,
      iv,
      {
        authTagLength:
          AUTH_TAG_LENGTH,
      },
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        secret,
        "utf8",
      ),
      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return [
    iv.toString(
      "base64",
    ),
    authTag.toString(
      "base64",
    ),
    encrypted.toString(
      "base64",
    ),
  ].join(".");
}

/*
|--------------------------------------------------------------------------
| Decrypt canonical format
|--------------------------------------------------------------------------
*/

function decryptModern(
  payload: string,
): string {
  const parts =
    payload.split(".");

  if (
    parts.length !==
    3
  ) {
    throw new Error(
      "Invalid modern encrypted secret format.",
    );
  }

  const [
    ivBase64,
    authTagBase64,
    encryptedBase64,
  ] = parts;

  const iv =
    decodeBase64(
      ivBase64,
    );

  const authTag =
    decodeBase64(
      authTagBase64,
    );

  const encrypted =
    decodeBase64(
      encryptedBase64,
    );

  if (
    iv.length !==
    IV_LENGTH
  ) {
    throw new Error(
      "Invalid encryption IV.",
    );
  }

  if (
    authTag.length !==
    AUTH_TAG_LENGTH
  ) {
    throw new Error(
      "Invalid encryption authentication tag.",
    );
  }

  if (
    encrypted.length ===
    0
  ) {
    throw new Error(
      "Encrypted secret is empty.",
    );
  }

  const key =
    getEncryptionKey();

  const decipher =
    crypto.createDecipheriv(
      ALGORITHM,
      key,
      iv,
      {
        authTagLength:
          AUTH_TAG_LENGTH,
      },
    );

  decipher.setAuthTag(
    authTag,
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        encrypted,
      ),
      decipher.final(),
    ]);

  return decrypted.toString(
    "utf8",
  );
}

/*
|--------------------------------------------------------------------------
| Decrypt legacy format
|--------------------------------------------------------------------------
|
| Legacy Ziya format:
|
| hex(iv):hex(authTag):hex(ciphertext)
|
| Keep this temporarily so already configured tenant M-Pesa
| credentials do not stop working after deployment.
|
|--------------------------------------------------------------------------
*/

function decryptLegacy(
  payload: string,
): string {
  const parts =
    payload.split(":");

  if (
    parts.length !==
    3
  ) {
    throw new Error(
      "Invalid legacy encrypted secret format.",
    );
  }

  const [
    ivHex,
    authTagHex,
    encryptedHex,
  ] = parts;

  const iv =
    decodeHex(ivHex);

  const authTag =
    decodeHex(
      authTagHex,
    );

  const encrypted =
    decodeHex(
      encryptedHex,
    );

  if (
    iv.length !==
    IV_LENGTH
  ) {
    throw new Error(
      "Invalid legacy encryption IV.",
    );
  }

  if (
    authTag.length !==
    AUTH_TAG_LENGTH
  ) {
    throw new Error(
      "Invalid legacy encryption authentication tag.",
    );
  }

  if (
    encrypted.length ===
    0
  ) {
    throw new Error(
      "Legacy encrypted secret is empty.",
    );
  }

  const key =
    getEncryptionKey();

  const decipher =
    crypto.createDecipheriv(
      ALGORITHM,
      key,
      iv,
      {
        authTagLength:
          AUTH_TAG_LENGTH,
      },
    );

  decipher.setAuthTag(
    authTag,
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        encrypted,
      ),
      decipher.final(),
    ]);

  return decrypted.toString(
    "utf8",
  );
}

/*
|--------------------------------------------------------------------------
| Decrypt
|--------------------------------------------------------------------------
|
| Automatically detects the encryption format.
|
|--------------------------------------------------------------------------
*/

export function decryptSecret(
  payload: string,
): string {
  if (
    typeof payload !==
      "string" ||
    payload.length ===
      0
  ) {
    throw new Error(
      "Encrypted secret is empty.",
    );
  }

  try {
    /*
     * New format.
     */
    if (
      payload.includes(".")
    ) {
      return decryptModern(
        payload,
      );
    }

    /*
     * Legacy format.
     */
    if (
      payload.includes(":")
    ) {
      return decryptLegacy(
        payload,
      );
    }

    throw new Error(
      "Unknown encrypted secret format.",
    );
  } catch {
    /*
     * Do not expose cryptographic details or plaintext
     * secrets in application errors.
     */
    throw new Error(
      "Unable to decrypt secret. Verify that MPESA_ENCRYPTION_KEY has not changed and that the stored credential is valid.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Backward-compatible aliases
|--------------------------------------------------------------------------
|
| These make it possible to migrate existing imports gradually.
|--------------------------------------------------------------------------
*/

export const encrypt =
  encryptSecret;

export const decrypt =
  decryptSecret;