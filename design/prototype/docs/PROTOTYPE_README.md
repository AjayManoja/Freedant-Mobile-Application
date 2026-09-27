# Feedants — Creative Competitions (Mobile)

A mobile-first React web app for discovering, joining and winning creative
competitions (dance, music, art, photography, coding, writing). Faithful
replica of the Feedants competition-details design, extended into a fully
clickable prototype with Explore, list, notifications and detail flows.

## Tech stack

- **React 19** + **TypeScript 5.7**
- **Vite 8** (build/dev/preview)
- **Tailwind CSS v4** via `@tailwindcss/vite` (no config file; tokens live in `src/index.css`)
- **react-router 8** (Data mode — `createBrowserRouter` / `RouterProvider`)
- **Poppins** via Google Fonts `@import` in `src/index.css`

## Getting started

```bash
pnpm install
pnpm dev        # start Vite dev server (hot reload)
pnpm build      # type-check + production build to dist/
pnpm preview    # preview the production build
pnpm format     # oxfmt
```

The dev server binds to `$PORT` (default 8443) inside Figma Make.

## Project layout

```
src/
  main.tsx                  React entry; mounts <App/> and imports index.css
  App.tsx                   RouterProvider wrapper
  routes.tsx                Router, Shell layout, ScrollToTop, 404/Error screen
  index.css                 Tailwind import + @theme design tokens + fonts
  data.ts                   Domain types + seed/generated data + selectors
  messages.ts               Chat/messages seed data
  ui.tsx                    Shared presentational helpers + SVG icons
  hooks/useOnline.ts        Online/offline detection (drives OfflineBanner)
  components/               SplashScreen, Onboarding, BottomNav,
                            CompetitionRow, EmptyState, OfflineBanner
  pages/                    25 route screens (see Routes table below)
  imports/                  Original design reference: PDF + Figma screenshots
  assets/
    competitions/*.jpg      8 local competition images (committed)
    avatars/*.jpg           judge + 4 winner avatars (committed)
public/
  favicon.svg
```

## Assets

All imagery is **committed locally** under `src/assets/` and imported as ES
modules (Vite fingerprints and bundles them). There are no runtime requests to
external image hosts, so the app works fully offline / behind restricted
networks.

## Routes

Full map (defined in `src/routes.tsx`, all under the `Shell` layout):

| Path | Screen |
|------|--------|
| `/` | HomePage |
| `/login`, `/signup`, `/verify`, `/forgot-password` | Auth flow |
| `/competitions`, `/competitions/:id` | CompetitionsPage (list + detail) |
| `/competitions/:id/results` | LeaderboardPage |
| `/search` | SearchPage |
| `/wallet` | WalletPage |
| `/refer` | ReferPage |
| `/explore`, `/explore/:type` | ExplorePage / ListPage |
| `/notifications` | NotificationsPage |
| `/messages`, `/messages/:id` | MessagesPage / ChatThreadPage |
| `/host` | HostPage |
| `/submissions` | MySubmissionsPage |
| `/my-competitions` | MyCompetitionsPage |
| `/live` | LivePage |
| `/profile`, `/settings`, `/help`, `/about` | Account pages |
| `/legal/terms`, `/legal/privacy` | LegalPage |
| `/winners/:name` | WinnerProfilePage |
| `*` | 404 screen |

## Deployment

`pnpm build` emits a static bundle to `dist/`. Serve it from any static host
(Vercel, Netlify, Cloudflare Pages, S3+CDN). Because the app uses the History
API router, configure a **SPA fallback** so all paths rewrite to `index.html`.

See `HANDOFF.md` for architecture details and `DESIGN_SPEC.md` for the design
system.
