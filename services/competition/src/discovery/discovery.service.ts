import { Inject, Injectable } from '@nestjs/common';
import { AppError, ENV, notFound, REDIS } from '@feedants/server-kit';
import {
  type CategoryListing,
  type CompetitionDetail,
  type CompetitionSummary,
  type HomeResponse,
  type ListQuery,
  type CountedPage,
  type Page,
  type SearchQuery,
  submissionChecklist,
  type TopHost,
  type UserStats,
  type WinnerProfile,
  type WinnerSummary,
} from '@feedants/shared';
import type { Redis } from 'ioredis';
import { type CompetitionEnv, RULES, type Rules } from '../config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import {
  categoryView,
  type CompetitionRow,
  decodeCursor,
  encodeCursor,
  loadProfiles,
  profileOf,
  summaries,
  toDetail,
  toRegistrationView,
} from '../views';

const HOME_KEY = 'competition:home:v1';
const HOUR = 3_600_000;
type HomePublic = Omit<HomeResponse, 'me'>;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: CompetitionEnv,
    @Inject(RULES) private readonly rules: Rules,
  ) {}

  async categories(): Promise<CategoryListing[]> {
    const [rows, live] = await Promise.all([
      this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      this.prisma.competition.groupBy({
        by: ['categoryId'],
        where: { status: 'PUBLISHED' },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(live.map((l) => [l.categoryId, l._count._all]));
    return rows.map((c) => ({ ...categoryView(c)!, liveCount: counts.get(c.id) ?? 0 }));
  }

  // ---------------------------------------------------------------- Home (FR-DS-01, FR-DS-02)

  async home(viewerId?: string): Promise<HomeResponse> {
    const [pub, me] = await Promise.all([this.homePublic(), viewerId ? this.homeMe(viewerId) : null]);
    return { ...pub, me };
  }

  /** Cache-aside with TTL jitter so instances don't all rebuild at once (PROJECT_PLAN caching). */
  private async homePublic(): Promise<HomePublic> {
    const ttl = this.env.HOME_CACHE_TTL_SECONDS;
    if (ttl > 0) {
      const cached = await this.redis.get(HOME_KEY);
      if (cached) return JSON.parse(cached) as HomePublic;
    }
    const built = await this.buildHome(new Date());
    if (ttl > 0)
      await this.redis.set(HOME_KEY, JSON.stringify(built), 'EX', ttl + Math.floor(Math.random() * 10));
    return built;
  }

  async invalidateHome(): Promise<void> {
    await this.redis.del(HOME_KEY);
  }

  private async buildHome(now: Date): Promise<HomePublic> {
    const n = this.env.HOME_SECTION_SIZE;
    const open: Prisma.CompetitionWhereInput = {
      status: 'PUBLISHED',
      registrationOpensAt: { lte: now },
      registrationClosesAt: { gt: now },
    };
    const include = { category: true } as const;

    const [featuredRows, upcoming, endingSoon, topPrize, trendingIds, categories, recentWinners, topHosts] =
      await Promise.all([
        this.prisma.competition.findMany({
          where: open,
          include,
          orderBy: [{ featured: 'desc' }, { prizePoolPaise: 'desc' }, { id: 'asc' }],
          take: 1,
        }),
        this.prisma.competition.findMany({
          where: { status: 'PUBLISHED', registrationOpensAt: { gt: now } },
          include,
          orderBy: [{ registrationOpensAt: 'asc' }, { id: 'asc' }],
          take: n,
        }),
        this.prisma.competition.findMany({
          where: {
            ...open,
            registrationClosesAt: {
              gt: now,
              lte: new Date(now.getTime() + this.env.ENDING_SOON_WINDOW_HOURS * HOUR),
            },
          },
          include,
          orderBy: [{ registrationClosesAt: 'asc' }, { id: 'asc' }],
          take: n,
        }),
        this.prisma.competition.findMany({
          where: open,
          include,
          orderBy: [{ prizePoolPaise: 'desc' }, { id: 'asc' }],
          take: n,
        }),
        this.prisma.$queryRaw<{ id: string }[]>`
          SELECT c.id
            FROM competitions c
            JOIN registrations r ON r.competition_id = c.id
             AND r.status = 'CONFIRMED'
             AND r.confirmed_at > ${new Date(now.getTime() - this.env.TRENDING_WINDOW_DAYS * 24 * HOUR)}
           WHERE c.status = 'PUBLISHED' AND c.submission_ends_at > ${now}
           GROUP BY c.id
           ORDER BY count(*) DESC, c.id
           LIMIT ${n}`,
        this.categories(),
        this.recentWinners(n),
        this.topHosts(n),
      ]);

    const trendingRows = await this.byIds(trendingIds.map((r) => r.id));
    const [featured, up, ending, top, trending] = await Promise.all([
      summaries(this.prisma, featuredRows, now),
      summaries(this.prisma, upcoming, now),
      summaries(this.prisma, endingSoon, now),
      summaries(this.prisma, topPrize, now),
      summaries(this.prisma, trendingRows, now),
    ]);
    return {
      featured: featured[0] ?? null,
      categories,
      trending,
      upcoming: up,
      endingSoon: ending,
      topPrize: top,
      recentWinners,
      topHosts,
    };
  }

  private async homeMe(userId: string): Promise<HomeResponse['me']> {
    const now = new Date();
    const [joined, won, draft] = await Promise.all([
      this.prisma.registration.count({ where: { creatorId: userId, status: 'CONFIRMED' } }),
      this.prisma.submission.count({ where: { creatorId: userId, prizePaise: { gt: 0 } } }),
      this.prisma.submission.findFirst({
        where: {
          creatorId: userId,
          status: 'DRAFT',
          registration: { status: 'CONFIRMED' },
          competition: {
            status: 'PUBLISHED',
            submissionStartsAt: { lte: now },
            submissionEndsAt: { gt: now },
          },
        },
        include: { competition: { select: { id: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return {
      joined,
      won,
      draft: draft
        ? {
            registrationId: draft.registrationId,
            competitionId: draft.competition.id,
            competitionTitle: draft.competition.title ?? 'Competition',
            percent: submissionChecklist(draft, this.rules).percent,
          }
        : null,
    };
  }

  // ---------------------------------------------------------------- Explore (FR-DS-03)

  async list(q: ListQuery): Promise<CountedPage<CompetitionSummary>> {
    const now = new Date();
    const after = decodeCursor(q.cursor);
    if (q.cursor && !after) throw new AppError('VALIDATION_FAILED', 'Invalid cursor');

    const where: Prisma.CompetitionWhereInput = { AND: [] };
    const and = where.AND as Prisma.CompetitionWhereInput[];
    and.push({ status: q.phase === 'COMPLETED' ? 'RESULTS_PUBLISHED' : 'PUBLISHED' });
    if (q.category) and.push({ category: { slug: q.category } });
    switch (q.phase) {
      case 'UPCOMING':
        and.push({ registrationOpensAt: { gt: now } });
        break;
      case 'OPEN':
        and.push({ registrationOpensAt: { lte: now }, registrationClosesAt: { gt: now } });
        break;
      case 'SUBMISSIONS':
        and.push({ registrationClosesAt: { lte: now }, submissionEndsAt: { gt: now } });
        break;
      case 'JUDGING':
        and.push({ submissionEndsAt: { lte: now } });
        break;
    }

    // The design shows "N competitions"; counting once, on the first page, keeps later pages cheap.
    const total = q.cursor ? null : await this.prisma.competition.count({ where: { AND: [...and] } });

    // Keyset pagination: (sort key, id) strictly after the cursor — constant cost per page.
    const sort = {
      popular: { field: 'confirmedCount', dir: 'desc' },
      prize: { field: 'prizePoolPaise', dir: 'desc' },
      ending: { field: 'registrationClosesAt', dir: 'asc' },
      newest: { field: 'publishedAt', dir: 'desc' },
    }[q.sort] as {
      field: 'confirmedCount' | 'prizePoolPaise' | 'registrationClosesAt' | 'publishedAt';
      dir: 'asc' | 'desc';
    };
    if (after) {
      const isDate = sort.field === 'registrationClosesAt' || sort.field === 'publishedAt';
      const value = isDate ? new Date(String(after[0])) : Number(after[0]);
      const beyond = sort.dir === 'desc' ? 'lt' : 'gt';
      and.push({
        OR: [{ [sort.field]: { [beyond]: value } }, { [sort.field]: value, id: { [beyond]: after[1] } }],
      });
    }

    const rows = await this.prisma.competition.findMany({
      where,
      include: { category: true },
      orderBy: [{ [sort.field]: sort.dir }, { id: sort.dir }],
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    const lastValue = last ? (last[sort.field] as Date | number | null) : null;
    return {
      items: await summaries(this.prisma, page, now),
      total,
      nextCursor:
        rows.length > q.limit && last
          ? encodeCursor(lastValue instanceof Date ? lastValue.toISOString() : lastValue, last.id)
          : null,
    };
  }

  // ---------------------------------------------------------------- Search (FR-DS-04, A-19)

  async search(q: SearchQuery): Promise<Page<CompetitionSummary>> {
    const after = decodeCursor(q.cursor);
    if (q.cursor && !after) throw new AppError('VALIDATION_FAILED', 'Invalid cursor');
    const term = q.q;
    // Score is rounded to numeric so the cursor compares exactly (floats don't round-trip).
    const rows = await this.prisma.$queryRaw<{ id: string; score: string }[]>`
      SELECT * FROM (
        SELECT c.id,
               round(GREATEST(
                 ts_rank(c.search_document, plainto_tsquery('english', ${term})),
                 similarity(coalesce(c.title, ''), ${term}),
                 word_similarity(${term}, coalesce(c.title, '')),
                 similarity(coalesce(cat.name, ''), ${term}),
                 similarity(coalesce(u.display_name, ''), ${term})
               )::numeric, 6) AS score
          FROM competitions c
          LEFT JOIN categories cat ON cat.id = c.category_id
          LEFT JOIN user_profiles u ON u.user_id = c.host_id
         WHERE c.status IN ('PUBLISHED', 'RESULTS_PUBLISHED')
           AND (c.search_document @@ plainto_tsquery('english', ${term})
                OR c.title % ${term}
                OR ${term} <% c.title
                OR cat.name % ${term}
                OR u.display_name % ${term})
      ) s
      ${after ? Prisma.sql`WHERE (s.score < ${String(after[0])}::numeric OR (s.score = ${String(after[0])}::numeric AND s.id > ${after[1]}::uuid))` : Prisma.empty}
      ORDER BY s.score DESC, s.id ASC
      LIMIT ${q.limit + 1}`;
    const page = rows.slice(0, q.limit);
    const byId = await this.byIds(page.map((r) => r.id));
    const last = page.at(-1);
    return {
      items: await summaries(this.prisma, byId, new Date()),
      nextCursor: rows.length > q.limit && last ? encodeCursor(last.score, last.id) : null,
    };
  }

  // ---------------------------------------------------------------- Detail (FR-DS-05, FR-DS-06)

  async detail(id: string, viewerId?: string): Promise<CompetitionDetail> {
    const c = await this.prisma.competition.findUnique({
      where: { id },
      include: { category: true, prizeTiers: true },
    });
    const isHost = !!viewerId && c?.hostId === viewerId;
    // Drafts, unfunded and never-published competitions exist only for their host.
    if (!c || (!c.publishedAt && !isHost)) throw notFound('Competition');

    let viewer: CompetitionDetail['viewer'] = null;
    if (viewerId) {
      const [registration, subscription] = await Promise.all([
        this.prisma.registration.findFirst({
          where: { competitionId: id, creatorId: viewerId },
          include: { submission: { select: { id: true, status: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.notifySubscription.findUnique({
          where: { competitionId_userId: { competitionId: id, userId: viewerId } },
        }),
      ]);
      viewer = {
        isHost,
        notifyOn: !!subscription,
        registration: registration ? toRegistrationView(registration) : null,
        submission: registration?.submission ?? null,
      };
    }
    const profiles = await loadProfiles(this.prisma, [c.hostId]);
    return toDetail(c, profiles, new Date(), this.rules.platformFeePercent, viewer);
  }

  // ---------------------------------------------------------------- Notify me (FR-DS-07)

  async setNotify(userId: string, competitionId: string, on: boolean): Promise<{ notifyOn: boolean }> {
    const c = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (!c || !c.publishedAt) throw notFound('Competition');
    if (on) {
      if (c.status !== 'PUBLISHED' || (c.registrationOpensAt && c.registrationOpensAt <= new Date())) {
        throw new AppError('COMPETITION_INVALID_STATE', 'Notify me is only for upcoming competitions');
      }
      await this.prisma.notifySubscription.upsert({
        where: { competitionId_userId: { competitionId, userId } },
        create: { competitionId, userId },
        update: {},
      });
    } else {
      await this.prisma.notifySubscription.deleteMany({ where: { competitionId, userId } });
    }
    return { notifyOn: on };
  }

  // ---------------------------------------------------------------- Social proof (FR-DS-08, FR-JG-06)

  async topHosts(limit: number): Promise<TopHost[]> {
    const rows = await this.prisma.$queryRaw<
      { host_id: string; run: bigint; participants: bigint; completed: bigint }[]
    >`
      SELECT host_id,
             count(*) AS run,
             coalesce(sum(confirmed_count), 0) AS participants,
             count(*) FILTER (WHERE status = 'RESULTS_PUBLISHED') AS completed
        FROM competitions
       WHERE status IN ('PUBLISHED', 'RESULTS_PUBLISHED')
       GROUP BY host_id
       ORDER BY run DESC, participants DESC, host_id
       LIMIT ${limit}`;
    const profiles = await loadProfiles(
      this.prisma,
      rows.map((r) => r.host_id),
    );
    return rows.map((r) => ({
      ...profileOf(profiles, r.host_id),
      competitionsRun: Number(r.run),
      participants: Number(r.participants),
      completed: Number(r.completed),
    }));
  }

  async recentWinners(limit: number): Promise<WinnerSummary[]> {
    const rows = await this.prisma.submission.findMany({
      where: { rank: 1, competition: { status: 'RESULTS_PUBLISHED' } },
      include: {
        competition: { select: { id: true, title: true, coverUrl: true, resultsPublishedAt: true } },
      },
      orderBy: [{ competition: { resultsPublishedAt: 'desc' } }, { id: 'asc' }],
      take: limit,
    });
    const profiles = await loadProfiles(
      this.prisma,
      rows.map((r) => r.creatorId),
    );
    return rows.map((s) => {
      const p = profileOf(profiles, s.creatorId);
      return {
        userId: s.creatorId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        competitionId: s.competition.id,
        competitionTitle: s.competition.title ?? 'Competition',
        competitionCoverUrl: s.competition.coverUrl,
        rank: 1,
        prizePaise: s.prizePaise,
      };
    });
  }

  async userStats(userId: string): Promise<UserStats> {
    const [joined, winnings] = await Promise.all([
      this.prisma.registration.count({ where: { creatorId: userId, status: 'CONFIRMED' } }),
      this.prisma.submission.aggregate({
        where: { creatorId: userId, prizePaise: { gt: 0 } },
        _count: true,
        _sum: { prizePaise: true },
      }),
    ]);
    return { userId, joined, won: winnings._count, totalWinningsPaise: winnings._sum.prizePaise ?? 0 };
  }

  async winnerProfile(userId: string): Promise<WinnerProfile> {
    const [stats, placements, profiles] = await Promise.all([
      this.userStats(userId),
      this.prisma.submission.findMany({
        where: { creatorId: userId, rank: { not: null }, competition: { status: 'RESULTS_PUBLISHED' } },
        include: {
          competition: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              resultsPublishedAt: true,
              category: { select: { name: true } },
            },
          },
        },
        orderBy: [{ competition: { resultsPublishedAt: 'desc' } }],
        take: 50,
      }),
      loadProfiles(this.prisma, [userId]),
    ]);
    const profile = profiles.get(userId);
    if (!profile) throw notFound('User');
    return {
      ...stats,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      placements: placements.map((s) => ({
        competitionId: s.competition.id,
        competitionTitle: s.competition.title ?? 'Competition',
        competitionCoverUrl: s.competition.coverUrl,
        categoryName: s.competition.category?.name ?? null,
        rank: s.rank!,
        prizePaise: s.prizePaise,
        resultsPublishedAt: s.competition.resultsPublishedAt!.toISOString(),
      })),
    };
  }

  private async byIds(ids: string[]): Promise<CompetitionRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.competition.findMany({
      where: { id: { in: ids } },
      include: { category: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is CompetitionRow => !!r);
  }
}
