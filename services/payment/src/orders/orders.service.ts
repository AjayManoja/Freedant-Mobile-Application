import { Injectable, Logger } from '@nestjs/common';
import { AppError, uuidv7 } from '@feedants/server-kit';
import type { CreateOrderInput, CreateOrderResponse } from '@feedants/shared';
import type { Order } from '../generated/prisma/client';
import { EXTERNAL, escrow, LedgerService, PLATFORM } from '../ledger/ledger.service';
import { outbox } from '../outbox';
import { PrismaService, type Tx } from '../prisma.service';
import { PaymentProvider, type ProviderEvent } from '../provider/payment-provider';
import { RefundsService } from '../refunds/refunds.service';

const response = (o: Order, keyId: string): CreateOrderResponse => ({
  orderId: o.id,
  providerOrderId: o.providerOrderId!,
  amountPaise: o.amountPaise,
  currency: 'INR',
  keyId,
});

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PaymentProvider,
    private readonly ledger: LedgerService,
    private readonly refunds: RefundsService,
  ) {}

  /** FR-PY-01. Deduplicated on the idempotency key, so Competition may retry safely. */
  async create(input: CreateOrderInput): Promise<CreateOrderResponse> {
    let order = await this.prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (order && (order.amountPaise !== input.amountPaise || order.referenceId !== input.referenceId)) {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key reused for a different order');
    }
    if (!order) {
      try {
        order = await this.prisma.order.create({ data: { id: uuidv7(), ...input } });
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err;
        order = await this.prisma.order.findUniqueOrThrow({
          where: { idempotencyKey: input.idempotencyKey },
        });
      }
    }
    if (!order.providerOrderId) {
      const { providerOrderId } = await this.provider.createOrder(order.amountPaise, order.id, {
        orderId: order.id,
        purpose: order.purpose,
      });
      order = await this.prisma.order.update({ where: { id: order.id }, data: { providerOrderId } });
    }
    return response(order, this.provider.keyId);
  }

  /**
   * FR-PY-02: applied exactly once per provider event ID, and tolerant of duplicates and
   * out-of-order delivery (a "failed" arriving after "captured" changes nothing).
   */
  async apply(event: ProviderEvent, tx: Tx): Promise<void> {
    switch (event.type) {
      case 'payment.captured':
        return this.captured(tx, event);
      case 'payment.failed':
        return this.failed(tx, event);
      case 'refund.processed':
        return this.refunds.markProcessed(tx, event.providerRefundId);
      case 'ignored':
        return;
    }
  }

  private async captured(tx: Tx, e: Extract<ProviderEvent, { type: 'payment.captured' }>): Promise<void> {
    const order = await tx.order.findUnique({ where: { providerOrderId: e.providerOrderId } });
    if (!order) {
      this.logger.error({ providerOrderId: e.providerOrderId }, 'Capture for unknown order');
      return;
    }
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: { in: ['CREATED', 'FAILED'] } },
      data: {
        status: 'CAPTURED',
        providerPaymentId: e.providerPaymentId,
        capturedAt: new Date(),
        failureReason: null,
      },
    });
    if (count === 0) return; // already captured (duplicate or replay)
    if (e.amountPaise !== order.amountPaise) {
      // Never trust the client; the provider amount must match what we asked for.
      this.logger.error(
        { orderId: order.id, expected: order.amountPaise, got: e.amountPaise },
        'Captured amount mismatch',
      );
    }

    const net = order.amountPaise - order.platformFeePaise;
    await this.ledger.post(tx, {
      kind: order.purpose,
      referenceId: order.id,
      subjectUserId: order.payerId,
      competitionId: order.competitionId,
      displayAmountPaise: -order.amountPaise,
      description: order.purpose === 'ENTRY_FEE' ? 'Entry fee' : 'Prize pool funding',
      entries: [
        { account: EXTERNAL, amountPaise: -order.amountPaise },
        { account: escrow(order.competitionId), amountPaise: net },
        { account: PLATFORM, amountPaise: order.platformFeePaise },
      ],
    });
    await tx.outboxEvent.create({
      data: outbox(
        'payment.captured',
        { type: 'order', id: order.id },
        {
          orderId: order.id,
          competitionId: order.competitionId,
          idempotencyKey: order.idempotencyKey,
          purpose: order.purpose,
          referenceId: order.referenceId,
          payerId: order.payerId,
          amountPaise: order.amountPaise,
        },
      ),
    });
  }

  private async failed(tx: Tx, e: Extract<ProviderEvent, { type: 'payment.failed' }>): Promise<void> {
    const order = await tx.order.findUnique({ where: { providerOrderId: e.providerOrderId } });
    if (!order) return;
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: { in: ['CREATED', 'FAILED'] } },
      data: { status: 'FAILED', failureReason: e.reason.slice(0, 300) },
    });
    if (count === 0) return;
    await tx.outboxEvent.create({
      data: outbox(
        'payment.failed',
        { type: 'order', id: order.id },
        {
          orderId: order.id,
          competitionId: order.competitionId,
          idempotencyKey: order.idempotencyKey,
          purpose: order.purpose,
          referenceId: order.referenceId,
          payerId: order.payerId,
          reason: e.reason.slice(0, 300),
        },
      ),
    });
  }
}
