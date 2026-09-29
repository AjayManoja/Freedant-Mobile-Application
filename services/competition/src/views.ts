import {
  type Category as CategoryView,
  type CheckoutDetails,
  type CompetitionDetail,
  type CompetitionSummary,
  derivePhase,
  type DisplayPhase,
  feeBreakdown,
  type HostSummary,
  type RegistrationView,
} from '@feedants/shared';
import type { Category, Competition, PrizeTier, Registration } from './generated/prisma/client';
import type { PrismaService, Tx } from './prisma.service';

export type CompetitionRow = Competition & { category: Category | null };

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function displayPhase(c: Competition, now: Date): DisplayPhase {
  switch (c.status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'AWAITING_FUNDING':
      return 'AWAITING_FUNDING';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'RESULTS_PUBLISHED':
      return 'COMPLETED';
    case 'PUBLISHED':
      return derivePhase(
        {
          registrationOpensAt: c.registrationOpensAt!,
          registrationClosesAt: c.registrationClosesAt!,
          submissionStartsAt: c.submissionStartsAt!,
          submissionEndsAt: c.submissionEndsAt!,
        },
        now,
      );
  }
}

export const windows = (c: Competition) => ({
  registrationOpensAt: c.registrationOpensAt!,
  registrationClosesAt: c.registrationClosesAt!,
  submissionStartsAt: c.submissionStartsAt!,
  submissionEndsAt: c.submissionEndsAt!,
});

export const categoryView = (c: Category | null): CategoryView | null =>
  c ? { id: c.id, slug: c.slug, name: c.name, icon: c.icon } : null;

export type ProfileMap = Map<string, HostSummary>;

/** Batch-loads local profile copies (never a call to Identity). */
export async function loadProfiles(db: PrismaService | Tx, userIds: Iterable<string>): Promise<ProfileMap> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.userProfile.findMany({ where: { userId: { in: ids } } });
  return new Map(
    rows.map((r) => [r.userId, { id: r.userId, displayName: r.displayName, avatarUrl: r.avatarUrl }]),
  );
}

/** Until Identity's `user.updated` arrives, show a neutral name rather than nothing. */
export const profileOf = (profiles: ProfileMap, userId: string): HostSummary =>
  profiles.get(userId) ?? { id: userId, displayName: 'Feedants user', avatarUrl: null };

export function toSummary(c: CompetitionRow, profiles: ProfileMap, now: Date): CompetitionSummary {
  return {
    id: c.id,
    title: c.title ?? 'Untitled competition',
    category: categoryView(c.category),
    coverUrl: c.coverUrl,
    host: profileOf(profiles, c.hostId),
    status: c.status,
    phase: displayPhase(c, now),
    prizePoolPaise: c.prizePoolPaise ?? 0,
    entryFeePaise: c.entryFeePaise ?? 0,
    maxSpots: c.maxSpots ?? 0,
    spotsRemaining:
      c.status === 'PUBLISHED'
        ? c.spotsRemaining
        : c.status === 'DRAFT'
          ? (c.maxSpots ?? 0)
          : c.spotsRemaining,
    participants: c.confirmedCount,
    registrationOpensAt: iso(c.registrationOpensAt),
    registrationClosesAt: iso(c.registrationClosesAt),
    submissionEndsAt: iso(c.submissionEndsAt),
  };
}

export async function summaries(db: PrismaService | Tx, rows: CompetitionRow[], now: Date) {
  const profiles = await loadProfiles(
    db,
    rows.map((r) => r.hostId),
  );
  return rows.map((r) => toSummary(r, profiles, now));
}

export function checkoutOf(r: Registration): CheckoutDetails | null {
  if (r.status !== 'HELD' || !r.paymentOrderId || !r.providerOrderId || !r.paymentKeyId) return null;
  return {
    orderId: r.paymentOrderId,
    providerOrderId: r.providerOrderId,
    amountPaise: r.amountPaise,
    currency: 'INR',
    keyId: r.paymentKeyId,
  };
}

export const toRegistrationView = (r: Registration): RegistrationView => ({
  id: r.id,
  competitionId: r.competitionId,
  status: r.status,
  amountPaise: r.amountPaise,
  holdExpiresAt: iso(r.holdExpiresAt),
  confirmedAt: iso(r.confirmedAt),
  lastPaymentError: r.lastPaymentError,
  checkout: checkoutOf(r),
});

export function toDetail(
  c: CompetitionRow & { prizeTiers: PrizeTier[] },
  profiles: ProfileMap,
  now: Date,
  platformFeePercent: number,
  viewer: CompetitionDetail['viewer'],
): CompetitionDetail {
  const entryFee = c.entryFeePaise ?? 0;
  const fees =
    c.platformFeePaise !== null
      ? {
          entryFeePaise: entryFee,
          platformFeePaise: c.platformFeePaise,
          totalPaise: entryFee + c.platformFeePaise,
        }
      : feeBreakdown(entryFee, platformFeePercent);
  return {
    ...toSummary(c, profiles, now),
    description: c.description,
    prizeTiers: [...c.prizeTiers]
      .sort((a, b) => a.rank - b.rank)
      .map((t) => ({ rank: t.rank, amountPaise: t.amountPaise })),
    fees,
    startAt: iso(c.startAt),
    durationDays: c.durationDays,
    submissionStartsAt: iso(c.submissionStartsAt),
    resultsDueAt: iso(c.resultsDueAt),
    resultsPublishedAt: iso(c.resultsPublishedAt),
    serverTime: now.toISOString(),
    viewer,
  };
}

// ---------------------------------------------------------------- cursors

/** Opaque keyset cursor: the last row's sort value and ID (NFR-PF-03, never OFFSET). */
export const encodeCursor = (value: string | number | null, id: string): string =>
  Buffer.from(JSON.stringify([value, id])).toString('base64url');

export function decodeCursor(cursor: string | undefined): [string | number | null, string] | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === 'string') {
      return parsed as [string | number | null, string];
    }
  } catch {
    /* fall through */
  }
  return null;
}
