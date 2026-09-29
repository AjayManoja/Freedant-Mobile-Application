import { uuidv7 } from '@feedants/server-kit';
import { as, createTestApp, key, seedCompetition, type TestApp } from './helpers';

describe('Competition: join and pay (US-19 … US-23)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  const join = (competitionId: string, userId: string, k = key()) =>
    t.http.post(`/v1/competitions/${competitionId}/join`).set(as(userId)).set('Idempotency-Key', k);

  describe('US-19 join a free competition', () => {
    it('confirms immediately and takes one spot', async () => {
      const c = await seedCompetition(t, { entryFeePaise: 0, maxSpots: 5 });
      const res = await join(c.id, uuidv7()).expect(200);
      expect(res.body.registration).toMatchObject({ status: 'CONFIRMED', amountPaise: 0, checkout: null });
      const after = await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } });
      expect(after).toMatchObject({ spotsRemaining: 4, confirmedCount: 1 });
      expect(t.payments.calls.find((o) => o.referenceId === res.body.registration.id)).toBeUndefined();
      expect(
        (await t.events('registration.confirmed')).some(
          (e) => (e.data as { registrationId: string }).registrationId === res.body.registration.id,
        ),
      ).toBe(true);
    });

    it('refuses the host, a second registration, and a full competition, with the reason', async () => {
      const hostId = uuidv7();
      const c = await seedCompetition(t, { hostId, entryFeePaise: 0, maxSpots: 1 });
      expect((await join(c.id, hostId).expect(403)).body.error.code).toBe('HOST_CANNOT_JOIN');

      const creator = uuidv7();
      await join(c.id, creator).expect(200);
      expect((await join(c.id, creator).expect(409)).body.error.code).toBe('ALREADY_REGISTERED');
      expect((await join(c.id, uuidv7()).expect(409)).body.error.code).toBe('NO_SPOTS_LEFT');
    });

    it('refuses when registration is not open', async () => {
      const upcoming = await seedCompetition(t, { phase: 'UPCOMING' });
      const closed = await seedCompetition(t, { phase: 'SUBMISSIONS' });
      expect((await join(upcoming.id, uuidv7()).expect(409)).body.error.code).toBe('REGISTRATION_CLOSED');
      expect((await join(closed.id, uuidv7()).expect(409)).body.error.code).toBe('REGISTRATION_CLOSED');
    });

    it('requires sign-in and an Idempotency-Key', async () => {
      const c = await seedCompetition(t);
      await t.http.post(`/v1/competitions/${c.id}/join`).set('Idempotency-Key', key()).expect(401);
      await t.http.post(`/v1/competitions/${c.id}/join`).set(as(uuidv7())).expect(400);
      await join(uuidv7(), uuidv7()).expect(404);
    });
  });

  describe('US-20 join and pay', () => {
    it('holds a spot for 10 minutes and creates an order with the server-computed amount', async () => {
      const c = await seedCompetition(t, { entryFeePaise: 9_900, maxSpots: 3 });
      const creator = uuidv7();
      const before = Date.now();
      const res = await join(c.id, creator).expect(200);
      const r = res.body.registration;

      expect(r.status).toBe('HELD');
      // ₹99 entry + ₹10 platform fee (A-8). The client sends no amount at all.
      expect(r.amountPaise).toBe(10_900);
      expect(r.checkout).toMatchObject({ amountPaise: 10_900, currency: 'INR', keyId: 'rzp_test_key' });
      const hold = new Date(r.holdExpiresAt).getTime() - before;
      expect(hold).toBeGreaterThan(9.9 * 60_000);
      expect(hold).toBeLessThanOrEqual(10 * 60_000 + 2_000);

      const order = t.payments.forReference(r.id);
      expect(order).toMatchObject({
        purpose: 'ENTRY_FEE',
        payerId: creator,
        amountPaise: 10_900,
        platformFeePaise: 1_000,
        competitionId: c.id,
      });
      expect((await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } })).spotsRemaining).toBe(2);
    });

    it("confirms once Payment reports the capture — You're in!", async () => {
      const c = await seedCompetition(t);
      const creator = uuidv7();
      const { body } = await join(c.id, creator).expect(200);
      await t.capture(body.registration.id);

      const r = await t.http.get(`/v1/registrations/${body.registration.id}`).set(as(creator)).expect(200);
      expect(r.body).toMatchObject({ status: 'CONFIRMED', checkout: null, holdExpiresAt: null });
      expect((await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } })).confirmedCount).toBe(1);
    });

    it('hides a registration from anyone but its owner', async () => {
      const c = await seedCompetition(t);
      const { body } = await join(c.id, uuidv7()).expect(200);
      await t.http.get(`/v1/registrations/${body.registration.id}`).set(as(uuidv7())).expect(404);
    });
  });

  describe('US-21 recover from a failed or abandoned payment', () => {
    it('keeps the hold and shows the reason so the creator can retry', async () => {
      const c = await seedCompetition(t);
      const creator = uuidv7();
      const { body } = await join(c.id, creator).expect(200);
      const o = t.payments.forReference(body.registration.id);
      await t.paymentEvent('payment.failed', {
        orderId: o.orderId,
        competitionId: c.id,
        idempotencyKey: o.idempotencyKey,
        purpose: 'ENTRY_FEE',
        referenceId: body.registration.id,
        payerId: creator,
        reason: 'Card declined by bank',
      });
      const r = await t.http.get(`/v1/registrations/${body.registration.id}`).set(as(creator)).expect(200);
      expect(r.body).toMatchObject({ status: 'HELD', lastPaymentError: 'Card declined by bank' });
      expect(r.body.checkout.orderId).toBe(o.orderId);

      await t.capture(body.registration.id); // retry succeeds
      const done = await t.http.get(`/v1/registrations/${body.registration.id}`).set(as(creator)).expect(200);
      expect(done.body).toMatchObject({ status: 'CONFIRMED', lastPaymentError: null });
    });

    it('releases the spot when the hold expires', async () => {
      const c = await seedCompetition(t, { maxSpots: 1 });
      const { body } = await join(c.id, uuidv7()).expect(200);
      expect((await join(c.id, uuidv7()).expect(409)).body.error.code).toBe('NO_SPOTS_LEFT');

      await t.sweeps.expireHolds(new Date(Date.now() + 11 * 60_000));
      const r = await t.prisma.registration.findUniqueOrThrow({ where: { id: body.registration.id } });
      expect(r.status).toBe('EXPIRED');
      expect((await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } })).spotsRemaining).toBe(1);
      await join(c.id, uuidv7()).expect(200);
    });

    it('gives the spot back when Payment is unavailable', async () => {
      const c = await seedCompetition(t, { maxSpots: 1 });
      t.payments.failNext = 1;
      const res = await join(c.id, uuidv7()).expect(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect((await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } })).spotsRemaining).toBe(1);
    });
  });

  describe('US-22 never overbook the last spot', () => {
    it('lets exactly 1 of 50 simultaneous joins take the last spot', async () => {
      const c = await seedCompetition(t, { maxSpots: 1, entryFeePaise: 0 });
      const results = await Promise.all(Array.from({ length: 50 }, () => join(c.id, uuidv7())));
      const ok = results.filter((r) => r.status === 200);
      const full = results.filter((r) => r.status === 409 && r.body.error.code === 'NO_SPOTS_LEFT');
      expect(ok).toHaveLength(1);
      expect(full).toHaveLength(49);
      const after = await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } });
      expect(after).toMatchObject({ spotsRemaining: 0, confirmedCount: 1 });
      expect(await t.prisma.registration.count({ where: { competitionId: c.id, status: 'CONFIRMED' } })).toBe(
        1,
      );
    });

    it('holds exactly as many paid spots as exist under a burst', async () => {
      const c = await seedCompetition(t, { maxSpots: 3 });
      const results = await Promise.all(Array.from({ length: 30 }, () => join(c.id, uuidv7())));
      expect(results.filter((r) => r.status === 200)).toHaveLength(3);
      expect(await t.prisma.registration.count({ where: { competitionId: c.id, status: 'HELD' } })).toBe(3);
    });

    it('rejects and refunds a payment captured after the hold expired and the spot was taken', async () => {
      const c = await seedCompetition(t, { maxSpots: 1 });
      const late = uuidv7();
      const { body } = await join(c.id, late).expect(200);
      await t.sweeps.expireHolds(new Date(Date.now() + 11 * 60_000));
      await join(c.id, uuidv7(), key()).expect(200); // someone else takes the spot

      await t.capture(body.registration.id);
      const r = await t.prisma.registration.findUniqueOrThrow({ where: { id: body.registration.id } });
      expect(r.status).toBe('REJECTED');
      const rejected = (await t.events('registration.rejected')).find(
        (e) => (e.data as { registrationId: string }).registrationId === r.id,
      );
      expect(rejected?.data).toMatchObject({
        creatorId: late,
        orderId: t.payments.forReference(r.id).orderId,
      });
    });

    it('still confirms a late payment when a spot is free', async () => {
      const c = await seedCompetition(t, { maxSpots: 2 });
      const { body } = await join(c.id, uuidv7()).expect(200);
      await t.sweeps.expireHolds(new Date(Date.now() + 11 * 60_000));
      await t.capture(body.registration.id);
      const r = await t.prisma.registration.findUniqueOrThrow({ where: { id: body.registration.id } });
      expect(r.status).toBe('CONFIRMED');
      expect((await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } })).spotsRemaining).toBe(1);
    });
  });

  describe('US-23 never be charged twice', () => {
    it('returns the original result for a repeated Idempotency-Key', async () => {
      const c = await seedCompetition(t);
      const creator = uuidv7();
      const k = key();
      const first = await join(c.id, creator, k).expect(200);
      const second = await join(c.id, creator, k).expect(200);
      expect(second.body.registration.id).toBe(first.body.registration.id);
      expect(second.body.registration.checkout.orderId).toBe(first.body.registration.checkout.orderId);
      expect(t.payments.calls.filter((o) => o.referenceId === first.body.registration.id)).toHaveLength(1);
      expect(await t.prisma.registration.count({ where: { competitionId: c.id } })).toBe(1);
    });

    it('handles concurrent retries with the same key as one join', async () => {
      const c = await seedCompetition(t);
      const creator = uuidv7();
      const k = key();
      const results = await Promise.all(Array.from({ length: 5 }, () => join(c.id, creator, k)));
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(new Set(results.map((r) => r.body.registration.id)).size).toBe(1);
      expect((await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } })).spotsRemaining).toBe(99);
    });

    it('refuses a key reused by another user', async () => {
      const c = await seedCompetition(t);
      const k = key();
      await join(c.id, uuidv7(), k).expect(200);
      expect((await join(c.id, uuidv7(), k).expect(422)).body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('changes the registration exactly once for duplicate captures', async () => {
      const c = await seedCompetition(t);
      const { body } = await join(c.id, uuidv7()).expect(200);
      const event = await t.capture(body.registration.id);
      await t.app
        .get((await import('../src/joining/payment-events.consumer')).PaymentEventsConsumer)
        .handle(event);
      await t.capture(body.registration.id); // a second, distinct delivery of the same capture
      const comp = await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } });
      expect(comp.confirmedCount).toBe(1);
      const confirmations = (await t.events('registration.confirmed')).filter(
        (e) => (e.data as { registrationId: string }).registrationId === body.registration.id,
      );
      expect(confirmations).toHaveLength(1);
    });
  });
});
