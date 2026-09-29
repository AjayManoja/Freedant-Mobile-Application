import { Injectable } from '@nestjs/common';
import { AppError, notFound, ObjectStorage } from '@feedants/server-kit';
import { isJudging, type JudgingEntry, type Leaderboard, type ScoreInput } from '@feedants/shared';
import type { Competition } from '../generated/prisma/client';
import { outbox } from '../outbox';
import { PrismaService, type Tx } from '../prisma.service';
import { loadProfiles, profileOf, windows } from '../views';
import { DiscoveryService } from '../discovery/discovery.service';

@Injectable()
export class JudgingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage,
    private readonly discovery: DiscoveryService,
  ) {}

  /** FR-JG-01 / US-27. */
  async entries(hostId: string, competitionId: string): Promise<JudgingEntry[]> {
    const c = await this.hostedCompetition(hostId, competitionId);
    this.assertJudgingPhase(c);
    const rows = await this.prisma.submission.findMany({
      where: { competitionId, status: 'SUBMITTED' },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    });
    const profiles = await loadProfiles(
      this.prisma,
      rows.map((r) => r.creatorId),
    );
    return Promise.all(
      rows.map(async (s) => ({
        submissionId: s.id,
        creator: profileOf(profiles, s.creatorId),
        mediaType: s.mediaKind,
        mediaContentType: s.mediaContentType,
        mediaUrl: s.mediaKey ? await this.storage.presignRead(s.mediaKey) : null,
        caption: s.caption,
        submittedAt: s.submittedAt!.toISOString(),
        score: s.scoreTenths === null ? null : s.scoreTenths / 10,
        comment: s.scoreComment,
      })),
    );
  }

  /** FR-JG-02: 0–10 with one decimal, stored exactly as tenths. */
  async score(hostId: string, submissionId: string, input: ScoreInput): Promise<JudgingEntry> {
    const s = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { competition: true },
    });
    // Not the host: indistinguishable from not found (US-27).
    if (!s || s.competition.hostId !== hostId || s.status !== 'SUBMITTED') throw notFound('Submission');
    if (s.competition.status !== 'PUBLISHED')
      throw new AppError('COMPETITION_INVALID_STATE', 'Results are final');
    this.assertJudgingPhase(s.competition);
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        scoreTenths: Math.round(input.score * 10),
        scoreComment: input.comment ?? null,
        scoredAt: new Date(),
      },
    });
    const all = await this.entries(hostId, s.competitionId);
    return all.find((e) => e.submissionId === submissionId)!;
  }

  /**
   * FR-JG-03..05, FR-PY-05 / US-28. Ranking, prize assignment and the payout instruction
   * are one transaction; Payment moves the money from escrow when it consumes
   * `competition.results_published`.
   */
  async publishResults(hostId: string, competitionId: string): Promise<Leaderboard> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM competitions WHERE id = ${competitionId}::uuid FOR UPDATE`;
      const c = await tx.competition.findUnique({
        where: { id: competitionId },
        include: { prizeTiers: true },
      });
      if (!c || c.hostId !== hostId) throw notFound('Competition');
      if (c.status === 'RESULTS_PUBLISHED') return; // idempotent
      if (c.status !== 'PUBLISHED')
        throw new AppError('COMPETITION_INVALID_STATE', 'This competition has no results to publish');
      this.assertJudgingPhase(c);

      const submissions = await tx.submission.findMany({ where: { competitionId, status: 'SUBMITTED' } });
      const unscored = submissions.filter((s) => s.scoreTenths === null).length;
      if (unscored > 0) {
        throw new AppError('UNSCORED_SUBMISSIONS', `Score every entry first (${unscored} left)`, {
          unscored,
        });
      }

      // A-28: ties go to the earlier submission.
      const ranked = [...submissions].sort(
        (a, b) => b.scoreTenths! - a.scoreTenths! || a.submittedAt!.getTime() - b.submittedAt!.getTime(),
      );
      const tiers = [...c.prizeTiers].sort((a, b) => a.rank - b.rank);
      const winners = ranked
        .slice(0, tiers.length)
        .map((s, i) => ({ submission: s, rank: i + 1, amount: tiers[i]!.amountPaise }));
      // A-29: tiers nobody could win go back to the host.
      const unawarded = tiers.slice(winners.length).reduce((sum, t) => sum + t.amountPaise, 0);

      for (const [i, s] of ranked.entries()) {
        const win = winners[i];
        await tx.submission.update({
          where: { id: s.id },
          data: { rank: i + 1, prizePaise: win?.amount ?? 0 },
        });
      }
      const confirmed = await tx.registration.findMany({
        where: { competitionId, status: 'CONFIRMED' },
        select: { creatorId: true },
      });
      await tx.competition.update({
        where: { id: competitionId },
        data: { status: 'RESULTS_PUBLISHED', resultsPublishedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: outbox(
          'competition.results_published',
          { type: 'competition', id: competitionId },
          {
            competitionId,
            hostId,
            title: c.title ?? 'Competition',
            winners: winners.map((w) => ({
              rank: w.rank,
              registrationId: w.submission.registrationId,
              creatorId: w.submission.creatorId,
              amountPaise: w.amount,
            })),
            unawardedAmountPaise: unawarded,
            // A-10: entry fees (excluding the platform fee) reach the host now.
            hostRevenuePaise: (c.entryFeePaise ?? 0) * confirmed.length,
            allRegistrationCreatorIds: [...new Set(confirmed.map((r) => r.creatorId))],
          },
        ),
      });
    });
    await this.discovery.invalidateHome();
    return this.leaderboard(competitionId);
  }

  /** FR-JG-05: public once results are published. */
  async leaderboard(competitionId: string): Promise<Leaderboard> {
    const c = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (!c || c.status !== 'RESULTS_PUBLISHED') throw notFound('Results');
    const rows = await this.prisma.submission.findMany({
      where: { competitionId, status: 'SUBMITTED', rank: { not: null } },
      orderBy: { rank: 'asc' },
    });
    const profiles = await loadProfiles(
      this.prisma,
      rows.map((r) => r.creatorId),
    );
    return {
      competitionId,
      title: c.title ?? 'Competition',
      resultsPublishedAt: c.resultsPublishedAt!.toISOString(),
      entries: rows.map((s) => ({
        rank: s.rank!,
        submissionId: s.id,
        creator: profileOf(profiles, s.creatorId),
        score: s.scoreTenths! / 10,
        prizePaise: s.prizePaise,
      })),
    };
  }

  private async hostedCompetition(
    hostId: string,
    competitionId: string,
    db: PrismaService | Tx = this.prisma,
  ) {
    const c = await db.competition.findUnique({ where: { id: competitionId } });
    if (!c || c.hostId !== hostId) throw notFound('Competition');
    if (c.status !== 'PUBLISHED' && c.status !== 'RESULTS_PUBLISHED') {
      throw new AppError('COMPETITION_INVALID_STATE', 'This competition has no entries to judge');
    }
    return c;
  }

  private assertJudgingPhase(c: Competition): void {
    if (!isJudging(windows(c), new Date())) {
      throw new AppError('NOT_JUDGING_PHASE', 'Judging opens when submissions close');
    }
  }
}
