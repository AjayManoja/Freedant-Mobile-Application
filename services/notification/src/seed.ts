/**
 * Local demo data (US-34): a few notifications for the demo user, read and unread, each
 * with a deep link. Idempotent. Run with `pnpm db:seed`.
 */
import { loadEnv } from '@feedants/server-kit';
import { assertSeedAllowed, buildDataset } from '@feedants/seed-data';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient } from './generated/prisma/client';

async function main(): Promise<void> {
  assertSeedAllowed();
  const env = loadEnv(z.object({ DATABASE_URL: z.url() }));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  const { notifications } = buildDataset();
  try {
    const { count } = await prisma.notification.createMany({
      data: notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        target: n.target,
        sourceEventId: n.sourceEventId,
        readAt: n.read ? n.createdAt : null,
        createdAt: n.createdAt,
      })),
      skipDuplicates: true,
    });
    console.log(`notification: ${count} new of ${notifications.length} notifications.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
