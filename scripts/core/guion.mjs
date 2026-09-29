// Checks a voiceover script against the event record it must be faithful to.
// Errors are claims the record does not support; notices are style guidance.
// It is a heuristic net, not proof: the orchestrator still reads every script.

import { horaPalabra, horaPartes, nombreDia, periodoDe, stripAccents } from './spanish.mjs';

const norm = (s) => stripAccents(s).toLowerCase();
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HORAS = 'una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce';
const HORA_HABLADA = new RegExp(`\\b(?:las|la)\\s+(${HORAS})\\b`, 'g');
export const RELOJ = /(?<![\d:])(\d{1,2})\s*:\s*(\d{2})(?![\d:])\s*(?:([ap])\.?\s?m\.?)?/g;
export const HORA_MERIDIANO = /(?<![\d:])(\d{1,2})\s*([ap])\.?\s?m\.?(?![a-z\d])/g;
const DIAS = /\b(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)\b/g;
const PERIODO_DICHO = /^[^.!?]*?\b(?:de la (manana|tarde|noche|madrugada)|del (mediodia))/;

const LONGITUD = { min: 15, max: 32 }; // the plan targets ~20-25 words

/** True when the spoken text uses the formal register (usted, "los invitamos"): hard rule 2 wants tú. */
export function registroFormal(texto) {
  const t = norm(texto);
  return /\busted(?:es)?\b/.test(t) || /\b(?:los|les|le)\s+(?:esperamos|invitamos)\b/.test(t);
}

/** The spoken text of a guion.md: no headings, no HTML comments. */
export function cleanGuion(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} texto the spoken text (see cleanGuion)
 * @param {object} evento one record of events.json
 * @param {{lugarPorDefecto?: string|null, llamadoAccion?: string|null}} [iglesia] church-info.md facts
 * @param {{longitud?: {min: number, max: number}}} [opciones] word range override
 */
export function checkGuion(texto, evento, iglesia = {}, { longitud = LONGITUD } = {}) {
  const errores = new Map();
  const avisos = new Map();
  const error = (regla, mensaje) => errores.has(regla) || errores.set(regla, mensaje);
  const aviso = (regla, mensaje) => avisos.has(regla) || avisos.set(regla, mensaje);

  const t = norm(texto);
  const esperado = evento.hora ? horaPartes(evento.hora) : null;
  const sinHora = () => error('hora-sin-respaldo', `the script gives a time but "${evento.titulo}" has none in events.json`);

  // Times, as digits ("6:45 p. m.", "7 pm") and as words ("a las siete de la noche").
  const spans = [];
  const revisarReloj = (m, h, min, marcador) => {
    spans.push([m.index, m.index + m[0].length]);
    if (!esperado) return sinHora();
    const okMin = min === undefined ? esperado.minutos === 0 : Number(min) === esperado.minutos;
    const hora = Number(h);
    const okHora = marcador
      ? (hora % 12 || 12) === esperado.h12 && (marcador === 'p') === (esperado.h24 >= 12)
      : hora === esperado.h24 || hora === esperado.h12;
    if (!okHora || !okMin) error('hora-distinta', `"${m[0].trim()}" does not match ${evento.horaTexto}`);
  };
  for (const m of t.matchAll(RELOJ)) revisarReloj(m, m[1], m[2], m[3]);
  for (const m of t.matchAll(HORA_MERIDIANO)) revisarReloj(m, m[1], undefined, m[2]);

  for (const m of t.matchAll(HORA_HABLADA)) {
    if (!esperado) {
      sinHora();
      break;
    }
    if (m[1] !== horaPalabra(esperado.h12)) {
      error('hora-distinta', `"${m[0]}" does not match ${evento.horaHablada}`);
      continue;
    }
    const p = PERIODO_DICHO.exec(t.slice(m.index + m[0].length));
    const dicho = p && (p[1] ?? p[2]);
    if (!dicho) aviso('sin-periodo', `"${m[0]}" does not say the part of the day`);
    else if (dicho !== stripAccents(periodoDe(evento.hora))) {
      error('periodo-distinto', `"${dicho}" does not match ${evento.horaHablada}`);
    }
  }

  // Weekdays: only the event's own, or one its title already contains.
  const dias = new Set([stripAccents(evento.diaSemana)]);
  for (const m of norm(evento.titulo).matchAll(DIAS)) dias.add(stripAccents(nombreDia(m[1])));
  for (const m of t.matchAll(DIAS)) {
    if (!dias.has(stripAccents(nombreDia(m[1])))) {
      error('dia-distinto', `"${m[1]}" is not ${evento.diaSemana}`);
    }
  }

  // Every other number must already appear in the event record.
  const permitidas = new Set(
    [evento.titulo, evento.fechaTexto, evento.horaTexto, evento.lugar].filter(Boolean).flatMap((s) => s.match(/\d+/g) ?? []),
  );
  for (const m of t.matchAll(/\d+/g)) {
    const dentro = spans.some(([a, b]) => m.index >= a && m.index < b);
    if (!dentro && !permitidas.has(m[0])) error('cifra-sin-respaldo', `the number ${m[0]} is not in the event record`);
  }

  // Place: what the script says must fit how the event is held.
  const titulo = norm(evento.titulo);
  const sinTitulo = titulo ? t.replaceAll(titulo, ' ') : t;
  if (evento.modalidad === 'virtual') {
    const lugarBase = iglesia.lugarPorDefecto && norm(iglesia.lugarPorDefecto);
    if (/\bpresencial(?:es|mente)?\b/.test(sinTitulo) || (lugarBase && new RegExp(`\\b${escapar(lugarBase)}\\b`).test(sinTitulo))) {
      error('lugar-distinto', 'the script points a virtual event at an in-person place');
    }
  } else if (/\b(?:zoom|virtual(?:es|mente)?|online|en linea|enlace|link)\b/.test(sinTitulo)) {
    error('lugar-distinto', 'the script sends an in-person event online');
  }
  if (/\bzoom\b/.test(sinTitulo) && norm(evento.lugar ?? '') !== 'zoom') {
    error('lugar-distinto', 'the script says Zoom but the event card does not');
  }

  // Register: tú, never usted.
  if (registroFormal(texto)) error('registro-usted', 'formal register; write for tú');

  if (iglesia.llamadoAccion && !t.includes(norm(iglesia.llamadoAccion))) {
    aviso('sin-cta', `the script does not close with "${iglesia.llamadoAccion}"`);
  }
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  if (palabras < longitud.min || palabras > longitud.max) {
    aviso('longitud', `${palabras} words; aim for ${longitud.min}-${longitud.max}`);
  }

  const lista = (m) => [...m].map(([regla, mensaje]) => ({ regla, mensaje }));
  return { errores: lista(errores), avisos: lista(avisos) };
}
