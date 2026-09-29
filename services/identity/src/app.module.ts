import { type DynamicModule, Module } from '@nestjs/common';
import {
  CoreModule,
  ENV,
  MessagingModule,
  ObjectStorage,
  S3ObjectStorage,
  TokenVerifier,
} from '@feedants/server-kit';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { LocalTokenVerifier } from './auth/local-token-verifier';
import { Mailer, SmtpMailer } from './auth/mailer';
import { OtpService } from './auth/otp.service';
import { SigningKeys } from './auth/signing-keys.service';
import { TokensService } from './auth/tokens.service';
import type { IdentityEnv } from './config';
import { PrismaService } from './prisma.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({})
export class AppModule {
  static forRoot(env: IdentityEnv): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot({
          serviceName: 'identity',
          logLevel: env.LOG_LEVEL,
          redisUrl: env.REDIS_URL,
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
      controllers: [AuthController, UsersController],
      providers: [
        { provide: ENV, useValue: env },
        PrismaService,
        SigningKeys,
        LocalTokenVerifier,
        { provide: TokenVerifier, useExisting: LocalTokenVerifier },
        TokensService,
        OtpService,
        AuthService,
        UsersService,
        { provide: Mailer, useClass: SmtpMailer },
        { provide: ObjectStorage, useFactory: () => new S3ObjectStorage(env) },
      ],
      exports: [ENV],
    };
  }
}
