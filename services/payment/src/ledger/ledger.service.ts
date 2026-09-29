import { Injectable } from '@nestjs/common';
import { uuidv7 } from '@feedants/server-kit';
import type { AccountType, LedgerKind } from '../generated/prisma/client';
import { PrismaService, type Tx } from '../prisma.service';

const SYSTEM_OWNER = '00000000-0000-0000-0000-000000000000';
export const EXTERNAL = { type: 'EXTERNAL', ownerId: SYSTEM_OWNER } as const;
export const PLATFORM = { type: 'PLATFORM', ownerId: SYSTEM_OWNER } as const;
export const escrow = (competitionId: string) => ({ type: 'ESCROW', ownerId: competitionId }) as const;
export const wallet = (userId: string) => ({ type: 'USER', ownerId: userId }) as const;

export interface AccountRef {
  type: AccountType;
  ownerId: string;
}

export interface Posting {
  kind: LedgerKind;
  referenceId: string;
  subjectUserId: string | null;
  competitionId: string | null;
  displayAmountPaise: number;
  description: string;
  entries: { account: AccountRef; amountPaise: number }[];
}

/**
 * The only writer of ledger rows (FR-PY-03). Balances are always derived from entries,
 * never stored. The database rejects unbalanced or modified transactions as a backstop.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Posts once per (kind, referenceId); returns false when it already exists. */
  async post(tx: Tx, p: Posting): Promise<boolean> {
    const entries = p.entries.filter((e) => e.amountPaise !== 0);
    const sum = entries.reduce((s, e) => s + e.amountPaise, 0);
    if (sum !== 0) throw new Error(`Unbalanced ${p.kind} posting (${sum} paise)`);
    if (entries.length === 0) return false;

    const existing = await tx.ledgerTransaction.findUnique({
      where: { kind_referenceId: { kind: p.kind, referenceId: p.referenceId } },
    });
    if (existing) return false;

    const transactionId = uuidv7();
    await tx.ledgerTransaction.create({
      data: {
        id: transactionId,
        kind: p.kind,
        referenceId: p.referenceId,
        subjectUserId: p.subjectUserId,
        competitionId: p.competitionId,
        displayAmountPaise: p.displayAmountPaise,
        description: p.description,
      },
    });
    for (const e of entries) {
      const accountId = await this.accountId(tx, e.account);
      await tx.ledgerEntry.create({
        data: { id: uuidv7(), transactionId, accountId, amountPaise: e.amountPaise },
      });
    }
    return true;
  }

  async balance(db: PrismaService | Tx, account: AccountRef): Promise<number> {
    const rows = await db.$queryRaw<{ total: bigint | null }[]>`
      SELECT sum(e.amount_paise) AS total
        FROM ledger_entries e
        JOIN ledger_accounts a ON a.id = e.account_id
       WHERE a.type = ${account.type}::"AccountType" AND a.owner_id = ${account.ownerId}::uuid`;
    return Number(rows[0]?.total ?? 0);
  }

  private async accountId(tx: Tx, ref: AccountRef): Promise<string> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO ledger_accounts (id, type, owner_id)
      VALUES (${uuidv7()}::uuid, ${ref.type}::"AccountType", ${ref.ownerId}::uuid)
      ON CONFLICT (type, owner_id) DO UPDATE SET type = EXCLUDED.type
      RETURNING id`;
    return rows[0]!.id;
  }
}
