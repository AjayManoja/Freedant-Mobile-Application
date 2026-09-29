import { createLocalJWKSet, jwtVerify } from 'jose';
import { createTestApp, signIn, type TestApp, uniqueEmail } from './helpers';

describe('Identity: sign-in (US-01, US-02, US-03, US-04)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await t.redis.flushall();
  });

  describe('US-01 sign in with an email code', () => {
    it('emails a 6-digit code and disables resend for the cooldown', async () => {
      const email = uniqueEmail();
      const res = await t.http.post('/v1/auth/otp/request').send({ email }).expect(200);
      expect(res.body).toEqual({ resendAfterSeconds: 60, expiresInSeconds: 300 });
      expect(t.mailer.lastCodeFor(email)).toMatch(/^\d{6}$/);

      const again = await t.http.post('/v1/auth/otp/request').send({ email }).expect(429);
      expect(again.body.error.code).toBe('OTP_RESEND_TOO_SOON');
      expect(Number(again.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('normalises the email so case does not create a second account', async () => {
      const email = uniqueEmail();
      await t.http
        .post('/v1/auth/otp/request')
        .send({ email: `  ${email.toUpperCase()} ` })
        .expect(200);
      const res = await t.http
        .post('/v1/auth/otp/verify')
        .send({ email, code: t.mailer.lastCodeFor(email) })
        .expect(200);
      expect(res.body.user.email).toBe(email);
    });

    it('signs in with a correct code', async () => {
      const s = await signIn(t);
      expect(s.accessToken).toBeTruthy();
      expect(s.refreshToken).toBeTruthy();
    });

    it('invalidates the code after 5 wrong attempts', async () => {
      const email = uniqueEmail();
      await t.http.post('/v1/auth/otp/request').send({ email }).expect(200);
      const code = t.mailer.lastCodeFor(email);
      const wrong = code === '000000' ? '111111' : '000000';

      for (let remaining = 4; remaining >= 1; remaining--) {
        const r = await t.http.post('/v1/auth/otp/verify').send({ email, code: wrong }).expect(400);
        expect(r.body.error).toMatchObject({
          code: 'OTP_INCORRECT',
          details: { attemptsRemaining: remaining },
        });
      }
      const fifth = await t.http.post('/v1/auth/otp/verify').send({ email, code: wrong }).expect(410);
      expect(fifth.body.error.code).toBe('OTP_INVALIDATED');

      const correct = await t.http.post('/v1/auth/otp/verify').send({ email, code }).expect(410);
      expect(correct.body.error).toMatchObject({
        code: 'OTP_EXPIRED',
        message: 'Code expired — request a new one',
      });
    });

    it('rejects an already-used code', async () => {
      const email = uniqueEmail();
      await t.http.post('/v1/auth/otp/request').send({ email }).expect(200);
      const code = t.mailer.lastCodeFor(email);
      await t.http.post('/v1/auth/otp/verify').send({ email, code }).expect(200);
      const reuse = await t.http.post('/v1/auth/otp/verify').send({ email, code }).expect(410);
      expect(reuse.body.error.code).toBe('OTP_EXPIRED');
    });

    it('rate-limits code requests per email with a retry-after time', async () => {
      const email = uniqueEmail();
      for (let i = 0; i < 5; i++) {
        await t.http.post('/v1/auth/otp/request').send({ email }).expect(200);
        await t.redis.del(`otp:cooldown:${email}`);
      }
      const res = await t.http.post('/v1/auth/otp/request').send({ email }).expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.headers['retry-after']).toBeDefined();
    });

    it('never stores the code in plaintext', async () => {
      const email = uniqueEmail();
      await t.http.post('/v1/auth/otp/request').send({ email }).expect(200);
      const stored = await t.redis.hgetall(`otp:code:${email}`);
      expect(JSON.stringify(stored)).not.toContain(t.mailer.lastCodeFor(email));
    });

    it('does not leave a usable code behind when email delivery fails', async () => {
      const email = uniqueEmail();
      t.mailer.failNext = true;
      const res = await t.http.post('/v1/auth/otp/request').send({ email }).expect(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(await t.redis.exists(`otp:code:${email}`)).toBe(0);
      await t.http.post('/v1/auth/otp/request').send({ email }).expect(200);
    });

    it('rejects malformed input and unknown fields', async () => {
      await t.http.post('/v1/auth/otp/request').send({ email: 'not-an-email' }).expect(400);
      await t.http.post('/v1/auth/otp/request').send({ email: uniqueEmail(), admin: true }).expect(400);
      await t.http.post('/v1/auth/otp/verify').send({ email: uniqueEmail(), code: '12ab56' }).expect(400);
    });
  });

  describe('US-02 choose a display name on first sign-in', () => {
    it('asks new users for a display name, once', async () => {
      const s = await signIn(t);
      expect(s.needsDisplayName).toBe(true);

      const auth = { Authorization: `Bearer ${s.accessToken}` };
      await t.http.post('/v1/auth/complete-signup').set(auth).send({ displayName: 'R' }).expect(400);
      const done = await t.http
        .post('/v1/auth/complete-signup')
        .set(auth)
        .send({ displayName: 'Riya' })
        .expect(200);
      expect(done.body.displayName).toBe('Riya');
      const again = await t.http
        .post('/v1/auth/complete-signup')
        .set(auth)
        .send({ displayName: 'Other' })
        .expect(409);
      expect(again.body.error.code).toBe('SIGNUP_ALREADY_COMPLETE');
    });

    it('skips the step for returning users', async () => {
      const first = await signIn(t, uniqueEmail(), 'Aarav');
      const second = await signIn(t, first.email);
      expect(second.needsDisplayName).toBe(false);
      expect(second.user.id).toBe(first.user.id);
    });

    it('publishes user.created and user.updated through the outbox', async () => {
      const s = await signIn(t, uniqueEmail(), 'Ishita');
      await t.relayOutbox();
      const created = t.bus
        .ofType('user.created')
        .find((e) => (e.data as { userId: string }).userId === s.user.id);
      const updated = t.bus
        .ofType('user.updated')
        .find((e) => (e.data as { userId: string }).userId === s.user.id);
      expect(created).toBeDefined();
      expect(updated?.data).toMatchObject({ displayName: 'Ishita', avatarUrl: null });
      expect(updated?.producer).toBe('identity');
      const unpublished = await t.prisma.outboxEvent.count({ where: { publishedAt: null } });
      expect(unpublished).toBe(0);
    });
  });

  describe('US-03 stay signed in securely', () => {
    it('rotates the refresh token on every refresh', async () => {
      const s = await signIn(t);
      const r1 = await t.http.post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(200);
      expect(r1.body.refreshToken).not.toBe(s.refreshToken);
      await t.http.get('/v1/me').set('Authorization', `Bearer ${r1.body.accessToken}`).expect(200);
      await t.http.post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(200);
    });

    it('revokes the whole family when a rotated token is reused', async () => {
      const s = await signIn(t);
      const legit = await t.http.post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(200);

      const stolen = await t.http.post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
      expect(stolen.body.error.code).toBe('REFRESH_TOKEN_INVALID');
      // The legitimate client's newer token is dead too: everyone signs in again.
      await t.http.post('/v1/auth/refresh').send({ refreshToken: legit.body.refreshToken }).expect(401);
    });

    it('lets exactly one of two concurrent refreshes win', async () => {
      const s = await signIn(t);
      const results = await Promise.all([
        t.http.post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }),
        t.http.post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    });

    it('does not affect other devices when one family is revoked', async () => {
      const phone = await signIn(t);
      const tablet = await signIn(t, phone.email);
      await t.http.post('/v1/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(200);
      await t.http.post('/v1/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(401);
      await t.http.post('/v1/auth/refresh').send({ refreshToken: tablet.refreshToken }).expect(200);
    });

    it('rejects unknown refresh tokens', async () => {
      await t.http
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'x'.repeat(43) })
        .expect(401);
    });

    it('issues RS256 tokens verifiable with the published JWKS', async () => {
      const s = await signIn(t);
      const jwks = await t.http.get('/.well-known/jwks.json').expect(200);
      expect(jwks.headers['cache-control']).toContain('max-age=300');
      const { payload, protectedHeader } = await jwtVerify(s.accessToken, createLocalJWKSet(jwks.body), {
        issuer: 'feedants-identity',
        audience: 'feedants',
      });
      expect(protectedHeader.alg).toBe('RS256');
      expect(payload.sub).toBe(s.user.id);
      expect(payload).not.toHaveProperty('email');
    });
  });

  describe('US-04 sign out', () => {
    it("revokes this device's refresh token", async () => {
      const s = await signIn(t);
      await t.http.post('/v1/auth/logout').set('Authorization', `Bearer ${s.accessToken}`).expect(204);
      await t.http.post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
    });

    it('requires authentication', async () => {
      await t.http.post('/v1/auth/logout').expect(401);
    });
  });
});
