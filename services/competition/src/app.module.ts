import { type DynamicModule, Module } from '@nestjs/common';
import {
  CoreModule,
  ENV,
  JwksTokenVerifier,
  MessagingModule,
  ObjectStorage,
  S3ObjectStorage,
  TokenVerifier,
} from '@feedants/server-kit';
import { type CompetitionEnv, RULES, rulesFrom } from './config';
import {
  DiscoveryController,
  HostingController,
  JudgingController,
  ParticipationController,
} from './controllers';
import { DiscoveryService } from './discovery/discovery.service';
import { HostingService } from './hosting/hosting.service';
import { JoinService } from './joining/join.service';
import { PaymentEventsConsumer } from './joining/payment-events.consumer';
import { SweepsService } from './joining/sweeps.service';
import { JudgingService } from './judging/judging.service';
import { HttpPaymentGateway, PaymentGateway } from './payment-gateway';
import { PrismaService } from './prisma.service';
import { UserEventsConsumer } from './profiles/user-events.consumer';
import { SubmissionsService } from './submissions/submissions.service';

@Module({})
export class AppModule {
  static forRoot(env: CompetitionEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot({
          serviceName: 'competition',
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
      controllers: [DiscoveryController, HostingController, ParticipationController, JudgingController],
      providers: [
        { provide: ENV, useValue: env },
        { provide: RULES, useValue: rulesFrom(env) },
        PrismaService,
        DiscoveryService,
        HostingService,
        JoinService,
        SubmissionsService,
        JudgingService,
        PaymentEventsConsumer,
        UserEventsConsumer,
        SweepsService,
        { provide: PaymentGateway, useClass: HttpPaymentGateway },
        { provide: ObjectStorage, useFactory: () => new S3ObjectStorage(env) },
      ],
    };
  }
}
