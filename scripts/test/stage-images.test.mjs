import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageImages } from '../core/stage-images.mjs';

/** A fresh week folder (out/<week>) and a fresh video/public, removed after the test. */
function sandbox(t) {
  const raiz = mkdtempSync(join(tmpdir(), 'stage-images-'));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const carpeta = join(raiz, 'out', '2026-W39');
  const publico = join(raiz, 'public');
  mkdirSync(carpeta, { recursive: true });
  mkdirSync(publico, { recursive: true });
  const conImagen = (slug, contenido) => {
    mkdirSync(join(carpeta, slug), { recursive: true });
    writeFileSync(join(carpeta, slug, 'ad.png'), contenido);
  };
  return { carpeta, publico, conImagen };
}

test("each event's ad.png is staged under public/imagenes/<slug>.png and named in the result", (t) => {
  const { carpeta, publico, conImagen } = sandbox(t);
  conImagen('culto', 'png del culto');
  const imagenes = stageImages({ carpeta, publico, slugs: ['culto', 'ayuno'] });
  assert.deepEqual(imagenes, { culto: 'imagenes/culto.png' });
  assert.equal(readFileSync(join(publico, 'imagenes', 'culto.png'), 'utf8'), 'png del culto');
});

test('images staged by an earlier run (another week, an event dropped since) never survive', (t) => {
  const { carpeta, publico, conImagen } = sandbox(t);
  mkdirSync(join(publico, 'imagenes'));
  writeFileSync(join(publico, 'imagenes', 'ayuno.png'), 'de otra semana');
  conImagen('culto', 'nueva');
  const imagenes = stageImages({ carpeta, publico, slugs: ['culto', 'ayuno'] });
  assert.deepEqual(imagenes, { culto: 'imagenes/culto.png' });
  assert.equal(existsSync(join(publico, 'imagenes', 'ayuno.png')), false);
});

test('a week with no images stages nothing', (t) => {
  const { carpeta, publico } = sandbox(t);
  assert.deepEqual(stageImages({ carpeta, publico, slugs: ['culto'] }), {});
});

test("a service's video takes each image from the whole week's folder when its own has none", (t) => {
  const { carpeta, publico, conImagen } = sandbox(t);
  conImagen('culto', 'de la semana');
  const parte = join(carpeta, '..', '2026-W39-martes');
  mkdirSync(parte, { recursive: true });
  const imagenes = stageImages({ carpeta: parte, respaldo: carpeta, publico, slugs: ['culto'] });
  assert.deepEqual(imagenes, { culto: 'imagenes/culto.png' });
  assert.equal(readFileSync(join(publico, 'imagenes', 'culto.png'), 'utf8'), 'de la semana');
});
