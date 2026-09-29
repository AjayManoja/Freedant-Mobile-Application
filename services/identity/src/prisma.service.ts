import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ENV, HealthRegistry } from '@feedants/server-kit';
import { PrismaPg } from '@prisma/adapter-pg';
import type { IdentityEnv } from './config';
import { PrismaClient } from './generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(ENV) env: IdentityEnv,
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
