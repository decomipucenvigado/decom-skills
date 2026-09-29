// Photographs each Claude Design artboard ([data-slug]) of a downloaded canvas into a
// 1920x1080 png. The canvas is staged first (core/stage-canvas.mjs) so its /_blob assets
// resolve; then, before any screenshot, the page must prove it rendered for real: every font
// loaded, every image decoded, every artboard exactly 1920x1080, and the artboards' visible text
// passes the audit against events.json (core/still-source.mjs). With any error, nothing is written.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkStillText } from './still-source.mjs';
import { openPage } from './cdp.mjs';
import { stageCanvas } from './stage-canvas.mjs';

const ANCHO = 1920;
const ALTO = 1080;

const LEER = `(async () => {
  await document.fonts.ready;
  const fuentes = [...document.fonts].map((f) => ({ family: f.family, status: f.status }));
  const imagenes = [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }));
  const tableros = [...document.querySelectorAll('[data-slug]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { slug: el.dataset.slug, text: el.innerText, x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
  });
  return { fuentes, imagenes, tableros };
})()`;

/**
 * @param {{dir: string, doc: object, salida: (slug: string) => string, slugs?: string[], executable: string}} opciones
 * @returns {Promise<{errores: object[], avisos: object[], escritos: string[]}>}
 */
export async function exportStills({ dir, doc, salida, slugs = [], executable }) {
  const staging = mkdtempSync(join(tmpdir(), 'canvas-staging-'));
  let pagina = null;
  try {
    const { paginas, problemas } = stageCanvas(dir, staging);
    const errores = problemas.map((p) => ({ ...p }));
    const avisos = [];
    if (errores.length) return { errores, avisos, escritos: [] };

    pagina = await openPage(executable);
    const leidas = [];
    for (const p of paginas) {
      await pagina.navigate(pathToFileURL(p.ruta).href);
      const { fuentes, imagenes, tableros } = await pagina.evaluate(LEER);
      for (const f of fuentes) {
        if (f.status === 'error' || f.status === 'loading') {
          errores.push({ regla: 'fuente-no-cargada', mensaje: `${p.archivo}: the font "${f.family}" did not load (${f.status})` });
        }
      }
      for (const i of imagenes) {
        if (!i.ok) errores.push({ regla: 'imagen-rota', mensaje: `${p.archivo}: the image "${i.src}" did not load` });
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
    if (errores.length) return { errores, avisos, escritos: [] };

    const escritos = [];
    for (const p of leidas) {
      const elegidos = p.tableros.filter((t) => !slugs.length || slugs.includes(t.slug));
      if (!elegidos.length) continue;
      await pagina.navigate(pathToFileURL(p.ruta).href);
      await pagina.evaluate('document.fonts.ready.then(() => true)');
      for (const t of elegidos) {
        const png = await pagina.screenshot(t);
        const destino = salida(t.slug);
        mkdirSync(dirname(destino), { recursive: true });
        writeFileSync(destino, png);
        escritos.push(destino);
      }
    }
    return { errores, avisos, escritos };
  } finally {
    try {
      if (pagina) await pagina.close();
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }
}
