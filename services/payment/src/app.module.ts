import { type DynamicModule, Module } from '@nestjs/common';
import { CoreModule, ENV, JwksTokenVerifier, MessagingModule, TokenVerifier } from '@feedants/server-kit';
import type { PaymentEnv } from './config';
import { CompetitionEventsConsumer } from './consumers/competition-events.consumer';
import { InternalGuard, PaymentsController, ProviderEventsService } from './controllers';
import { LedgerService } from './ledger/ledger.service';
import { OrdersService } from './orders/orders.service';
import { PrismaService } from './prisma.service';
import { FakeProvider, PaymentProvider, RazorpayProvider } from './provider/payment-provider';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { RefundsService } from './refunds/refunds.service';
import { WalletService } from './wallet/wallet.service';

@Module({})
export class AppModule {
  static forRoot(env: PaymentEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot({
          serviceName: 'payment',
          logLevel: env.LOG_LEVEL,
          redisUrl: env.REDIS_URL,
          tokenVerifier: {
            provide: TokenVerifier,
            useFactory: () =>
              new JwksTokenVerifier(env.JWKS_URL, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }),
          },
        }),
        MessagingModule.forRoot({
          rabbitUrl: env.RABBITMQ_URL,
          maxRetries: env.CONSUMER_MAX_RETRIES,
          retryDelayMs: env.CONSUMER_RETRY_DELAY_MS,
          outbox: {
            db: PrismaService,
            intervalMs: env.OUTBOX_POLL_INTERVAL_MS,
            batchSize: env.OUTBOX_BATCH_SIZE,
          },
        }),
      ],
      controllers: [PaymentsController],
      providers: [
        { provide: ENV, useValue: env },
        PrismaService,
        LedgerService,
        OrdersService,
        RefundsService,
        WalletService,
        ReconciliationService,
        ProviderEventsService,
        CompetitionEventsConsumer,
        InternalGuard,
        env.PAYMENT_PROVIDER === 'razorpay'
          ? { provide: PaymentProvider, useClass: RazorpayProvider }
          : { provide: PaymentProvider, useValue: new FakeProvider() },
      ],
    };
  }
}
