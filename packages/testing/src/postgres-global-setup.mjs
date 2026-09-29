import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

/** Resolves once the server answers a query — the only reliable "ready" signal. */
async function untilReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1_000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch {
      await client.end().catch(() => {});
      if (Date.now() > deadline)
        throw new Error(`Embedded PostgreSQL did not become ready within ${timeoutMs} ms`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

/**
 * Jest globalSetup: one throwaway PostgreSQL server per test run. Workers inherit
 * TEST_PG_ADMIN_URL and create their own databases from it.
 * Set TEST_PG_ADMIN_URL yourself to reuse an existing server (e.g. a CI service container).
 */
export default async function globalSetup() {
  if (process.env.TEST_PG_ADMIN_URL) return;
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), 'feedants-pg-'));
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    // Windows initdb defaults to WIN1252; production is UTF-8 (₹ must round-trip).
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    // PostgreSQL 18 async-I/O worker processes can outlive the postmaster on Windows and
    // keep its pipes open, hanging shutdown; tests don't need async I/O.
    postgresFlags: ['-c', 'io_method=sync', '-c', 'max_connections=300'],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
  // embedded-postgres waits for a specific log line, which is occasionally missed on
  // Windows and would hang the run forever; a successful query is the real signal.
  const started = server.start().catch(() => {});
  await Promise.race([started, untilReady(url, 60_000)]);
  await untilReady(url, 60_000);
  globalThis.__FEEDANTS_PG__ = server;
  process.env.TEST_PG_ADMIN_URL = url;
}
