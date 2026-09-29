#!/usr/bin/env node
// Dev loop for a NestJS service without extra tooling: `tsc --watch` compiles (keeping
// decorator metadata, which esbuild-based runners drop) and `node --watch` restarts on
// output changes. Run from a service folder: `pnpm dev`.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], {
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
});

let app;
tsc.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (!app && /Found 0 errors/.test(chunk.toString()) && existsSync('dist/main.js')) {
    const envArgs = existsSync('.env') ? ['--env-file=.env'] : [];
    app = spawn(process.execPath, [...envArgs, '--enable-source-maps', '--watch-path=dist', 'dist/main.js'], {
      stdio: 'inherit',
    });
  }
});

const stop = () => {
  app?.kill();
  tsc.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
