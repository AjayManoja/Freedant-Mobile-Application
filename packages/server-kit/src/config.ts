import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );

/** Environment every service needs. Services extend it with their own keys. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Express "trust proxy" value; Nginx sits in front on the internal Docker network. */
  TRUST_PROXY: z.string().default('loopback, linklocal, uniquelocal'),
  CORS_ORIGINS: csv,
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  RABBITMQ_URL: z.url(),
  JWT_ISSUER: z.string().min(1).default('feedants-identity'),
  JWT_AUDIENCE: z.string().min(1).default('feedants'),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  CONSUMER_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  CONSUMER_RETRY_DELAY_MS: z.coerce.number().int().positive().default(5_000),
});
export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Validates the environment at startup and fails fast (NFR-MT-03).
 * The error lists which keys are wrong, never their values, so secrets stay out of logs.
 */
export function loadEnv<S extends z.ZodType>(schema: S, env: NodeJS.ProcessEnv = process.env): z.infer<S> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const ENV = Symbol('ENV');
