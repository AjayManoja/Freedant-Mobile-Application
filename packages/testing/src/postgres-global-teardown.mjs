export default async function globalTeardown() {
  const server = globalThis.__FEEDANTS_PG__;
  if (!server) return;
  // Never let a stuck shutdown hang the test run.
  await Promise.race([server.stop().catch(() => {}), new Promise((r) => setTimeout(r, 15_000).unref())]);
}
