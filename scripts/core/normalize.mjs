// Turns raw calendar events plus Claude's reading of them into the events.json
// contract. Code does the dates and numbers here; Claude reads the words (the titles
// and church-info.md) and hands that over as lectura.json. Every time and place
// carries its provenance, and nothing is guessed: what neither the card, the reading
// nor an explicit override establishes stays null.

import {
  addDays,
  diaSemana,
  fechaTexto,
  horaHablada,
  horaTexto,
  isHora,
  nombreDia,
  rangoTexto,
  semanaHablada,
  semanaTexto,
  slugify,
  weekRange,
} from './spanish.mjs';

const PLANTILLAS = ['destacado', 'estandar', 'virtual'];

/** Local date and 24h time of an instant in a given IANA timezone. */
function partesLocales(dateTime, timeZone) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(dateTime))
      .map((p) => [p.type, p.value]),
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

/**
 * All-day events arrive as "2026-09-26T00:00:00Z" with an exclusive end. The
 * date part is the calendar day as written; converting it to local time would
 * move it back a day.
 */
function leerFechas(raw, zonaCalendario) {
  const { start, end } = raw;
  if (start?.date) {
    const fecha = start.date.slice(0, 10);
    const finInclusivo = end?.date ? addDays(end.date.slice(0, 10), -1) : fecha;
    return { fecha, fechaFin: finInclusivo > fecha ? finInclusivo : null, horaTarjeta: null };
  }
  if (start?.dateTime) {
    const { fecha, hora } = partesLocales(start.dateTime, start.timeZone ?? zonaCalendario);
    return { fecha, fechaFin: null, horaTarjeta: hora };
  }
  return null;
}

/** Every date from `inicio` to `fin` that falls on a weekday as church-info.md writes it ("martes", "Sabados"). */
function fechasDelDia(dia, inicio, fin) {
  const nombre = typeof dia === 'string' ? nombreDia(dia.trim()) : null;
  const fechas = [];
  if (!nombre) return fechas;
  for (let fecha = inicio; fecha <= fin; fecha = addDays(fecha, 1)) {
    if (diaSemana(fecha) === nombre) fechas.push(fecha);
  }
  return fechas;
}

/**
 * The first day of the run. It is the week's Monday unless Claude's reading sets `desde`: the
 * person asked to start a few days earlier (a Saturday run that also announces tomorrow, Sunday).
 */
function inicioDeLaCorrida(desde, lunes, problemas) {
  if (desde === undefined) return lunes;
  if (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || desde > lunes || desde < addDays(lunes, -6)) {
    problemas.push(`lectura desde "${desde}" must be a YYYY-MM-DD date in the 6 days up to the week's Monday ${lunes}, ignored`);
    return lunes;
  }
  return desde;
}

/**
 * A recurring service Claude read from church-info.md, placed on each day of the run that is its weekday
 * (one, unless `desde` starts the run early). Whether a
 * calendar card is that same service is Claude's call and the person's; this never merges or drops
 * anything. The slug comes from the day and start time so the same service keeps it from week to week.
 */
function eventosRecurrentes(servicio, inicio, fin, problemas) {
  const fechas = fechasDelDia(servicio.dia, inicio, fin);
  if (!fechas.length) {
    problemas.push(`lectura recurrentes: dia "${servicio.dia}" is not a weekday, service ignored`);
    return [];
  }
  const titulo = servicio.titulo?.trim();
  if (!titulo) {
    problemas.push(`lectura recurrentes (${servicio.dia}): a service needs a titulo, ignored`);
    return [];
  }
  let hora = null;
  if (servicio.hora) {
    if (isHora(servicio.hora)) hora = servicio.hora;
    else problemas.push(`lectura recurrentes "${titulo}": hora "${servicio.hora}" is not HH:MM (24h), ignored`);
  }
  const lugar = servicio.lugar?.trim() || null;
  return fechas.map((fecha) => ({
    eventId: null,
    origen: 'recurrente',
    titulo,
    base: ['servicio', slugify(diaSemana(fecha)), hora?.replace(':', '')].filter(Boolean).join('-'),
    ministerio: servicio.ministerio?.trim() || null,
    fecha,
    fechaFin: null,
    diaSemana: diaSemana(fecha),
    hora,
    horaFuente: hora ? 'church-info.md' : null,
    lugar,
    lugarFuente: lugar ? 'church-info.md' : null,
    modalidad: 'presencial',
    plantilla: 'estandar',
  }));
}

function descartar(raw, motivo) {
  return { titulo: raw.summary ?? '(untitled)', motivo };
}

function asignarSlugs(eventos) {
  const cuenta = new Map();
  for (const e of eventos) cuenta.set(e.base, (cuenta.get(e.base) ?? 0) + 1);

  const usados = new Set();
  for (const e of eventos) {
    let slug = cuenta.get(e.base) > 1 ? `${e.base}-${slugify(e.diaSemana)}` : e.base;
    for (let n = 2; usados.has(slug); n++) slug = `${e.base}-${slugify(e.diaSemana)}-${n}`;
    usados.add(slug);
    e.slug = slug;
  }
}

const comparar = (a, b) =>
  a.fecha.localeCompare(b.fecha) ||
  (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') ||
  a.titulo.localeCompare(b.titulo, 'es');

function aplicarOverrides(eventos, overrides, problemas, descartados) {
  const porSlug = new Map(eventos.map((e) => [e.slug, e]));
  for (const [slug, o] of Object.entries(overrides)) {
    const e = porSlug.get(slug);
    if (!e) {
      problemas.push(`override "${slug}": no event in this week has that slug`);
      continue;
    }
    if (o.omitir) {
      e.omitido = true;
      descartados.push({ titulo: e.titulo, motivo: 'omitted by override' });
      continue;
    }
    // null is a decision, not a gap: announce the event without the time (or place) the sources gave it.
    if (o.hora === null) {
      e.hora = null;
      e.horaFuente = null;
      e.horaNota = 'the person asked for it to be announced without a time';
    } else if (o.hora !== undefined) {
      if (isHora(o.hora)) {
        e.hora = o.hora;
        e.horaFuente = 'usuario';
        delete e.horaNota;
      } else {
        problemas.push(`override "${slug}": hora "${o.hora}" is not HH:MM (24h), ignored`);
      }
    }
    if (o.lugar === null) [e.lugar, e.lugarFuente, e.lugarNota] = [null, null, 'the person asked for it to be announced without a place'];
    else if (o.lugar) [e.lugar, e.lugarFuente] = [o.lugar, 'usuario'];
    if (o.modalidad) e.modalidad = o.modalidad;
    if (o.plantilla) {
      if (PLANTILLAS.includes(o.plantilla)) e.plantilla = o.plantilla;
      else problemas.push(`override "${slug}": plantilla "${o.plantilla}" is not one of ${PLANTILLAS.join('/')}, ignored`);
    }
  }
  return eventos.filter((e) => !e.omitido);
}

function registroFinal(e) {
  const r = {
    slug: e.slug,
    eventId: e.eventId,
    origen: e.origen,
    titulo: e.titulo,
    ministerio: e.ministerio,
    fecha: e.fecha,
  };
  if (e.fechaFin) r.fechaFin = e.fechaFin;
  Object.assign(r, {
    diaSemana: e.diaSemana,
    fechaTexto: e.fechaFin ? rangoTexto(e.fecha, e.fechaFin) : fechaTexto(e.fecha),
    hora: e.hora,
    horaTexto: e.hora ? horaTexto(e.hora) : null,
    horaHablada: e.hora ? horaHablada(e.hora) : null,
    horaFuente: e.hora ? e.horaFuente : null,
  });
  if (!e.hora && e.horaNota) r.horaNota = e.horaNota;
  Object.assign(r, {
    lugar: e.lugar,
    lugarFuente: e.lugarFuente,
    modalidad: e.modalidad,
    plantilla: e.plantilla,
  });
  if (!e.lugar && e.lugarNota) r.lugarNota = e.lugarNota;
  return r;
}

/**
 * @param {object} args
 * @param {string} args.week ISO week, e.g. "2026-W39"
 * @param {Array<{summary?: string, timeZone?: string, events: object[]}>} args.calendars raw calendar responses
 * @param {{iglesia?: object, eventos?: Record<string, object>}} [args.lectura] what Claude read from the
 *   titles and church-info.md: the church facts, and per calendar event id its clean `titulo`, `hora` +
 *   `horaFuente`, `lugar` + `lugarFuente`, `ministerio`, `modalidad`, and optional `horaNota`. The card's own
 *   time and place win over it. Its `recurrentes` are the church's recurring services of the week (`dia`,
 *   `titulo`, and optional `hora`, `lugar`, `ministerio`), each announced as an event of its own. Its
 *   optional `desde` (YYYY-MM-DD, up to 6 days before the Monday) starts the run earlier.
 * @param {string|null} [args.despues] a weekday: keep only the events after that day's service (the video
 *   played at it): the days after its first occurrence in the run, and that day's own events that start after
 *   its last recurring service; slugs are still those of the whole run
 * @param {Record<string, object>} [args.overrides] human answers keyed by slug
 * @returns {{doc: object, problemas: string[]}}
 */
export function normalizeWeek({ week, calendars, lectura = {}, overrides = {}, despues = null }) {
  const problemas = [];
  const { inicio: lunes, fin } = weekRange(week);
  const inicio = inicioDeLaCorrida(lectura.desde, lunes, problemas);
  const ids = new Set();
  const descartados = [];
  let eventos = [];

  for (const calendario of calendars) {
    for (const raw of calendario.events ?? []) {
      ids.add(raw.id);
      if (raw.status === 'cancelled') {
        descartados.push(descartar(raw, 'cancelled'));
        continue;
      }
      if (raw.eventType && raw.eventType !== 'DEFAULT') {
        descartados.push(descartar(raw, `event type ${raw.eventType}`));
        continue;
      }
      const fechas = leerFechas(raw, calendario.timeZone);
      if (!fechas || !raw.summary) {
        descartados.push(descartar(raw, 'no usable start date or title'));
        continue;
      }
      const { fecha, fechaFin, horaTarjeta } = fechas;
      if ((fechaFin ?? fecha) < inicio || fecha > fin) {
        descartados.push(descartar(raw, 'outside the week'));
        continue;
      }

      const leido = lectura.eventos?.[raw.id] ?? {};
      let [hora, horaFuente] = [horaTarjeta, horaTarjeta ? 'calendario' : null];
      if (!hora && leido.hora) {
        if (isHora(leido.hora)) [hora, horaFuente] = [leido.hora, leido.horaFuente];
        else problemas.push(`lectura "${raw.id}": hora "${leido.hora}" is not HH:MM (24h), ignored`);
      }
      const lugarTarjeta = raw.location?.trim();
      const titulo = leido.titulo?.trim() || raw.summary;
      const virtual = leido.modalidad === 'virtual';

      eventos.push({
        eventId: raw.id ?? null,
        origen: 'calendario',
        titulo,
        base: slugify(titulo) || 'evento',
        ministerio: leido.ministerio ?? null,
        fecha,
        fechaFin,
        diaSemana: diaSemana(fecha),
        hora,
        horaFuente,
        horaNota: leido.horaNota,
        lugar: lugarTarjeta || leido.lugar || null,
        lugarFuente: lugarTarjeta ? 'calendario' : leido.lugar ? leido.lugarFuente : null,
        modalidad: virtual ? 'virtual' : 'presencial',
        plantilla: virtual ? 'virtual' : 'estandar',
      });
    }
  }

  for (const id of Object.keys(lectura.eventos ?? {})) {
    if (!ids.has(id)) problemas.push(`lectura "${id}": no calendar event has that id`);
  }

  for (const servicio of lectura.recurrentes ?? []) {
    eventos.push(...eventosRecurrentes(servicio, inicio, fin, problemas));
  }

  eventos.sort(comparar);
  asignarSlugs(eventos);
  eventos = aplicarOverrides(eventos, overrides, problemas, descartados);
  eventos.sort(comparar);

  // A service's video keeps only what comes after that day, with the slugs the whole run gave them.
  let inicioTexto = inicio;
  // On that day itself only what starts after its last recurring service stays (Sunday's evening vigil
  // in the video for Sunday morning); a day with no recurring service of its own keeps nothing of itself.
  if (despues) {
    const corte = fechasDelDia(despues, inicio, fin)[0];
    if (!corte) {
      problemas.push(`despues "${despues}" is not a weekday, the whole run is kept`);
    } else {
      const ultimoServicio = eventos
        .filter((e) => e.fecha === corte && e.origen === 'recurrente' && e.hora)
        .map((e) => e.hora)
        .sort()
        .at(-1);
      eventos = eventos.filter((e) => e.fecha > corte || (e.fecha === corte && ultimoServicio && e.hora > ultimoServicio));
      inicioTexto = eventos.some((e) => e.fecha === corte) ? corte : addDays(corte, 1);
    }
  }

  const iglesia = lectura.iglesia ?? {};
  const nombres = [...new Set(calendars.map((c) => c.summary).filter(Boolean))];
  const doc = {
    week,
    semana: { inicio: inicioTexto, fin, texto: semanaTexto(inicioTexto, fin), hablada: semanaHablada(inicioTexto, fin) },
    calendar: nombres.join(' + '),
    timezone: calendars[0]?.timeZone ?? null,
    iglesia: {
      nombre: iglesia.nombre ?? null,
      direccion: iglesia.direccion ?? null,
      lugarPorDefecto: iglesia.lugarPorDefecto ?? null,
      llamadoAccion: iglesia.llamadoAccion ?? null,
      despedida: iglesia.despedida ?? null,
    },
    events: eventos.map(registroFinal),
    descartados,
  };
  return { doc, problemas };
}
