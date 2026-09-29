// Audit of the Claude Design artboards against events.json. The visible text of an
// artboard may only be made of words the event's record already has: its title,
// ministry, date, time (if any), place (if not the default one) and the church's call
// to action. Anything else is an invented fact, and in a church ad a wrong time or place
// sends real people to a locked door. Like the narration check, this is a net, not
// proof: the orchestrator still looks at every image. A lone changed numeral that is
// not part of a time or an "N de mes" (for example a giant "7" standing for the day)
// is not caught; the audit is a net, not proof.

import { horaPartes, stripAccents } from './spanish.mjs';
import { HORA_MERIDIANO, RELOJ } from './guion.mjs';

const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
const FECHA = new RegExp(`(?<![\\d:])(\\d{1,2})\\s+de\\s+(${MESES})\\b`, 'g');
const DIAS = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)s?\b/g;

const plano = (s) => stripAccents(s ?? '').toLowerCase();

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
 * Times, dates and weekdays checked as units against the event. A bag of tokens cannot tell
 * "7:00 p. m." on "viernes 3 de octubre" from "3:00 p. m." or "viernes 7 de octubre": every digit
 * is in the record, only the grouping is wrong.
 * @returns {{errores: object[], resto: string}} `resto` is the text with the matched spans blanked
 */
function revisarUnidades(texto, evento) {
  const errores = [];
  const t = plano(texto);
  const esperado = evento.hora ? horaPartes(evento.hora) : null;

  const revisarReloj = (m, h, min, marcador) => {
    if (!esperado) {
      errores.push({ regla: 'hora-ajena', mensaje: `"${m[0].trim()}" is a time, but the event has none in the record` });
      return;
    }
    const okMin = min === undefined ? esperado.minutos === 0 : Number(min) === esperado.minutos;
    const hora = Number(h);
    const okHora = marcador
      ? (hora % 12 || 12) === esperado.h12 && (marcador === 'p') === (esperado.h24 >= 12)
      : hora === esperado.h24 || hora === esperado.h12;
    if (!okHora || !okMin) errores.push({ regla: 'hora-ajena', mensaje: `"${m[0].trim()}" does not match ${evento.horaTexto}` });
  };
  for (const m of t.matchAll(RELOJ)) revisarReloj(m, m[1], m[2], m[3]);
  for (const m of t.matchAll(HORA_MERIDIANO)) revisarReloj(m, m[1], undefined, m[2]);

  const referencia = `${plano(evento.fechaTexto)} ${plano(evento.titulo)}`;
  const fechas = new Set([...referencia.matchAll(FECHA)].map((m) => `${Number(m[1])} de ${m[2]}`));
  for (const m of t.matchAll(FECHA)) {
    if (!fechas.has(`${Number(m[1])} de ${m[2]}`)) errores.push({ regla: 'fecha-ajena', mensaje: `"${m[0]}" is not the event's date (${evento.fechaTexto})` });
  }
  const dias = new Set([...referencia.matchAll(DIAS)].map((m) => m[1]));
  for (const m of t.matchAll(DIAS)) {
    if (!dias.has(m[1])) errores.push({ regla: 'dia-ajeno', mensaje: `"${m[0]}" is not the event's weekday (${evento.fechaTexto})` });
  }

  const resto = [RELOJ, HORA_MERIDIANO, FECHA, DIAS].reduce((acc, re) => acc.replace(re, ' '), t);
  return { errores, resto };
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
    if (!palabras.length) {
      errores.push({ regla: 'artboard-vacio', slug: t.slug, mensaje: 'the artboard has no visible text' });
      continue;
    }

    const { errores: unidades, resto } = revisarUnidades(t.text, evento);
    for (const e of unidades) {
      errores.push({ regla: e.regla, slug: t.slug, mensaje: e.mensaje });
    }

    palabras = tokens(resto);
    let sinNombre;
    let hubo = false;
    while ((sinNombre = quitarSecuencia(palabras, tokens(iglesia.nombre)))) {
      palabras = sinNombre;
      hubo = true;
    }
    if (hubo) {
      errores.push({ regla: 'nombre-en-texto', slug: t.slug, mensaje: 'the church name is typed on the artboard; the logo carries it, never type it' });
    }

    const ok = permitidos(evento, iglesia);
    const ajenas = [...new Set(palabras.filter((p) => !ok.has(p)))];
    if (ajenas.length) {
      errores.push({ regla: 'token-ajeno', slug: t.slug, mensaje: `text that is not in the event's record: ${ajenas.map((p) => `"${p}"`).join(', ')}` });
    }
  }
  return { errores, avisos: [] };
}
