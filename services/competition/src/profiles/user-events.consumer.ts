import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { claimInbox, EventBus, parseEvent } from '@feedants/server-kit';
import type { EventEnvelope } from '@feedants/shared';
import { PrismaService } from '../prisma.service';
import { DiscoveryService } from '../discovery/discovery.service';

const CONSUMER = 'competition.user-updated';

/**
 * Keeps the local copy of public profile fields current (US-05: a new name shows on the
 * host's competitions within seconds). Events can arrive out of order, so an older event
 * never overwrites a newer one.
 */
@Injectable()
export class UserEventsConsumer implements OnApplicationBootstrap {
  constructor(
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bus.subscribe({
      queue: CONSUMER,
      routingKeys: ['user.updated'],
      handler: (e) => this.handle(e),
    });
  }

  async handle(event: EventEnvelope): Promise<void> {
    const p = parseEvent(event, 'user.updated');
    const occurredAt = new Date(event.occurredAt);
    await this.prisma.$transaction(async (tx) => {
      if (!(await claimInbox(tx, event.id, CONSUMER))) return;
      await tx.$executeRaw`
        INSERT INTO user_profiles (user_id, display_name, avatar_url, updated_at)
        VALUES (${p.userId}::uuid, ${p.displayName}, ${p.avatarUrl}, ${occurredAt})
        ON CONFLICT (user_id) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              avatar_url = EXCLUDED.avatar_url,
              updated_at = EXCLUDED.updated_at
          WHERE user_profiles.updated_at <= EXCLUDED.updated_at`;
    });
    await this.discovery.invalidateHome();
  }
}
