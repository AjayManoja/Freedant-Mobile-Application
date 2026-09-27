# Assumptions

Decisions taken where the design or product brief is silent or ambiguous. Each one is testable and has a trigger for revisiting it. Numeric values are **defaults held in configuration**, never hard-coded.

| Status legend | |
|---|---|
| **Accepted** | Baseline for Phase 1 design |
| **To validate** | Needs confirmation during design or a sprint |

## Product and users

| ID | Assumption | Status | Revisit when |
|---|---|---|---|
| A-1 | One account can both host and compete; there are no separate account types. | Accepted | A host-only feature needs different onboarding |
| A-2 | Guests can browse all public screens; signing in is required to join, host, submit, or see wallet and notifications. | Accepted | Conversion data shows the sign-in wall hurts browsing |
| A-3 | There is no admin role or admin UI in the MVP. Categories and demo content are loaded by a seed script. | Accepted | Moderation or support needs arise |
| A-4 | Sign-in is email OTP only, with no passwords. The prototype's Forgot Password screen is therefore not built, and Sign Up becomes "verify code → enter display name". | Accepted | Phone OTP is added (Later) |
| A-5 | There is no automated content moderation. Hosts judge what they receive; reporting and moderation are Later. | Accepted | The app is opened beyond demo users |

## Money

| ID | Assumption | Status | Revisit when |
|---|---|---|---|
| A-6 | Currency is INR only. All amounts are stored as integer paise and formatted only at display time. | Accepted | Another market is targeted |
| A-7 | Razorpay runs in **test mode only**; no real money is collected, held or paid out. | Accepted | Legal review of real-money operation (see R-9) |
| A-8 | Amount charged at join = entry fee + platform fee. Platform fee default: 10 % of the entry fee, rounded to the nearest rupee. The design's GST (18 %) line and promo code (FEED10) are **not** charged in the MVP: GST invoicing is out of scope and promo codes are Later. | Accepted | GST registration or promo codes come into scope |
| A-9 | The host funds the full prize pool at publish (test mode). It sits in the competition's escrow account until results or cancellation. | Accepted | — |
| A-10 | Entry-fee revenue (excluding the platform fee) is credited to the host's wallet **when results are published**, not at join time, so cancellations can still be refunded in full. | Accepted | Hosts need earlier access to revenue |
| A-11 | The number of winners and the split are derived from the prize pool using a configurable table that mirrors the prototype: pool ≥ ₹6,000 → 6 winners; ≥ ₹3,000 → 5; ≥ ₹1,200 → 4; otherwise 3. Amounts are rounded to ₹10 and any rounding remainder goes to 1st place, so tiers always sum exactly to the pool. Custom splits are Later. | Accepted | Hosts ask for custom splits |
| A-12 | Prize pool bounds: ₹500–₹1,00,000. Entry fee: ₹0 or ₹10–₹5,000. | Accepted | Real usage data |
| A-13 | Refunds: full refund on host cancellation or late-capture rejection. A confirmed creator cannot withdraw in the MVP, so there are no partial or voluntary refunds. | Accepted | Withdrawal is added |

## Time and schedule

| ID | Assumption | Status | Revisit when |
|---|---|---|---|
| A-14 | The wizard collects start time **S** and duration **D**. The timeline is derived: registration opens at S; submissions open at S; registration closes at S + ⌈D/3⌉ (so late joiners still have time to submit, matching the design's dates); submissions close at S + D; results are due at S + D + 2 days. The ratio and judging window are configurable. | To validate | Hosts need custom dates |
| A-15 | All timestamps are stored in UTC and shown in the device's time zone (IST expected). Countdowns are computed on the device, corrected by the server's clock offset. | Accepted | — |
| A-16 | The start time must be at least 1 hour in the future. Allowed durations: 3 days, 1 week, 2 weeks, 1 month. Max spots: 2–10,000. | Accepted | — |
| A-17 | The results due date is shown to the host but **not enforced** in the MVP. Auto-cancel and refund for overdue judging is Later. | To validate | Overdue competitions appear in testing (see R-10) |

## Discovery

| ID | Assumption | Status | Revisit when |
|---|---|---|---|
| A-18 | Home section rules (window sizes configurable): **Featured** = the open competition with the highest prize pool, unless a seed-set `featured` flag overrides it. **Trending** = most confirmed registrations in the last 7 days. **Upcoming** = soonest registration opening first. **Ending soon** = registration closes within 48 h. **Top prize** = open competitions by prize pool, highest first. **Recent winners** = 1st place from the most recent published results. | Accepted | Engagement data suggests better ranking |
| A-19 | Search uses PostgreSQL full-text search plus trigram matching, in English only. | Accepted | Search p95 > 300 ms or multi-language support is needed |
| A-20 | Categories are Dance, Music, Photography, Writing, Art, Coding, Cooking and Gaming, stored as data (not code). | Accepted | — |

## Participation and judging

| ID | Assumption | Status | Revisit when |
|---|---|---|---|
| A-21 | A creator can have one active registration per competition; hosts cannot join their own competition. | Accepted | — |
| A-22 | Spot hold TTL is 10 minutes. | Accepted | Checkout abandonment data |
| A-23 | Media limits: image ≤ 10 MB, audio ≤ 20 MB, video (MP4) ≤ 100 MB. Video length is not checked on the server in the MVP. | Accepted | Storage cost or abuse |
| A-24 | Submission checklist: media uploaded, caption ≥ 10 characters, rules accepted. Completion % = items done / 3. | To validate | Categories need different requirements |
| A-25 | One submission per registration, immutable after final submit. | Accepted | Creators ask to replace entries |
| A-26 | The host is the only judge; the detail page's "Judge" card shows the host. External judges are Later. | Accepted | Hosts want guest judges |
| A-27 | Scores stay private until results are published. The prototype's "Judged" status is not shown to creators, which prevents results leaking early. | Accepted | — |
| A-28 | Ties are broken by earlier submission time. | Accepted | — |
| A-29 | Prize tiers that go unawarded because there are too few submissions are returned to the host's wallet. | Accepted | — |

## Platform and operations

| ID | Assumption | Status | Revisit when |
|---|---|---|---|
| A-30 | Android 10+ is the supported mobile platform. iOS is not built (it needs a Mac and a paid Apple account), but Expo keeps it possible. The web export is for demos. | Accepted | An iOS device and account are available |
| A-31 | Scale target: 10k registered users, 500 concurrently active, about 1k open competitions, read:write ≈ 20:1. | Accepted | Load test or real traffic says otherwise |
| A-32 | A single EC2 host is an accepted single point of failure for the MVP (ADR in Phase 1). | Accepted | Availability target rises above 99.5 % |
| A-33 | Demo email volume fits the SES sandbox (verified recipients) or Resend's free tier. | To validate | Emails fail to reach demo users |
| A-34 | Terms and Privacy pages are placeholder content written by the developer, not legal advice. | Accepted | Real users are onboarded |
