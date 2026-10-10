// Prepares a downloaded Claude Design canvas for a browser. Its artboards (project/*.dc.html)
// refer to images and fonts as /_blob/<32 hex id>; `Artifact read` saves each of those apart, as
// <id>.<ext> at the root of the download. Opened from disk the /_blob paths fail silently (a
// broken logo, a fallback font, and the export would still "succeed"), so each artboard is copied
// into a staging folder with every blob reference rewritten to a relative path, and any blob
// with no file is reported.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BLOB = /\/_blob\/([^\s"'()<>?#\\]+)/g;
const ID = /^[0-9a-f]{32}$/;
const ASSET = /^([0-9a-f]{32})\.[A-Za-z0-9]+$/;

/**
 * @param {string} dir the downloaded canvas: project/*.dc.html plus <id>.<ext> assets at its root
 * @param {string} staging an existing directory to write the browser-ready copies into
 * @returns {{paginas: Array<{archivo: string, ruta: string}>, problemas: Array<{regla: string, mensaje: string}>}}
 */
export function stageCanvas(dir, staging) {
  const problemas = [];
  const proyecto = join(dir, 'project');
  const archivos = existsSync(proyecto)
    ? readdirSync(proyecto, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith('.dc.html'))
        .map((d) => d.name)
        .sort()
    : [];
  if (!archivos.length) {
    problemas.push({ regla: 'sin-artboards', mensaje: `no project/*.dc.html in ${dir}: read the canvas back first` });
    return { paginas: [], problemas };
  }

  const assets = new Map();
  for (const nombre of readdirSync(dir)) {
    const m = ASSET.exec(nombre);
    if (m) assets.set(m[1], nombre);
  }

  mkdirSync(join(staging, 'assets'), { recursive: true });
  const paginas = [];
  for (const nombre of archivos) {
    const archivo = `project/${nombre}`;
    const faltan = new Set();
    const reescrito = readFileSync(join(proyecto, nombre), 'utf8').replace(BLOB, (todo, ref) => {
      const asset = ID.test(ref) ? assets.get(ref) : undefined;
      if (!asset) {
        faltan.add(ref);
        return todo;
      }
      copyFileSync(join(dir, asset), join(staging, 'assets', asset));
      return `assets/${asset}`;
    });
    for (const ref of faltan) {
      problemas.push({ regla: 'asset-faltante', mensaje: `${archivo} refers to /_blob/${ref}, which was not downloaded (or is not a 32-hex asset id): read that asset back with Artifact read (path)` });
    }
    const ruta = join(staging, nombre);
    writeFileSync(ruta, reescrito);
    paginas.push({ archivo, ruta });
  }
  return { paginas, problemas };
}
