#!/usr/bin/env node
// Renders a week: per event a clip.mp4 and a fotograma.png (a frame of the clip, only to
// check the video; the event's image is ad.png, exported from the Claude Design canvas by
// scripts/export-stills.mjs), then the combined semana.mp4.
//
//   node scripts/render.mjs <week> [slug ...]
//
// With slugs, only those events are rendered and the weekly video is skipped: a
// reel built from a subset would be a wrong reel. Renders run one after another
// on purpose: rendering is CPU-bound, and only the orchestrator renders.
//
// Validates first (an error in any delivery or in guion.md stops the run, nothing is
// rendered), regenerates the ad registry, stages the week's voiceover into
// video/public/audio/, turns guion.md plus the voice's timing into scene lengths
// (core/render-plan.mjs), bundles once, then renders. A week with no voz.mp3 is rendered
// silent, sized from the words, and reported at the end. REMOTION_BROWSER_EXECUTABLE
// selects the browser, else Remotion's own download is used.
//
// Exit 0: done. Exit 1: usage. Exit 2: validation failed. Exit 4: some renders failed.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { brand } from '../video/src/brand/tokens.ts';
import { ROOT, loadEnv, parseArgs, weekDir } from './core/project.mjs';
import { parseNarracion } from './core/narracion.mjs';
import { stillFrame, weekPlan } from './core/render-plan.mjs';
import { stageAudio } from './core/stage-audio.mjs';

loadEnv();
const [week, ...slugs] = parseArgs(process.argv.slice(2)).positional;
if (!week) {
  console.error('usage: node scripts/render.mjs <week> [slug ...]');
  process.exit(1);
}
const carpetaSemana = weekDir(week);
const eventsPath = join(carpetaSemana, 'events.json');
if (!existsSync(eventsPath)) {
  console.error(`${eventsPath} not found. Run scripts/normalize.mjs first.`);
  process.exit(1);
}
const doc = JSON.parse(readFileSync(eventsPath, 'utf8'));

// 1. Nothing renders until the deliveries and the script are valid and the registry is current.
//    --narracion even with slugs: every clip is a slice of the one narration, so the script
//    (and the voice's timing) must be sound before weekPlan reads them.
const correr = (script, args) => spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], { stdio: 'inherit' });
const validacion = correr('validate.mjs', [week, ...slugs, '--narracion']);
if (validacion.status !== 0) {
  console.error('Validation failed: nothing was rendered.');
  process.exit(validacion.status === 1 ? 1 : 2);
}
if (correr('gen-registry.mjs', []).status !== 0) process.exit(1);

// 2. Stage the week's voiceover and plan the scenes from the script and the voice's timing.
const publico = join(ROOT, 'video', 'public');
const conAudio = stageAudio({ carpeta: carpetaSemana, publico });
const alineacionPath = join(carpetaSemana, 'voz.alineacion.json');
if (conAudio && !existsSync(alineacionPath)) {
  console.error(`voz.mp3 has no voz.alineacion.json, so its timing is unknown. Run: node scripts/tts.mjs --week ${week} --force`);
  process.exit(1);
}
const { sections } = parseNarracion(readFileSync(join(carpetaSemana, 'guion.md'), 'utf8'));
const plan = weekPlan({
  doc,
  sections,
  alignment: conAudio ? JSON.parse(readFileSync(alineacionPath, 'utf8')) : null,
  hasMusic: existsSync(join(publico, 'music', 'bed.mp3')),
  motion: brand.motion,
  fps: brand.video.fps,
});
const items = slugs.length ? plan.items.filter((i) => slugs.includes(i.slug)) : plan.items;

// 3. Bundle once, then render one thing at a time.
const require = createRequire(join(ROOT, 'video', 'package.json'));
const { bundle } = require('@remotion/bundler');
const { renderMedia, renderStill, selectComposition } = require('@remotion/renderer');

const inicio = Date.now();
let ultimo = -1;
const avance = (etiqueta) => (fraccion) => {
  const paso = Math.floor(fraccion * 4) * 25; // report every 25%
  if (paso !== ultimo) console.log(`  ${etiqueta} ${paso}%`);
  ultimo = paso;
};
const nuevo = () => (ultimo = -1);
const largo = (composition) => `${composition.durationInFrames} frames (${(composition.durationInFrames / brand.video.fps).toFixed(1)} s)`;

console.log('Bundling...');
const serveUrl = await bundle({
  entryPoint: join(ROOT, 'video', 'src', 'index.ts'),
  publicDir: publico,
  onProgress: (p) => avance('bundle')(p / 100),
});
const comun = { serveUrl, browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || null, logLevel: 'warn' };

const fallos = [];
const intentar = async (nombre, tarea) => {
  try {
    await tarea();
  } catch (err) {
    fallos.push({ nombre, mensaje: err.message.split('\n')[0] });
    console.error(`FAILED ${nombre}: ${err.message.split('\n')[0]}`);
  }
};

for (const props of items) {
  const carpeta = join(carpetaSemana, props.slug);
  mkdirSync(carpeta, { recursive: true });
  await intentar(props.slug, async () => {
    const composition = await selectComposition({ ...comun, id: 'EventAd', inputProps: props });
    console.log(`${props.slug}${props.voz ? '' : ' (silent)'}: ${largo(composition)}`);
    await renderStill({
      ...comun,
      composition,
      inputProps: props,
      output: join(carpeta, 'fotograma.png'),
      frame: stillFrame(composition.durationInFrames),
      imageFormat: 'png',
    });
    nuevo();
    await renderMedia({
      ...comun,
      composition,
      inputProps: props,
      codec: 'h264',
      outputLocation: join(carpeta, 'clip.mp4'),
      onProgress: ({ progress }) => avance('clip')(progress),
    });
  });
}

if (!slugs.length && items.length) {
  await intentar('semana', async () => {
    const composition = await selectComposition({ ...comun, id: 'WeeklyReel', inputProps: plan.reel });
    console.log(`semana: ${largo(composition)}`);
    nuevo();
    await renderMedia({
      ...comun,
      composition,
      inputProps: plan.reel,
      codec: 'h264',
      outputLocation: join(carpetaSemana, 'semana.mp4'),
      onProgress: ({ progress }) => avance('reel')(progress),
    });
  });
}

// 4. Report.
const segundos = Math.round((Date.now() - inicio) / 1000);
console.log(`\n${items.length} event(s) in ${carpetaSemana} (${segundos}s).`);
if (slugs.length) console.log('Weekly video skipped: it is only built when no slugs are given.');
if (!conAudio) console.log(`No voiceover, rendered silent. Run: node scripts/tts.mjs --week ${week}`);
if (fallos.length) {
  console.error(`${fallos.length} render(s) failed: ${fallos.map((f) => f.nombre).join(', ')}`);
  process.exit(4);
}
