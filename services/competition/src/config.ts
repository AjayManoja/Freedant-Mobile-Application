import { baseEnvSchema, loadEnv, storageEnvSchema } from '@feedants/server-kit';
import { defaultRules } from '@feedants/shared';
import { z } from 'zod';

export const competitionEnvSchema = baseEnvSchema.extend(storageEnvSchema.shape).extend({
  PORT: z.coerce.number().int().positive().default(3002),
  JWKS_URL: z.url(),

  PAYMENT_INTERNAL_URL: z.url(),
  INTERNAL_API_TOKEN: z.string().min(16),
  PAYMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),

  HOLD_TTL_MINUTES: z.coerce.number().int().positive().default(defaultRules.holdTtlMinutes),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(defaultRules.platformFeePercent),
  MIN_START_LEAD_MINUTES: z.coerce.number().int().nonnegative().default(defaultRules.schedule.minLeadMinutes),
  FUNDING_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30),

  SWEEPS_ENABLED: z.stringbool().default(true),
  HOLD_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  OPENING_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  FUNDING_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),

  HOME_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(60),
  TRENDING_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
  ENDING_SOON_WINDOW_HOURS: z.coerce.number().int().positive().default(48),
  HOME_SECTION_SIZE: z.coerce.number().int().positive().default(10),
});

export type CompetitionEnv = z.infer<typeof competitionEnvSchema>;

export const loadCompetitionEnv = (env: NodeJS.ProcessEnv = process.env) =>
  loadEnv(competitionEnvSchema, env);

/** Shared rule defaults with this service's configured overrides applied. */
export function rulesFrom(env: CompetitionEnv) {
  return {
    ...defaultRules,
    platformFeePercent: env.PLATFORM_FEE_PERCENT,
    holdTtlMinutes: env.HOLD_TTL_MINUTES,
    schedule: { ...defaultRules.schedule, minLeadMinutes: env.MIN_START_LEAD_MINUTES },
  };
}
export type Rules = ReturnType<typeof rulesFrom>;
export const RULES = Symbol('RULES');
