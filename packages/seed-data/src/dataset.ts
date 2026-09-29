import {
  computePrizeTiers,
  deriveTimeline,
  feeBreakdown,
  formatInr,
  type NotificationTarget,
  type NotificationType,
  type PrizeTier,
  type Timeline,
} from '@feedants/shared';
import { seedId, seedRandom } from './ids';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Sign in as this user (any OTP arrives in Mailpit) to see every flow with data in it. */
export const DEMO_EMAIL = 'riya@example.com';

/** The key id the fake payment provider reports, so the app offers its test checkout. */
export const FAKE_KEY_ID = 'rzp_test_fake';

const SYSTEM_OWNER = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------- types

export interface SeedUser {
  id: string;
  email: string;
  displayName: string;
  bio: string | null;
  /** File in `assets/`, uploaded under the user's public avatar prefix. */
  avatar: string | null;
  createdAt: Date;
}

export interface SeedSubmission {
  id: string;
  status: 'DRAFT' | 'SUBMITTED';
  /** File in `assets/`, uploaded under the registration's private media prefix. */
  media: string | null;
  caption: string | null;
  rulesAccepted: boolean;
  submittedAt: Date | null;
  updatedAt: Date;
  scoreTenths: number | null;
  scoreComment: string | null;
  rank: number | null;
  prizePaise: number;
}

export interface SeedRegistration {
  id: string;
  creatorId: string;
  idempotencyKey: string;
  amountPaise: number;
  confirmedAt: Date;
  /** The captured entry-fee order; null for free competitions. */
  orderId: string | null;
  providerOrderId: string | null;
  submission: SeedSubmission | null;
}

export interface SeedCompetition {
  id: string;
  slug: string;
  hostId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'RESULTS_PUBLISHED';
  title: string;
  description: string;
  categorySlug: string;
  /** File in `assets/`, uploaded under the competition's public cover prefix. */
  cover: string | null;
  featured: boolean;
  prizePoolPaise: number;
  entryFeePaise: number | null;
  platformFeePaise: number | null;
  maxSpots: number | null;
  startAt: Date | null;
  durationDays: number | null;
  timeline: Timeline | null;
  prizeTiers: PrizeTier[];
  publishedAt: Date | null;
  resultsPublishedAt: Date | null;
  createdAt: Date;
  funding: { orderId: string; providerOrderId: string; idempotencyKey: string; requestedAt: Date } | null;
  registrations: SeedRegistration[];
  notifySubscriberIds: string[];
}

export interface SeedOrder {
  id: string;
  purpose: 'ENTRY_FEE' | 'PRIZE_FUNDING';
  referenceId: string;
  competitionId: string;
  payerId: string;
  amountPaise: number;
  platformFeePaise: number;
  idempotencyKey: string;
  providerOrderId: string;
  providerPaymentId: string;
  capturedAt: Date;
}

export type AccountRef = { type: 'EXTERNAL' | 'PLATFORM' | 'ESCROW' | 'USER'; ownerId: string };

export interface SeedPosting {
  id: string;
  kind: 'ENTRY_FEE' | 'PRIZE_FUNDING' | 'PRIZE' | 'HOST_REVENUE' | 'UNAWARDED_RETURN';
  referenceId: string;
  subjectUserId: string;
  competitionId: string;
  displayAmountPaise: number;
  description: string;
  createdAt: Date;
  entries: { account: AccountRef; amountPaise: number }[];
}

export interface SeedNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  target: NotificationTarget;
  sourceEventId: string;
  read: boolean;
  createdAt: Date;
}

export interface SeedDataset {
  users: SeedUser[];
  competitions: SeedCompetition[];
  orders: SeedOrder[];
  postings: SeedPosting[];
  notifications: SeedNotification[];
}

// ---------------------------------------------------------------- people (design/prototype)

interface PersonSpec {
  key: string;
  name: string;
  avatar?: string;
  bio?: string;
}

const DEMO: PersonSpec = {
  key: 'riya',
  name: 'Riya Patel',
  avatar: 'riya.jpg',
  bio: 'Dancer and weekend photographer from Pune. Chasing monsoon light.',
};

const HOSTS: PersonSpec[] = [
  {
    key: 'feedants-arts',
    name: 'Feedants Arts',
    avatar: 'judge.jpg',
    bio: 'Classical arts showcases, judged by working artists.',
  },
  { key: 'soundwave', name: 'SoundWave', bio: 'Independent music collective. Covers, originals, live sets.' },
  { key: 'lensclub', name: 'LensClub', bio: 'Street and documentary photography community.' },
  { key: 'inkwell', name: 'InkWell', bio: 'Poetry and short fiction, in any language.' },
  { key: 'canvas-co', name: 'Canvas Co.', bio: 'Weekly prompts for illustrators and painters.' },
  { key: 'devarena', name: 'DevArena', bio: 'Frontend challenges with real-world briefs.' },
  { key: 'stepup', name: 'StepUp', bio: 'Dance battles for every style.' },
];

const CREATORS: PersonSpec[] = [
  { key: 'aarav', name: 'Aarav Sharma', avatar: 'aarav.jpg', bio: 'Guitarist and bedroom producer.' },
  {
    key: 'ishita',
    name: 'Ishita Verma',
    avatar: 'ishita.jpg',
    bio: 'Kathak dancer, eight years and counting.',
  },
  { key: 'neha', name: 'Neha Kapoor', avatar: 'neha.jpg', bio: 'I write poems on the train.' },
  ...[
    'Kabir Sen',
    'Meera Iyer',
    'Arjun Pillai',
    'Zoya Sheikh',
    'Dev Malhotra',
    'Sara Khan',
    'Tara Menon',
    'Nikhil Rao',
    'Aditi Bose',
    'Farhan Ali',
    'Anaya Rao',
    'Rohan Kapoor',
    'Vikram Nair',
    'Aryan Gupta',
    'Layla Dsouza',
    'Ken Tanaka',
    'Isha Gupta',
    'Om Prakash',
    'Pooja Nair',
    'Sameer Joshi',
  ].map((name) => ({ key: name.toLowerCase().replace(/\s+/g, '-'), name })),
];

const userId = (key: string) => seedId(`user:${key}`);
const email = (key: string) => (key === DEMO.key ? DEMO_EMAIL : `${key}@example.com`);

// ---------------------------------------------------------------- competitions (design/prototype)

type DemoRole = 'draft' | 'submitted' | 'winner';

interface CompetitionSpec {
  slug: string;
  title: string;
  host: string;
  category: string;
  cover: string | null;
  description: string;
  prizeRupees: number;
  entryRupees: number;
  spots: number;
  /** Start relative to the seed time, in hours; the rest of the timeline is derived (A-14). */
  startHours: number;
  days: 3 | 7 | 14 | 30;
  results?: boolean;
  featured?: boolean;
  entrants: number;
  /** Share of entrants who have submitted (the rest hold drafts). */
  submitted: number;
  demo?: DemoRole;
}

const COMPETITIONS: CompetitionSpec[] = [
  {
    slug: 'feedants-classical-dance',
    title: 'Feedants Classical Dance',
    host: 'feedants-arts',
    category: 'dance',
    cover: 'feedants-classical-dance.jpg',
    description:
      'Perform a classical piece of up to three minutes — Kathak, Bharatanatyam, Odissi or any form you trained in. Judged on technique, expression and musicality.',
    prizeRupees: 1_500,
    entryRupees: 99,
    spots: 60,
    startHours: -24,
    days: 7,
    featured: true,
    entrants: 14,
    submitted: 0.3,
    demo: 'draft',
  },
  {
    slug: 'acoustic-cover-battle',
    title: 'Acoustic Cover Battle',
    host: 'soundwave',
    category: 'music',
    cover: 'acoustic-cover-battle.jpg',
    description:
      'One voice, one acoustic instrument, one song you love. Record in a single take — no edits, no backing tracks.',
    prizeRupees: 5_000,
    entryRupees: 149,
    spots: 40,
    // Registration closes in 9 hours, so it shows under "Ending soon".
    startHours: 9 - 72,
    days: 7,
    entrants: 22,
    submitted: 0.5,
  },
  {
    slug: 'street-photography-2026',
    title: 'Street Photography 2026',
    host: 'lensclub',
    category: 'photography',
    cover: 'street-photography-2026.jpg',
    description:
      'Show us your city as it really is. One unedited frame shot this month; basic exposure and crop adjustments only.',
    prizeRupees: 3_200,
    entryRupees: 79,
    spots: 80,
    startHours: -12,
    days: 14,
    entrants: 9,
    submitted: 0.2,
  },
  {
    slug: 'monsoon-poetry-slam',
    title: 'Monsoon Poetry Slam',
    host: 'inkwell',
    category: 'writing',
    cover: 'monsoon-poetry-slam.jpg',
    description: 'Write about the rain. Any language, up to 30 lines. Post a photo of your handwritten page.',
    prizeRupees: 2_000,
    entryRupees: 49,
    spots: 30,
    startHours: -96,
    days: 7,
    entrants: 12,
    submitted: 0.6,
    demo: 'submitted',
  },
  {
    slug: 'sketch-of-the-week',
    title: 'Sketch of the Week',
    host: 'canvas-co',
    category: 'art',
    cover: 'sketch-of-the-week.jpg',
    description: 'This week’s prompt: “a window”. Pencil, ink or charcoal on paper.',
    prizeRupees: 800,
    entryRupees: 29,
    spots: 50,
    startHours: 48,
    days: 3,
    entrants: 0,
    submitted: 0,
  },
  {
    slug: 'react-ui-challenge',
    title: 'React UI Challenge',
    host: 'devarena',
    category: 'coding',
    cover: 'react-ui-challenge.jpg',
    description:
      'Rebuild a checkout screen from a static mockup. Post a screenshot of your result with a link in the caption.',
    prizeRupees: 7_500,
    entryRupees: 199,
    spots: 40,
    startHours: -192,
    days: 7,
    entrants: 10,
    submitted: 0.8,
    demo: 'submitted',
  },
  {
    slug: 'bollywood-freestyle',
    title: 'Bollywood Freestyle',
    host: 'stepup',
    category: 'dance',
    cover: 'bollywood-freestyle.jpg',
    description: 'Your own choreography to any Bollywood track, 60–90 seconds.',
    prizeRupees: 2_800,
    entryRupees: 89,
    spots: 50,
    startHours: -288,
    days: 7,
    results: true,
    entrants: 10,
    submitted: 0.8,
    demo: 'winner',
  },
  {
    slug: 'indie-songwriting',
    title: 'Indie Songwriting',
    host: 'soundwave',
    category: 'music',
    cover: 'indie-songwriting.jpg',
    description: 'An original song, any genre. Free to enter — the collective funds the prize.',
    prizeRupees: 4_000,
    entryRupees: 0,
    spots: 100,
    startHours: -6,
    days: 30,
    entrants: 18,
    submitted: 0.3,
  },
  {
    // Hosted by the demo user and waiting for judging, so the scoring flow can be tried.
    slug: 'monsoon-photo-walk',
    title: 'Monsoon Photo Walk',
    host: 'riya',
    category: 'photography',
    cover: 'street-photography-2026.jpg',
    description: 'Step outside during the rain and bring back one photograph. Free to enter.',
    prizeRupees: 1_000,
    entryRupees: 0,
    spots: 20,
    startHours: -180,
    days: 7,
    entrants: 5,
    submitted: 0.8,
  },
];

/** A draft the demo user can resume from My competitions (US-14). */
const DEMO_DRAFT = {
  slug: 'diwali-rangoli-challenge',
  title: 'Diwali Rangoli Challenge',
  category: 'art',
  description: 'Share a photo of your rangoli this Diwali.',
  prizeRupees: 2_500,
};

const CAPTIONS: Record<string, string[]> = {
  dance: [
    'A Kathak tarana I have been practising since spring.',
    'Freestyle to my favourite track, filmed on the terrace.',
    'Choreographed with my sister over two weekends.',
  ],
  music: [
    'Single take on my old acoustic, recorded at midnight.',
    'Original lyrics about leaving home for the first time.',
    'Stripped-down cover with a capo on the second fret.',
  ],
  photography: [
    'Shot at Crawford Market just after the rain stopped.',
    'Reflections in a puddle outside the station.',
    'A chai stall at dawn, handheld at 1/30.',
  ],
  writing: [
    'Handwritten on the last page of my college notebook.',
    'A poem for the first rain of the season.',
    'Written in Marathi, translated on the facing page.',
  ],
  art: ['Charcoal on A4, about two hours.', 'Ink and wash, looking out of my window.'],
  coding: [
    'Built with React and CSS grid, no libraries.',
    'Accessible checkout with keyboard support throughout.',
  ],
};

const MEDIA = [
  'feedants-classical-dance.jpg',
  'acoustic-cover-battle.jpg',
  'street-photography-2026.jpg',
  'monsoon-poetry-slam.jpg',
  'sketch-of-the-week.jpg',
  'react-ui-challenge.jpg',
  'bollywood-freestyle.jpg',
  'indie-songwriting.jpg',
];

// ---------------------------------------------------------------- builder

const providerRef = (prefix: string, id: string) => `${prefix}_seed${id.replace(/-/g, '').slice(0, 14)}`;
const escrow = (competitionId: string): AccountRef => ({ type: 'ESCROW', ownerId: competitionId });
const wallet = (id: string): AccountRef => ({ type: 'USER', ownerId: id });
const EXTERNAL: AccountRef = { type: 'EXTERNAL', ownerId: SYSTEM_OWNER };
const PLATFORM: AccountRef = { type: 'PLATFORM', ownerId: SYSTEM_OWNER };

/** A time between `from` and `to`, fixed by `name`. */
const between = (name: string, from: number, to: number) =>
  new Date(from + Math.floor(seedRandom(name) * (to - from)));

/**
 * Builds the whole demo world relative to `now` (rounded down to the hour, so services
 * seeded a few seconds apart agree). Pure: the same hour always yields the same data.
 */
export function buildDataset(now: Date = new Date()): SeedDataset {
  const t0 = Math.floor(now.getTime() / HOUR) * HOUR;
  const people = [DEMO, ...HOSTS, ...CREATORS];

  const users: SeedUser[] = people.map((p, i) => ({
    id: userId(p.key),
    email: email(p.key),
    displayName: p.name,
    bio: p.bio ?? null,
    avatar: p.avatar ?? null,
    createdAt: new Date(t0 - (60 - i) * DAY),
  }));

  const competitions: SeedCompetition[] = [];
  const orders: SeedOrder[] = [];
  const postings: SeedPosting[] = [];
  const pool = CREATORS.map((c) => c.key);

  COMPETITIONS.forEach((spec, index) => {
    const id = seedId(`competition:${spec.slug}`);
    const hostId = userId(spec.host);
    const prizePoolPaise = spec.prizeRupees * 100;
    const entryFeePaise = spec.entryRupees * 100;
    const fees = feeBreakdown(entryFeePaise);
    const startAt = new Date(t0 + spec.startHours * HOUR);
    const timeline = deriveTimeline(startAt, spec.days);
    const prizeTiers = computePrizeTiers(prizePoolPaise);
    const publishedAt = new Date(Math.min(startAt.getTime() - 2 * DAY, t0 - 6 * HOUR));
    const resultsPublishedAt = spec.results ? new Date(timeline.submissionEndsAt.getTime() + DAY) : null;
    const clock = Math.min(t0, timeline.submissionEndsAt.getTime());

    // Entrants: the demo user (when she has a role here) plus creators from the pool.
    const offset = (index * 7) % pool.length;
    const keys = [...pool.slice(offset), ...pool.slice(0, offset)].slice(
      0,
      spec.entrants - (spec.demo ? 1 : 0),
    );
    if (spec.demo) keys.push(DEMO.key);

    const registrations: SeedRegistration[] = keys.map((key, i) => {
      const regId = seedId(`registration:${spec.slug}:${key}`);
      const confirmedAt = between(
        `confirmed:${regId}`,
        timeline.registrationOpensAt.getTime(),
        Math.min(t0, timeline.registrationClosesAt.getTime()) - HOUR,
      );
      const paid = entryFeePaise > 0;
      const orderId = paid ? seedId(`order:${regId}`) : null;
      const idempotencyKey = `seed:${regId}`;
      if (orderId) {
        orders.push({
          id: orderId,
          purpose: 'ENTRY_FEE',
          referenceId: regId,
          competitionId: id,
          payerId: userId(key),
          amountPaise: fees.totalPaise,
          platformFeePaise: fees.platformFeePaise,
          idempotencyKey,
          providerOrderId: providerRef('order', orderId),
          providerPaymentId: providerRef('pay', orderId),
          capturedAt: confirmedAt,
        });
        postings.push({
          id: seedId(`ledger:ENTRY_FEE:${orderId}`),
          kind: 'ENTRY_FEE',
          referenceId: orderId,
          subjectUserId: userId(key),
          competitionId: id,
          displayAmountPaise: -fees.totalPaise,
          description: 'Entry fee',
          createdAt: confirmedAt,
          entries: [
            { account: EXTERNAL, amountPaise: -fees.totalPaise },
            { account: escrow(id), amountPaise: fees.entryFeePaise },
            { account: PLATFORM, amountPaise: fees.platformFeePaise },
          ],
        });
      }

      const role = key === DEMO.key ? spec.demo : undefined;
      const submitted =
        role === 'submitted' ||
        role === 'winner' ||
        (role === undefined && i < Math.round(keys.length * spec.submitted));
      const captions = CAPTIONS[spec.category] ?? CAPTIONS.art!;
      const submittedAt = submitted
        ? between(
            `submitted:${regId}`,
            Math.max(confirmedAt.getTime(), timeline.submissionStartsAt.getTime()),
            clock - HOUR,
          )
        : null;
      const submission: SeedSubmission | null =
        submitted || role === 'draft' || i % 2 === 0
          ? {
              id: seedId(`submission:${regId}`),
              status: submitted ? 'SUBMITTED' : 'DRAFT',
              media: submitted || role === 'draft' ? MEDIA[(index + i) % MEDIA.length]! : null,
              // The demo draft is two thirds done: media and rules, caption still to write.
              caption: submitted ? captions[i % captions.length]! : null,
              rulesAccepted: submitted || role === 'draft',
              submittedAt,
              updatedAt: submittedAt ?? new Date(confirmedAt.getTime() + HOUR),
              scoreTenths: null,
              scoreComment: null,
              rank: null,
              prizePaise: 0,
            }
          : null;
      return {
        id: regId,
        creatorId: userId(key),
        idempotencyKey,
        amountPaise: paid ? fees.totalPaise : 0,
        confirmedAt,
        orderId,
        providerOrderId: orderId ? providerRef('order', orderId) : null,
        submission,
      };
    });

    // Prize pool funding: always captured before the competition went public (FR-HS-06).
    const fundingOrderId = seedId(`order:funding:${id}`);
    const funding = {
      orderId: fundingOrderId,
      providerOrderId: providerRef('order', fundingOrderId),
      idempotencyKey: `fund:${id}:seed`,
      requestedAt: new Date(publishedAt.getTime() - 5 * 60_000),
    };
    orders.push({
      id: fundingOrderId,
      purpose: 'PRIZE_FUNDING',
      referenceId: id,
      competitionId: id,
      payerId: hostId,
      amountPaise: prizePoolPaise,
      platformFeePaise: 0,
      idempotencyKey: funding.idempotencyKey,
      providerOrderId: funding.providerOrderId,
      providerPaymentId: providerRef('pay', fundingOrderId),
      capturedAt: publishedAt,
    });
    postings.push({
      id: seedId(`ledger:PRIZE_FUNDING:${fundingOrderId}`),
      kind: 'PRIZE_FUNDING',
      referenceId: fundingOrderId,
      subjectUserId: hostId,
      competitionId: id,
      displayAmountPaise: -prizePoolPaise,
      description: 'Prize pool funding',
      createdAt: publishedAt,
      entries: [
        { account: EXTERNAL, amountPaise: -prizePoolPaise },
        { account: escrow(id), amountPaise: prizePoolPaise },
      ],
    });

    if (resultsPublishedAt) {
      publishResults(
        spec,
        id,
        hostId,
        registrations,
        prizeTiers,
        entryFeePaise,
        resultsPublishedAt,
        postings,
      );
    }

    competitions.push({
      id,
      slug: spec.slug,
      hostId,
      status: resultsPublishedAt ? 'RESULTS_PUBLISHED' : 'PUBLISHED',
      title: spec.title,
      description: spec.description,
      categorySlug: spec.category,
      cover: spec.cover,
      featured: !!spec.featured,
      prizePoolPaise,
      entryFeePaise,
      platformFeePaise: fees.platformFeePaise,
      maxSpots: spec.spots,
      startAt,
      durationDays: spec.days,
      timeline,
      prizeTiers,
      publishedAt,
      resultsPublishedAt,
      createdAt: new Date(publishedAt.getTime() - DAY),
      funding,
      registrations,
      notifySubscriberIds: [],
    });
  });

  competitions.push({
    id: seedId(`competition:${DEMO_DRAFT.slug}`),
    slug: DEMO_DRAFT.slug,
    hostId: userId(DEMO.key),
    status: 'DRAFT',
    title: DEMO_DRAFT.title,
    description: DEMO_DRAFT.description,
    categorySlug: DEMO_DRAFT.category,
    cover: null,
    featured: false,
    prizePoolPaise: DEMO_DRAFT.prizeRupees * 100,
    entryFeePaise: null,
    platformFeePaise: null,
    maxSpots: null,
    startAt: null,
    durationDays: null,
    timeline: null,
    prizeTiers: computePrizeTiers(DEMO_DRAFT.prizeRupees * 100),
    publishedAt: null,
    resultsPublishedAt: null,
    createdAt: new Date(t0 - 2 * HOUR),
    funding: null,
    registrations: [],
    notifySubscriberIds: [],
  });

  return { users, competitions, orders, postings, notifications: demoNotifications(competitions, postings) };
}

/**
 * Mirrors JudgingService.publishResults and the Payment consumer: rank by score (ties to
 * the earlier submission, A-28), pay tiers from escrow, return unawarded tiers and credit
 * the host's entry-fee revenue (A-10, A-29).
 */
function publishResults(
  spec: CompetitionSpec,
  competitionId: string,
  hostId: string,
  registrations: SeedRegistration[],
  tiers: PrizeTier[],
  entryFeePaise: number,
  at: Date,
  postings: SeedPosting[],
): void {
  const entries = registrations.filter((r) => r.submission?.status === 'SUBMITTED');
  for (const r of entries) {
    const s = r.submission!;
    s.scoreTenths = r.creatorId === userId(DEMO.key) ? 94 : 50 + Math.floor(seedRandom(`score:${s.id}`) * 43);
    s.scoreComment =
      s.scoreTenths >= 80 ? 'Confident and clean — great work.' : 'Good energy; tighten the timing.';
  }
  const ranked = [...entries].sort(
    (a, b) =>
      b.submission!.scoreTenths! - a.submission!.scoreTenths! ||
      a.submission!.submittedAt!.getTime() - b.submission!.submittedAt!.getTime(),
  );
  ranked.forEach((r, i) => {
    r.submission!.rank = i + 1;
    r.submission!.prizePaise = tiers[i]?.amountPaise ?? 0;
    if (i < tiers.length) {
      postings.push({
        id: seedId(`ledger:PRIZE:${r.id}`),
        kind: 'PRIZE',
        referenceId: r.id,
        subjectUserId: r.creatorId,
        competitionId,
        displayAmountPaise: tiers[i]!.amountPaise,
        description: `Prize — rank ${i + 1} in ${spec.title}`,
        createdAt: at,
        entries: [
          { account: escrow(competitionId), amountPaise: -tiers[i]!.amountPaise },
          { account: wallet(r.creatorId), amountPaise: tiers[i]!.amountPaise },
        ],
      });
    }
  });
  const unawarded = tiers.slice(ranked.length).reduce((sum, t) => sum + t.amountPaise, 0);
  const revenue = entryFeePaise * registrations.length;
  for (const [kind, amount, description] of [
    ['UNAWARDED_RETURN', unawarded, `Unawarded prizes returned: ${spec.title}`],
    ['HOST_REVENUE', revenue, `Entry fees earned: ${spec.title}`],
  ] as const) {
    if (amount <= 0) continue;
    postings.push({
      id: seedId(`ledger:${kind}:${competitionId}`),
      kind,
      referenceId: competitionId,
      subjectUserId: hostId,
      competitionId,
      displayAmountPaise: amount,
      description,
      createdAt: at,
      entries: [
        { account: escrow(competitionId), amountPaise: -amount },
        { account: wallet(hostId), amountPaise: amount },
      ],
    });
  }
}

/** A few notifications for the demo user, worded exactly like the Notification service's. */
function demoNotifications(competitions: SeedCompetition[], postings: SeedPosting[]): SeedNotification[] {
  const demoId = userId(DEMO.key);
  const bySlug = (slug: string) => competitions.find((c) => c.slug === slug)!;
  const won = bySlug('bollywood-freestyle');
  const dance = bySlug('feedants-classical-dance');
  const walk = bySlug('monsoon-photo-walk');
  const prize = postings.find(
    (p) => p.kind === 'PRIZE' && p.subjectUserId === demoId && p.competitionId === won.id,
  )!;
  const rank = won.registrations.find((r) => r.creatorId === demoId)!.submission!.rank!;
  const note = (
    key: string,
    type: NotificationType,
    title: string,
    body: string,
    target: NotificationTarget,
    createdAt: Date,
    read: boolean,
  ): SeedNotification => ({
    id: seedId(`notification:${key}`),
    userId: demoId,
    type,
    title,
    body,
    target,
    sourceEventId: seedId(`event:${key}`),
    read,
    createdAt,
  });
  return [
    note(
      'demo-won',
      'PRIZE_WON',
      'You won! 🏆',
      `You placed #${rank} in ${won.title} and won ${formatInr(prize.displayAmountPaise)}. It's in your wallet.`,
      { screen: 'wallet' },
      won.resultsPublishedAt!,
      false,
    ),
    note(
      'demo-results',
      'RESULTS_PUBLISHED',
      'Results are out',
      `See where you placed in ${won.title}.`,
      { screen: 'leaderboard', competitionId: won.id },
      won.resultsPublishedAt!,
      true,
    ),
    note(
      'demo-walk-live',
      'COMPETITION_PUBLISHED',
      "You're live!",
      `${walk.title} is published and open to creators.`,
      { screen: 'competition', competitionId: walk.id },
      walk.publishedAt!,
      true,
    ),
    note(
      'demo-dance-in',
      'REGISTRATION_CONFIRMED',
      "You're in!",
      `Your spot in ${dance.title} is confirmed. Good luck!`,
      { screen: 'competition', competitionId: dance.id },
      dance.registrations.find((r) => r.creatorId === demoId)!.confirmedAt,
      false,
    ),
  ];
}
