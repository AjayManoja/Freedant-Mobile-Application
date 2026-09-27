# Design Spec — Feedants Competitions App

Mobile-first UI, teal/navy palette on a soft neutral canvas, dense spacing and a
single geometric sans (Poppins). All tokens are Tailwind v4 `@theme` variables
in `src/index.css`.

## Color tokens

| Token           | Value     | Tailwind class          | Usage                                   |
| --------------- | --------- | ----------------------- | --------------------------------------- |
| `--color-teal`  | `#0d8074` | `teal` (bg/text/border) | Primary brand, CTAs, active states      |
| `--color-teal-dark` | `#0a6b60` | `teal-dark`         | Gradients, secondary banners            |
| `--color-ink`   | `#1b2b3a` | `ink`                   | Primary text, headings                  |
| `--color-slate` | `#6b7d8c` | `slate`                 | Secondary/muted text, labels            |
| `--color-mint`  | `#e8f5f1` | `mint`                  | Tinted tiles, teal icon backgrounds     |
| `--color-canvas`| `#f2f4f5` | `canvas`                | App background                          |

Accent tints (Tailwind defaults) used sparingly for category icon tiles:
`amber-50/500`, `rose-50/400`, `indigo-50/400`, `neutral-100`.

## Typography

- **Family:** Poppins (400/500/600/700/800) via Google Fonts `@import`, exposed
  as `--font-sans` (`font-sans`), applied to `body`.
- **Scale (observed usage):**
  - Page title `text-2xl font-extrabold` (Explore) / `text-xl font-extrabold`
  - Card title `text-sm–base font-bold`
  - Body `text-sm`, muted `text-xs`, micro labels `text-[10px]/[11px]`
  - Emphasis numbers (prize) `font-extrabold text-teal`

## Spacing & layout

- App frame: centered column, `max-w-[430px]`, `bg-canvas`, full-height flex
  column (header · scroll body · bottom nav).
- Page padding: header `px-5`, scroll body `px-4`, sections `space-y-4/5`.
- Scroll body carries `data-scroll` + `overflow-y-auto no-scrollbar`, with
  bottom padding to clear the fixed bottom nav (`pb-28`) and, on the detail
  page, the sticky CTA (`pb-44`).
- Radii: cards/tiles `rounded-2xl`, chips/buttons `rounded-xl`/`rounded-full`,
  small badges `rounded-md`.
- Elevation: `shadow-sm` on white surfaces; overlays use `bg-black/45` and
  `bg-white/90`.

## Component inventory

Shared (`src/ui.tsx`):

| Component       | Props                                            | Notes                              |
| --------------- | ------------------------------------------------ | ---------------------------------- |
| `Card`          | `className?`, `children`                          | White rounded surface + shadow     |
| `Pill`          | `className?`, `children`                          | Rounded label                      |
| `SectionHeader` | `title`, `action?`, `onAction?`                   | Section title + optional "See all" |
| `judgeImg`      | —                                                | Local judge avatar URL             |
| Icons           | —                                                | ArrowLeft, Trophy, Users, Play, Hourglass, Clock, Send, Upload, Chevron, Info, Shield, Megaphone, Chat, Home, SearchIcon, Plus, Fire, Star, Bell, CheckCircle, CalendarIcon, PlayBadge, Razorpay |

Composed:

| Component         | File                          | Responsibility                          |
| ----------------- | ----------------------------- | --------------------------------------- |
| `Shell`           | `routes.tsx`                  | Phone frame, scroll reset, error boundary |
| `ErrorScreen`     | `routes.tsx`                  | 404 / generic error                     |
| `BottomNav`       | `components/BottomNav.tsx`    | 4-tab nav, path-aware active state       |
| `CompetitionRow`  | `components/CompetitionRow.tsx` | List row → detail                     |

## Interaction specs

- **Buttons/CTAs:** teal fill, white text, `rounded-xl`, `font-semibold`.
  Active nav item switches from `slate` to `teal`.
- **Chips:** active = `bg-teal text-white`; idle = `bg-white text-slate shadow-sm`.
- **Search:** live-filter on input; `×` clears; results view swaps in when a
  query or non-`All` category is active; empty state offers reset.
- **Sort (ListPage):** Popular (by joined) · Top Prize (by parsed prize) ·
  Ending Soon (by countdown string).
- **Notifications:** unread ⇒ teal ring + dot; "Mark all read" clears state.
- **Navigation transitions:** every route change scrolls window and all
  `data-scroll` containers to top.

## Imagery

- 8 competition photos + 5 avatars committed under `src/assets/`, imported as ES
  modules. Featured Explore banners use CSS gradient fills (`bg-teal`,
  `bg-teal-dark`, `bg-[#1b2b3a]`) rather than photos for a cleaner promo look.
- Favicon: `public/favicon.svg`, theme-color `#0d8074`.
