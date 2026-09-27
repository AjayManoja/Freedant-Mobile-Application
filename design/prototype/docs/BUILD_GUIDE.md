# Feedants — Build Guide (for Claude Code)

This zip is a **complete, buildable** React + Vite + Tailwind v4 mobile web app
(Feedants — a competitions/talent-contest platform). To replicate exactly, run it
as-is; the source is the ground truth.

## Run it

```bash
pnpm install    # or npm install
pnpm dev        # Vite dev server (default port 8443)
pnpm build      # production build
```

Stack: React 19, react-router 8 (data router), Vite 8, Tailwind CSS v4
(`@tailwindcss/vite`, no config/PostCSS), TypeScript 5.7, oxfmt.

## Read these first (already in the zip root)

- `README.md` — overview & scripts
- `HANDOFF.md` — architecture, route map, data model, conventions
- `DESIGN_SPEC.md` — visual spec
- `AboutProject.md` — deep project context

## Design tokens (this folder)

- `tokens.css` — the exact Tailwind v4 `@theme` block from `src/index.css`
- `tokens.json` — machine-readable colors, font, radii, motion

Consumed as utilities: `bg-teal` `#0d8074`, `text-ink` `#1b2b3a`,
`text-slate` `#6b7d8c`, `bg-mint` `#e8f5f1`, `bg-canvas` `#f2f4f5`.
Font: **Poppins** (400–800) via Google Fonts `@import` (first line of `index.css`).

## Layout contract

Mobile column `max-w-[430px]` centered on canvas (`Shell` in `src/routes.tsx`).
Boot flow in `App.tsx`: SplashScreen → Onboarding (once, localStorage-gated) →
RouterProvider. 28 route screens under `src/pages/`, shared primitives in
`src/ui.tsx`, all mock data + domain types in `src/data.ts` (no backend).

## Design reference (compare your rebuild against this)

- `reference/screenshots/<name>.png` — full-page render of every route at 430×932 @2x
- `reference/html/<name>.html` — fully rendered DOM per route (splash/onboarding skipped)
- `reference/index.json` — maps each name → route → html + screenshot
- `src/imports/` — ORIGINAL design source: `Feedants_Competition_Details.pdf` + Figma screenshots

Use the PNG as the visual target and the HTML for exact text/structure when
diffing a reproduction. Regenerate with `node scripts/capture-pages.mjs`.
