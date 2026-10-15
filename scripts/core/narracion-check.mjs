// Checks the weekly script (out/<week>/guion.md) against events.json. Errors block the
// run; notices are reported. Each event line is held to the same facts rules as a
// standalone script was (checkGuion); what is new is the structure of the whole and
// the intro and outro, which say only what events.json and church-info.md give.
// It is a heuristic net, not proof: the orchestrator still reads the whole script.

import { checkGuion, registroFormal } from './guion.mjs';
import { stripAccents } from './spanish.mjs';

/** A line about one event has no greeting and no closing, so it is shorter than a standalone ad. */
export const LONGITUD_EVENTO = { min: 6, max: 30 };

/** Lowercase, no accents, no punctuation, single spaces: for comparing what is said. */
const plano = (s) =>
  stripAccents(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @param {{sections: Array<{id: string, text: string}>, problems: string[]}} narracion what parseNarracion returns
 * @param {object} doc events.json
 * @returns {{errores: Array<{regla: string, slug?: string, mensaje: string}>, avisos: Array<{regla: string, slug?: string, mensaje: string}>}}
 */
export function checkNarracion({ sections, problems = [] }, doc) {
  const errores = [];
  const avisos = [];
  const error = (regla, mensaje, slug) => errores.push({ regla, slug, mensaje });
  const aviso = (regla, mensaje, slug) => avisos.push({ regla, slug, mensaje });

  const { iglesia, semana } = doc;
  const eventos = doc.events ?? [];
  for (const p of problems) error('guion-estructura', p);

  // Structure: intro, one section per event in events.json order, and an outro when the church gives closing words.
  const cierre = [iglesia.llamadoAccion, iglesia.despedida].filter(Boolean);
  const conocidos = ['intro', ...eventos.map((e) => e.slug), 'outro'];
  const esperados = conocidos.filter((id) => id !== 'outro' || cierre.length > 0);
  const porId = new Map(sections.map((s) => [s.id, s]));

  for (const s of sections) {
    if (!conocidos.includes(s.id)) error('seccion-desconocida', `"## ${s.id}" is neither intro, outro nor the slug of an event in events.json`);
  }
  for (const id of esperados) {
    if (!porId.get(id)?.text) {
      error('seccion-faltante', `guion.md has no text under "## ${id}"`, id === 'intro' || id === 'outro' ? undefined : id);
    }
  }
  const presentes = sections.filter((s) => s.text && conocidos.includes(s.id)).map((s) => s.id);
  const enOrden = conocidos.filter((id) => presentes.includes(id));
  if (presentes.join() !== enOrden.join()) {
    error('seccion-orden', `sections must follow intro, the events in events.json order, outro; found: ${presentes.join(', ')}`);
  }

  // Intro: welcomes, names the church, says the week exactly as events.json speaks it.
  const intro = porId.get('intro')?.text;
  if (intro) {
    const t = plano(intro);
    if (/\d/.test(intro)) error('intro-cifras', 'the intro must speak dates as words, not digits');
    if (!semana?.hablada) error('semana-sin-hablada', 'events.json has no semana.hablada: run scripts/normalize.mjs again');
    // A service's video (semana.resto) may say "el resto de la semana" instead of the dates.
    else if (!t.includes(plano(semana.hablada)) && !(semana.resto && t.includes('resto de la semana'))) {
      error('intro-sin-semana', `the intro must say the week exactly as "${semana.hablada}"`);
    }
    if (iglesia.nombre && !t.includes(plano(iglesia.nombre))) error('intro-sin-iglesia', `the intro must name the church, "${iglesia.nombre}"`);
    if (registroFormal(intro)) error('registro-usted', 'formal register; write for tú');
  }

  // Outro: the church's own call to action and blessing, nothing else.
  const outro = porId.get('outro')?.text;
  if (outro) {
    if (!cierre.length) error('outro-sin-respaldo', 'church-info.md gives no closing words, so there is no outro line');
    else if (plano(outro) !== plano(cierre.join(' '))) error('outro-distinto', `the outro must be exactly "${cierre.join(', ')}"`);
  }

  // Event lines: the facts rules, without a required closing.
  const sinCierre = { ...iglesia, llamadoAccion: null };
  let anterior = null;
  for (const e of eventos) {
    const texto = porId.get(e.slug)?.text;
    if (!texto) continue;
    const r = checkGuion(texto, e, sinCierre, { longitud: LONGITUD_EVENTO });
    for (const x of r.errores) error(x.regla, x.mensaje, e.slug);
    for (const x of r.avisos) aviso(x.regla, x.mensaje, e.slug);

    const t = plano(texto);
    for (const frase of cierre) {
      if (t.includes(plano(frase))) aviso('cta-fuera-del-cierre', `"${frase}" belongs in the outro, not in an event line`, e.slug);
    }
    const apertura = t.split(' ').slice(0, 2).join(' ');
    if (apertura === anterior) aviso('apertura-repetida', `opens with "${apertura}", like the event before it`, e.slug);
    anterior = apertura;
  }

  return { errores, avisos };
}
