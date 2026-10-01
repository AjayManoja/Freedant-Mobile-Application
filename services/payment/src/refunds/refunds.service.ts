import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ENV, uuidv7 } from '@feedants/server-kit';
import { orderDescription } from '@feedants/shared';
import type { PaymentEnv } from '../config';
import type { RefundReason } from '../generated/prisma/client';
import { EXTERNAL, escrow, LedgerService, PLATFORM } from '../ledger/ledger.service';
import { outbox } from '../outbox';
import { PrismaService, type Tx } from '../prisma.service';
import { PaymentProvider } from '../provider/payment-provider';

/**
 * FR-PY-06: refunds are decided inside the consumer's transaction (refund row + reversing
 * ledger posting), and sent to the provider afterwards by this worker — so no external call
 * ever runs inside a database transaction, and a provider outage only delays the refund.
 */
@Injectable()
export class RefundsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RefundsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: PaymentEnv,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.env.WORKERS_ENABLED) return;
    this.timer = setInterval(() => {
      this.sendPending().catch((err) => this.logger.error({ err }, 'Refund worker failed'));
    }, this.env.REFUND_WORKER_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Full refund of a captured order (A-13). Idempotent: one refund per order. */
  async request(tx: Tx, orderId: string, reason: RefundReason): Promise<boolean> {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { refund: true } });
    if (!order || order.refund) return false;
    if (order.status !== 'CAPTURED') {
      this.logger.warn(
        { orderId, status: order.status },
        'Refund requested for an order that was never captured',
      );
      return false;
    }
    const refundId = uuidv7();
    await tx.refund.create({ data: { id: refundId, orderId, amountPaise: order.amountPaise, reason } });
    await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
    await this.ledger.post(tx, {
      kind: 'REFUND',
      referenceId: refundId,
      subjectUserId: order.payerId,
      competitionId: order.competitionId,
      displayAmountPaise: order.amountPaise,
      description: orderDescription(order.purpose, order.title, true),
      entries: [
        { account: escrow(order.competitionId), amountPaise: -(order.amountPaise - order.platformFeePaise) },
        { account: PLATFORM, amountPaise: -order.platformFeePaise },
        { account: EXTERNAL, amountPaise: order.amountPaise },
      ],
    });
    return true;
  }

  /** Sends accepted-but-unsent refunds to the provider; safe to run on several instances. */
  async sendPending(batch = 20, now = new Date()): Promise<number> {
    let sent = 0;
    for (let i = 0; i < batch; i++) {
      const done = await this.prisma.$transaction(
        async (tx) => {
          const [row] = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM refunds
             WHERE status = 'PENDING' AND provider_refund_id IS NULL AND attempts < ${this.env.REFUND_MAX_ATTEMPTS}
               -- Linear backoff after a provider error: 30 s × attempts.
               AND (attempts = 0 OR updated_at < ${now}::timestamptz - make_interval(secs => 30 * attempts))
             ORDER BY updated_at
             LIMIT 1
             FOR UPDATE SKIP LOCKED`;
          if (!row) return null;
          const refund = await tx.refund.findUniqueOrThrow({
            where: { id: row.id },
            include: { order: true },
          });
          try {
            const result = await this.provider.refund(refund.order.providerPaymentId!, refund.amountPaise, {
              refundId: refund.id,
              orderId: refund.orderId,
            });
            await tx.refund.update({
              where: { id: refund.id },
              data: {
                providerRefundId: result.providerRefundId,
                attempts: { increment: 1 },
                lastError: null,
              },
            });
            if (result.processed) await this.markProcessed(tx, result.providerRefundId);
          } catch (err) {
            this.logger.warn({ err, refundId: refund.id }, 'Refund not accepted by provider; will retry');
            await tx.refund.update({
              where: { id: refund.id },
              data: {
                attempts: { increment: 1 },
                lastError: (err as Error).message.slice(0, 300),
                status: refund.attempts + 1 >= this.env.REFUND_MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
              },
            });
          }
          return refund.id;
        },
        { timeout: 30_000 },
      );
      if (!done) break;
      sent++;
    }
    return sent;
  }

  async markProcessed(tx: Tx, providerRefundId: string): Promise<void> {
    const refund = await tx.refund.findUnique({ where: { providerRefundId }, include: { order: true } });
    if (!refund) return;
    const { count } = await tx.refund.updateMany({
      where: { id: refund.id, status: { not: 'PROCESSED' } },
      data: { status: 'PROCESSED' },
    });
    if (count === 0) return;
    await tx.outboxEvent.create({
      data: outbox(
        'payment.refunded',
        { type: 'refund', id: refund.id },
        {
          refundId: refund.id,
          orderId: refund.orderId,
          competitionId: refund.order.competitionId,
          payerId: refund.order.payerId,
          amountPaise: refund.amountPaise,
          reason: refund.reason,
        },
      ),
    });
  }
}
