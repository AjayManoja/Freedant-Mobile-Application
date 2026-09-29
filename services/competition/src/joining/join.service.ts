import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError, notFound, uuidv7 } from '@feedants/server-kit';
import { feeBreakdown, isRegistrationOpen, type JoinResponse, type RegistrationView } from '@feedants/shared';
import { RULES, type Rules } from '../config';
import type { Registration } from '../generated/prisma/client';
import { outbox } from '../outbox';
import { PaymentGateway } from '../payment-gateway';
import { PrismaService } from '../prisma.service';
import { toRegistrationView, windows } from '../views';
import { DiscoveryService } from '../discovery/discovery.service';

const isUniqueViolation = (err: unknown, target?: string) =>
  (err as { code?: string }).code === 'P2002' &&
  (!target || JSON.stringify((err as { meta?: unknown }).meta ?? '').includes(target));

@Injectable()
export class JoinService {
  private readonly logger = new Logger(JoinService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentGateway,
    private readonly discovery: DiscoveryService,
    @Inject(RULES) private readonly rules: Rules,
  ) {}

  /**
   * FR-PT-01..07 / US-19..23. One spot is claimed with a conditional UPDATE in the same
   * transaction that creates the registration, so the last spot can go to exactly one
   * creator (NFR-RL-01). The client's Idempotency-Key makes retries return the original
   * result instead of a second hold or charge (FR-PT-07).
   */
  async join(creatorId: string, competitionId: string, idempotencyKey: string): Promise<JoinResponse> {
    const existing = await this.prisma.registration.findUnique({ where: { idempotencyKey } });
    if (existing) return this.replay(existing, creatorId, competitionId);

    const c = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (!c || !c.publishedAt) throw notFound('Competition');
    if (c.hostId === creatorId) throw new AppError('HOST_CANNOT_JOIN', "You can't join your own competition");
    if (c.status !== 'PUBLISHED' || !isRegistrationOpen(windows(c), new Date())) {
      throw new AppError('REGISTRATION_CLOSED', 'Registration is not open');
    }

    // Tell an existing participant why Join is disabled (US-19) before spots are considered;
    // the partial unique index still decides any race between two tabs.
    const active = await this.prisma.registration.count({
      where: { competitionId, creatorId, status: { in: ['HELD', 'CONFIRMED'] } },
    });
    if (active > 0) throw new AppError('ALREADY_REGISTERED', 'You have already joined this competition');

    const free = (c.entryFeePaise ?? 0) === 0;
    const fees = feeBreakdown(c.entryFeePaise ?? 0, this.rules.platformFeePercent);
    const amountPaise =
      c.platformFeePaise !== null ? fees.entryFeePaise + c.platformFeePaise : fees.totalPaise;
    const now = new Date();
    const id = uuidv7();

    let registration: Registration;
    try {
      registration = await this.prisma.$transaction(async (tx) => {
        const taken = await tx.$executeRaw`
          UPDATE competitions
             SET spots_remaining = spots_remaining - 1,
                 confirmed_count = confirmed_count + ${free ? 1 : 0},
                 updated_at = now()
           WHERE id = ${competitionId}::uuid
             AND status = 'PUBLISHED'
             AND spots_remaining > 0`;
        if (taken === 0) throw new AppError('NO_SPOTS_LEFT', 'No spots left');

        const r = await tx.registration.create({
          data: {
            id,
            competitionId,
            creatorId,
            idempotencyKey,
            amountPaise: free ? 0 : amountPaise,
            status: free ? 'CONFIRMED' : 'HELD',
            confirmedAt: free ? now : null,
            holdExpiresAt: free ? null : new Date(now.getTime() + this.rules.holdTtlMinutes * 60_000),
          },
        });
        await tx.outboxEvent.create({
          data: free
            ? outbox(
                'registration.confirmed',
                { type: 'registration', id },
                {
                  registrationId: id,
                  competitionId,
                  competitionTitle: c.title ?? 'Competition',
                  creatorId,
                },
              )
            : outbox(
                'registration.held',
                { type: 'registration', id },
                {
                  registrationId: id,
                  competitionId,
                  creatorId,
                  holdExpiresAt: r.holdExpiresAt!.toISOString(),
                },
              ),
        });
        return r;
      });
    } catch (err) {
      if (isUniqueViolation(err, 'idempotency_key')) {
        // A concurrent retry with the same key won the race; return its result.
        const winner = await this.prisma.registration.findUniqueOrThrow({ where: { idempotencyKey } });
        return this.replay(winner, creatorId, competitionId);
      }
      if (isUniqueViolation(err))
        throw new AppError('ALREADY_REGISTERED', 'You have already joined this competition');
      throw err;
    }

    await this.discovery.invalidateHome();
    if (free) return { registration: toRegistrationView(registration) };
    return { registration: await this.createOrder(registration, c.id) };
  }

  async get(creatorId: string, registrationId: string): Promise<RegistrationView> {
    const r = await this.prisma.registration.findUnique({ where: { id: registrationId } });
    if (!r || r.creatorId !== creatorId) throw notFound('Registration');
    return toRegistrationView(r);
  }

  private async replay(
    existing: Registration,
    creatorId: string,
    competitionId: string,
  ): Promise<JoinResponse> {
    if (existing.creatorId !== creatorId || existing.competitionId !== competitionId) {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was used for a different request');
    }
    // A hold whose order creation never completed (e.g. crash) gets its order now.
    if (existing.status === 'HELD' && !existing.paymentOrderId) {
      return { registration: await this.createOrder(existing, competitionId) };
    }
    return { registration: toRegistrationView(existing) };
  }

  /** Paid join: the hold exists; ask Payment for the order, or give the spot back if it can't. */
  private async createOrder(r: Registration, competitionId: string): Promise<RegistrationView> {
    const c = await this.prisma.competition.findUniqueOrThrow({ where: { id: competitionId } });
    try {
      const order = await this.payments.createOrder({
        purpose: 'ENTRY_FEE',
        referenceId: r.id,
        competitionId,
        payerId: r.creatorId,
        amountPaise: r.amountPaise,
        platformFeePaise: r.amountPaise - (c.entryFeePaise ?? 0),
        idempotencyKey: r.idempotencyKey,
      });
      const updated = await this.prisma.registration.update({
        where: { id: r.id },
        data: {
          paymentOrderId: order.orderId,
          providerOrderId: order.providerOrderId,
          paymentKeyId: order.keyId,
        },
      });
      return toRegistrationView(updated);
    } catch (err) {
      await this.releaseHold(r.id);
      throw err;
    }
  }

  private async releaseHold(registrationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const released = await tx.registration.updateMany({
        where: { id: registrationId, status: 'HELD' },
        data: { status: 'EXPIRED' },
      });
      if (released.count === 0) return;
      const r = await tx.registration.findUniqueOrThrow({ where: { id: registrationId } });
      await tx.$executeRaw`UPDATE competitions SET spots_remaining = spots_remaining + 1 WHERE id = ${r.competitionId}::uuid AND status = 'PUBLISHED'`;
      await tx.outboxEvent.create({
        data: outbox(
          'registration.expired',
          { type: 'registration', id: r.id },
          {
            registrationId: r.id,
            competitionId: r.competitionId,
          },
        ),
      });
    });
    this.logger.warn({ registrationId }, 'Released hold after failed order creation');
  }
}
