import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
};

const getStorageClient = (): S3Client => {
  const accessKeyId =
    getRequiredEnv("ACCESS_KEY_ID");

  const secretAccessKey =
    getRequiredEnv("SECRET_ACCESS_KEY");

  const region =
    getRequiredEnv("REGION");

  const endpoint =
    getRequiredEnv("ENDPOINT");

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

const getBucketName = (): string =>
  getRequiredEnv("BUCKET");

/**
 * Creates a tenant-isolated storage key.
 *
 * Example:
 * organizations/org_123/documents/DOC-001/invoice.pdf
 */
export const buildDocumentStorageKey = (
  organizationId: string,
  documentCode: string,
  fileName: string
): string => {
  const safeFileName =
    fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 180);

  return [
    "organizations",
    organizationId,
    "documents",
    documentCode,
    safeFileName || "document",
  ].join("/");
};

/**
 * Generates a temporary upload URL.
 */
export const createDocumentUploadUrl = async (
  storageKey: string,
  contentType?: string
): Promise<string> => {
  const client =
    getStorageClient();

  const command =
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: storageKey,

      ...(contentType
        ? {
            ContentType: contentType,
          }
        : {}),
    });

  return getSignedUrl(
    client,
    command,
    {
      expiresIn: 900,
    }
  );
};

/**
 * Generates a temporary download URL.
 */
export const createDocumentDownloadUrl = async (
  storageKey: string,
  fileName: string,
  contentType?: string | null
): Promise<string> => {
  const client =
    getStorageClient();

  const command =
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: storageKey,

      ResponseContentDisposition:
        `attachment; filename="${fileName.replace(/"/g, "")}"`,

      ...(contentType
        ? {
            ResponseContentType:
              contentType,
          }
        : {}),
    });

  return getSignedUrl(
    client,
    command,
    {
      expiresIn: 300,
    }
  );
};

/**
 * Deletes the actual stored file.
 */
export const deleteDocumentObject = async (
  storageKey: string
): Promise<void> => {
  const client =
    getStorageClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: storageKey,
    })
  );
};
