import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { claimInbox, EventBus, parseEvent } from '@feedants/server-kit';
import type { EventEnvelope, EventPayload } from '@feedants/shared';
import { isRegistrationOpen } from '@feedants/shared';
import { outbox } from '../outbox';
import { PrismaService, type Tx } from '../prisma.service';
import { windows } from '../views';
import { DiscoveryService } from '../discovery/discovery.service';

const CONSUMER = 'competition.payment-result';

/**
 * The asynchronous half of the join & pay and publish sagas (HLD §5.4, §5.5). Idempotent:
 * each event is claimed in `inbox_events` inside the transaction that applies it.
 */
@Injectable()
export class PaymentEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentEventsConsumer.name);

  constructor(
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.subscribe({
      queue: CONSUMER,
      routingKeys: ['payment.captured', 'payment.failed'],
      handler: (e) => this.handle(e),
    });
  }

  async handle(event: EventEnvelope): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await claimInbox(tx, event.id, CONSUMER))) return;
      if (event.type === 'payment.captured') {
        const p = parseEvent(event, 'payment.captured');
        if (p.purpose === 'ENTRY_FEE') await this.entryCaptured(tx, p);
        else await this.fundingCaptured(tx, p);
      } else if (event.type === 'payment.failed') {
        const p = parseEvent(event, 'payment.failed');
        if (p.purpose === 'ENTRY_FEE') {
          await tx.registration.updateMany({
            where: { id: p.referenceId, status: 'HELD' },
            data: { lastPaymentError: p.reason.slice(0, 300) },
          });
        } else {
          await tx.competition.updateMany({
            where: { id: p.referenceId, status: 'AWAITING_FUNDING', fundingOrderId: p.orderId },
            data: { fundingError: p.reason.slice(0, 300) },
          });
        }
      }
    });
    if (event.type === 'payment.captured') await this.discovery.invalidateHome();
  }

  /**
   * Confirms the hold. If the hold already lapsed (FR-PT-06, US-22) the creator still gets
   * in when a spot is free; otherwise the registration is rejected and Payment refunds it.
   */
  private async entryCaptured(tx: Tx, p: EventPayload<'payment.captured'>): Promise<void> {
    const r = await tx.registration.findUnique({
      where: { id: p.referenceId },
      include: { competition: true },
    });
    if (!r || r.idempotencyKey !== p.idempotencyKey) {
      this.logger.error({ orderId: p.orderId }, 'Captured payment for an unknown registration');
      return;
    }
    const confirmFrom = async (from: 'HELD' | 'EXPIRED') => {
      const { count } = await tx.registration.updateMany({
        where: { id: r.id, status: from },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          holdExpiresAt: null,
          lastPaymentError: null,
          paymentOrderId: p.orderId,
        },
      });
      if (count === 0) return false;
      await tx.outboxEvent.create({
        data: outbox(
          'registration.confirmed',
          { type: 'registration', id: r.id },
          {
            registrationId: r.id,
            competitionId: r.competitionId,
            competitionTitle: r.competition.title ?? 'Competition',
            creatorId: r.creatorId,
          },
        ),
      });
      return true;
    };

    // Still held: the spot is reserved for this registration even if the sweep is due.
    // Conditional, so a sweep expiring it at this instant can't be overwritten.
    if (await confirmFrom('HELD')) {
      await tx.$executeRaw`UPDATE competitions SET confirmed_count = confirmed_count + 1 WHERE id = ${r.competitionId}::uuid`;
      return;
    }
    const current = await tx.registration.findUniqueOrThrow({ where: { id: r.id } });
    if (current.status === 'EXPIRED') {
      const c = r.competition;
      const stillOpen = c.status === 'PUBLISHED' && isRegistrationOpen(windows(c), new Date());
      const active = await tx.registration.count({
        where: {
          competitionId: r.competitionId,
          creatorId: r.creatorId,
          status: { in: ['HELD', 'CONFIRMED'] },
        },
      });
      if (stillOpen && active === 0) {
        const retaken = await tx.$executeRaw`
          UPDATE competitions
             SET spots_remaining = spots_remaining - 1, confirmed_count = confirmed_count + 1
           WHERE id = ${r.competitionId}::uuid AND status = 'PUBLISHED' AND spots_remaining > 0`;
        if (retaken === 1 && (await confirmFrom('EXPIRED'))) return;
      }
      await tx.registration.update({
        where: { id: r.id },
        data: { status: 'REJECTED', paymentOrderId: p.orderId },
      });
      await tx.outboxEvent.create({
        data: outbox(
          'registration.rejected',
          { type: 'registration', id: r.id },
          {
            registrationId: r.id,
            competitionId: r.competitionId,
            creatorId: r.creatorId,
            orderId: p.orderId,
          },
        ),
      });
      return;
    }
    // CONFIRMED / REJECTED / REFUNDED: a replay of something already handled.
    this.logger.warn(
      { registrationId: r.id, status: current.status },
      'Ignoring capture for a settled registration',
    );
  }

  /** FR-HS-06: the competition goes public once its prize pool is captured. */
  private async fundingCaptured(tx: Tx, p: EventPayload<'payment.captured'>): Promise<void> {
    const c = await tx.competition.findUnique({ where: { id: p.referenceId } });
    if (!c) {
      this.logger.error({ orderId: p.orderId }, 'Captured funding for an unknown competition');
      return;
    }
    const { count } = await tx.competition.updateMany({
      where: {
        id: c.id,
        status: 'AWAITING_FUNDING',
        fundingOrderId: p.orderId,
        prizePoolPaise: p.amountPaise,
      },
      data: { status: 'PUBLISHED', publishedAt: new Date(), fundingError: null },
    });
    if (count === 1) {
      await tx.outboxEvent.create({
        data: outbox(
          'competition.published',
          { type: 'competition', id: c.id },
          {
            competitionId: c.id,
            hostId: c.hostId,
            title: c.title ?? 'Competition',
          },
        ),
      });
      return;
    }
    if (c.status === 'PUBLISHED' && c.fundingOrderId === p.orderId) return; // duplicate
    // Cancelled, abandoned, or re-priced since this order was created: give the money back.
    await tx.outboxEvent.create({
      data: outbox(
        'competition.funding_rejected',
        { type: 'competition', id: c.id },
        {
          competitionId: c.id,
          hostId: c.hostId,
          orderId: p.orderId,
        },
      ),
    });
  }
}
