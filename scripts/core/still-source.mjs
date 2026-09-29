// Audit of the Claude Design artboards against events.json. The visible text of an
// artboard may only be made of words the event's record already has: its title,
// ministry, date, time (if any), place (if not the default one) and the church's call
// to action. Anything else is an invented fact, and in a church ad a wrong time or place
// sends real people to a locked door. Like the narration check, this is a net, not
// proof: the orchestrator still looks at every image.

import { stripAccents } from './spanish.mjs';

/** Lowercase, accent-free words and numbers, punctuation dropped. */
const tokens = (texto) =>
  stripAccents(texto ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const mismoTexto = (a, b) => stripAccents(a.trim()).toLowerCase() === stripAccents(b.trim()).toLowerCase();

/** The words an event's artboard may show. */
function permitidos(evento, iglesia) {
  const lugarNuevo = evento.lugar && !(iglesia.lugarPorDefecto && mismoTexto(evento.lugar, iglesia.lugarPorDefecto));
  return new Set(
    [evento.titulo, evento.ministerio, evento.fechaTexto, evento.horaTexto, lugarNuevo ? evento.lugar : null, iglesia.llamadoAccion].flatMap(tokens),
  );
}

/** `secuencia` appears in `lista` as consecutive items; returns the copy of `lista` without its first occurrence, or null. */
function quitarSecuencia(lista, secuencia) {
  if (!secuencia.length) return null;
  for (let i = 0; i + secuencia.length <= lista.length; i++) {
    if (secuencia.every((t, j) => lista[i + j] === t)) return [...lista.slice(0, i), ...lista.slice(i + secuencia.length)];
  }
  return null;
}

/**
 * @param {Array<{slug: string, text: string}>} tableros visible text of each artboard
 * @param {{iglesia?: object, events: object[]}} doc events.json
 */
export function checkStillText(tableros, doc) {
  const errores = [];
  const iglesia = doc.iglesia ?? {};
  const eventos = new Map(doc.events.map((e) => [e.slug, e]));

  const vistos = new Set();
  for (const t of tableros) {
    if (vistos.has(t.slug)) errores.push({ regla: 'artboard-duplicado', slug: t.slug, mensaje: `two artboards have the slug "${t.slug}"` });
    vistos.add(t.slug);
  }
  for (const e of doc.events) {
    if (!vistos.has(e.slug)) errores.push({ regla: 'artboard-faltante', slug: e.slug, mensaje: 'the canvas has no artboard for this event' });
  }

  const revisados = new Set();
  for (const t of tableros) {
    if (revisados.has(t.slug)) continue;
    revisados.add(t.slug);
    const evento = eventos.get(t.slug);
    if (!evento) {
      errores.push({ regla: 'artboard-sobrante', slug: t.slug, mensaje: `the artboard "${t.slug}" is not an event of this week` });
      continue;
    }
    let palabras = tokens(t.text);
    const sinNombre = quitarSecuencia(palabras, tokens(iglesia.nombre));
    if (sinNombre) {
      errores.push({ regla: 'nombre-en-texto', slug: t.slug, mensaje: 'the church name is typed on the artboard; the logo carries it, never type it' });
      palabras = sinNombre;
    }
    const ok = permitidos(evento, iglesia);
    const ajenas = [...new Set(palabras.filter((p) => !ok.has(p)))];
    if (ajenas.length) {
      errores.push({ regla: 'token-ajeno', slug: t.slug, mensaje: `text that is not in the event's record: ${ajenas.map((p) => `"${p}"`).join(', ')}` });
    }
  }
  return { errores, avisos: [] };
}
