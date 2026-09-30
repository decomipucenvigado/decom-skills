// Photographs each Claude Design artboard ([data-slug]) of a downloaded canvas into a
// 1920x1080 png. The canvas is staged first (core/stage-canvas.mjs) so its /_blob assets
// resolve; then, with the page's own scripts disabled, and before any screenshot, the page must
// prove it rendered for real: every font loaded, every image decoded, every artboard exactly
// 1920x1080, no text the audit cannot read (drawn by CSS, inside a frame or a form field, or
// placed outside every artboard), no time or date running out of its box, and the artboards'
// visible text passes the audit against events.json (core/still-source.mjs). It is all or
// nothing: with any error no image is written, and the old image of each event in scope is
// removed, so none survives with a stale fact while the report says the event has none.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkStillText } from './still-source.mjs';
import { openPage } from './cdp.mjs';
import { stageCanvas } from './stage-canvas.mjs';

const ANCHO = 1920;
const ALTO = 1080;

// Read in the page. `text` is innerText, which is all the audit sees, so what the photo can show
// beyond it is listed apart: `noAuditable` (frames and form fields, whose content innerText never
// includes, and CSS ::before/::after text), `fuera` (rendered text outside every artboard; it is
// named after the artboard it overlaps, if any) and `desbordados` (text with a digit, so a time or a
// date, whose box does not hold it: the W40 "0:30 a. m." that was "10:30 a. m." cut off). A word
// with no digit may bleed on purpose, as a giant "Culto" off the bottom edge.
const LEER = `(async () => {
  await document.fonts.ready;
  const fuentes = [...document.fonts].map((f) => ({ family: f.family, status: f.status }));
  const imagenes = [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }));
  const artboards = [...document.querySelectorAll('[data-slug]')];
  const LETRA = /[\\p{L}\\p{N}]/u;
  const DIGITO = /\\d/;
  const corto = (s) => s.replace(/\\s+/g, ' ').trim().slice(0, 80);
  const transparente = (c) => c === 'transparent' || /[,\\/]\\s*0(\\.0*)?\\s*\\)$/.test(c);
  // an ancestor that paints a box or clips its content: a time inside it must stay inside it
  const caja = (el) => {
    const s = getComputedStyle(el);
    return !transparente(s.backgroundColor) || s.backgroundImage !== 'none' || s.overflowX !== 'visible';
  };
  const tableros = artboards.map((el) => {
    const r = el.getBoundingClientRect();
    const noAuditable = [];
    for (const o of el.querySelectorAll('iframe, frame, object, embed, input, textarea, select')) {
      noAuditable.push('an <' + o.localName + '> element, whose content the audit cannot read');
    }
    for (const x of [el, ...el.querySelectorAll('*')]) {
      for (const pseudo of ['::before', '::after']) {
        const c = getComputedStyle(x, pseudo).content;
        if (c && c !== 'none' && c !== 'normal' && LETRA.test(c)) noAuditable.push('text drawn by CSS ' + pseudo + ' (content: ' + corto(c) + '), which the audit cannot read');
      }
    }
    return { slug: el.dataset.slug, text: el.innerText, x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height, noAuditable, desbordados: [] };
  });
  const fuera = [];
  const recorrido = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
    const padre = nodo.parentElement;
    if (!padre || !nodo.data.trim() || padre.closest('script, style, title, head')) continue;
    const rango = document.createRange();
    rango.selectNodeContents(nodo);
    if (!rango.getClientRects().length) continue; // not rendered
    const t = rango.getBoundingClientRect();
    const ab = padre.closest('[data-slug]');
    if (!ab) {
      const sobre = artboards.find((a) => {
        const r = a.getBoundingClientRect();
        return t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top;
      });
      fuera.push({ slug: sobre ? sobre.dataset.slug : null, texto: corto(nodo.data) });
      continue;
    }
    if (!DIGITO.test(nodo.data)) continue;
    // vertically: inside the artboard, give or take a quarter of the font size (glyph boxes are taller than lines)
    const cuarto = (parseFloat(getComputedStyle(padre).fontSize) || 0) / 4;
    const r = ab.getBoundingClientRect();
    let sale = t.top < r.top - cuarto || t.bottom > r.bottom + cuarto;
    // horizontally: inside every box that paints or clips, up to the artboard, which frames the photo
    for (let a = padre; a && !sale; a = a === ab ? null : a.parentElement) {
      if (a !== ab && !caja(a)) continue;
      const c = a.getBoundingClientRect();
      sale = t.left < c.left - 1 || t.right > c.right + 1;
    }
    if (sale) tableros[artboards.indexOf(ab)].desbordados.push(corto(nodo.data));
  }
  return { fuentes, imagenes, tableros, fuera };
})()`;

/**
 * `espera` (milliseconds) bounds each browser command and page load; it defaults to the driver's.
 * On any error nothing is written and `borrados` lists the old images removed: the existing
 * `salida(slug)` of every event in scope (all of `doc.events`, or the named slugs that are events).
 * An exception (a browser that cannot start, dies or stalls) removes nothing.
 * @param {{dir: string, doc: object, salida: (slug: string) => string, slugs?: string[], executable: string, espera?: number}} opciones
 * @returns {Promise<{errores: object[], avisos: object[], escritos: string[], borrados: string[]}>}
 */
export async function exportStills({ dir, doc, salida, slugs = [], executable, espera }) {
  const eventos = new Set(doc.events.map((e) => e.slug));
  const alcance = slugs.length ? slugs.filter((s) => eventos.has(s)) : [...eventos];
  const avisos = [];
  const fallar = (errores) => {
    const borrados = [];
    for (const destino of new Set(alcance.map(salida))) {
      if (!existsSync(destino)) continue;
      rmSync(destino, { force: true });
      borrados.push(destino);
    }
    return { errores, avisos, escritos: [], borrados };
  };

  const staging = mkdtempSync(join(tmpdir(), 'canvas-staging-'));
  let pagina = null;
  try {
    const { paginas, problemas } = stageCanvas(dir, staging);
    const errores = problemas.map((p) => ({ ...p }));
    for (const slug of slugs) {
      if (!eventos.has(slug)) errores.push({ regla: 'slug-desconocido', slug, mensaje: `no event with slug "${slug}" in events.json` });
    }
    if (errores.length) return fallar(errores);

    pagina = await openPage(executable, { espera });
    const leidas = [];
    for (const p of paginas) {
      await pagina.navigate(pathToFileURL(p.ruta).href);
      const { fuentes, imagenes, tableros, fuera } = await pagina.evaluate(LEER);
      for (const f of fuentes) {
        if (f.status === 'error' || f.status === 'loading') {
          errores.push({ regla: 'fuente-no-cargada', mensaje: `${p.archivo}: the font "${f.family}" did not load (${f.status})` });
        }
      }
      for (const i of imagenes) {
        if (!i.ok) errores.push({ regla: 'imagen-rota', mensaje: `${p.archivo}: the image "${i.src}" did not load` });
      }
      for (const t of tableros) {
        for (const cosa of t.noAuditable) errores.push({ regla: 'texto-no-auditable', slug: t.slug, mensaje: `${cosa}: show text as plain text and images as <img>` });
        for (const texto of t.desbordados) {
          errores.push({ regla: 'texto-desbordado', slug: t.slug, mensaje: `"${texto}" runs out of its box or off the artboard, so part of it may be cut off: keep it on one line inside a box that holds it` });
        }
      }
      for (const f of fuera) {
        errores.push({ regla: 'texto-no-auditable', ...(f.slug ? { slug: f.slug } : {}), mensaje: `${p.archivo}: "${f.texto}" is rendered outside every artboard, where the audit cannot read it` });
      }
      leidas.push({ ...p, tableros });
    }

    const todos = leidas.flatMap((p) => p.tableros);
    const auditoria = checkStillText(
      todos.map(({ slug, text }) => ({ slug, text })),
      doc,
    );
    errores.push(...auditoria.errores);
    avisos.push(...auditoria.avisos);
    for (const t of todos) {
      if (t.width !== ANCHO || t.height !== ALTO) {
        errores.push({ regla: 'tamano-artboard', slug: t.slug, mensaje: `the artboard is ${t.width}x${t.height}, it must be exactly ${ANCHO}x${ALTO}` });
      }
    }
    if (errores.length) return fallar(errores);

    // Everything is photographed into memory first and only then written, so a failure while
    // photographing artboard N leaves no partial output behind.
    const fotos = [];
    for (const p of leidas) {
      const elegidos = p.tableros.filter((t) => !slugs.length || slugs.includes(t.slug));
      if (!elegidos.length) continue;
      await pagina.navigate(pathToFileURL(p.ruta).href);
      await pagina.evaluate('document.fonts.ready.then(() => true)');
      for (const t of elegidos) {
        const png = await pagina.screenshot(t);
        const ancho = png.readUInt32BE(16);
        const alto = png.readUInt32BE(20);
        if (ancho !== ANCHO || alto !== ALTO) {
          errores.push({ regla: 'tamano-artboard', slug: t.slug, mensaje: `the photo is ${ancho}x${alto}, it must be exactly ${ANCHO}x${ALTO}` });
        } else {
          fotos.push({ destino: salida(t.slug), png });
        }
      }
    }
    if (errores.length) return fallar(errores);

    const escritos = [];
    for (const { destino, png } of fotos) {
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, png);
      escritos.push(destino);
    }
    return { errores, avisos, escritos, borrados: [] };
  } finally {
    try {
      if (pagina) await pagina.close();
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }
}
