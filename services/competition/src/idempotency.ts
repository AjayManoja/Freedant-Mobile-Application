import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AppError } from '@feedants/server-kit';
import type { Request } from 'express';

const KEY = /^[A-Za-z0-9_-]{8,100}$/;

/** Required `Idempotency-Key` header for writes that must never run twice (HLD §5.3). */
export const IdempotencyKey = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const value = ctx.switchToHttp().getRequest<Request>().header('idempotency-key');
  if (!value || !KEY.test(value)) {
    throw new AppError('VALIDATION_FAILED', 'An Idempotency-Key header (8–100 characters) is required');
  }
  return value;
});
