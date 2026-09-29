import { type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppError, zodIssues } from './errors';

/**
 * Validates and parses a request part with a zod schema. Strict schemas reject unknown
 * fields (NFR-SC-04). Usage: `@Body(new ZodPipe(schema)) body: Input`.
 */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError('VALIDATION_FAILED', 'Request validation failed', zodIssues(result.error));
    }
    return result.data;
  }
}
