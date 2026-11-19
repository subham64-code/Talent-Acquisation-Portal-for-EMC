import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { safeFileName, sha256 } from "../utils/crypto";

/**
 * Cloud/local file storage abstraction.
 *
 * Files are written to an S3-compatible bucket (Filebase, AWS S3, R2, Spaces)
 * when configured, and transparently fall back to the local filesystem during
 * development when `STORAGE_ALLOW_LOCAL=true` (or when no bucket is present).
 * Every stored object has a matching `StoredFile` row that carries the metadata
 * the rest of the application uses to authorise and stream downloads.
 */

export const ALLOWED_UPLOAD_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const STORAGE_BUCKETS = {
  APPLICATIONS: "applications",
  RESUMES: "resumes",
  EMPLOYEES: "employees",
  JOB_DESCRIPTIONS: "job-descriptions",
  OFFERS: "offers",
  ONBOARDING: "onboarding-documents",
  AVATARS: "avatars",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
export type StorageProvider = "s3" | "local";

export interface StoreFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  ownerType?: string;
  ownerId?: string;
  uploadedById?: string;
  bucket?: string;
  visibility?: "PRIVATE" | "PUBLIC";
}

const s3Configured = Boolean(env.s3Bucket && env.s3AccessKeyId && env.s3SecretAccessKey);

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.s3Region || "auto",
      endpoint: env.s3Endpoint || undefined,
      forcePathStyle: env.s3ForcePathStyle,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    });
  }
  return s3Client;
}

function resolveProvider(): StorageProvider {
  if (env.storageProvider === "s3" && s3Configured) return "s3";
  if (env.storageAllowLocal || env.isDev) return "local";
  throw new Error(
    "No cloud storage is configured. Set STORAGE_PROVIDER=s3 with bucket credentials or enable STORAGE_ALLOW_LOCAL in development.",
  );
}

function buildKey(input: StoreFileInput): string {
  const now = new Date();
  const bucket = (input.bucket || "misc").replace(/[^a-z0-9_-]+/gi, "-");
  const owner = (input.ownerType || "misc").toLowerCase().replace(/[^a-z0-9_-]+/gi, "-");
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const unique = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
  return `${bucket}/${owner}/${year}/${month}/${unique}-${safeFileName(input.originalName)}`;
}

function localPathFor(storagePath: string): string {
  return path.isAbsolute(storagePath) ? storagePath : path.join(env.localStorageDir, storagePath);
}

async function writeLocal(key: string, buffer: Buffer): Promise<void> {
  const target = localPathFor(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  const stream = body as AsyncIterable<Uint8Array> & { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof stream.transformToByteArray === "function") {
    return Buffer.from(await stream.transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function storeFile(input: StoreFileInput) {
  const provider = resolveProvider();
  const key = buildKey(input);

  if (provider === "s3") {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
        Metadata: {
          originalName: encodeURIComponent(input.originalName),
          ownerType: input.ownerType || "misc",
          ownerId: input.ownerId || "",
        },
      }),
    );
  } else if (provider === "local") {
    await writeLocal(key, input.buffer);
  } else {
    throw new Error("Google Drive storage is not available. Configure S3 or local storage instead.");
  }

  return prisma.storedFile.create({
    data: {
      key,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.buffer.length,
      provider,
      storagePath: key,
      checksum: sha256(input.buffer),
      visibility: input.visibility || "PRIVATE",
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      uploadedById: input.uploadedById,
    },
  });
}

export async function readStoredFile(file: {
  provider: string;
  storagePath: string;
  key?: string;
}): Promise<Buffer> {
  if (file.provider === "s3") {
    const result = await getS3Client().send(
      new GetObjectCommand({ Bucket: env.s3Bucket, Key: file.storagePath }),
    );
    return streamToBuffer(result.Body);
  }
  if (file.provider === "local") {
    return fs.readFile(localPathFor(file.storagePath));
  }
  throw new Error(`Unsupported storage provider: ${file.provider}`);
}

export async function presignS3Get(key: string, expiresInSeconds = 3600): Promise<string | null> {
  if (!s3Configured) return null;
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export function storageStatus() {
  let provider: StorageProvider = "local";
  let configured = true;
  try {
    provider = resolveProvider();
    configured = provider !== "local" || env.storageAllowLocal;
  } catch {
    configured = false;
  }
  return {
    provider,
    configured,
    bucket: env.s3Bucket || null,
    endpoint: env.s3Endpoint || null,
    region: env.s3Region || null,
    localDir: env.localStorageDir,
    maxUploadMb: env.maxUploadMb,
  };
}

export async function storageBucketSummary(): Promise<Array<{ bucket: string; files: number; bytes: number }>> {
  const groups = await prisma.storedFile.groupBy({
    by: ["ownerType"],
    _count: { _all: true },
    _sum: { size: true },
  });
  return groups
    .map((group) => ({
      bucket: group.ownerType || "other",
      files: group._count._all,
      bytes: group._sum.size || 0,
    }))
    .sort((a, b) => b.files - a.files);
}
