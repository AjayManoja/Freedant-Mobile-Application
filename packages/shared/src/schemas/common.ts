import { z } from 'zod';
import { defaultRules } from '../rules';

export const uuidSchema = z.uuid();

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const paginationQuerySchema = z.strictObject({
  cursor: z.string().max(512).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(defaultRules.pagination.maxLimit)
    .default(defaultRules.pagination.defaultLimit),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** A list page that also reports how many items match in total (first page only; null after). */
export interface CountedPage<T> extends Page<T> {
  total: number | null;
}

export const imageUploadRequestSchema = z.strictObject({
  contentType: z.enum(defaultRules.media.IMAGE.contentTypes as [string, ...string[]]),
  sizeBytes: z.number().int().positive(),
});
export type ImageUploadRequest = z.infer<typeof imageUploadRequestSchema>;

/**
 * Presigned POST: the client sends a multipart form to `url` with every entry of `fields`
 * followed by the file. The bucket enforces content type and maximum size.
 */
export interface UploadUrlResponse {
  url: string;
  fields: Record<string, string>;
  /** Object key to send back once the upload finishes. */
  key: string;
  expiresAt: string;
}
