/**
 * Local demo data (US-34): profiles, competitions in every phase, registrations,
 * submissions and published results. Competitions that already exist are left alone, so
 * running it again never overwrites what you did in the app. Run with `pnpm db:seed`.
 */
import { readFile } from 'node:fs/promises';
import { loadEnv, S3ObjectStorage, storageEnvSchema } from '@feedants/server-kit';
import {
  assertSeedAllowed,
  assetPath,
  buildDataset,
  FAKE_KEY_ID,
  type SeedCompetition,
} from '@feedants/seed-data';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient } from './generated/prisma/client';

async function main(): Promise<void> {
  assertSeedAllowed();
  const env = loadEnv(z.object({ DATABASE_URL: z.url() }).extend(storageEnvSchema.shape));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  const storage = new S3ObjectStorage(env);
  const data = buildDataset();

  const upload = async (key: string, file: string) => {
    await storage.putObject(key, await readFile(assetPath(file)), 'image/jpeg');
    return key;
  };

  try {
    // The local copy of Identity's profiles (normally kept current by user.* events).
    for (const u of data.users) {
      const profile = {
        displayName: u.displayName,
        avatarUrl: u.avatar ? storage.publicUrl(`public/avatars/${u.id}/seed.jpg`) : null,
      };
      await prisma.userProfile.upsert({
        where: { userId: u.id },
        create: { userId: u.id, ...profile },
        update: profile,
      });
    }

    const categories = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));
    let created = 0;
    for (const c of data.competitions) {
      if (await prisma.competition.findUnique({ where: { id: c.id }, select: { id: true } })) continue;
      const coverKey = c.cover ? await upload(`public/covers/${c.id}/seed.jpg`, c.cover) : null;
      const media = new Map<string, string>();
      for (const r of c.registrations) {
        if (r.submission?.media)
          media.set(r.id, await upload(`submissions/${r.id}/seed.jpg`, r.submission.media));
      }
      await prisma.$transaction(async (tx) => {
        await tx.competition.create({
          data: competitionRow(c, categories, coverKey, coverKey && storage.publicUrl(coverKey)),
        });
        for (const r of c.registrations) {
          await tx.registration.create({
            data: {
              id: r.id,
              competitionId: c.id,
              creatorId: r.creatorId,
              status: 'CONFIRMED',
              idempotencyKey: r.idempotencyKey,
              amountPaise: r.amountPaise,
              paymentOrderId: r.orderId,
              providerOrderId: r.providerOrderId,
              paymentKeyId: r.orderId ? FAKE_KEY_ID : null,
              confirmedAt: r.confirmedAt,
              createdAt: new Date(r.confirmedAt.getTime() - 60_000),
            },
          });
          const s = r.submission;
          if (!s) continue;
          await tx.submission.create({
            data: {
              id: s.id,
              registrationId: r.id,
              competitionId: c.id,
              creatorId: r.creatorId,
              status: s.status,
              mediaKey: media.get(r.id) ?? null,
              mediaKind: s.media ? 'IMAGE' : null,
              mediaContentType: s.media ? 'image/jpeg' : null,
              caption: s.caption,
              rulesAccepted: s.rulesAccepted,
              scoreTenths: s.scoreTenths,
              scoreComment: s.scoreComment,
              rank: s.rank,
              prizePaise: s.prizePaise,
              submittedAt: s.submittedAt,
              scoredAt: s.scoreTenths === null ? null : c.resultsPublishedAt,
              createdAt: r.confirmedAt,
              updatedAt: s.updatedAt,
            },
          });
        }
      });
      created++;
    }
    console.log(
      `competition: ${data.users.length} profiles, ${created} new of ${data.competitions.length} competitions.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function competitionRow(
  c: SeedCompetition,
  categories: Map<string, number>,
  coverKey: string | null,
  coverUrl: string | null,
) {
  const t = c.timeline;
  const submitted = c.registrations.filter((r) => r.submission?.status === 'SUBMITTED').length;
  return {
    id: c.id,
    hostId: c.hostId,
    status: c.status,
    title: c.title,
    description: c.description,
    categoryId: categories.get(c.categorySlug) ?? null,
    coverKey,
    coverUrl,
    featured: c.featured,
    prizePoolPaise: c.prizePoolPaise,
    entryFeePaise: c.entryFeePaise,
    platformFeePaise: c.platformFeePaise,
    maxSpots: c.maxSpots,
    spotsRemaining: c.maxSpots === null ? 0 : c.maxSpots - c.registrations.length,
    confirmedCount: c.registrations.length,
    submissionCount: submitted,
    startAt: c.startAt,
    durationDays: c.durationDays,
    registrationOpensAt: t?.registrationOpensAt ?? null,
    registrationClosesAt: t?.registrationClosesAt ?? null,
    submissionStartsAt: t?.submissionStartsAt ?? null,
    submissionEndsAt: t?.submissionEndsAt ?? null,
    resultsDueAt: t?.resultsDueAt ?? null,
    publishedAt: c.publishedAt,
    resultsPublishedAt: c.resultsPublishedAt,
    // Already-open competitions have nobody left to tell (FR-DS-07).
    registrationOpenedNotifiedAt: t && t.registrationOpensAt < new Date() ? t.registrationOpensAt : null,
    fundingOrderId: c.funding?.orderId ?? null,
    fundingProviderOrder: c.funding?.providerOrderId ?? null,
    fundingKeyId: c.funding ? FAKE_KEY_ID : null,
    fundingIdempotencyKey: c.funding?.idempotencyKey ?? null,
    fundingRequestedAt: c.funding?.requestedAt ?? null,
    createdAt: c.createdAt,
    prizeTiers: { create: c.prizeTiers.map((p) => ({ rank: p.rank, amountPaise: p.amountPaise })) },
  };
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
