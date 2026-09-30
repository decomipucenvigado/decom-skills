import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStillText } from '../core/still-source.mjs';

const IGLESIA = { nombre: 'Iglesia Ejemplo', lugarPorDefecto: 'Templo', llamadoAccion: 'Te esperamos' };
const CULTO = { slug: 'culto-jovenes', titulo: 'Culto de jóvenes', ministerio: 'Jóvenes', fechaTexto: 'viernes 3 de octubre', hora: '19:00', horaTexto: '7:00 p. m.', lugar: 'Templo' };
const RETIRO = { slug: 'retiro-familias', titulo: 'Retiro de familias', ministerio: null, fechaTexto: 'sábado 4 de octubre', hora: null, horaTexto: null, lugar: 'Salón Principal' };
const DOC = { iglesia: IGLESIA, events: [CULTO, RETIRO] };

const BUENO = [
  { slug: 'culto-jovenes', text: 'JÓVENES\nCULTO DE JÓVENES\nViernes 3 de octubre\n7:00 p. m.\nTe esperamos' },
  { slug: 'retiro-familias', text: 'Retiro\nde familias\nSábado 4 de octubre\nSalón Principal' },
];
const reglas = (tableros, doc = DOC) => checkStillText(tableros, doc).errores.map((e) => e.regla);

test('artboards that show only the record pass, whatever their case, accents or line breaks', () => {
  assert.deepEqual(reglas(BUENO), []);
  assert.deepEqual(reglas([{ slug: 'culto-jovenes', text: 'culto de jovenes viernes 3 de octubre 7:00 p. m.' }, BUENO[1]]), []);
});

test('an invented time is one hora-ajena error that names it', () => {
  const r = checkStillText([{ ...BUENO[0], text: `${BUENO[0].text}\n8:30 p. m.` }, BUENO[1]], DOC);
  assert.deepEqual(r.errores.map((e) => e.regla), ['hora-ajena']);
  assert.equal(r.errores[0].slug, 'culto-jovenes');
  assert.match(r.errores[0].mensaje, /8:30/);
});

test('a time on an event that has none is an error', () => {
  assert.deepEqual(reglas([BUENO[0], { ...BUENO[1], text: `${BUENO[1].text}\n7:00 p. m.` }]), ['hora-ajena']);
});

test('invented copy is an error', () => {
  assert.deepEqual(reglas([{ ...BUENO[0], text: `${BUENO[0].text}\nTrae tu Biblia` }, BUENO[1]]), ['token-ajeno']);
});

test('the default place may not be shown, a different place may', () => {
  assert.deepEqual(reglas([{ ...BUENO[0], text: `${BUENO[0].text}\nTemplo` }, BUENO[1]]), ['token-ajeno']);
  assert.deepEqual(reglas(BUENO), []);
});

test('the call to action is allowed only when the church has one', () => {
  const sin = { ...DOC, iglesia: { ...IGLESIA, llamadoAccion: null } };
  assert.deepEqual(reglas(BUENO, sin), ['token-ajeno']);
});

test('the church name typed on an artboard is one error, not a list of foreign words', () => {
  const r = checkStillText([{ ...BUENO[0], text: `${BUENO[0].text}\nIGLESIA EJEMPLO` }, BUENO[1]], DOC);
  assert.deepEqual(r.errores.map((e) => e.regla), ['nombre-en-texto']);
});

test('a missing, an extra and a duplicated artboard are errors', () => {
  assert.deepEqual(reglas([BUENO[0]]), ['artboard-faltante']);
  assert.deepEqual(reglas([...BUENO, { slug: 'otro', text: 'Otro' }]), ['artboard-sobrante']);
  assert.deepEqual(reglas([...BUENO, BUENO[1]]), ['artboard-duplicado']);
});

test('findings carry the slug, and a clean week has no notices', () => {
  const r = checkStillText([BUENO[0]], DOC);
  assert.equal(r.errores[0].slug, 'retiro-familias');
  assert.deepEqual(r.avisos, []);
});

test('a time rebuilt from digits of the date is an error', () => {
  const r = [{ ...BUENO[0], text: 'JÓVENES\nCULTO DE JÓVENES\nViernes 3 de octubre\n3:00 p. m.\nTe esperamos' }, BUENO[1]];
  assert.deepEqual(reglas(r), ['hora-ajena']);
});

test('the minutes must match too', () => {
  const r = [{ ...BUENO[0], text: 'JÓVENES\nCULTO DE JÓVENES\nViernes 3 de octubre\n7:30 p. m.\nTe esperamos' }, BUENO[1]];
  assert.deepEqual(reglas(r), ['hora-ajena']);
});

test('the same time written "7 p. m." is accepted', () => {
  const r = [{ ...BUENO[0], text: 'JÓVENES\nCULTO DE JÓVENES\nViernes 3 de octubre\n7 p. m.\nTe esperamos' }, BUENO[1]];
  assert.deepEqual(reglas(r), []);
});

test('a date rebuilt from digits of the time is an error', () => {
  const r = [{ ...BUENO[0], text: 'JÓVENES\nCULTO DE JÓVENES\nViernes 7 de octubre\n7:00 p. m.\nTe esperamos' }, BUENO[1]];
  assert.deepEqual(reglas(r), ['fecha-ajena']);
});

test('another weekday is an error', () => {
  const r = [{ ...BUENO[0], text: 'JÓVENES\nCULTO DE JÓVENES\nSábado 3 de octubre\n7:00 p. m.\nTe esperamos' }, BUENO[1]];
  assert.deepEqual(reglas(r), ['dia-ajeno']);
});

test('the church name typed twice is still one error', () => {
  const r = checkStillText([{ ...BUENO[0], text: `${BUENO[0].text}\nIGLESIA EJEMPLO\nIglesia Ejemplo` }, BUENO[1]], DOC);
  assert.deepEqual(r.errores.map((e) => e.regla), ['nombre-en-texto']);
});

test('an artboard with no visible text is an error, not a silent pass', () => {
  assert.deepEqual(reglas([{ slug: 'culto-jovenes', text: '   \n ' }, BUENO[1]]), ['artboard-vacio']);
});

test('an event with no place passes, and the default place is matched ignoring case and accents', () => {
  const sinLugar = { ...DOC, events: [CULTO, { ...RETIRO, lugar: null }] };
  assert.deepEqual(reglas(BUENO.map((b) => (b.slug === 'retiro-familias' ? { ...b, text: 'Retiro de familias\nSábado 4 de octubre' } : b)), sinLugar), []);
  const mayusculas = { ...DOC, events: [{ ...CULTO, lugar: 'TEMPLO' }, RETIRO] };
  assert.deepEqual(reglas([{ ...BUENO[0], text: `${BUENO[0].text}\nTemplo` }, BUENO[1]], mayusculas), ['token-ajeno']);
});

test('events.json with no church name is an error, so a forgotten lectura.json cannot pass silently', () => {
  for (const iglesia of [undefined, { ...IGLESIA, nombre: null }]) {
    const r = checkStillText(BUENO, { ...DOC, week: '2026-W40', iglesia });
    const e = r.errores.find((x) => x.regla === 'sin-iglesia');
    assert.ok(e, 'sin-iglesia expected');
    assert.equal(e.mensaje, 'events.json has no church name: write out/2026-W40/lectura.json and run normalize.mjs again');
  }
  assert.deepEqual(reglas(BUENO), []);
});
