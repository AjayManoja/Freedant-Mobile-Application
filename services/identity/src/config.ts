import { baseEnvSchema, loadEnv, storageEnvSchema } from '@feedants/server-kit';
import { defaultRules } from '@feedants/shared';
import { z } from 'zod';

export const identityEnvSchema = baseEnvSchema.extend(storageEnvSchema.shape).extend({
  PORT: z.coerce.number().int().positive().default(3001),

  /** RS256 private key (PKCS#8 PEM). Required in production; generated per boot in development. */
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_KEY_ID: z.string().default('dev'),
  /** Public keys still accepted during a rotation grace window, as a JSON array of JWKs. */
  JWT_PREVIOUS_PUBLIC_JWKS: z.string().default('[]'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** HMAC key for OTP hashes, so a Redis dump cannot be brute-forced offline. */
  OTP_PEPPER: z.string().min(16),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_REQUESTS_PER_EMAIL_PER_HOUR: z.coerce.number().int().positive().default(5),
  OTP_REQUESTS_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(20),
  OTP_VERIFY_PER_IP_PER_15_MIN: z.coerce.number().int().positive().default(30),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('Feedants <no-reply@feedants.local>'),

  AVATAR_MAX_BYTES: z.coerce.number().int().positive().default(defaultRules.avatarMaxBytes),
});

export type IdentityEnv = z.infer<typeof identityEnvSchema>;

export const loadIdentityEnv = (env: NodeJS.ProcessEnv = process.env) => {
  const parsed = loadEnv(identityEnvSchema, env);
  if (parsed.NODE_ENV === 'production' && !parsed.JWT_PRIVATE_KEY) {
    throw new Error('Invalid environment configuration:\n✖ JWT_PRIVATE_KEY is required in production');
  }
  return parsed;
};
