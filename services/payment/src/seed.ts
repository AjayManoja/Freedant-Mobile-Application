/**
 * Local demo data (US-34): the captured orders and ledger postings behind the seeded
 * competitions — prize pools in escrow, entry fees, and payouts for published results —
 * so balances, refunds on cancel and payouts all work on seeded data. Postings go in
 * exactly as LedgerService writes them; ones that already exist are skipped (the ledger
 * is append-only). Run with `pnpm db:seed`.
 */
import { loadEnv } from '@feedants/server-kit';
import { type AccountRef, assertSeedAllowed, buildDataset, seedId } from '@feedants/seed-data';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient } from './generated/prisma/client';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

async function main(): Promise<void> {
  assertSeedAllowed();
  const env = loadEnv(z.object({ DATABASE_URL: z.url() }));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  const { orders, postings } = buildDataset();

  try {
    const { count } = await prisma.order.createMany({
      data: orders.map((o) => ({
        id: o.id,
        purpose: o.purpose,
        referenceId: o.referenceId,
        competitionId: o.competitionId,
        payerId: o.payerId,
        amountPaise: o.amountPaise,
        platformFeePaise: o.platformFeePaise,
        idempotencyKey: o.idempotencyKey,
        providerOrderId: o.providerOrderId,
        providerPaymentId: o.providerPaymentId,
        title: o.title,
        status: 'CAPTURED' as const,
        capturedAt: o.capturedAt,
        createdAt: new Date(o.capturedAt.getTime() - 60_000),
      })),
      skipDuplicates: true,
    });

    let posted = 0;
    for (const p of postings) {
      const exists = await prisma.ledgerTransaction.findUnique({
        where: { kind_referenceId: { kind: p.kind, referenceId: p.referenceId } },
        select: { id: true },
      });
      if (exists) continue;
      // One DB transaction per posting: the balance trigger checks it at COMMIT.
      await prisma.$transaction(async (tx) => {
        await tx.ledgerTransaction.create({
          data: {
            id: p.id,
            kind: p.kind,
            referenceId: p.referenceId,
            subjectUserId: p.subjectUserId,
            competitionId: p.competitionId,
            displayAmountPaise: p.displayAmountPaise,
            description: p.description,
            createdAt: p.createdAt,
          },
        });
        for (const [i, e] of p.entries.entries()) {
          await tx.ledgerEntry.create({
            data: {
              id: seedId(`ledger-entry:${p.id}:${i}`),
              transactionId: p.id,
              accountId: await accountId(tx, e.account),
              amountPaise: e.amountPaise,
              createdAt: p.createdAt,
            },
          });
        }
      });
      posted++;
    }
    console.log(
      `payment: ${count} new of ${orders.length} orders, ${posted} new of ${postings.length} ledger postings.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

/** Same get-or-create as LedgerService: one account per (type, owner). */
async function accountId(tx: Tx, ref: AccountRef): Promise<string> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO ledger_accounts (id, type, owner_id)
    VALUES (${seedId(`ledger-account:${ref.type}:${ref.ownerId}`)}::uuid, ${ref.type}::"AccountType", ${ref.ownerId}::uuid)
    ON CONFLICT (type, owner_id) DO UPDATE SET type = EXCLUDED.type
    RETURNING id`;
  return rows[0]!.id;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
