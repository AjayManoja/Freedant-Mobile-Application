import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { claimInbox, EventBus, parseEvent } from '@feedants/server-kit';
import type { EventEnvelope, EventPayload } from '@feedants/shared';
import { escrow, LedgerService, wallet } from '../ledger/ledger.service';
import { PrismaService, type Tx } from '../prisma.service';
import { RefundsService } from '../refunds/refunds.service';

const CONSUMER = 'payment.competition-events';

/**
 * Money side of the competition sagas (HLD §5.4–5.5): refunds for rejected and cancelled
 * entries, escrow return on cancellation, and payouts when results are published.
 */
@Injectable()
export class CompetitionEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(CompetitionEventsConsumer.name);

  constructor(
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly refunds: RefundsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.subscribe({
      queue: CONSUMER,
      routingKeys: [
        'registration.rejected',
        'competition.funding_rejected',
        'competition.cancelled',
        'competition.results_published',
      ],
      handler: (e) => this.handle(e),
    });
  }

  async handle(event: EventEnvelope): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        if (!(await claimInbox(tx, event.id, CONSUMER))) return;
        switch (event.type) {
          case 'registration.rejected':
            // US-22: payment captured after the spot was gone — full refund.
            await this.refunds.request(
              tx,
              parseEvent(event, 'registration.rejected').orderId,
              'LATE_CAPTURE_REJECTED',
            );
            return;
          case 'competition.funding_rejected':
            await this.refunds.request(
              tx,
              parseEvent(event, 'competition.funding_rejected').orderId,
              'FUNDING_REJECTED',
            );
            return;
          case 'competition.cancelled':
            return this.cancelled(tx, parseEvent(event, 'competition.cancelled'));
          case 'competition.results_published':
            return this.resultsPublished(tx, parseEvent(event, 'competition.results_published'));
        }
      },
      { timeout: 30_000 },
    );
    // Push refunds out now rather than waiting for the next worker tick.
    if (event.type !== 'competition.results_published') {
      await this.refunds
        .sendPending()
        .catch((err) => this.logger.warn({ err }, 'Immediate refund send failed'));
    }
  }

  /** FR-HS-09 / US-17: refund every paid entry, then return the rest of escrow to the host. */
  private async cancelled(tx: Tx, p: EventPayload<'competition.cancelled'>): Promise<void> {
    for (const r of p.confirmedRegistrations) {
      if (r.orderId) await this.refunds.request(tx, r.orderId, 'CANCELLATION');
    }
    const remaining = await this.ledger.balance(tx, escrow(p.competitionId));
    if (remaining > 0) {
      await this.ledger.post(tx, {
        kind: 'ESCROW_RETURN',
        referenceId: p.competitionId,
        subjectUserId: p.hostId,
        competitionId: p.competitionId,
        displayAmountPaise: remaining,
        description: `Prize pool returned: ${p.title}`,
        entries: [
          { account: escrow(p.competitionId), amountPaise: -remaining },
          { account: wallet(p.hostId), amountPaise: remaining },
        ],
      });
    }
  }

  /** FR-PY-05, FR-JG-04, A-10: winners paid from escrow; the rest goes to the host. */
  private async resultsPublished(tx: Tx, p: EventPayload<'competition.results_published'>): Promise<void> {
    const pot = escrow(p.competitionId);
    const due =
      p.winners.reduce((s, w) => s + w.amountPaise, 0) + p.unawardedAmountPaise + p.hostRevenuePaise;
    const held = await this.ledger.balance(tx, pot);
    if (held < due) {
      // Throwing retries the event and finally dead-letters it: never pay out money we don't hold.
      throw new Error(`Escrow for ${p.competitionId} holds ${held} paise but results need ${due}`);
    }
    for (const w of p.winners) {
      await this.ledger.post(tx, {
        kind: 'PRIZE',
        referenceId: w.registrationId,
        subjectUserId: w.creatorId,
        competitionId: p.competitionId,
        displayAmountPaise: w.amountPaise,
        description: `Prize — rank ${w.rank} in ${p.title}`,
        entries: [
          { account: pot, amountPaise: -w.amountPaise },
          { account: wallet(w.creatorId), amountPaise: w.amountPaise },
        ],
      });
    }
    const toHost = [
      {
        kind: 'UNAWARDED_RETURN' as const,
        amount: p.unawardedAmountPaise,
        text: `Unawarded prizes returned: ${p.title}`,
      },
      { kind: 'HOST_REVENUE' as const, amount: p.hostRevenuePaise, text: `Entry fees earned: ${p.title}` },
    ];
    for (const h of toHost) {
      if (h.amount === 0) continue;
      await this.ledger.post(tx, {
        kind: h.kind,
        referenceId: p.competitionId,
        subjectUserId: p.hostId,
        competitionId: p.competitionId,
        displayAmountPaise: h.amount,
        description: h.text,
        entries: [
          { account: pot, amountPaise: -h.amount },
          { account: wallet(p.hostId), amountPaise: h.amount },
        ],
      });
    }
    const left = await this.ledger.balance(tx, pot);
    if (left !== 0)
      this.logger.warn({ competitionId: p.competitionId, left }, 'Escrow not empty after payout');
  }
}
