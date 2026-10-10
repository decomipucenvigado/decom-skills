// What scripts/render.mjs feeds to Remotion, kept free of I/O so it is testable.
// Paths are relative to video/public/, the way staticFile() expects them.

import { cuts, sceneFrames } from './escenas.mjs';
import { estimateTimes, sectionTimes } from './narracion.mjs';

const STILL_AT = 0.6; // fotograma.png is taken this far into the clip, once the animation has settled
const MUSIC_SRC = 'music/bed.mp3';

/** The week's single voiceover, staged by stage-audio.mjs. */
export const NARRATION_SRC = 'audio/semana.mp3';

/** The frame to export as fotograma.png: about 60% in, always inside the clip. */
export const stillFrame = (durationInFrames) => Math.max(0, Math.min(durationInFrames - 1, Math.round(durationInFrames * STILL_AT)));

const palabrasDe = (texto) => (texto ? texto.split(/\s+/).filter(Boolean).length : 0);

/**
 * Everything the compositions need for one week.
 * @param {object} a
 * @param {object} a.doc events.json
 * @param {Array<{id: string, text: string}>} a.sections the parsed guion.md
 * @param {{characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[]}|null} a.alignment
 *   voz.alineacion.json, or null when the week has no voiceover
 * @param {boolean} a.hasMusic
 * @param {Record<string, string>} [a.imagenes] per slug, its staged image (stage-images.mjs); an event
 *   without one shows its ad component instead
 * @param {{leadSeconds: number, tailSeconds: number, transitionSeconds: number, outroSeconds: number, wordsPerSecond: number,
 *   slicePadBeforeSeconds: number, slicePadAfterSeconds: number}} a.motion the motion tokens of video/src/brand/tokens.ts
 * @param {number} a.fps
 * @returns {{items: object[], reel: object}} EventAdProps per event, and the WeeklyReelProps
 */
export function weekPlan({ doc, sections, alignment, hasMusic, imagenes = {}, motion, fps }) {
  const tiempos = alignment
    ? sectionTimes(sections, alignment)
    : estimateTimes(sections, { wordsPerSecond: motion.wordsPerSecond, pauseSeconds: motion.transitionSeconds });
  const audioSeconds = alignment ? alignment.character_end_times_seconds.at(-1) : null;
  const ventana = (id) => tiempos.find((t) => t.id === id) ?? { startSec: null, endSec: null };
  const textoDe = (id) => sections.find((s) => s.id === id)?.text ?? '';
  // Checked first: a missing section would otherwise surface as a confusing "cuts out of order" error.
  for (const e of doc.events) {
    if (ventana(e.slug).startSec === null) throw new Error(`guion.md has no section for "${e.slug}"`);
  }

  // Scenes are [intro card, one per event, outro card]; each is cut where the voice pauses.
  const ids = ['intro', ...doc.events.map((e) => e.slug), 'outro'];
  const transicion = Math.round(motion.transitionSeconds * fps);
  const cortes = cuts(ids.map(ventana), {
    leadSec: motion.leadSeconds,
    tailSec: motion.tailSeconds,
    silentSec: motion.outroSeconds,
  });
  const frames = sceneFrames(cortes.map((s) => Math.round(s * fps)), transicion);

  const items = doc.events.map((event) => {
    const { startSec, endSec } = ventana(event.slug);
    return {
      slug: event.slug,
      event,
      iglesia: doc.iglesia,
      voz: alignment
        ? {
            src: NARRATION_SRC,
            fromSec: Math.max(0, startSec - motion.slicePadBeforeSeconds),
            toSec: Math.min(audioSeconds, endSec + motion.slicePadAfterSeconds),
          }
        : null,
      palabras: palabrasDe(textoDe(event.slug)),
      imagen: imagenes[event.slug] ?? null,
    };
  });

  return {
    items,
    reel: {
      semanaTexto: doc.semana.texto,
      iglesia: doc.iglesia,
      items,
      musicSrc: hasMusic ? MUSIC_SRC : null,
      frames,
      voiceStartFrame: Math.round(motion.leadSeconds * fps),
      narration: alignment ? { audioSrc: NARRATION_SRC, audioSeconds } : null,
    },
  };
}
