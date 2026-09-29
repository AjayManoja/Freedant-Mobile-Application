import { Controller, Get, HttpCode, Injectable, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from './auth';

type Check = () => Promise<unknown>;

/** Services register the dependencies their readiness depends on (NFR-MT-05). */
@Injectable()
export class HealthRegistry {
  private readonly checks = new Map<string, Check>();

  register(name: string, check: Check): void {
    this.checks.set(name, check);
  }

  async run(timeoutMs = 2_000): Promise<{ ok: boolean; checks: Record<string, 'up' | 'down'> }> {
    const entries = await Promise.all(
      [...this.checks].map(async ([name, check]) => {
        let timer: NodeJS.Timeout | undefined;
        try {
          await Promise.race([
            check(),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
            }),
          ]);
          return [name, 'up'] as const;
        } catch {
          return [name, 'down'] as const;
        } finally {
          clearTimeout(timer);
        }
      }),
    );
    const checks = Object.fromEntries(entries);
    return { ok: entries.every(([, s]) => s === 'up'), checks };
  }
}

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly registry: HealthRegistry) {}

  /** Process is up. Never checks dependencies, so a DB outage doesn't restart every container. */
  @Get('live')
  @HttpCode(200)
  live() {
    return { status: 'ok' };
  }

  /** Dependencies reachable; the gateway and deploy smoke test use this. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.registry.run();
    res.status(result.ok ? 200 : 503);
    return { status: result.ok ? 'ok' : 'unavailable', checks: result.checks };
  }
}
