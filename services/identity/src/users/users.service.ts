import { Inject, Injectable } from '@nestjs/common';
import { AppError, ENV, extensionFor, notFound, ObjectStorage, uuidv7 } from '@feedants/server-kit';
import type {
  ImageUploadRequest,
  MeResponse,
  PublicUser,
  UpdateProfileInput,
  UploadUrlResponse,
} from '@feedants/shared';
import type { IdentityEnv } from '../config';
import type { User } from '../generated/prisma/client';
import { outbox } from '../outbox';
import { PrismaService } from '../prisma.service';

export const toMe = (u: User): MeResponse => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  bio: u.bio,
  avatarUrl: u.avatarUrl,
  createdAt: u.createdAt.toISOString(),
});

const avatarPrefix = (userId: string) => `public/avatars/${userId}/`;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage,
    @Inject(ENV) private readonly env: IdentityEnv,
  ) {}

  /** First verification creates the account; later ones sign in (FR-ID-03). */
  async findOrCreateByEmail(email: string): Promise<{ user: User; created: boolean }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return { user: existing, created: false };

    const id = uuidv7();
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const u = await tx.user.create({ data: { id, email } });
        await tx.outboxEvent.create({
          data: outbox(
            'user.created',
            { type: 'user', id },
            { userId: id, createdAt: u.createdAt.toISOString() },
          ),
        });
        return u;
      });
      return { user, created: true };
    } catch (err) {
      // Two first-time verifications racing for the same email: the other one created it.
      if ((err as { code?: string }).code === 'P2002') {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { email } });
        return { user, created: false };
      }
      throw err;
    }
  }

  async getActive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw notFound('User');
    return user;
  }

  async me(userId: string): Promise<MeResponse> {
    return toMe(await this.getActive(userId));
  }

  /** US-02: set once, right after the first verification. */
  async completeSignup(userId: string, displayName: string): Promise<MeResponse> {
    const user = await this.getActive(userId);
    if (user.displayName) throw new AppError('SIGNUP_ALREADY_COMPLETE', 'Display name already set');
    return this.update(userId, { displayName });
  }

  /** FR-ID-06. Name and avatar changes reach other services through `user.updated` (US-05). */
  async update(userId: string, input: UpdateProfileInput): Promise<MeResponse> {
    const user = await this.getActive(userId);
    const data: {
      displayName?: string;
      bio?: string | null;
      avatarKey?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.bio !== undefined) data.bio = input.bio === '' ? null : input.bio;
    if (input.avatarKey !== undefined) {
      if (input.avatarKey === null) {
        data.avatarKey = null;
        data.avatarUrl = null;
      } else {
        // Ownership: a user can only point at an object under their own prefix.
        if (!input.avatarKey.startsWith(avatarPrefix(userId))) {
          throw new AppError('FORBIDDEN', 'That upload does not belong to you');
        }
        const object = await this.storage.exists(input.avatarKey);
        if (!object) throw new AppError('VALIDATION_FAILED', 'Avatar upload not found; upload it first');
        data.avatarKey = input.avatarKey;
        data.avatarUrl = this.storage.publicUrl(input.avatarKey);
      }
    }

    const publicChanged =
      (data.displayName !== undefined && data.displayName !== user.displayName) ||
      (data.avatarUrl !== undefined && data.avatarUrl !== user.avatarUrl);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: userId }, data });
      if (publicChanged && u.displayName) {
        await tx.outboxEvent.create({
          data: outbox(
            'user.updated',
            { type: 'user', id: userId },
            { userId, displayName: u.displayName, avatarUrl: u.avatarUrl },
          ),
        });
      }
      return u;
    });
    return toMe(updated);
  }

  async avatarUploadUrl(userId: string, req: ImageUploadRequest): Promise<UploadUrlResponse> {
    await this.getActive(userId);
    if (req.sizeBytes > this.env.AVATAR_MAX_BYTES) {
      throw new AppError('VALIDATION_FAILED', 'Image is too large', { maxBytes: this.env.AVATAR_MAX_BYTES });
    }
    const key = `${avatarPrefix(userId)}${uuidv7()}.${extensionFor(req.contentType)}`;
    return this.storage.presignUpload({
      key,
      contentType: req.contentType,
      maxBytes: this.env.AVATAR_MAX_BYTES,
    });
  }

  async publicProfile(userId: string): Promise<PublicUser> {
    const user = await this.getActive(userId);
    if (!user.displayName) throw notFound('User');
    return { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, bio: user.bio };
  }

  /**
   * FR-ID-09: personal data is removed; the row stays (anonymised) so other services'
   * references — ledger entries, past results — keep pointing at a valid, anonymous owner.
   */
  async delete(userId: string): Promise<void> {
    await this.getActive(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@invalid`,
          displayName: 'Deleted user',
          bio: null,
          avatarKey: null,
          avatarUrl: null,
          status: 'DELETED',
          deletedAt: new Date(),
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.outboxEvent.create({ data: outbox('user.deleted', { type: 'user', id: userId }, { userId }) });
      await tx.outboxEvent.create({
        data: outbox(
          'user.updated',
          { type: 'user', id: userId },
          { userId, displayName: 'Deleted user', avatarUrl: null },
        ),
      });
    });
  }
}
