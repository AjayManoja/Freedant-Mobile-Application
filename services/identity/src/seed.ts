/**
 * Local demo data (US-34): the users every other service's seed refers to, with avatars.
 * Idempotent — safe to run again. Run with `pnpm db:seed` after `pnpm build`.
 */
import { readFile } from 'node:fs/promises';
import { loadEnv, S3ObjectStorage, storageEnvSchema } from '@feedants/server-kit';
import { assertSeedAllowed, assetPath, buildDataset, DEMO_EMAIL } from '@feedants/seed-data';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient } from './generated/prisma/client';

async function main(): Promise<void> {
  assertSeedAllowed();
  const env = loadEnv(z.object({ DATABASE_URL: z.url() }).extend(storageEnvSchema.shape));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  const storage = new S3ObjectStorage(env);
  const { users } = buildDataset();

  let created = 0;
  try {
    for (const u of users) {
      const taken = await prisma.user.findUnique({ where: { email: u.email } });
      if (taken && taken.id !== u.id) {
        // Someone signed up with this address before seeding; their data stays untouched.
        console.warn(`skip ${u.email}: already used by another account`);
        continue;
      }
      let avatarKey: string | null = null;
      if (u.avatar) {
        avatarKey = `public/avatars/${u.id}/seed.jpg`;
        await storage.putObject(avatarKey, await readFile(assetPath(u.avatar)), 'image/jpeg');
      }
      const profile = {
        displayName: u.displayName,
        bio: u.bio,
        avatarKey,
        avatarUrl: avatarKey ? storage.publicUrl(avatarKey) : null,
      };
      await prisma.user.upsert({
        where: { id: u.id },
        create: { id: u.id, email: u.email, createdAt: u.createdAt, ...profile },
        update: profile,
      });
      if (!taken) created++;
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(
    `identity: ${users.length} users (${created} new). Sign in as ${DEMO_EMAIL}; the code arrives in Mailpit.`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
