import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ErrorBody, type ErrorCode, httpStatusFor } from '@feedants/shared';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { requestContext } from './context';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    /** Seconds; sent as Retry-After for RATE_LIMITED and similar codes. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return httpStatusFor(this.code);
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`);
export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError('FORBIDDEN', message);

const codeForStatus = (status: number): ErrorCode => {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED';
  }
};

export const zodIssues = (error: ZodError) =>
  error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));

export function toErrorResponse(
  exception: unknown,
  requestId: string,
): { status: number; body: ErrorBody; retryAfterSeconds?: number } {
  if (exception instanceof AppError) {
    return {
      status: exception.status,
      retryAfterSeconds: exception.retryAfterSeconds,
      body: {
        error: {
          code: exception.code,
          message: exception.message,
          requestId,
          ...(exception.details === undefined ? {} : { details: exception.details }),
        },
      },
    };
  }
  if (exception instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          requestId,
          details: zodIssues(exception),
        },
      },
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = codeForStatus(status);
    // Nest's own messages (e.g. "Cannot GET /x", JSON parse errors) are safe to echo.
    const message = status >= 500 ? 'Internal error' : exception.message;
    return { status, body: { error: { code, message, requestId } } };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: 'Internal error', requestId } },
  };
}

/** One error format for every service (SRS §5). Unknown errors never leak internals. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const requestId = String(req.id ?? requestContext.get()?.requestId ?? 'unknown');

    const { status, body, retryAfterSeconds } = toErrorResponse(exception, requestId);
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception : { exception }, 'Unhandled error');
    }
    if (retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(status).json(body);
  }
}
