import { z } from 'zod';
import { defaultRules } from '../rules';
import { emailSchema } from './common';

const t = defaultRules.text;

export const requestOtpSchema = z.strictObject({ email: emailSchema });
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.strictObject({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const displayNameSchema = z.string().trim().min(t.displayNameMin).max(t.displayNameMax);

export const completeSignupSchema = z.strictObject({ displayName: displayNameSchema });
export type CompleteSignupInput = z.infer<typeof completeSignupSchema>;

export const refreshTokenSchema = z.strictObject({ refreshToken: z.string().min(20).max(512) });
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const updateProfileSchema = z
  .strictObject({
    displayName: displayNameSchema.optional(),
    bio: z.string().trim().max(t.bioMax).nullable().optional(),
    /** Object key returned by the avatar upload-URL endpoint, or null to remove the avatar. */
    avatarKey: z.string().max(512).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface RequestOtpResponse {
  /** Seconds until another code may be requested. */
  resendAfterSeconds: number;
  expiresInSeconds: number;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface VerifyOtpResponse extends AuthTokens {
  /** True until the user has chosen a display name (US-02). */
  needsDisplayName: boolean;
  user: MeResponse;
}

export interface MeResponse {
  id: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}
