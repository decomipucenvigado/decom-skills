# Event images from Claude Design

Status: implemented. Design approved in chat on 2026-09-29, planned in `docs/superpowers/plans/2026-09-29-claude-design-stills.md`; the spike passed (see "Spike result") and the first real week, 2026-W40, was made this way (see "Write side").

## Goal

Each event's image (`out/<week>/<slug>/ad.png`) stops being a frame of the Remotion
component and comes from a Claude Design canvas instead, with a color per kind of event
and a different composition per event. The images were judged flat: every event shares one
flat blue field and one layout.

## Decisions taken with the owner

| Question | Decision |
|---|---|
| Scope | Images only. `clip.mp4` and `semana.mp4` stay on Remotion, with the IPUC palette. Image and video will therefore look different. |
| Colors | New colors per event are allowed. They leave the IPUC manual's palette. The manual still governs the video and the logo. |
| Assignment | Fixed by ministry or kind of event, the same every week. Composition varies per event. |
| Review | None added. The images are shown in the final report as today. No third checkpoint. |
| Path | Claude Design canvas per week, exported locally with the project's Chromium (option A). Fallback if the spike fails: keep Remotion for images and add per-kind palettes and compositions (option C). |
| Design system | The account's default Claude Design system is Wasapi's (green). It is not used. The IPUC's palettes live in the repo. |

## Non-goals

- Changing the video, the voice, the script or the checkpoints.
- A Claude Design system artifact for the IPUC.
- Animating the images.
- Per-event subagents for images: they have no Artifact tool, and one canvas keeps the
  week's variety balanced.

## Architecture

```
Checkpoint 1 confirmed -> events.json final
        |
        +--> ad-designer subagents (Remotion, video only)      unchanged
        |
        +--> orchestrator builds the week's canvas:
               Design artifact named for the week ("IPUC semana 28 sep - 4 oct"), private,
               one 1920x1080 artboard per event, [data-slug="<slug>"]
               palette from brand/paletas-imagen.md
             -> Artifact read: published HTML saved to out/<week>/imagenes/
             -> scripts/export-stills.mjs: reads each artboard's visible text in the
                browser (raw CDP, Remotion's installed headless shell, page scripts
                disabled), audits it (still-source), then a screenshot per artboard
             -> out/<week>/<slug>/ad.png

render.mjs: clips and semana.mp4 as today; the Remotion frame is written to
out/<week>/<slug>/fotograma.png (review aid for the video only)
```

The canvas is built by the orchestrator, not a subagent, and exported serially, which
keeps `CLAUDE.md` rule 4 (nothing renders in parallel).

### Contract between the canvas and the exporter

- One element per event with `data-slug="<slug>"`, exactly 1920x1080.
- Assets (logo, fonts) are uploaded to the canvas and referenced as `/_blob/<id>`; the download saves them apart, so the exporter stages them itself (amended by the "Spike result" below: they are not reachable by relative path or embedded).
- The layout of the downloaded artifact was fixed by the spike (`project/*.dc.html`, one file per
  artboard, plus assets as `<id>.<ext>` at the root); see "Spike result".

### New files

| File | Purpose |
|---|---|
| `brand/paletas-imagen.md` | Free text: palette per kind of event. Read by the orchestrator, parsed by no code (the "Claude reads the words" decision). |
| `scripts/export-stills.mjs` | `node scripts/export-stills.mjs <week> [slug ...] [--dir path]`. Opens the downloaded HTML in Remotion's installed headless shell (`chrome-headless-shell`, or `headless_shell` on Linux arm64; `REMOTION_BROWSER_EXECUTABLE` overrides it; none is ever downloaded), driven over raw CDP by `scripts/core/cdp.mjs` with Node built-ins only and with the page's scripts disabled. Waits for fonts and images, screenshots each `[data-slug]` element at 1920x1080 and writes `ad.png`. Errors if an element is missing or not 1920x1080 (see "The exporter's own checks"). |
| `scripts/core/still-source.mjs` | Pure audit of the artboards' text against `events.json` (below). It runs inside `export-stills.mjs`, not `validate.mjs`, because reading an artboard's visible text needs the browser. |
| `scripts/test/still-source.test.mjs`, `scripts/test/export-stills.test.mjs` | Tests, written first, with the fictional "Iglesia Ejemplo". |

### Palettes by kind of event

Chosen from the event's `ministerio`, else from the words of its title, else the default.
This is the initial proposal, kept in `brand/paletas-imagen.md` and editable there:

| Kind | Palette |
|---|---|
| Jóvenes, adolescentes | violet with gold |
| Damas (Dorcas, Damas Jóvenes) | magenta with cream |
| Evangelismo | amber with navy |
| Oración, enseñanza, escuela dominical | teal |
| Ayuno | deep indigo with muted gold |
| Anything else | IPUC blue with cyan |

Kept from the manual and `design.md` even off-palette: facts only from `events.json`,
Spanish with `tú`, 16:9 at 1920x1080, the logo unaltered on a flat panel with the variant
that suits the background (dark or light). The church name appears on screen only through
the logo.

An event that fits two kinds (for example "Ayuno Damas Jóvenes") takes the kind of its
`ministerio` if set, otherwise the first match in the table's order. The orchestrator says
which it chose in the final report.

### Audit: `still-source.mjs`

The visible text of each artboard is tokenized (case and accents ignored, punctuation
dropped). Allowed strings: `titulo`, `ministerio`, `fechaTexto`, `horaTexto` (if the event
has a time), `lugar` (only if it differs from `iglesia.lugarPorDefecto`) and
`iglesia.llamadoAccion`. Errors, which block the export:

- `token-ajeno`: a visible token that is not in the allowed strings. This covers invented
  times, dates, places and copy, and digits in particular.
- `nombre-en-texto`: `iglesia.nombre` typed on the artboard.
- `hora-ajena`: a clock time that is not the event's `hora` (checked as a unit, the way the
  narration audit does, because a bag of tokens cannot tell "7:00" from "3:00" when both digits
  are in the record); any clock time on an event with no time.
- `fecha-ajena` and `dia-ajeno`: an "N de mes" or a weekday that is not in the event's
  `fechaTexto` or `titulo`.
- `artboard-vacio`: an artboard with no visible text (an empty read must not pass silently).
- `artboard-faltante`: an event without an artboard.
- `artboard-sobrante`: an artboard whose slug is not an event.
- `artboard-duplicado`: two artboards with one slug.
- `sin-iglesia`: `events.json` has no church name (a forgotten `lectura.json`), so the
  typed-name check could not run; same wording as `validate.mjs`.

This is a net, not proof, like the narration check: the orchestrator still looks at every
`ad.png` before reporting.

### The exporter's own checks

The page is read with its own scripts disabled (`Emulation.setScriptExecutionDisabled`), so
an artboard's inline `<script>` cannot change its text between the audit and the photo.
Besides `asset-faltante` and `sin-artboards` (before the browser opens), `fuente-no-cargada`,
`imagen-rota` and `tamano-artboard`, it reports, each with its `slug`:

- `slug-desconocido`: a requested slug that is not an event of `events.json` (the wording
  of `validate.mjs`), found before any browser opens. A requested event with no artboard is
  only `artboard-faltante`.
- `texto-no-auditable`: something the photo shows but `innerText` does not, so the audit
  cannot read it: an `iframe`, `frame`, `object`, `embed`, `input`, `textarea` or `select`
  inside an artboard; a `::before` or `::after` whose `content` has a letter or digit; or
  rendered text outside every artboard (named after the artboard it overlaps, if any).
- `texto-desbordado`: rendered text inside an artboard that has a digit (a time or a date)
  and is not horizontally inside, within 1 px, every ancestor up to the artboard that paints
  a background or clips (`overflow-x` not `visible`), the artboard included, or not
  vertically inside the artboard, give or take a quarter of its font size. This is the W40
  "0:30 a. m." case below. A word with no digit may bleed on purpose (a giant "Culto" off
  the bottom edge).

## Docs and rules that change

- `CLAUDE.md`: rule 4 (the orchestrator builds the image canvas; subagents still write
  Remotion components only), rule 5 (`tokens.ts` governs the video; image palettes live in
  `brand/paletas-imagen.md`), the Scope paragraph (brand identity in code stays for the
  video and logo), the commands list, and the conventions on where `ad.png` comes from.
- `PLAN.md`: the "Image generation" decision row, dated.
- `.claude/skills/church-ads/SKILL.md`: step 5 (canvas next to the designers), step 7
  (export the canvas; its audit blocks like validate does), step 10 (`fotograma.png`), step 11 (report
  lists events with no image and which kind each one took).
- `README.md` (Spanish): where the images come from.
- `brand/corporate-brand.md`: a note that the manual's palette governs the video and the
  logo, not the images.

## Failure modes

- The canvas cannot be published or read back: no `ad.png` is written for the week, and
  any left from an earlier run is removed; the video is unaffected. The report says so in
  plain Spanish and points at each event's `fotograma.png` as a temporary stand-in.
- The export is all or nothing. Any error (an artboard that fails the audit, a font or image
  that did not load, a wrong size, a missing asset) writes no image and removes the old
  image of each event in scope, so no stale image survives while the report says the event
  has none. Fix the canvas and export again. A single-slug export still audits the whole
  canvas, so one bad artboard blocks every event until it is fixed; the report lists the
  events with no image.
- The browser cannot start, dies or stalls: exit 1, and nothing is written or removed.

## Testing

- `still-source`: unit tests for each error above and for the allowed cases (a split title
  across elements, an accented or uppercased token, a place equal to the default).
- `export-stills`: a fixture HTML with two artboards, checking size and file names.
- Visual: export and look at the 2026-W40 events, with the palettes applied.
- Remotion components are still checked with `tsc --noEmit` and a rendered still.

## Risks and the first step

Unknown until tried: whether `Artifact read` returns the full published HTML of the canvas
with its fonts and assets, and without the canvas interface around the artboards. The
first task of the plan is a **spike** with one event (`bazar-del-libro`):

1. Publish a private Design artifact with one artboard for that event.
2. Read it back to disk.
3. Screenshot the artboard locally at 1920x1080.

Go if the PNG shows Montserrat and the logo correctly with no canvas chrome. No-go: stop,
report, and decide again, most likely for option C. The spike costs no paid API calls and
its artifact is throwaway until it passes.

## Spike result

Date: 2026-09-29. **Verdict: GO**, on one condition the spec's contract did not foresee:
the downloaded canvas does not carry its logo and fonts, so the exporter must resolve
them itself (below). Throwaway artifact (private, never shared, not deleted):
https://claude.ai/artifact/TJCEduq4DjMfL4Vbvr3mpS, one 1920x1080 artboard for
`bazar-del-libro`, Montserrat and the dark-background logo on a flat IPUC-blue panel.

### What passed, and how

| Check | Result |
|---|---|
| PNG exactly 1920x1080 | Yes, `Page.captureScreenshot` with `clip` at scale 1, 1920 x 1080 RGB. |
| Montserrat and the logo render | Yes, but only once `/_blob/<id>` is resolved (see "What the download does not carry"). All three `FontFace`s report `loaded`, the logo has `naturalWidth` 2363. Looked at the PNG: correct. |
| No canvas interface around the artboard | Yes. The artboard file has none. The canvas editor lives in `index.html`, a different file. |
| `innerText` equals what was put on it | Yes: `"Jóvenes\nBazar del libro\ndomingo 4 de octubre\nTe esperamos"`. Blocks are separated by `\n`, so the audit must split on whitespace. |
| Artboards selectable by `data-slug` | Yes. `[data-slug]` matches the root `div` of the artboard, `getBoundingClientRect` gives 0, 0, 1920, 1080, and the page scroll size is exactly 1920 x 1080. The runtime does not strip the attribute. |

### What `Artifact read` writes to disk

`Artifact read` on the URL alone writes nothing (it returns the type's instructions as text).
`Artifact list` with `scope: "files"` shows 17 published files, and `read` with `paths` and
`out_dir` saves each at its published path under `out/2026-W40/imagenes/`:

```
out/2026-W40/imagenes/
  index.html                  33 KB  the canvas EDITOR shell. No artboard in it. Not usable for export.
  SKILL.md                           the type's instructions
  artifact-type/
    app.js  app.css                  the editor bundle (3.4 MB and 0.6 MB). Not needed.
    dc-runtime.js             188 KB React + ReactDOM + the Design Component runtime
    thumbnail/thumbnail.json
    reference/*.md                   nine reference pages. Not needed.
  project/
    canvas.json                      index: boards (x, y, w, h, title) and order
    Main.dc.html                     the artboard, whole source
```

One `.dc.html` per artboard under `project/`, listed in `project/canvas.json`. The artboard is
literal markup inside `<x-dc>`, not built by JavaScript from data: it renders as plain HTML
even without the runtime (the PNG was byte-identical with and without it). The runtime only
matters for `{{holes}}`, `<sc-for>`, `<sc-if>` and `<dc-import>`, which the plan does not use.
The multi-artboard layout (several `.dc.html` files) comes from the type's own instructions
and the shape of `canvas.json`; the spike had one board and did not exercise it.

### What the download does not carry

- **The logo and the fonts are not in the 17 files.** The type requires images and fonts to be
  uploaded as assets and referenced as `/_blob/<id>` (it forbids `data:` URIs and filenames), so
  the artboard HTML says `src="/_blob/4e5a..."` and `url(/_blob/c6d4...)`. Opened from disk, that
  path resolves to `file:///_blob/...` and fails **silently**: run on the raw download, the logo
  was a broken-image box, the text fell back to Helvetica, `document.fonts.ready` still
  resolved and a PNG was still produced. This amends the contract above: the assets are
  **not** reachable by relative path or embedded; the exporter has to map `/_blob/<id>` itself.
- **Assets are read separately.** `Artifact list` with `scope: "assets"` gives the ids.
  `Artifact read` with `paths` refuses an asset id ("no file is published at that path"); with
  `path` (singular) it works, one call per asset, and saves it at the root of `out_dir` as
  `<id>.<ext>` (`<id>.png`, `<id>.woff2`), not under `project/`.
- **`./support.js` is not published.** The artboard's head line points at it. The editor
  supplies it when it exports; the file that plays that role in the download is
  `artifact-type/dc-runtime.js`.

### What Task 3 (exporter) must know

1. Open the `project/**/*.dc.html` files (skip `project/ds/`, which the type writes only when a design system is installed), never `index.html`. Query
   `[data-slug]` in each and screenshot every match; do not derive the slug from the file name:
   the type wants the first artboard called `Main.dc.html`.
2. Resolve `/_blob/<id>`. Both ways below were run and gave byte-identical PNGs:
   (a) copy the HTML to a staging folder with each `/_blob/<32 hex>` rewritten to
   `assets/<id>.<ext>`, or (b) serve the folder unmodified from a small local HTTP server that
   maps `/_blob/<id>` to `<id>.*`. Fonts loaded fine from `file://`, with no browser flag.
   If a runtime is wanted, put `dc-runtime.js` next to the HTML as `support.js` (its relative
   `./support.js` resolves beside the artboard, i.e. `project/support.js`).
3. Fail loudly before the first screenshot. Because a missing asset renders "successfully":
   error if any `/_blob/<id>` in the HTML has no `<id>.*` on disk; and in the page, error unless
   every `document.fonts` entry has `status === 'loaded'`, every `<img>` has
   `complete && naturalWidth > 0`, and each `[data-slug]` is exactly 1920 x 1080.
4. Browser: the `chrome-headless-shell` under `video/node_modules/.remotion/` (set through
   `REMOTION_BROWSER_EXECUTABLE`) launches on macOS without `--no-sandbox`. Raw CDP works
   (`--remote-debugging-port=0`, Node's global `WebSocket`, `Emulation.setDeviceMetricsOverride`
   1920x1080 at scale 1, `Page.captureScreenshot` with `clip`). Kill the browser in a `finally`:
   a script that throws before `proc.kill()` leaves the process running.

### What the end-to-end run must know

- Upload the brand assets (the two logos, dark and light, plus the 500, 700 and 800 Montserrat
  files) to **each week's canvas**: they belong to one artifact. One `Artifact` publish with
  `asset: true` and `file_paths` uploads all five files (two logos, three fonts) in a single
  call; reference the returned `/_blob/<id>` verbatim.
  The tool also describes `from_url` with `asset_ids` to copy them from an earlier canvas
  (not tried here).
- After publishing, read back only what the exporter needs: `project/canvas.json`, every
  `project/*.dc.html` (one `paths` call), and each asset with `path`. Skip `index.html`,
  `app.js`, `app.css` and the reference pages; a plain `read` of the URL prints roughly ten
  thousand tokens of the type's instructions, so use `list` then `read` with `paths`.
- The type's own instructions say never to verify a canvas unless asked; this project does,
  by design, so the read-back is the flow, not a deviation.
- Delete `out/2026-W40/imagenes/` (the spike's download, git-ignored) before the first real run
  of that week, so a stale `bazar-del-libro` artboard cannot pass for a real one.
- The type release (`1790707925-3098`) and its contract (0.2.47, newest 0.2.66) can change the
  layout above; re-check it if the read-back stops matching.

### Write side (from Task 8)

Run on 2026-09-29 for 2026-W40 (nine artboards, private canvas
https://claude.ai/artifact/EaMu9pK3hzcA3GU2uoLoJY). The export passed on the first run. The calls,
in order:

1. `quickstart` with `intent: "design"`, `design_systems: false`: returns the Design type's `type_url`.
2. `publish` with that `type_url`, `title` (`IPUC semana 28 sep - 4 oct`),
   `auto_open: "after_first_write"`, and no files. This is SKILL step 5's "publish ... from the type"
   (confirmed). It creates the empty canvas and returns its `url` plus the type's instructions and
   `format.md`, so no separate read is needed.
3. `publish` with `url`, `asset: true`, `file_paths` holding both logos and the three Montserrat
   files: five uploads in one call, each returning `/_blob/<id>`. No `capabilities` and no skill had
   to be loaded; the canvas inherits `assets` from its type.
4. Write the files with the file tool under one scratch `<root>`: `project/canvas.json` first, with
   every board already in `boards` and `order`, then one `project/<name>.dc.html` per artboard
   (`Main.dc.html` for the first event, `<slug>.dc.html` for the rest).
5. `publish` with `url`, `root`, `file_path: <root>/project/canvas.json` and
   `files: {"project/Main.dc.html": "project/Main.dc.html"}`.
6. `publish` with `url`, `root`, `file_path` set to one remaining artboard and `files` holding the
   other seven. The type's `SKILL.md` asks for one call that sends every file. This run used two
   calls (`canvas.json` and `Main.dc.html` first, then the other artboards), and that worked too.
7. Read back as SKILL step 5 says: `list` (`files`), `read` (`paths`, `out_dir`) for `canvas.json`
   and the nine artboards (the result also prints each file's text in full), `list` (`assets`), then
   one `read` (`path`) per asset.

`canvas.json`: `"v": 3`, `"title"` (the canvas's name, `IPUC semana 28 sep - 4 oct`), `boards`
keyed by file name, each `{"x", "y", "w": 1920, "h": 1080, "title"}`, three per row at x 0, 2000
and 4000 and rows at y 0, 1200 and 2400 (80 px between frames, 120 between rows), `order`, the
array of the same file names as `boards` in reading order, plus `"launch": {"view": "canvas"}`,
`"pages": []`, `"notes": {}`, `"designSystems": []` and `"createdOnFiles": {"v": 1, "at": "<now>"}`.

A minimal artboard (the `/_blob` ids are the ones step 3 returned):

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Bazar del libro</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
@font-face{font-family:'Montserrat';font-weight:500;font-style:normal;src:url(/_blob/<id-500>) format('woff2')}
@font-face{font-family:'Montserrat';font-weight:700;font-style:normal;src:url(/_blob/<id-700>) format('woff2')}
@font-face{font-family:'Montserrat';font-weight:800;font-style:normal;src:url(/_blob/<id-800>) format('woff2')}
body{margin:0}
</style>
</helmet>
<div data-slug="bazar-del-libro" style="position: relative; width: 1920px; height: 1080px; overflow: hidden; background: #4A1A8C; color: #FFFFFF; font-family: 'Montserrat', sans-serif">
<div style="font-weight: 800; font-size: 300px">Bazar</div>
<div style="position: absolute; right: 120px; top: 110px; padding: 28px; background: #FFFFFF; border-radius: 24px">
<img src="/_blob/<id-logo-claro>" alt="" style="display: block; width: 280px; height: 194px">
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1920,"height":1080}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
```

What held, and what bit:

- All markup is static: no `{{holes}}`, `<sc-for>`, `<sc-if>` or `<dc-import>`. So the missing
  `support.js` does not change the export.
- Shapes are plain `div`s, CSS gradients and inline `<svg>` polygons with no `<text>`. `url(...)`
  goes only in `<helmet><style>`, because the type forbids it in inline styles. The logo takes
  `alt=""`, which only matters for a broken image, and `imagen-rota` catches that first:
  `innerText` never includes alt text, so the audit is the same either way.
- The logo is 2363 x 1638, a ratio of about 1.443:1. W40 drew it at 300 x 208 (and 280 x 194);
  keep the ratio at any size.
- The audit reads `innerText`, which still includes text drawn past its box. A time set too large
  for its tile ("10:30 a. m." at 150 px) spilled outside the tile, onto a background of its own
  colour. The image read "0:30 a. m", yet the audit passed. The export now refuses this
  (`texto-desbordado`, above); still keep `white-space: nowrap` on times and dates and look at
  every image.
- To iterate before publishing, point `exportStills` (`scripts/core/export-stills.mjs`) at a scratch
  copy of `project/` with the assets saved as `<id>.<ext>`, and set its `salida` to write into the
  scratchpad, not `out/`. The images exported from the real read-back were byte-identical to those
  previews.
