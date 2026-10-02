# Debugging Log

Every real bug that cost time: **symptom → cause → fix → prevention**. Newest first.

## 2026-10-02 — Runtime images carried the Prisma CLI and TypeScript (772 MB)

- **Symptom:** each service's runtime image was ~772 MB, far over CI's 200 MB budget; `node_modules` held `prisma`, `@prisma/studio-core`, `@prisma/dev`, `effect`, `@electric-sql/pglite` and `typescript`.
- **Cause:** `@prisma/client` declares `prisma` and `typescript` as *optional* peer dependencies. Both are dev dependencies of every service, so pnpm resolves the peers, and `pnpm deploy --prod` keeps them, with the CLI's whole dependency tree.
- **Fix:** `infra/docker/prune-runtime.mjs` runs after the deploy. It keeps only packages reachable through dependencies and required peers, and drops Prisma's query-compiler builds for unused databases (bundle 388 → 92 MB, image ~365 MB). The `migrate` target became a slim stage with only the Prisma CLI, instead of the whole build stage.
- **Prevention:** look at `docker history` and `du` inside an image whenever its size jumps. The CI budget still fails (Node alone is 126 MB); see HANDOFF §0 for the remaining options.

## 2026-10-02 — Parallel image builds failed with "pnpm install … exit code: 1"

- **Symptom:** `docker compose --profile app build` failed in one service's `pnpm install` step. Building that service alone succeeded.
- **Cause:** Compose builds all eight targets at once. Eight concurrent `pnpm install`s sharing one cache mount ran the 7 GB WSL VM out of resources.
- **Fix:** build one image at a time (LOCAL_SETUP §5); each `-migrate` target reuses its service's cached build stage.
- **Prevention:** build sequentially on small machines; log every build to a file and check the real exit code.

## 2026-10-02 — WSL stopped starting because the Docker disk filled D

- **Symptom:** WSL failed with `Wsl/Service/CreateInstance/E_FAIL`; D: had 0 bytes free and the distro's `ext4.vhdx` was 97.6 GB.
- **Cause:** repeated `docker compose up --build` runs, each leaving superseded images and gigabytes of BuildKit cache. A VHDX grows but never shrinks on its own. One rebuild also failed unnoticed because its output went through `| tail`, and a later one loaded `tools/design-parity` Chrome profiles into the build context.
- **Fix:** compacting freed nothing, because the blocks freed inside ext4 had never been trimmed. Mounting the disk to trim it needed free space for the journal replay. The distro was deleted and reinstalled (all code was on C: and pushed). `tools/` is now in `.dockerignore`.
- **Prevention:** the Docker rules in HANDOFF §0: build once and sequentially, clear old images and the build cache before rebuilding and after building, check free space first, and trim + compact the VHDX now and then.

## 2026-10-02 — A consumer could crash the process while the broker channel was closing

- **Symptom:** after adding a fourth RabbitMQ integration test, every test in the file failed with `IllegalOperationError: Channel closed`, thrown from `RabbitEventBus` after the tests had finished.
- **Cause:** the new test published `user.updated`, which also reached an earlier test's always-failing queue. That message was still cycling through retries when `afterAll` closed the bus; scheduling the next retry failed, and the fallback `ch.nack()` threw on the closed channel inside a fire-and-forget promise. In a service the same race at shutdown or a broker restart would surface as an unhandled rejection.
- **Fix:** the fallback `nack` is guarded. When the channel is already gone the broker requeues the unacked message by itself, so there is nothing left to do. The new test uses a routing key no other test binds.
- **Prevention:** integration tests that share a broker use their own routing keys; any broker call made after a failure is treated as able to fail too.

## 2026-09-28 — Full test runs sometimes hung forever after all tests passed

- **Symptom:** `pnpm test` across the monorepo occasionally never finished; a `jest` process and a lone `postgres.exe --forkchild="io_worker"` were left running, while the postmaster that spawned it was gone.
- **Cause:** PostgreSQL 18 introduced asynchronous I/O worker processes. On Windows an `io_worker` could outlive the postmaster and keep the inherited stdout/stderr pipes open, so `embedded-postgres` never observed the exit and `stop()` (and sometimes `start()`, which waits for a log line) waited forever.
- **Fix:** the test server runs with `io_method=sync` (no I/O workers); readiness is detected by actually running `SELECT 1`; start and teardown are bounded by timeouts.
- **Prevention:** anything that waits on an external process in test setup must have a timeout and a real health probe, not a log-line match.

## 2026-09-28 — "₹" could not be stored: `22P05 … has no equivalent in encoding "WIN1252"`

- **Symptom:** notifications whose text contained `₹` failed to insert; only in tests on Windows.
- **Cause:** the embedded PostgreSQL used by tests ran `initdb` with the Windows default encoding (WIN1252). The production image defaults to UTF-8, so the two environments silently differed.
- **Fix:** the test cluster is initialised with `--encoding=UTF8 --locale=C`, test databases are created `ENCODING 'UTF8' TEMPLATE template0`, and the Compose init script now states `ENCODING 'UTF8'` explicitly too.
- **Prevention:** never rely on a platform default for encoding; the notification tests assert on `₹` text, so a regression fails CI.

## 2026-09-28 — Integration tests took ~1 minute and printed MaxListenersExceeded warnings

- **Symptom:** a Competition test file took 58 s; Node warned about 11 `listening` listeners on the server.
- **Cause:** supertest, given an app that isn't listening, binds a fresh ephemeral port for every request; 50 concurrent join requests meant 50 listen/close cycles.
- **Fix:** test apps call `app.listen(0)` once and supertest targets the URL. The file now runs in ~3 s.
- **Prevention:** shared test helpers own app start-up, so every service gets this for free.

## 2026-09-28 — Refund worker retried a failed provider call in the same pass

- **Symptom:** a test simulating one provider outage saw the refund succeed immediately instead of staying pending.
- **Cause:** the worker loop re-selected the refund it had just failed (it was still the oldest pending row), so an outage got hammered by up to 20 retries in a burst.
- **Fix:** linear backoff in the claim query — a refund with `attempts > 0` is only retried after `30 s × attempts`.
- **Prevention:** every retry loop needs a backoff; covered by the "retries refunds while the provider is down" test.

## 2026-09-28 — Jest ran 10× slower than expected and warned about leaked handles

- **Symptom:** server-kit tests took ~50 s and Jest reported "a worker process has failed to exit gracefully".
- **Cause:** (1) ts-jest type-checked every file, including transpiling the ESM-only `jose` package on each run; (2) the readiness check raced each dependency check against a `setTimeout` that was never cleared.
- **Fix:** Jest now transpiles with SWC (`jest.preset.js`), and type-checking stays in the separate `typecheck` task; the health check clears its timer in `finally`. Suite time dropped to ~5 s.
- **Prevention:** every timer created in a `Promise.race` must be cleared; keep type-checking out of the test runner.

## 2026-09-28 — `Cannot find module 'tslib'` from `@nestjs/common` in tests

- **Symptom:** every Nest test failed to load; `tslib` was missing from `node_modules` although `@nestjs/common` depends on it.
- **Cause:** with `node-linker=hoisted`, pnpm listed `tslib` as *skipped* because it is also reachable through an optional, platform-specific dependency (`@unrs/resolver-binding-wasm32-wasi`) that was skipped on Windows — so the required copy was skipped too.
- **Fix:** declared `tslib` explicitly (root devDependency, and a dependency of each service so production bundles include it).
- **Prevention:** if a transitive dependency is "missing", check `node_modules/.modules.yaml` for a `skipped` entry before anything else.

## 2026-09-28 — Nest could not resolve `SigningKeys` for the token verifier

- **Symptom:** Identity failed to boot: "Nest can't resolve dependencies of the LocalTokenVerifier … in the CoreModule module".
- **Cause:** the verifier was registered inside the global `CoreModule`, which cannot see providers of the app module that imports it.
- **Fix:** the auth guard resolves `TokenVerifier` app-wide through `ModuleRef` (`strict: false`); Identity provides its local verifier in its own module, other services pass a JWKS verifier to `CoreModule`.
- **Prevention:** shared modules must not take providers that depend on the importing module; resolve them lazily or accept them as factories.
