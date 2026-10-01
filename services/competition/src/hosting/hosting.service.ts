import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError, extensionFor, notFound, ObjectStorage, uuidv7 } from '@feedants/server-kit';
import {
  computePrizeTiers,
  deriveTimeline,
  type DraftUpdateInput,
  draftIssues,
  type HostedCompetition,
  type HostedFilter,
  type HostedQuery,
  type HostedSummary,
  type ImageUploadRequest,
  type Page,
  platformFee,
  type PublishResponse,
  type UploadUrlResponse,
} from '@feedants/shared';
import { RULES, type Rules } from '../config';
import type { Competition, Prisma } from '../generated/prisma/client';
import { outbox } from '../outbox';
import { PaymentGateway } from '../payment-gateway';
import { PrismaService, type Tx } from '../prisma.service';
import { decodeCursor, encodeCursor, iso, loadProfiles, toSummary } from '../views';
import { DiscoveryService } from '../discovery/discovery.service';

const coverPrefix = (competitionId: string) => `public/covers/${competitionId}/`;
const DESCRIPTIVE_FIELDS = new Set(['title', 'categoryId', 'description', 'coverKey']);

@Injectable()
export class HostingService {
  private readonly logger = new Logger(HostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage,
    private readonly payments: PaymentGateway,
    private readonly discovery: DiscoveryService,
    @Inject(RULES) private readonly rules: Rules,
  ) {}

  /** FR-HS-01/05: a draft can be started from any wizard step and resumed later. */
  async createDraft(hostId: string, input: DraftUpdateInput) {
    const id = uuidv7();
    const data = await this.draftData(id, input);
    await this.prisma.competition.create({ data: { ...data, id, hostId, status: 'DRAFT' } });
    return this.discovery.detail(id, hostId);
  }

  async update(hostId: string, id: string, input: DraftUpdateInput) {
    await this.prisma.$transaction(async (tx) => {
      // Row lock: serialises with joins (which update the same row), so the
      // "no registrations yet" check below can't race a first join (FR-HS-08).
      const c = await this.lockOwned(tx, hostId, id);
      if (c.status === 'DRAFT') {
        const data = await this.draftData(id, input, tx);
        // A prize or schedule change invalidates any abandoned funding order.
        await tx.competition.update({ where: { id }, data: { ...data, fundingOrderId: null } });
        return;
      }
      if (c.status !== 'PUBLISHED') {
        throw new AppError('COMPETITION_NOT_EDITABLE', 'This competition can no longer be edited');
      }
      const locked = Object.keys(input).filter((k) => !DESCRIPTIVE_FIELDS.has(k));
      if (locked.length > 0) {
        throw new AppError(
          'COMPETITION_NOT_EDITABLE',
          'Prize, fee and schedule are fixed once the competition is funded',
          { fields: locked },
        );
      }
      const registrations = await tx.registration.count({
        where: { competitionId: id, status: { in: ['HELD', 'CONFIRMED'] } },
      });
      if (registrations > 0) {
        throw new AppError('COMPETITION_NOT_EDITABLE', 'Details are locked once someone has joined');
      }
      await tx.competition.update({ where: { id }, data: await this.draftData(id, input, tx) });
    });
    await this.discovery.invalidateHome();
    return this.discovery.detail(id, hostId);
  }

  async coverUploadUrl(hostId: string, id: string, req: ImageUploadRequest): Promise<UploadUrlResponse> {
    const c = await this.owned(hostId, id);
    if (c.status === 'CANCELLED' || c.status === 'RESULTS_PUBLISHED') {
      throw new AppError('COMPETITION_NOT_EDITABLE', 'This competition can no longer be edited');
    }
    const max = this.rules.media.IMAGE.maxBytes;
    if (req.sizeBytes > max) throw new AppError('VALIDATION_FAILED', 'Image is too large', { maxBytes: max });
    const key = `${coverPrefix(id)}${uuidv7()}.${extensionFor(req.contentType)}`;
    return this.storage.presignUpload({ key, contentType: req.contentType, maxBytes: max });
  }

  /**
   * FR-HS-06: publishing = fund the prize pool. The competition becomes public only when
   * Payment reports the capture (`payment.captured`, see PaymentEventsConsumer).
   */
  async publish(hostId: string, id: string, idempotencyKey: string): Promise<PublishResponse> {
    const now = new Date();
    const c = await this.owned(hostId, id);

    if (c.status === 'AWAITING_FUNDING' && c.fundingOrderId && c.fundingProviderOrder && c.fundingKeyId) {
      // Reopening checkout for the pending order (e.g. after closing the payment sheet).
      return {
        competition: await this.discovery.detail(id, hostId),
        checkout: {
          orderId: c.fundingOrderId,
          providerOrderId: c.fundingProviderOrder,
          amountPaise: c.prizePoolPaise!,
          currency: 'INR',
          keyId: c.fundingKeyId,
        },
      };
    }
    if (c.status !== 'DRAFT') throw new AppError('COMPETITION_INVALID_STATE', 'Only drafts can be published');

    const issues = draftIssues(c, now, this.rules);
    if (issues.length > 0) throw new AppError('VALIDATION_FAILED', 'The competition is not complete', issues);

    const timeline = deriveTimeline(c.startAt!, c.durationDays!, this.rules.schedule);
    const tiers = computePrizeTiers(c.prizePoolPaise!, this.rules.prizeTiers, this.rules.prizeRoundingPaise);
    const orderKey = `fund:${id}:${idempotencyKey}`;

    const claimed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.competition.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          status: 'AWAITING_FUNDING',
          ...timeline,
          platformFeePaise: platformFee(c.entryFeePaise!, this.rules.platformFeePercent),
          spotsRemaining: c.maxSpots!,
          fundingIdempotencyKey: orderKey,
          fundingRequestedAt: now,
          fundingError: null,
          fundingOrderId: null,
        },
      });
      if (count === 0) return false;
      await tx.prizeTier.deleteMany({ where: { competitionId: id } });
      await tx.prizeTier.createMany({ data: tiers.map((t) => ({ competitionId: id, ...t })) });
      return true;
    });
    if (!claimed) throw new AppError('COMPETITION_INVALID_STATE', 'Publishing is already in progress');

    try {
      const order = await this.payments.createOrder({
        purpose: 'PRIZE_FUNDING',
        referenceId: id,
        competitionId: id,
        payerId: hostId,
        amountPaise: c.prizePoolPaise!,
        platformFeePaise: 0,
        idempotencyKey: orderKey,
        ...(c.title ? { title: c.title } : {}),
      });
      await this.prisma.competition.update({
        where: { id },
        data: {
          fundingOrderId: order.orderId,
          fundingProviderOrder: order.providerOrderId,
          fundingKeyId: order.keyId,
        },
      });
      return {
        competition: await this.discovery.detail(id, hostId),
        checkout: {
          orderId: order.orderId,
          providerOrderId: order.providerOrderId,
          amountPaise: order.amountPaise,
          currency: 'INR',
          keyId: order.keyId,
        },
      };
    } catch (err) {
      await this.prisma.competition.updateMany({
        where: { id, status: 'AWAITING_FUNDING', fundingOrderId: null },
        data: { status: 'DRAFT' },
      });
      throw err;
    }
  }

  /** SRS §2.5 AWAITING_FUNDING → DRAFT when the host abandons funding. */
  async abandonFunding(hostId: string, id: string) {
    const c = await this.owned(hostId, id);
    if (c.status !== 'AWAITING_FUNDING')
      throw new AppError('COMPETITION_INVALID_STATE', 'No funding in progress');
    await this.prisma.competition.updateMany({
      where: { id, status: 'AWAITING_FUNDING' },
      data: { status: 'DRAFT', fundingOrderId: null, fundingError: null },
    });
    return this.discovery.detail(id, hostId);
  }

  /**
   * FR-HS-09 / US-17: cancel before results. Confirmed entrants are refunded and the escrowed
   * pool returns to the host's wallet — both done by Payment from `competition.cancelled`.
   */
  async cancel(hostId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const c = await this.lockOwned(tx, hostId, id);
      if (c.status === 'CANCELLED') return;
      if (c.status === 'RESULTS_PUBLISHED') {
        throw new AppError('COMPETITION_INVALID_STATE', 'Results are already published');
      }
      const now = new Date();
      if (c.status === 'PUBLISHED') {
        const confirmed = await tx.registration.findMany({
          where: { competitionId: id, status: 'CONFIRMED' },
          select: { id: true, creatorId: true, paymentOrderId: true },
        });
        await tx.registration.updateMany({
          where: { competitionId: id, status: 'CONFIRMED' },
          data: { status: 'REFUNDED' },
        });
        // Unpaid holds just lapse; a payment captured for one later is refunded as a late capture.
        await tx.registration.updateMany({
          where: { competitionId: id, status: 'HELD' },
          data: { status: 'EXPIRED' },
        });
        await tx.competition.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: now } });
        await tx.outboxEvent.create({
          data: outbox(
            'competition.cancelled',
            { type: 'competition', id },
            {
              competitionId: id,
              hostId,
              title: c.title ?? 'Competition',
              confirmedRegistrations: confirmed.map((r) => ({
                registrationId: r.id,
                creatorId: r.creatorId,
                orderId: r.paymentOrderId,
              })),
            },
          ),
        });
        return;
      }
      // DRAFT or AWAITING_FUNDING: nothing was published. A funding capture that still
      // arrives is refunded (competition.funding_rejected).
      await tx.competition.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: now } });
    });
    await this.discovery.invalidateHome();
    return this.discovery.detail(id, hostId);
  }

  /** FR-HS-10 / US-18. */
  async hosted(hostId: string, q: HostedQuery): Promise<Page<HostedCompetition>> {
    const { cursor, limit } = q;
    const now = new Date();
    const after = decodeCursor(cursor);
    if (cursor && !after) throw new AppError('VALIDATION_FAILED', 'Invalid cursor');
    const and: Prisma.CompetitionWhereInput[] = [{ hostId }];
    if (q.filter) and.push(hostedFilter(q.filter, now));
    if (after) {
      const at = new Date(String(after[0]));
      and.push({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: after[1] } }] });
    }
    const where: Prisma.CompetitionWhereInput = { AND: and };
    const rows = await this.prisma.competition.findMany({
      where,
      include: { category: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const profiles = await loadProfiles(this.prisma, [hostId]);
    const items = page.map((c) => ({
      ...toSummary(c, profiles, now),
      registrations: c.confirmedCount,
      submissions: c.submissionCount,
      // A cancelled competition refunds every entry in full (US-17).
      entryRevenuePaise: c.status === 'CANCELLED' ? 0 : (c.entryFeePaise ?? 0) * c.confirmedCount,
      resultsDueAt: iso(c.resultsDueAt),
      overdue: c.status === 'PUBLISHED' && !!c.resultsDueAt && now > c.resultsDueAt,
      createdAt: c.createdAt.toISOString(),
    }));
    const last = page.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt.toISOString(), last.id) : null,
    };
  }

  /** US-18: the dashboard overview and the counts behind its filter chips. */
  async hostedSummary(hostId: string): Promise<HostedSummary> {
    const now = new Date();
    const count = (filter?: HostedFilter) =>
      this.prisma.competition.count({
        where: { AND: [{ hostId }, filter ? hostedFilter(filter, now) : {}] },
      });
    const [all, live, judging, draft, closed, funded] = await Promise.all([
      count(),
      count('LIVE'),
      count('JUDGING'),
      count('DRAFT'),
      count('CLOSED'),
      this.prisma.competition.findMany({
        where: { hostId, status: { in: ['PUBLISHED', 'RESULTS_PUBLISHED'] } },
        select: { entryFeePaise: true, confirmedCount: true },
      }),
    ]);
    return {
      counts: { ALL: all, LIVE: live, JUDGING: judging, DRAFT: draft, CLOSED: closed },
      totalEntries: funded.reduce((n, c) => n + c.confirmedCount, 0),
      revenuePaise: funded.reduce((n, c) => n + (c.entryFeePaise ?? 0) * c.confirmedCount, 0),
    };
  }

  // ---------------------------------------------------------------- helpers

  private async owned(hostId: string, id: string): Promise<Competition> {
    const c = await this.prisma.competition.findUnique({ where: { id } });
    // Someone else's competition is indistinguishable from a missing one (no ID probing).
    if (!c || c.hostId !== hostId) throw notFound('Competition');
    return c;
  }

  private async lockOwned(tx: Tx, hostId: string, id: string): Promise<Competition> {
    await tx.$queryRaw`SELECT id FROM competitions WHERE id = ${id}::uuid FOR UPDATE`;
    const c = await tx.competition.findUnique({ where: { id } });
    if (!c || c.hostId !== hostId) throw notFound('Competition');
    return c;
  }

  private async draftData(id: string, input: DraftUpdateInput, db: PrismaService | Tx = this.prisma) {
    const data: Prisma.CompetitionUncheckedUpdateInput & Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description || null;
    if (input.categoryId !== undefined) {
      const exists = await db.category.findUnique({ where: { id: input.categoryId } });
      if (!exists) throw new AppError('VALIDATION_FAILED', 'Unknown category');
      data.categoryId = input.categoryId;
    }
    if (input.coverKey !== undefined) {
      if (input.coverKey === null) {
        data.coverKey = null;
        data.coverUrl = null;
      } else {
        if (!input.coverKey.startsWith(coverPrefix(id))) {
          throw new AppError('FORBIDDEN', 'That upload does not belong to this competition');
        }
        if (!(await this.storage.exists(input.coverKey))) {
          throw new AppError('VALIDATION_FAILED', 'Cover upload not found; upload it first');
        }
        data.coverKey = input.coverKey;
        data.coverUrl = this.storage.publicUrl(input.coverKey);
      }
    }
    if (input.prizePoolPaise !== undefined) data.prizePoolPaise = input.prizePoolPaise;
    if (input.entryFeePaise !== undefined) data.entryFeePaise = input.entryFeePaise;
    if (input.startAt !== undefined) data.startAt = new Date(input.startAt);
    if (input.durationDays !== undefined) data.durationDays = input.durationDays;
    if (input.maxSpots !== undefined) data.maxSpots = input.maxSpots;
    return data as Prisma.CompetitionUncheckedCreateInput;
  }
}

/** The dashboard buckets as a query; Live and Judging split on the submission deadline (SRS §2.5). */
function hostedFilter(filter: HostedFilter, now: Date): Prisma.CompetitionWhereInput {
  switch (filter) {
    case 'DRAFT':
      return { status: { in: ['DRAFT', 'AWAITING_FUNDING'] } };
    case 'LIVE':
      return { status: 'PUBLISHED', submissionEndsAt: { gt: now } };
    case 'JUDGING':
      return { status: 'PUBLISHED', submissionEndsAt: { lte: now } };
    case 'CLOSED':
      return { status: { in: ['RESULTS_PUBLISHED', 'CANCELLED'] } };
  }
}
