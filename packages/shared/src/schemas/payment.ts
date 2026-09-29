import { z } from 'zod';
import { defaultRules } from '../rules';

export const orderPurposeSchema = z.enum(['ENTRY_FEE', 'PRIZE_FUNDING']);
export type OrderPurpose = z.infer<typeof orderPurposeSchema>;

/**
 * Competition → Payment (the only synchronous cross-service call, HLD §2). The amount is
 * computed by Competition from its own records; nothing here comes from the mobile app.
 */
export const createOrderSchema = z.strictObject({
  purpose: orderPurposeSchema,
  /** Registration ID (entry fee) or competition ID (prize funding). */
  referenceId: z.uuid(),
  competitionId: z.uuid(),
  payerId: z.uuid(),
  amountPaise: z.number().int().positive(),
  /** Part of amountPaise kept by the platform (A-8); 0 for prize funding. */
  platformFeePaise: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(8).max(100),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export interface CreateOrderResponse {
  orderId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string;
}

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

// ---------------------------------------------------------------- Wallet (FR-PY-07)

export type LedgerKind =
  'ENTRY_FEE' | 'PRIZE_FUNDING' | 'REFUND' | 'PRIZE' | 'HOST_REVENUE' | 'UNAWARDED_RETURN' | 'ESCROW_RETURN';

export const walletFilterKinds = {
  all: null,
  earnings: ['PRIZE', 'HOST_REVENUE', 'UNAWARDED_RETURN', 'ESCROW_RETURN'],
  entries: ['ENTRY_FEE', 'PRIZE_FUNDING'],
  refunds: ['REFUND'],
} as const satisfies Record<string, readonly LedgerKind[] | null>;

export const walletHistoryQuerySchema = z.strictObject({
  filter: z.enum(['all', 'earnings', 'entries', 'refunds']).default('all'),
  cursor: z.string().max(512).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(defaultRules.pagination.maxLimit)
    .default(defaultRules.pagination.defaultLimit),
});
export type WalletHistoryQuery = z.infer<typeof walletHistoryQuerySchema>;

export interface WalletSummary {
  /** Sum of the user's wallet ledger entries (US-30). */
  balancePaise: number;
  totalWinningsPaise: number;
  currency: 'INR';
}

export interface WalletTransaction {
  id: string;
  kind: LedgerKind;
  /** Signed from the user's point of view: negative = money out (e.g. an entry fee paid by card). */
  amountPaise: number;
  /** True when it changed the wallet balance (card payments and card refunds don't). */
  affectsBalance: boolean;
  description: string;
  competitionId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- Dev-only fake provider

export const simulatePaymentSchema = z.strictObject({
  providerOrderId: z.string().min(1).max(100),
  outcome: z.enum(['captured', 'failed']),
});
export type SimulatePaymentInput = z.infer<typeof simulatePaymentSchema>;
