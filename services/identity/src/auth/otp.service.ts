import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError, ENV, RateLimiter, REDIS } from '@feedants/server-kit';
import type { RequestOtpResponse } from '@feedants/shared';
import type { Redis } from 'ioredis';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { IdentityEnv } from '../config';
import { Mailer, otpMail } from './mailer';

const codeKey = (email: string) => `otp:code:${email}`;
const cooldownKey = (email: string) => `otp:cooldown:${email}`;

/**
 * Email OTP (FR-ID-01, FR-ID-02). Codes live in Redis with a TTL and are stored only as
 * HMAC-SHA256 digests keyed by a server-side pepper: a 6-digit space is too small for a
 * slow hash to help, whereas without the pepper a leaked digest cannot be reversed at all.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: IdentityEnv,
    private readonly limiter: RateLimiter,
    private readonly mailer: Mailer,
  ) {}

  async request(email: string, ip: string): Promise<RequestOtpResponse> {
    const env = this.env;
    await this.limiter.consume('otp-request-ip', ip, env.OTP_REQUESTS_PER_IP_PER_HOUR, 3600);
    await this.limiter.consume('otp-request-email', email, env.OTP_REQUESTS_PER_EMAIL_PER_HOUR, 3600);

    const cooldown = await this.redis.set(
      cooldownKey(email),
      '1',
      'EX',
      env.OTP_RESEND_COOLDOWN_SECONDS,
      'NX',
    );
    if (cooldown === null) {
      const ttl = await this.redis.ttl(cooldownKey(email));
      throw new AppError(
        'OTP_RESEND_TOO_SOON',
        'Please wait before requesting another code',
        undefined,
        Math.max(ttl, 1),
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    // A new code replaces any previous one, and resets its attempt counter.
    await this.redis
      .multi()
      .del(codeKey(email))
      .hset(codeKey(email), { digest: this.digest(email, code), attempts: 0 })
      .expire(codeKey(email), env.OTP_TTL_SECONDS)
      .exec();

    try {
      await this.mailer.send(otpMail(email, code, Math.round(env.OTP_TTL_SECONDS / 60)));
    } catch (err) {
      this.logger.error({ err }, 'Failed to send OTP email');
      await this.redis.del(codeKey(email), cooldownKey(email));
      throw new AppError('SERVICE_UNAVAILABLE', 'Could not send the code, please try again');
    }
    return { resendAfterSeconds: env.OTP_RESEND_COOLDOWN_SECONDS, expiresInSeconds: env.OTP_TTL_SECONDS };
  }

  /** Resolves when the code is correct; the code is then consumed. Throws a specific error otherwise. */
  async verify(email: string, code: string, ip: string): Promise<void> {
    await this.limiter.consume('otp-verify-ip', ip, this.env.OTP_VERIFY_PER_IP_PER_15_MIN, 900);

    const key = codeKey(email);
    const digest = await this.redis.hget(key, 'digest');
    if (!digest) throw new AppError('OTP_EXPIRED', 'Code expired — request a new one');

    // Count the attempt before comparing, so parallel guesses can't exceed the limit.
    const attempts = await this.redis.hincrby(key, 'attempts', 1);
    const max = this.env.OTP_MAX_ATTEMPTS;
    if (attempts > max) {
      await this.redis.del(key);
      throw new AppError('OTP_INVALIDATED', 'Too many attempts — request a new code');
    }

    if (!this.matches(digest, this.digest(email, code))) {
      if (attempts >= max) {
        await this.redis.del(key);
        throw new AppError('OTP_INVALIDATED', 'Too many attempts — request a new code');
      }
      throw new AppError('OTP_INCORRECT', 'That code is not right', { attemptsRemaining: max - attempts });
    }

    // Single use: only the caller that actually deletes the key signs in.
    const consumed = await this.redis.del(key);
    if (consumed !== 1) throw new AppError('OTP_EXPIRED', 'Code expired — request a new one');
  }

  private digest(email: string, code: string): string {
    return createHmac('sha256', this.env.OTP_PEPPER).update(`${email}:${code}`).digest('hex');
  }

  private matches(a: string, b: string): boolean {
    const x = Buffer.from(a, 'hex');
    const y = Buffer.from(b, 'hex');
    return x.length === y.length && timingSafeEqual(x, y);
  }
}
