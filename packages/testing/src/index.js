const { randomBytes } = require('node:crypto');
const { readdirSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

const adminUrl = () => {
  const url = process.env.TEST_PG_ADMIN_URL;
  if (!url)
    throw new Error('TEST_PG_ADMIN_URL is not set; add @feedants/testing/postgres-global-setup to Jest');
  return url;
};

/** Applies Prisma migration folders in order (the same SQL `prisma migrate deploy` runs). */
async function applyMigrations(url, migrationsDir) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) {
      const file = join(migrationsDir, dir, 'migration.sql');
      if (existsSync(file)) await client.query(readFileSync(file, 'utf8'));
    }
  } finally {
    await client.end();
  }
}

/**
 * Creates an isolated, fully migrated database for one test file.
 * @param {string} migrationsDir absolute path to prisma/migrations
 * @returns {Promise<{ url: string, drop: () => Promise<void> }>}
 */
async function createTestDatabase(migrationsDir) {
  const name = `test_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: adminUrl() });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
  await admin.end();

  const url = new URL(adminUrl());
  url.pathname = `/${name}`;
  await applyMigrations(url.toString(), migrationsDir);

  return {
    url: url.toString(),
    drop: async () => {
      const c = new Client({ connectionString: adminUrl() });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}

module.exports = { createTestDatabase, applyMigrations };
