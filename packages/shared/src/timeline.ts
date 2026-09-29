import { defaultRules } from './rules';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Timeline {
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  submissionStartsAt: Date;
  submissionEndsAt: Date;
  resultsDueAt: Date;
}

/**
 * A-14: the wizard collects start S and duration D; everything else is derived.
 * Registration closes at S + ⌈D / divisor⌉ days so late joiners still have time to submit.
 */
export function deriveTimeline(
  start: Date,
  durationDays: number,
  schedule: { registrationCloseDivisor: number; judgingWindowDays: number } = defaultRules.schedule,
): Timeline {
  const s = start.getTime();
  return {
    registrationOpensAt: new Date(s),
    submissionStartsAt: new Date(s),
    registrationClosesAt: new Date(s + Math.ceil(durationDays / schedule.registrationCloseDivisor) * DAY_MS),
    submissionEndsAt: new Date(s + durationDays * DAY_MS),
    resultsDueAt: new Date(s + (durationDays + schedule.judgingWindowDays) * DAY_MS),
  };
}

export type Phase = 'UPCOMING' | 'OPEN' | 'SUBMISSIONS' | 'JUDGING';

export interface PhaseWindows {
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  submissionStartsAt: Date;
  submissionEndsAt: Date;
}

export const isRegistrationOpen = (t: PhaseWindows, now: Date): boolean =>
  now >= t.registrationOpensAt && now < t.registrationClosesAt;

export const isSubmissionOpen = (t: PhaseWindows, now: Date): boolean =>
  now >= t.submissionStartsAt && now < t.submissionEndsAt;

export const isJudging = (t: PhaseWindows, now: Date): boolean => now >= t.submissionEndsAt;

/**
 * SRS §2.5. Windows overlap (registration and submissions both open from S), so OPEN wins
 * while registration is still possible — that is what matters most to a visitor.
 */
export function derivePhase(t: PhaseWindows, now: Date): Phase {
  if (now < t.registrationOpensAt) return 'UPCOMING';
  if (isRegistrationOpen(t, now)) return 'OPEN';
  if (isSubmissionOpen(t, now)) return 'SUBMISSIONS';
  return 'JUDGING';
}
