import {
  type DynamicModule,
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { HealthRegistry } from '../health';
import { EventBus } from './bus';
import { OutboxRelay, type TransactionalSqlClient } from './outbox';
import { RabbitEventBus } from './rabbit';

export interface MessagingModuleOptions {
  rabbitUrl: string;
  maxRetries: number;
  retryDelayMs: number;
  /** DI token of the service's Prisma client; omit for services without an outbox. */
  outbox?: {
    db: string | symbol | (abstract new (...args: never[]) => unknown);
    intervalMs: number;
    batchSize: number;
  };
}

const OPTIONS = Symbol('MESSAGING_OPTIONS');

@Injectable()
class MessagingLifecycle implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private relay?: OutboxRelay;

  constructor(
    @Inject(OPTIONS) private readonly options: MessagingModuleOptions,
    private readonly bus: EventBus,
    private readonly moduleRef: ModuleRef,
    private readonly health: HealthRegistry,
  ) {}

  onModuleInit(): void {
    this.health.register('rabbitmq', async () => {
      if (!this.bus.isConnected()) throw new Error('rabbitmq disconnected');
    });
  }

  onApplicationBootstrap(): void {
    const outbox = this.options.outbox;
    if (!outbox) return;
    const db = this.moduleRef.get(outbox.db as string, { strict: false }) as TransactionalSqlClient;
    this.relay = new OutboxRelay(db, this.bus, outbox);
    this.relay.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.relay?.stop();
    if (this.bus instanceof RabbitEventBus) await this.bus.close();
  }
}

/**
 * Event bus + outbox relay. Tests override `EventBus` with `InMemoryEventBus`
 * (and can drive `OutboxRelay.relayBatch()` directly).
 */
@Global()
@Module({})
export class MessagingModule {
  static forRoot(options: MessagingModuleOptions): DynamicModule {
    return {
      module: MessagingModule,
      providers: [
        { provide: OPTIONS, useValue: options },
        {
          provide: EventBus,
          useFactory: () =>
            new RabbitEventBus({
              url: options.rabbitUrl,
              maxRetries: options.maxRetries,
              retryDelayMs: options.retryDelayMs,
            }),
        },
        MessagingLifecycle,
      ],
      exports: [EventBus],
    };
  }
}
