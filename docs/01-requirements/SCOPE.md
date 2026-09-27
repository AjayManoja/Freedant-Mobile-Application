# Scope

Defines what the MVP delivers, what is planned for later, and what is out of scope. Requirement IDs refer to the [SRS](SRS.md).

## MVP goal

A creator and a host can complete the whole marketplace loop on a real, deployed system:

> Host creates and funds a competition → creator discovers it, joins and pays → creator submits an entry → host judges and publishes results → winner's wallet is credited → both are notified.

The MVP is **architecturally complete**: all four services, the gateway, CI/CD, infrastructure as code, security controls and observability exist. Features outside the loop are deferred.

## Prioritisation (MoSCoW)

| Priority | Meaning | Items |
|---|---|---|
| **Must** | The MVP fails without it | Email OTP auth and profile; home, explore, search, detail; host wizard, drafts, funding and publish, edit lock, cancel; join and pay with spot holds, failure handling and refunds; submissions with drafts and upload; judging, results, leaderboard; ledger, wallet, winner credits; in-app notifications |
| **Should** | Important; done if Must items are on schedule | Public profile stats, home stats and draft shortcut, "Notify me", top hosts and recent winners, winner profiles, account deletion, Settings (sign out, delete account, legal links), Terms and Privacy pages |
| **Could** | Nice to have | Payment reconciliation job, Help and About pages |
| **Won't (this release)** | Deliberately deferred — see "Later" | Everything in the Later list |

## Screen inventory

All 28 prototype screens, plus splash and onboarding, mapped to MVP scope. Visual references are in [design/reference/screenshots](../../design/reference/screenshots/).

| Screen | Prototype route | Scope | Notes |
|---|---|---|---|
| Splash | — | Must | |
| Onboarding | — | Must | Shown once per install |
| Login | `/login` | Must | Email entry for OTP |
| Verify | `/verify` | Must | OTP entry |
| Sign up | `/signup` | Must (changed) | Becomes a "choose display name" step after first verification (A-4) |
| Forgot password | `/forgot-password` | **Out** | No passwords (A-4) |
| Home | `/` | Must | Stats and draft shortcut are Should |
| Explore | `/explore` | Must | |
| Trending / Ending lists | `/explore/:type` | Must | List view with sort |
| Competitions list | `/competitions` | Must | Same list component as Explore |
| Search | `/search` | Must | |
| Competition detail + join sheet | `/competitions/:id` | Must | Fee breakdown without GST or promo (A-8) |
| Leaderboard | `/competitions/:id/results` | Must | Visible after results are published |
| Host wizard | `/host` | Must | Adds a funding step at publish (FR-HS-06) |
| My competitions | `/my-competitions` | Must | Includes the host's judging view |
| My submissions | `/submissions` | Must | Includes the submission editor and checklist |
| Wallet | `/wallet` | Must (reduced) | Balance, winnings, history. Withdraw, Add money, Send and Rewards are Later |
| Notifications | `/notifications` | Must | |
| Profile | `/profile` | Must | |
| Winner profile | `/winners/:name` | Should | |
| Settings | `/settings` | Should (reduced) | Sign out, delete account, legal links only |
| Terms, Privacy | `/legal/*` | Should | Static placeholder content (A-34) |
| Help | `/help` | Could | Static FAQ |
| About | `/about` | Could | Static |
| Refer | `/refer` | Later | |
| Messages, Chat thread | `/messages`, `/messages/:id` | Later | |
| Live | `/live` | Later | |

**New screens not in the prototype:** host judging view (inside My competitions), submission editor (inside My submissions), prize funding step (inside the host wizard) and payment result states.

## Later (planned, designed for, not built)

The architecture already leaves room for these as new endpoints, events or consumers.

| Feature | Lands in |
|---|---|
| Phone OTP | Identity |
| Push notifications, realtime (WebSocket) updates | Notification |
| Live screen (realtime counts, not video) | Notification + Competition |
| Chat / messages | New module or service |
| Referrals and rewards | Identity + Payment |
| Withdrawals and payouts to bank, add money, send | Payment |
| Promo codes | Payment |
| Custom prize splits, custom dates | Competition |
| External judges | Competition |
| Auto-cancel on overdue judging | Competition |
| Hindi localisation | Mobile |
| Content reporting and moderation, admin console | New service |
| OpenSearch-backed search | Competition (new consumer) |

## Out of scope

| Item | Reason |
|---|---|
| Real-money operation | Regulatory exposure (see RISKS R-9); test mode only |
| Real video live streaming | Cost and complexity unrelated to the core loop |
| KYC, GST invoicing | Only needed for real-money operation |
| iOS build | Needs a Mac and a paid Apple account (A-30) |
| Passwords and password reset | Replaced by email OTP (A-4) |

## Change control

- The **Must** list is frozen once this document is approved. A new Must item needs a GitHub issue explaining what it replaces.
- A scope change that affects architecture needs an ADR.
- Should and Could items are pulled into sprints only when that sprint's Must items meet the Definition of Done.
