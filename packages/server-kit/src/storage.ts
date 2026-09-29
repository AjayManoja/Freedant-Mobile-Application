import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { UploadUrlResponse } from '@feedants/shared';
import { z } from 'zod';

export const storageEnvSchema = z.object({
  S3_ENDPOINT: z.url().optional(),
  /** Endpoint as reachable by the phone (differs from S3_ENDPOINT inside Docker). */
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  /** Base URL for objects under `public/` (bucket policy allows anonymous GET there only). */
  S3_PUBLIC_BASE_URL: z.url(),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(600),
});
export type StorageEnv = z.infer<typeof storageEnvSchema>;

export interface PresignedUploadRequest {
  key: string;
  contentType: string;
  maxBytes: number;
}

/**
 * Object storage abstraction. Uploads go straight from the device to the bucket
 * (NFR-PF-05) through presigned POST policies, which let the bucket itself enforce the
 * content type and a byte-size range — a presigned PUT cannot bound the size.
 */
export abstract class ObjectStorage {
  abstract presignUpload(req: PresignedUploadRequest): Promise<UploadUrlResponse>;
  abstract exists(key: string): Promise<{ contentType?: string; size?: number } | null>;
  abstract publicUrl(key: string): string;
  abstract presignRead(key: string, expiresSeconds?: number): Promise<string>;
}

export class S3ObjectStorage extends ObjectStorage {
  private readonly client: S3Client;
  /** Signs URLs with the host the device can reach. */
  private readonly publicClient: S3Client;

  constructor(private readonly env: StorageEnv) {
    super();
    const credentials =
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined; // production: EC2 instance role
    const base = { region: env.S3_REGION, forcePathStyle: env.S3_FORCE_PATH_STYLE, credentials };
    this.client = new S3Client({ ...base, endpoint: env.S3_ENDPOINT });
    this.publicClient = new S3Client({ ...base, endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT });
  }

  async presignUpload({ key, contentType, maxBytes }: PresignedUploadRequest): Promise<UploadUrlResponse> {
    const expires = this.env.UPLOAD_URL_TTL_SECONDS;
    const { url, fields } = await createPresignedPost(this.publicClient, {
      Bucket: this.env.S3_BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: expires,
    });
    return { url, fields, key, expiresAt: new Date(Date.now() + expires * 1000).toISOString() };
  }

  async exists(key: string) {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
      return { contentType: head.ContentType, size: head.ContentLength };
    } catch (err) {
      if (err instanceof NotFound || (err as { name?: string }).name === 'NotFound') return null;
      throw err;
    }
  }

  /** Server-side upload for seeding demo content; the app itself only uploads through presigned POSTs. */
  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
    );
  }

  publicUrl(key: string): string {
    return `${this.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }

  presignRead(key: string, expiresSeconds = 3600): Promise<string> {
    return getSignedUrl(this.publicClient, new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }), {
      expiresIn: expiresSeconds,
    });
  }
}

/** Test double: "uploads" are recorded with `put`, so services can be tested without a bucket. */
export class InMemoryObjectStorage extends ObjectStorage {
  readonly objects = new Map<string, { contentType: string; size: number }>();

  async presignUpload({ key, contentType }: PresignedUploadRequest): Promise<UploadUrlResponse> {
    return {
      url: 'http://storage.test/upload',
      fields: { key, 'Content-Type': contentType },
      key,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
  }

  put(key: string, contentType: string, size = 1024): void {
    this.objects.set(key, { contentType, size });
  }

  async exists(key: string) {
    return this.objects.get(key) ?? null;
  }

  publicUrl(key: string): string {
    return `http://storage.test/${key}`;
  }

  async presignRead(key: string): Promise<string> {
    return `http://storage.test/${key}?signed=1`;
  }
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'video/mp4': 'mp4',
};
export const extensionFor = (contentType: string): string => EXTENSIONS[contentType] ?? 'bin';
