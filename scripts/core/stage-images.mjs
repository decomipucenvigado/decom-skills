// Stages each event's image (out/<week>/<slug>/ad.png, exported from the week's Claude Design
// canvas by export-stills.mjs) where Remotion can serve it: video/public/imagenes/<slug>.png.
// The video then shows the same image that gets published. Like the audio, anything an earlier
// run left there must never survive: a slug repeats from week to week, so an old image would
// show last week's date.

import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

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
    const origen = [carpeta, respaldo].filter(Boolean).map((c) => join(c, slug, 'ad.png')).find(existsSync);
    if (!origen) continue;
    mkdirSync(destino, { recursive: true });
    copyFileSync(origen, join(destino, `${slug}.png`));
    imagenes[slug] = `imagenes/${slug}.png`;
  }
  return imagenes;
}
