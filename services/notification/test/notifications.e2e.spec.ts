import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AppError,
  type AuthUser,
  buildEvent,
  configureHttp,
  EventBus,
  InMemoryEventBus,
  REDIS,
  TokenVerifier,
  uuidv7,
} from '@feedants/server-kit';
import { createTestDatabase, type TestDatabase } from '@feedants/testing';
import RedisMock from 'ioredis-mock';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadNotificationEnv } from '../src/config';

class TestVerifier extends TokenVerifier {
  async verify(token: string): Promise<AuthUser> {
    if (!token.startsWith('user:')) throw new AppError('UNAUTHENTICATED', 'bad token');
    return { id: token.slice(5) };
  }
}
const as = (userId: string) => ({ Authorization: `Bearer user:${userId}` });

describe('Notification service (US-32, US-33, FR-NT-01..03)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let db: TestDatabase;
  const bus = new InMemoryEventBus();
  bus.autoDeliver = true;

  beforeAll(async () => {
    db = await createTestDatabase(join(__dirname, '..', 'prisma', 'migrations'));
    const env = loadNotificationEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: db.url,
      REDIS_URL: 'redis://localhost:6379',
      RABBITMQ_URL: 'amqp://localhost:5672',
      JWKS_URL: 'http://identity.test/.well-known/jwks.json',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(REDIS)
      .useValue(new RedisMock())
      .overrideProvider(EventBus)
      .useValue(bus)
      .overrideProvider(TokenVerifier)
      .useValue(new TestVerifier())
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttp(app, { trustProxy: 'loopback', corsOrigins: [] });
    await app.init();
    await app.listen(0, '127.0.0.1');
    http = request(await app.getUrl());
  });

  afterAll(async () => {
    await app.close();
    await db.drop();
  });

  it('turns each notifying event into the right notification with a deep link', async () => {
    const creator = uuidv7();
    const host = uuidv7();
    const competitionId = uuidv7();
    await bus.publish(
      buildEvent('competition', 'registration.confirmed', {
        registrationId: uuidv7(),
        competitionId,
        competitionTitle: 'Monsoon Poetry Slam',
        creatorId: creator,
      }),
    );
    await bus.publish(
      buildEvent('competition', 'competition.published', {
        competitionId,
        hostId: host,
        title: 'Monsoon Poetry Slam',
      }),
    );
    await bus.publish(
      buildEvent('payment', 'payment.refunded', {
        refundId: uuidv7(),
        orderId: uuidv7(),
        competitionId,
        payerId: creator,
        amountPaise: 10_900,
        reason: 'CANCELLATION',
      }),
    );

    const mine = await http.get('/v1/notifications').set(as(creator)).expect(200);
    expect(mine.body.items.map((n: { type: string }) => n.type)).toEqual([
      'REFUND_ISSUED',
      'REGISTRATION_CONFIRMED',
    ]);
    expect(mine.body.items[0]).toMatchObject({
      body: '₹109 is on its way back to your original payment method.',
      target: { screen: 'wallet' },
      read: false,
    });
    expect(mine.body.items[1]).toMatchObject({
      title: "You're in!",
      target: { screen: 'competition', competitionId },
    });

    const hosts = await http.get('/v1/notifications').set(as(host)).expect(200);
    expect(hosts.body.items[0]).toMatchObject({ type: 'COMPETITION_PUBLISHED', title: "You're live!" });
  });

  it('tells every participant about results, and winners about their prize', async () => {
    const [w, other] = [uuidv7(), uuidv7()];
    await bus.publish(
      buildEvent('competition', 'competition.results_published', {
        competitionId: uuidv7(),
        hostId: uuidv7(),
        title: 'Sketch of the Week',
        winners: [{ rank: 1, registrationId: uuidv7(), creatorId: w, amountPaise: 150_000 }],
        unawardedAmountPaise: 0,
        hostRevenuePaise: 0,
        allRegistrationCreatorIds: [w, other],
      }),
    );
    const winner = await http.get('/v1/notifications').set(as(w)).expect(200);
    expect(winner.body.items.map((n: { type: string }) => n.type).sort()).toEqual([
      'PRIZE_WON',
      'RESULTS_PUBLISHED',
    ]);
    expect(winner.body.items.find((n: { type: string }) => n.type === 'PRIZE_WON').body).toContain('₹1,500');
    const loser = await http.get('/v1/notifications').set(as(other)).expect(200);
    expect(loser.body.items.map((n: { type: string }) => n.type)).toEqual(['RESULTS_PUBLISHED']);
  });

  it('notifies "Notify me" subscribers and payment failures', async () => {
    const [a, b] = [uuidv7(), uuidv7()];
    const competitionId = uuidv7();
    await bus.publish(
      buildEvent('competition', 'competition.registration_opened', {
        competitionId,
        title: 'Acoustic Cover Battle',
        subscriberUserIds: [a, b],
      }),
    );
    await bus.publish(
      buildEvent('payment', 'payment.failed', {
        orderId: uuidv7(),
        competitionId,
        idempotencyKey: 'k-12345678',
        purpose: 'ENTRY_FEE',
        referenceId: uuidv7(),
        payerId: a,
        reason: 'Card declined',
      }),
    );
    const res = await http.get('/v1/notifications').set(as(a)).expect(200);
    expect(res.body.items.map((n: { type: string }) => n.type)).toEqual([
      'PAYMENT_FAILED',
      'REGISTRATION_OPENED',
    ]);
    expect(res.body.items[0].body).toContain('Card declined');
    expect((await http.get('/v1/notifications').set(as(b)).expect(200)).body.items).toHaveLength(1);
  });

  it('never duplicates a notification when an event is redelivered', async () => {
    const creator = uuidv7();
    const e = buildEvent('competition', 'registration.confirmed', {
      registrationId: uuidv7(),
      competitionId: uuidv7(),
      competitionTitle: 'Once',
      creatorId: creator,
    });
    await bus.deliver(e);
    await bus.deliver(e);
    expect((await http.get('/v1/notifications').set(as(creator)).expect(200)).body.items).toHaveLength(1);
  });

  it('US-32: events published while the service was down appear once it recovers', async () => {
    const creator = uuidv7();
    bus.autoDeliver = false; // the queue holds messages while the consumer is away
    await bus.publish(
      buildEvent('competition', 'registration.confirmed', {
        registrationId: uuidv7(),
        competitionId: uuidv7(),
        competitionTitle: 'Offline A',
        creatorId: creator,
      }),
    );
    await bus.publish(
      buildEvent('competition', 'registration.confirmed', {
        registrationId: uuidv7(),
        competitionId: uuidv7(),
        competitionTitle: 'Offline B',
        creatorId: creator,
      }),
    );
    expect((await http.get('/v1/notifications/unread-count').set(as(creator)).expect(200)).body.unread).toBe(
      0,
    );
    await bus.deliverAll();
    bus.autoDeliver = true;
    expect((await http.get('/v1/notifications/unread-count').set(as(creator)).expect(200)).body.unread).toBe(
      2,
    );
  });

  it('US-33: unread count, mark one, mark all, only for your own notifications', async () => {
    const me = uuidv7();
    for (let i = 0; i < 3; i++) {
      await bus.publish(
        buildEvent('competition', 'registration.confirmed', {
          registrationId: uuidv7(),
          competitionId: uuidv7(),
          competitionTitle: `C${i}`,
          creatorId: me,
        }),
      );
    }
    expect((await http.get('/v1/notifications/unread-count').set(as(me))).body).toEqual({ unread: 3 });
    const list = await http.get('/v1/notifications').set(as(me)).expect(200);
    const first = list.body.items[0].id;

    await http.post(`/v1/notifications/${first}/read`).set(as(uuidv7())).expect(404);
    expect((await http.post(`/v1/notifications/${first}/read`).set(as(me)).expect(200)).body).toEqual({
      unread: 2,
    });
    expect((await http.post('/v1/notifications/read-all').set(as(me)).expect(200)).body).toEqual({
      unread: 0,
    });
    await http.get('/v1/notifications').expect(401);
  });

  it('pages newest first without duplicates', async () => {
    const me = uuidv7();
    for (let i = 0; i < 5; i++) {
      await bus.publish(
        buildEvent('competition', 'registration.confirmed', {
          registrationId: uuidv7(),
          competitionId: uuidv7(),
          competitionTitle: `P${i}`,
          creatorId: me,
        }),
      );
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res: { body: { items: { id: string }[]; nextCursor: string | null } } = await http
        .get('/v1/notifications')
        .query({ limit: 2, ...(cursor ? { cursor } : {}) })
        .set(as(me))
        .expect(200);
      seen.push(...res.body.items.map((i) => i.id));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });
});
