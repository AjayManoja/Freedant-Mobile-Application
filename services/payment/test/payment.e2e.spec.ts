import { uuidv7 } from '@feedants/server-kit';
import { createHmac } from 'node:crypto';
import { Client } from 'pg';
import { as, createTestApp, INTERNAL, type TestApp } from './helpers';

describe('Payment service', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  describe('FR-PY-01 orders', () => {
    it('accepts order requests only from other services', async () => {
      await t.http.post('/internal/orders').send({}).expect(403);
      await t.http
        .post('/internal/orders')
        .set({ 'x-internal-token': 'wrong-token-000000000' })
        .send({})
        .expect(403);
    });

    it('creates one order per idempotency key', async () => {
      const first = await t.order({ idempotencyKey: 'same-key-123' });
      const input = {
        purpose: first.purpose,
        referenceId: first.referenceId,
        competitionId: first.competitionId,
        payerId: first.payerId,
        amountPaise: first.amountPaise,
        platformFeePaise: first.platformFeePaise,
        idempotencyKey: 'same-key-123',
      };
      const again = await t.http.post('/internal/orders').set(INTERNAL).send(input).expect(200);
      expect(again.body).toMatchObject({ orderId: first.orderId, providerOrderId: first.providerOrderId });
      expect(first).toMatchObject({ amountPaise: 10_900, currency: 'INR', keyId: 'rzp_test_fake' });
      expect(await t.prisma.order.count({ where: { idempotencyKey: 'same-key-123' } })).toBe(1);

      const reused = await t.http
        .post('/internal/orders')
        .set(INTERNAL)
        .send({ ...input, amountPaise: 20_000 })
        .expect(422);
      expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  describe('FR-PY-02/03 capture, webhooks and the ledger', () => {
    it('posts a balanced entry-fee transaction and publishes payment.captured once', async () => {
      const o = await t.order();
      expect(await t.capture(o.providerOrderId)).toBe('applied');
      expect(await t.balance.escrow(o.competitionId)).toBe(9_900);

      const captured = (await t.events('payment.captured')).filter(
        (e) => (e.data as { orderId: string }).orderId === o.orderId,
      );
      expect(captured).toHaveLength(1);
      expect(captured[0]!.data).toMatchObject({
        purpose: 'ENTRY_FEE',
        referenceId: o.referenceId,
        payerId: o.payerId,
        amountPaise: 10_900,
        idempotencyKey: o.idempotencyKey,
      });

      // A second capture notification for the same order changes nothing.
      await t.capture(o.providerOrderId);
      expect(await t.balance.escrow(o.competitionId)).toBe(9_900);
      expect(await t.prisma.ledgerTransaction.count({ where: { referenceId: o.orderId } })).toBe(1);
    });

    it('ignores a "failed" that arrives after the capture (out of order)', async () => {
      const o = await t.order();
      await t.capture(o.providerOrderId);
      await t.app
        .get((await import('../src/controllers')).ProviderEventsService)
        .ingest(t.fake.simulate(o.providerOrderId, 'failed'), '{}', true);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe('CAPTURED');
    });

    it('reports a failed attempt and still accepts a later successful retry', async () => {
      const o = await t.order();
      const svc = t.app.get((await import('../src/controllers')).ProviderEventsService);
      await svc.ingest(t.fake.simulate(o.providerOrderId, 'failed'), '{}', true);
      const failed = (await t.events('payment.failed')).find(
        (e) => (e.data as { orderId: string }).orderId === o.orderId,
      );
      expect(failed?.data).toMatchObject({ reason: 'Payment declined (simulated)' });
      await t.capture(o.providerOrderId);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe('CAPTURED');
    });

    it('keeps the ledger balanced: system-wide entries always sum to zero', async () => {
      const rows = await t.prisma.$queryRaw<
        { total: bigint }[]
      >`SELECT coalesce(sum(amount_paise), 0) AS total FROM ledger_entries`;
      expect(Number(rows[0]!.total)).toBe(0);
    });

    it('rejects unbalanced transactions and any change to posted entries at the database (NFR-RL-05)', async () => {
      // A raw connection, bypassing the application: the database itself must refuse.
      const dbName = (await t.prisma.$queryRaw<{ d: string }[]>`SELECT current_database() AS d`)[0]!.d;
      const url = new URL(process.env.TEST_PG_ADMIN_URL!);
      url.pathname = `/${dbName}`;
      const c = new Client({ connectionString: url.toString() });
      await c.connect();
      try {
        const [acct] = (await c.query(`SELECT id FROM ledger_accounts WHERE type = 'PLATFORM'`)).rows;
        const txId = uuidv7();
        await c.query('BEGIN');
        await c.query(
          `INSERT INTO ledger_transactions (id, kind, reference_id, display_amount_paise, description) VALUES ($1, 'PRIZE', $2, 1, 'bad')`,
          [txId, uuidv7()],
        );
        await c.query(
          `INSERT INTO ledger_entries (id, transaction_id, account_id, amount_paise) VALUES ($1, $2, $3, 500)`,
          [uuidv7(), txId, acct.id],
        );
        await expect(c.query('COMMIT')).rejects.toThrow(/unbalanced/);

        await expect(c.query(`UPDATE ledger_entries SET amount_paise = amount_paise + 1`)).rejects.toThrow(
          /append-only/,
        );
        await expect(c.query(`DELETE FROM ledger_transactions`)).rejects.toThrow(/append-only/);
      } finally {
        await c.end();
      }
    });
  });

  describe('US-22 / FR-PY-06 refunds', () => {
    it('refunds a late capture in full and reports it once', async () => {
      const o = await t.order();
      await t.capture(o.providerOrderId);
      const e = await t.competitionEvent('registration.rejected', {
        registrationId: o.referenceId,
        competitionId: o.competitionId,
        creatorId: o.payerId,
        orderId: o.orderId,
      });
      await t.app
        .get((await import('../src/consumers/competition-events.consumer')).CompetitionEventsConsumer)
        .handle(e); // redelivery

      const refund = await t.prisma.refund.findUniqueOrThrow({ where: { orderId: o.orderId } });
      expect(refund).toMatchObject({
        status: 'PROCESSED',
        amountPaise: 10_900,
        reason: 'LATE_CAPTURE_REJECTED',
      });
      expect(t.fake.refunds.filter((r) => r.amountPaise === 10_900 && r.providerPaymentId)).not.toHaveLength(
        0,
      );
      expect(await t.balance.escrow(o.competitionId)).toBe(0);
      const refunded = (await t.events('payment.refunded')).filter(
        (x) => (x.data as { orderId: string }).orderId === o.orderId,
      );
      expect(refunded).toHaveLength(1);
      expect(refunded[0]!.data).toMatchObject({ payerId: o.payerId, amountPaise: 10_900 });
    });

    it('retries refunds while the provider is down', async () => {
      const o = await t.order();
      await t.capture(o.providerOrderId);
      t.fake.failRefunds = 1;
      await t.competitionEvent('registration.rejected', {
        registrationId: o.referenceId,
        competitionId: o.competitionId,
        creatorId: o.payerId,
        orderId: o.orderId,
      });
      expect((await t.prisma.refund.findUniqueOrThrow({ where: { orderId: o.orderId } })).status).toBe(
        'PENDING',
      );
      await t.refunds.sendPending(20, new Date(Date.now() + 3_600_000)); // after the backoff
      expect((await t.prisma.refund.findUniqueOrThrow({ where: { orderId: o.orderId } })).status).toBe(
        'PROCESSED',
      );
    });
  });

  describe('US-17 cancellation', () => {
    it('refunds every paid entry and returns the prize pool to the host wallet', async () => {
      const competitionId = uuidv7();
      const hostId = uuidv7();
      const funding = await t.order({
        purpose: 'PRIZE_FUNDING',
        referenceId: competitionId,
        competitionId,
        payerId: hostId,
        amountPaise: 500_000,
        platformFeePaise: 0,
      });
      await t.capture(funding.providerOrderId);
      const entries = [await t.order({ competitionId }), await t.order({ competitionId })];
      for (const e of entries) await t.capture(e.providerOrderId);
      expect(await t.balance.escrow(competitionId)).toBe(500_000 + 2 * 9_900);

      await t.competitionEvent('competition.cancelled', {
        competitionId,
        hostId,
        title: 'Cancelled Contest',
        confirmedRegistrations: [
          ...entries.map((e) => ({
            registrationId: e.referenceId,
            creatorId: e.payerId,
            orderId: e.orderId,
          })),
          { registrationId: uuidv7(), creatorId: uuidv7(), orderId: null }, // a free entry: nothing to refund
        ],
      });
      expect(await t.balance.escrow(competitionId)).toBe(0);
      expect(await t.balance.wallet(hostId)).toBe(500_000);
      expect(
        await t.prisma.refund.count({
          where: { order: { competitionId, purpose: 'ENTRY_FEE' }, status: 'PROCESSED' },
        }),
      ).toBe(2);
    });
  });

  describe('US-28 / US-31 payouts and US-30 wallet', () => {
    it('pays winners from escrow and credits the host, emptying escrow', async () => {
      const competitionId = uuidv7();
      const hostId = uuidv7();
      const [w1, w2] = [uuidv7(), uuidv7()];
      const funding = await t.order({
        purpose: 'PRIZE_FUNDING',
        referenceId: competitionId,
        competitionId,
        payerId: hostId,
        amountPaise: 100_000,
        platformFeePaise: 0,
      });
      await t.capture(funding.providerOrderId);
      for (const payer of [w1, w2])
        await t.capture((await t.order({ competitionId, payerId: payer })).providerOrderId);

      const results = {
        competitionId,
        hostId,
        title: 'Sketch of the Week',
        winners: [
          { rank: 1, registrationId: uuidv7(), creatorId: w1, amountPaise: 50_000 },
          { rank: 2, registrationId: uuidv7(), creatorId: w2, amountPaise: 30_000 },
        ],
        unawardedAmountPaise: 20_000,
        hostRevenuePaise: 2 * 9_900,
        allRegistrationCreatorIds: [w1, w2],
      };
      const e = await t.competitionEvent('competition.results_published', results);
      await t.app
        .get((await import('../src/consumers/competition-events.consumer')).CompetitionEventsConsumer)
        .handle(e);

      expect(await t.balance.escrow(competitionId)).toBe(0);
      expect(await t.balance.wallet(w1)).toBe(50_000);
      expect(await t.balance.wallet(hostId)).toBe(20_000 + 19_800);

      const summary = await t.http.get('/v1/wallet').set(as(w1)).expect(200);
      expect(summary.body).toEqual({ balancePaise: 50_000, totalWinningsPaise: 50_000, currency: 'INR' });

      const all = await t.http.get('/v1/wallet/transactions').set(as(w1)).expect(200);
      expect(
        all.body.items.map((i: { kind: string; amountPaise: number; affectsBalance: boolean }) => [
          i.kind,
          i.amountPaise,
          i.affectsBalance,
        ]),
      ).toEqual([
        ['PRIZE', 50_000, true],
        ['ENTRY_FEE', -10_900, false],
      ]);
      const earnings = await t.http
        .get('/v1/wallet/transactions')
        .query({ filter: 'earnings' })
        .set(as(w1))
        .expect(200);
      expect(earnings.body.items).toHaveLength(1);
      const entries = await t.http
        .get('/v1/wallet/transactions')
        .query({ filter: 'entries' })
        .set(as(w1))
        .expect(200);
      expect(entries.body.items[0].kind).toBe('ENTRY_FEE');
      await t.http.get('/v1/wallet').expect(401);
    });

    it('never pays out more than escrow holds', async () => {
      const competitionId = uuidv7();
      const e = t.competitionEvent('competition.results_published', {
        competitionId,
        hostId: uuidv7(),
        title: 'Unfunded',
        winners: [{ rank: 1, registrationId: uuidv7(), creatorId: uuidv7(), amountPaise: 50_000 }],
        unawardedAmountPaise: 0,
        hostRevenuePaise: 0,
        allRegistrationCreatorIds: [],
      });
      await expect(e).rejects.toThrow(/holds 0 paise/);
    });

    it('refunds funding for a competition that can no longer be published', async () => {
      const competitionId = uuidv7();
      const hostId = uuidv7();
      const funding = await t.order({
        purpose: 'PRIZE_FUNDING',
        referenceId: competitionId,
        competitionId,
        payerId: hostId,
        amountPaise: 250_000,
        platformFeePaise: 0,
      });
      await t.capture(funding.providerOrderId);
      await t.competitionEvent('competition.funding_rejected', {
        competitionId,
        hostId,
        orderId: funding.orderId,
      });
      expect(await t.balance.escrow(competitionId)).toBe(0);
      const history = await t.http
        .get('/v1/wallet/transactions')
        .query({ filter: 'refunds' })
        .set(as(hostId))
        .expect(200);
      expect(history.body.items[0]).toMatchObject({
        kind: 'REFUND',
        amountPaise: 250_000,
        affectsBalance: false,
      });
    });
  });

  describe('FR-PY-08 reconciliation', () => {
    it('reports captured orders without a ledger posting', async () => {
      const clean = await t.http.post('/internal/reconciliation/run').set(INTERNAL).expect(200);
      expect(clean.body).toMatchObject({ missingPostings: [], unbalancedTransactions: [] });

      const o = await t.order();
      await t.prisma.order.update({
        where: { id: o.orderId },
        data: { status: 'CAPTURED', capturedAt: new Date() },
      });
      const dirty = await t.http.post('/internal/reconciliation/run').set(INTERNAL).expect(200);
      expect(dirty.body.missingPostings).toEqual([o.orderId]);
    });
  });

  describe('development checkout', () => {
    it('lets a signed-in tester complete a fake payment', async () => {
      const o = await t.order();
      await t.http
        .post('/v1/payments/dev/simulate')
        .send({ providerOrderId: o.providerOrderId, outcome: 'captured' })
        .expect(401);
      const res = await t.http
        .post('/v1/payments/dev/simulate')
        .set(as(uuidv7()))
        .send({ providerOrderId: o.providerOrderId, outcome: 'captured' })
        .expect(200);
      expect(res.body.status).toBe('applied');
    });
  });
});

describe('Payment service with Razorpay webhooks (FR-PY-02)', () => {
  let t: TestApp;
  const secret = 'whsec_test_1234567890';

  beforeAll(async () => {
    t = await createTestApp({
      PAYMENT_PROVIDER: 'razorpay',
      RAZORPAY_KEY_ID: 'rzp_test_abc',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: secret,
    });
  });
  afterAll(() => t.close());

  const sign = (body: string) => createHmac('sha256', secret).update(body).digest('hex');

  async function seedOrder() {
    const id = uuidv7();
    const providerOrderId = `order_${id.slice(-12)}`;
    await t.prisma.order.create({
      data: {
        id,
        purpose: 'ENTRY_FEE',
        referenceId: uuidv7(),
        competitionId: uuidv7(),
        payerId: uuidv7(),
        amountPaise: 10_900,
        platformFeePaise: 1_000,
        idempotencyKey: `k-${id}`,
        providerOrderId,
      },
    });
    return { id, providerOrderId };
  }

  const capturedBody = (providerOrderId: string) =>
    JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_123', order_id: providerOrderId, amount: 10_900, status: 'captured' } },
      },
    });

  it('applies a correctly signed webhook once, even if delivered twice', async () => {
    const o = await seedOrder();
    const body = capturedBody(o.providerOrderId);
    const send = () =>
      t.http
        .post('/v1/payments/webhook/razorpay')
        .set('content-type', 'application/json')
        .set('x-razorpay-signature', sign(body))
        .set('x-razorpay-event-id', 'evt_1')
        .send(body);
    expect((await send().expect(200)).body.status).toBe('applied');
    expect((await send().expect(200)).body.status).toBe('duplicate');
    expect(await t.prisma.ledgerTransaction.count({ where: { referenceId: o.id } })).toBe(1);
  });

  it('verifies the signature over the raw bytes — reformatting the JSON breaks it', async () => {
    const o = await seedOrder();
    const body = capturedBody(o.providerOrderId);
    const pretty = JSON.stringify(JSON.parse(body), null, 2);
    const res = await t.http
      .post('/v1/payments/webhook/razorpay')
      .set('content-type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .set('x-razorpay-event-id', 'evt_2')
      .send(pretty)
      .expect(400);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    expect((await t.prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('CREATED');
    expect(await t.prisma.webhookEvent.count({ where: { signatureValid: false } })).toBeGreaterThan(0);
  });

  it('refuses to start with a live Razorpay key (C-1)', async () => {
    const { loadPaymentEnv } = await import('../src/config');
    expect(() =>
      loadPaymentEnv({
        PORT: '1',
        DATABASE_URL: 'postgresql://x@y/z',
        REDIS_URL: 'redis://x',
        RABBITMQ_URL: 'amqp://x',
        JWKS_URL: 'http://x',
        INTERNAL_API_TOKEN: 'x'.repeat(20),
        PAYMENT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_live_abc',
        RAZORPAY_KEY_SECRET: 's',
        RAZORPAY_WEBHOOK_SECRET: 's',
      }),
    ).toThrow(/test-mode key/);
  });
});
