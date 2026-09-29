import { uuidv7 } from '@feedants/server-kit';
import {
  as,
  createTestApp,
  joinConfirmed,
  movePhase,
  seedCompetition,
  submitEntry,
  type TestApp,
} from './helpers';

type Item = { id: string; title: string };

describe('Competition: discovery (US-08 … US-13)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  describe('US-08 home', () => {
    it('builds every section by its rule (A-18)', async () => {
      const big = await seedCompetition(t, { prizePoolPaise: 5_000_000, title: 'Grand Prize Dance-off' });
      const soon = await seedCompetition(t, {
        registrationClosesInMs: 3_600_000,
        title: 'Closing Soon Sketch',
      });
      const upcoming = await seedCompetition(t, { phase: 'UPCOMING', title: 'Future Poetry Night' });
      await joinConfirmed(t, soon.id, uuidv7());
      await joinConfirmed(t, soon.id, uuidv7());

      const res = await t.http.get('/v1/home').expect(200);
      const ids = (xs: Item[]) => xs.map((x) => x.id);
      expect(res.body.featured.id).toBe(big.id);
      expect(res.body.topPrize[0].id).toBe(big.id);
      expect(ids(res.body.endingSoon)).toContain(soon.id);
      expect(ids(res.body.endingSoon)).not.toContain(big.id);
      expect(ids(res.body.upcoming)).toEqual([upcoming.id]);
      expect(res.body.trending[0].id).toBe(soon.id);
      expect(res.body.categories).toHaveLength(8);
      expect(res.body.me).toBeNull();
    });

    it('prefers a seed-featured competition', async () => {
      const pick = await seedCompetition(t, { prizePoolPaise: 60_000, title: 'Editors Pick' });
      await t.prisma.competition.update({ where: { id: pick.id }, data: { featured: true } });
      expect((await t.http.get('/v1/home').expect(200)).body.featured.id).toBe(pick.id);
      await t.prisma.competition.update({ where: { id: pick.id }, data: { featured: false } });
    });

    it('shows signed-in stats and the finish-your-submission shortcut (FR-DS-02)', async () => {
      const me = uuidv7();
      const c = await seedCompetition(t, { entryFeePaise: 0 });
      const reg = await joinConfirmed(t, c.id, me);
      await t.http
        .patch(`/v1/registrations/${reg}/submission`)
        .set(as(me))
        .send({ rulesAccepted: true })
        .expect(200);

      const res = await t.http.get('/v1/home').set(as(me)).expect(200);
      expect(res.body.me).toMatchObject({
        joined: 1,
        won: 0,
        draft: { registrationId: reg, competitionId: c.id, percent: 33 },
      });
    });
  });

  describe('US-09 browse and filter', () => {
    it('filters by category and phase', async () => {
      const coding = await seedCompetition(t, { categorySlug: 'coding', title: 'React UI Challenge' });
      await seedCompetition(t, { categorySlug: 'coding', phase: 'UPCOMING' });
      const res = await t.http
        .get('/v1/competitions')
        .query({ category: 'coding', phase: 'OPEN' })
        .expect(200);
      expect(res.body.items.map((i: Item) => i.id)).toEqual([coding.id]);
      expect(res.body.items[0]).toMatchObject({ phase: 'OPEN', category: { slug: 'coding' } });
      expect(res.body.total).toBe(1);
    });

    it('counts live competitions per category', async () => {
      const res = await t.http.get('/v1/categories').expect(200);
      const coding = res.body.find((c: { slug: string }) => c.slug === 'coding');
      const live = await t.prisma.competition.count({
        where: { status: 'PUBLISHED', category: { slug: 'coding' } },
      });
      expect(coding.liveCount).toBe(live);
      expect(live).toBeGreaterThan(0);
    });

    it.each(['popular', 'prize', 'ending', 'newest'])(
      'pages by %s with no duplicates or gaps',
      async (sort) => {
        const cat = 'cooking';
        const created = new Set<string>();
        for (let i = 0; i < 7; i++) {
          const c = await seedCompetition(t, {
            categorySlug: cat,
            prizePoolPaise: 50_000 + (i % 3) * 10_000,
            confirmedCount: i % 2,
          });
          created.add(c.id);
        }
        const seen: string[] = [];
        let cursor: string | null = null;
        do {
          const res: { body: { items: Item[]; total: number | null; nextCursor: string | null } } =
            await t.http
              .get('/v1/competitions')
              .query({ category: cat, sort, limit: 3, ...(cursor ? { cursor } : {}) })
              .expect(200);
          seen.push(...res.body.items.map((i) => i.id));
          // The total arrives with the first page only.
          expect(res.body.total).toBe(cursor ? null : created.size);
          cursor = res.body.nextCursor;
        } while (cursor);
        expect(new Set(seen).size).toBe(seen.length);
        expect(new Set(seen)).toEqual(created);
        await t.prisma.prizeTier.deleteMany({ where: { competitionId: { in: [...created] } } });
        await t.prisma.competition.deleteMany({ where: { id: { in: [...created] } } });
      },
    );

    it('returns an empty page for no matches and rejects bad input', async () => {
      const res = await t.http
        .get('/v1/competitions')
        .query({ category: 'gaming', phase: 'JUDGING' })
        .expect(200);
      expect(res.body).toEqual({ items: [], total: 0, nextCursor: null });
      await t.http.get('/v1/competitions').query({ sort: 'random' }).expect(400);
      await t.http.get('/v1/competitions').query({ cursor: 'not-a-cursor' }).expect(400);
    });
  });

  describe('US-10 search', () => {
    it('matches title, category and host name, tolerating typos', async () => {
      const host = uuidv7();
      await t.userUpdated(host, 'Ishita Rao');
      const photo = await seedCompetition(t, { categorySlug: 'photography', title: 'Monsoon Streets' });
      const poem = await seedCompetition(t, { hostId: host, categorySlug: 'writing', title: 'Rain Verses' });
      const slam = await seedCompetition(t, { categorySlug: 'writing', title: 'Midnight Poetry Slam' });

      const byTypo = await t.http.get('/v1/search').query({ q: 'photgraphy' }).expect(200);
      expect(byTypo.body.items.map((i: Item) => i.id)).toContain(photo.id);
      const byHost = await t.http.get('/v1/search').query({ q: 'ishita' }).expect(200);
      expect(byHost.body.items.map((i: Item) => i.id)).toContain(poem.id);
      const byTitle = await t.http.get('/v1/search').query({ q: 'poetry slam' }).expect(200);
      expect(byTitle.body.items[0].id).toBe(slam.id);
      expect(byTitle.body.items.map((i: Item) => i.id)).not.toContain(photo.id);
    });

    it('needs at least 2 characters', async () => {
      await t.http.get('/v1/search').query({ q: 'a' }).expect(400);
    });

    it('pages search results without duplicates', async () => {
      for (let i = 0; i < 5; i++) await seedCompetition(t, { title: `Guitar Cover Battle ${i}` });
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res: { body: { items: Item[]; total: number | null; nextCursor: string | null } } = await t.http
          .get('/v1/search')
          .query({ q: 'guitar cover', limit: 2, ...(cursor ? { cursor } : {}) })
          .expect(200);
        seen.push(...res.body.items.map((i) => i.id));
        cursor = res.body.nextCursor;
      } while (cursor);
      expect(seen.length).toBeGreaterThanOrEqual(5);
      expect(new Set(seen).size).toBe(seen.length);
    });
  });

  describe('US-11 view a competition', () => {
    it('shows every fact, the countdown clock and my status', async () => {
      const host = uuidv7();
      await t.userUpdated(host, 'Neha Kapoor', 'http://storage.test/public/avatars/neha.png');
      const c = await seedCompetition(t, { hostId: host, prizePoolPaise: 500_000, entryFeePaise: 9_900 });
      const guest = await t.http.get(`/v1/competitions/${c.id}`).expect(200);
      expect(guest.body).toMatchObject({
        host: { id: host, displayName: 'Neha Kapoor' },
        prizePoolPaise: 500_000,
        fees: { entryFeePaise: 9_900, platformFeePaise: 1_000, totalPaise: 10_900 },
        spotsRemaining: 100,
        phase: 'OPEN',
        viewer: null,
      });
      expect(guest.body.prizeTiers).toHaveLength(5);
      expect(Math.abs(new Date(guest.body.serverTime).getTime() - Date.now())).toBeLessThan(5_000);

      const me = uuidv7();
      const reg = await joinConfirmed(t, c.id, me);
      const mine = await t.http.get(`/v1/competitions/${c.id}`).set(as(me)).expect(200);
      expect(mine.body.viewer).toMatchObject({
        isHost: false,
        registration: { id: reg, status: 'CONFIRMED' },
      });
    });

    it('returns 404 for unknown IDs', async () => {
      await t.http.get(`/v1/competitions/${uuidv7()}`).expect(404);
      await t.http.get('/v1/competitions/not-a-uuid').expect(400);
    });
  });

  describe('US-12 notify me', () => {
    it('subscribes to an upcoming competition and announces the opening once', async () => {
      const me = uuidv7();
      const c = await seedCompetition(t, { phase: 'UPCOMING' });
      await t.http.put(`/v1/competitions/${c.id}/notify`).set(as(me)).expect(200, { notifyOn: true });
      expect((await t.http.get(`/v1/competitions/${c.id}`).set(as(me))).body.viewer.notifyOn).toBe(true);

      await movePhase(t, c.id, 'OPEN');
      await t.sweeps.announceOpenings();
      await t.sweeps.announceOpenings();
      const events = (await t.events('competition.registration_opened')).filter(
        (e) => (e.data as { competitionId: string }).competitionId === c.id,
      );
      expect(events).toHaveLength(1);
      expect(events[0]!.data).toMatchObject({ subscriberUserIds: [me] });
    });

    it('can be turned off, and is refused once registration is open', async () => {
      const me = uuidv7();
      const c = await seedCompetition(t, { phase: 'UPCOMING' });
      await t.http.put(`/v1/competitions/${c.id}/notify`).set(as(me)).expect(200);
      await t.http.delete(`/v1/competitions/${c.id}/notify`).set(as(me)).expect(200, { notifyOn: false });
      const open = await seedCompetition(t);
      await t.http.put(`/v1/competitions/${open.id}/notify`).set(as(me)).expect(409);
    });
  });

  describe('US-13 top hosts and recent winners', () => {
    it('ranks hosts and links recent winners to their profiles', async () => {
      const host = uuidv7();
      const winner = uuidv7();
      await t.userUpdated(host, 'Top Host');
      await t.userUpdated(winner, 'Riya Sharma');
      const c = await seedCompetition(t, { hostId: host, entryFeePaise: 0 });
      await seedCompetition(t, { hostId: host });
      await seedCompetition(t, { hostId: host });
      const reg = await joinConfirmed(t, c.id, winner);
      const sub = await submitEntry(t, winner, reg);
      await movePhase(t, c.id, 'JUDGING');
      await t.http.put(`/v1/submissions/${sub}/score`).set(as(host)).send({ score: 9.5 }).expect(200);
      await t.http.post(`/v1/competitions/${c.id}/results`).set(as(host)).expect(200);

      const hosts = await t.http.get('/v1/hosts/top').expect(200);
      expect(hosts.body[0]).toMatchObject({
        id: host,
        displayName: 'Top Host',
        competitionsRun: 3,
        completed: 1,
      });
      const home = await t.http.get('/v1/home').expect(200);
      expect(home.body.recentWinners[0]).toMatchObject({
        userId: winner,
        displayName: 'Riya Sharma',
        competitionId: c.id,
        rank: 1,
      });
      expect(home.body.recentWinners[0]).toHaveProperty('competitionCoverUrl');

      const profile = await t.http.get(`/v1/winners/${winner}`).expect(200);
      expect(profile.body).toMatchObject({
        displayName: 'Riya Sharma',
        joined: 1,
        won: 1,
        placements: [{ competitionId: c.id, rank: 1 }],
      });
      expect(profile.body.totalWinningsPaise).toBe(profile.body.placements[0].prizePaise);
      expect(profile.body.placements[0]).toHaveProperty('competitionCoverUrl');
      expect(profile.body.placements[0]).toHaveProperty('categoryName');
      const stats = await t.http.get(`/v1/users/${winner}/stats`).expect(200);
      expect(stats.body).toMatchObject({ joined: 1, won: 1 });
    });
  });

  describe('US-05 names from Identity (user.updated)', () => {
    it('updates the host name everywhere and ignores out-of-order older events', async () => {
      const host = uuidv7();
      const c = await seedCompetition(t, { hostId: host });
      expect((await t.http.get(`/v1/competitions/${c.id}`)).body.host.displayName).toBe('Feedants user');

      const { buildEvent } = await import('@feedants/server-kit');
      const { UserEventsConsumer } = await import('../src/profiles/user-events.consumer');
      const consumer = t.app.get(UserEventsConsumer);
      const newer = buildEvent('identity', 'user.updated', {
        userId: host,
        displayName: 'New Name',
        avatarUrl: null,
      });
      const older = {
        ...buildEvent('identity', 'user.updated', { userId: host, displayName: 'Old Name', avatarUrl: null }),
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
      };
      await consumer.handle(newer);
      await consumer.handle(older);
      await consumer.handle(newer); // duplicate delivery
      expect((await t.http.get(`/v1/competitions/${c.id}`)).body.host.displayName).toBe('New Name');
    });
  });
});
