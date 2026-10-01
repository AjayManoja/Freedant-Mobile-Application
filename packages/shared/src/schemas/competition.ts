import { z } from 'zod';
import { defaultRules, type MediaKind } from '../rules';
import type { FeeBreakdown, PrizeTier } from '../money';
import type { Phase } from '../timeline';
import { paginationQuerySchema } from './common';

const t = defaultRules.text;
const r = defaultRules;

/** Whole rupees only: the wizard never asks for paise. */
const wholeRupees = (s: z.ZodNumber) => s.int().refine((v) => v % 100 === 0, 'Must be a whole rupee amount');

export const prizePoolSchema = wholeRupees(z.number()).min(r.prizePool.minPaise).max(r.prizePool.maxPaise);

export const entryFeeSchema = wholeRupees(z.number()).refine(
  (v) => v === 0 || (v >= r.entryFee.minPaise && v <= r.entryFee.maxPaise),
  `Entry fee must be free or between ₹${r.entryFee.minPaise / 100} and ₹${r.entryFee.maxPaise / 100}`,
);

export const durationSchema = z
  .number()
  .int()
  .refine(
    (d) => (r.schedule.durationsDays as readonly number[]).includes(d),
    'Choose one of the offered durations',
  );

export const maxSpotsSchema = z.number().int().min(r.spots.min).max(r.spots.max);

const basicsShape = {
  title: z.string().trim().min(t.titleMin).max(t.titleMax),
  categoryId: z.number().int().positive(),
  description: z.string().trim().max(t.descriptionMax).nullable(),
  /** Key returned by the cover upload-URL endpoint, or null for no cover. */
  coverKey: z.string().max(512).nullable(),
};

const prizeShape = {
  prizePoolPaise: prizePoolSchema,
  entryFeePaise: entryFeeSchema,
};

const scheduleShape = {
  startAt: z.iso.datetime({ offset: true }),
  durationDays: durationSchema,
  maxSpots: maxSpotsSchema,
};

/** Wizard autosave (FR-HS-01, FR-HS-05): any subset of fields, each valid on its own. */
export const draftUpdateSchema = z.strictObject({
  title: basicsShape.title.optional(),
  categoryId: basicsShape.categoryId.optional(),
  description: basicsShape.description.optional(),
  coverKey: basicsShape.coverKey.optional(),
  prizePoolPaise: prizeShape.prizePoolPaise.optional(),
  entryFeePaise: prizeShape.entryFeePaise.optional(),
  startAt: scheduleShape.startAt.optional(),
  durationDays: scheduleShape.durationDays.optional(),
  maxSpots: scheduleShape.maxSpots.optional(),
});
export type DraftUpdateInput = z.infer<typeof draftUpdateSchema>;

/** FR-HS-08: once funded, only descriptive details may change, and only before the first registration. */
export const publishedEditSchema = z
  .strictObject({
    title: basicsShape.title.optional(),
    categoryId: basicsShape.categoryId.optional(),
    description: basicsShape.description.optional(),
    coverKey: basicsShape.coverKey.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type PublishedEditInput = z.infer<typeof publishedEditSchema>;

export type WizardStep = 'BASICS' | 'PRIZE' | 'SCHEDULE';

export interface DraftFields {
  title: string | null;
  categoryId: number | null;
  prizePoolPaise: number | null;
  entryFeePaise: number | null;
  startAt: string | Date | null;
  durationDays: number | null;
  maxSpots: number | null;
}

export interface DraftIssue {
  step: WizardStep;
  field: keyof DraftFields;
  message: string;
}

/**
 * FR-HS-01: the Review step can publish only when every step is complete. Shared so the
 * app blocks "Continue" with exactly the rule the API enforces.
 */
export function draftIssues(d: DraftFields, now: Date, rules = defaultRules): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const need = (step: WizardStep, field: keyof DraftFields, ok: boolean, message: string) => {
    if (!ok) issues.push({ step, field, message });
  };
  need(
    'BASICS',
    'title',
    !!d.title && basicsShape.title.safeParse(d.title).success,
    'Add a title (5–80 characters)',
  );
  need('BASICS', 'categoryId', d.categoryId !== null, 'Pick a category');
  need(
    'PRIZE',
    'prizePoolPaise',
    d.prizePoolPaise !== null && prizePoolSchema.safeParse(d.prizePoolPaise).success,
    'Set a prize pool',
  );
  need(
    'PRIZE',
    'entryFeePaise',
    d.entryFeePaise !== null && entryFeeSchema.safeParse(d.entryFeePaise).success,
    'Set an entry fee (or make it free)',
  );
  const start = d.startAt === null ? null : new Date(d.startAt);
  const earliest = now.getTime() + rules.schedule.minLeadMinutes * 60_000;
  need(
    'SCHEDULE',
    'startAt',
    start !== null && start.getTime() >= earliest,
    `Start at least ${rules.schedule.minLeadMinutes} minutes from now`,
  );
  need('SCHEDULE', 'durationDays', d.durationDays !== null, 'Choose a duration');
  need('SCHEDULE', 'maxSpots', d.maxSpots !== null, 'Set the maximum spots');
  return issues;
}

// ---------------------------------------------------------------- Discovery

export const phaseFilterSchema = z.enum(['UPCOMING', 'OPEN', 'SUBMISSIONS', 'JUDGING', 'COMPLETED']);
export type PhaseFilter = z.infer<typeof phaseFilterSchema>;

export const listSortSchema = z.enum(['popular', 'prize', 'ending', 'newest']);
export type ListSort = z.infer<typeof listSortSchema>;

export const listQuerySchema = z.strictObject({
  category: z.string().max(40).optional(),
  phase: phaseFilterSchema.optional(),
  sort: listSortSchema.default('popular'),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(r.pagination.maxLimit).default(r.pagination.defaultLimit),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const searchQuerySchema = z.strictObject({
  q: z.string().trim().min(r.searchMinLength).max(100),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(r.pagination.maxLimit).default(r.pagination.defaultLimit),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export type CompetitionStatus =
  'DRAFT' | 'AWAITING_FUNDING' | 'PUBLISHED' | 'RESULTS_PUBLISHED' | 'CANCELLED';
export type DisplayPhase = Phase | 'DRAFT' | 'AWAITING_FUNDING' | 'COMPLETED' | 'CANCELLED';

export interface Category {
  id: number;
  slug: string;
  name: string;
  icon: string;
}

/** A category with how many live (published, not yet finished) competitions it has. */
export interface CategoryListing extends Category {
  liveCount: number;
}

export interface HostSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CompetitionSummary {
  id: string;
  title: string;
  category: Category | null;
  coverUrl: string | null;
  host: HostSummary;
  status: CompetitionStatus;
  phase: DisplayPhase;
  prizePoolPaise: number;
  entryFeePaise: number;
  maxSpots: number;
  spotsRemaining: number;
  participants: number;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  submissionEndsAt: string | null;
}

export type RegistrationStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'REJECTED' | 'REFUNDED';
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED';

export interface CompetitionDetail extends CompetitionSummary {
  description: string | null;
  prizeTiers: PrizeTier[];
  fees: FeeBreakdown;
  startAt: string | null;
  durationDays: number | null;
  submissionStartsAt: string | null;
  resultsDueAt: string | null;
  resultsPublishedAt: string | null;
  /** Lets the app correct its clock for countdowns (A-15). */
  serverTime: string;
  viewer: {
    isHost: boolean;
    notifyOn: boolean;
    registration: RegistrationView | null;
    submission: { id: string; status: SubmissionStatus } | null;
  } | null;
}

export interface HomeResponse {
  featured: CompetitionSummary | null;
  categories: CategoryListing[];
  trending: CompetitionSummary[];
  upcoming: CompetitionSummary[];
  endingSoon: CompetitionSummary[];
  topPrize: CompetitionSummary[];
  recentWinners: WinnerSummary[];
  topHosts: TopHost[];
  me: {
    joined: number;
    won: number;
    draft: {
      registrationId: string;
      competitionId: string;
      competitionTitle: string;
      percent: number;
    } | null;
  } | null;
}

export interface WinnerSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  competitionId: string;
  competitionTitle: string;
  competitionCoverUrl: string | null;
  rank: number;
  prizePaise: number;
}

export interface TopHost extends HostSummary {
  competitionsRun: number;
  participants: number;
  completed: number;
}

export interface UserStats {
  userId: string;
  joined: number;
  won: number;
  totalWinningsPaise: number;
}

export interface WinnerProfile extends UserStats {
  displayName: string;
  avatarUrl: string | null;
  placements: {
    competitionId: string;
    competitionTitle: string;
    competitionCoverUrl: string | null;
    categoryName: string | null;
    rank: number;
    prizePaise: number;
    resultsPublishedAt: string;
  }[];
}

// ---------------------------------------------------------------- Hosting

export interface HostedCompetition extends CompetitionSummary {
  registrations: number;
  submissions: number;
  /** Entry fees owed to the host (excluding platform fees), credited at results (A-10). */
  entryRevenuePaise: number;
  resultsDueAt: string | null;
  overdue: boolean;
  createdAt: string;
}

/**
 * The host dashboard's filters (US-18): Live = published and still taking entries,
 * Judging = submissions closed but no results yet, Draft = not yet funded,
 * Closed = results published or cancelled.
 */
export const hostedFilterSchema = z.enum(['LIVE', 'JUDGING', 'DRAFT', 'CLOSED']);
export type HostedFilter = z.infer<typeof hostedFilterSchema>;

export const hostedQuerySchema = paginationQuerySchema.extend({ filter: hostedFilterSchema.optional() });
export type HostedQuery = z.infer<typeof hostedQuerySchema>;

export interface HostedSummary {
  counts: Record<'ALL' | HostedFilter, number>;
  /** Confirmed registrations across competitions that were not cancelled. */
  totalEntries: number;
  /** Entry fees owed to the host (A-10) across competitions that were not cancelled. */
  revenuePaise: number;
}

export interface CheckoutDetails {
  orderId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  /** Razorpay public key id (test mode). */
  keyId: string;
}

export interface PublishResponse {
  competition: CompetitionDetail;
  checkout: CheckoutDetails;
}

// ---------------------------------------------------------------- Participation

export interface RegistrationView {
  id: string;
  competitionId: string;
  status: RegistrationStatus;
  amountPaise: number;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
  lastPaymentError: string | null;
  checkout: CheckoutDetails | null;
}

export interface JoinResponse {
  registration: RegistrationView;
}

// ---------------------------------------------------------------- Submissions

export const mediaUploadRequestSchema = z.strictObject({
  contentType: z.enum([
    ...defaultRules.media.IMAGE.contentTypes,
    ...defaultRules.media.AUDIO.contentTypes,
    ...defaultRules.media.VIDEO.contentTypes,
  ] as [string, ...string[]]),
  sizeBytes: z.number().int().positive(),
});
export type MediaUploadRequest = z.infer<typeof mediaUploadRequestSchema>;

export const mediaKindOf = (contentType: string): MediaKind | null => {
  for (const kind of ['IMAGE', 'AUDIO', 'VIDEO'] as const) {
    if (defaultRules.media[kind].contentTypes.includes(contentType)) return kind;
  }
  return null;
};

export const submissionUpdateSchema = z
  .strictObject({
    caption: z.string().trim().max(t.captionMax).nullable().optional(),
    rulesAccepted: z.boolean().optional(),
    mediaKey: z.string().max(512).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type SubmissionUpdateInput = z.infer<typeof submissionUpdateSchema>;

export interface Checklist {
  media: boolean;
  caption: boolean;
  rules: boolean;
  /** A-24: items done / 3, as a whole percentage. */
  percent: number;
}

export function submissionChecklist(
  s: { mediaKey: string | null; caption: string | null; rulesAccepted: boolean },
  rules = defaultRules,
): Checklist {
  const media = !!s.mediaKey;
  const caption = (s.caption?.trim().length ?? 0) >= rules.submission.captionMinLength;
  const rulesOk = s.rulesAccepted;
  const done = [media, caption, rulesOk].filter(Boolean).length;
  return { media, caption, rules: rulesOk, percent: Math.round((done / 3) * 100) };
}

/** FR-SB-05: what the creator sees. Scores stay hidden until results are published (A-27). */
export type SubmissionDisplayStatus = 'DRAFT' | 'IN_REVIEW' | 'WON' | 'NOT_SELECTED';

export const mySubmissionsQuerySchema = z.strictObject({
  status: z.enum(['DRAFT', 'IN_REVIEW', 'WON', 'NOT_SELECTED']).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(r.pagination.maxLimit).default(r.pagination.defaultLimit),
});
export type MySubmissionsQuery = z.infer<typeof mySubmissionsQuerySchema>;

export interface SubmissionView {
  id: string;
  registrationId: string;
  competition: {
    id: string;
    title: string;
    coverUrl: string | null;
    submissionEndsAt: string | null;
    phase: DisplayPhase;
    categoryName: string | null;
  };
  status: SubmissionStatus;
  displayStatus: SubmissionDisplayStatus;
  mediaType: MediaKind | null;
  mediaContentType: string | null;
  mediaUrl: string | null;
  caption: string | null;
  rulesAccepted: boolean;
  checklist: Checklist;
  submittedAt: string | null;
  /** Only after results are published. */
  result: { rank: number | null; score: number | null; prizePaise: number } | null;
}

/** US-26: the My Submissions summary strip and filter counts. */
export interface MySubmissionsSummary {
  counts: Record<'ALL' | SubmissionDisplayStatus, number>;
  totalWinningsPaise: number;
}

// ---------------------------------------------------------------- Judging

export const scoreSchema = z.strictObject({
  score: z
    .number()
    .min(defaultRules.score.min)
    .max(defaultRules.score.max)
    .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, 'Use at most one decimal place'),
  comment: z.string().trim().max(t.commentMax).nullable().optional(),
});
export type ScoreInput = z.infer<typeof scoreSchema>;

export interface JudgingEntry {
  submissionId: string;
  creator: HostSummary;
  mediaType: MediaKind | null;
  mediaContentType: string | null;
  mediaUrl: string | null;
  caption: string | null;
  submittedAt: string;
  score: number | null;
  comment: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  submissionId: string;
  creator: HostSummary;
  score: number;
  prizePaise: number;
}

export interface Leaderboard {
  competitionId: string;
  title: string;
  resultsPublishedAt: string;
  entries: LeaderboardEntry[];
}
