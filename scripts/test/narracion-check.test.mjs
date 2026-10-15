import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNarracion } from '../core/narracion.mjs';
import { checkNarracion } from '../core/narracion-check.mjs';

const IGLESIA = {
  nombre: 'Iglesia Ejemplo',
  direccion: null,
  lugarPorDefecto: 'Salón Principal',
  llamadoAccion: 'Te esperamos',
  despedida: 'Dios te bendiga',
};
const EVENTOS = [
  { slug: 'oracion-virtual', titulo: 'Oración virtual', diaSemana: 'lunes', fechaTexto: 'lunes 21 de septiembre', hora: null, horaTexto: null, horaHablada: null, lugar: 'Zoom', modalidad: 'virtual' },
  { slug: 'culto-jovenes', titulo: 'Culto de jóvenes', diaSemana: 'miércoles', fechaTexto: 'miércoles 23 de septiembre', hora: '18:45', horaTexto: '6:45 p. m.', horaHablada: 'a las seis y cuarenta y cinco de la tarde', lugar: 'Salón Principal', modalidad: 'presencial' },
  { slug: 'retiro-familias', titulo: 'Retiro de familias', diaSemana: 'viernes', fechaTexto: 'viernes 25 de septiembre', hora: null, horaTexto: null, horaHablada: null, lugar: 'Salón Principal', modalidad: 'presencial' },
];
const DOC = { semana: { hablada: 'del veintiuno al veintisiete de septiembre' }, iglesia: IGLESIA, events: EVENTOS };
const UNO = { ...DOC, events: [EVENTOS[0]] };

const INTRO = 'Bienvenidos a Iglesia Ejemplo, estos son nuestros eventos del veintiuno al veintisiete de septiembre.';
const OUTRO = 'Te esperamos, Dios te bendiga.';
const ORACION = 'El lunes es la oración virtual, por Zoom.';
const CULTO = 'Después, el miércoles, el culto de jóvenes a las seis y cuarenta y cinco de la tarde, en el Salón Principal.';
const RETIRO = 'Y el viernes, el retiro de familias, también en el Salón Principal.';

const md = (...lineas) => lineas.join('\n');
const BUENO = md('## intro', INTRO, '## oracion-virtual', ORACION, '## culto-jovenes', CULTO, '## retiro-familias', RETIRO, '## outro', OUTRO);
const BUENO_UNO = md('## intro', INTRO, '## oracion-virtual', ORACION, '## outro', OUTRO);

const run = (texto, doc = DOC) => checkNarracion(parseNarracion(texto), doc);
const reglas = (r) => r.errores.map((e) => e.regla);
const avisos = (r) => r.avisos.map((e) => e.regla);

test('a faithful week passes with no errors and no notices', () => {
  assert.deepEqual(run(BUENO), { errores: [], avisos: [] });
  assert.deepEqual(run(BUENO_UNO, UNO), { errores: [], avisos: [] });
});

test('an event with no section is an error attributed to it', () => {
  const r = run(md('## intro', INTRO, '## oracion-virtual', ORACION, '## culto-jovenes', CULTO, '## outro', OUTRO));
  assert.deepEqual(r.errores.map((e) => [e.regla, e.slug]), [['seccion-faltante', 'retiro-familias']]);
});

test('sections out of order are an error', () => {
  const r = run(md('## oracion-virtual', ORACION, '## intro', INTRO, '## outro', OUTRO), UNO);
  assert.deepEqual(reglas(r), ['seccion-orden']);
});

test('a section that is neither intro, outro nor an event slug is an error', () => {
  const r = run(md('## intro', INTRO, '## oracion-virtual', ORACION, '## bonus', 'Hola.', '## outro', OUTRO), UNO);
  assert.deepEqual(reglas(r), ['seccion-desconocida']);
});

test('the intro must say the week exactly as events.json speaks it', () => {
  const r = run(md('## intro', 'Bienvenidos a Iglesia Ejemplo, estos son nuestros eventos.', '## oracion-virtual', ORACION, '## outro', OUTRO), UNO);
  assert.deepEqual(reglas(r), ['intro-sin-semana']);
});

test("a service's video may say 'el resto de la semana' instead of the dates; the whole week's may not", () => {
  const intro = (texto) => md('## intro', texto, '## oracion-virtual', ORACION, '## outro', OUTRO);
  const resto = 'Bienvenidos a Iglesia Ejemplo, esta es la programación para el resto de la semana.';
  assert.deepEqual(reglas(run(intro(resto), { ...UNO, semana: { ...UNO.semana, resto: true } })), []);
  assert.deepEqual(reglas(run(intro(resto), UNO)), ['intro-sin-semana']);
});

test('the intro speaks dates as words, not digits', () => {
  const r = run(md('## intro', 'Bienvenidos a Iglesia Ejemplo, estos son nuestros eventos del 21 al 27 de septiembre.', '## oracion-virtual', ORACION, '## outro', OUTRO), UNO);
  assert.ok(reglas(r).includes('intro-cifras'));
});

test('the intro names the church when church-info.md has a name', () => {
  const r = run(md('## intro', 'Bienvenidos, estos son nuestros eventos del veintiuno al veintisiete de septiembre.', '## oracion-virtual', ORACION, '## outro', OUTRO), UNO);
  assert.deepEqual(reglas(r), ['intro-sin-iglesia']);
});

test('the intro is held to the same register rule as an event line: tú, not usted or "los invitamos"', () => {
  const r = run(md('## intro', 'Los invitamos a Iglesia Ejemplo, estos son nuestros eventos del veintiuno al veintisiete de septiembre.', '## oracion-virtual', ORACION, '## outro', OUTRO), UNO);
  assert.deepEqual(reglas(r), ['registro-usted']);
});

test('an events.json from before semana.hablada asks for a new normalize run', () => {
  const r = run(BUENO_UNO, { ...UNO, semana: {} });
  assert.deepEqual(reglas(r), ['semana-sin-hablada']);
});

test('the outro is the call to action and the blessing exactly, in that order', () => {
  const sin = (outro) => md('## intro', INTRO, '## oracion-virtual', ORACION, '## outro', outro);
  assert.deepEqual(reglas(run(sin('Te esperamos.'), UNO)), ['outro-distinto']);
  assert.deepEqual(reglas(run(sin('Dios te bendiga, te esperamos.'), UNO)), ['outro-distinto']);
  assert.deepEqual(reglas(run(sin('Te esperamos, dios te bendiga'), UNO)), []); // case and punctuation do not matter
});

test('a church that gives closing words must have an outro', () => {
  const r = run(md('## intro', INTRO, '## oracion-virtual', ORACION), UNO);
  assert.deepEqual(reglas(r), ['seccion-faltante']);
  assert.match(r.errores[0].mensaje, /outro/);
});

test('the outro says only what church-info.md gives, and may be absent when it gives nothing', () => {
  const nada = { ...UNO, iglesia: { ...IGLESIA, llamadoAccion: null, despedida: null } };
  assert.deepEqual(reglas(run(BUENO_UNO, nada)), ['outro-sin-respaldo']);
  assert.deepEqual(reglas(run(md('## intro', INTRO, '## oracion-virtual', ORACION), nada)), []);
  const solo = { ...UNO, iglesia: { ...IGLESIA, despedida: null } };
  assert.deepEqual(reglas(run(md('## intro', INTRO, '## oracion-virtual', ORACION, '## outro', 'Te esperamos.'), solo)), []);
});

test('the call to action or blessing inside an event line is a notice', () => {
  const r = run(md('## intro', INTRO, '## oracion-virtual', 'El lunes te esperamos en la oración virtual, por Zoom.', '## outro', OUTRO), UNO);
  assert.deepEqual(reglas(r), []);
  assert.deepEqual(r.avisos.map((a) => [a.regla, a.slug]), [['cta-fuera-del-cierre', 'oracion-virtual']]);
});

test('two neighbouring events opening with the same words is a notice on the second', () => {
  const culto = 'Te invitamos al culto de jóvenes, el miércoles a las seis y cuarenta y cinco de la tarde, en el Salón Principal.';
  const retiro = 'Te invitamos al retiro de familias, el viernes, en el Salón Principal.';
  const r = run(md('## intro', INTRO, '## oracion-virtual', ORACION, '## culto-jovenes', culto, '## retiro-familias', retiro, '## outro', OUTRO));
  assert.deepEqual(reglas(r), []);
  assert.deepEqual(r.avisos.map((a) => [a.regla, a.slug]), [['apertura-repetida', 'retiro-familias']]);
});

test('the facts of an event line are still held to the record', () => {
  const mal = 'Después, el miércoles, el culto de jóvenes a las siete de la noche, en el Salón Principal.';
  const r = run(md('## intro', INTRO, '## oracion-virtual', ORACION, '## culto-jovenes', mal, '## retiro-familias', RETIRO, '## outro', OUTRO));
  assert.deepEqual(r.errores.map((e) => [e.regla, e.slug]), [['hora-distinta', 'culto-jovenes']]);
  assert.ok(!avisos(r).includes('sin-cta'));
});

test('structure problems found while reading the file are errors', () => {
  assert.ok(reglas(run(md('Suelto.', BUENO))).includes('guion-estructura'));
});

test('an event line far shorter than a spoken sentence is a notice', () => {
  const r = run(md('## intro', INTRO, '## oracion-virtual', 'Lunes, oración virtual.', '## outro', OUTRO), UNO);
  assert.deepEqual(reglas(r), []);
  assert.deepEqual(avisos(r), ['longitud']);
});
