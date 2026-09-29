import { derivePhase, deriveTimeline, isRegistrationOpen, isSubmissionOpen } from './timeline';

const start = new Date('2026-10-01T10:00:00Z');
const at = (iso: string) => new Date(iso);

describe('deriveTimeline (A-14)', () => {
  it('derives a one-week timeline', () => {
    const t = deriveTimeline(start, 7);
    expect(t.registrationOpensAt.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(t.submissionStartsAt.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(t.registrationClosesAt.toISOString()).toBe('2026-10-04T10:00:00.000Z'); // ⌈7/3⌉ = 3
    expect(t.submissionEndsAt.toISOString()).toBe('2026-10-08T10:00:00.000Z');
    expect(t.resultsDueAt.toISOString()).toBe('2026-10-10T10:00:00.000Z');
  });

  it.each([
    [3, 1],
    [14, 5],
    [30, 10],
  ])('closes registration for a %i-day competition after %i days', (days, closeDays) => {
    const t = deriveTimeline(start, days);
    expect((t.registrationClosesAt.getTime() - start.getTime()) / 86_400_000).toBe(closeDays);
  });
});

describe('derivePhase (SRS §2.5)', () => {
  const t = deriveTimeline(start, 7);

  it.each([
    ['2026-09-30T10:00:00Z', 'UPCOMING'],
    ['2026-10-01T10:00:00Z', 'OPEN'],
    ['2026-10-04T09:59:59Z', 'OPEN'],
    ['2026-10-04T10:00:00Z', 'SUBMISSIONS'],
    ['2026-10-08T09:59:59Z', 'SUBMISSIONS'],
    ['2026-10-08T10:00:00Z', 'JUDGING'],
  ])('at %s is %s', (now, phase) => {
    expect(derivePhase(t, at(now))).toBe(phase);
  });

  it('lets registered creators submit while registration is still open', () => {
    const now = at('2026-10-02T00:00:00Z');
    expect(isRegistrationOpen(t, now)).toBe(true);
    expect(isSubmissionOpen(t, now)).toBe(true);
  });
});
