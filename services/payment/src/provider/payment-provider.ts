import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError, ENV, uuidv7 } from '@feedants/server-kit';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentEnv } from '../config';

/** Normalised provider notification (Razorpay webhook or the fake provider's simulation). */
export type ProviderEvent =
  | {
      eventId: string;
      type: 'payment.captured';
      providerOrderId: string;
      providerPaymentId: string;
      amountPaise: number;
    }
  | {
      eventId: string;
      type: 'payment.failed';
      providerOrderId: string;
      providerPaymentId: string;
      reason: string;
    }
  | { eventId: string; type: 'refund.processed'; providerRefundId: string; providerPaymentId: string }
  | { eventId: string; type: 'ignored'; providerType: string };

export interface RefundResult {
  providerRefundId: string;
  processed: boolean;
}

/**
 * Payment provider port. Checkout itself happens in the provider's hosted UI, so the
 * system never handles card data (NFR-SC-06).
 */
export abstract class PaymentProvider {
  abstract readonly keyId: string;
  abstract createOrder(
    amountPaise: number,
    receipt: string,
    notes: Record<string, string>,
  ): Promise<{ providerOrderId: string }>;
  abstract refund(
    providerPaymentId: string,
    amountPaise: number,
    notes: Record<string, string>,
  ): Promise<RefundResult>;
  /** Verifies the signature over the raw body; false on any mismatch. */
  abstract verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean;
  abstract parseWebhook(rawBody: Buffer, eventIdHeader: string | undefined): ProviderEvent;
}

type RazorpayWebhook = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string } };
  };
};

@Injectable()
export class RazorpayProvider extends PaymentProvider {
  private readonly logger = new Logger(RazorpayProvider.name);
  readonly keyId: string;

  constructor(@Inject(ENV) private readonly env: PaymentEnv) {
    super();
    this.keyId = env.RAZORPAY_KEY_ID!;
  }

  async createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
    const body = await this.call<{ id: string }>('POST', '/orders', {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes,
    });
    return { providerOrderId: body.id };
  }

  async refund(
    providerPaymentId: string,
    amountPaise: number,
    notes: Record<string, string>,
  ): Promise<RefundResult> {
    const body = await this.call<{ id: string; status: string }>(
      'POST',
      `/payments/${providerPaymentId}/refund`,
      {
        amount: amountPaise,
        speed: 'normal',
        notes,
      },
    );
    return { providerRefundId: body.id, processed: body.status === 'processed' };
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = createHmac('sha256', this.env.RAZORPAY_WEBHOOK_SECRET!).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: Buffer, eventIdHeader: string | undefined): ProviderEvent {
    const w = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhook;
    // Razorpay sends x-razorpay-event-id; fall back to a digest so replays still dedupe.
    const eventId = eventIdHeader ?? createHmac('sha256', 'event-id').update(rawBody).digest('hex');
    const p = w.payload.payment?.entity;
    const r = w.payload.refund?.entity;
    if (w.event === 'payment.captured' && p) {
      return {
        eventId,
        type: 'payment.captured',
        providerOrderId: p.order_id,
        providerPaymentId: p.id,
        amountPaise: p.amount,
      };
    }
    if (w.event === 'payment.failed' && p) {
      return {
        eventId,
        type: 'payment.failed',
        providerOrderId: p.order_id,
        providerPaymentId: p.id,
        reason: p.error_description ?? 'Payment failed',
      };
    }
    if (w.event === 'refund.processed' && r) {
      return { eventId, type: 'refund.processed', providerRefundId: r.id, providerPaymentId: r.payment_id };
    }
    return { eventId, type: 'ignored', providerType: w.event };
  }

  private async call<T>(method: string, path: string, body: unknown): Promise<T> {
    const auth = Buffer.from(`${this.env.RAZORPAY_KEY_ID}:${this.env.RAZORPAY_KEY_SECRET}`).toString(
      'base64',
    );
    let res: Response;
    try {
      res = await fetch(`${this.env.RAZORPAY_API_URL}${path}`, {
        method,
        headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.env.PROVIDER_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn({ err, path }, 'Razorpay unreachable');
      throw new AppError('PAYMENT_PROVIDER_ERROR', 'Payment provider unavailable');
    }
    if (!res.ok) {
      this.logger.warn(
        { status: res.status, path, body: (await res.text()).slice(0, 500) },
        'Razorpay error',
      );
      throw new AppError('PAYMENT_PROVIDER_ERROR', 'Payment provider rejected the request');
    }
    return (await res.json()) as T;
  }
}

/**
 * In-process stand-in for Razorpay. Orders and refunds succeed immediately; captures and
 * failures are driven by `POST /v1/payments/dev/simulate` (development) or by tests.
 */
export class FakeProvider extends PaymentProvider {
  readonly keyId = 'rzp_test_fake';
  readonly orders = new Map<string, { amountPaise: number; paymentId: string }>();
  readonly refunds: { providerPaymentId: string; amountPaise: number }[] = [];
  failRefunds = 0;

  async createOrder(amountPaise: number) {
    const providerOrderId = `order_fake_${uuidv7().replace(/-/g, '').slice(-14)}`;
    this.orders.set(providerOrderId, {
      amountPaise,
      paymentId: `pay_fake_${uuidv7().replace(/-/g, '').slice(-14)}`,
    });
    return { providerOrderId };
  }

  async refund(providerPaymentId: string, amountPaise: number): Promise<RefundResult> {
    if (this.failRefunds > 0) {
      this.failRefunds--;
      throw new AppError('PAYMENT_PROVIDER_ERROR', 'Payment provider unavailable');
    }
    this.refunds.push({ providerPaymentId, amountPaise });
    return { providerRefundId: `rfnd_fake_${uuidv7().replace(/-/g, '').slice(-14)}`, processed: true };
  }

  verifyWebhook(): boolean {
    return false; // the fake never receives real webhooks
  }

  parseWebhook(): ProviderEvent {
    throw new AppError('WEBHOOK_SIGNATURE_INVALID', 'Webhooks are not accepted with the fake provider');
  }

  simulate(providerOrderId: string, outcome: 'captured' | 'failed'): ProviderEvent {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    const eventId = `evt_fake_${uuidv7()}`;
    return outcome === 'captured'
      ? {
          eventId,
          type: 'payment.captured',
          providerOrderId,
          providerPaymentId: order.paymentId,
          amountPaise: order.amountPaise,
        }
      : {
          eventId,
          type: 'payment.failed',
          providerOrderId,
          providerPaymentId: order.paymentId,
          reason: 'Payment declined (simulated)',
        };
  }
}
