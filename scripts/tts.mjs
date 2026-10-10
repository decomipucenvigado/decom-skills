#!/usr/bin/env node
// Generates the week's voiceover in one take: out/<week>/guion.md -> voz.mp3
// (+ voz.json, voz.alineacion.json).
//
//   node scripts/tts.mjs [--week 2026-W39] [--force]
//
// The whole script goes in one request so the voice reads it as one piece; the response
// carries per-character timing, which render.mjs turns into scene cuts. It refuses to
// bill while validate.mjs reports errors. Unchanged text and settings reuse the existing
// files instead of calling the API again. Model and voice settings are in
// scripts/voice.json, and so is the voice (`voiceId`; the environment's only when it names none);
// the API key comes from the environment or .env.
//
// Exit 0: audio ready. Exit 1: usage or configuration problem. Exit 2: the script has
// errors. Exit 3: the service could not be reached or refused; the week is then
// rendered silent and reported, it does not fail.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadEnv, parseArgs, weekDir } from './core/project.mjs';
import { buildNarration, parseNarracion } from './core/narracion.mjs';
import { buildRequest, cacheKey, parseTimestampResponse, resolveCredentials } from './core/tts.mjs';

loadEnv();
const { flags, positional } = parseArgs(process.argv.slice(2), { booleans: ['force'] });

// The retired `tts.mjs <slug>` form would otherwise voice (and bill) the whole week, so refuse it up front.
if (positional.length) {
  console.error('usage: node scripts/tts.mjs [--week <week>] [--force]');
  process.exit(1);
}

const semanas = existsSync(join(ROOT, 'out')) ? readdirSync(join(ROOT, 'out')).sort().reverse() : [];
const week = flags.week || semanas.find((w) => existsSync(join(weekDir(w), 'guion.md')));
const guionPath = week && join(weekDir(week), 'guion.md');
if (!guionPath || !existsSync(guionPath)) {
  console.error(`No guion.md${flags.week ? ` in ${flags.week}` : ''}. Expected out/<week>/guion.md.`);
  process.exit(1);
}

// Never pay for a script that has errors.
const validacion = spawnSync(process.execPath, [join(ROOT, 'scripts', 'validate.mjs'), week, '--narracion'], { stdio: 'inherit' });
if (validacion.status !== 0) {
  console.error('Validation failed: the voiceover was not requested.');
  process.exit(validacion.status === 1 ? 1 : 2);
}

const { text } = buildNarration(parseNarracion(readFileSync(guionPath, 'utf8')).sections);
if (!text) {
  console.error(`${guionPath} has no spoken text.`);
  process.exit(1);
}

const voice = JSON.parse(readFileSync(join(ROOT, 'scripts', 'voice.json'), 'utf8'));
const { apiKey, voiceId } = resolveCredentials(process.env, voice);
if (!apiKey || !voiceId) {
  console.error('Missing ElevenLabs credentials: set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (or the ELEVEN_LABS_* names) in the environment or .env.');
  process.exit(1);
}

const carpeta = weekDir(week);
const mp3 = join(carpeta, 'voz.mp3');
const meta = join(carpeta, 'voz.json');
const alineacion = join(carpeta, 'voz.alineacion.json');
const llave = cacheKey({ text, voice, voiceId });

if (!flags.force && [mp3, meta, alineacion].every(existsSync) && JSON.parse(readFileSync(meta, 'utf8')).cacheKey === llave) {
  console.log(`${week}: voz.mp3 is up to date, no API call made.`);
  process.exit(0);
}

const degradar = (motivo) => {
  console.error(`${week}: voiceover unavailable (${motivo}).\nImages, scripts and a silent video can still be produced; the week will have no audio.`);
  process.exit(3);
};

const { url, init } = buildRequest({ text, voice, voiceId, apiKey });
let res;
try {
  res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
} catch (err) {
  degradar(`could not reach api.elevenlabs.io: ${err.cause?.code ?? err.name}`);
}
if (!res.ok) degradar(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);

let voz;
try {
  voz = parseTimestampResponse(await res.json());
} catch (err) {
  degradar(err.message);
}

// The metadata is written last: a run cut short leaves a stale cacheKey and is redone.
writeFileSync(mp3, voz.audio);
writeFileSync(alineacion, `${JSON.stringify(voz.alignment)}\n`);
writeFileSync(meta, `${JSON.stringify({ week, model: voice.model, voiceId, characters: text.length, cacheKey: llave }, null, 2)}\n`);
console.log(`${week}: wrote ${mp3} (${text.length} characters).`);
