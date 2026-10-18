import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanGuion, checkGuion } from '../core/guion.mjs';

// Church facts reach the checker as options taken from church-info.md.
const IGLESIA = { lugarPorDefecto: 'Salón Principal', llamadoAccion: 'Te esperamos' };

const conHora = {
  titulo: 'Culto de jóvenes',
  diaSemana: 'sábado',
  fechaTexto: 'sábado 26 de septiembre',
  hora: '18:45',
  horaTexto: '6:45 p. m.',
  horaHablada: 'a las seis y cuarenta y cinco de la tarde',
  lugar: 'Salón Principal',
  modalidad: 'presencial',
};
const sinHora = {
  titulo: 'Charla familias',
  diaSemana: 'viernes',
  fechaTexto: 'viernes 25 de septiembre',
  hora: null,
  horaTexto: null,
  horaHablada: null,
  lugar: 'Salón Principal',
  modalidad: 'presencial',
};
const virtual = { ...conHora, titulo: 'Oración virtual', modalidad: 'virtual', lugar: 'Zoom' };

const reglas = (texto, evento, iglesia = IGLESIA) =>
  checkGuion(texto, evento, iglesia).errores.map((e) => e.regla);
const avisos = (texto, evento, iglesia = IGLESIA) =>
  checkGuion(texto, evento, iglesia).avisos.map((e) => e.regla);

const BUENO_CON_HORA =
  'Jóvenes, este sábado tenemos Culto de jóvenes, a las seis y cuarenta y cinco de la tarde en el salón principal. Ven con tus amigos. Te esperamos.';
const BUENO_SIN_HORA =
  'Familias, este viernes tenemos la Charla familias. Ven con tu familia y prepárate para un tiempo muy especial de aprendizaje y unión. Te esperamos.';

test('cleanGuion drops headings and HTML comments, keeps the spoken text', () => {
  const md = '# Guion\n<!-- nota interna -->\nHola, ven este viernes.\n\nTe esperamos.\n';
  assert.equal(cleanGuion(md), 'Hola, ven este viernes. Te esperamos.');
});

test('a faithful script passes with and without a time', () => {
  assert.deepEqual(reglas(BUENO_CON_HORA, conHora), []);
  assert.deepEqual(reglas(BUENO_SIN_HORA, sinHora), []);
});

test('a time spoken for an event with no time is an error', () => {
  assert.deepEqual(reglas('Ven este viernes a las siete de la noche. Te esperamos.', sinHora), ['hora-sin-respaldo']);
  assert.ok(reglas('Ven este viernes a las 7:00 p. m. Te esperamos.', sinHora).includes('hora-sin-respaldo'));
});

test('a different spoken hour is an error', () => {
  assert.deepEqual(reglas('Este sábado a las siete de la tarde. Te esperamos.', conHora), ['hora-distinta']);
});

test('a different period of the day is an error', () => {
  assert.deepEqual(reglas('Este sábado a las seis y cuarenta y cinco de la mañana. Te esperamos.', conHora), ['periodo-distinto']);
});

test('a digit time is compared with the event time', () => {
  assert.deepEqual(reglas('Este sábado a las 6:45 p. m. Te esperamos.', conHora), []);
  assert.ok(reglas('Este sábado a las 7:00 p. m. Te esperamos.', conHora).includes('hora-distinta'));
});

test('a different weekday is an error, a matching one is fine', () => {
  assert.deepEqual(reglas('Este domingo, Culto de jóvenes. Te esperamos.', conHora), ['dia-distinto']);
  assert.deepEqual(reglas('Este sábado, Culto de jóvenes. Te esperamos.', conHora), []);
  assert.deepEqual(reglas('Este Sábado, Culto de jóvenes. Te esperamos.', conHora), []);
});

test('a number not present in the event record is an error', () => {
  assert.deepEqual(reglas('Este sábado, Culto de jóvenes. Llama al 3001234567. Te esperamos.', conHora), ['cifra-sin-respaldo']);
});

test('numbers that come from the event record are allowed', () => {
  assert.deepEqual(
    reglas('Este sábado 26 de septiembre, Culto de jóvenes Distrito 9. Te esperamos.', { ...conHora, titulo: 'Culto de jóvenes Distrito 9' }),
    [],
  );
});

test('an in-person event may not mention Zoom or virtual attendance', () => {
  assert.deepEqual(reglas('Este sábado, Culto de jóvenes por Zoom. Te esperamos.', conHora), ['lugar-distinto']);
});

test('a virtual event may not point people to the church default place', () => {
  assert.deepEqual(reglas('Este sábado, Oración virtual, ven al salón principal. Te esperamos.', virtual), ['lugar-distinto']);
  assert.deepEqual(reglas('Este sábado, Oración virtual, ven presencial. Te esperamos.', virtual), ['lugar-distinto']);
});

test('with no default place configured there is nothing to compare against', () => {
  assert.deepEqual(reglas('Este sábado, Oración virtual, ven al salón principal. Te esperamos.', virtual, {}), []);
});

test('Zoom is only allowed when the card says Zoom', () => {
  assert.deepEqual(reglas('Este sábado, Oración virtual por Zoom. Te esperamos.', virtual), []);
  assert.deepEqual(reglas('Este sábado, Oración virtual por Zoom. Te esperamos.', { ...virtual, lugar: 'Virtual' }), ['lugar-distinto']);
});

test('the formal "usted" register is an error', () => {
  assert.deepEqual(reglas('Este sábado, Culto de jóvenes. Usted está invitado. Te esperamos.', conHora), ['registro-usted']);
  assert.deepEqual(reglas('Este sábado, Culto de jóvenes. Los esperamos.', conHora), ['registro-usted']);
});

test('a missing closing call to action and an odd length are notices', () => {
  assert.deepEqual(avisos('Este sábado, Culto de jóvenes.', conHora), ['sin-cta', 'longitud']);
  assert.deepEqual(avisos(BUENO_CON_HORA, conHora), []);
});

test('the closing call to action is whatever church-info.md configures', () => {
  assert.deepEqual(avisos(BUENO_CON_HORA.replace('Te esperamos', 'Nos vemos'), conHora, { llamadoAccion: 'Nos vemos' }), []);
  assert.deepEqual(avisos(BUENO_CON_HORA, conHora, { llamadoAccion: 'Nos vemos' }), ['sin-cta']);
});

test('with no call to action configured, none is required', () => {
  assert.deepEqual(avisos(BUENO_CON_HORA.replace(' Te esperamos.', ''), conHora, {}), []);
});

test('a caller can set the length range, e.g. for a line with no closing', () => {
  const corto = 'El sábado, Culto de jóvenes, en el Salón Principal.';
  assert.deepEqual(avisos(corto, conHora, {}), ['longitud']);
  assert.deepEqual(checkGuion(corto, conHora, {}, { longitud: { min: 6, max: 30 } }).avisos, []);
});

// A congress over two days with three services a day: no single hora, but its record lists the horas.
const congreso = {
  ...sinHora,
  titulo: 'Congreso de jóvenes',
  fecha: '2026-11-01',
  fechaFin: '2026-11-02',
  diaSemana: 'domingo',
  fechaTexto: 'del domingo 1 al lunes 2 de noviembre',
  horas: ['10:00', '14:00', '17:00'],
};

test('an event with several horas may say each of them, and only those', () => {
  const linea = 'El domingo y el lunes, el congreso de jóvenes, con cultos a las diez de la mañana, a las dos de la tarde y a las cinco de la tarde.';
  assert.deepEqual(reglas(linea, congreso), []);
  assert.ok(reglas('El domingo, el congreso de jóvenes, a las tres de la tarde.', congreso).includes('hora-distinta'));
  assert.ok(reglas('El domingo, el congreso de jóvenes, a las diez de la noche.', congreso).includes('periodo-distinto'));
});

test('an event over several days may name each of its weekdays, and only those', () => {
  assert.ok(!reglas('El domingo y el lunes, el congreso de jóvenes.', congreso).includes('dia-distinto'));
  assert.ok(reglas('El martes, el congreso de jóvenes.', congreso).includes('dia-distinto'));
});
