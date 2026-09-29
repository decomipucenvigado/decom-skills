import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportStills } from '../core/export-stills.mjs';
import { resolveBrowser } from '../core/cdp.mjs';

const IGLESIA = { nombre: 'Iglesia Ejemplo', lugarPorDefecto: 'Templo', llamadoAccion: null };
const CULTO = { slug: 'culto-jovenes', titulo: 'Culto de jóvenes', ministerio: null, fechaTexto: 'viernes 3 de octubre', hora: '19:00', horaTexto: '7:00 p. m.', lugar: null };
const RETIRO = { slug: 'retiro-familias', titulo: 'Retiro de familias', ministerio: null, fechaTexto: 'sábado 4 de octubre', hora: null, horaTexto: null, lugar: null };
const DOC = { iglesia: IGLESIA, events: [CULTO, RETIRO] };

// A valid 1x1 png. If the browser reports naturalWidth 0 for it, swap in any valid 1x1 png.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const LOGO = 'a'.repeat(32);
const FUENTE = 'b'.repeat(32);

let executable = null;
try {
  executable = await resolveBrowser();
} catch {
  // no browser here: the tests that need one are skipped
}
const sinNavegador = executable ? false : 'no headless browser available (set REMOTION_BROWSER_EXECUTABLE)';

const pagina = (cuerpo, estilo = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}.ab{width:1920px;height:1080px;position:relative;overflow:hidden;margin-bottom:40px;color:#fff;font:700 120px sans-serif;background:#7a2bd6}${estilo}</style></head><body>${cuerpo}</body></html>`;
const culto = (extra = '', atributos = '') => `<div class="ab" data-slug="culto-jovenes" ${atributos}><span>Culto de jóvenes</span><p style="font-size:60px">viernes 3 de octubre · 7:00 p. m.</p>${extra}</div>`;
const retiro = `<div class="ab" data-slug="retiro-familias"><span>Retiro de familias</span><p style="font-size:60px">sábado 4 de octubre</p></div>`;

/** A downloaded canvas in a temp dir; `assets` are written at its root. Runs `fn(dir, salida)`, always cleans up. */
async function conCanvas(artboards, assets, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'canvas-'));
  const fuera = mkdtempSync(join(tmpdir(), 'stills-'));
  try {
    mkdirSync(join(dir, 'project'), { recursive: true });
    for (const [nombre, html] of Object.entries(artboards)) writeFileSync(join(dir, 'project', nombre), html);
    for (const [nombre, contenido] of Object.entries(assets)) writeFileSync(join(dir, nombre), contenido);
    return await fn(dir, (slug) => join(fuera, `${slug}.png`), fuera);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(fuera, { recursive: true, force: true });
  }
}

const pngSize = (path) => {
  const b = readFileSync(path);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};
const reglas = (r) => r.errores.map((e) => e.regla);

test('two artboards in one file become 1920x1080 pngs, even the one below the fold', { skip: sinNavegador }, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.escritos.map((p) => p.split('/').pop()).sort(), ['culto-jovenes.png', 'retiro-familias.png']);
    for (const p of r.escritos) assert.deepEqual(pngSize(p), { width: 1920, height: 1080 });
  });
});

test('artboards spread over several files are all exported, named by data-slug and not by file', { skip: sinNavegador }, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto()), 'Otro.dc.html': pagina(retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.escritos.map((p) => p.split('/').pop()).sort(), ['culto-jovenes.png', 'retiro-familias.png']);
  });
});

test('only the requested slugs are exported', { skip: sinNavegador }, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, slugs: ['retiro-familias'], salida, executable });
    assert.deepEqual(r.errores, []);
    assert.equal(existsSync(salida('retiro-familias')), true);
    assert.equal(existsSync(salida('culto-jovenes')), false);
  });
});

test('an image that loads through /_blob passes', { skip: sinNavegador }, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto(`<img src="/_blob/${LOGO}" width="10" height="10">`) + retiro) }, { [`${LOGO}.png`]: PNG }, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(r.errores, []);
    assert.equal(r.escritos.length, 2);
  });
});

test('an audit error writes nothing', { skip: sinNavegador }, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const doc = { ...DOC, events: [{ ...CULTO, hora: '20:00', horaTexto: '8:00 p. m.' }, RETIRO] };
    const r = await exportStills({ dir, doc, salida, executable });
    assert.deepEqual(reglas(r), ['hora-ajena']);
    assert.deepEqual(r.escritos, []);
    assert.equal(existsSync(salida('culto-jovenes')), false);
  });
});

test('an artboard that is not 1920x1080 is an error', { skip: sinNavegador }, async () => {
  const chico = culto().replace('class="ab"', 'class="ab" style="width:1280px;height:720px"');
  await conCanvas({ 'Main.dc.html': pagina(chico + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(reglas(r), ['tamano-artboard']);
    assert.deepEqual(r.escritos, []);
  });
});

test('a broken image is an error, not a silent broken-image box', { skip: sinNavegador }, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto(`<img src="/_blob/${LOGO}" width="10" height="10">`) + retiro) }, { [`${LOGO}.png`]: 'not a png' }, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(reglas(r), ['imagen-rota']);
    assert.deepEqual(r.escritos, []);
  });
});

test('a font that fails to load is an error, not a silent fallback font', { skip: sinNavegador }, async () => {
  const estilo = `@font-face{font-family:Rota;src:url(/_blob/${FUENTE})}.ab{font-family:Rota,sans-serif}`;
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro, estilo) }, { [`${FUENTE}.woff2`]: 'not a font' }, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(reglas(r), ['fuente-no-cargada']);
    assert.deepEqual(r.escritos, []);
  });
});

test('a /_blob reference with no downloaded asset stops before any browser is opened', async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto(`<img src="/_blob/${LOGO}">`) + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable: '/no/browser/needed' });
    assert.deepEqual(reglas(r), ['asset-faltante']);
    assert.deepEqual(r.escritos, []);
  });
});

test('a download with no artboards is an error', async () => {
  await conCanvas({}, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable: '/no/browser/needed' });
    assert.deepEqual(reglas(r), ['sin-artboards']);
  });
});

test('resolveBrowser explains how to set the browser when the named one does not exist', async () => {
  const antes = process.env.REMOTION_BROWSER_EXECUTABLE;
  process.env.REMOTION_BROWSER_EXECUTABLE = '/no/such/browser';
  try {
    await assert.rejects(() => resolveBrowser(), /REMOTION_BROWSER_EXECUTABLE/);
  } finally {
    if (antes === undefined) delete process.env.REMOTION_BROWSER_EXECUTABLE;
    else process.env.REMOTION_BROWSER_EXECUTABLE = antes;
  }
});
