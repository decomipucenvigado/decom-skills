// Spanish (Colombia) text and calendar helpers. Pure functions, no I/O.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const HORA_PALABRA = [
  null, 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis',
  'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
];
const NUMERO_PALABRA = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const DECENA_PALABRA = { 3: 'treinta', 4: 'cuarenta', 5: 'cincuenta' };

const pad2 = (n) => String(n).padStart(2, '0');

export const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export const slugify = (s) =>
  stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Strict 24-hour "HH:MM", the only clock format events.json may carry. */
export const isHora = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// ---- dates ---------------------------------------------------------------

const toUTC = (fecha) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

export const addDays = (fecha, n) => {
  const d = toUTC(fecha);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
};

export const diaSemana = (fecha) => DIAS[toUTC(fecha).getUTCDay()];

const partes = (fecha) => {
  const d = toUTC(fecha);
  return { dia: d.getUTCDate(), mes: MESES[d.getUTCMonth()], anio: d.getUTCFullYear() };
};

export const fechaTexto = (fecha) => `${diaSemana(fecha)} ${partes(fecha).dia} de ${partes(fecha).mes}`;

export function rangoTexto(inicio, fin) {
  const a = partes(inicio);
  const b = partes(fin);
  if (a.mes === b.mes && a.anio === b.anio) {
    return `del ${diaSemana(inicio)} ${a.dia} al ${diaSemana(fin)} ${b.dia} de ${a.mes}`;
  }
  return `del ${fechaTexto(inicio)} al ${fechaTexto(fin)}`;
}

/** Canonical Spanish weekday for a word like "Sabados" or "miercoles", else null. */
export function nombreDia(palabra) {
  const w = stripAccents(palabra).toLowerCase().replace(/(sabado|domingo)s$/, '$1');
  return DIAS.find((d) => stripAccents(d) === w) ?? null;
}

// ---- ISO weeks -----------------------------------------------------------

export function isoWeek(fecha) {
  const d = toUTC(fecha);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // Thursday of this ISO week
  const anio = d.getUTCFullYear();
  const diaDelAnio = (d - Date.UTC(anio, 0, 1)) / 86400000 + 1;
  return `${anio}-W${pad2(Math.ceil(diaDelAnio / 7))}`;
}

export function weekRange(week) {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) throw new Error(`Week must look like 2026-W39, got "${week}"`);
  const [anio, semana] = [Number(m[1]), Number(m[2])];
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const lunes1 = addDays(fromUTC(jan4), -((jan4.getUTCDay() + 6) % 7));
  const inicio = addDays(lunes1, (semana - 1) * 7);
  return { inicio, fin: addDays(inicio, 6) };
}

/**
 * A run id is a week ("2026-W42"), or a week plus the service day whose video it is
 * ("2026-W42-martes": the video played at Tuesday's service, announcing only what comes after).
 */
export function corrida(id) {
  const m = /^(\d{4}-W\d{2})(?:-([a-z]+))?$/.exec(id ?? '');
  if (!m) throw new Error(`A run must look like 2026-W39 or 2026-W39-martes, got "${id}"`);
  return { week: m[1], despues: m[2] ?? null };
}

export function semanaTexto(inicio, fin) {
  if (inicio === fin) return `${diaSemana(inicio)[0].toUpperCase()}${diaSemana(inicio).slice(1)} ${partes(inicio).dia} de ${partes(inicio).mes}`;
  const a = partes(inicio);
  const b = partes(fin);
  return a.mes === b.mes
    ? `Semana del ${a.dia} al ${b.dia} de ${a.mes}`
    : `Semana del ${a.dia} de ${a.mes} al ${b.dia} de ${b.mes}`;
}

// ---- clock times ---------------------------------------------------------

export function horaPartes(hora) {
  const [h24, minutos] = hora.split(':').map(Number);
  return { h24, minutos, h12: h24 % 12 || 12 };
}

/** Part of the day a time is spoken in: mañana, mediodía, tarde, noche, madrugada. */
export function periodoDe(hora) {
  const { h24, minutos } = horaPartes(hora);
  if (h24 === 12 && minutos === 0) return 'mediodía';
  if (h24 === 0) return 'noche';
  if (h24 < 5) return 'madrugada';
  if (h24 < 12) return 'mañana';
  if (h24 < 19) return 'tarde';
  return 'noche';
}

/** The hour as it is spoken: 1 -> "una", 7 -> "siete". */
export const horaPalabra = (h12) => HORA_PALABRA[h12];

export function horaTexto(hora) {
  const { h24, minutos, h12 } = horaPartes(hora);
  return `${h12}:${pad2(minutos)} ${h24 >= 12 ? 'p. m.' : 'a. m.'}`;
}

const numeroEnPalabras = (n) =>
  n < 30 ? NUMERO_PALABRA[n] : DECENA_PALABRA[Math.floor(n / 10)] + (n % 10 ? ` y ${NUMERO_PALABRA[n % 10]}` : '');

export function horaHablada(hora) {
  const { minutos, h12 } = horaPartes(hora);
  const prep = h12 === 1 ? 'a la' : 'a las';
  const extra = minutos === 0 ? '' : minutos === 15 ? ' y cuarto' : minutos === 30 ? ' y media' : ` y ${numeroEnPalabras(minutos)}`;
  const periodo = periodoDe(hora);
  return `${prep} ${HORA_PALABRA[h12]}${extra} ${periodo === 'mediodía' ? 'del mediodía' : `de la ${periodo}`}`;
}

// ---- spoken dates --------------------------------------------------------

/** A day of the month as it is spoken: 1 -> "primero", 21 -> "veintiuno". */
export const diaHablado = (n) => (n === 1 ? 'primero' : numeroEnPalabras(n));

/** The week range as it is spoken: "del veintiuno al veintisiete de septiembre". */
export function semanaHablada(inicio, fin) {
  if (inicio === fin) return `del ${diaSemana(inicio)} ${diaHablado(partes(inicio).dia)} de ${partes(inicio).mes}`;
  const a = partes(inicio);
  const b = partes(fin);
  return a.mes === b.mes
    ? `del ${diaHablado(a.dia)} al ${diaHablado(b.dia)} de ${a.mes}`
    : `del ${diaHablado(a.dia)} de ${a.mes} al ${diaHablado(b.dia)} de ${b.mes}`;
}
