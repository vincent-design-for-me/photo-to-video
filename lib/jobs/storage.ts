import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as signS3Url } from "@aws-sdk/s3-request-presigner";
import { getR2Config } from "../cloudflare/config";

let cachedClient: S3Client | null = null;
let cachedKey = "";

function getR2Client(): { client: S3Client; bucket: string } {
  const cfg = getR2Config();
  const key = `${cfg.endpoint}:${cfg.accessKeyId}:${cfg.bucketName}`;
  if (!cachedClient || cachedKey !== key) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      // Avoid optional checksum query params that can break browser PUT presigned URLs on R2.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    cachedKey = key;
  }
  return { client: cachedClient, bucket: cfg.bucketName };
}

export async function uploadToStorage(
  key: string,
  localPath: string,
  contentType: string
): Promise<void> {
  const buffer = await readFile(localPath);
  await uploadBufferToStorage(key, buffer, contentType);
}

export async function uploadBufferToStorage(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const { client, bucket } = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

export async function downloadFromStorage(key: string, localPath: string): Promise<void> {
  const { client, bucket } = getR2Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`Storage download returned an empty body for ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, Buffer.from(bytes));
}

export async function getSignedUrl(
  key: string,
  expiresIn = 3600,
  options?: { download?: string | boolean }
): Promise<string> {
  const { client, bucket } = getR2Client();
  let disposition: string | undefined;
  if (typeof options?.download === "string" && options.download.length > 0) {
    const safeName = options.download.replaceAll('"', "");
    disposition = `attachment; filename="${safeName}"`;
  } else if (options?.download === true) {
    disposition = "attachment";
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(disposition ? { ResponseContentDisposition: disposition } : {}),
  });

  return signS3Url(client, command, { expiresIn });
}

export async function createSignedUploadUrl(
  key: string,
  contentType = "application/octet-stream",
  expiresIn = 900
): Promise<{ signedUrl: string; path: string }> {
  const { client, bucket } = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const signedUrl = await signS3Url(client, command, { expiresIn });
  return { signedUrl, path: key };
}

export async function deleteFromStorage(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const { client, bucket } = getR2Client();
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
  } catch (error) {
    console.warn(
      `[storage:r2] Failed to clean up ${keys.length} object(s): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function storageKey(jobId: string, subpath: string): string {
  return `${jobId}/${subpath}`;
}
