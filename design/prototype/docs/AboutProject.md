# Feedants — About the Project

> A mobile-first marketplace where anyone can **host** a creative competition and any creator can **compete**, get judged, and win — all in one app.

---

## 1. The Idea

**Feedants** is a two-sided mobile application built around a simple observation: talent is everywhere, but the opportunities to *showcase* it — and get rewarded for it — are scattered, informal, and hard to trust.

Today a dancer, a bedroom musician, a street photographer, a poet, or a self-taught developer who wants to enter a contest has to:

- hunt across Instagram posts, WhatsApp groups, college notice boards, and one-off event pages,
- trust an unknown organizer to actually run judging fairly,
- and hope the promised prize money actually arrives.

On the other side, anyone who *wants* to run a competition — a brand, a creator with an audience, a community, a small academy — has no easy way to launch one, reach the right people, collect entries, judge them, and pay out winners without stitching together forms, payment links, and spreadsheets.

Feedants collapses this entire experience into a single, trustworthy, native-feeling mobile app. It is the **"marketplace for competitions"**: hosts create contests on one side, creators discover and enter them on the other, and the platform handles discovery, entries, payments, judging, and payouts in between.

The name reflects the loop the product is built on — a constant *feed* of live competitions, and the *ants*-like energy of thousands of creators moving together toward the same goal.

---

## 2. The Objective

The core objective of the application is to **make hosting and competing in creative competitions as effortless, fair, and rewarding as posting on social media** — while adding the structure, trust, and monetization that social platforms lack.

Concretely, the app aims to:

1. **Give creators a single home** to discover competitions worth their time, enter them in a few taps, track their submissions, and win real prizes.
2. **Give hosts a self-serve toolkit** to launch a professional competition in minutes, reach a ready audience of creators, and run the whole lifecycle — entries, judging, payouts — inside the app.
3. **Build trust into every transaction** through visible social proof (ratings, entrant counts, recent winners, top hosts), secure in-app payments, and transparent rules.
4. **Create a healthy two-sided marketplace** where more hosts attract more creators and more creators attract more hosts — a self-reinforcing loop.

---

## 3. Who It's For

### Creators (the "compete" side)
People with a skill and something to prove — dancers, singers, musicians, artists, photographers, writers, coders, gamers, cooks. They want visibility, feedback, competition, and prizes.

**What they get:**
- A curated, always-fresh feed of competitions across categories.
- Clear entry requirements, prize pools, deadlines, and spots remaining.
- A frictionless join-and-submit flow with saved drafts.
- Recognition — leaderboards, ranks, winner profiles, and a public track record.

### Hosts (the "host" side)
Brands, creators with an audience, academies, communities, and organizers who want to run a contest to drive engagement, discover talent, or monetize their reach.

**What they get:**
- A guided, four-step creation flow (Basics → Prize → Schedule → Review) that gets a contest live in minutes.
- Instant distribution to a category-matched audience of creators.
- Built-in payments, judging tools, winner selection, and secure payouts.
- Live analytics on reach, entries, and revenue.

---

## 4. How the Experience Is Structured

The app is organized as a focused, mobile-native experience (a max-width phone canvas with a persistent bottom navigation), spanning a small number of purposeful surfaces:

| Surface | Purpose |
| --- | --- |
| **Home** | The daily dashboard — greeting, search, community trust strip, personal stats, a featured competition, categories, trending contests, top hosts, upcoming/ending-soon/top-prize lists, recent winners, and a full **Host your own competition** section. |
| **Explore** | Browse and search the full catalog of competitions by category and type. |
| **Competition details** | Everything about a single contest — prize, rules, host, entrants, deadline — plus the join flow. |
| **Host** | The self-serve competition-creation wizard, from basics to publishing. |
| **Live** | Real-time activity across the marketplace. |
| **Notifications** | Alerts for new competitions, judging updates, and results. |
| **Profile / Winner profiles** | Personal track record and public recognition of winners. |

Together these turn a one-off "enter a contest" moment into a repeatable habit: open the app, see what's live, compete, and come back for results.

---

## 5. The Marketplace Loop

Feedants is deliberately designed as a **flywheel**:

```
Hosts launch competitions
        │
        ▼
Creators discover & enter  ──►  Entry fees + engagement
        │                              │
        ▼                              ▼
Winners are judged & paid   ──►  Social proof (winners, ratings)
        │                              │
        ▼                              ▼
More creators join      ◄──  attracts  ──►      More hosts launch
```

Every winner story, host rating, and entrant count is surfaced back into the product as social proof, which lowers the trust barrier for the next creator to enter and the next host to launch — accelerating the loop.

---

## 6. What Makes It Different

- **Two-sided by design.** Most talent apps serve only creators. Feedants treats hosting as a first-class, monetizable action and gives it prominent real estate (e.g., the dedicated home-page host section and the guided creation wizard).
- **Trust is a feature, not an afterthought.** Ratings, entrant counts, recent winners, top hosts, and secure in-app payments are woven throughout the UI so both sides feel safe transacting.
- **Speed to value.** A host can go live in minutes; a creator can join in a few taps. The product removes the operational friction that keeps competitions informal today.
- **Native-app polish.** Considered micro-interactions, live push-style notifications, sheets, and progress flows make the marketplace feel premium and dependable rather than form-driven.

---

## 7. Success, in One Sentence

Feedants succeeds when **hosting a competition feels as easy as starting a live stream, and winning one feels as meaningful as landing a real opportunity** — turning scattered, informal contests into a trusted, thriving marketplace for creative talent.

---

## 8. Functional Requirements

Functional requirements describe **what the system must do**. They are grouped by the two sides of the marketplace plus the shared platform.

### 8.1 Onboarding & Account
- **FR-1** Users can create an account and sign in as either a creator, a host, or both (a single account can do both).
- **FR-2** Users can maintain a profile with a display name, avatar, level/rank, and a public track record of joined and won competitions.
- **FR-3** The system persists a personalized greeting and stats (Joined, Won, Rank) on the Home dashboard.

### 8.2 Discovery (Creator side)
- **FR-4** Users can browse a Home feed containing a featured competition, categories, trending, upcoming, ending-soon, and top-prize sections.
- **FR-5** Users can search competitions and hosts from the Home search entry, which opens Explore.
- **FR-6** Users can filter and browse the full catalog on Explore by category and list type (e.g. trending).
- **FR-7** Users can open a competition to view its title, banner, category, host, prize pool, entry fee, spots remaining, deadline/ends-in, and rules.
- **FR-8** Users can view **Top Hosts** (aggregated from real contest data: contests run, entrants, rating) and **Recent Winners** with links to winner profiles.
- **FR-9** The system surfaces a live push-style notification banner for newly live competitions.

### 8.3 Participation (Creator side)
- **FR-10** Users can join a competition through a join sheet that shows prize pool, spots left, ends-in, and entry fee, then confirm and pay.
- **FR-11** The system provides visible states for the join flow: form → processing → confirmed ("You're in!").
- **FR-12** Users can save a submission as a **draft** and resume it later from a "Finish your submission" entrypoint.
- **FR-13** The resume-draft flow shows a checklist with completion percentage and blocks final submission until all required steps are complete.
- **FR-14** Users can toggle **Notify** on upcoming competitions to be alerted when they open.

### 8.4 Hosting (Host side)
- **FR-15** Users can launch the **Host your own competition** flow from the dedicated Home section (hero, perks, how-it-works, testimonial, and CTAs).
- **FR-16** The host creation flow is a guided, multi-step wizard: **Basics → Prize → Schedule → Review**, with a visible progress stepper.
- **FR-17** In Basics, hosts can enter a title, pick a category, add an optional description, and add a cover image.
- **FR-18** In Prize, hosts can set a prize pool (with quick-pick presets) and an entry fee, formatted as INR, with an estimated-reach projection.
- **FR-19** In Schedule, hosts can set a start date, choose a duration, and set maximum spots.
- **FR-20** In Review, hosts see a full summary and can publish; the system prevents advancing until each step's required fields are valid.
- **FR-21** On publish, the system confirms the competition is live, shows a summary (prize, spots, duration), and offers "Go to dashboard" or "Host another".

### 8.5 Payments, Judging & Payouts
- **FR-22** The system collects entry fees via secure in-app payment (e.g. Razorpay) at join time.
- **FR-23** Hosts can review entries, select winners, and trigger secure payouts.
- **FR-24** The system records and displays winners, ratings, and prize amounts as social proof.

### 8.6 Notifications & Engagement
- **FR-25** Users receive notifications for new competitions, judging updates, and results.
- **FR-26** The system displays a live activity surface for real-time marketplace engagement.
- **FR-27** A notification indicator on Home reflects unread activity.

---

## 9. Non-Functional Requirements

Non-functional requirements describe **how well the system must behave** — the qualities and constraints.

### 9.1 Usability & Experience
- **NFR-1 Mobile-first:** The UI targets a phone canvas (max-width ~430px, centered) with a persistent bottom navigation and native-feeling sheets, banners, and transitions.
- **NFR-2 Speed to value:** A host can create and publish a competition in a few minutes; a creator can join in a few taps.
- **NFR-3 Clarity:** Every competition presents prize, entry, deadline, and spots at a glance; every flow exposes clear progress and state.
- **NFR-4 Micro-interactions:** Interactive elements provide immediate feedback (active/press scale, hover, focus states, loading spinners).

### 9.2 Performance
- **NFR-5** Feeds and lists scroll smoothly at 60fps; horizontally scrolling rails hide scrollbars until scrolling.
- **NFR-6** Views reset scroll position on navigation and lazy-load imagery, with background colors held on image containers so layout is stable while images load.
- **NFR-7** Interactions (join, publish, submit) give feedback within perceptible time and never block the UI silently.

### 9.3 Reliability & Data Integrity
- **NFR-8** Drafts are saved automatically and can be resumed without data loss.
- **NFR-9** Form validation prevents invalid or incomplete competitions from being published.
- **NFR-10** Payment and payout operations are transactional and clearly confirmed to the user.
- **NFR-11** Graceful error handling: unknown routes and failures show friendly error screens with a path back home.

### 9.4 Security & Trust
- **NFR-12** Payments are processed through a secure, PCI-compliant provider; sensitive credentials are never exposed client-side.
- **NFR-13** Trust signals (ratings, entrant counts, verified winners, top hosts) are surfaced consistently to reduce transaction risk.
- **NFR-14** Hosts operate under published host guidelines; contest details are editable only until the first entry arrives.

### 9.5 Accessibility
- **NFR-15** Body text meets AA contrast (4.5:1; 3:1 for large text); interactive affordances meet at least 3:1 and signal state with more than color.
- **NFR-16** Interactive controls use appropriate roles/labels (e.g. `aria-pressed`, descriptive `aria-label`s, alt text on imagery).

### 9.6 Maintainability & Scalability
- **NFR-17** The frontend is a component-driven React + Vite + Tailwind CSS v4 codebase with a shared design system (tokens, `Card`, `SectionHeader`, icon set) reused across screens.
- **NFR-18** Design tokens (colors, fonts) are centralized so the visual language stays consistent as the app grows.
- **NFR-19** The architecture supports a growing two-sided marketplace — more categories, hosts, and creators — without redesign.
- **NFR-20 Responsive:** The composition holds and adapts around a ~1000px breakpoint and on narrower viewports.

---

## 10. User & Application Flow

### 10.1 Creator flow (discover → compete → win)

```
Open app
   │
   ▼
Home dashboard ──► Search / Categories ──► Explore (browse & filter)
   │                                            │
   ▼                                            ▼
Tap a competition ──────────────────► Competition details
   │                                            │
   ▼                                            ▼
Join sheet (prize · spots · ends-in · fee)      │
   │                                            │
   ▼                                            │
Confirm & pay (form → processing → "You're in!")│
   │                                            │
   ▼                                            ▼
Submit entry ──► (optional) Save draft ──► Resume later (checklist → 100%)
   │
   ▼
Judging ──► Notification of result ──► Winner profile / prize payout
```

**Narrative:** A creator opens the app to a personalized Home feed, discovers a competition (featured, trending, search, or category), opens its details, joins via the join sheet, and pays the entry fee securely. They submit their entry — or save a draft and finish it later from the "Finish your submission" checklist. After judging, they're notified of the result and, if they win, recognized on a winner profile and paid out.

### 10.2 Host flow (launch → distribute → reward)

```
Home ──► "Host your own competition" section ──► Start hosting
                                                     │
                                                     ▼
                          Step 1 · Basics   (title, category, description, cover)
                                                     │  Continue (validated)
                                                     ▼
                          Step 2 · Prize    (prize pool + presets, entry fee, est. reach)
                                                     │  Continue (validated)
                                                     ▼
                          Step 3 · Schedule (start date, duration, max spots)
                                                     │  Continue (validated)
                                                     ▼
                          Step 4 · Review   (full summary)
                                                     │  Publish
                                                     ▼
                          "You're live!" ──► notify 24k+ matched creators
                                                     │
                          ┌──────────────────────────┴───────────────┐
                          ▼                                           ▼
                 Go to dashboard                              Host another
                          │
                          ▼
        Entries roll in ──► Review & judge ──► Pick winners ──► Secure payout
```

**Narrative:** A host enters from the dedicated Home section, moves through the guided four-step wizard (Basics, Prize, Schedule, Review) with a progress stepper and per-step validation, and publishes. The platform confirms it's live and distributes it to a category-matched audience. As entries arrive, the host reviews and judges them, selects winners, and pays out securely — all in-app.

### 10.3 Application (system) flow

```
main.tsx  ─mounts→  App.tsx  ─renders→  RouterProvider
                                            │
                                            ▼
                                     Shell (phone canvas + ScrollToTop + BottomNav)
                                            │
        ┌───────────────┬───────────────┬──┴────────────┬───────────────┐
        ▼               ▼               ▼                ▼               ▼
   Competitions/    Explore /       Home            Host            Live /
   Details          ListPage        (dashboard)     (wizard)        Notifications /
                                                                    Profile / Winner
```

The router wraps every route in a shared `Shell` (a centered phone-width frame with scroll reset and persistent bottom navigation). Unknown routes and runtime errors resolve to a friendly error screen that routes the user back home, keeping the app resilient and always navigable.
