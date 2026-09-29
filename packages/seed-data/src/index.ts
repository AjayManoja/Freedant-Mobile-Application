import { join } from 'node:path';

export * from './dataset';
export * from './ids';

/** Absolute path of a bundled demo image (copied from design/prototype, which is not in the build). */
export const assetPath = (file: string): string => join(__dirname, '..', 'assets', file);

/** Demo data must never reach a real database. */
export function assertSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production' && env.ALLOW_SEED !== 'true') {
    throw new Error('Refusing to seed demo data with NODE_ENV=production');
  }
}
