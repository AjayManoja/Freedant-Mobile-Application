import { Inject, Injectable } from '@nestjs/common';
import { AppError, extensionFor, notFound, ObjectStorage, uuidv7 } from '@feedants/server-kit';
import {
  isSubmissionOpen,
  type MediaUploadRequest,
  mediaKindOf,
  type MySubmissionsQuery,
  type MySubmissionsSummary,
  type Page,
  submissionChecklist,
  type SubmissionDisplayStatus,
  type SubmissionUpdateInput,
  type SubmissionView,
  type UploadUrlResponse,
} from '@feedants/shared';
import { RULES, type Rules } from '../config';
import type { Category, Competition, Prisma, Registration, Submission } from '../generated/prisma/client';
import { outbox } from '../outbox';
import { PrismaService } from '../prisma.service';
import { decodeCursor, displayPhase, encodeCursor, iso, windows } from '../views';

const mediaPrefix = (registrationId: string) => `submissions/${registrationId}/`;
const withCompetition = { competition: { include: { category: true } } } as const;
type Row = Submission & { competition: Competition & { category: Category | null } };

export function displayStatus(s: Submission, c: Competition): SubmissionDisplayStatus {
  if (s.status === 'DRAFT') return 'DRAFT';
  if (c.status !== 'RESULTS_PUBLISHED') return 'IN_REVIEW';
  return s.prizePaise > 0 ? 'WON' : 'NOT_SELECTED';
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage,
    @Inject(RULES) private readonly rules: Rules,
  ) {}

  /** FR-SB-03: the draft is created on first open and restored afterwards. */
  async getOrCreate(creatorId: string, registrationId: string): Promise<SubmissionView> {
    const reg = await this.ownedConfirmed(creatorId, registrationId);
    let s = await this.prisma.submission.findUnique({
      where: { registrationId },
      include: withCompetition,
    });
    if (!s) {
      try {
        s = await this.prisma.submission.create({
          data: { id: uuidv7(), registrationId, competitionId: reg.competitionId, creatorId },
          include: withCompetition,
        });
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err;
        s = await this.prisma.submission.findUniqueOrThrow({
          where: { registrationId },
          include: withCompetition,
        });
      }
    }
    return this.view(s);
  }

  async uploadUrl(
    creatorId: string,
    registrationId: string,
    req: MediaUploadRequest,
  ): Promise<UploadUrlResponse> {
    await this.ownedConfirmed(creatorId, registrationId);
    const existing = await this.prisma.submission.findUnique({ where: { registrationId } });
    if (existing?.status === 'SUBMITTED')
      throw new AppError('SUBMISSION_LOCKED', 'This entry has been submitted');
    const kind = mediaKindOf(req.contentType)!;
    const max = this.rules.media[kind].maxBytes;
    if (req.sizeBytes > max) {
      throw new AppError('VALIDATION_FAILED', 'File is too large', { maxBytes: max, kind });
    }
    const key = `${mediaPrefix(registrationId)}${uuidv7()}.${extensionFor(req.contentType)}`;
    return this.storage.presignUpload({ key, contentType: req.contentType, maxBytes: max });
  }

  /** FR-SB-03: autosave. Only drafts change; a submitted entry is final (FR-SB-04, A-25). */
  async update(
    creatorId: string,
    registrationId: string,
    input: SubmissionUpdateInput,
  ): Promise<SubmissionView> {
    await this.getOrCreate(creatorId, registrationId);
    const data: Prisma.SubmissionUpdateInput = {};
    if (input.caption !== undefined) data.caption = input.caption || null;
    if (input.rulesAccepted !== undefined) data.rulesAccepted = input.rulesAccepted;
    if (input.mediaKey !== undefined) {
      if (input.mediaKey === null) {
        Object.assign(data, { mediaKey: null, mediaKind: null, mediaContentType: null });
      } else {
        if (!input.mediaKey.startsWith(mediaPrefix(registrationId))) {
          throw new AppError('FORBIDDEN', 'That upload does not belong to this entry');
        }
        const object = await this.storage.exists(input.mediaKey);
        const kind = object?.contentType ? mediaKindOf(object.contentType) : null;
        if (!object || !kind)
          throw new AppError('VALIDATION_FAILED', 'Upload not found; upload the file first');
        Object.assign(data, {
          mediaKey: input.mediaKey,
          mediaKind: kind,
          mediaContentType: object.contentType,
        });
      }
    }
    const { count } = await this.prisma.submission.updateMany({
      where: { registrationId, status: 'DRAFT' },
      data: data as Prisma.SubmissionUpdateManyMutationInput,
    });
    if (count === 0) throw new AppError('SUBMISSION_LOCKED', 'This entry has been submitted');
    const s = await this.prisma.submission.findUniqueOrThrow({
      where: { registrationId },
      include: withCompetition,
    });
    return this.view(s);
  }

  /** FR-SB-04 / US-25. */
  async submit(creatorId: string, registrationId: string): Promise<SubmissionView> {
    const reg = await this.ownedConfirmed(creatorId, registrationId);
    const s = await this.prisma.submission.findUnique({
      where: { registrationId },
      include: withCompetition,
    });
    if (!s) throw new AppError('SUBMISSION_INCOMPLETE', 'Add your entry before submitting');
    if (s.status === 'SUBMITTED') return this.view(s); // idempotent re-submit
    if (s.competition.status !== 'PUBLISHED' || !isSubmissionOpen(windows(s.competition), new Date())) {
      throw new AppError('SUBMISSION_WINDOW_CLOSED', 'Submissions are closed');
    }
    const checklist = submissionChecklist(s, this.rules);
    if (checklist.percent < 100) {
      throw new AppError('SUBMISSION_INCOMPLETE', 'Complete the checklist before submitting', checklist);
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.submission.updateMany({
        where: { id: s.id, status: 'DRAFT' },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      if (count === 0) return;
      await tx.competition.update({
        where: { id: reg.competitionId },
        data: { submissionCount: { increment: 1 } },
      });
      await tx.outboxEvent.create({
        data: outbox(
          'submission.submitted',
          { type: 'submission', id: s.id },
          {
            submissionId: s.id,
            competitionId: reg.competitionId,
            creatorId,
          },
        ),
      });
    });
    const updated = await this.prisma.submission.findUniqueOrThrow({
      where: { id: s.id },
      include: withCompetition,
    });
    return this.view(updated);
  }

  /** FR-SB-05 / US-26. */
  async mine(creatorId: string, q: MySubmissionsQuery): Promise<Page<SubmissionView>> {
    const after = decodeCursor(q.cursor);
    if (q.cursor && !after) throw new AppError('VALIDATION_FAILED', 'Invalid cursor');
    const and: Prisma.SubmissionWhereInput[] = [{ creatorId }];
    switch (q.status) {
      case 'DRAFT':
        and.push({ status: 'DRAFT' });
        break;
      case 'IN_REVIEW':
        and.push({ status: 'SUBMITTED', competition: { status: { not: 'RESULTS_PUBLISHED' } } });
        break;
      case 'WON':
        and.push({
          status: 'SUBMITTED',
          prizePaise: { gt: 0 },
          competition: { status: 'RESULTS_PUBLISHED' },
        });
        break;
      case 'NOT_SELECTED':
        and.push({ status: 'SUBMITTED', prizePaise: 0, competition: { status: 'RESULTS_PUBLISHED' } });
        break;
    }
    if (after) {
      const at = new Date(String(after[0]));
      and.push({ OR: [{ updatedAt: { lt: at } }, { updatedAt: at, id: { lt: after[1] } }] });
    }
    const rows = await this.prisma.submission.findMany({
      where: { AND: and },
      include: withCompetition,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return {
      items: await Promise.all(page.map((s) => this.view(s))),
      nextCursor: rows.length > q.limit && last ? encodeCursor(last.updatedAt.toISOString(), last.id) : null,
    };
  }

  /** US-26: counts behind the filter chips, and what the creator has won so far. */
  async summary(creatorId: string): Promise<MySubmissionsSummary> {
    const published = { status: 'RESULTS_PUBLISHED' } as const;
    const [all, draft, inReview, won, notSelected, winnings] = await Promise.all([
      this.prisma.submission.count({ where: { creatorId } }),
      this.prisma.submission.count({ where: { creatorId, status: 'DRAFT' } }),
      this.prisma.submission.count({
        where: { creatorId, status: 'SUBMITTED', competition: { status: { not: 'RESULTS_PUBLISHED' } } },
      }),
      this.prisma.submission.count({
        where: { creatorId, status: 'SUBMITTED', prizePaise: { gt: 0 }, competition: published },
      }),
      this.prisma.submission.count({
        where: { creatorId, status: 'SUBMITTED', prizePaise: 0, competition: published },
      }),
      this.prisma.submission.aggregate({
        where: { creatorId, status: 'SUBMITTED', competition: published },
        _sum: { prizePaise: true },
      }),
    ]);
    return {
      counts: { ALL: all, DRAFT: draft, IN_REVIEW: inReview, WON: won, NOT_SELECTED: notSelected },
      totalWinningsPaise: winnings._sum.prizePaise ?? 0,
    };
  }

  async view(s: Row): Promise<SubmissionView> {
    const c = s.competition;
    const published = c.status === 'RESULTS_PUBLISHED';
    return {
      id: s.id,
      registrationId: s.registrationId,
      competition: {
        id: c.id,
        title: c.title ?? 'Competition',
        coverUrl: c.coverUrl,
        submissionEndsAt: iso(c.submissionEndsAt),
        phase: displayPhase(c, new Date()),
        categoryName: c.category?.name ?? null,
      },
      status: s.status,
      displayStatus: displayStatus(s, c),
      mediaType: s.mediaKind,
      mediaContentType: s.mediaContentType,
      mediaUrl: s.mediaKey ? await this.storage.presignRead(s.mediaKey) : null,
      caption: s.caption,
      rulesAccepted: s.rulesAccepted,
      checklist: submissionChecklist(s, this.rules),
      submittedAt: iso(s.submittedAt),
      // A-27: nothing about scores leaks before results are published.
      result:
        published && s.status === 'SUBMITTED'
          ? {
              rank: s.rank,
              score: s.scoreTenths === null ? null : s.scoreTenths / 10,
              prizePaise: s.prizePaise,
            }
          : null,
    };
  }

  private async ownedConfirmed(creatorId: string, registrationId: string): Promise<Registration> {
    const reg = await this.prisma.registration.findUnique({ where: { id: registrationId } });
    if (!reg || reg.creatorId !== creatorId) throw notFound('Registration');
    if (reg.status !== 'CONFIRMED') {
      throw new AppError('FORBIDDEN', 'Only confirmed participants can submit');
    }
    return reg;
  }
}
