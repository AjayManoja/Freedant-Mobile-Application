# Design reference (read-only)

Everything in this folder is **input** to the build, not part of the product. Nothing under `design/` is compiled, deployed or imported by `apps/` or `services/`. Do not edit these files; if the design changes, replace them with a new export and note it in the changelog.

| Folder | Contents | Use it for |
|---|---|---|
| [`source/`](source/) | Original design: `Feedants_Competition_Details.pdf` and Figma screen exports | The designer's intent |
| [`reference/`](reference/README.md) | Full-page render of all 28 screens (430×932 @2x) plus the rendered DOM of each | Visual target and exact copy when rebuilding a screen. Open [`reference/gallery.html`](reference/gallery.html) to see all screens at once. |
| [`tokens/`](tokens/) | Colors, font, radii, motion as CSS (`tokens.css`) and JSON (`tokens.json`) | Source for the mobile app's theme (`packages/shared` / NativeWind config) |
| [`prototype/`](prototype/) | Source snapshot of the Figma Make web prototype (React + Vite, mock data) and its docs | Layout details, copy, and product context ([`docs/AboutProject.md`](prototype/docs/AboutProject.md)) |

## Notes

- **The prototype is not runnable from here.** Its `vite.config.ts` depends on Figma Make tooling (`.figma/`) that was intentionally left out. It is kept as a code reference only.
- **Reference screenshots are full-page captures.** Fixed-position elements (the "Create" bottom sheet, bottom nav) appear mid-page. Ignore them when comparing layouts; they are capture artifacts, not the design.
- `reference/index.json` paths are relative to the original prototype root, i.e. `reference/…` here means `design/reference/…`.
- Known prototype issues **not** to carry into the rebuild (money and time stored as display strings, unknown ids falling back to the first competition, missing Devanagari font, broken external avatar images) are listed in [`docs/PROJECT_PLAN.md`](../docs/PROJECT_PLAN.md#prototype-issues-not-to-carry-over).
