# Handoff

Updated 2026-10-02 at the end of the session that added tracing, deployment, alerting and backups
(US-36…39). Branch: `feat/mobile-design-port`.

## 0. First: rebuild the local environment (WSL was deleted)

On 2026-10-02, repeated image rebuilds grew the WSL disk (`D:\WSL\Ubuntu-24.04\ext4.vhdx`) to
fill D: completely (97.6 GB, 0 bytes free), and WSL stopped starting (`E_FAIL`). Compacting with
diskpart freed nothing (the freed blocks were never trimmed), and the disk couldn't be mounted to
trim it, so the user is deleting the distro to free D:. All code is pushed (`0764d34`) and lives
on C:, as does `infra/docker/.env`; only Docker images, build cache and the local demo data are lost.

Rebuild, in this order:

1. **Reinstall Ubuntu on D:** (keep C: free):
   `wsl --install -d Ubuntu-24.04 --location D:\WSL\Ubuntu-24.04`, then make the disk return freed
   space to D: automatically: `wsl --shutdown; wsl --manage Ubuntu-24.04 --set-sparse true`.
2. **Install Docker Engine** in Ubuntu (Docker's apt repository: `docker-ce`, `docker-ce-cli`,
   `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin`); `sudo usermod -aG docker $USER`.
3. **Check space first:** `Get-PSDrive C,D` (Windows) and `df -h /` (Ubuntu). A full build needs
   roughly 10-15 GB on D:.
4. **Build once:**
   `cd /mnt/c/Users/Dell/Projects/feedants && docker compose -f infra/docker/compose.yaml --profile app up -d --build > /tmp/build.log 2>&1; echo "exit $?"`
   then the seed loop in §4. Add `--profile monitoring` only when alerting is needed.
5. **Verify** with the smoke test (`bash infra/host/smoke.sh http://localhost:8080`) and one
   join-and-pay trace in Jaeger. This also verifies the last code change: the Express `{/*splat}`
   span filter was reverted because it corrupted `http.route`. Routes must read
   `POST /v1/competitions/:id/join`, not `{/*splat}{/*splat}/...`.

**Docker hygiene (the user's rule): never rebuild blindly.**

- Batch changes, then build once. Never pipe build output through `tail` alone; it hides failures
  (that is how a failed rebuild went unnoticed this session). Check the exit code.
- After a failed build, or before a rebuild: delete the old images and cache, then build again:
  `docker compose -f infra/docker/compose.yaml --profile app down`,
  `docker image rm $(docker image ls --filter "reference=feedants-*" -q)`, `docker builder prune -af`,
  `docker image prune -f`.
- Check free space on D: before every build. Every so often, `sudo fstrim -av` in Ubuntu followed
  by `wsl --shutdown` hands freed space back to D: (sparse mode does this automatically).
- `tools/` is now in `.dockerignore`; Chrome profiles under `tools/design-parity` broke a build
  context load ("cannot allocate memory").
- To-do: the `migrate` target is `FROM build`, so each migration image carries the whole build
  stage (all dependencies). A slim stage with only the Prisma CLI, the schema and the migrations
  would cut four large images down to a few MB each.

## 1. Where things stand

- **Backend (Phase 2/3 services):** identity, competition, payment, notification are complete for
  user stories US-01…US-33, with e2e tests (all passing; `pnpm turbo run test --filter='!@feedants/mobile'`).
  US-34 (local stack + seed) and US-35 (CI) are done. **US-36…39 are built and verified locally**
  (§1a); production has not been provisioned yet (§1b).
- **Mobile app:** every screen is ported to the design (`design/reference` + `design/prototype/src`)
  — see §3. The old kit `src/components/ui.tsx` is deleted; everything uses `src/design/`.
- **Backend additions for the port (previous session):**
  - `GET /v1/me/submissions/summary` → counts per status + total winnings (`MySubmissionsSummary`).
  - `GET /v1/me/competitions?filter=LIVE|JUDGING|DRAFT|CLOSED` and `GET /v1/me/competitions/summary`
    (`HostedSummary`: counts, total entries, revenue). Cancelled competitions report ₹0 revenue.
  - `createdAt` on `HostedCompetition`; `categoryName` on `SubmissionView.competition`.
  - Payment orders store the competition `title` (optional on `createOrderSchema`, migration
    `20261002000000_order_title`), so wallet lines read "Entry — Monsoon Poetry Slam",
    "Prize pool — …", "Refund — …" (`orderDescription` in `@feedants/shared`).
  - **The ledger is append-only (DB trigger)**, so rows written before this change still say
    "Entry fee". A fresh volume + reseed shows titled lines for the demo data:
    `docker compose -f infra/docker/compose.yaml down -v`, then `up` and the seed loop in §4.

## 1a. Tracing, deployment, alerts, backups (this session)

- **US-36 tracing.** `@feedants/server-kit/tracing` starts OpenTelemetry (each service's
  `src/tracing.ts` is imported first in `main.ts`; off unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set).
  The envelope has a new optional `traceparent`; the bus adds publish/process spans and AMQP
  headers; Payment stores the join's trace on the order (migration `20261003000000_order_trace_parent`)
  so the webhook capture continues it. Gateway is `nginx:1.30-alpine-otel`; config split into
  `http.conf` + `routes.conf`. Every log line has `traceId`/`spanId` (pino mixin). **Verified:** one
  Jaeger trace for join → pay → confirm → notify spans gateway, competition, identity, payment,
  RabbitMQ and notification (74 spans).
- **US-38 alerts.** `/metrics` on every service (`http_requests_total`, duration histogram, process
  metrics; internal only). Prometheus + Alertmanager + node-exporter: `infra/monitoring/`, rules
  unit-tested with `promtool` (in CI). **Verified:** a message in a DLQ emailed an alert to Mailpit
  in ~25 s and a RESOLVED mail after purging.
- **US-37 deploy.** Terraform (`infra/terraform`, validated, Trivy-clean), `compose.prod.yaml`,
  host scripts (`infra/host`: deploy with per-service rollback, smoke, certs), `.github/workflows/deploy.yml`
  (GHCR + Trivy + OIDC + SSM). CI gained an `infra` job. Docs: `docs/05-operations/DEPLOYMENT.md`,
  `runbooks/alerts.md`, ADR 0007.
- **US-39 backups.** Nightly `backup.sh` → S3, `restore.sh`, `runbooks/restore.md`. **Local drill
  recorded:** restore in 18 s, all row counts identical, ledger sums to 0.
- Loose ends from the port: `@expo/vector-icons` removed; 135 unused i18n keys pruned.

## 1b. Not done (needs the user's AWS account, a domain and provider credentials)

- `terraform apply`, secrets (`infra/terraform/scripts/generate-secrets.sh` + SMTP/Razorpay by hand),
  DNS, GitHub environment `production` with its variables, first deploy: DEPLOYMENT.md §2.
- First production restore drill against S3 (add a row to the table in `runbooks/restore.md`).
- UptimeRobot check on `/gateway/health`.
- Also still open in the plan: Phase 4 hardening (k6, OWASP ZAP, TEST_STRATEGY/REPORT) and the
  APK via EAS Build.

## 2. Decisions the user made (keep to them)

- **Exact design replication** of `design/reference` / `design/prototype/src`, measured with
  `tools/design-parity`.
- **Font:** Poppins (the design tokens), not the fallback font baked into the reference PNGs.
- **Out-of-scope UI is omitted**, not faked: Messages, Refer, Live counts/badges, rank/level,
  ratings, followers, Follow/Message buttons, intro videos, testimonials, ad slot, language toggle.
  Where omitting would change the layout, a real line of data fills the same space.
- **`design/source` is misleading — don't use it.** The source of truth is `design/reference`
  (screenshots + rendered DOM) and the prototype code in `design/prototype/src` that produced it.
- Competitions tab = the full competitions list (SCOPE.md), same component as Explore's lists.

## 3. Design port — status

Foundation (`apps/mobile/src/design/`): `tw.ts`, `text.tsx` (`T`), `icons.tsx`, `gradient.tsx`,
`components.tsx` (Card, SectionHeader, PageHeader, **BackHeader**, CompetitionRow, ExpandToggle,
Orb/PersonAvatar, BottomSheet, Press, Spinner, SheetButton, **FilterChips, StatusPill, useToast,
ConfirmDialog, FormField, Input**), `empty.tsx`, `bottom-nav.tsx`, `competition-list.tsx`,
`categories.tsx`, **`loading.tsx`**, **`splash.tsx`** (brand splash, mounted in `app/_layout.tsx`).

| Screen | Prototype source | Status / notes |
|---|---|---|
| Home, Explore, lists, Search, Detail + checkout, Leaderboard, Winner profile | (see git history) | ✅ ported earlier |
| My Submissions (`app/submissions.tsx`) | `MySubmissionsPage.tsx` | ✅ measured to ±0.5 px. Filters All/Draft/In review/Won/Not selected. Drafts → "Continue", submitted → "View" (entries lock on submit, US-25) |
| Submission editor (`app/submission/[registrationId].tsx`) | UploadSheet in `CompetitionsPage.tsx` | ✅ dashed drop zone + Photo/Video/Audio, checklist, ringed caption, rules switch, sticky submit |
| My Competitions (`app/my-competitions.tsx`) | `MyCompetitionsPage.tsx` | ✅ measured. "views" → entry count. Draft: Edit draft + Publish (opens wizard at Review via `?step=REVIEW`); Live: View + Edit (0 registrations) + Cancel (confirm dialog, US-17); Judging: View + Score & publish; Closed: View + Results |
| Judge entries (`app/competition/[id]/judge.tsx`) | EntriesSheet in `MyCompetitionsPage.tsx` | ✅ numbered rows, mint progress, score sheet with quick scores, publish confirm |
| Host wizard (`app/host.tsx`) | `HostPage.tsx` | ✅ step 1 measured to the pixel; Prize card shows the real tier split instead of "estimated reach"; success screen |
| Wallet (`app/wallet.tsx`) | `WalletPage.tsx` | ✅ measured. Withdraw/Add/Send/Rewards → Entries/Hosting/Explore/Alerts; card number → email; Prime → INR; Pending payout → prizes won |
| Notifications | `NotificationsPage.tsx` | ✅ measured; Today/Earlier, relative times |
| Profile tab, Edit profile | `ProfilePage.tsx` | ✅ achievements, handle/city, rank, Refer, activity, help omitted; stats show winnings |
| Settings, Terms, Privacy | `SettingsPage.tsx`, `LegalPage.tsx` | ✅ only real settings; typed-DELETE sheet; legal text rewritten to match what Feedants actually does |
| Sign-in (email → code → name) | `LoginPage.tsx`, `OtpVerificationPage.tsx`, `SignUpPage.tsx` | ✅ verified end to end; 6-box code auto-submits; password/phone/Google omitted |
| Onboarding, Splash | `components/Onboarding.tsx`, `SplashScreen.tsx` | ✅ swipeable 4 slides (copy corrected where it over-claimed); splash 1.9 s + 0.5 s fade |

### Notes

- On Windows Chrome the 🇮🇳 emoji renders as "IN" (no flag glyphs); phones show the flag.
- Splash and onboarding were captured but not measured (the references are mid-animation).

## 4. Running everything (this machine)

- **Docker Engine runs inside WSL** (Ubuntu-24.04 on `D:\WSL\Ubuntu-24.04`). Watch free space
  on D: as well as C: (§0).
- WSL stops the distro (and the stack) when no session is open. Keep an Ubuntu terminal open.
- Stack (from the Ubuntu terminal): `cd /mnt/c/Users/Dell/Projects/feedants && docker compose -f infra/docker/compose.yaml --profile app up -d --build`
- Rebuild one service after backend changes: `... --profile app up -d --build --no-deps competition`
- Seed demo data: `for s in identity competition payment notification; do docker compose -f infra/docker/compose.yaml --profile app run --rm --no-deps "$s" node dist/seed.js; done`
- Mobile (Windows): `cd apps/mobile && npx expo start --web --port 8081` (add `--clear` if the bundle looks stale).
- Demo login: `riya@example.com`; codes arrive in Mailpit `http://localhost:8025`. API `:8080`.
- Too many sign-in codes → dev rate limit. Clear it:
  `for k in $(docker compose -f infra/docker/compose.yaml exec -T redis redis-cli --scan --pattern 'rl:otp-*'); do docker compose -f infra/docker/compose.yaml exec -T redis redis-cli del "$k"; done`
- Design comparison tools: `tools/design-parity/README.md` (`node setup-ref.mjs` once).
- Traces: Jaeger `http://localhost:16686`. Alerting: add `--profile monitoring` (Prometheus `:9090`,
  Alertmanager `:9093`, alert mails in Mailpit; `BackupNeverRan` goes pending locally, ignore it).
- node-exporter locally mounts `/` without `rslave` (WSL's root isn't a shared mount).
- Restore drill locally: `FEEDANTS_COMPOSE="docker compose -f infra/docker/compose.yaml" BACKUP_DEST=/tmp/b bash infra/host/backup.sh`
  then `... restore.sh latest --yes` (from the Ubuntu terminal).

## 5. Checks before calling a screen done

`cd apps/mobile && npx tsc --noEmit`, `npx eslint --no-ignore "apps/mobile/src/**/*.{ts,tsx}"` from
the repo root (mobile has no ESLint config of its own), `npx prettier --check`, then capture +
measure against the reference. Backend changes: `pnpm --filter @feedants/competition test`.
The brand splash covers the first ~2.4 s after the bundle renders; pass `--after=4000` (or more) to
`capture.mjs` so it has faded before the screenshot.

## 6. Prompt to start the next session

> Continue Feedants. Read `docs/HANDOFF.md` first. Start with §0: rebuild the local environment
> (WSL was deleted to free D:) and keep to the Docker hygiene rules there. US-01…39 are built;
> production isn't provisioned yet (§1b, DEPLOYMENT.md §2). Then: provision AWS and deploy, or
> Phase 4 hardening (k6, ZAP).
