import { defaultRules, type PrizeTierRule } from './rules';

/** All money is integer paise (A-6). */
export type Paise = number;

export const rupeesToPaise = (rupees: number): Paise => Math.round(rupees * 100);

/** Formats paise as Indian-grouped rupees, e.g. 150000 → "₹1,500". Paise shown only when non-zero. */
export function formatInr(paise: Paise): string {
  const rupees = paise / 100;
  const hasFraction = paise % 100 !== 0;
  return (
    '₹' +
    rupees.toLocaleString('en-IN', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** A-8: platform fee is a percentage of the entry fee, rounded to the nearest rupee. */
export function platformFee(entryFeePaise: Paise, percent: number = defaultRules.platformFeePercent): Paise {
  if (entryFeePaise === 0) return 0;
  return Math.round((entryFeePaise * percent) / 100 / 100) * 100;
}

export interface FeeBreakdown {
  entryFeePaise: Paise;
  platformFeePaise: Paise;
  totalPaise: Paise;
}

/** A-8: amount charged at join = entry fee + platform fee (no GST, no promo in the MVP). */
export function feeBreakdown(entryFeePaise: Paise, percent?: number): FeeBreakdown {
  const platformFeePaise = platformFee(entryFeePaise, percent);
  return { entryFeePaise, platformFeePaise, totalPaise: entryFeePaise + platformFeePaise };
}

export interface PrizeTier {
  rank: number;
  amountPaise: Paise;
}

/**
 * A-11: number of winners and split derived from the pool. Each tier is rounded to
 * the rounding unit (₹10) and the remainder goes to 1st place, so tiers always sum
 * exactly to the pool.
 */
export function computePrizeTiers(
  poolPaise: Paise,
  table: PrizeTierRule[] = defaultRules.prizeTiers,
  roundingPaise: number = defaultRules.prizeRoundingPaise,
): PrizeTier[] {
  if (!Number.isInteger(poolPaise) || poolPaise <= 0) {
    throw new RangeError('Prize pool must be a positive integer number of paise');
  }
  const rule = [...table]
    .sort((a, b) => b.minPoolPaise - a.minPoolPaise)
    .find((r) => poolPaise >= r.minPoolPaise);
  if (!rule) throw new RangeError('No prize tier rule matches this pool');

  const amounts = rule.weightsBps.map(
    (bps) => Math.round((poolPaise * bps) / (10_000 * roundingPaise)) * roundingPaise,
  );
  const drift = poolPaise - amounts.reduce((sum, a) => sum + a, 0);
  amounts[0] = (amounts[0] ?? 0) + drift;
  return amounts.map((amountPaise, i) => ({ rank: i + 1, amountPaise }));
}
