import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AppError,
  type AuthUser,
  buildEvent,
  configureHttp,
  EventBus,
  InMemoryEventBus,
  OutboxRelay,
  REDIS,
  TokenVerifier,
  uuidv7,
} from '@feedants/server-kit';
import type { CreateOrderInput, EventPayload, EventType } from '@feedants/shared';
import { createTestDatabase } from '@feedants/testing';
import RedisMock from 'ioredis-mock';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadPaymentEnv } from '../src/config';
import { CompetitionEventsConsumer } from '../src/consumers/competition-events.consumer';
import { ProviderEventsService } from '../src/controllers';
import { escrow, LedgerService, PLATFORM, wallet, EXTERNAL } from '../src/ledger/ledger.service';
import { PrismaService } from '../src/prisma.service';
import { type FakeProvider, PaymentProvider } from '../src/provider/payment-provider';
import { RefundsService } from '../src/refunds/refunds.service';

class TestVerifier extends TokenVerifier {
  async verify(token: string): Promise<AuthUser> {
    if (!token.startsWith('user:')) throw new AppError('UNAUTHENTICATED', 'bad token');
    return { id: token.slice(5) };
  }
}

export const INTERNAL = { 'x-internal-token': 'test-internal-token-123' };
export const as = (userId: string) => ({ Authorization: `Bearer user:${userId}` });

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

export async function createTestApp(overrides: Record<string, string> = {}) {
  const db = await createTestDatabase(join(__dirname, '..', 'prisma', 'migrations'));
  const env = loadPaymentEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: db.url,
    REDIS_URL: 'redis://localhost:6379',
    RABBITMQ_URL: 'amqp://localhost:5672',
    JWKS_URL: 'http://identity.test/.well-known/jwks.json',
    INTERNAL_API_TOKEN: INTERNAL['x-internal-token'],
    OUTBOX_POLL_INTERVAL_MS: '3600000',
    WORKERS_ENABLED: 'false',
    ...overrides,
  });
  const bus = new InMemoryEventBus();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(REDIS)
    .useValue(new RedisMock())
    .overrideProvider(EventBus)
    .useValue(bus)
    .overrideProvider(TokenVerifier)
    .useValue(new TestVerifier())
    .compile();
  const app: INestApplication = moduleRef.createNestApplication({ bufferLogs: true, rawBody: true });
  configureHttp(app, { trustProxy: 'loopback', corsOrigins: [] });
  await app.init();
  await app.listen(0, '127.0.0.1');

  const prisma = app.get(PrismaService);
  const relay = new OutboxRelay(prisma, bus, { intervalMs: 1000, batchSize: 500 });
  const provider = app.get(PaymentProvider);
  const ledger = app.get(LedgerService);
  const consumer = app.get(CompetitionEventsConsumer);

  const t = {
    app,
    http: request(await app.getUrl()),
    prisma,
    bus,
    provider,
    fake: provider as FakeProvider,
    ledger,
    refunds: app.get(RefundsService),
    async events(type: string) {
      await relay.relayBatch();
      return bus.ofType(type);
    },
    async order(input: Partial<CreateOrderInput> = {}) {
      const body: CreateOrderInput = {
        purpose: 'ENTRY_FEE',
        referenceId: uuidv7(),
        competitionId: uuidv7(),
        payerId: uuidv7(),
        amountPaise: 10_900,
        platformFeePaise: 1_000,
        idempotencyKey: `key-${uuidv7()}`,
        ...input,
      };
      const res = await t.http.post('/internal/orders').set(INTERNAL).send(body).expect(200);
      return { ...body, ...res.body } as CreateOrderInput & { orderId: string; providerOrderId: string };
    },
    /** Completes a fake checkout (as the provider's webhook would). */
    async capture(providerOrderId: string) {
      return app.get(ProviderEventsService).ingest(t.fake.simulate(providerOrderId, 'captured'), '{}', true);
    },
    async competitionEvent<T extends EventType>(type: T, data: EventPayload<T>) {
      const e = buildEvent('competition', type, data);
      await consumer.handle(e);
      return e;
    },
    balance: {
      escrow: (competitionId: string) => ledger.balance(prisma, escrow(competitionId)),
      wallet: (userId: string) => ledger.balance(prisma, wallet(userId)),
      platform: () => ledger.balance(prisma, PLATFORM),
      external: () => ledger.balance(prisma, EXTERNAL),
    },
    close: async () => {
      await app.close();
      await db.drop();
    },
  };
  return t;
}
