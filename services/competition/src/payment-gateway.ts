import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError, ENV, requestContext } from '@feedants/server-kit';
import { type CreateOrderInput, type CreateOrderResponse, INTERNAL_TOKEN_HEADER } from '@feedants/shared';
import type { CompetitionEnv } from './config';

/** Competition → Payment, the one synchronous call in the system (HLD §2). */
export abstract class PaymentGateway {
  abstract createOrder(input: CreateOrderInput): Promise<CreateOrderResponse>;
}

@Injectable()
export class HttpPaymentGateway extends PaymentGateway {
  private readonly logger = new Logger(HttpPaymentGateway.name);

  constructor(@Inject(ENV) private readonly env: CompetitionEnv) {
    super();
  }

  /**
   * Fixed timeout, one retry. Retrying is safe because Payment deduplicates on the
   * idempotency key: a retry after a lost response returns the same order.
   */
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(`${this.env.PAYMENT_INTERNAL_URL}/internal/orders`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [INTERNAL_TOKEN_HEADER]: this.env.INTERNAL_API_TOKEN,
            'x-request-id': requestContext.get()?.requestId ?? '',
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(this.env.PAYMENT_TIMEOUT_MS),
        });
        if (res.ok) return (await res.json()) as CreateOrderResponse;
        if (res.status < 500) {
          this.logger.error({ status: res.status, body: await res.text() }, 'Payment rejected order request');
          throw new AppError('PAYMENT_PROVIDER_ERROR', 'Could not start the payment');
        }
        lastError = new Error(`payment responded ${res.status}`);
      } catch (err) {
        if (err instanceof AppError) throw err;
        lastError = err;
      }
    }
    this.logger.warn({ err: lastError }, 'Payment service unavailable');
    throw new AppError('SERVICE_UNAVAILABLE', 'Payments are unavailable right now, please try again');
  }
}
