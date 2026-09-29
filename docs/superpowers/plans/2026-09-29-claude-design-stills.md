# Event images from Claude Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each event's `ad.png` comes from a weekly Claude Design canvas (one artboard per event, a color per kind of event) instead of a Remotion frame, while the video stays on Remotion.

**Architecture:** The orchestrator builds one private Design artifact per week and reads its published HTML back to `out/<week>/imagenes/`. A new script drives the project's own headless Chromium over the DevTools protocol (Node built-ins only): it extracts each artboard's visible text, audits it against `events.json`, then screenshots each `[data-slug]` element to `out/<week>/<slug>/ad.png`. `render.mjs` keeps producing the video and writes its frame to `fotograma.png`.

**Tech Stack:** Node 22+ ESM (`node:test`, global `WebSocket`, `child_process`), Remotion 4.0.526's downloaded `chrome-headless-shell`, the `Artifact` tool with the Design type.

**Spec:** `docs/superpowers/specs/2026-09-29-claude-design-stills-design.md`

## Global Constraints

- Scripts use Node built-ins only. No new dependency in the repo (there is no root `package.json`; `video/` owns the Remotion packages).
- Every image is 16:9, exactly 1920x1080 (`CLAUDE.md` rule 3).
- Never invent an event fact: an artboard may show only `titulo`, `ministerio`, `fechaTexto`, `horaTexto` (if the event has a time), `lugar` (only if it differs from `iglesia.lugarPorDefecto`) and `iglesia.llamadoAccion`.
- The church name reaches the screen only through the logo image; an artboard never types it.
- Work on `scripts/` is test-first: `node --test scripts/test/*.test.mjs` (use the glob).
- Tests and fixtures use the fictional church "Iglesia Ejemplo"; no real congregation's name.
- Do not use the account's default Claude Design system (Wasapi's). Pass `design_systems: false` to the quickstart.
- Never name a directory `lib` (the `.gitignore` is the Python template and ignores it).
- Generated output lives in `out/<YYYY>-W<NN>/`, is git-ignored and is never edited by hand.
- Do not commit on `main`. Work on the branch `feature/claude-design-stills`.
- Commit with `git -c user.name=Claude -c user.email=noreply@anthropic.com commit ...`, ending every message with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run `node` from the repo root. If `node` is not on the PATH, use the one the shell already provides (`which node`).
- Never render a Remotion composition while a step of this plan is exporting: rendering is serialized by the orchestrator (`CLAUDE.md` rule 4).
- All docs and code comments are in English, except `README.md`, which is in Spanish.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/core/still-source.mjs` (create) | Pure audit: `checkStillText(tableros, doc)` compares each artboard's visible text with the record. |
| `scripts/core/cdp.mjs` (create) | `resolveBrowser()` finds the headless shell; `openPage(executable)` launches it and returns a tiny page driver (`navigate`, `evaluate`, `screenshot`, `close`). |
| `scripts/core/export-stills.mjs` (create) | `exportStills({htmlPath, doc, salida, slugs})`: opens the HTML, reads the artboards, audits, screenshots. No paths of the repo baked in. |
| `scripts/export-stills.mjs` (create) | Thin CLI: `node scripts/export-stills.mjs <week> [slug ...]`. |
| `scripts/test/still-source.test.mjs` (create) | Unit tests of the audit. |
| `scripts/test/export-stills.test.mjs` (create) | Exporter test against a fixture HTML; skipped when no browser is available. |
| `scripts/test/fixtures/stills-ejemplo.html` (create) | Fixture with two artboards, the second below the fold. |
| `scripts/render.mjs` (modify) | Writes the Remotion frame as `fotograma.png`. |
| `brand/paletas-imagen.md` (create) | Free text: palette per kind of event and the brief for Claude Design. |
| `CLAUDE.md`, `PLAN.md`, `README.md`, `.claude/skills/church-ads/SKILL.md`, `brand/corporate-brand.md` (modify) | Rules and flow updated. |

The audit is a separate pure function because reading the text needs a browser and the rules do not.

---

### Task 1: Spike, can a Design canvas be read back and photographed?

This decides go or no-go for everything after it. Nothing here is kept unless it passes.

**Files:**
- Create (untracked, deleted at the end): `scripts/.spike-cdp.mjs`
- Modify (only at the end): `docs/superpowers/specs/2026-09-29-claude-design-stills-design.md` (append a "Spike result" section)

**Interfaces:**
- Consumes: the `Artifact` tool (Design type), the logo `brand/logo/IPUC_COLOR para fondo oscuro.png`, the fonts under `video/public/brand/fonts/` (find the real path with `ls video/public/brand/fonts`).
- Produces: a go/no-go, and the two facts Task 3 and Task 7 rely on: (1) the layout of the files `Artifact read` writes to disk, (2) whether the artboards can be selected by `data-slug`.

- [ ] **Step 1: Create the branch**

```bash
git switch -c feature/claude-design-stills
```

Expected: `Switched to a new branch 'feature/claude-design-stills'`. Leave the untracked `scripts/setup-cloud.sh` and `docs/` files alone.

- [ ] **Step 2: Start the Design artifact**

Call `Artifact` with `action: "quickstart"`, `intent: "design"`, `design_systems: false`. Then publish with the `type_url` it returns, `title: "IPUC prueba imagen"`, no files, `auto_open: "after_first_write"`. Read the type's instructions in the result and follow them for how to add artboards.

- [ ] **Step 3: Add one artboard for the bazar**

Inside the canvas, add one artboard 1920x1080 that:
- has `data-slug="bazar-del-libro"` on its root element,
- uses a violet field (the "Jóvenes" palette of `brand/paletas-imagen.md`, or any violet for the spike),
- shows the logo `IPUC_COLOR para fondo oscuro.png` on a flat panel, the title `Bazar del libro`, the small line `Jóvenes`, the date `domingo 4 de octubre` and `Te esperamos`,
- uses the vendored Montserrat font (embedded, or by relative path if the type allows it).

Publish it. Record the URL.

- [ ] **Step 4: Read it back to disk**

Call `Artifact` with `action: "read"` and the URL, then `action: "list"` with `scope: "files"` and read every published file with `path`/`paths` into `out/2026-W40/imagenes/`. Run:

```bash
ls -R out/2026-W40/imagenes | head -40
```

Write down what is on disk: is there one HTML file or several? Where are the logo and the fonts? Is the artboard's HTML in the file, or does the page build it with JavaScript from data?

- [ ] **Step 5: Write the throwaway screenshot script**

Create `scripts/.spike-cdp.mjs`:

```js
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.REMOTION_BROWSER_EXECUTABLE;
const html = resolve(process.argv[2]);
if (!exe) throw new Error('set REMOTION_BROWSER_EXECUTABLE to the chrome-headless-shell path');
const proc = spawn(exe, ['--headless', '--remote-debugging-port=0', '--user-data-dir=/tmp/spike-cdp-profile', '--hide-scrollbars', '--force-color-profile=srgb', '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
  proc.on('exit', () => rej(new Error(`browser exited: ${buf}`)));
  setTimeout(() => rej(new Error(`timeout: ${buf}`)), 15000);
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const waiters = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  else if (m.method) waiters.slice().forEach((w) => w(m));
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const cmd = (m, p) => send(m, p, sessionId);
await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const loaded = new Promise((r) => { const w = (m) => { if (m.method === 'Page.loadEventFired') { waiters.splice(waiters.indexOf(w), 1); r(); } }; waiters.push(w); });
await cmd('Page.navigate', { url: `file://${html}` });
await loaded;
const ev = async (expression) => { const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
await ev('document.fonts.ready.then(() => true)');
const boards = await ev(`[...document.querySelectorAll('[data-slug]')].map((el) => { const r = el.getBoundingClientRect(); return { slug: el.dataset.slug, x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, text: el.innerText }; })`);
console.log(JSON.stringify(boards, null, 2));
for (const b of boards) {
  const shot = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: b.x, y: b.y, width: b.width, height: b.height, scale: 1 }, captureBeyondViewport: true });
  writeFileSync(`/tmp/spike-${b.slug}.png`, Buffer.from(shot.data, 'base64'));
}
ws.close();
proc.kill();
```

- [ ] **Step 6: Run it on the downloaded canvas**

Use the browser that is already installed, so nothing is downloaded:

```bash
REMOTION_BROWSER_EXECUTABLE="$PWD/video/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell" node scripts/.spike-cdp.mjs out/2026-W40/imagenes/<the html file from step 4>
```

Expected: a JSON array with one entry `bazar-del-libro`, `width: 1920`, `height: 1080`, and `/tmp/spike-bazar-del-libro.png` on disk. Open the PNG with the Read tool.

- [ ] **Step 7: Decide**

Go only if all of these hold: the PNG is exactly 1920x1080; Montserrat and the logo render correctly; there is no canvas interface around the artboard; `innerText` of the artboard equals what step 3 put on it. Otherwise stop and report to the user which check failed. The likely fallback is option C of the spec (keep Remotion for images and add per-kind palettes and compositions), which needs a new spec.

- [ ] **Step 8: Clean up and record the result**

```bash
rm scripts/.spike-cdp.mjs /tmp/spike-bazar-del-libro.png
```

Append to the spec a section `## Spike result` with the date, go or no-go, the layout of the files `Artifact read` wrote, and the selector that works. Delete the throwaway artifact only if the user asks (deleting an artifact is theirs to confirm).

- [ ] **Step 9: Commit the spec update**

```bash
git add docs/superpowers/specs/2026-09-29-claude-design-stills-design.md docs/superpowers/plans/2026-09-29-claude-design-stills.md
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -m "docs: spec, plan and spike result for event images from Claude Design

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The audit of an artboard's text

**Files:**
- Create: `scripts/core/still-source.mjs`
- Test: `scripts/test/still-source.test.mjs`

**Interfaces:**
- Consumes: `stripAccents` from `scripts/core/spanish.mjs` (`(s: string) => string`).
- Produces: `checkStillText(tableros, doc)`.
  - `tableros: Array<{slug: string, text: string}>`: the visible text of each artboard.
  - `doc`: the `events.json` object; uses `doc.iglesia.{nombre, lugarPorDefecto, llamadoAccion}` and, per event, `slug, titulo, ministerio, fechaTexto, horaTexto, lugar`.
  - Returns `{errores: Array<{regla: string, slug?: string, mensaje: string}>, avisos: []}`. Rules: `token-ajeno`, `nombre-en-texto`, `artboard-faltante`, `artboard-sobrante`, `artboard-duplicado`. Same result shape as `checkAdSource` and `auditEvents`, so `printIssues` works on it.

- [ ] **Step 1: Write the failing tests**

Create `scripts/test/still-source.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStillText } from '../core/still-source.mjs';

const IGLESIA = { nombre: 'Iglesia Ejemplo', lugarPorDefecto: 'Templo', llamadoAccion: 'Te esperamos' };
const CULTO = { slug: 'culto-jovenes', titulo: 'Culto de jóvenes', ministerio: 'Jóvenes', fechaTexto: 'viernes 3 de octubre', horaTexto: '7:00 p. m.', lugar: 'Templo' };
const RETIRO = { slug: 'retiro-familias', titulo: 'Retiro de familias', ministerio: null, fechaTexto: 'sábado 4 de octubre', horaTexto: null, lugar: 'Salón Principal' };
const DOC = { iglesia: IGLESIA, events: [CULTO, RETIRO] };

const BUENO = [
  { slug: 'culto-jovenes', text: 'JÓVENES\nCULTO DE JÓVENES\nViernes 3 de octubre\n7:00 p. m.\nTe esperamos' },
  { slug: 'retiro-familias', text: 'Retiro\nde familias\nSábado 4 de octubre\nSalón Principal' },
];
const reglas = (tableros, doc = DOC) => checkStillText(tableros, doc).errores.map((e) => e.regla);

test('artboards that show only the record pass, whatever their case, accents or line breaks', () => {
  assert.deepEqual(reglas(BUENO), []);
  assert.deepEqual(reglas([{ slug: 'culto-jovenes', text: 'culto de jovenes viernes 3 de octubre 7:00 p. m.' }, BUENO[1]]), []);
});

test('an invented time is an error that names the token', () => {
  const r = checkStillText([{ ...BUENO[0], text: `${BUENO[0].text}\n8:30 p. m.` }, BUENO[1]], DOC);
  assert.deepEqual(r.errores.map((e) => e.regla), ['token-ajeno']);
  assert.equal(r.errores[0].slug, 'culto-jovenes');
  assert.match(r.errores[0].mensaje, /"8"/);
});

test('a time on an event that has none is an error', () => {
  assert.deepEqual(reglas([BUENO[0], { ...BUENO[1], text: `${BUENO[1].text}\n7:00 p. m.` }]), ['token-ajeno']);
});

test('invented copy is an error', () => {
  assert.deepEqual(reglas([{ ...BUENO[0], text: `${BUENO[0].text}\nTrae tu Biblia` }, BUENO[1]]), ['token-ajeno']);
});

test('the default place may not be shown, a different place may', () => {
  assert.deepEqual(reglas([{ ...BUENO[0], text: `${BUENO[0].text}\nTemplo` }, BUENO[1]]), ['token-ajeno']);
  assert.deepEqual(reglas(BUENO), []);
});

test('the call to action is allowed only when the church has one', () => {
  const sin = { ...DOC, iglesia: { ...IGLESIA, llamadoAccion: null } };
  assert.deepEqual(reglas(BUENO, sin), ['token-ajeno']);
});

test('the church name typed on an artboard is one error, not a list of foreign words', () => {
  const r = checkStillText([{ ...BUENO[0], text: `${BUENO[0].text}\nIGLESIA EJEMPLO` }, BUENO[1]], DOC);
  assert.deepEqual(r.errores.map((e) => e.regla), ['nombre-en-texto']);
});

test('a missing, an extra and a duplicated artboard are errors', () => {
  assert.deepEqual(reglas([BUENO[0]]), ['artboard-faltante']);
  assert.deepEqual(reglas([...BUENO, { slug: 'otro', text: 'Otro' }]), ['artboard-sobrante']);
  assert.deepEqual(reglas([...BUENO, BUENO[1]]), ['artboard-duplicado']);
});

test('findings carry the slug, and a clean week has no notices', () => {
  const r = checkStillText([BUENO[0]], DOC);
  assert.equal(r.errores[0].slug, 'retiro-familias');
  assert.deepEqual(r.avisos, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/test/still-source.test.mjs`
Expected: FAIL, `Cannot find module '../core/still-source.mjs'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/core/still-source.mjs`:

```js
// Audit of the Claude Design artboards against events.json. The visible text of an
// artboard may only be made of words the event's record already has: its title,
// ministry, date, time (if any), place (if not the default one) and the church's call
// to action. Anything else is an invented fact, and in a church ad a wrong time or place
// sends real people to a locked door. Like the narration check, this is a net, not
// proof: the orchestrator still looks at every image.

import { stripAccents } from './spanish.mjs';

/** Lowercase, accent-free words and numbers, punctuation dropped. */
const tokens = (texto) =>
  stripAccents(texto ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const mismoTexto = (a, b) => stripAccents(a.trim()).toLowerCase() === stripAccents(b.trim()).toLowerCase();

/** The words an event's artboard may show. */
function permitidos(evento, iglesia) {
  const lugarNuevo = evento.lugar && !(iglesia.lugarPorDefecto && mismoTexto(evento.lugar, iglesia.lugarPorDefecto));
  return new Set(
    [evento.titulo, evento.ministerio, evento.fechaTexto, evento.horaTexto, lugarNuevo ? evento.lugar : null, iglesia.llamadoAccion].flatMap(tokens),
  );
}

/** `secuencia` appears in `lista` as consecutive items; returns the copy of `lista` without its first occurrence, or null. */
function quitarSecuencia(lista, secuencia) {
  if (!secuencia.length) return null;
  for (let i = 0; i + secuencia.length <= lista.length; i++) {
    if (secuencia.every((t, j) => lista[i + j] === t)) return [...lista.slice(0, i), ...lista.slice(i + secuencia.length)];
  }
  return null;
}

/**
 * @param {Array<{slug: string, text: string}>} tableros visible text of each artboard
 * @param {{iglesia?: object, events: object[]}} doc events.json
 */
export function checkStillText(tableros, doc) {
  const errores = [];
  const iglesia = doc.iglesia ?? {};
  const eventos = new Map(doc.events.map((e) => [e.slug, e]));

  const vistos = new Set();
  for (const t of tableros) {
    if (vistos.has(t.slug)) errores.push({ regla: 'artboard-duplicado', slug: t.slug, mensaje: `two artboards have the slug "${t.slug}"` });
    vistos.add(t.slug);
  }
  for (const e of doc.events) {
    if (!vistos.has(e.slug)) errores.push({ regla: 'artboard-faltante', slug: e.slug, mensaje: 'the canvas has no artboard for this event' });
  }

  const revisados = new Set();
  for (const t of tableros) {
    if (revisados.has(t.slug)) continue;
    revisados.add(t.slug);
    const evento = eventos.get(t.slug);
    if (!evento) {
      errores.push({ regla: 'artboard-sobrante', slug: t.slug, mensaje: `the artboard "${t.slug}" is not an event of this week` });
      continue;
    }
    let palabras = tokens(t.text);
    const sinNombre = quitarSecuencia(palabras, tokens(iglesia.nombre));
    if (sinNombre) {
      errores.push({ regla: 'nombre-en-texto', slug: t.slug, mensaje: 'the church name is typed on the artboard; the logo carries it, never type it' });
      palabras = sinNombre;
    }
    const ok = permitidos(evento, iglesia);
    const ajenas = [...new Set(palabras.filter((p) => !ok.has(p)))];
    if (ajenas.length) {
      errores.push({ regla: 'token-ajeno', slug: t.slug, mensaje: `text that is not in the event's record: ${ajenas.map((p) => `"${p}"`).join(', ')}` });
    }
  }
  return { errores, avisos: [] };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/test/still-source.test.mjs`
Expected: 9 tests pass, 0 fail.

- [ ] **Step 5: Run the whole suite**

Run: `node --test scripts/test/*.test.mjs`
Expected: all pass (the existing tests plus the 9 new).

- [ ] **Step 6: Commit**

```bash
git add scripts/core/still-source.mjs scripts/test/still-source.test.mjs
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -m "feat: audit the text of Claude Design artboards against events.json

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Browser driver and exporter

**Files:**
- Create: `scripts/core/cdp.mjs`, `scripts/core/export-stills.mjs`, `scripts/export-stills.mjs`
- Create: `scripts/test/fixtures/stills-ejemplo.html`
- Test: `scripts/test/export-stills.test.mjs`

**Interfaces:**
- Consumes: `checkStillText(tableros, doc)` from Task 2; `ROOT`, `weekDir`, `parseArgs`, `printIssues` from `scripts/core/project.mjs`.
- Produces:
  - `resolveBrowser(): Promise<string>`: `REMOTION_BROWSER_EXECUTABLE` if set, else the first `chrome-headless-shell` under `video/node_modules/.remotion/chrome-headless-shell/*/*/`, else throws an `Error` whose message says how to set the variable (it never downloads).
  - `openPage(executable): Promise<{navigate(url): Promise<void>, evaluate(expression): Promise<any>, screenshot(clip): Promise<Buffer>, close(): Promise<void>}>`. `clip` is `{x, y, width, height}`; the PNG is 1:1 (`scale: 1`).
  - `exportStills({htmlPath, doc, salida, slugs, executable}): Promise<{errores, avisos, escritos: string[]}>`. `salida(slug)` returns the PNG path for a slug. `slugs` is an optional list to export (empty or missing: all). Nothing is written when the audit has errors or an artboard is not 1920x1080.

- [ ] **Step 1: Write the fixture**

Create `scripts/test/fixtures/stills-ejemplo.html`:

```html
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
body { margin: 0; background: #222; }
.ab { width: 1920px; height: 1080px; position: relative; overflow: hidden; margin-bottom: 40px; color: #fff; font: 700 120px sans-serif; }
</style></head><body>
<div class="ab" data-slug="culto-jovenes" style="background: #7a2bd6">
  <span style="text-transform: uppercase">Culto de jóvenes</span>
  <p style="font-size: 60px">Viernes 3 de octubre · 7:00 p. m.</p>
</div>
<div class="ab" data-slug="retiro-familias" style="background: #0a7d6e">
  <span>Retiro de familias</span>
  <p style="font-size: 60px">Sábado 4 de octubre</p>
</div>
</body></html>
```

- [ ] **Step 2: Write the failing test**

Create `scripts/test/export-stills.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportStills } from '../core/export-stills.mjs';
import { resolveBrowser } from '../core/cdp.mjs';

const HTML = fileURLToPath(new URL('./fixtures/stills-ejemplo.html', import.meta.url));
const IGLESIA = { nombre: 'Iglesia Ejemplo', lugarPorDefecto: 'Templo', llamadoAccion: null };
const CULTO = { slug: 'culto-jovenes', titulo: 'Culto de jóvenes', ministerio: null, fechaTexto: 'viernes 3 de octubre', horaTexto: '7:00 p. m.', lugar: null };
const RETIRO = { slug: 'retiro-familias', titulo: 'Retiro de familias', ministerio: null, fechaTexto: 'sábado 4 de octubre', horaTexto: null, lugar: null };
const DOC = { iglesia: IGLESIA, events: [CULTO, RETIRO] };

let executable = null;
try {
  executable = await resolveBrowser();
} catch {
  // no browser here: the tests that need one are skipped
}
const sinNavegador = executable ? false : 'no headless browser available (set REMOTION_BROWSER_EXECUTABLE)';

const pngSize = (path) => {
  const b = readFileSync(path);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};
const carpeta = () => mkdtempSync(join(tmpdir(), 'stills-'));

test('every artboard becomes a 1920x1080 png, even the one below the fold', { skip: sinNavegador }, async () => {
  const dir = carpeta();
  try {
    const r = await exportStills({ htmlPath: HTML, doc: DOC, salida: (slug) => join(dir, `${slug}.png`), executable });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.escritos.map((p) => p.split('/').pop()).sort(), ['culto-jovenes.png', 'retiro-familias.png']);
    for (const p of r.escritos) assert.deepEqual(pngSize(p), { width: 1920, height: 1080 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('only the requested slugs are exported', { skip: sinNavegador }, async () => {
  const dir = carpeta();
  try {
    const r = await exportStills({ htmlPath: HTML, doc: DOC, slugs: ['retiro-familias'], salida: (slug) => join(dir, `${slug}.png`), executable });
    assert.deepEqual(r.errores, []);
    assert.equal(existsSync(join(dir, 'retiro-familias.png')), true);
    assert.equal(existsSync(join(dir, 'culto-jovenes.png')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an audit error writes nothing', { skip: sinNavegador }, async () => {
  const dir = carpeta();
  try {
    const doc = { ...DOC, events: [{ ...CULTO, horaTexto: '8:00 p. m.' }, RETIRO] };
    const r = await exportStills({ htmlPath: HTML, doc, salida: (slug) => join(dir, `${slug}.png`), executable });
    assert.deepEqual(r.errores.map((e) => e.regla), ['token-ajeno']);
    assert.deepEqual(r.escritos, []);
    assert.equal(existsSync(join(dir, 'culto-jovenes.png')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveBrowser explains how to set the browser when there is none', async () => {
  const antes = process.env.REMOTION_BROWSER_EXECUTABLE;
  process.env.REMOTION_BROWSER_EXECUTABLE = '/no/such/browser';
  try {
    await assert.rejects(() => resolveBrowser(), /REMOTION_BROWSER_EXECUTABLE/);
  } finally {
    if (antes === undefined) delete process.env.REMOTION_BROWSER_EXECUTABLE;
    else process.env.REMOTION_BROWSER_EXECUTABLE = antes;
  }
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test scripts/test/export-stills.test.mjs`
Expected: FAIL, `Cannot find module '../core/export-stills.mjs'`.

- [ ] **Step 4: Write the browser driver**

Create `scripts/core/cdp.mjs`:

```js
// A tiny page driver over the Chrome DevTools protocol, using only Node built-ins
// (child_process and the global WebSocket) and the headless Chromium Remotion already
// downloaded for the video, so exporting an image adds no dependency and downloads nothing.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './project.mjs';

/** The browser to use: the one the environment names, else Remotion's local headless shell. Never downloads. */
export async function resolveBrowser() {
  const elegido = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (elegido) {
    if (existsSync(elegido)) return elegido;
    throw new Error(`REMOTION_BROWSER_EXECUTABLE points to ${elegido}, which does not exist`);
  }
  const base = join(ROOT, 'video', 'node_modules', '.remotion', 'chrome-headless-shell');
  if (existsSync(base)) {
    for (const plataforma of readdirSync(base)) {
      const raiz = join(base, plataforma);
      for (const version of readdirSync(raiz)) {
        const candidato = join(raiz, version, 'chrome-headless-shell');
        if (existsSync(candidato)) return candidato;
      }
    }
  }
  throw new Error('no headless Chromium found: render a week once so Remotion downloads it, or set REMOTION_BROWSER_EXECUTABLE to a chrome-headless-shell path');
}

/** Launches the browser and returns a driver for one 1920x1080 page. Call `close()` when done. */
export async function openPage(executable) {
  const perfil = mkdtempSync(join(tmpdir(), 'cdp-profile-'));
  const proc = spawn(
    executable,
    ['--headless', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--hide-scrollbars', '--force-color-profile=srgb', '--no-first-run', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const cerrar = () => {
    proc.kill();
    rmSync(perfil, { recursive: true, force: true });
  };
  let ws;
  try {
    const wsUrl = await new Promise((res, rej) => {
      let buf = '';
      proc.stderr.on('data', (d) => {
        buf += d;
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) res(m[1]);
      });
      proc.on('exit', () => rej(new Error(`the browser exited: ${buf.trim()}`)));
      setTimeout(() => rej(new Error(`the browser did not start in time: ${buf.trim()}`)), 15000);
    });
    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', () => rej(new Error('could not connect to the browser')));
    });
  } catch (err) {
    cerrar();
    throw err;
  }

  let id = 0;
  const pendientes = new Map();
  const oyentes = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) {
      const { res, rej } = pendientes.get(m.id);
      pendientes.delete(m.id);
      if (m.error) rej(new Error(m.error.message));
      else res(m.result);
    } else if (m.method) {
      for (const oyente of oyentes.slice()) oyente(m);
    }
  });
  const enviar = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const i = ++id;
      pendientes.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });

  const { targetId } = await enviar('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
  const cmd = (method, params) => enviar(method, params, sessionId);
  await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  return {
    async navigate(url) {
      const cargada = new Promise((res) => {
        const oyente = (m) => {
          if (m.method === 'Page.loadEventFired') {
            oyentes.splice(oyentes.indexOf(oyente), 1);
            res();
          }
        };
        oyentes.push(oyente);
      });
      await cmd('Page.navigate', { url });
      await cargada;
    },
    async evaluate(expression) {
      const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`the page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    },
    async screenshot({ x, y, width, height }) {
      const r = await cmd('Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 1 }, captureBeyondViewport: true });
      return Buffer.from(r.data, 'base64');
    },
    async close() {
      ws.close();
      cerrar();
    },
  };
}
```

- [ ] **Step 5: Write the exporter core**

Create `scripts/core/export-stills.mjs`:

```js
// Photographs each Claude Design artboard ([data-slug]) of a downloaded canvas into a
// 1920x1080 png. The artboards' visible text is audited against events.json first
// (core/still-source.mjs); with any error, or an artboard of the wrong size, nothing is written.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkStillText } from './still-source.mjs';
import { openPage } from './cdp.mjs';

const ANCHO = 1920;
const ALTO = 1080;

const LEER_TABLEROS = `(async () => {
  await document.fonts.ready;
  return [...document.querySelectorAll('[data-slug]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { slug: el.dataset.slug, text: el.innerText, x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
  });
})()`;

/**
 * @param {{htmlPath: string, doc: object, salida: (slug: string) => string, slugs?: string[], executable: string}} opciones
 * @returns {Promise<{errores: object[], avisos: object[], escritos: string[]}>}
 */
export async function exportStills({ htmlPath, doc, salida, slugs = [], executable }) {
  const pagina = await openPage(executable);
  try {
    await pagina.navigate(pathToFileURL(htmlPath).href);
    const tableros = await pagina.evaluate(LEER_TABLEROS);
    const { errores, avisos } = checkStillText(
      tableros.map(({ slug, text }) => ({ slug, text })),
      doc,
    );
    for (const t of tableros) {
      if (t.width !== ANCHO || t.height !== ALTO) {
        errores.push({ regla: 'tamano-artboard', slug: t.slug, mensaje: `the artboard is ${t.width}x${t.height}, it must be exactly ${ANCHO}x${ALTO}` });
      }
    }
    if (errores.length) return { errores, avisos, escritos: [] };

    const escritos = [];
    for (const t of tableros) {
      if (slugs.length && !slugs.includes(t.slug)) continue;
      const png = await pagina.screenshot(t);
      const destino = salida(t.slug);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, png);
      escritos.push(destino);
    }
    return { errores, avisos, escritos };
  } finally {
    await pagina.close();
  }
}
```

- [ ] **Step 6: Run the exporter tests to verify they pass**

Run: `node --test scripts/test/export-stills.test.mjs`
Expected: 4 tests pass (the three browser tests run when the headless shell is installed at `video/node_modules/.remotion/`, otherwise they are reported as skipped and the fourth still passes).

- [ ] **Step 7: Write the CLI**

Create `scripts/export-stills.mjs`:

```js
#!/usr/bin/env node
// Turns the week's Claude Design canvas into one ad.png per event.
//
//   node scripts/export-stills.mjs <week> [slug ...] [--html path]
//
// Reads out/<week>/events.json and the canvas downloaded to out/<week>/imagenes/
// (index.html unless --html says otherwise), audits every artboard's text against the
// record, and photographs each [data-slug] element to out/<week>/<slug>/ad.png. With slugs
// only those are written. Rendering is CPU-bound: run it alone, never next to a Remotion render.
// Exit 0: done. Exit 1: usage or missing input. Exit 2: the audit found errors, nothing written.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs, printIssues, weekDir } from './core/project.mjs';
import { resolveBrowser } from './core/cdp.mjs';
import { exportStills } from './core/export-stills.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const [week, ...slugs] = positional;
if (!week) {
  console.error('usage: node scripts/export-stills.mjs <week> [slug ...] [--html path]');
  process.exit(1);
}
const carpeta = weekDir(week);
const eventsPath = join(carpeta, 'events.json');
if (!existsSync(eventsPath)) {
  console.error(`${eventsPath} not found. Run scripts/normalize.mjs first.`);
  process.exit(1);
}
const htmlPath = flags.html && flags.html !== true ? resolve(flags.html) : join(carpeta, 'imagenes', 'index.html');
if (!existsSync(htmlPath)) {
  console.error(`${htmlPath} not found. Publish the week's canvas and read it back to out/${week}/imagenes/ first.`);
  process.exit(1);
}
const doc = JSON.parse(readFileSync(eventsPath, 'utf8'));

let executable;
try {
  executable = await resolveBrowser();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const { errores, avisos, escritos } = await exportStills({ htmlPath, doc, slugs, salida: (slug) => join(carpeta, slug, 'ad.png'), executable });
printIssues({ errores, avisos });
if (errores.length) {
  console.error(`${errores.length} error(s): nothing was exported. Fix the canvas and run it again.`);
  process.exit(2);
}
for (const p of escritos) console.log(`wrote ${p}`);
console.log(`${escritos.length} image(s) in ${carpeta}.`);
```

- [ ] **Step 8: Smoke-test the CLI's usage errors**

Run: `node scripts/export-stills.mjs; echo "exit=$?"`
Expected: `usage: node scripts/export-stills.mjs <week> [slug ...] [--html path]` and `exit=1`.

Run: `node scripts/export-stills.mjs 2026-W40 --html /no/such.html; echo "exit=$?"`
Expected: a `not found` message and `exit=1`.

- [ ] **Step 9: Run the whole suite**

Run: `node --test scripts/test/*.test.mjs`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add scripts/core/cdp.mjs scripts/core/export-stills.mjs scripts/export-stills.mjs scripts/test/export-stills.test.mjs scripts/test/fixtures/stills-ejemplo.html
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -m "feat: export Claude Design artboards to ad.png with the project's Chromium

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The Remotion frame stops being `ad.png`

**Files:**
- Modify: `scripts/render.mjs` (header comment, and the `renderStill` output at `output: join(carpeta, 'ad.png')`)

**Interfaces:**
- Consumes: nothing new.
- Produces: per event `out/<week>/<slug>/fotograma.png` from `render.mjs`; `ad.png` is written only by `export-stills.mjs`.

- [ ] **Step 1: Change the still's file name and the header**

In `scripts/render.mjs`, replace the first two comment lines

```js
// Renders a week: per event an ad.png and a clip.mp4, then the combined semana.mp4.
```

with

```js
// Renders a week: per event a clip.mp4 and a fotograma.png (a frame of the clip, only to
// check the video; the event's image is ad.png, exported from the Claude Design canvas by
// scripts/export-stills.mjs), then the combined semana.mp4.
```

and replace

```js
      output: join(carpeta, 'ad.png'),
```

with

```js
      output: join(carpeta, 'fotograma.png'),
```

- [ ] **Step 2: Check nothing else reads the old name**

Run: `grep -rn "ad\.png" scripts video/src --include=*.mjs --include=*.ts --include=*.tsx`
Expected: only matches in `scripts/export-stills.mjs` and `scripts/core/`/`scripts/test/` files written in Task 3 (no match in `render.mjs`).

- [ ] **Step 3: Run the suite**

Run: `node --test scripts/test/*.test.mjs`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/render.mjs
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -m "refactor: render.mjs writes fotograma.png; ad.png comes from the canvas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Palettes and the brief for Claude Design

**Files:**
- Create: `brand/paletas-imagen.md`

**Interfaces:**
- Consumes: the spike's findings on how artboards must be built (Task 1 result section).
- Produces: the file the orchestrator reads before building a week's canvas. Free text: no code parses it.

- [ ] **Step 1: Write the file**

Create `brand/paletas-imagen.md`:

```markdown
# Palettes for the event images

The event images (`out/<week>/<slug>/ad.png`) are made in Claude Design, one artboard per
event, and may leave the IPUC manual's palette: each kind of event has its own color, the
same every week. The video does not: `clip.mp4` and `semana.mp4` keep the manual's palette
from `video/src/brand/tokens.ts`. This file is free text read by the orchestrator; no code
parses it, so edit it in plain words.

## Which palette an event gets

By the event's ministry when it has one, else by the words of its title, else the default.
An event that fits two kinds takes its ministry's kind, otherwise the first row it matches
in the table's order. The final report says which kind each event took.

| Kind | When | Field | Accent |
|---|---|---|---|
| Jóvenes | ministry Jóvenes or Adolescentes; title says jóvenes, juvenil or adolescentes | violet | gold |
| Damas | ministry Damas Dorcas; title says damas | magenta | cream |
| Evangelismo | ministry Evangelismo; title says evangelístico, evangelismo or campaña | amber | navy |
| Enseñanza | title says oración, enseñanza or escuela dominical | teal | white |
| Ayuno | title says ayuno | deep indigo | muted gold |
| General | everything else | IPUC blue `#00338D` | cyan `#009FDA` |

Pick the exact shades in the canvas so that white text has strong contrast on the field.

## What does not change

- Facts only from `events.json`: the title, ministry, date, time (if the event has one),
  place (only if it is not the church's default place) and the church's call to action.
  Nothing else is written on an artboard: no slogan, no invented detail. The export audit
  rejects any other word or number.
- The church name is never typed; the logo carries it. Use the logo variant that suits the
  field (`IPUC_COLOR para fondo oscuro.png` on dark fields, `IPUC_COLOR para fondo claro.png`
  on light ones), unaltered, on a flat panel with no gradient, glow or pattern behind it.
- Spanish (Colombia), addressing the reader as `tú`.
- 16:9, exactly 1920x1080 per artboard, with `data-slug="<slug>"` on its root element.
- Vary the composition from event to event: the giant word, the shapes, where the date sits.
  Two events of one kind share a color, not a layout.
```

- [ ] **Step 2: Commit**

```bash
git add brand/paletas-imagen.md
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -m "docs: palettes per kind of event for the Claude Design images

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Rules and flow documents

**Files:**
- Modify: `CLAUDE.md`, `PLAN.md`, `README.md`, `.claude/skills/church-ads/SKILL.md`, `brand/corporate-brand.md`

**Interfaces:**
- Consumes: the finished scripts of Tasks 2 to 4 and `brand/paletas-imagen.md`.
- Produces: docs that match the code. Read each file's current text first and edit the passages named below; keep each file's language and tone.

- [ ] **Step 1: `CLAUDE.md`**

Make these edits:
1. Opening paragraph: change "produces, per event, a branded image and a video clip" to say the image comes from Claude Design and the clip from Remotion.
2. Hard rule 4 ("Subagents never render, or generate an image"): add that the orchestrator, not a subagent, builds the week's Claude Design canvas and exports it with `scripts/export-stills.mjs`, serialized like every render.
3. Hard rule 5 (`tokens.ts` single source of truth): add that it governs the video and the logo; the event images use the per-kind palettes of `brand/paletas-imagen.md`.
4. Commands block: add `node scripts/export-stills.mjs 2026-W39 [slug]   # canvas -> out/<week>/<slug>/ad.png` after the `render.mjs` line.
5. Conventions: add one bullet saying the event's `ad.png` comes from `out/<week>/imagenes/` via `export-stills.mjs`, and the Remotion frame is `fotograma.png`.
6. Layout notes that say `ad.png` is a Remotion still: correct them.

- [ ] **Step 2: `PLAN.md`**

Find the decision row `| Image generation | Design authored as a Remotion component. ...`. Replace its text with a dated row (`*Changed 2026-09-29.*`): the event image comes from a weekly Claude Design canvas exported with `scripts/export-stills.mjs`, with a palette per kind of event; the video still comes from the Remotion components; the earlier decision (one component for image and video) is superseded for images only.

- [ ] **Step 3: `.claude/skills/church-ads/SKILL.md`**

1. Step 5: add a paragraph after the designers' fan-out: while they work, build the week's canvas (read `brand/paletas-imagen.md`; `Artifact` quickstart with `design_systems: false`; one private Design artifact `IPUC <semana>`; one artboard per event; read it back to `out/<week>/imagenes/`). Use the file layout recorded in the spec's "Spike result".
2. Step 7: add `node scripts/export-stills.mjs <week>` after validate, and say an audit error means fixing the canvas and exporting again.
3. Step 10: say `render.mjs` writes `fotograma.png` and the images come from the export; "look at the stills" now means `ad.png`.
4. Step 11 (report): list events with no `ad.png` (with `fotograma.png` as a stand-in) and the kind each event took, in plain Spanish.
5. Layout of a week: replace `<slug>/{ad.png, clip.mp4}` with `<slug>/{ad.png, fotograma.png, clip.mp4}` and add `imagenes/`.

- [ ] **Step 4: `README.md` (Spanish)**

Where it says what `ad.png` is (around the folder listing and the "Las horas y las fechas de cada `ad.png`" line), say in Spanish that la imagen de cada evento sale de un lienzo de Claude Design con un color por tipo de evento, y que el video se sigue haciendo con los diseños de siempre.

- [ ] **Step 5: `brand/corporate-brand.md`**

Add a short note under its intro: the manual's palette governs the video and the logo; the event images may use the per-kind palettes of `paletas-imagen.md`, but the logo rules (unaltered, flat background, right variant) still apply to them.

- [ ] **Step 6: Check the docs against the code**

Run: `grep -n "export-stills\|fotograma\|paletas-imagen" CLAUDE.md PLAN.md README.md .claude/skills/church-ads/SKILL.md brand/corporate-brand.md`
Expected: each of the five files matches at least one of the three names.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md PLAN.md README.md .claude/skills/church-ads/SKILL.md brand/corporate-brand.md
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -m "docs: images come from Claude Design, video stays on Remotion

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End to end on week 2026-W40

**Files:**
- Create (git-ignored output): `out/2026-W40/imagenes/` and each `out/2026-W40/<slug>/ad.png`

**Interfaces:**
- Consumes: everything above, and `out/2026-W40/events.json` (9 events).
- Produces: nine new `ad.png` and the confirmation that the flow works in a real week.

- [ ] **Step 1: Build the week's canvas**

Follow the new SKILL step 5 paragraph: read `brand/paletas-imagen.md`, publish a private Design artifact `IPUC semana 28 sep - 4 oct` with nine artboards (one per event of `out/2026-W40/events.json`, `data-slug` = the slug), each on its kind's palette and with its own composition, showing only the allowed facts. For `culto-damas-jovenes` and `ayuno-damas-jovenes` the kind is Damas by the table order and by the title; say so in the report.

- [ ] **Step 2: Read the canvas back**

Read the published files into `out/2026-W40/imagenes/` as the spike recorded.

- [ ] **Step 3: Export**

Run: `node scripts/export-stills.mjs 2026-W40`
Expected: `9 image(s) in .../out/2026-W40.`, exit 0. If exit 2, fix the artboards named in the errors in the canvas, read it back and run again.

- [ ] **Step 4: Look at every image**

Read each `out/2026-W40/<slug>/ad.png` with the Read tool. Check against `events.json` line by line: every time, date and title. Check contrast, that the logo is unaltered on a flat panel, that no two events share a layout, and that the colors match their kinds.

- [ ] **Step 5: Confirm the video is unaffected**

Run: `node scripts/render.mjs 2026-W40 servicio-martes-1845`
Expected: exit 0; `out/2026-W40/servicio-martes-1845/fotograma.png` and `clip.mp4` are written; its `ad.png` is the canvas one, untouched.

- [ ] **Step 6: Report to the user**

In plain Spanish: where the images are, the color each event took, and the reminder to check every time and date.

---

## Self-Review

**Spec coverage**
- Goal, decisions table (scope, colors, assignment, review, path, design system): Task 1 (design system declined, canvas), Task 5 (palettes), Task 6 (docs), Task 7.
- Architecture flow and the contract (`data-slug`, 1920x1080): Tasks 1, 3, 7; the size is enforced in `exportStills` (`tamano-artboard`).
- New files table: `brand/paletas-imagen.md` (Task 5), `export-stills.mjs` (Task 3), `still-source.mjs` (Task 2), tests (Tasks 2 and 3). One deliberate change from the spec: the audit runs inside `export-stills.mjs` instead of `validate.mjs`, because reading an artboard's visible text needs the browser. `validate.mjs` is unchanged; the audit still blocks the export.
- Audit rules `token-ajeno`, `nombre-en-texto`, `artboard-faltante`, `artboard-sobrante`, `artboard-duplicado`: Task 2, each with a test.
- Docs and rules that change: Task 6 lists all five files.
- Failure modes: a canvas that cannot be read leaves no `ad.png` and the report says so (Task 6, SKILL step 11); an audit error writes nothing (Task 3 test); one event without `ad.png` is reported (SKILL step 11).
- Testing section: Tasks 2 and 3; visual check Task 7.
- Spike with go/no-go and fallback: Task 1.

**Placeholder scan:** no "TBD"/"TODO". Task 6 gives the passages to edit rather than full replacement text because the exact current wording of five documents must be read first; each edit states the content to add. Task 1 and Task 7 depend on the artifact layout the spike records, stated as a dependency.

**Type consistency:** `checkStillText(tableros, doc)` returns `{errores, avisos}` (Task 2) and is consumed with `.map(({slug, text}) => ...)` in `exportStills` (Task 3). `exportStills` returns `{errores, avisos, escritos}` and the CLI destructures the same names. `salida(slug)`, `slugs`, `executable`, `htmlPath` are used identically in the core, the tests and the CLI. `resolveBrowser()` and `openPage(executable)` signatures match their uses.
