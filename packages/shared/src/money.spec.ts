import { computePrizeTiers, feeBreakdown, formatInr, platformFee, rupeesToPaise } from './money';

describe('computePrizeTiers (A-11)', () => {
  it.each([
    [rupeesToPaise(500), 3],
    [rupeesToPaise(1_199), 3],
    [rupeesToPaise(1_200), 4],
    [rupeesToPaise(2_999), 4],
    [rupeesToPaise(3_000), 5],
    [rupeesToPaise(5_999), 5],
    [rupeesToPaise(6_000), 6],
    [rupeesToPaise(100_000), 6],
  ])('pool %i paise has %i winners', (pool, winners) => {
    expect(computePrizeTiers(pool)).toHaveLength(winners);
  });

  it('always sums exactly to the pool, for every rupee amount in range', () => {
    for (let rupees = 500; rupees <= 100_000; rupees += 7) {
      const pool = rupeesToPaise(rupees);
      const total = computePrizeTiers(pool).reduce((s, t) => s + t.amountPaise, 0);
      expect(total).toBe(pool);
    }
  });

  it('matches the prototype split for ₹5,000', () => {
    expect(computePrizeTiers(rupeesToPaise(5_000)).map((t) => t.amountPaise / 100)).toEqual([
      1800, 1200, 900, 650, 450,
    ]);
  });

  it('gives the rounding remainder to first place', () => {
    const tiers = computePrizeTiers(rupeesToPaise(1_205));
    // Raw tiers round to 480/310/230/180 = 1,200; the ₹5 remainder goes to 1st.
    expect(tiers.map((t) => t.amountPaise / 100)).toEqual([485, 310, 230, 180]);
  });

  it('ranks tiers from 1 in descending amount order', () => {
    const tiers = computePrizeTiers(rupeesToPaise(25_000));
    expect(tiers.map((t) => t.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i - 1]!.amountPaise).toBeGreaterThanOrEqual(tiers[i]!.amountPaise);
    }
  });

  it('rejects non-positive or fractional pools', () => {
    expect(() => computePrizeTiers(0)).toThrow(RangeError);
    expect(() => computePrizeTiers(10.5)).toThrow(RangeError);
  });
});

describe('platform fee (A-8)', () => {
  it('is 10% of the entry fee rounded to the nearest rupee', () => {
    expect(platformFee(rupeesToPaise(99))).toBe(rupeesToPaise(10));
    expect(platformFee(rupeesToPaise(94))).toBe(rupeesToPaise(9));
    expect(platformFee(rupeesToPaise(10))).toBe(rupeesToPaise(1));
  });

  it('is zero for free competitions', () => {
    expect(platformFee(0)).toBe(0);
  });

  it('adds up in the breakdown', () => {
    expect(feeBreakdown(rupeesToPaise(99))).toEqual({
      entryFeePaise: 9_900,
      platformFeePaise: 1_000,
      totalPaise: 10_900,
    });
  });
});

describe('formatInr', () => {
  it('uses Indian digit grouping', () => {
    expect(formatInr(rupeesToPaise(100_000))).toBe('₹1,00,000');
  });

  it('shows paise only when present', () => {
    expect(formatInr(10_950)).toBe('₹109.50');
    expect(formatInr(10_900)).toBe('₹109');
  });
});
