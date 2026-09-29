/**
 * Business-rule defaults from docs/01-requirements/ASSUMPTIONS.md.
 * Services may override any value through validated environment config;
 * the mobile app uses the same defaults to validate forms before calling the API.
 */
export const MB = 1024 * 1024;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a'] as const;
export const VIDEO_TYPES = ['video/mp4'] as const;

export type MediaKind = 'IMAGE' | 'AUDIO' | 'VIDEO';

export interface PrizeTierRule {
  /** Pools at or above this amount use this rule. */
  minPoolPaise: number;
  /** Share of the pool per rank, in basis points; must sum to 10,000. */
  weightsBps: number[];
}

export interface RulesConfig {
  currency: string;
  platformFeePercent: number;
  prizePool: { minPaise: number; maxPaise: number; presetsPaise: readonly number[] };
  entryFee: { minPaise: number; maxPaise: number };
  prizeTiers: PrizeTierRule[];
  prizeRoundingPaise: number;
  schedule: {
    minLeadMinutes: number;
    durationsDays: readonly number[];
    registrationCloseDivisor: number;
    judgingWindowDays: number;
  };
  spots: { min: number; max: number };
  holdTtlMinutes: number;
  media: Record<MediaKind, { maxBytes: number; contentTypes: readonly string[] }>;
  avatarMaxBytes: number;
  submission: { captionMinLength: number };
  score: { min: number; max: number };
  text: {
    titleMin: number;
    titleMax: number;
    descriptionMax: number;
    displayNameMin: number;
    displayNameMax: number;
    bioMax: number;
    captionMax: number;
    commentMax: number;
  };
  searchMinLength: number;
  pagination: { defaultLimit: number; maxLimit: number };
}

export const defaultRules: RulesConfig = {
  currency: 'INR',
  /** A-8: platform fee as a percentage of the entry fee, rounded to the nearest rupee. */
  platformFeePercent: 10,
  /** A-12 */
  prizePool: {
    minPaise: 50_000,
    maxPaise: 10_000_000,
    presetsPaise: [250_000, 500_000, 1_000_000, 2_500_000],
  },
  /** A-12: ₹0 (free) or within these bounds. */
  entryFee: { minPaise: 1_000, maxPaise: 500_000 },
  /** A-11: highest threshold first. Weights mirror the prototype. */
  prizeTiers: [
    { minPoolPaise: 600_000, weightsBps: [3200, 2200, 1700, 1300, 900, 700] },
    { minPoolPaise: 300_000, weightsBps: [3600, 2400, 1800, 1300, 900] },
    { minPoolPaise: 120_000, weightsBps: [4000, 2600, 1900, 1500] },
    { minPoolPaise: 0, weightsBps: [5000, 3000, 2000] },
  ],
  /** A-11: tier amounts are rounded to ₹10. */
  prizeRoundingPaise: 1_000,
  /** A-14, A-16 */
  schedule: {
    minLeadMinutes: 60,
    durationsDays: [3, 7, 14, 30],
    registrationCloseDivisor: 3,
    judgingWindowDays: 2,
  },
  /** A-16 */
  spots: { min: 2, max: 10_000 },
  /** A-22 */
  holdTtlMinutes: 10,
  /** A-23 */
  media: {
    IMAGE: { maxBytes: 10 * MB, contentTypes: IMAGE_TYPES as readonly string[] },
    AUDIO: { maxBytes: 20 * MB, contentTypes: AUDIO_TYPES as readonly string[] },
    VIDEO: { maxBytes: 100 * MB, contentTypes: VIDEO_TYPES as readonly string[] },
  },
  /** Cover images and avatars are images. */
  avatarMaxBytes: 5 * MB,
  /** A-24 */
  submission: { captionMinLength: 10 },
  /** FR-JG-02 */
  score: { min: 0, max: 10 },
  /** FR-HS-02, US-02 */
  text: {
    titleMin: 5,
    titleMax: 80,
    descriptionMax: 2_000,
    displayNameMin: 2,
    displayNameMax: 40,
    bioMax: 280,
    captionMax: 1_000,
    commentMax: 1_000,
  },
  /** FR-DS-04 */
  searchMinLength: 2,
  pagination: { defaultLimit: 20, maxLimit: 50 },
};

export type Rules = RulesConfig;
