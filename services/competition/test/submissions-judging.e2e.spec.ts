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

describe('Competition: submissions and judging (US-24 … US-29)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  const sub = (reg: string) => `/v1/registrations/${reg}/submission`;

  describe('US-24 upload my entry and save a draft', () => {
    it('issues an upload URL scoped to this entry and restores the draft', async () => {
      const me = uuidv7();
      const c = await seedCompetition(t, { entryFeePaise: 0 });
      const reg = await joinConfirmed(t, c.id, me);

      const up = await t.http
        .post(`${sub(reg)}/media-upload-url`)
        .set(as(me))
        .send({ contentType: 'video/mp4', sizeBytes: 40_000_000 })
        .expect(200);
      expect(up.body.key.startsWith(`submissions/${reg}/`)).toBe(true);
      t.storage.put(up.body.key, 'video/mp4', 40_000_000);
      await t.http
        .patch(sub(reg))
        .set(as(me))
        .send({ mediaKey: up.body.key, caption: 'Work in progress…' })
        .expect(200);

      const restored = await t.http.get(sub(reg)).set(as(me)).expect(200);
      expect(restored.body).toMatchObject({
        status: 'DRAFT',
        displayStatus: 'DRAFT',
        mediaType: 'VIDEO',
        caption: 'Work in progress…',
        checklist: { media: true, caption: true, rules: false, percent: 67 },
      });
      expect(restored.body.mediaUrl).toContain('signed=1');
    });

    it('rejects unsupported types and oversized files before upload (A-23)', async () => {
      const me = uuidv7();
      const c = await seedCompetition(t, { entryFeePaise: 0 });
      const reg = await joinConfirmed(t, c.id, me);
      await t.http
        .post(`${sub(reg)}/media-upload-url`)
        .set(as(me))
        .send({ contentType: 'application/pdf', sizeBytes: 10 })
        .expect(400);
      const big = await t.http
        .post(`${sub(reg)}/media-upload-url`)
        .set(as(me))
        .send({ contentType: 'image/png', sizeBytes: 11 * 1024 * 1024 })
        .expect(400);
      expect(big.body.error.details).toMatchObject({ kind: 'IMAGE' });
    });

    it('only lets confirmed owners work on an entry', async () => {
      const me = uuidv7();
      const c = await seedCompetition(t);
      const held = await t.http
        .post(`/v1/competitions/${c.id}/join`)
        .set(as(me))
        .set('Idempotency-Key', `k-${uuidv7()}`)
        .expect(200);
      await t.http.get(sub(held.body.registration.id)).set(as(me)).expect(403);
      await t.http.get(sub(held.body.registration.id)).set(as(uuidv7())).expect(404);
    });
  });

  describe('US-25 submit my final entry', () => {
    it('blocks an incomplete checklist, then locks the entry once submitted', async () => {
      const me = uuidv7();
      const c = await seedCompetition(t, { entryFeePaise: 0 });
      const reg = await joinConfirmed(t, c.id, me);
      await t.http.patch(sub(reg)).set(as(me)).send({ caption: 'short' }).expect(200);
      const blocked = await t.http
        .post(`${sub(reg)}/submit`)
        .set(as(me))
        .expect(409);
      expect(blocked.body.error).toMatchObject({ code: 'SUBMISSION_INCOMPLETE', details: { percent: 0 } });

      const id = await submitEntry(t, me, reg);
      const view = await t.http.get(sub(reg)).set(as(me)).expect(200);
      expect(view.body).toMatchObject({ id, status: 'SUBMITTED', displayStatus: 'IN_REVIEW' });
      expect(
        (await t.http.patch(sub(reg)).set(as(me)).send({ caption: 'changed my mind!!' }).expect(409)).body
          .error.code,
      ).toBe('SUBMISSION_LOCKED');
      await t.http
        .post(`${sub(reg)}/submit`)
        .set(as(me))
        .expect(200); // idempotent
      expect((await t.prisma.competition.findUniqueOrThrow({ where: { id: c.id } })).submissionCount).toBe(1);
    });

    it('refuses submissions after the window closes', async () => {
      const me = uuidv7();
      const c = await seedCompetition(t, { entryFeePaise: 0 });
      const reg = await joinConfirmed(t, c.id, me);
      await t.http
        .patch(sub(reg))
        .set(as(me))
        .send({ caption: 'A complete caption', rulesAccepted: true })
        .expect(200);
      await movePhase(t, c.id, 'JUDGING');
      expect(
        (
          await t.http
            .post(`${sub(reg)}/submit`)
            .set(as(me))
            .expect(409)
        ).body.error.code,
      ).toBe('SUBMISSION_WINDOW_CLOSED');
    });
  });

  describe('US-27, US-28, US-26: judging, results and my submissions', () => {
    const host = uuidv7();
    const [a, b, c3, d] = [uuidv7(), uuidv7(), uuidv7(), uuidv7()];
    let competitionId: string;
    const subs: Record<string, string> = {};
    const regs: Record<string, string> = {};

    beforeAll(async () => {
      // ₹1,000 pool → 3 tiers (500/300/200); ₹99 entry.
      const c = await seedCompetition(t, { hostId: host, prizePoolPaise: 100_000, entryFeePaise: 9_900 });
      competitionId = c.id;
      for (const u of [a, b, c3]) {
        regs[u] = await joinConfirmed(t, c.id, u);
        subs[u] = await submitEntry(t, u, regs[u]);
      }
      regs[d] = await joinConfirmed(t, c.id, d); // joins, never submits
      await t.http.patch(sub(regs[d])).set(as(d)).send({ rulesAccepted: true }).expect(200);
    });

    it('opens scoring only in the judging phase, only to the host', async () => {
      expect(
        (await t.http.get(`/v1/competitions/${competitionId}/entries`).set(as(host)).expect(409)).body.error
          .code,
      ).toBe('NOT_JUDGING_PHASE');
      await movePhase(t, competitionId, 'JUDGING');
      const entries = await t.http.get(`/v1/competitions/${competitionId}/entries`).set(as(host)).expect(200);
      expect(entries.body).toHaveLength(3);
      await t.http.get(`/v1/competitions/${competitionId}/entries`).set(as(a)).expect(404);
      await t.http.put(`/v1/submissions/${subs[a]}/score`).set(as(a)).send({ score: 10 }).expect(404);
    });

    it('scores on 0–10 with one decimal and blocks results until all are scored', async () => {
      await t.http.put(`/v1/submissions/${subs[a]}/score`).set(as(host)).send({ score: 8.25 }).expect(400);
      const scored = await t.http
        .put(`/v1/submissions/${subs[a]}/score`)
        .set(as(host))
        .send({ score: 8.5, comment: 'Lovely' })
        .expect(200);
      expect(scored.body).toMatchObject({ score: 8.5, comment: 'Lovely' });
      const blocked = await t.http
        .post(`/v1/competitions/${competitionId}/results`)
        .set(as(host))
        .expect(409);
      expect(blocked.body.error).toMatchObject({ code: 'UNSCORED_SUBMISSIONS', details: { unscored: 2 } });
    });

    it('hides scores from creators before results (A-27)', async () => {
      const mine = await t.http.get('/v1/me/submissions').set(as(a)).expect(200);
      expect(mine.body.items[0]).toMatchObject({ displayStatus: 'IN_REVIEW', result: null });
    });

    it('ranks by score with ties to the earlier submission, pays tiers and publishes (US-28)', async () => {
      await t.http.put(`/v1/submissions/${subs[b]}/score`).set(as(host)).send({ score: 9 }).expect(200);
      await t.http.put(`/v1/submissions/${subs[c3]}/score`).set(as(host)).send({ score: 8.5 }).expect(200); // ties with a; a submitted first
      const res = await t.http.post(`/v1/competitions/${competitionId}/results`).set(as(host)).expect(200);
      expect(
        res.body.entries.map((e: { creator: { id: string }; rank: number; prizePaise: number }) => [
          e.creator.id,
          e.rank,
          e.prizePaise,
        ]),
      ).toEqual([
        [b, 1, 50_000],
        [a, 2, 30_000],
        [c3, 3, 20_000],
      ]);

      const event = (await t.events('competition.results_published')).find(
        (e) => (e.data as { competitionId: string }).competitionId === competitionId,
      );
      expect(event?.data).toMatchObject({
        hostId: host,
        unawardedAmountPaise: 0,
        hostRevenuePaise: 4 * 9_900, // A-10: all four confirmed entries, platform fee excluded
      });
      expect(
        (event?.data as { allRegistrationCreatorIds: string[] }).allRegistrationCreatorIds.sort(),
      ).toEqual([a, b, c3, d].sort());

      // Results are final.
      await t.http.put(`/v1/submissions/${subs[a]}/score`).set(as(host)).send({ score: 10 }).expect(409);
      await t.http.post(`/v1/competitions/${competitionId}/results`).set(as(host)).expect(200); // idempotent
      const board = await t.http.get(`/v1/competitions/${competitionId}/leaderboard`).expect(200);
      expect(board.body.entries).toHaveLength(3);
    });

    it('US-26 shows Won / Not selected with the result, filterable', async () => {
      const won = await t.http.get('/v1/me/submissions').query({ status: 'WON' }).set(as(b)).expect(200);
      expect(won.body.items[0]).toMatchObject({
        displayStatus: 'WON',
        result: { rank: 1, score: 9, prizePaise: 50_000 },
      });
      const drafts = await t.http.get('/v1/me/submissions').query({ status: 'DRAFT' }).set(as(d)).expect(200);
      expect(drafts.body.items).toHaveLength(1);
      const none = await t.http.get('/v1/me/submissions').query({ status: 'WON' }).set(as(d)).expect(200);
      expect(none.body.items).toHaveLength(0);
    });
  });

  it('FR-JG-04: returns unawarded tiers to the host when entries are fewer than tiers', async () => {
    const host = uuidv7();
    const only = uuidv7();
    const c = await seedCompetition(t, { hostId: host, prizePoolPaise: 100_000, entryFeePaise: 0 });
    const reg = await joinConfirmed(t, c.id, only);
    const s = await submitEntry(t, only, reg);
    await movePhase(t, c.id, 'JUDGING');
    await t.http.put(`/v1/submissions/${s}/score`).set(as(host)).send({ score: 7 }).expect(200);
    await t.http.post(`/v1/competitions/${c.id}/results`).set(as(host)).expect(200);
    const event = (await t.events('competition.results_published')).find(
      (e) => (e.data as { competitionId: string }).competitionId === c.id,
    );
    expect(event?.data).toMatchObject({
      winners: [{ creatorId: only, rank: 1, amountPaise: 50_000 }],
      unawardedAmountPaise: 50_000,
      hostRevenuePaise: 0,
    });
  });

  it('keeps the leaderboard hidden until results are published', async () => {
    const c = await seedCompetition(t);
    await t.http.get(`/v1/competitions/${c.id}/leaderboard`).expect(404);
  });
});
