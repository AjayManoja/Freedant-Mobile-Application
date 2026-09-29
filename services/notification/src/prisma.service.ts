import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ENV, HealthRegistry } from '@feedants/server-kit';
import { PrismaPg } from '@prisma/adapter-pg';
import type { NotificationEnv } from './config';
import { PrismaClient } from './generated/prisma/client';

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(ENV) env: NotificationEnv,
    private readonly health: HealthRegistry,
  ) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: 10 }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.health.register('postgres', () => this.$queryRawUnsafe('SELECT 1'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
