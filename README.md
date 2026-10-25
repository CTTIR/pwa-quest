# Questionnaire PWA <img src="assets/branding/logo.png" alt="pwa-quest hex logo" width="120" height="139" align="right" />

An offline-first Progressive Web App for collecting questionnaire responses in
research / field settings. Each session is keyed by a participant ID and a
scenario. After ten questions the app can export the data as a QR code (for
scanning at a central station) or as a CSV / XLSX / TXT / XML file.

No backend, no telemetry, no network calls at runtime. The app boots from a
service-worker cache after the first visit and continues to work with the
device fully offline.

## Tech choices

- **React 18 + Vite + TypeScript** — small bundle, fast dev loop, mature PWA
  story via `vite-plugin-pwa` (Workbox).
- **Tailwind CSS** — mobile-first utility classes; high-contrast palette
  designed to remain readable in bright outdoor light.
- **Zustand** — minimal global store; persists the in-progress session to
  IndexedDB so a tab close / reload resumes where the participant left off.
- **html5-qrcode** for camera-based QR scanning. Chosen over @zxing/browser
  because of better out-of-the-box mobile camera handling and a simpler API.
- **qrcode** (npm) for QR rendering on the export screen.
- **xlsx (SheetJS, community build)** for `.xlsx` export, lazy-loaded so it
  doesn't bloat the initial shell.
- **Hand-rolled** CSV / TXT / XML writers — small enough to keep in-tree and
  easier to review than pulling another dependency.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
```

The service worker is disabled in dev for fast iteration; offline behaviour
must be verified against a production build.

## Production build

```bash
npm run build        # output in dist/
npm run preview      # serve the production build locally on :4173
```

To verify offline:

1. `npm run build && npm run preview`
2. Open the URL in a Chromium-based browser, hit reload once so the service
   worker activates, then go to DevTools → Application → Service Workers and
   tick "Offline" (or pull the network cable). The app should still load and
   complete a session end-to-end.

## Deploy as a static PWA

The build output in `dist/` is plain static files — host it anywhere that can
serve them with the right MIME types and HTTPS.

### Netlify / Vercel / Cloudflare Pages

Point the platform at this repo, set the build command to `npm run build`,
and the publish directory to `dist`. No further config needed.

### GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds and publishes the site
on every push to `main` (and on this feature branch / on manual dispatch).
It builds with `BASE_PATH=/<repo-name>/` so asset URLs resolve correctly
from the sub-path host.

One-time setup in the repository:

1. **Settings → Pages → Build and deployment → Source**: select
   **GitHub Actions**.
2. Push to a covered branch (or use **Run workflow** on the Actions tab).

The deployed URL is `https://<owner>.github.io/<repo-name>/`. HTTPS is on
by default, which the service worker requires.

To build and publish manually with a different host:

```bash
BASE_PATH=/pwa-quest/ npm run build
# then upload dist/ to your static host
```

## Customising the questionnaire

All content lives in `src/config/`:

- `questionnaire.ts` — the array of ten questions. Each question has a
  stable `id` that ends up in exports; renaming an `id` invalidates any
  in-progress sessions on participants' devices, so prefer adding new items
  and bumping `SCHEMA_VERSION` for breaking changes.
- `scenarios.ts` — the dropdown options for "scenario". Edit the array to
  match your study; the scenario field on the setup screen is locked to
  these values to keep exported data clean.

The full set of question types is defined in `src/types.ts` (`QuestionType`).
Add a new type by extending that union, adding a component under
`src/components/questions/`, and wiring it up in `QuestionRenderer.tsx` and
`lib/answers.ts`.

## QR code limits (export)

The export QR encodes the session as compact JSON. With error correction
level **M**, a QR code can hold roughly 2,300 alphanumeric characters or
~1,800 byte-mode characters in practice — but scannability degrades as the
code approaches that limit, especially on cheaper phone cameras.

The app warns when the JSON exceeds **2,000 characters** and recommends the
file download instead. Multi-QR chunking is intentionally **not** supported
— scanning chunked codes in the field is fiddly, and the file downloads
already cover this case. If you need it, open an issue.

To stay well under the limit:

- Keep free-text answers short (the example questionnaire caps `q7` at 80
  chars and marks `q8` optional).
- Use stable, short scenario IDs.
- Question IDs (`q1`..`q10`) are already short — don't rename them to longer
  strings.

## File exports

Filename pattern:
`questionnaire_<participantId>_<scenario>_<YYYYMMDD-HHmm>.<ext>`. Both fields
are sanitised — anything outside `[A-Za-z0-9_-]` is collapsed to `-`.

| Format | Notes                                                                |
| ------ | -------------------------------------------------------------------- |
| CSV    | One row per answer. RFC 4180 quoting. UTF-8 BOM for Excel on Windows.|
| XLSX   | Two sheets: `Session` (key/value metadata) and `Answers` (CSV-shape).|
| TXT    | Human-readable — header block, then `Q/A` pairs.                     |
| XML    | Well-formed, single `<session>` root, escaped attribute/element data.|

## Project layout

```
src/
  components/
    questions/    # one component per question type
    qr/           # QrScanner.tsx, QrDisplay.tsx (lazy)
    ui/           # Progress, Modal, Toast
  config/
    questionnaire.ts
    scenarios.ts
  lib/
    storage.ts        # IndexedDB wrapper
    sanitize.ts       # filename helpers
    answers.ts        # default + validation per type
    buildSession.ts   # build the canonical export object
    download.ts       # browser download helper
    export/
      csv.ts | txt.ts | xml.ts | xlsx.ts
  pages/
    Setup.tsx | Questionnaire.tsx | Review.tsx | Export.tsx
  pwa/
    registerSW.ts
  App.tsx
  main.tsx
  styles.css
public/
  favicon.svg
  icons/icon.svg + generated PNGs
```

## Privacy

The app is fully client-side. The only camera usage is the optional setup-QR
scan; the stream stops as soon as a code is decoded. No data ever leaves the
device unless the operator chooses to share an exported file or QR code.

## Re-generating PWA icons

The editable R geometry in `tools/branding` is the source of the PWA icons.
The committed PNGs include a maskable icon with an opaque background and
the complete symbol inside the safe circle. Regenerate registered assets with:

```sh
Rscript tools/branding/render.R --apply
```

`node scripts/build-icons.mjs` runs the same R renderer. R with Cairo graphics
is needed only when regenerating artwork. Commit the resulting assets.

## Use of LLM tools

Where applicable, LLM tools were used for narrowly defined, non-authorial tasks:
copyediting, prose refinement, Markdown/LaTeX formatting, boilerplate scaffolding
(such as CI configurations and build scripts), and code refactoring. Tools included
[Chat AI](https://kisski.gwdg.de/leistungen/2-02-llm-service/), the KISSKI
(GWDG) service, and self-hosted **Mistral Small (24B, Apache-2.0)** served through
a local **vLLM architecture** on an Ubuntu Linux workstation with Intel
processors and NVIDIA GPUs. The self-hosted model ran locally, with no data sent
to third parties.

All scientific claims, methodological choices, analyses, interpretations and
conclusions remain the authors' own. Where applicable, LLM-generated material
must be reviewed and revised before inclusion, and references must be verified
against their DOI, arXiv ID or ISBN.

Local software setup: vLLM with Python/PyTorch, plus R and RStudio.

## Branding

The supplied CTTIR Material Atlas artwork and its editable R source are in
[`tools/branding`](tools/branding/README.md). Use that renderer to reproduce
the primary badge, alternate editions, and platform icons.
