# Design Reference — rendered snapshots of every page

Visual + DOM ground truth for all 28 routes, captured from the real running app
so an agent can **diff a rebuild against the original design**.

- `screenshots/<name>.png` — full-page render at **430×932 @2x** (mobile frame)
- `html/<name>.html` — the fully rendered DOM for that route (post-React,
  onboarding skipped, splash dismissed)
- `index.json` — manifest mapping each `name` → its `route`, `html`, `screenshot`

## Quick view

Open **`reference/gallery.html`** in any browser — a single self-contained page
showing all 28 screenshots in a grid, each linking to its full-size PNG and
rendered DOM. Best starting point for eyeballing the whole app.

## How to use for comparison

1. Open `screenshots/<name>.png` — this is the visual target for that route.
2. Rebuild / inspect the corresponding page (see route in `index.json`).
3. Compare layout, spacing, color, and copy against the PNG; use the matching
   `html/<name>.html` to check exact text, class names, and structure.

Original design source also lives in `src/imports/`
(`Feedants_Competition_Details.pdf` + Figma screenshots).

Regenerate anytime: `node scripts/capture-pages.mjs` (needs the preview server
running on :4173 and Chromium at `/usr/bin/chromium`).
