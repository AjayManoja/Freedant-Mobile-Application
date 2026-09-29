import { uuidv7 } from '@feedants/server-kit';
import { as, createTestApp, joinConfirmed, key, movePhase, seedCompetition, type TestApp } from './helpers';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe('Competition: hosting (US-14 … US-18)', () => {
  let t: TestApp;
  let danceId: number;

  beforeAll(async () => {
    t = await createTestApp();
    danceId = (await t.prisma.category.findUniqueOrThrow({ where: { slug: 'dance' } })).id;
  });
  afterAll(() => t.close());

  const complete = () => ({
    title: 'Bollywood Freestyle',
    categoryId: danceId,
    description: 'Show us your best freestyle.',
    prizePoolPaise: 500_000,
    entryFeePaise: 9_900,
    startAt: inDays(1),
    durationDays: 7,
    maxSpots: 50,
  });

  async function draft(hostId: string, body: object = complete()) {
    const res = await t.http.post('/v1/competitions').set(as(hostId)).send(body).expect(201);
    return res.body as { id: string };
  }

  async function publishAndFund(hostId: string) {
    const d = await draft(hostId);
    const pub = await t.http
      .post(`/v1/competitions/${d.id}/publish`)
      .set(as(hostId))
      .set('Idempotency-Key', key())
      .expect(200);
    await t.capture(d.id);
    return { id: d.id, checkout: pub.body.checkout };
  }

  describe('US-14 create a competition with the wizard', () => {
    it('saves a partial draft and resumes it', async () => {
      const host = uuidv7();
      const d = await draft(host, { title: 'Street Photography 2026' });
      await t.http
        .patch(`/v1/competitions/${d.id}`)
        .set(as(host))
        .send({ prizePoolPaise: 250_000, entryFeePaise: 0 })
        .expect(200);
      const resumed = await t.http.get(`/v1/competitions/${d.id}`).set(as(host)).expect(200);
      expect(resumed.body).toMatchObject({
        title: 'Street Photography 2026',
        status: 'DRAFT',
        prizePoolPaise: 250_000,
        entryFeePaise: 0,
      });
    });

    it('explains each invalid field', async () => {
      const host = uuidv7();
      const res = await t.http
        .post('/v1/competitions')
        .set(as(host))
        .send({ title: 'Hi', prizePoolPaise: 100, durationDays: 5, maxSpots: 1 })
        .expect(400);
      const paths = (res.body.error.details as { path: string }[]).map((d) => d.path).sort();
      expect(paths).toEqual(['durationDays', 'maxSpots', 'prizePoolPaise', 'title']);
    });

    it('lists the missing steps when publishing an incomplete draft', async () => {
      const host = uuidv7();
      const d = await draft(host, { title: 'Half-finished contest' });
      const res = await t.http
        .post(`/v1/competitions/${d.id}/publish`)
        .set(as(host))
        .set('Idempotency-Key', key())
        .expect(400);
      const steps = new Set((res.body.error.details as { step: string }[]).map((i) => i.step));
      expect([...steps].sort()).toEqual(['BASICS', 'PRIZE', 'SCHEDULE']);
    });

    it('rejects a start time less than an hour away (A-16)', async () => {
      const host = uuidv7();
      const d = await draft(host, {
        ...complete(),
        startAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      await t.http
        .post(`/v1/competitions/${d.id}/publish`)
        .set(as(host))
        .set('Idempotency-Key', key())
        .expect(400);
    });

    it('keeps drafts private to their host (FR-DS-06)', async () => {
      const host = uuidv7();
      const d = await draft(host);
      await t.http.get(`/v1/competitions/${d.id}`).expect(404);
      await t.http.get(`/v1/competitions/${d.id}`).set(as(uuidv7())).expect(404);
      await t.http
        .patch(`/v1/competitions/${d.id}`)
        .set(as(uuidv7()))
        .send({ title: 'Hijacked title' })
        .expect(404);
    });

    it('accepts a cover only from its own upload prefix', async () => {
      const host = uuidv7();
      const d = await draft(host);
      const up = await t.http
        .post(`/v1/competitions/${d.id}/cover-upload-url`)
        .set(as(host))
        .send({ contentType: 'image/png', sizeBytes: 300_000 })
        .expect(200);
      expect(up.body.key.startsWith(`public/covers/${d.id}/`)).toBe(true);
      t.storage.put(up.body.key, 'image/png');
      const res = await t.http
        .patch(`/v1/competitions/${d.id}`)
        .set(as(host))
        .send({ coverKey: up.body.key })
        .expect(200);
      expect(res.body.coverUrl).toBe(`http://storage.test/${up.body.key}`);
      await t.http
        .patch(`/v1/competitions/${d.id}`)
        .set(as(host))
        .send({ coverKey: 'public/covers/other/x.png' })
        .expect(403);
    });
  });

  describe('US-15 fund and publish', () => {
    it('charges the prize pool, then goes public when funding is captured', async () => {
      const host = uuidv7();
      const d = await draft(host);
      const pub = await t.http
        .post(`/v1/competitions/${d.id}/publish`)
        .set(as(host))
        .set('Idempotency-Key', key())
        .expect(200);
      expect(pub.body.competition.status).toBe('AWAITING_FUNDING');
      expect(pub.body.checkout).toMatchObject({ amountPaise: 500_000, currency: 'INR' });
      expect(t.payments.forReference(d.id)).toMatchObject({
        purpose: 'PRIZE_FUNDING',
        payerId: host,
        amountPaise: 500_000,
      });
      await t.http.get(`/v1/competitions/${d.id}`).expect(404); // not public yet

      await t.capture(d.id);
      const live = await t.http.get(`/v1/competitions/${d.id}`).expect(200);
      expect(live.body).toMatchObject({
        status: 'PUBLISHED',
        spotsRemaining: 50,
        maxSpots: 50,
        durationDays: 7,
      });
      // A-11 tiers for ₹5,000 and A-8 fee for ₹99.
      expect(live.body.prizeTiers.map((x: { amountPaise: number }) => x.amountPaise / 100)).toEqual([
        1800, 1200, 900, 650, 450,
      ]);
      expect(live.body.fees).toEqual({ entryFeePaise: 9_900, platformFeePaise: 1_000, totalPaise: 10_900 });
      // A-14 derived timeline: registration closes after ⌈7/3⌉ = 3 days.
      const opens = new Date(live.body.registrationOpensAt).getTime();
      expect(new Date(live.body.registrationClosesAt).getTime() - opens).toBe(3 * 86_400_000);
      const published = (await t.events('competition.published')).find(
        (e) => (e.data as { competitionId: string }).competitionId === d.id,
      );
      expect(published?.data).toMatchObject({ hostId: host, title: 'Bollywood Freestyle' });
    });

    it('reopens the same checkout instead of creating a second order', async () => {
      const host = uuidv7();
      const d = await draft(host);
      const a = await t.http
        .post(`/v1/competitions/${d.id}/publish`)
        .set(as(host))
        .set('Idempotency-Key', key())
        .expect(200);
      const b = await t.http
        .post(`/v1/competitions/${d.id}/publish`)
        .set(as(host))
        .set('Idempotency-Key', key())
        .expect(200);
      expect(b.body.checkout.orderId).toBe(a.body.checkout.orderId);
      expect(t.payments.calls.filter((c) => c.referenceId === d.id)).toHaveLength(1);
    });

    it('stays a draft with nothing charged when funding fails to start', async () => {
      const host = uuidv7();
      const d = await draft(host);
      t.payments.failNext = 1;
      await t.http
        .post(`/v1/competitions/${d.id}/publish`)
        .set(as(host))
        .set('Idempotency-Key', key())
        .expect(503);
      const after = await t.http.get(`/v1/competitions/${d.id}`).set(as(host)).expect(200);
      expect(after.body.status).toBe('DRAFT');
    });

    it('returns to draft when the host abandons funding, and refunds a late capture', async () => {
      const host = uuidv7();
      const d = await draft(host);
      await t.http
        .post(`/v1/competitions/${d.id}/publish`)
        .set(as(host))
        .set('Idempotency-Key', key())
        .expect(200);
      await t.http.delete(`/v1/competitions/${d.id}/funding`).set(as(host)).expect(200);
      await t.capture(d.id);
      const after = await t.http.get(`/v1/competitions/${d.id}`).set(as(host)).expect(200);
      expect(after.body.status).toBe('DRAFT');
      const rejected = (await t.events('competition.funding_rejected')).find(
        (e) => (e.data as { competitionId: string }).competitionId === d.id,
      );
      expect(rejected).toBeDefined();
    });

    it('reverts abandoned funding after the timeout', async () => {
      const host = uuidv7();
      const d = await draft(host);
      await t.http
        .post(`/v1/competitions/${d.id}/publish`)
        .set(as(host))
        .set('Idempotency-Key', key())
        .expect(200);
      await t.sweeps.revertAbandonedFunding(new Date(Date.now() + 31 * 60_000));
      expect((await t.prisma.competition.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('DRAFT');
    });
  });

  describe('US-16 edit only before the first registration', () => {
    it('allows detail edits until someone joins, then refuses', async () => {
      const host = uuidv7();
      const { id } = await publishAndFund(host);
      await t.http
        .patch(`/v1/competitions/${id}`)
        .set(as(host))
        .send({ title: 'Bollywood Freestyle 2026' })
        .expect(200);
      const locked = await t.http
        .patch(`/v1/competitions/${id}`)
        .set(as(host))
        .send({ prizePoolPaise: 1_000_000 })
        .expect(409);
      expect(locked.body.error.code).toBe('COMPETITION_NOT_EDITABLE');

      await movePhase(t, id, 'OPEN');
      await joinConfirmed(t, id, uuidv7());
      const res = await t.http
        .patch(`/v1/competitions/${id}`)
        .set(as(host))
        .send({ title: 'Changed after join' })
        .expect(409);
      expect(res.body.error).toMatchObject({
        code: 'COMPETITION_NOT_EDITABLE',
        message: 'Details are locked once someone has joined',
      });
    });
  });

  describe('US-17 cancel a competition', () => {
    it('refunds confirmed entrants and returns escrow through competition.cancelled', async () => {
      const host = uuidv7();
      const c = await seedCompetition(t, { hostId: host, entryFeePaise: 9_900 });
      const paid = await joinConfirmed(t, c.id, uuidv7());
      const held = await t.http
        .post(`/v1/competitions/${c.id}/join`)
        .set(as(uuidv7()))
        .set('Idempotency-Key', key())
        .expect(200);

      const res = await t.http.post(`/v1/competitions/${c.id}/cancel`).set(as(host)).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect((await t.prisma.registration.findUniqueOrThrow({ where: { id: paid } })).status).toBe(
        'REFUNDED',
      );
      expect(
        (await t.prisma.registration.findUniqueOrThrow({ where: { id: held.body.registration.id } })).status,
      ).toBe('EXPIRED');

      const event = (await t.events('competition.cancelled')).find(
        (e) => (e.data as { competitionId: string }).competitionId === c.id,
      );
      const data = event!.data as {
        hostId: string;
        confirmedRegistrations: { registrationId: string; orderId: string }[];
      };
      expect(data.hostId).toBe(host);
      expect(data.confirmedRegistrations).toEqual([
        expect.objectContaining({ registrationId: paid, orderId: t.payments.forReference(paid).orderId }),
      ]);
    });

    it('cannot cancel after results, or someone else’s competition', async () => {
      const host = uuidv7();
      const c = await seedCompetition(t, { hostId: host });
      await t.http.post(`/v1/competitions/${c.id}/cancel`).set(as(uuidv7())).expect(404);
      await t.prisma.competition.update({ where: { id: c.id }, data: { status: 'RESULTS_PUBLISHED' } });
      await t.http.post(`/v1/competitions/${c.id}/cancel`).set(as(host)).expect(409);
    });
  });

  describe('US-18 manage my competitions', () => {
    it('lists status, registrations, submissions and entry revenue, drafts included', async () => {
      const host = uuidv7();
      await draft(host, { title: 'My draft contest' });
      const live = await seedCompetition(t, { hostId: host, entryFeePaise: 9_900 });
      await joinConfirmed(t, live.id, uuidv7());
      await joinConfirmed(t, live.id, uuidv7());

      const res = await t.http.get('/v1/me/competitions').set(as(host)).expect(200);
      expect(res.body.items).toHaveLength(2);
      const pub = res.body.items.find((i: { id: string }) => i.id === live.id);
      expect(pub).toMatchObject({
        status: 'PUBLISHED',
        phase: 'OPEN',
        registrations: 2,
        submissions: 0,
        entryRevenuePaise: 19_800,
        overdue: false,
      });
      expect(res.body.items.find((i: { status: string }) => i.status === 'DRAFT')).toBeDefined();
    });

    it('pages without duplicates', async () => {
      const host = uuidv7();
      for (let i = 0; i < 5; i++) await draft(host, { title: `Draft number ${i}` });
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res: { body: { items: { id: string }[]; nextCursor: string | null } } = await t.http
          .get('/v1/me/competitions')
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .set(as(host))
          .expect(200);
        seen.push(...res.body.items.map((i) => i.id));
        cursor = res.body.nextCursor;
      } while (cursor);
      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });
  });
});
