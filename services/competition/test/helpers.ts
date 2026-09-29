import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AppError,
  type AuthUser,
  buildEvent,
  configureHttp,
  EventBus,
  InMemoryEventBus,
  InMemoryObjectStorage,
  ObjectStorage,
  OutboxRelay,
  REDIS,
  TokenVerifier,
  uuidv7,
} from '@feedants/server-kit';
import {
  computePrizeTiers,
  type CreateOrderInput,
  type CreateOrderResponse,
  type EventPayload,
  platformFee,
} from '@feedants/shared';
import { createTestDatabase } from '@feedants/testing';
import RedisMock from 'ioredis-mock';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadCompetitionEnv } from '../src/config';
import { PaymentEventsConsumer } from '../src/joining/payment-events.consumer';
import { SweepsService } from '../src/joining/sweeps.service';
import { PaymentGateway } from '../src/payment-gateway';
import { PrismaService } from '../src/prisma.service';
import { UserEventsConsumer } from '../src/profiles/user-events.consumer';

/** Tokens are "user:<uuid>" in tests; real RS256 verification is covered in server-kit and Identity. */
class TestVerifier extends TokenVerifier {
  async verify(token: string): Promise<AuthUser> {
    if (!token.startsWith('user:')) throw new AppError('UNAUTHENTICATED', 'bad token');
    return { id: token.slice(5) };
  }
}

export class FakePaymentGateway extends PaymentGateway {
  readonly calls: CreateOrderInput[] = [];
  private readonly orders = new Map<string, CreateOrderResponse>();
  failNext = 0;

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
    this.calls.push(input);
    if (this.failNext > 0) {
      this.failNext--;
      throw new AppError('SERVICE_UNAVAILABLE', 'Payments are unavailable right now, please try again');
    }
    const existing = this.orders.get(input.idempotencyKey);
    if (existing) return existing;
    const order: CreateOrderResponse = {
      orderId: uuidv7(),
      providerOrderId: `order_test_${this.orders.size + 1}`,
      amountPaise: input.amountPaise,
      currency: 'INR',
      keyId: 'rzp_test_key',
    };
    this.orders.set(input.idempotencyKey, order);
    return order;
  }

  forReference(referenceId: string): CreateOrderInput & CreateOrderResponse {
    const input = [...this.calls].reverse().find((c) => c.referenceId === referenceId);
    if (!input) throw new Error(`no order for ${referenceId}`);
    return { ...input, ...this.orders.get(input.idempotencyKey)! };
  }
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

export async function createTestApp(overrides: Record<string, string> = {}) {
  const db = await createTestDatabase(join(__dirname, '..', 'prisma', 'migrations'));
  const env = loadCompetitionEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: db.url,
    REDIS_URL: 'redis://localhost:6379',
    RABBITMQ_URL: 'amqp://localhost:5672',
    JWKS_URL: 'http://identity.test/.well-known/jwks.json',
    PAYMENT_INTERNAL_URL: 'http://payment.test',
    INTERNAL_API_TOKEN: 'test-internal-token-123',
    S3_BUCKET: 'feedants-test',
    S3_PUBLIC_BASE_URL: 'http://storage.test',
    OUTBOX_POLL_INTERVAL_MS: '3600000',
    SWEEPS_ENABLED: 'false',
    HOME_CACHE_TTL_SECONDS: '0',
    ...overrides,
  });

  const redis = new RedisMock();
  await redis.flushall();
  const bus = new InMemoryEventBus();
  const storage = new InMemoryObjectStorage();
  const payments = new FakePaymentGateway();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(REDIS)
    .useValue(redis)
    .overrideProvider(EventBus)
    .useValue(bus)
    .overrideProvider(ObjectStorage)
    .useValue(storage)
    .overrideProvider(PaymentGateway)
    .useValue(payments)
    .overrideProvider(TokenVerifier)
    .useValue(new TestVerifier())
    .compile();

  const app: INestApplication = moduleRef.createNestApplication({ bufferLogs: true });
  configureHttp(app, { trustProxy: 'loopback', corsOrigins: [] });
  await app.init();
  // A real listening socket: supertest would otherwise re-listen per request under concurrency.
  await app.listen(0, '127.0.0.1');
  const prisma = app.get(PrismaService);
  const relay = new OutboxRelay(prisma, bus, { intervalMs: 1000, batchSize: 500 });
  const paymentEvents = app.get(PaymentEventsConsumer);
  const userEvents = app.get(UserEventsConsumer);

  const t = {
    app,
    http: request(await app.getUrl()),
    prisma,
    redis,
    bus,
    storage,
    payments,
    sweeps: app.get(SweepsService),
    /** Publishes pending outbox rows to the in-memory bus and returns the new events. */
    async relay() {
      const before = bus.published.length;
      await relay.relayBatch();
      return bus.published.slice(before);
    },
    async events(type: string) {
      await relay.relayBatch();
      return bus.ofType(type);
    },
    /** Delivers a Payment event to the consumer, as RabbitMQ would. */
    async paymentEvent<T extends 'payment.captured' | 'payment.failed'>(type: T, data: EventPayload<T>) {
      const event = buildEvent('payment', type, data);
      await paymentEvents.handle(event);
      return event;
    },
    async capture(referenceId: string) {
      const o = payments.forReference(referenceId);
      return t.paymentEvent('payment.captured', {
        orderId: o.orderId,
        competitionId: o.competitionId,
        idempotencyKey: o.idempotencyKey,
        purpose: o.purpose,
        referenceId,
        payerId: o.payerId,
        amountPaise: o.amountPaise,
      });
    },
    async userUpdated(userId: string, displayName: string, avatarUrl: string | null = null) {
      await userEvents.handle(buildEvent('identity', 'user.updated', { userId, displayName, avatarUrl }));
    },
    close: async () => {
      await app.close();
      await db.drop();
    },
  };
  return t;
}

export const as = (userId: string) => ({ Authorization: `Bearer user:${userId}` });
export const key = () => `key-${uuidv7()}`;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type FixturePhase = 'UPCOMING' | 'OPEN' | 'SUBMISSIONS' | 'JUDGING';

/** Creates a funded, published competition directly in a given phase. */
export async function seedCompetition(
  t: TestApp,
  opts: {
    hostId?: string;
    phase?: FixturePhase;
    prizePoolPaise?: number;
    entryFeePaise?: number;
    maxSpots?: number;
    spotsRemaining?: number;
    title?: string;
    categorySlug?: string;
    registrationClosesInMs?: number;
    confirmedCount?: number;
  } = {},
) {
  const now = Date.now();
  const phase = opts.phase ?? 'OPEN';
  const windows = {
    UPCOMING: { opens: now + DAY, closes: now + 3 * DAY, subEnd: now + 7 * DAY },
    OPEN: {
      opens: now - HOUR,
      closes: now + (opts.registrationClosesInMs ?? 3 * DAY),
      subEnd: now + 6 * DAY,
    },
    SUBMISSIONS: { opens: now - 3 * DAY, closes: now - HOUR, subEnd: now + 3 * DAY },
    JUDGING: { opens: now - 8 * DAY, closes: now - 5 * DAY, subEnd: now - HOUR },
  }[phase];
  const pool = opts.prizePoolPaise ?? 500_000;
  const fee = opts.entryFeePaise ?? 9_900;
  const maxSpots = opts.maxSpots ?? 100;
  const category = await t.prisma.category.findUniqueOrThrow({
    where: { slug: opts.categorySlug ?? 'dance' },
  });
  const id = uuidv7();
  await t.prisma.competition.create({
    data: {
      id,
      hostId: opts.hostId ?? uuidv7(),
      status: 'PUBLISHED',
      title: opts.title ?? `Competition ${id.slice(-6)}`,
      categoryId: category.id,
      prizePoolPaise: pool,
      entryFeePaise: fee,
      platformFeePaise: platformFee(fee),
      maxSpots,
      spotsRemaining: opts.spotsRemaining ?? maxSpots,
      confirmedCount: opts.confirmedCount ?? 0,
      startAt: new Date(windows.opens),
      durationDays: 7,
      registrationOpensAt: new Date(windows.opens),
      submissionStartsAt: new Date(windows.opens),
      registrationClosesAt: new Date(windows.closes),
      submissionEndsAt: new Date(windows.subEnd),
      resultsDueAt: new Date(windows.subEnd + 2 * DAY),
      publishedAt: new Date(now - 2 * DAY),
      prizeTiers: { create: computePrizeTiers(pool) },
    },
  });
  return t.prisma.competition.findUniqueOrThrow({ where: { id }, include: { prizeTiers: true } });
}

/** Moves a competition's windows so it is in `phase` now (e.g. OPEN → JUDGING after entries). */
export async function movePhase(t: TestApp, competitionId: string, phase: FixturePhase) {
  const now = Date.now();
  const w = {
    UPCOMING: { opens: now + DAY, closes: now + 3 * DAY, subEnd: now + 7 * DAY },
    OPEN: { opens: now - HOUR, closes: now + 2 * DAY, subEnd: now + 6 * DAY },
    SUBMISSIONS: { opens: now - 3 * DAY, closes: now - HOUR, subEnd: now + 3 * DAY },
    JUDGING: { opens: now - 8 * DAY, closes: now - 5 * DAY, subEnd: now - HOUR },
  }[phase];
  await t.prisma.competition.update({
    where: { id: competitionId },
    data: {
      registrationOpensAt: new Date(w.opens),
      submissionStartsAt: new Date(w.opens),
      registrationClosesAt: new Date(w.closes),
      submissionEndsAt: new Date(w.subEnd),
    },
  });
}

/** Joins and, for paid competitions, captures the payment. Returns the confirmed registration ID. */
export async function joinConfirmed(t: TestApp, competitionId: string, userId: string): Promise<string> {
  const res = await t.http
    .post(`/v1/competitions/${competitionId}/join`)
    .set(as(userId))
    .set('Idempotency-Key', key());
  if (res.status !== 200) throw new Error(`join failed: ${res.status} ${JSON.stringify(res.body)}`);
  const reg = res.body.registration;
  if (reg.status === 'HELD') await t.capture(reg.id);
  return reg.id;
}

/** Uploads media, fills the checklist and submits. */
export async function submitEntry(
  t: TestApp,
  userId: string,
  registrationId: string,
  caption = 'My best work, made for this',
) {
  const up = await t.http
    .post(`/v1/registrations/${registrationId}/submission/media-upload-url`)
    .set(as(userId))
    .send({ contentType: 'image/jpeg', sizeBytes: 200_000 })
    .expect(200);
  t.storage.put(up.body.key, 'image/jpeg', 200_000);
  await t.http
    .patch(`/v1/registrations/${registrationId}/submission`)
    .set(as(userId))
    .send({ mediaKey: up.body.key, caption, rulesAccepted: true })
    .expect(200);
  const res = await t.http
    .post(`/v1/registrations/${registrationId}/submission/submit`)
    .set(as(userId))
    .expect(200);
  return res.body.id as string;
}
