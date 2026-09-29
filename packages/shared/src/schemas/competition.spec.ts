import {
  draftIssues,
  entryFeeSchema,
  scoreSchema,
  submissionChecklist,
  draftUpdateSchema,
} from './competition';

const now = new Date('2026-10-01T10:00:00Z');
const complete = {
  title: 'Monsoon Poetry Slam',
  categoryId: 4,
  prizePoolPaise: 500_000,
  entryFeePaise: 9_900,
  startAt: '2026-10-02T10:00:00Z',
  durationDays: 7,
  maxSpots: 100,
};

describe('draftIssues (FR-HS-01)', () => {
  it('is empty for a complete draft', () => {
    expect(draftIssues(complete, now)).toEqual([]);
  });

  it('reports each missing field against its wizard step', () => {
    const issues = draftIssues(
      {
        title: null,
        categoryId: null,
        prizePoolPaise: null,
        entryFeePaise: null,
        startAt: null,
        durationDays: null,
        maxSpots: null,
      },
      now,
    );
    expect(issues.map((i) => `${i.step}:${i.field}`)).toEqual([
      'BASICS:title',
      'BASICS:categoryId',
      'PRIZE:prizePoolPaise',
      'PRIZE:entryFeePaise',
      'SCHEDULE:startAt',
      'SCHEDULE:durationDays',
      'SCHEDULE:maxSpots',
    ]);
  });

  it('requires the start to be at least the lead time away (A-16)', () => {
    expect(draftIssues({ ...complete, startAt: '2026-10-01T10:30:00Z' }, now)).toHaveLength(1);
    expect(draftIssues({ ...complete, startAt: '2026-10-01T11:00:00Z' }, now)).toHaveLength(0);
  });
});

describe('wizard field rules (FR-HS-02..04, A-12, A-16)', () => {
  it('accepts free or bounded whole-rupee entry fees', () => {
    expect(entryFeeSchema.safeParse(0).success).toBe(true);
    expect(entryFeeSchema.safeParse(1_000).success).toBe(true);
    expect(entryFeeSchema.safeParse(900).success).toBe(false);
    expect(entryFeeSchema.safeParse(1_050).success).toBe(false);
    expect(entryFeeSchema.safeParse(500_100).success).toBe(false);
  });

  it('rejects out-of-range values and unknown fields', () => {
    expect(draftUpdateSchema.safeParse({ prizePoolPaise: 40_000 }).success).toBe(false);
    expect(draftUpdateSchema.safeParse({ durationDays: 5 }).success).toBe(false);
    expect(draftUpdateSchema.safeParse({ maxSpots: 1 }).success).toBe(false);
    expect(draftUpdateSchema.safeParse({ title: 'Nice title', hostId: 'x' }).success).toBe(false);
  });
});

describe('submissionChecklist (A-24)', () => {
  it('counts media, caption of 10+ characters and rules', () => {
    expect(submissionChecklist({ mediaKey: null, caption: null, rulesAccepted: false }).percent).toBe(0);
    expect(submissionChecklist({ mediaKey: 'k', caption: 'short', rulesAccepted: false }).percent).toBe(33);
    expect(
      submissionChecklist({ mediaKey: 'k', caption: 'long enough caption', rulesAccepted: false }).percent,
    ).toBe(67);
    expect(
      submissionChecklist({ mediaKey: 'k', caption: 'long enough caption', rulesAccepted: true }).percent,
    ).toBe(100);
  });
});

describe('scoreSchema (FR-JG-02)', () => {
  it.each([
    [0, true],
    [10, true],
    [7.5, true],
    [9.9, true],
    [7.25, false],
    [-1, false],
    [10.1, false],
  ])('score %p valid: %p', (score, ok) => {
    expect(scoreSchema.safeParse({ score }).success).toBe(ok);
  });
});
