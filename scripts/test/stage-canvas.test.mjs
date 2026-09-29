import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageCanvas } from '../core/stage-canvas.mjs';

const LOGO = 'a'.repeat(32);
const FUENTE = 'b'.repeat(32);

/** A downloaded canvas in a temp dir: artboards under project/, assets at the root. */
function canvas(artboards, assets = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'canvas-'));
  mkdirSync(join(dir, 'project', 'ds'), { recursive: true });
  for (const [nombre, html] of Object.entries(artboards)) writeFileSync(join(dir, 'project', nombre), html);
  for (const [nombre, contenido] of Object.entries(assets)) writeFileSync(join(dir, nombre), contenido);
  return dir;
}

/** Runs `fn(dir, staging)` and always removes both temp folders. */
function conCanvas(artboards, assets, fn) {
  const dir = canvas(artboards, assets);
  const staging = mkdtempSync(join(tmpdir(), 'staging-'));
  try {
    return fn(dir, staging);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(staging, { recursive: true, force: true });
  }
}

test('every /_blob reference becomes a relative path and its asset is copied', () => {
  const html = `<img src="/_blob/${LOGO}"><style>@font-face{font-family:X;src:url(/_blob/${FUENTE})}</style><img src="/_blob/${LOGO}">`;
  conCanvas({ 'Main.dc.html': html }, { [`${LOGO}.png`]: 'png', [`${FUENTE}.woff2`]: 'font' }, (dir, staging) => {
    const r = stageCanvas(dir, staging);
    assert.deepEqual(r.problemas, []);
    assert.deepEqual(r.paginas.map((p) => p.archivo), ['project/Main.dc.html']);
    const salida = readFileSync(r.paginas[0].ruta, 'utf8');
    assert.equal(salida.includes('/_blob/'), false);
    assert.ok(salida.includes(`src="assets/${LOGO}.png"`));
    assert.ok(salida.includes(`url(assets/${FUENTE}.woff2)`));
    assert.equal(readFileSync(join(staging, 'assets', `${LOGO}.png`), 'utf8'), 'png');
    assert.equal(readFileSync(join(staging, 'assets', `${FUENTE}.woff2`), 'utf8'), 'font');
  });
});

test('a reference with no downloaded asset is a problem that names the id', () => {
  conCanvas({ 'Main.dc.html': `<img src="/_blob/${LOGO}">` }, {}, (dir, staging) => {
    const r = stageCanvas(dir, staging);
    assert.deepEqual(r.problemas.map((p) => p.regla), ['asset-faltante']);
    assert.ok(r.problemas[0].mensaje.includes(LOGO));
    assert.ok(r.problemas[0].mensaje.includes('project/Main.dc.html'));
  });
});

test('the same missing asset used twice is reported once', () => {
  conCanvas({ 'Main.dc.html': `<img src="/_blob/${LOGO}"><img src="/_blob/${LOGO}">` }, {}, (dir, staging) => {
    assert.equal(stageCanvas(dir, staging).problemas.length, 1);
  });
});

test('several artboards are staged in name order; project/ds and other files are ignored', () => {
  conCanvas({ 'Main.dc.html': '<p>uno</p>', 'Otro.dc.html': '<p>dos</p>', 'canvas.json': '{}', 'notas.md': 'x' }, {}, (dir, staging) => {
    writeFileSync(join(dir, 'project', 'ds', 'Sistema.dc.html'), '<p>ds</p>');
    const r = stageCanvas(dir, staging);
    assert.deepEqual(r.problemas, []);
    assert.deepEqual(r.paginas.map((p) => p.archivo), ['project/Main.dc.html', 'project/Otro.dc.html']);
    assert.equal(existsSync(join(staging, 'Sistema.dc.html')), false);
    assert.equal(readFileSync(join(staging, 'Otro.dc.html'), 'utf8'), '<p>dos</p>');
  });
});

test('a download with no artboards is a problem', () => {
  conCanvas({}, {}, (dir, staging) => {
    const r = stageCanvas(dir, staging);
    assert.deepEqual(r.problemas.map((p) => p.regla), ['sin-artboards']);
    assert.deepEqual(r.paginas, []);
  });
});
