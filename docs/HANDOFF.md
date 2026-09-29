# Handoff — continue the mobile design port

Written 2026-09-29 at the end of a working session, so a new session can pick up exactly where
this one stopped. Branch: `feat/mobile-design-port`.

## 1. Where things stand

- **Backend (Phase 2/3 services):** identity, competition, payment, notification are complete for
  user stories US-01…US-33, with e2e tests (all passing; `pnpm turbo run test --filter='!@feedants/mobile'`).
  US-34 (local stack + seed) and US-35 (CI) are done. US-36 tracing (sprint S7) and US-37…39
  (deploy, alerts, backups — Phase 5) are not started.
- **Mobile app:** every screen exists and works against the API. A **pixel-perfect port to the
  design** (`design/reference` + `design/prototype/src`) is in progress — see §3.
- **Bug fixed this session:** "Payment didn't go through / We couldn't find that" after tapping
  test payment. The gateway had no route for `POST /v1/payments/dev/simulate`, so it went to the
  competition service (404). Fixed in `infra/nginx/nginx.conf`; verified end to end in the UI.

## 2. Decisions the user made (keep to them)

- **Font:** Poppins (the design tokens), not the fallback font baked into the reference PNGs.
- **Out-of-scope UI is omitted**, not faked: Messages, Refer, Live counts/badges, rank/level,
  ratings, followers, Follow/Message buttons, intro videos, testimonials, ad slot, language toggle.
  Where omitting would change the layout, a real line of data fills the same space.
- **`design/source` is misleading — don't use it.** The source of truth is `design/reference`
  (screenshots + rendered DOM) and the prototype code in `design/prototype/src` that produced it.
- Competitions tab = the full competitions list (SCOPE.md), same component as Explore's lists.

## 3. Design port — status

Foundation (`apps/mobile/src/design/`): `tw.ts` (twrnc with Tailwind v4 radii/shadows/OKLCH palette),
`text.tsx` (`T` — Poppins weights, CSS-like line heights and inheritance), `icons.tsx` (the
prototype's SVG icons), `gradient.tsx`, `components.tsx` (Card, SectionHeader, PageHeader,
CompetitionRow, ExpandToggle, Orb/PersonAvatar, BottomSheet incl. `bare`, Press, Spinner),
`empty.tsx` (EmptyState + illustrations), `bottom-nav.tsx` (tab bar + Create sheet, also rendered
by pushed screens), `competition-list.tsx`, `categories.tsx`.

| Screen | Prototype source | Status |
|---|---|---|
| Home | `HomePage.tsx` | ✅ ported, measured to the pixel |
| Explore | `ExplorePage.tsx` | ✅ ported |
| Trending / Ending lists, Competitions tab | `ListPage.tsx` | ✅ ported (`app/explore/[type].tsx`, `app/(tabs)/competitions.tsx`) |
| Search | `SearchPage.tsx` | ✅ ported (`app/search.tsx`) |
| Competition detail + checkout sheet | `CompetitionsPage.tsx` | ✅ ported (`app/competition/[id]/index.tsx`); pay flow verified |
| Leaderboard | `LeaderboardPage.tsx` | ✅ ported, final-results mode only (no live mode) |
| Winner profile | `WinnerProfilePage.tsx` | ✅ ported (`app/winners/[userId].tsx`) |
| My Submissions | `MySubmissionsPage.tsx` | ⏳ **next** — `app/submissions.tsx` currently re-exports the old `my-competitions.tsx` |
| Submission editor | (part of MySubmissions / UploadSheet) | ⏳ restyle `app/submission/[registrationId].tsx` |
| My Competitions (host dashboard) | `MyCompetitionsPage.tsx` | ⏳ **next** — old screen at `app/my-competitions.tsx` |
| Judge entries | `MyCompetitionsPage.tsx` EntriesSheet | ⏳ restyle `app/competition/[id]/judge.tsx` |
| Host wizard | `HostPage.tsx` | ⏳ |
| Wallet | `WalletPage.tsx` | ⏳ |
| Notifications | `NotificationsPage.tsx` | ⏳ |
| Profile, Edit profile | `ProfilePage.tsx` | ⏳ |
| Settings, Terms, Privacy | `SettingsPage.tsx`, `LegalPage.tsx` | ⏳ |
| Sign-in (email → code → name) | `LoginPage.tsx`, `OtpVerificationPage.tsx`, `SignUpPage.tsx` | ⏳ |
| Onboarding, Splash | `components/Onboarding.tsx`, `SplashScreen.tsx` | ⏳ |

Screens not yet ported still use the old kit in `src/components/ui.tsx`; delete it once the last
screen moves over.

### Planned mapping for the next two screens (agreed approach, not yet built)

- **My Submissions:** summary (total winnings, entries, wins, in review), status filter chips with
  counts (All / Draft / In review / Won / Not selected — US-26), rows with the Won banner. The
  design's "Manage" sheet (replace/withdraw) conflicts with entries locking on submit (US-25):
  drafts get "Continue" → editor, submitted entries get "View".
- **My Competitions:** overview (live, total entries, revenue), filters All/Live/Judging/Draft/Closed,
  action bars: Draft → Edit draft + Publish (funding), Live → View + Edit (only with 0 registrations)
  + Cancel (US-17, full refunds, confirm dialog), Judging → View entries + "Score & publish" (judge
  screen), Closed → View + Results.
- **Backend additions still to make for these:** `createdAt` on `HostedCompetition`
  (`services/competition/src/hosting/hosting.service.ts` ~line 260) and `categoryName` on
  `SubmissionView.competition` (`submissions.service.ts` `view()`), plus the shared types.
  Already done this session: `CategoryListing.liveCount`, `CountedPage.total` on
  `GET /v1/competitions`, `competitionCoverUrl` on recent winners, `competitionCoverUrl` +
  `categoryName` on winner placements.

## 4. Running everything (this machine)

- **Docker Engine runs inside WSL** (Ubuntu-24.04, moved to `D:\WSL\Ubuntu-24.04` because the
  images filled C:). Watch free space on C:.
- WSL stops the distro (and the stack) when no session is open. Keep an Ubuntu terminal open.
- Stack (from the Ubuntu terminal): `cd /mnt/c/Users/Dell/Projects/feedants && docker compose -f infra/docker/compose.yaml --profile app up -d --build`
- Rebuild one service after backend changes: `... --profile app up -d --build --no-deps competition`
- Seed demo data: `for s in identity competition payment notification; do docker compose -f infra/docker/compose.yaml --profile app run --rm --no-deps "$s" node dist/seed.js; done`
- Mobile (Windows): `cd apps/mobile && npx expo start --web --port 8081` (add `--clear` if the bundle looks stale).
- Demo login: `riya@example.com`; codes arrive in Mailpit `http://localhost:8025`. API `:8080`.
- Too many sign-in codes → dev rate limit. Clear it:
  `for k in $(docker compose -f infra/docker/compose.yaml exec -T redis redis-cli --scan --pattern 'rl:otp-*'); do docker compose -f infra/docker/compose.yaml exec -T redis redis-cli del "$k"; done`
- Design comparison tools: `tools/design-parity/README.md` (`node setup-ref.mjs` once).

## 5. Checks before calling a screen done

`cd apps/mobile && npx tsc --noEmit`, `npx eslint --no-ignore "apps/mobile/src/**/*.{ts,tsx}"` from
the repo root (mobile has no ESLint config of its own), `npx prettier --check`, then capture +
measure against the reference. Backend changes: `pnpm --filter @feedants/competition test`.

## 6. Prompt to start the next session

> Continue the Feedants mobile design port. Read `docs/HANDOFF.md` first and follow its decisions.
> Next: port My Submissions and My Competitions (with the two backend additions listed), then the
> remaining ⏳ screens in order, verifying each with `tools/design-parity`.
