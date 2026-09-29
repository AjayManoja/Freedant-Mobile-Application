import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ENV } from '@feedants/server-kit';
import type { PaymentEnv } from '../config';
import { PrismaService } from '../prisma.service';

export interface ReconciliationReport {
  checkedFrom: string;
  capturedOrders: number;
  missingPostings: string[];
  unbalancedTransactions: string[];
}

/**
 * FR-PY-08: compares captured payments with the ledger and reports mismatches. It never
 * corrects anything — a mismatch is a bug to investigate (R-5).
 */
@Injectable()
export class ReconciliationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ReconciliationService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: PaymentEnv,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.env.WORKERS_ENABLED) return;
    this.timer = setInterval(
      () => void this.run().catch((err) => this.logger.error({ err }, 'Reconciliation failed')),
      this.env.RECONCILIATION_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(since = new Date(Date.now() - 24 * 3_600_000)): Promise<ReconciliationReport> {
    const missing = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT o.id FROM orders o
       WHERE o.captured_at >= ${since}
         AND NOT EXISTS (
           SELECT 1 FROM ledger_transactions t
            WHERE t.reference_id = o.id AND t.kind::text = o.purpose::text)`;
    const unbalanced = await this.prisma.$queryRaw<{ transaction_id: string }[]>`
      SELECT e.transaction_id FROM ledger_entries e
       WHERE e.created_at >= ${since}
       GROUP BY e.transaction_id
      HAVING sum(e.amount_paise) <> 0`;
    const captured = await this.prisma.order.count({ where: { capturedAt: { gte: since } } });
    const report = {
      checkedFrom: since.toISOString(),
      capturedOrders: captured,
      missingPostings: missing.map((r) => r.id),
      unbalancedTransactions: unbalanced.map((r) => r.transaction_id),
    };
    if (report.missingPostings.length || report.unbalancedTransactions.length) {
      this.logger.error(report, 'Reconciliation found mismatches');
    } else {
      this.logger.log({ capturedOrders: captured }, 'Reconciliation clean');
    }
    return report;
  }
}
