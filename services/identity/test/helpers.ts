import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  configureHttp,
  EventBus,
  InMemoryEventBus,
  InMemoryObjectStorage,
  ObjectStorage,
  OutboxRelay,
  REDIS,
} from '@feedants/server-kit';
import { createTestDatabase, type TestDatabase } from '@feedants/testing';
import RedisMock from 'ioredis-mock';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { type Mail, Mailer } from '../src/auth/mailer';
import { loadIdentityEnv } from '../src/config';
import { PrismaService } from '../src/prisma.service';

export class FakeMailer extends Mailer {
  readonly sent: Mail[] = [];
  failNext = false;

  async send(mail: Mail): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('smtp down');
    }
    this.sent.push(mail);
  }

  lastCodeFor(email: string): string {
    const mail = [...this.sent].reverse().find((m) => m.to === email);
    const code = mail?.subject.match(/^(\d{6})/)?.[1];
    if (!code) throw new Error(`No code sent to ${email}`);
    return code;
  }
}

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  redis: InstanceType<typeof RedisMock>;
  bus: InMemoryEventBus;
  storage: InMemoryObjectStorage;
  mailer: FakeMailer;
  relayOutbox: () => Promise<number>;
  close: () => Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const db: TestDatabase = await createTestDatabase(join(__dirname, '..', 'prisma', 'migrations'));
  const env = loadIdentityEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: db.url,
    REDIS_URL: 'redis://localhost:6379',
    RABBITMQ_URL: 'amqp://localhost:5672',
    OTP_PEPPER: 'test-pepper-0123456789',
    SMTP_HOST: 'localhost',
    S3_BUCKET: 'feedants-test',
    S3_PUBLIC_BASE_URL: 'http://storage.test',
    // The relay is driven manually through relayOutbox() for deterministic assertions.
    OUTBOX_POLL_INTERVAL_MS: '3600000',
    ...overrides,
  });

  const redis = new RedisMock();
  await redis.flushall();
  const bus = new InMemoryEventBus();
  const storage = new InMemoryObjectStorage();
  const mailer = new FakeMailer();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(REDIS)
    .useValue(redis)
    .overrideProvider(EventBus)
    .useValue(bus)
    .overrideProvider(ObjectStorage)
    .useValue(storage)
    .overrideProvider(Mailer)
    .useValue(mailer)
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: true });
  configureHttp(app, { trustProxy: 'loopback', corsOrigins: [] });
  await app.init();
  // A real listening socket: supertest would otherwise re-listen per request under concurrency.
  await app.listen(0, '127.0.0.1');
  const prisma = app.get(PrismaService);
  const relay = new OutboxRelay(prisma, bus, { intervalMs: 1000, batchSize: 100 });

  return {
    app,
    http: request(await app.getUrl()),
    prisma,
    redis,
    bus,
    storage,
    mailer,
    relayOutbox: () => relay.relayBatch(),
    close: async () => {
      await app.close();
      await db.drop();
    },
  };
}

let counter = 0;
export const uniqueEmail = () => `user${Date.now()}${counter++}@example.com`;

/** Runs the full OTP sign-in and returns the tokens. */
export async function signIn(t: TestApp, email = uniqueEmail(), displayName?: string) {
  await t.http.post('/v1/auth/otp/request').send({ email }).expect(200);
  const res = await t.http
    .post('/v1/auth/otp/verify')
    .send({ email, code: t.mailer.lastCodeFor(email) })
    .expect(200);
  // Signing in twice within the cooldown is common in tests; clear it.
  await t.redis.del(`otp:cooldown:${email}`);
  if (displayName) {
    await t.http
      .post('/v1/auth/complete-signup')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .send({ displayName })
      .expect(200);
  }
  return { email, ...res.body } as {
    email: string;
    accessToken: string;
    refreshToken: string;
    needsDisplayName: boolean;
    user: { id: string };
  };
}
