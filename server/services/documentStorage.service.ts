import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Required environment variable.
 *
 * Storage credentials are read only on the server and are never
 * exposed to the browser.
 */
const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
};

/**
 * Creates the S3-compatible storage client.
 *
 * This works with Railway Buckets and other S3-compatible object
 * storage providers.
 */
const getStorageClient = (): S3Client => {
  const accessKeyId = getRequiredEnv("ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("SECRET_ACCESS_KEY");
  const region = getRequiredEnv("REGION");
  const endpoint = getRequiredEnv("ENDPOINT");

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

const getBucketName = (): string => getRequiredEnv("BUCKET");

/**
 * Creates a safe filename for use in an object-storage key.
 */
const sanitizeFileName = (fileName: string): string => {
  const sanitized = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);

  return sanitized || "document";
};

/**
 * Creates a tenant-isolated storage key.
 *
 * Example:
 * organizations/org_123/documents/DOC-001/invoice.pdf
 *
 * IMPORTANT:
 * The organization ID is supplied by the authenticated backend
 * context. The browser must never be allowed to choose another
 * organization's storage prefix.
 */
export const buildDocumentStorageKey = (
  organizationId: string,
  documentCode: string,
  fileName: string,
): string => {
  const safeOrganizationId = organizationId.trim();
  const safeDocumentCode = documentCode.trim();
  const safeFileName = sanitizeFileName(fileName);

  if (!safeOrganizationId) {
    throw new Error("Organization ID is required.");
  }

  if (!safeDocumentCode) {
    throw new Error("Document code is required.");
  }

  return [
    "organizations",
    safeOrganizationId,
    "documents",
    safeDocumentCode,
    safeFileName,
  ].join("/");
};

/**
 * Generates a short-lived signed URL for direct browser upload.
 *
 * The browser receives only the signed URL. Storage credentials
 * remain exclusively on the backend.
 */
export const createDocumentUploadUrl = async (
  storageKey: string,
  contentType?: string,
): Promise<string> => {
  const normalizedStorageKey = storageKey.trim();

  if (!normalizedStorageKey) {
    throw new Error("Storage key is required.");
  }

  const client = getStorageClient();

  const normalizedContentType =
    typeof contentType === "string" && contentType.trim()
      ? contentType.trim()
      : undefined;

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: normalizedStorageKey,
    ...(normalizedContentType
      ? {
          ContentType: normalizedContentType,
        }
      : {}),
  });

  return getSignedUrl(client, command, {
    expiresIn: 900,
  });
};

/**
 * Generates a short-lived signed URL for viewing or downloading
 * a document.
 *
 * `view = true`
 *   Opens the document inline when the browser supports the MIME type.
 *
 * `view = false`
 *   Forces the browser to treat the response as a downloadable file.
 */
export const createDocumentDownloadUrl = async (
  storageKey: string,
  fileName: string,
  contentType?: string | null,
  view = false,
): Promise<string> => {
  const normalizedStorageKey = storageKey.trim();

  if (!normalizedStorageKey) {
    throw new Error("Storage key is required.");
  }

  const client = getStorageClient();

  const safeFileName = sanitizeDownloadFileName(fileName);

  const normalizedContentType =
    typeof contentType === "string" && contentType.trim()
      ? contentType.trim()
      : undefined;

  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: normalizedStorageKey,

    ResponseContentDisposition: view
      ? `inline; filename="${safeFileName}"`
      : `attachment; filename="${safeFileName}"`,

    ...(normalizedContentType
      ? {
          ResponseContentType: normalizedContentType,
        }
      : {}),
  });

  return getSignedUrl(client, command, {
    expiresIn: 300,
  });
};

/**
 * Removes characters that could interfere with a Content-Disposition
 * filename value.
 *
 * This is intentionally separate from storage-key sanitization because
 * this filename is sent as an HTTP response header.
 */
const sanitizeDownloadFileName = (fileName: string): string => {
  const sanitized = fileName
    .trim()
    .replace(/[\r\n]/g, "")
    .replace(/["\\]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 180);

  return sanitized || "document";
};

/**
 * Deletes the physical object from storage.
 *
 * The caller must perform the tenant ownership check before invoking
 * this function.
 */
export const deleteDocumentObject = async (
  storageKey: string,
): Promise<void> => {
  const normalizedStorageKey = storageKey.trim();

  if (!normalizedStorageKey) {
    throw new Error("Storage key is required.");
  }

  const client = getStorageClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: normalizedStorageKey,
    }),
  );
};