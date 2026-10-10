#!/usr/bin/env node
// Turns the week's Claude Design canvas into one ad.png per event.
//
//   node scripts/export-stills.mjs <week> [slug ...] [--dir path]
//
// Reads out/<week>/events.json and the canvas downloaded to out/<week>/imagenes/ (or --dir),
// stages it so its /_blob assets resolve, checks that fonts and images really loaded, audits every
// artboard's text against the record, and photographs each [data-slug] element to
// out/<week>/<slug>/ad.png. With slugs only those are written, but the whole canvas is still
// staged and audited. The browser is REMOTION_BROWSER_EXECUTABLE or the headless shell Remotion
// installed; none is ever downloaded. Rendering is CPU-bound: run it alone, never next to a
// Remotion render.
// Exit 0: done. Exit 1: usage, missing input, or the browser could not start, died or stalled.
// Exit 2: errors were found: no image written, and the old image of each event in scope removed.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs, printIssues, weekDir } from './core/project.mjs';
import { resolveBrowser } from './core/cdp.mjs';
import { imagenAportada } from './core/stage-images.mjs';
import { exportStills } from './core/export-stills.mjs';

const USO = 'usage: node scripts/export-stills.mjs <week> [slug ...] [--dir path]';
const { flags, positional } = parseArgs(process.argv.slice(2));
const [week, ...slugs] = positional;
if (!week) {
  console.error(USO);
  process.exit(1);
}
if (flags.dir === true || flags.dir === '') {
  console.error(`--dir needs a path. ${USO}`);
  process.exit(1);
}
const carpeta = weekDir(week);
const eventsPath = join(carpeta, 'events.json');
if (!existsSync(eventsPath)) {
  console.error(`${eventsPath} not found. Run scripts/normalize.mjs first.`);
  process.exit(1);
}
const dir = flags.dir ? resolve(flags.dir) : join(carpeta, 'imagenes');
if (!existsSync(dir)) {
  console.error(`${dir} not found. Publish the week's canvas and read it back to out/${week}/imagenes/ first.`);
  process.exit(1);
}
// An event with an image the person supplied (aportadas/<slug>.*) has no artboard: it is left out here.
const semana = JSON.parse(readFileSync(eventsPath, 'utf8'));
const aportadas = semana.events.filter((e) => imagenAportada(carpeta, e.slug)).map((e) => e.slug);
const doc = { ...semana, events: semana.events.filter((e) => !aportadas.includes(e.slug)) };
if (aportadas.length) console.log(`supplied by the person, not exported: ${aportadas.join(', ')}`);

let executable;
try {
  executable = await resolveBrowser();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

let resultado;
try {
  resultado = await exportStills({ dir, doc, slugs, salida: (slug) => join(carpeta, slug, 'ad.png'), executable });
} catch (err) {
  // the browser could not start, died, or stalled: say so plainly instead of dumping a stack
  console.error(err.message);
  process.exit(1);
}
const { errores, avisos, escritos, borrados } = resultado;
printIssues({ errores, avisos });
if (errores.length) {
  for (const p of borrados) console.error(`removed ${p}`);
  console.error(`${errores.length} error(s): no image was exported. Fix the canvas and run it again.`);
  process.exit(2);
}
for (const p of escritos) console.log(`wrote ${p}`);
console.log(`${escritos.length} image(s) in ${carpeta}.`);
