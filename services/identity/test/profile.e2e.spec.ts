import { createTestApp, signIn, type TestApp } from './helpers';

describe('Identity: profile (US-05, US-07, FR-ID-07)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await t.redis.flushall();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('US-05 edit my profile', () => {
    it('updates name and bio', async () => {
      const s = await signIn(t, undefined, 'Neha');
      const res = await t.http
        .patch('/v1/me')
        .set(auth(s.accessToken))
        .send({ displayName: 'Neha K', bio: 'Classical dancer from Pune' })
        .expect(200);
      expect(res.body).toMatchObject({ displayName: 'Neha K', bio: 'Classical dancer from Pune' });
      const me = await t.http.get('/v1/me').set(auth(s.accessToken)).expect(200);
      expect(me.body.displayName).toBe('Neha K');
    });

    it('uploads an avatar through a presigned POST and publishes user.updated', async () => {
      const s = await signIn(t, undefined, 'Aarav');
      const up = await t.http
        .post('/v1/me/avatar-upload-url')
        .set(auth(s.accessToken))
        .send({ contentType: 'image/webp', sizeBytes: 120_000 })
        .expect(200);
      expect(up.body.key).toMatch(new RegExp(`^public/avatars/${s.user.id}/.+\\.webp$`));

      // Saving before the upload finished is refused.
      await t.http.patch('/v1/me').set(auth(s.accessToken)).send({ avatarKey: up.body.key }).expect(400);

      t.storage.put(up.body.key, 'image/webp');
      const res = await t.http
        .patch('/v1/me')
        .set(auth(s.accessToken))
        .send({ avatarKey: up.body.key })
        .expect(200);
      expect(res.body.avatarUrl).toBe(`http://storage.test/${up.body.key}`);

      await t.relayOutbox();
      const event = t.bus
        .ofType('user.updated')
        .reverse()
        .find((e) => (e.data as { userId: string }).userId === s.user.id);
      expect(event?.data).toMatchObject({ avatarUrl: res.body.avatarUrl });
    });

    it("refuses another user's upload key", async () => {
      const owner = await signIn(t, undefined, 'Owner');
      const other = await signIn(t, undefined, 'Other');
      const key = `public/avatars/${owner.user.id}/x.png`;
      t.storage.put(key, 'image/png');
      const res = await t.http
        .patch('/v1/me')
        .set(auth(other.accessToken))
        .send({ avatarKey: key })
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('refuses unsupported types and oversized avatars', async () => {
      const s = await signIn(t, undefined, 'Riya');
      await t.http
        .post('/v1/me/avatar-upload-url')
        .set(auth(s.accessToken))
        .send({ contentType: 'image/gif', sizeBytes: 1000 })
        .expect(400);
      const big = await t.http
        .post('/v1/me/avatar-upload-url')
        .set(auth(s.accessToken))
        .send({ contentType: 'image/png', sizeBytes: 50 * 1024 * 1024 })
        .expect(400);
      expect(big.body.error.message).toBe('Image is too large');
    });

    it('does not publish user.updated when only the bio changes', async () => {
      const s = await signIn(t, undefined, 'Quiet');
      await t.relayOutbox();
      const before = t.bus.published.length;
      await t.http.patch('/v1/me').set(auth(s.accessToken)).send({ bio: 'hello' }).expect(200);
      await t.relayOutbox();
      expect(t.bus.published.length).toBe(before);
    });

    it('rejects an empty update', async () => {
      const s = await signIn(t, undefined, 'Empty');
      await t.http.patch('/v1/me').set(auth(s.accessToken)).send({}).expect(400);
    });
  });

  describe('FR-ID-07 public profile', () => {
    it('shows public fields only', async () => {
      const s = await signIn(t, undefined, 'Public Person');
      const res = await t.http.get(`/v1/users/${s.user.id}`).expect(200);
      expect(res.body).toEqual({ id: s.user.id, displayName: 'Public Person', avatarUrl: null, bio: null });
      expect(res.body).not.toHaveProperty('email');
    });

    it('returns 404 for unknown users and users without a name yet', async () => {
      await t.http.get('/v1/users/0190f4c4-0000-7000-8000-000000000999').expect(404);
      const s = await signIn(t);
      await t.http.get(`/v1/users/${s.user.id}`).expect(404);
    });
  });

  describe('US-07 delete my account', () => {
    it('anonymises personal data and ends every session', async () => {
      const s = await signIn(t, undefined, 'Leaving');
      await t.http.delete('/v1/me').set(auth(s.accessToken)).expect(204);

      const row = await t.prisma.user.findUniqueOrThrow({ where: { id: s.user.id } });
      expect(row).toMatchObject({
        status: 'DELETED',
        displayName: 'Deleted user',
        bio: null,
        avatarUrl: null,
      });
      expect(row.email).not.toBe(s.email);

      await t.http.post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
      await t.http.get('/v1/me').set(auth(s.accessToken)).expect(404);

      await t.relayOutbox();
      expect(
        t.bus.ofType('user.deleted').some((e) => (e.data as { userId: string }).userId === s.user.id),
      ).toBe(true);

      // The email is free again: signing up creates a brand-new account.
      const fresh = await signIn(t, s.email);
      expect(fresh.user.id).not.toBe(s.user.id);
      expect(fresh.needsDisplayName).toBe(true);
    });
  });
});
