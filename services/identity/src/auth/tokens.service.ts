import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError, ENV, uuidv7 } from '@feedants/server-kit';
import type { AuthTokens } from '@feedants/shared';
import { createHash, randomBytes } from 'node:crypto';
import type { IdentityEnv } from '../config';
import { PrismaService } from '../prisma.service';
import { SigningKeys } from './signing-keys.service';

const DAY_MS = 86_400_000;
const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: SigningKeys,
    @Inject(ENV) private readonly env: IdentityEnv,
  ) {}

  /** Starts a new session (token family) for one device sign-in. */
  async startSession(userId: string, deviceLabel?: string): Promise<AuthTokens> {
    const familyId = uuidv7();
    const refresh = await this.createRefreshToken(userId, familyId, deviceLabel);
    return this.bundle(userId, familyId, refresh);
  }

  /**
   * FR-ID-04 / US-03: every refresh rotates the token. Presenting a token that was already
   * rotated means two parties hold the family (e.g. a stolen token), so the whole family
   * is revoked and the user must sign in again.
   */
  async rotate(rawToken: string): Promise<AuthTokens> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: { select: { status: true } } },
    });
    if (!existing) throw new AppError('REFRESH_TOKEN_INVALID', 'Session expired, please sign in again');

    if (existing.revokedAt) {
      if (existing.replacedById) await this.reuseDetected(existing.familyId, existing.userId);
      throw new AppError('REFRESH_TOKEN_INVALID', 'Session expired, please sign in again');
    }
    if (existing.expiresAt <= new Date() || existing.user.status !== 'ACTIVE') {
      throw new AppError('REFRESH_TOKEN_INVALID', 'Session expired, please sign in again');
    }

    const newId = uuidv7();
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Conditional update: of two concurrent refreshes with the same token, exactly one wins.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: newId },
      });
      if (count === 0) return false;
      await tx.refreshToken.create({
        data: {
          id: newId,
          userId: existing.userId,
          familyId: existing.familyId,
          tokenHash: hashToken(raw),
          deviceLabel: existing.deviceLabel,
          expiresAt,
        },
      });
      return true;
    });
    if (!rotated) {
      await this.reuseDetected(existing.familyId, existing.userId);
      throw new AppError('REFRESH_TOKEN_INVALID', 'Session expired, please sign in again');
    }
    return this.bundle(existing.userId, existing.familyId, { raw, expiresAt });
  }

  /** FR-ID-05: sign out of this device only. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async reuseDetected(familyId: string, userId: string): Promise<void> {
    this.logger.warn({ familyId, userId }, 'Refresh token reuse detected; revoking token family');
    await this.revokeFamily(familyId);
  }

  private async createRefreshToken(userId: string, familyId: string, deviceLabel?: string) {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
    await this.prisma.refreshToken.create({
      data: {
        id: uuidv7(),
        userId,
        familyId,
        tokenHash: hashToken(raw),
        deviceLabel: deviceLabel?.slice(0, 120),
        expiresAt,
      },
    });
    return { raw, expiresAt };
  }

  private async bundle(
    userId: string,
    familyId: string,
    refresh: { raw: string; expiresAt: Date },
  ): Promise<AuthTokens> {
    const access = await this.keys.signAccessToken(userId, familyId);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken: refresh.raw,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
    };
  }
}
