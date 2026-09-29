import { baseEnvSchema, loadEnv } from '@feedants/server-kit';
import { z } from 'zod';

export const paymentEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3003),
  JWKS_URL: z.url(),
  INTERNAL_API_TOKEN: z.string().min(16),

  /** `fake` runs the whole flow without Razorpay (local demos, tests; R-12 contingency). */
  PAYMENT_PROVIDER: z.enum(['razorpay', 'fake']).default('fake'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_API_URL: z.url().default('https://api.razorpay.com/v1'),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  REFUND_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  REFUND_MAX_ATTEMPTS: z.coerce.number().int().positive().default(8),
  RECONCILIATION_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 3_600_000),
  WORKERS_ENABLED: z.stringbool().default(true),
});

export type PaymentEnv = z.infer<typeof paymentEnvSchema>;

export function loadPaymentEnv(env: NodeJS.ProcessEnv = process.env): PaymentEnv {
  const parsed = loadEnv(paymentEnvSchema, env);
  if (parsed.PAYMENT_PROVIDER === 'razorpay') {
    const missing = (['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const).filter(
      (k) => !parsed[k],
    );
    if (missing.length > 0) {
      throw new Error(
        `Invalid environment configuration:\n✖ ${missing.join(', ')} required when PAYMENT_PROVIDER=razorpay`,
      );
    }
    // C-1 / A-7: the system never runs against live money.
    if (!parsed.RAZORPAY_KEY_ID!.startsWith('rzp_test_')) {
      throw new Error(
        'Invalid environment configuration:\n✖ RAZORPAY_KEY_ID must be a test-mode key (rzp_test_…)',
      );
    }
  }
  return parsed;
}
