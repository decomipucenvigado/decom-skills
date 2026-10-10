import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNarration } from '../core/narracion.mjs';
import { NARRATION_SRC, stillFrame, weekPlan } from '../core/render-plan.mjs';

const iglesia = { nombre: 'Iglesia Ejemplo', direccion: null, lugarPorDefecto: 'Salón Principal', llamadoAccion: 'Te esperamos', despedida: 'Dios te bendiga' };
const motion = { leadSeconds: 0.5, tailSeconds: 1, transitionSeconds: 0.5, outroSeconds: 4, wordsPerSecond: 2, slicePadBeforeSeconds: 0.05, slicePadAfterSeconds: 0.1 };
const fps = 30;
const doc = {
  semana: { texto: 'Semana del 21 al 27 de septiembre' },
  iglesia,
  events: [{ slug: 'a', titulo: 'A' }, { slug: 'b', titulo: 'B' }],
};
const SECCIONES = [
  { id: 'intro', text: 'Hola.' },
  { id: 'a', text: 'Uno.' },
  { id: 'b', text: 'Dos.' },
  { id: 'outro', text: 'Fin.' },
];

// Every character takes half a second, so the times are exact binary fractions.
const alineacion = (text) => ({
  characters: [...text],
  character_start_times_seconds: [...text].map((_, i) => i * 0.5),
  character_end_times_seconds: [...text].map((_, i) => (i + 1) * 0.5),
});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
const plan = ({ sections = SECCIONES, alignment, hasMusic = false, imagenes } = {}) =>
  weekPlan({
    doc,
    sections,
    alignment: alignment === undefined ? alineacion(buildNarration(sections).text) : alignment,
    hasMusic,
    imagenes,
    motion,
    fps,
  });

test('the voiceover is staged under public/audio/semana.mp3 and referenced relative to public/', () => {
  assert.equal(NARRATION_SRC, 'audio/semana.mp3');
});

test('the still is taken about 60% into the clip, on a whole frame', () => {
  assert.equal(stillFrame(300), 180);
  assert.equal(stillFrame(301), 181);
});

test('the still frame always falls inside the clip', () => {
  assert.equal(stillFrame(1), 0);
  assert.equal(stillFrame(2), 1);
  assert.ok(stillFrame(10) <= 9);
});

test('a narrated week: scenes are cut in the pauses and overlap by one transition', () => {
  // Speech: intro 0-2.5, a 3-5, b 5.5-7.5, outro 8-10 s. Cuts (lead 0.5, tail 1): 3.25, 5.75, 8.25, 11.5 s
  // = frames 98, 173, 248, 345 (halves round up). Transition 15 frames: 7 before a cut, 8 after.
  const { reel } = plan();
  assert.deepEqual(reel.frames, [106, 90, 90, 104]);
  assert.equal(reel.frames.reduce((a, b) => a + b, 0) - 3 * 15, 345);
  assert.equal(reel.voiceStartFrame, 15);
  assert.deepEqual(reel.narration, { audioSrc: NARRATION_SRC, audioSeconds: 10 });
});

test('each event carries its own slice of the one voiceover, a little padded', () => {
  const { items } = plan();
  assert.equal(items[0].voz.src, NARRATION_SRC);
  near(items[0].voz.fromSec, 2.95);
  near(items[0].voz.toSec, 5.1);
  near(items[1].voz.fromSec, 5.45);
  near(items[1].voz.toSec, 7.6);
});

test('the padding never runs past the end of the file', () => {
  // b is the last speech and ends at 7.5 s, the end of the file; 0.1 s of padding would be 7.6 s.
  const sections = [{ id: 'intro', text: 'Hola.' }, { id: 'a', text: 'Uno.' }, { id: 'b', text: 'Dos.' }];
  const { items } = plan({ sections, alignment: alineacion('Hola. Uno. Dos.') });
  assert.equal(items[1].voz.toSec, 7.5);
});

test('items carry the record, the church and the words of their line', () => {
  const { items } = plan();
  assert.deepEqual(items.map((i) => i.slug), ['a', 'b']);
  assert.equal(items[0].event, doc.events[0]);
  assert.equal(items[0].iglesia, iglesia);
  assert.equal(items[0].palabras, 1);
});

test('the reel takes the week text and church from events.json and reuses the same items', () => {
  const { items, reel } = plan();
  assert.equal(reel.semanaTexto, 'Semana del 21 al 27 de septiembre');
  assert.equal(reel.iglesia, iglesia);
  assert.equal(reel.items, items);
});

test('an outro with nothing to say lasts outroSeconds, silent, after the last event', () => {
  // Cuts: 3.25, 5.75, then b ends at 7.5 -> 0.5 + 7.5 + 1 = 9.0 s (frame 270), then 4 s more (frame 390).
  const sections = [{ id: 'intro', text: 'Hola.' }, { id: 'a', text: 'Uno.' }, { id: 'b', text: 'Dos.' }];
  const { reel } = plan({ sections, alignment: alineacion('Hola. Uno. Dos.') });
  assert.deepEqual(reel.frames, [106, 90, 112, 127]);
});

test('a week with no voiceover is silent and sized from the words', () => {
  // Estimated at 2 words/s with 0.5 s between sections: speech 0-0.5, 1-1.5, 2-2.5, 3-3.5 s.
  const { items, reel } = plan({ alignment: null });
  assert.deepEqual(items.map((i) => i.voz), [null, null]);
  assert.equal(reel.narration, null);
  assert.deepEqual(reel.frames, [46, 45, 45, 59]);
});

test('an event with no section in the script cannot be planned', () => {
  const sections = [{ id: 'intro', text: 'Hola.' }, { id: 'b', text: 'Dos.' }, { id: 'outro', text: 'Fin.' }];
  assert.throws(() => plan({ sections, alignment: alineacion('Hola. Dos. Fin.') }), /no section for "a"/);
});

test('the music bed is wired only when the file exists', () => {
  assert.equal(plan({ hasMusic: true }).reel.musicSrc, 'music/bed.mp3');
  assert.equal(plan({ hasMusic: false }).reel.musicSrc, null);
});

test("an event with an exported image shows it in the video; one without keeps its component", () => {
  const { items, reel } = plan({ imagenes: { a: 'imagenes/a.png' } });
  assert.deepEqual(items.map((i) => i.imagen), ['imagenes/a.png', null]);
  assert.deepEqual(reel.items.map((i) => i.imagen), ['imagenes/a.png', null]);
});

test('with no images at all every event keeps its component', () => {
  assert.deepEqual(plan().items.map((i) => i.imagen), [null, null]);
});
