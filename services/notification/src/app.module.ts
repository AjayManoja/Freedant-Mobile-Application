import { type DynamicModule, Module } from '@nestjs/common';
import { CoreModule, ENV, JwksTokenVerifier, MessagingModule, TokenVerifier } from '@feedants/server-kit';
import type { NotificationEnv } from './config';
import { NotificationConsumer, NotificationsController, NotificationsService } from './notifications';
import { PrismaService } from './prisma.service';

@Module({})
export class AppModule {
  static forRoot(env: NotificationEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot({
          serviceName: 'notification',
          logLevel: env.LOG_LEVEL,
          redisUrl: env.REDIS_URL,
          tokenVerifier: {
            provide: TokenVerifier,
            useFactory: () =>
              new JwksTokenVerifier(env.JWKS_URL, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE }),
          },
        }),
        // No outbox: this service only consumes.
        MessagingModule.forRoot({
          rabbitUrl: env.RABBITMQ_URL,
          maxRetries: env.CONSUMER_MAX_RETRIES,
          retryDelayMs: env.CONSUMER_RETRY_DELAY_MS,
        }),
      ],
      controllers: [NotificationsController],
      providers: [{ provide: ENV, useValue: env }, PrismaService, NotificationsService, NotificationConsumer],
    };
  }
}
