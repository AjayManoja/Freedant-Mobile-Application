import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ENV } from '@feedants/server-kit';
import type { CompetitionEnv } from '../config';
import { outbox } from '../outbox';
import { PrismaService } from '../prisma.service';

/**
 * Time-driven transitions. Each sweep claims rows with FOR UPDATE SKIP LOCKED and applies
 * conditional updates, so running several service instances is safe (NFR-SL-01).
 */
@Injectable()
export class SweepsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SweepsService.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: CompetitionEnv,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.env.SWEEPS_ENABLED) return;
    this.every(this.env.HOLD_SWEEP_INTERVAL_MS, () => this.expireHolds());
    this.every(this.env.OPENING_SWEEP_INTERVAL_MS, () => this.announceOpenings());
    this.every(this.env.FUNDING_SWEEP_INTERVAL_MS, () => this.revertAbandonedFunding());
  }

  onApplicationShutdown(): void {
    this.timers.forEach(clearInterval);
  }

  private every(ms: number, job: () => Promise<number>): void {
    const timer = setInterval(() => {
      job().catch((err) => this.logger.error({ err }, 'Sweep failed'));
    }, ms);
    timer.unref();
    this.timers.push(timer);
  }

  /** FR-PT-06 / US-21: an unpaid hold past its TTL frees the spot for someone else. */
  async expireHolds(now = new Date(), batch = 200): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.$queryRaw<{ id: string; competition_id: string }[]>`
        UPDATE registrations r
           SET status = 'EXPIRED', updated_at = now()
          FROM (SELECT id FROM registrations
                 WHERE status = 'HELD' AND hold_expires_at < ${now}
                 ORDER BY hold_expires_at
                 LIMIT ${batch}
                 FOR UPDATE SKIP LOCKED) due
         WHERE r.id = due.id
        RETURNING r.id, r.competition_id`;
      const perCompetition = new Map<string, number>();
      for (const row of expired)
        perCompetition.set(row.competition_id, (perCompetition.get(row.competition_id) ?? 0) + 1);
      for (const [competitionId, n] of perCompetition) {
        await tx.$executeRaw`
          UPDATE competitions SET spots_remaining = spots_remaining + ${n}
           WHERE id = ${competitionId}::uuid AND status = 'PUBLISHED'`;
      }
      for (const row of expired) {
        await tx.outboxEvent.create({
          data: outbox(
            'registration.expired',
            { type: 'registration', id: row.id },
            {
              registrationId: row.id,
              competitionId: row.competition_id,
            },
          ),
        });
      }
      if (expired.length > 0) this.logger.log({ count: expired.length }, 'Expired unpaid holds');
      return expired.length;
    });
  }

  /** FR-DS-07 / US-12: tell "Notify me" subscribers once registration opens. */
  async announceOpenings(now = new Date(), batch = 50): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const due = await tx.$queryRaw<{ id: string; title: string | null }[]>`
        UPDATE competitions c
           SET registration_opened_notified_at = ${now}
          FROM (SELECT id FROM competitions
                 WHERE status = 'PUBLISHED'
                   AND registration_opened_notified_at IS NULL
                   AND registration_opens_at <= ${now}
                 LIMIT ${batch}
                 FOR UPDATE SKIP LOCKED) d
         WHERE c.id = d.id
        RETURNING c.id, c.title`;
      for (const c of due) {
        const subs = await tx.notifySubscription.findMany({
          where: { competitionId: c.id },
          select: { userId: true },
        });
        if (subs.length === 0) continue;
        await tx.outboxEvent.create({
          data: outbox(
            'competition.registration_opened',
            { type: 'competition', id: c.id },
            {
              competitionId: c.id,
              title: c.title ?? 'Competition',
              subscriberUserIds: subs.map((s) => s.userId),
            },
          ),
        });
      }
      return due.length;
    });
  }

  /** SRS §2.5 AWAITING_FUNDING → DRAFT when checkout is abandoned. */
  async revertAbandonedFunding(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.env.FUNDING_TIMEOUT_MINUTES * 60_000);
    const { count } = await this.prisma.competition.updateMany({
      where: { status: 'AWAITING_FUNDING', fundingRequestedAt: { lt: cutoff } },
      data: { status: 'DRAFT', fundingOrderId: null, fundingError: 'Payment was not completed' },
    });
    return count;
  }
}
