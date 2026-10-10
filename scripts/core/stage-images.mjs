// Stages each event's image (out/<week>/<slug>/ad.png, exported from the week's Claude Design
// canvas by export-stills.mjs) where Remotion can serve it: video/public/imagenes/<slug>.png.
// The video then shows the same image that gets published. Like the audio, anything an earlier
// run left there must never survive: a slug repeats from week to week, so an old image would
// show last week's date.

import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { extname, join } from 'node:path';

const TIPOS = ['png', 'jpg', 'jpeg', 'webp'];

/**
 * An image the person supplied for an event (their own flyer), saved as out/<run>/aportadas/<slug>.<ext>.
 * It is the person's, so it is shown as is: no canvas artboard and no text audit (export-stills skips it).
 */
export function imagenAportada(carpeta, slug) {
  return TIPOS.map((t) => join(carpeta, 'aportadas', `${slug}.${t}`)).find(existsSync) ?? null;
}

/**
 * @param {{carpeta: string, respaldo?: string, publico: string, slugs: string[]}} a the run folder
 *   (out/<run>), the whole week's folder to fall back on (a service's video reuses its images),
 *   video/public and the run's slugs
 * @returns {Record<string, string>} per slug with an image, its path under public/
 */
export function stageImages({ carpeta, respaldo, publico, slugs }) {
  const destino = join(publico, 'imagenes');
  rmSync(destino, { recursive: true, force: true });
  const imagenes = {};
  for (const slug of slugs) {
    const carpetas = [carpeta, respaldo].filter(Boolean);
    const origen =
      carpetas.map((c) => imagenAportada(c, slug)).find(Boolean) ?? carpetas.map((c) => join(c, slug, 'ad.png')).find(existsSync);
    if (!origen) continue;
    const nombre = `${slug}${extname(origen)}`;
    mkdirSync(destino, { recursive: true });
    copyFileSync(origen, join(destino, nombre));
    imagenes[slug] = `imagenes/${nombre}`;
  }
  return imagenes;
}
