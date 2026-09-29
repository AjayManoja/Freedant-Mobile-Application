import { derivePhase, submissionChecklist } from '@feedants/shared';
import { buildDataset, DEMO_EMAIL } from './dataset';
import { seedId } from './ids';

const now = new Date('2026-09-29T10:17:00Z');
const data = buildDataset(now);
const demo = data.users.find((u) => u.email === DEMO_EMAIL)!;
const escrowBalance = (competitionId: string) =>
  data.postings
    .flatMap((p) => p.entries)
    .filter((e) => e.account.type === 'ESCROW' && e.account.ownerId === competitionId)
    .reduce((s, e) => s + e.amountPaise, 0);

describe('seed dataset', () => {
  it('is deterministic within the hour', () => {
    expect(buildDataset(new Date('2026-09-29T10:59:00Z'))).toEqual(data);
    expect(seedId('x')).toBe(seedId('x'));
    expect(seedId('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('never reuses an id', () => {
    const ids = [
      ...data.users.map((u) => u.id),
      ...data.competitions.map((c) => c.id),
      ...data.competitions.flatMap((c) =>
        c.registrations.flatMap((r) => [r.id, r.submission?.id ?? r.id + 's']),
      ),
      ...data.orders.map((o) => o.id),
      ...data.postings.map((p) => p.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(data.users.map((u) => u.email)).size).toBe(data.users.length);
  });

  it('posts only balanced ledger transactions, once per (kind, reference)', () => {
    for (const p of data.postings) expect(p.entries.reduce((s, e) => s + e.amountPaise, 0)).toBe(0);
    const keys = data.postings.map((p) => `${p.kind}:${p.referenceId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('holds exactly the prize pool plus entry fees in escrow, and empties it at results', () => {
    for (const c of data.competitions.filter((x) => x.status !== 'DRAFT')) {
      const fees = c.registrations.length * (c.entryFeePaise ?? 0);
      expect(escrowBalance(c.id)).toBe(c.status === 'RESULTS_PUBLISHED' ? 0 : c.prizePoolPaise + fees);
    }
  });

  it('keeps every competition in the phase its story needs', () => {
    const phase = (slug: string) => {
      const c = data.competitions.find((x) => x.slug === slug)!;
      return c.status === 'RESULTS_PUBLISHED' ? 'COMPLETED' : derivePhase(c.timeline!, now);
    };
    expect(phase('feedants-classical-dance')).toBe('OPEN');
    expect(phase('acoustic-cover-battle')).toBe('OPEN');
    expect(phase('monsoon-poetry-slam')).toBe('SUBMISSIONS');
    expect(phase('sketch-of-the-week')).toBe('UPCOMING');
    expect(phase('react-ui-challenge')).toBe('JUDGING');
    expect(phase('monsoon-photo-walk')).toBe('JUDGING');
    expect(phase('bollywood-freestyle')).toBe('COMPLETED');
  });

  it('keeps registrations and submissions inside their windows and spot limits', () => {
    for (const c of data.competitions.filter((x) => x.timeline)) {
      const t = c.timeline!;
      expect(c.registrations.length).toBeLessThanOrEqual(c.maxSpots!);
      expect(c.registrations.some((r) => r.creatorId === c.hostId)).toBe(false);
      for (const r of c.registrations) {
        expect(r.confirmedAt.getTime()).toBeGreaterThanOrEqual(t.registrationOpensAt.getTime());
        expect(r.confirmedAt.getTime()).toBeLessThan(
          Math.min(now.getTime(), t.registrationClosesAt.getTime()),
        );
        const at = r.submission?.submittedAt;
        if (at) {
          expect(at.getTime()).toBeGreaterThanOrEqual(t.submissionStartsAt.getTime());
          expect(at.getTime()).toBeLessThan(t.submissionEndsAt.getTime());
        }
      }
    }
  });

  it('gives the demo user something in every flow', () => {
    const mine = data.competitions.flatMap((c) =>
      c.registrations.filter((r) => r.creatorId === demo.id).map((r) => ({ c, s: r.submission! })),
    );
    const draft = mine.find((m) => m.s.status === 'DRAFT')!;
    expect(
      submissionChecklist({
        mediaKey: draft.s.media,
        caption: draft.s.caption,
        rulesAccepted: draft.s.rulesAccepted,
      }).percent,
    ).toBe(67);
    expect(mine.find((m) => m.c.slug === 'bollywood-freestyle')!.s.rank).toBe(1);
    expect(
      data.competitions
        .filter((c) => c.hostId === demo.id)
        .map((c) => c.status)
        .sort(),
    ).toEqual(['DRAFT', 'PUBLISHED']);
    expect(data.notifications.every((n) => n.userId === demo.id)).toBe(true);
  });
});
