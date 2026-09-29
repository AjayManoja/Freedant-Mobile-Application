import { Injectable } from '@nestjs/common';
import { AppError } from '@feedants/server-kit';
import {
  type LedgerKind,
  type Page,
  type WalletHistoryQuery,
  walletFilterKinds,
  type WalletSummary,
  type WalletTransaction,
} from '@feedants/shared';
import type { Prisma } from '../generated/prisma/client';
import { LedgerService, wallet } from '../ledger/ledger.service';
import { PrismaService } from '../prisma.service';

const BALANCE_KINDS = new Set<LedgerKind>(walletFilterKinds.earnings);

const cursorOf = (at: Date, id: string) =>
  Buffer.from(JSON.stringify([at.toISOString(), id])).toString('base64url');
function parseCursor(c: string): [Date, string] {
  try {
    const [at, id] = JSON.parse(Buffer.from(c, 'base64url').toString('utf8')) as [string, string];
    const d = new Date(at);
    if (Number.isNaN(d.getTime()) || typeof id !== 'string') throw new Error();
    return [d, id];
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Invalid cursor');
  }
}

/** FR-PY-07 / US-30: the balance is the sum of the user's ledger entries, always. */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async summary(userId: string): Promise<WalletSummary> {
    const [balancePaise, winnings] = await Promise.all([
      this.ledger.balance(this.prisma, wallet(userId)),
      this.prisma.ledgerTransaction.aggregate({
        where: { subjectUserId: userId, kind: 'PRIZE' },
        _sum: { displayAmountPaise: true },
      }),
    ]);
    return { balancePaise, totalWinningsPaise: winnings._sum.displayAmountPaise ?? 0, currency: 'INR' };
  }

  async history(userId: string, q: WalletHistoryQuery): Promise<Page<WalletTransaction>> {
    const kinds = walletFilterKinds[q.filter];
    const and: Prisma.LedgerTransactionWhereInput[] = [{ subjectUserId: userId }];
    if (kinds) and.push({ kind: { in: [...kinds] } });
    if (q.cursor) {
      const [at, id] = parseCursor(q.cursor);
      and.push({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] });
    }
    const rows = await this.prisma.ledgerTransaction.findMany({
      where: { AND: and },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return {
      items: page.map((t) => ({
        id: t.id,
        kind: t.kind,
        amountPaise: t.displayAmountPaise,
        affectsBalance: BALANCE_KINDS.has(t.kind),
        description: t.description,
        competitionId: t.competitionId,
        createdAt: t.createdAt.toISOString(),
      })),
      nextCursor: rows.length > q.limit && last ? cursorOf(last.createdAt, last.id) : null,
    };
  }
}
