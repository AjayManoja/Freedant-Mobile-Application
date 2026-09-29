# Design parity tools

Scripts used to match the mobile app to `design/reference` pixel for pixel. They drive headless
Chrome over the DevTools protocol (no extra dependencies) and Python PIL for image crops.

| Script | What it does |
|---|---|
| `setup-ref.mjs` | Rebuilds `design/reference/html` as a local site with the prototype's Tailwind v4 theme and **Poppins** (the original PNGs were captured with a fallback font). Run once. |
| `renderref.mjs <page…>` | Full-page render of reference pages → `ref-poppins/<page>.png` (430 px wide, @2x). Strips closed sheets and demo toasts. |
| `measure.mjs <page> "texts:A\|B"` | Exact boxes (x, y, w, h, font size, line height) of elements in a reference page. Any JS expression works too, with helpers `q`, `cls`, `byText`, `box`. |
| `capture.mjs <out.png> <route> [height] [--auth=email] [--click=Label,…] [--after=ms] [--texts=A\|B]` | Screenshots the running Expo web app (`localhost:8081`) the same way, optionally signed in, clicking buttons by label, and printing element boxes for comparison with `measure.mjs`. Sessions are cached in `session-<email>.json` (gitignored). |
| `compare.py <ref.png> <ours.png> <out.png> [top] [height] [oursTop]` | Side-by-side crop of the same band, with 50 px ticks. |
| `probe.mjs <route> [waitMs]` | Prints the rendered text and any console errors/exceptions of an app route. |
| `outline.py <html> [start] [n]` | Indented element/class/text tree of a reference HTML page. |

Workflow per screen: read the prototype page (`design/prototype/src/pages/*.tsx`), port it with the
`src/design` primitives, then `capture.mjs` + `measure.mjs` the same labels and fix any offset.
Card paddings in the design often resolve differently from the class names (`p-5` beats `p-3`/`p-4`
in the prototype's stylesheet) — measure, don't trust the classes.

Run `capture.mjs` with `MSYS_NO_PATHCONV=1` in Git Bash, otherwise routes like `/` are rewritten.
