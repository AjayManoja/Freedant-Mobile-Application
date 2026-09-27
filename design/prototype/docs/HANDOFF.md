# Handoff — Feedants Competitions App

This document is the engineering handoff for importing the prototype into an
agentic IDE (e.g. Antigravity) or handing it to another developer.

## 1. Architecture

- **Single-page app**, mobile-first, constrained to a `max-w-[430px]` phone
  column centered on a neutral canvas (`Shell` in `src/routes.tsx`).
- **Routing** uses react-router Data mode. `App.tsx` renders `RouterProvider`
  with the router defined in `routes.tsx`. All screens are children of a shared
  `Shell` layout route so the phone frame, scroll-reset and error boundary are
  applied uniformly.
- **No global state library.** State is local to each page (`useState`) — the
  seed data in `data.ts` is the single source of truth and is read directly by
  each screen. This is intentional for a prototype; swap `data.ts` selectors for
  API calls to make it live.
- **Scroll management.** `ScrollToTop` runs on every navigation and resets both
  the window and every element marked `data-scroll` (each page's scroll
  container). This fixes the "lands mid-page" problem when navigating between
  screens that share scroll position.
- **Error handling.** The `Shell` route has an `errorElement` (`ErrorScreen`)
  that renders a friendly 404 (unknown route) or generic error with a "Back to
  home" action.

## 2. Route map

All 25 screens are children of the `Shell` layout route (`src/routes.tsx`):

```
/                              -> HomePage
/login /signup /verify /forgot-password  -> auth flow
/competitions                  -> CompetitionsPage (list)
/competitions/:id              -> CompetitionsPage (detail)
/competitions/:id/results      -> LeaderboardPage
/search                        -> SearchPage
/wallet                        -> WalletPage
/refer                         -> ReferPage
/explore                       -> ExplorePage
/explore/:type                 -> ListPage
/notifications                 -> NotificationsPage
/messages /messages/:id        -> MessagesPage / ChatThreadPage
/host                          -> HostPage
/submissions                   -> MySubmissionsPage
/my-competitions               -> MyCompetitionsPage
/live                          -> LivePage
/profile /settings /help /about-> account pages
/legal/terms /legal/privacy    -> LegalPage
/winners/:name                 -> WinnerProfilePage
*                              -> ErrorScreen (404)
```

Navigation entry points:

- Bottom nav (`BottomNav`) with path-aware active states.
- `CompetitionRow` and Explore cards/banners → `/competitions/:id`.
- Explore "See all" → `/explore/trending` and `/explore/ending`.
- Detail back button → `navigate(-1)`.

## 3. Data model

`src/data.ts` — `Competition`:

| field      | type    | notes                                  |
| ---------- | ------- | -------------------------------------- |
| `id`       | string  | slug, used as route param              |
| `title`    | string  |                                        |
| `tag`      | string  | category (Dance/Music/Art/…)           |
| `host`     | string  |                                        |
| `prize`    | string  | display string, e.g. `₹ 1,500`         |
| `entry`    | string  | display string                         |
| `spots`    | number  | remaining spots                        |
| `joined`   | number  | participants                           |
| `rating`   | number  |                                        |
| `trending` | boolean | drives Trending Now                    |
| `endsIn`   | string  | countdown display; `startsWith('0')` ⇒ ending soon |
| `img`      | string  | **imported local asset URL**           |

Selectors: `trendingList`, `endingSoonList`, `getCompetition(id)` (falls back to
the first competition if id is missing/unknown).

## 4. State & interactions

- **Explore**: `query` (search) and `active` (category) state. When either is
  set, the page switches from the browse layout to a filtered results list;
  empty results show a reset-filters card.
- **ListPage**: `sort` state (`popular` | `prize` | `ending`) sorts a copy of
  the base list.
- **Notifications**: local `notes` state with `unread` flags; "Mark all read"
  clears them and the unread banner/count.

## 5. Making it live (next steps)

1. Replace `data.ts` seed arrays with API fetches (React Query recommended).
2. Move `getCompetition` to a loader on the `competition/:id` route so detail
   data is fetched per navigation; use the existing `errorElement` for 404s.
3. Wire the CTA / registration and payment (Razorpay UI is already stubbed in
   the detail page).
4. Replace committed sample avatars/photos with real user/host content.

## 6. Conventions

- Tailwind utility classes only; shared design tokens are CSS variables defined
  in `@theme` (see `DESIGN_SPEC.md`). No inline styles except computed values
  (e.g. progress-bar width).
- Reuse `Card`, `Pill`, `SectionHeader` and the icon set from `ui.tsx` before
  writing bespoke markup.
- Every scrollable screen container carries `data-scroll` so `ScrollToTop`
  can reset it.
