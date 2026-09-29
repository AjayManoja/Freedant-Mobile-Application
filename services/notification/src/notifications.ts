import {
  Controller,
  Get,
  HttpCode,
  Injectable,
  type OnApplicationBootstrap,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  AppError,
  type AuthUser,
  claimInbox,
  CurrentUser,
  EventBus,
  notFound,
  uuidv7,
  ZodPipe,
} from '@feedants/server-kit';
import {
  type EventEnvelope,
  type NotificationTarget,
  type NotificationView,
  type Page,
  type PaginationQuery,
  paginationQuerySchema,
  type UnreadCount,
} from '@feedants/shared';
import type { Notification, Prisma } from './generated/prisma/client';
import { PrismaService } from './prisma.service';
import { draftsFor, NOTIFYING_EVENTS } from './templates';

const CONSUMER = 'notification.all';

/**
 * One queue for every notifying event (EVENTS.md §2). If this service is down, the queue
 * simply grows and is drained on recovery — nothing upstream waits on it (NFR-RL-04).
 */
@Injectable()
export class NotificationConsumer implements OnApplicationBootstrap {
  constructor(
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.subscribe({
      queue: CONSUMER,
      routingKeys: NOTIFYING_EVENTS,
      handler: (e) => this.handle(e),
    });
  }

  async handle(event: EventEnvelope): Promise<void> {
    const drafts = draftsFor(event);
    // Fan-out and the inbox marker commit together: a crash mid-way is retried whole.
    await this.prisma.$transaction(async (tx) => {
      if (!(await claimInbox(tx, event.id, CONSUMER))) return;
      if (drafts.length === 0) return;
      await tx.notification.createMany({
        data: drafts.map((d) => ({
          id: uuidv7(),
          userId: d.userId,
          type: d.type,
          title: d.title,
          body: d.body,
          target: (d.target ?? undefined) as Prisma.InputJsonValue | undefined,
          sourceEventId: event.id,
          createdAt: new Date(event.occurredAt),
        })),
        skipDuplicates: true,
      });
    });
  }
}

const view = (n: Notification): NotificationView => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  target: (n.target as NotificationTarget | null) ?? null,
  read: n.readAt !== null,
  createdAt: n.createdAt.toISOString(),
});

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-NT-02: newest first, keyset-paginated. */
  async list(userId: string, q: PaginationQuery): Promise<Page<NotificationView>> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (q.cursor) {
      let at: Date;
      let id: string;
      try {
        [at, id] = (JSON.parse(Buffer.from(q.cursor, 'base64url').toString()) as [string, string]).map(
          (v, i) => (i === 0 ? new Date(v) : v),
        ) as [Date, string];
        if (Number.isNaN(at.getTime())) throw new Error();
      } catch {
        throw new AppError('VALIDATION_FAILED', 'Invalid cursor');
      }
      where.OR = [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }];
    }
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return {
      items: page.map(view),
      nextCursor:
        rows.length > q.limit && last
          ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString('base64url')
          : null,
    };
  }

  async unread(userId: string): Promise<UnreadCount> {
    return { unread: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string): Promise<UnreadCount> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (count === 0) throw notFound('Notification');
    return this.unread(userId);
  }

  async markAllRead(userId: string): Promise<UnreadCount> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { unread: 0 };
  }
}

@Controller('v1/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(paginationQuerySchema)) q: PaginationQuery) {
    return this.notifications.list(user.id, q);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unread(user.id);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
