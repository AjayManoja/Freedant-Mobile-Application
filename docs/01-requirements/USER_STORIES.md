# User Stories

Stories are grouped into epics and each one traces to [SRS](SRS.md) requirements. Acceptance criteria use Given / When / Then and become test cases. Sprint numbers refer to the [project plan](../PROJECT_PLAN.md#sprint-plan).

**Format:** ID · title · priority (Must / Should / Could) · sprint · requirements covered.

## Epic E1 — Accounts

### US-01 Sign in with an email code

**As a** user **I want** to sign in with a code sent to my email **so that** I don't have to manage a password.

- **Must · S1 · FR-ID-01, FR-ID-02**
- Given a valid email, when I request a code, then I receive a 6-digit code and "Resend" is disabled for 60 s.
- Given a correct, unexpired code, when I submit it, then I am signed in.
- Given a wrong code, when I submit it 5 times, then the code is invalidated and I must request a new one.
- Given an expired or already-used code, when I submit it, then I see "Code expired — request a new one".
- Given more than the allowed OTP requests from one email or IP, then further requests are rejected with a retry-after time.

### US-02 Choose a display name on first sign-in

**As a** new user **I want** to set my display name once **so that** others recognise me.

- **Must · S1 · FR-ID-03**
- Given a first-time verification, then I am asked for a display name (2–40 characters) before reaching Home.
- Given a returning user, then this step is skipped.

### US-03 Stay signed in securely

**As a** user **I want** to stay signed in between app launches **so that** I don't re-enter codes, without my session being easy to steal.

- **Must · S1 · FR-ID-04**
- Given an expired access token and a valid refresh token, when the app calls the API, then it refreshes silently and retries the call once.
- Given a refresh token that was already rotated, when it is used again, then every session in that token family is revoked and the user must sign in again.
- Tokens are stored only in the device's secure storage.

### US-04 Sign out

- **Must · S1 · FR-ID-05**
- Given I am signed in, when I sign out, then this device's refresh token is revoked and cached personal data is cleared.

### US-05 Edit my profile

**As a** user **I want** to edit my name, avatar and bio **so that** my profile represents me.

- **Must · S1 · FR-ID-06**
- Given valid input, when I save, then the change appears on my profile, and on competitions I host within a few seconds (via `user.updated`).
- Given an avatar that is not JPEG/PNG/WebP or is over the size limit, then the upload is refused with a clear message.

### US-06 Browse as a guest, sign in when needed

**As a** visitor **I want** to look around before signing up **so that** I can decide whether the app is worth it.

- **Must · S2 · FR-ID-08**
- Given I am a guest, then Home, Explore, Search, competition detail and leaderboards work.
- Given I am a guest, when I tap Join, Host or Wallet, then I am taken to sign in and returned to the same screen afterwards.

### US-07 Delete my account

- **Should · S6 · FR-ID-09**
- Given I confirm deletion, then my email, name, avatar and bio are removed or anonymised, and my ledger history remains with an anonymised owner.

## Epic E2 — Discovery

### US-08 See what's happening on Home

**As a** creator **I want** a home feed of relevant competitions **so that** I find something to enter quickly.

- **Must · S2 · FR-DS-01, FR-DS-02**
- Given published competitions exist, then Home shows featured, categories, trending, upcoming, ending soon, top prize and recent winners, following the rules in A-18.
- Given a section has no items, then it is hidden instead of shown empty.
- Given I am signed in and have a draft submission, then a "Finish your submission" card shows its completion percentage (Should).

### US-09 Browse and filter competitions

- **Must · S2 · FR-DS-03**
- Given I pick a category and a sort (Popular / Top prize / Ending soon), then the list updates and keeps loading more as I scroll, with no duplicates or gaps.
- Given no results, then I see an empty state with "Reset filters".

### US-10 Search

- **Must · S2 · FR-DS-04**
- Given I type at least 2 characters, then results match title, category or host, including small typos ("photgraphy" finds Photography).
- Given I searched before, then my recent searches appear, stored on the device only, and I can clear them.

### US-11 View a competition

**As a** creator **I want** all the facts about a competition in one place **so that** I can decide whether to enter.

- **Must · S2 · FR-DS-05, FR-DS-06**
- Then I see prize pool and tiers, entry fee with fee breakdown, spots left, participants, host, all dates and a live countdown.
- Given I am registered, then the call to action changes to my registration or submission status.
- Given an unknown or draft ID (not mine), then I see "Competition not found".

### US-12 Get notified when a competition opens

- **Should · S6 · FR-DS-07, FR-NT-01**
- Given an upcoming competition, when I tap "Notify me", then I receive a notification when registration opens, and I can turn it off.

### US-13 See top hosts and recent winners

- **Should · S5 · FR-DS-08, FR-JG-06**
- Then Home shows top hosts and recent winners, and tapping a winner opens their winner profile.

## Epic E3 — Hosting

### US-14 Create a competition with the wizard

**As a** host **I want** a guided four-step form **so that** I can set up a competition in minutes without mistakes.

- **Must · S2 · FR-HS-01…05**
- Given a step has invalid or missing fields, then Continue is disabled and each invalid field explains why.
- Given valid Prize inputs, then the resulting prize tiers are shown (A-11).
- Given I leave mid-way, then my draft is saved and I can resume it from My competitions.
- Review shows every value, including the derived timeline (A-14).

### US-15 Fund and publish a competition

- **Must · S3 · FR-HS-06, FR-HS-07, FR-PY-04**
- Given a valid draft, when I publish, then I pay the prize pool through checkout (test mode).
- Given funding is captured, then the competition becomes public and I see "You're live!" with prize, spots and duration.
- Given funding fails or I abandon it, then the competition stays a draft and nothing is charged.

### US-16 Edit only before the first registration

- **Must · S3 · FR-HS-08**
- Given no registrations exist, then I can edit details.
- Given at least one registration exists, then edit is disabled and the API rejects edits with a clear error.

### US-17 Cancel a competition

- **Must · S4 · FR-HS-09, FR-PY-06**
- Given results are not yet published, when I cancel, then every confirmed registration is refunded in full, my escrowed prize pool returns to my wallet, and participants are notified.

### US-18 Manage my competitions

- **Must · S3 · FR-HS-10**
- Then I see each competition's status/phase, registrations, submissions and entry-fee revenue, with drafts listed separately.

## Epic E4 — Join and pay

### US-19 Join a free competition

- **Must · S3 · FR-PT-01, FR-PT-03**
- Given an open, free competition with spots left, when I join, then I am confirmed immediately and the spots count drops by one.
- Given I am the host, already registered, or no spots are left, then Join is disabled with the reason shown.

### US-20 Join and pay for a competition

**As a** creator **I want** to pay the entry fee in the app **so that** I'm registered straight away.

- **Must · S3 · FR-PT-02, FR-PT-04, FR-PT-05**
- Given an open, paid competition, when I tap Join, then a spot is held for 10 minutes and checkout opens with the server-computed amount.
- Given payment succeeds, then I see "Processing…" until the webhook confirms, and then "You're in!".
- The amount can't be changed by the client: a tampered amount is ignored.

### US-21 Recover from a failed or abandoned payment

- **Must · S4 · FR-PT-06**
- Given payment fails, then I see the reason and can retry while my hold is still valid.
- Given my hold expires without payment, then the spot is released and becomes available to others.

### US-22 Never overbook the last spot

- **Must · S4 · FR-PT-02, FR-PT-06, NFR-RL-01**
- Given 1 spot left and 50 simultaneous join attempts, then exactly 1 hold succeeds and the rest see "No spots left".
- Given my payment is captured after my hold expired and the spot was taken, then my registration is rejected, I am refunded in full automatically, and I am notified.

### US-23 Never be charged twice

- **Must · S4 · FR-PT-07, FR-PY-02, NFR-RL-02**
- Given I tap Pay twice or the network retries, then one order and one registration exist.
- Given Razorpay delivers the same webhook more than once or out of order, then the ledger and registration change exactly once.

## Epic E5 — Submissions

### US-24 Upload my entry and save a draft

- **Must · S5 · FR-SB-01…03**
- Given I am confirmed, when I pick media, then it is compressed on the device and uploaded straight to storage with a progress bar.
- Given an unsupported type or oversized file, then it is rejected before upload.
- Given I leave mid-way, then my draft (media, caption, checklist) is restored when I return.

### US-25 Submit my final entry

- **Must · S5 · FR-SB-04**
- Given the checklist is 100 % and the submissions phase is open, when I submit, then the entry is locked and marked In review.
- Given the checklist is incomplete or the window is closed, then Submit is disabled with the reason.

### US-26 Track my submissions

- **Must · S5 · FR-SB-05**
- Then I see all my entries with status Draft / In review / Won / Not selected, and can filter by status. Scores are hidden until results are published (A-27).

## Epic E6 — Judging and results

### US-27 Score submissions

**As a** host **I want** to review and score each entry **so that** I can pick winners fairly.

- **Must · S5 · FR-JG-01, FR-JG-02**
- Given the judging phase, then I can open every submission and give a score from 0–10 (one decimal) with an optional comment.
- Given it is before the judging phase, then scoring is unavailable.
- Given I am not the host, then the API returns 403/404 for these submissions.

### US-28 Publish results

- **Must · S5 · FR-JG-03…05, FR-PY-05**
- Given every submission is scored, when I publish, then ranks are computed (ties go to the earlier submission), winners' wallets are credited from escrow, unawarded tiers return to me, and my entry-fee revenue is credited (A-10).
- Then the leaderboard becomes public and results can no longer change.

### US-29 View a winner's profile

- **Should · S5 · FR-JG-06**
- Then I see the winner's wins, placements and prize amounts.

## Epic E7 — Wallet

### US-30 See my wallet

- **Must · S6 · FR-PY-07**
- Then I see available balance, total winnings and a history filterable by All / Earnings / Entries / Refunds, grouped by day.
- The balance always equals the sum of my ledger entries.

### US-31 Receive winnings

- **Must · S6 · FR-PY-05**
- Given I won a prize tier, when results are published, then my wallet shows the credit within seconds and I receive a "You won" notification.

## Epic E8 — Notifications

### US-32 Receive notifications

- **Must · S6 · FR-NT-01, FR-NT-03**
- Given a notifiable event (listed in FR-NT-01), then a notification appears in my list and tapping it opens the related screen.
- Given the notification service was down, then notifications for events during the outage appear once it recovers.

### US-33 Manage read state

- **Must · S6 · FR-NT-02**
- Then Home shows my unread count; I can mark one or all as read and the count updates.

## Epic E9 — Engineering enablers

Technical stories that make the system buildable, operable and secure. They follow the same Definition of Done.

### US-34 Run the whole stack locally with one command

**As a** developer **I want** a one-command local environment **so that** onboarding takes minutes.

- **Must · Phase 2 · NFR-MT-01**
- Given a fresh clone with Node, pnpm and Docker installed, when I follow LOCAL_SETUP.md, then all services, databases, broker, storage and mail catcher run within 10 minutes, with seed data loaded.

### US-35 Every change is checked automatically

- **Must · Phase 2 · NFR-MT-02, NFR-SC-05, NFR-SC-08**
- Given a pull request, then lint, typecheck, tests, secret scanning, code scanning and image scanning run, and merge is blocked if any fail.

### US-36 Trace a request across services

**As an** operator **I want** to follow one request through every service **so that** I can find failures quickly.

- **Must · S7 · NFR-MT-04**
- Given a join-and-pay flow, then Jaeger shows one trace spanning the gateway, Competition, Payment, RabbitMQ and Notification, and every log line carries the same trace ID.

### US-37 Deploy automatically with rollback

- **Must · Phase 5 · NFR-MT-01**
- Given a merge to `main`, then images are built, scanned, deployed service by service and smoke-tested; a failed smoke test restores the previous version automatically.

### US-38 Be alerted before users notice

- **Must · Phase 5 · NFR-MT-06, NFR-RL-06**
- Given the 5xx rate exceeds 1 % for 5 minutes, a dead-letter queue is non-empty, or the host is out of memory or disk, then an alert is sent.

### US-39 Recover from data loss

- **Must · Phase 5 · NFR-RL-07**
- Given a nightly backup, when I follow the restore runbook, then the databases are restored within 1 hour, and the drill is recorded.

## Summary

| Epic | Stories | Must | Should |
|---|---|---|---|
| E1 Accounts | 7 | 6 | 1 |
| E2 Discovery | 6 | 4 | 2 |
| E3 Hosting | 5 | 5 | 0 |
| E4 Join and pay | 5 | 5 | 0 |
| E5 Submissions | 3 | 3 | 0 |
| E6 Judging and results | 3 | 2 | 1 |
| E7 Wallet | 2 | 2 | 0 |
| E8 Notifications | 2 | 2 | 0 |
| E9 Engineering enablers | 6 | 6 | 0 |
| **Total** | **39** | **35** | **4** |
