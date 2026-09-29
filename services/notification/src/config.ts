import { baseEnvSchema, loadEnv } from '@feedants/server-kit';
import { z } from 'zod';

export const notificationEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3004),
  JWKS_URL: z.url(),
});

export type NotificationEnv = z.infer<typeof notificationEnvSchema>;

export const loadNotificationEnv = (env: NodeJS.ProcessEnv = process.env): NotificationEnv =>
  loadEnv(notificationEnvSchema, env);
