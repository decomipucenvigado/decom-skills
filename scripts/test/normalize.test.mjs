import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeWeek } from '../core/normalize.mjs';
import { auditEvents } from '../core/audit.mjs';

const fixture = (name) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const semanaEjemplo = JSON.parse(readFileSync(fixture('ejemplo-w39.json'), 'utf8'));

// A fictional church. What Claude writes to lectura.json after reading the calendar
// and church-info.md: the church facts, and one reading per event keyed by its id.
const IGLESIA = {
  nombre: 'Iglesia Ejemplo',
  direccion: 'Calle 1 #2-3, Ciudad Ejemplo',
  lugarPorDefecto: 'Salón Principal',
  llamadoAccion: 'Te esperamos',
  despedida: 'Dios te bendiga',
};
const leer = (summary, leido) => ({ iglesia: IGLESIA, eventos: { [`id-${summary}`]: leido } });
const CULTO = leer('Culto de jóvenes', {
  hora: '18:45',
  horaFuente: 'church-info.md',
  lugar: 'Salón Principal',
  lugarFuente: 'church-info.md',
});

const allDay = (summary, start, endExclusive, extra = {}) => ({
  id: `id-${summary}`,
  summary,
  status: 'confirmed',
  eventType: 'DEFAULT',
  start: { date: `${start}T00:00:00Z` },
  end: { date: `${endExclusive}T00:00:00Z` },
  ...extra,
});
const timed = (summary, start, end, extra = {}) => ({
  id: `id-${summary}`,
  summary,
  status: 'confirmed',
  eventType: 'DEFAULT',
  start: { dateTime: start, timeZone: 'America/Bogota' },
  end: { dateTime: end, timeZone: 'America/Bogota' },
  ...extra,
});
const cal = (events, summary = 'Calendario Uno', timeZone = 'America/Bogota') => ({
  summary,
  timeZone,
  events,
});
const run = (events, opts = {}) =>
  normalizeWeek({
    week: '2026-W39',
    calendars: [cal(events)],
    lectura: {},
    overrides: {},
    ...opts,
  });
const only = (events, opts) => run(events, opts).doc.events[0];

test('a week of three all-day events merges what Claude read and leaves the rest as the calendar has it', () => {
  const [oracion, refam, charla] = semanaEjemplo.events;
  const { doc } = normalizeWeek({
    week: '2026-W39',
    calendars: [semanaEjemplo],
    lectura: {
      iglesia: IGLESIA,
      eventos: {
        [oracion.id]: { titulo: 'Oracion virtual', ministerio: 'Jóvenes', modalidad: 'virtual', lugar: 'Virtual', lugarFuente: 'titulo' },
        [charla.id]: {
          titulo: 'Charla familias',
          ministerio: 'Familias',
          hora: '19:00',
          horaFuente: 'church-info.md',
          lugar: 'Salón Principal',
          lugarFuente: 'church-info.md',
        },
      },
    },
    overrides: {},
  });
  assert.equal(doc.week, '2026-W39');
  assert.equal(doc.calendar, 'Iglesia Ejemplo II-2026');
  assert.equal(doc.timezone, 'America/Bogota');
  assert.equal(doc.semana.texto, 'Semana del 21 al 27 de septiembre');
  assert.equal(doc.semana.hablada, 'del veintiuno al veintisiete de septiembre');
  assert.deepEqual(doc.iglesia, IGLESIA);
  assert.deepEqual(doc.events.map((e) => e.slug), ['oracion-virtual', 'jovenes-refam-juvenil', 'charla-familias']);

  const charla_ = doc.events[2];
  assert.equal(charla_.fecha, '2026-09-25'); // not shifted to the 24th by UTC midnight
  assert.equal(charla_.diaSemana, 'viernes');
  assert.equal(charla_.fechaTexto, 'viernes 25 de septiembre');
  assert.equal(charla_.ministerio, 'Familias');
  assert.equal(charla_.hora, '19:00');
  assert.equal(charla_.horaFuente, 'church-info.md');
  assert.equal(charla_.horaTexto, '7:00 p. m.');
  assert.equal(charla_.lugar, 'Salón Principal');
  assert.equal(charla_.lugarFuente, 'church-info.md');
  assert.equal(charla_.modalidad, 'presencial');
  assert.equal(charla_.plantilla, 'estandar');

  const oracion_ = doc.events[0];
  assert.equal(oracion_.titulo, 'Oracion virtual');
  assert.equal(oracion_.modalidad, 'virtual');
  assert.equal(oracion_.plantilla, 'virtual');
  assert.equal(oracion_.lugar, 'Virtual');
  assert.equal(oracion_.lugarFuente, 'titulo');
  assert.equal(oracion_.hora, null);

  const refam_ = doc.events[1]; // no reading: the raw title and nothing invented
  assert.equal(refam_.titulo, '(Jóvenes) - Refam juvenil');
  assert.equal(refam_.ministerio, null);
  assert.equal(refam_.hora, null);
  assert.equal(refam_.lugar, null);
});

test('without a reading nothing about the church or the event is invented', () => {
  const { doc } = run([allDay('Charla familias', '2026-09-25', '2026-09-26')]);
  assert.deepEqual(doc.iglesia, { nombre: null, direccion: null, lugarPorDefecto: null, llamadoAccion: null, despedida: null });
  const e = doc.events[0];
  assert.equal(e.titulo, 'Charla familias');
  assert.equal(e.lugar, null);
  assert.equal(e.lugarFuente, null);
  assert.equal(e.ministerio, null);
  assert.equal(e.hora, null);
});

test('the timezone comes from the calendar, not from the code', () => {
  const { doc } = normalizeWeek({
    week: '2026-W39',
    calendars: [
      cal(
        [
          {
            id: 'x',
            summary: 'Culto',
            status: 'confirmed',
            eventType: 'DEFAULT',
            start: { dateTime: '2026-09-27T01:30:00Z' },
            end: { dateTime: '2026-09-27T03:00:00Z' },
          },
        ],
        'Otro calendario',
        'America/Mexico_City',
      ),
    ],
    lectura: {},
    overrides: {},
  });
  assert.equal(doc.timezone, 'America/Mexico_City');
  assert.equal(doc.events[0].fecha, '2026-09-26');
  assert.equal(doc.events[0].hora, '19:30');
});

test('a timed card gives the time with provenance "calendario" and beats a time Claude read elsewhere', () => {
  const titulo = 'Integración maestros Adolescentes';
  const e = only([timed(titulo, '2026-09-26T19:00:00-05:00', '2026-09-26T20:00:00-05:00')], {
    lectura: leer(titulo, { hora: '20:00', horaFuente: 'titulo' }),
  });
  assert.equal(e.fecha, '2026-09-26');
  assert.equal(e.hora, '19:00');
  assert.equal(e.horaFuente, 'calendario');
  assert.equal(e.horaTexto, '7:00 p. m.');
  assert.equal(e.horaHablada, 'a las siete de la noche');
});

test('a card dateTime in UTC is converted to the calendar local time and date', () => {
  const e = only([
    {
      id: 'x',
      summary: 'Vigilia',
      status: 'confirmed',
      eventType: 'DEFAULT',
      start: { dateTime: '2026-09-27T00:30:00Z' },
      end: { dateTime: '2026-09-27T02:00:00Z' },
    },
  ]);
  assert.equal(e.fecha, '2026-09-26');
  assert.equal(e.hora, '19:30');
});

test('a place on the card is used and labelled "calendario", over one Claude read', () => {
  const e = only([timed('Culto', '2026-09-26T19:00:00-05:00', '2026-09-26T20:00:00-05:00', { location: 'Salón 2' })], {
    lectura: leer('Culto', { lugar: 'Salón Principal', lugarFuente: 'church-info.md' }),
  });
  assert.equal(e.lugar, 'Salón 2');
  assert.equal(e.lugarFuente, 'calendario');
});

test('a reading with a malformed time or an id that names no event is a problem, not silently used', () => {
  const { doc, problemas } = run([allDay('Charla familias', '2026-09-25', '2026-09-26')], {
    lectura: {
      eventos: {
        'id-Charla familias': { hora: '7pm', horaFuente: 'titulo' },
        'id-Charla famlias': { hora: '19:00', horaFuente: 'titulo' },
      },
    },
  });
  assert.equal(doc.events[0].hora, null);
  assert.equal(problemas.length, 2);
  assert.match(problemas[0], /7pm/);
  assert.match(problemas[1], /Charla famlias/);
});

test('events outside the week, cancelled and non-default types are dropped and listed', () => {
  const { doc } = run([
    allDay('Antes', '2026-09-19', '2026-09-20'),
    allDay('Después', '2026-09-28', '2026-09-29'),
    allDay('Cancelado', '2026-09-25', '2026-09-26', { status: 'cancelled' }),
    allDay('Cumple', '2026-09-25', '2026-09-26', { eventType: 'BIRTHDAY' }),
    allDay('Dentro', '2026-09-25', '2026-09-26'),
  ]);
  assert.deepEqual(doc.events.map((e) => e.titulo), ['Dentro']);
  assert.deepEqual(doc.descartados.map((d) => d.titulo).sort(), ['Antes', 'Cancelado', 'Cumple', 'Después']);
});

test('a multi-day all-day event keeps its start and inclusive end', () => {
  const e = only([allDay('Congreso', '2026-09-25', '2026-09-28')]);
  assert.equal(e.fecha, '2026-09-25');
  assert.equal(e.fechaFin, '2026-09-27');
  assert.equal(e.fechaTexto, 'del viernes 25 al domingo 27 de septiembre');
});

test('a single-day all-day event has no fechaFin', () => {
  assert.equal('fechaFin' in only([allDay('Charla', '2026-09-25', '2026-09-26')]), false);
});

test('duplicate titles get the weekday appended to keep slugs unique', () => {
  const { doc } = run([
    allDay('Oración virtual', '2026-09-21', '2026-09-22'),
    allDay('Oración virtual', '2026-09-23', '2026-09-24'),
  ]);
  assert.deepEqual(doc.events.map((e) => e.slug), ['oracion-virtual-lunes', 'oracion-virtual-miercoles']);
});

test('events are sorted by date, then time, then title', () => {
  const { doc } = run([
    allDay('Zeta', '2026-09-25', '2026-09-26'),
    timed('Tarde', '2026-09-25T19:00:00-05:00', '2026-09-25T20:00:00-05:00'),
    timed('Temprano', '2026-09-25T08:00:00-05:00', '2026-09-25T09:00:00-05:00'),
    allDay('Alfa', '2026-09-24', '2026-09-25'),
  ]);
  assert.deepEqual(doc.events.map((e) => e.titulo), ['Alfa', 'Temprano', 'Tarde', 'Zeta']);
});

test('two calendars are merged and both names recorded', () => {
  const { doc } = normalizeWeek({
    week: '2026-W39',
    calendars: [cal([allDay('A', '2026-09-25', '2026-09-26')], 'Uno'), cal([allDay('B', '2026-09-25', '2026-09-26')], 'Dos')],
    lectura: {},
    overrides: {},
  });
  assert.equal(doc.calendar, 'Uno + Dos');
  assert.equal(doc.events.length, 2);
});

test('an override supplies a time with provenance "usuario"', () => {
  const e = only([allDay('Charla familias', '2026-09-25', '2026-09-26')], {
    overrides: { 'charla-familias': { hora: '19:00' } },
  });
  assert.equal(e.hora, '19:00');
  assert.equal(e.horaFuente, 'usuario');
  assert.equal(e.horaHablada, 'a las siete de la noche');
});

test('an override can pick the template and place, and omit an event', () => {
  const { doc } = run(
    [allDay('Charla familias', '2026-09-25', '2026-09-26'), allDay('Ayuno', '2026-09-26', '2026-09-27')],
    { overrides: { 'charla-familias': { plantilla: 'destacado', lugar: 'Salón 2' }, ayuno: { omitir: true } } },
  );
  assert.equal(doc.events.length, 1);
  assert.equal(doc.events[0].plantilla, 'destacado');
  assert.equal(doc.events[0].lugar, 'Salón 2');
  assert.equal(doc.events[0].lugarFuente, 'usuario');
  assert.deepEqual(doc.descartados.map((d) => d.titulo), ['Ayuno']);
});

test('an override for an unknown slug is a problem, not silently ignored', () => {
  const { problemas } = run([allDay('Charla familias', '2026-09-25', '2026-09-26')], {
    overrides: { 'charla-famlias': { hora: '19:00' } },
  });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /charla-famlias/);
});

test('an override with a malformed time is a problem and does not set the time', () => {
  const { doc, problemas } = run([allDay('Charla familias', '2026-09-25', '2026-09-26')], {
    overrides: { 'charla-familias': { hora: '7pm' } },
  });
  assert.equal(doc.events[0].hora, null);
  assert.match(problemas[0], /7pm/);
});

test('an override with hora null drops a time Claude read from church-info.md', () => {
  const { doc, problemas } = run([allDay('Culto de jóvenes', '2026-09-26', '2026-09-27')], {
    lectura: CULTO,
    overrides: { 'culto-de-jovenes': { hora: null } },
  }); // without the override it keeps 18:45
  const e = doc.events[0];
  assert.deepEqual(problemas, []);
  assert.equal(e.hora, null);
  assert.equal(e.horaFuente, null);
  assert.equal(e.horaTexto, null);
  assert.equal(e.horaHablada, null);
  assert.match(e.horaNota, /asked/);
});

test('an override with hora null drops a time from the calendar card', () => {
  const e = only([timed('Integración maestros', '2026-09-26T19:00:00-05:00', '2026-09-26T20:00:00-05:00')], {
    overrides: { 'integracion-maestros': { hora: null } },
  });
  assert.equal(e.hora, null);
  assert.equal(e.horaFuente, null);
  assert.equal(e.horaTexto, null);
});

test('an override with lugar null drops the default place', () => {
  const e = only([allDay('Culto de jóvenes', '2026-09-26', '2026-09-27')], {
    lectura: CULTO,
    overrides: { 'culto-de-jovenes': { lugar: null } },
  });
  assert.equal(e.lugar, null);
  assert.equal(e.lugarFuente, null);
});

test('a place dropped by lugar null says why in the record; a place that was never there says nothing', () => {
  const dropped = only([allDay('Culto de jóvenes', '2026-09-26', '2026-09-27')], {
    lectura: CULTO,
    overrides: { 'culto-de-jovenes': { lugar: null } },
  });
  assert.match(dropped.lugarNota, /asked/);

  const never = only([allDay('Charla familias', '2026-09-25', '2026-09-26')]);
  assert.equal(never.lugar, null);
  assert.equal(never.lugarNota, undefined);
});

test('an empty or malformed value is not the same as null: the event keeps what the sources gave it', () => {
  const { doc, problemas } = run([allDay('Culto de jóvenes', '2026-09-26', '2026-09-27')], {
    lectura: CULTO,
    overrides: { 'culto-de-jovenes': { hora: '', lugar: '' } },
  });
  assert.equal(doc.events[0].hora, '18:45');
  assert.equal(doc.events[0].horaFuente, 'church-info.md');
  assert.equal(doc.events[0].lugar, 'Salón Principal');
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /hora/);

  const numero = run([allDay('Culto de jóvenes', '2026-09-26', '2026-09-27')], {
    lectura: CULTO,
    overrides: { 'culto-de-jovenes': { hora: 1900 } },
  });
  assert.equal(numero.doc.events[0].hora, '18:45');
  assert.match(numero.problemas[0], /1900/);
});

test('overrides without hora or lugar leave the time and place alone', () => {
  const e = only([allDay('Culto de jóvenes', '2026-09-26', '2026-09-27')], {
    lectura: CULTO,
    overrides: { 'culto-de-jovenes': { plantilla: 'estandar' } },
  });
  assert.equal(e.hora, '18:45');
  assert.equal(e.horaFuente, 'church-info.md');
  assert.equal(e.lugar, 'Salón Principal');
  assert.equal(e.lugarFuente, 'church-info.md');
});

test('a week built with null overrides passes the audit, with notices that say why', () => {
  const { doc, problemas } = run(
    [allDay('Ayuno', '2026-09-26', '2026-09-27'), allDay('2pm Ecos del Futuro', '2026-09-27', '2026-09-28')],
    {
      lectura: {
        eventos: {
          'id-2pm Ecos del Futuro': {
            titulo: 'Ecos del Futuro',
            hora: '14:00',
            horaFuente: 'titulo',
            lugar: 'Salón Principal',
            lugarFuente: 'church-info.md',
          },
        },
      },
      overrides: { ayuno: { hora: null, lugar: null }, 'ecos-del-futuro': { hora: null } },
    },
  );
  assert.deepEqual(problemas, []);
  const { errores, avisos } = auditEvents(doc);
  assert.deepEqual(errores, []);
  const sinHora = avisos.filter((a) => a.regla === 'sin-hora');
  assert.deepEqual(sinHora.map((a) => a.slug).sort(), ['ayuno', 'ecos-del-futuro']);
  for (const a of sinHora) {
    assert.match(a.mensaje, /asked/);
    assert.doesNotMatch(a.mensaje, /unknown/);
  }
  assert.deepEqual(avisos.filter((a) => a.regla === 'sin-lugar').map((a) => a.slug), ['ayuno']);
});

// ---- recurring services (what Claude reads from church-info.md; code only places them in the week) ----

const MARTES = { dia: 'martes', titulo: 'Culto dirigido por Damas', hora: '18:45', lugar: 'Salón Principal', ministerio: 'Damas' };
const SABADO_AYUNO = { dia: 'Sábado', titulo: 'Ayuno general', hora: '07:00', lugar: 'Salón Principal' };
const SABADO_NOCHE = { dia: 'sabado', titulo: 'Culto dirigido por Jóvenes', hora: '18:45', lugar: 'Salón Principal', ministerio: 'Jóvenes' };
const recurrentes = (...servicios) => ({ lectura: { iglesia: IGLESIA, recurrentes: servicios } });

test('a recurring service becomes an event on its weekday of the week, with church-info.md as its source', () => {
  const e = only([], recurrentes(MARTES));
  assert.equal(e.origen, 'recurrente');
  assert.equal(e.eventId, null);
  assert.equal(e.titulo, 'Culto dirigido por Damas');
  assert.equal(e.ministerio, 'Damas');
  assert.equal(e.fecha, '2026-09-22');
  assert.equal(e.diaSemana, 'martes');
  assert.equal(e.fechaTexto, 'martes 22 de septiembre');
  assert.equal(e.hora, '18:45');
  assert.equal(e.horaTexto, '6:45 p. m.');
  assert.equal(e.horaFuente, 'church-info.md');
  assert.equal(e.lugar, 'Salón Principal');
  assert.equal(e.lugarFuente, 'church-info.md');
  assert.equal(e.modalidad, 'presencial');
  assert.equal(e.plantilla, 'estandar');
  assert.equal('fechaFin' in e, false);
});

test('a calendar event carries origen "calendario"', () => {
  assert.equal(only([allDay('Charla familias', '2026-09-25', '2026-09-26')]).origen, 'calendario');
});

test('a week with no calendar events still has its recurring services', () => {
  const { doc, problemas } = run([], recurrentes(MARTES, SABADO_NOCHE));
  assert.deepEqual(problemas, []);
  assert.deepEqual(doc.events.map((e) => e.fecha), ['2026-09-22', '2026-09-26']);
});

test('the day may be written with or without accent, in any case, singular or plural, as church-info.md has it', () => {
  const { doc, problemas } = run([], recurrentes({ ...MARTES, dia: 'MARTES' }, { ...SABADO_AYUNO, dia: 'Sabados' }, { ...MARTES, dia: 'Domingos', hora: '09:00' }));
  assert.deepEqual(problemas, []);
  assert.deepEqual(doc.events.map((e) => e.diaSemana).sort(), ['domingo', 'martes', 'sábado']);
});

test('a day that names no weekday is a problem and adds no event', () => {
  const { doc, problemas } = run([], recurrentes({ ...MARTES, dia: 'marte' }));
  assert.deepEqual(doc.events, []);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /marte/);
});

test('a service without a title is a problem and adds no event', () => {
  const { doc, problemas } = run([], recurrentes({ dia: 'jueves', hora: '18:45' }));
  assert.deepEqual(doc.events, []);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /jueves/);
});

test('a malformed time is a problem and the service is announced without a time', () => {
  const { doc, problemas } = run([], recurrentes({ ...MARTES, hora: '6:45 PM' }));
  assert.equal(doc.events[0].hora, null);
  assert.equal(doc.events[0].horaFuente, null);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /6:45 PM/);
});

test('a service with no place is announced without one, and says nothing invented about it', () => {
  const e = only([], recurrentes({ dia: 'martes', titulo: 'Culto', hora: '18:45' }));
  assert.equal(e.lugar, null);
  assert.equal(e.lugarFuente, null);
  assert.equal(e.ministerio, null);
});

test('the slug of a service comes from its day and start time, not from the title or the rest of the week', () => {
  const solos = run([], recurrentes(SABADO_AYUNO, SABADO_NOCHE)).doc.events;
  assert.deepEqual(solos.map((e) => e.slug), ['servicio-sabado-0700', 'servicio-sabado-1845']);

  const conOtros = run(
    [allDay('Culto dirigido por Jóvenes', '2026-09-26', '2026-09-27'), allDay('Ayuno general', '2026-09-26', '2026-09-27')],
    recurrentes({ ...SABADO_AYUNO, titulo: 'Ayuno' }, { ...SABADO_NOCHE, titulo: 'Culto de jóvenes' }),
  ).doc.events.filter((e) => e.origen === 'recurrente');
  assert.deepEqual(conOtros.map((e) => e.slug), ['servicio-sabado-0700', 'servicio-sabado-1845']);
});

test('a service without a time gets a slug from its day alone', () => {
  assert.equal(only([], recurrentes({ dia: 'jueves', titulo: 'Oración y Enseñanza' })).slug, 'servicio-jueves');
});

test('a card on a service day never displaces the service: whether they overlap is Claude\'s call, not the code\'s', () => {
  const { doc } = run(
    [allDay('Culto de caballeros', '2026-09-26', '2026-09-27')],
    recurrentes(SABADO_NOCHE),
  );
  assert.deepEqual(doc.events.map((e) => [e.origen, e.titulo]), [
    ['recurrente', 'Culto dirigido por Jóvenes'], // timed, so it sorts before the untimed card
    ['calendario', 'Culto de caballeros'],
  ]);
});

test('an override can omit a recurring service for the week, by its slug', () => {
  const { doc, problemas } = run([], { ...recurrentes(MARTES, SABADO_NOCHE), overrides: { 'servicio-martes-1845': { omitir: true } } });
  assert.deepEqual(problemas, []);
  assert.deepEqual(doc.events.map((e) => e.slug), ['servicio-sabado-1845']);
  assert.deepEqual(doc.descartados.map((d) => d.titulo), ['Culto dirigido por Damas']);
});

test('a person\'s time for a recurring service beats the schedule and is labelled "usuario"', () => {
  const e = only([], { ...recurrentes(MARTES), overrides: { 'servicio-martes-1845': { hora: '19:30' } } });
  assert.equal(e.hora, '19:30');
  assert.equal(e.horaFuente, 'usuario');
});

test('recurring services pass the audit with no errors and no notices', () => {
  const { doc } = run([], recurrentes(MARTES, SABADO_AYUNO));
  assert.equal(doc.events.length, 2);
  assert.deepEqual(auditEvents(doc), { errores: [], avisos: [] });
});

// The person may ask for a run that starts on the Sunday before the week (today's Saturday
// run, say, so tomorrow's service is announced too). lectura.json's `desde` moves the start.
const DOMINGO_ANTES = '2026-09-20';

test('lectura.desde starts the run on an earlier day: its cards come in and the week text says it', () => {
  const { doc, problemas } = run(
    [allDay('Bazar', '2026-09-20', '2026-09-21'), allDay('Antes', '2026-09-19', '2026-09-20')],
    { lectura: { iglesia: IGLESIA, desde: DOMINGO_ANTES } },
  );
  assert.deepEqual(problemas, []);
  assert.deepEqual(doc.events.map((e) => e.titulo), ['Bazar']);
  assert.equal(doc.semana.inicio, DOMINGO_ANTES);
  assert.equal(doc.semana.fin, '2026-09-27');
  assert.equal(doc.semana.hablada, 'del veinte al veintisiete de septiembre');
});

test('with lectura.desde a recurring service lands on every matching day of the run', () => {
  const { doc, problemas } = run([], {
    lectura: { iglesia: IGLESIA, desde: DOMINGO_ANTES, recurrentes: [{ dia: 'domingo', titulo: 'Culto', hora: '09:00' }] },
  });
  assert.deepEqual(problemas, []);
  assert.deepEqual(doc.events.map((e) => e.fecha), ['2026-09-20', '2026-09-27']);
  assert.equal(new Set(doc.events.map((e) => e.slug)).size, 2);
});

test('lectura.desde that is malformed, after the Monday or more than a week early is a problem and is ignored', () => {
  for (const desde of ['20/09/2026', '2026-09-23', '2026-09-13']) {
    const { doc, problemas } = run([], { lectura: { iglesia: IGLESIA, desde } });
    assert.equal(doc.semana.inicio, '2026-09-21', desde);
    assert.equal(problemas.length, 1, desde);
    assert.match(problemas[0], /desde/);
  }
});

// A service's video ("despues": the video played at Tuesday's service) announces only what comes after that day.
test('despues keeps only the events after that weekday, with the slugs the whole week gave them', () => {
  const { doc, problemas } = run(
    [allDay('Lunes', '2026-09-21', '2026-09-22'), allDay('Martes', '2026-09-22', '2026-09-23'), allDay('Jueves', '2026-09-24', '2026-09-25')],
    { lectura: { iglesia: IGLESIA, recurrentes: [{ dia: 'domingo', titulo: 'Culto', hora: '09:00' }] }, despues: 'martes' },
  );
  assert.deepEqual(problemas, []);
  assert.deepEqual(doc.events.map((e) => e.slug), ['jueves', 'servicio-domingo-0900']);
  assert.equal(doc.semana.inicio, '2026-09-23');
  assert.equal(doc.semana.hablada, 'del veintitrés al veintisiete de septiembre');
});

test('despues keeps the slugs of a run that starts early, so the images of the whole run still match', () => {
  const { doc } = run([], {
    lectura: { iglesia: IGLESIA, desde: '2026-09-20', recurrentes: [{ dia: 'domingo', titulo: 'Culto', hora: '09:00' }] },
    despues: 'jueves',
  });
  assert.deepEqual(doc.events.map((e) => e.fecha), ['2026-09-27']);
  assert.equal(doc.events[0].slug, 'servicio-domingo-0900-domingo-2');
});

test('despues that is not a weekday is a problem and keeps the whole run', () => {
  const { doc, problemas } = run([allDay('Lunes', '2026-09-21', '2026-09-22')], { lectura: { iglesia: IGLESIA }, despues: 'marte' });
  assert.equal(doc.events.length, 1);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /marte/);
});
