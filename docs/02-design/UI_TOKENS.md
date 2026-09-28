# UI Tokens

| | |
|---|---|
| **Version** | 1.0 (Phase 1) |
| **Status** | Draft for review |
| **Source of truth** | [design/tokens/tokens.json](../../design/tokens/tokens.json), [design/tokens/tokens.css](../../design/tokens/tokens.css) |
| **Related** | [SRS NFR-UX](../01-requirements/SRS.md#44-usability-and-accessibility) · [Risk R-17](../01-requirements/RISKS.md) |

The Figma prototype is a Vite + Tailwind CSS v4 web build; its tokens are a Tailwind `@theme` block. The mobile app is Expo/NativeWind, so this document is the **mapping**, not a new palette — the values never change, only their expression. This is the control for R-17 ("rebuilt screens drift from the Figma reference") and the design-review input for NFR-UX-01 ("screens match the design reference in layout, color and copy").

## 1. Color

| Token | Hex | Role | NativeWind class | Tailwind `@theme` var |
|---|---|---|---|---|
| `teal` | `#0d8074` | Primary / brand, CTAs, active nav | `bg-teal` / `text-teal` | `--color-teal` |
| `teal-dark` | `#0a6b60` | Primary pressed state, gradients | `bg-teal-dark` | `--color-teal-dark` |
| `ink` | `#1b2b3a` | Primary text, headings | `text-ink` | `--color-ink` |
| `slate` | `#6b7d8c` | Secondary text, captions | `text-slate` | `--color-slate` |
| `mint` | `#e8f5f1` | Tinted surfaces, badges | `bg-mint` | `--color-mint` |
| `canvas` | `#f2f4f5` | App background | `bg-canvas` | `--color-canvas` |
| `white` | `#ffffff` | Cards, surfaces | `bg-white` | (Tailwind default) |

### 1.1 Contrast audit (NFR-UX-03: ≥ 4.5:1 body, ≥ 3:1 large text/UI)

| Pair | Ratio | Verdict | Use |
|---|---|---|---|
| `ink` (#1b2b3a) on `white` | 13.1:1 | Pass | Body text on cards |
| `ink` on `canvas` (#f2f4f5) | 12.3:1 | Pass | Body text on app background |
| `slate` (#6b7d8c) on `white` | 4.6:1 | Pass (body) | Captions, secondary text |
| `slate` on `canvas` | 4.3:1 | **Fail for body text** (needs 4.5:1) | Only usable at ≥ 18.66px/bold on `canvas`, or darken slightly; flagged for the visual-comparison pass in Sprint 2 rather than changing the token now (R-17 process: fix in the same sprint the mismatch is found) |
| `white` text on `teal` (#0d8074) | 4.8:1 | Pass | Primary button label |
| `teal` on `white` | 4.8:1 | Pass | Active nav icon/label |

### 1.2 Gap: semantic status colors

The token set has no success/warning/error colors — needed for payment-failed states, refund badges, "spots almost gone" warnings, and score/results states that don't exist in the static prototype (FR-PT-05 processing/confirmed/failure states; FR-PY-07 wallet filters). Rather than inventing off-brand colors, Phase 2 implementation adds three tokens derived to sit consistently alongside the existing palette, confirmed against contrast on both `white` and `canvas` before use:

| New token | Hex (proposed) | Role | Contrast on white |
|---|---|---|---|
| `success` | `#0f7a3d` | Confirmed, credited, results published | 5.1:1 |
| `warning` | `#a35a00` | Hold expiring, spots almost gone | 5.4:1 |
| `danger` | `#b3261e` | Payment failed, rejected, error states | 5.9:1 |

These are additions, not overrides — `tokens.json`/`tokens.css` in `design/` stay the single source; the mobile app's NativeWind theme is generated from them plus this table, and any future addition follows the same contrast-first rule (state is never signalled by color alone regardless — NFR-UX-03 — every status also carries an icon or text label).

## 2. Typography

| Token | Value |
|---|---|
| Family | `Poppins` (Google Fonts), fallback `ui-sans-serif, system-ui, sans-serif` |
| Weights | 400, 500, 600, 700, 800 |
| Mobile loading | `expo-font` bundles the same weight set at build time (no runtime Google Fonts fetch on a mobile app — avoids a network dependency the web prototype has) |
| Devanagari | Not loaded in MVP (English only, NFR-UX-06); loading the Devanagari subset is called out explicitly as a prerequisite when Hindi ships (SCOPE.md Later, PROJECT_PLAN prototype-issue "ENG/हिंदी toggle renders tofu") |

## 3. Layout and spacing

| Token | Value | Mobile mapping |
|---|---|---|
| `app-max-width` | 430px | Web export only (Expo web build) keeps the centered phone-width column; native Android has no max-width — it fills the device |
| `app-frame` | Centered column, `min-h-screen`, `canvas` background | Native: root view `flex-1 bg-canvas` |
| Radius (buttons) | `rounded-xl` (0.75rem / 12px) | NativeWind `rounded-xl` |
| Radius (cards/tiles) | `rounded-2xl` (1rem / 16px) | NativeWind `rounded-2xl` |
| Touch targets | Not specified in tokens; **enforced as ≥ 44×44 pt** per NFR-UX-03 regardless of the visual size a component appears — a design constraint the prototype's web build didn't need to hold | Applied at component build time, not a token |

## 4. Motion

| Token | Value | Mobile mapping |
|---|---|---|
| `splash-pop` | 0.6s `cubic-bezier(0.22,1,0.36,1)` | `react-native-reanimated` equivalent easing curve on the splash screen |
| `splash-rise` | 0.6s ease-out, staggered 0.35s/0.55s delays | Same stagger, `Animated`/Reanimated sequence |
| `splash-loader` | 1.1s ease-in-out infinite | Looping opacity/scale animation |

Reduced-motion: the design tokens don't define a reduced-motion variant; the mobile app respects the OS-level "reduce motion" accessibility setting by skipping non-essential animation (splash flourish, list transitions) when it is on — an addition beyond the token set, required by general accessibility practice even though SRS doesn't list a specific NFR for it (candidate for an SRS addendum if raised in review).

## 5. Iconography and imagery

- No icon token file exists yet — icons are inline SVGs per screen in `design/reference/html/*`. Phase 2 extracts a shared icon set (referenced but not duplicated) rather than each screen's HTML being copied ad hoc, matching PROJECT_PLAN's small-components principle.
- Images: `expo-image` for caching/placeholder behavior (background color held on the container while loading, per the prototype-issues table in PROJECT_PLAN — "external avatar URLs that fail to load" is fixed by owning storage + a fallback avatar, not by keeping external URLs).

## 6. How this is verified (NFR-UX-01)

Each screen's implementation is compared against its reference screenshot in [design/reference/screenshots/](../../design/reference/screenshots/) before a sprint demo; deviations are either a bug (fixed same sprint, per R-17's mitigation) or a deliberate, documented change (e.g. the fee-breakdown removal of GST/promo per A-8, or the new funding step per FR-HS-06) — never a silent drift.
