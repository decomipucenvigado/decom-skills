import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exportStills } from '../core/export-stills.mjs';
import { argumentosNavegador, openPage, resolveBrowser } from '../core/cdp.mjs';

const IGLESIA = { nombre: 'Iglesia Ejemplo', lugarPorDefecto: 'Templo', llamadoAccion: null };
const CULTO = { slug: 'culto-jovenes', titulo: 'Culto de jóvenes', ministerio: null, fechaTexto: 'viernes 3 de octubre', hora: '19:00', horaTexto: '7:00 p. m.', lugar: null };
const RETIRO = { slug: 'retiro-familias', titulo: 'Retiro de familias', ministerio: null, fechaTexto: 'sábado 4 de octubre', hora: null, horaTexto: null, lugar: null };
const DOC = { iglesia: IGLESIA, events: [CULTO, RETIRO] };

// A valid 1x1 png. If the browser reports naturalWidth 0 for it, swap in any valid 1x1 png.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const LOGO = 'a'.repeat(32);
const FUENTE = 'b'.repeat(32);

let executable = null;
try {
  executable = await resolveBrowser();
} catch (err) {
  // no browser here: the tests that need one are skipped. Any other failure is a driver bug and must show.
  if (!err.message.includes('no headless Chromium found')) throw err;
}
const sinNavegador = executable ? false : 'no headless browser available (set REMOTION_BROWSER_EXECUTABLE)';
// every test that drives the browser: skipped without one, and a regression fails instead of hanging `node --test`
const CON_NAVEGADOR = { skip: sinNavegador, timeout: 60000 };

const pagina = (cuerpo, estilo = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}.ab{width:1920px;height:1080px;position:relative;overflow:hidden;margin-bottom:40px;color:#fff;font:700 120px sans-serif;background:#7a2bd6}${estilo}</style></head><body>${cuerpo}</body></html>`;
const culto = (extra = '', atributos = '') => `<div class="ab" data-slug="culto-jovenes" ${atributos}><span>Culto de jóvenes</span><p style="font-size:60px">viernes 3 de octubre · 7:00 p. m.</p>${extra}</div>`;
const retiro = `<div class="ab" data-slug="retiro-familias"><span>Retiro de familias</span><p style="font-size:60px">sábado 4 de octubre</p></div>`;

/** A downloaded canvas in a temp dir; `assets` are written at its root. Runs `fn(dir, salida)`, always cleans up. */
async function conCanvas(artboards, assets, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'canvas-'));
  const fuera = mkdtempSync(join(tmpdir(), 'stills-'));
  try {
    mkdirSync(join(dir, 'project'), { recursive: true });
    for (const [nombre, html] of Object.entries(artboards)) writeFileSync(join(dir, 'project', nombre), html);
    for (const [nombre, contenido] of Object.entries(assets)) writeFileSync(join(dir, nombre), contenido);
    return await fn(dir, (slug) => join(fuera, `${slug}.png`), fuera);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(fuera, { recursive: true, force: true });
  }
}

const pngSize = (path) => {
  const b = readFileSync(path);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};
const reglas = (r) => r.errores.map((e) => e.regla);
/** How many of the exporter's own temp folders (staging copies, browser profiles) are in the OS temp dir. */
const residuos = () => readdirSync(tmpdir()).filter((n) => n.startsWith('canvas-staging-') || n.startsWith('cdp-profile-')).length;

test('two artboards in one file become 1920x1080 pngs, even the one below the fold', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.escritos.map((p) => p.split('/').pop()).sort(), ['culto-jovenes.png', 'retiro-familias.png']);
    for (const p of r.escritos) assert.deepEqual(pngSize(p), { width: 1920, height: 1080 });
    // the two artboards hold different text: identical pixels would mean the clip missed one of them
    assert.notEqual(Buffer.compare(readFileSync(r.escritos[0]), readFileSync(r.escritos[1])), 0);
  });
});

test('artboards spread over several files are all exported, named by data-slug and not by file', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto()), 'Otro.dc.html': pagina(retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.escritos.map((p) => p.split('/').pop()).sort(), ['culto-jovenes.png', 'retiro-familias.png']);
  });
});

test('only the requested slugs are exported', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, slugs: ['retiro-familias'], salida, executable });
    assert.deepEqual(r.errores, []);
    assert.equal(existsSync(salida('retiro-familias')), true);
    assert.equal(existsSync(salida('culto-jovenes')), false);
  });
});

test('an image that loads through /_blob passes', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto(`<img src="/_blob/${LOGO}" width="10" height="10">`) + retiro) }, { [`${LOGO}.png`]: PNG }, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(r.errores, []);
    assert.equal(r.escritos.length, 2);
  });
});

test('an audit error writes nothing', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const doc = { ...DOC, events: [{ ...CULTO, hora: '20:00', horaTexto: '8:00 p. m.' }, RETIRO] };
    const r = await exportStills({ dir, doc, salida, executable });
    assert.deepEqual(reglas(r), ['hora-ajena']);
    assert.deepEqual(r.escritos, []);
    assert.equal(existsSync(salida('culto-jovenes')), false);
  });
});

test('an artboard that is not 1920x1080 is an error', CON_NAVEGADOR, async () => {
  const chico = culto().replace('class="ab"', 'class="ab" style="width:1280px;height:720px"');
  await conCanvas({ 'Main.dc.html': pagina(chico + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(reglas(r), ['tamano-artboard']);
    assert.deepEqual(r.escritos, []);
  });
});

test('a broken image is an error, not a silent broken-image box', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto(`<img src="/_blob/${LOGO}" width="10" height="10">`) + retiro) }, { [`${LOGO}.png`]: 'not a png' }, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(reglas(r), ['imagen-rota']);
    assert.deepEqual(r.escritos, []);
  });
});

test('a font that fails to load is an error, not a silent fallback font', CON_NAVEGADOR, async () => {
  const estilo = `@font-face{font-family:Rota;src:url(/_blob/${FUENTE})}.ab{font-family:Rota,sans-serif}`;
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro, estilo) }, { [`${FUENTE}.woff2`]: 'not a font' }, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(reglas(r), ['fuente-no-cargada']);
    assert.deepEqual(r.escritos, []);
  });
});

test('a requested slug that is no event is an error before any browser is opened, not a silent no-op', async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, slugs: ['culto-jovnes'], salida, executable: '/no/browser/needed' });
    assert.deepEqual(r.errores, [{ regla: 'slug-desconocido', slug: 'culto-jovnes', mensaje: 'no event with slug "culto-jovnes" in events.json' }]);
    assert.deepEqual(r.escritos, []);
    assert.equal(existsSync(salida('culto-jovenes')), false);
  });
});

test('a requested event that has no artboard is reported only as artboard-faltante', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto()) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, slugs: ['retiro-familias'], salida, executable });
    assert.deepEqual(reglas(r), ['artboard-faltante']);
    assert.deepEqual(r.escritos, []);
  });
});

test('an error removes the old image of every event in scope and leaves every other file alone', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida, fuera) => {
    writeFileSync(salida('culto-jovenes'), 'an old image with the old time');
    writeFileSync(join(fuera, 'otro.png'), 'not an event');
    const doc = { ...DOC, events: [{ ...CULTO, hora: '20:00', horaTexto: '8:00 p. m.' }, RETIRO] };
    const r = await exportStills({ dir, doc, salida, executable });
    assert.deepEqual(reglas(r), ['hora-ajena']);
    assert.deepEqual(r.borrados, [salida('culto-jovenes')]);
    assert.equal(existsSync(salida('culto-jovenes')), false);
    assert.equal(readFileSync(join(fuera, 'otro.png'), 'utf8'), 'not an event');
  });
});

test('with named slugs, an error removes only the old images of those that are events', async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    writeFileSync(salida('culto-jovenes'), 'old');
    writeFileSync(salida('retiro-familias'), 'old');
    writeFileSync(salida('no-es-evento'), 'old');
    const r = await exportStills({ dir, doc: DOC, slugs: ['retiro-familias', 'no-es-evento'], salida, executable: '/no/browser/needed' });
    assert.equal(readFileSync(salida('no-es-evento'), 'utf8'), 'old');
    assert.deepEqual(reglas(r), ['slug-desconocido']);
    assert.deepEqual(r.borrados, [salida('retiro-familias')]);
    assert.equal(readFileSync(salida('culto-jovenes'), 'utf8'), 'old');
  });
});

test('a successful export removes nothing', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable });
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.borrados, []);
  });
});

test('a browser that cannot start removes no old image', async () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'no-exec-'));
  try {
    const falso = join(carpeta, 'browser');
    writeFileSync(falso, '#!/bin/sh\nexit 0\n', { mode: 0o644 }); // no execute bit
    await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
      writeFileSync(salida('culto-jovenes'), 'old');
      await assert.rejects(() => exportStills({ dir, doc: DOC, salida, executable: falso }));
      assert.equal(readFileSync(salida('culto-jovenes'), 'utf8'), 'old');
    });
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

/** The first error of `r`, which must be the only one, with the rule `regla`. */
const unico = (r, regla) => {
  assert.deepEqual(reglas(r), [regla]);
  return r.errores[0];
};

test('text drawn by a pseudo-element is texto-no-auditable: the audit cannot read it', CON_NAVEGADOR, async () => {
  const estilo = '.nota::after{content:"Trae tu Biblia"}';
  await conCanvas({ 'Main.dc.html': pagina(culto('<span class="nota"></span>') + retiro, estilo) }, {}, async (dir, salida) => {
    const e = unico(await exportStills({ dir, doc: DOC, salida, executable }), 'texto-no-auditable');
    assert.equal(e.slug, 'culto-jovenes');
    assert.match(e.mensaje, /Trae tu Biblia/);
  });
});

test('an empty decorative pseudo-element is fine', CON_NAVEGADOR, async () => {
  const estilo = '.raya::before{content:"";display:block;width:100px;height:8px;background:#fff}';
  await conCanvas({ 'Main.dc.html': pagina(culto('<div class="raya"></div>') + retiro, estilo) }, {}, async (dir, salida) => {
    assert.deepEqual((await exportStills({ dir, doc: DOC, salida, executable })).errores, []);
  });
});

test('an iframe in an artboard is texto-no-auditable: whatever it shows is photographed unread', CON_NAVEGADOR, async () => {
  const marco = `<iframe srcdoc="<p>Trae tu Biblia</p>" width="600" height="200"></iframe>`;
  await conCanvas({ 'Main.dc.html': pagina(culto(marco) + retiro) }, {}, async (dir, salida) => {
    const e = unico(await exportStills({ dir, doc: DOC, salida, executable }), 'texto-no-auditable');
    assert.equal(e.slug, 'culto-jovenes');
    assert.match(e.mensaje, /iframe/);
  });
});

test('rendered text outside every artboard is texto-no-auditable, named after the artboard it lands on', CON_NAVEGADOR, async () => {
  const encima = '<div style="position:absolute;left:100px;top:600px;font-size:60px;color:#fff">Trae tu Biblia</div>';
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro + encima) }, {}, async (dir, salida) => {
    const e = unico(await exportStills({ dir, doc: DOC, salida, executable }), 'texto-no-auditable');
    assert.equal(e.slug, 'culto-jovenes');
    assert.match(e.mensaje, /Trae tu Biblia/);
  });
});

test('a time that runs out of its tile is texto-desbordado (the "0:30 a. m." case)', CON_NAVEGADOR, async () => {
  const doc = { ...DOC, events: [{ ...CULTO, hora: '10:30', horaTexto: '10:30 a. m.' }, RETIRO] };
  const tablero = `<div class="ab" data-slug="culto-jovenes"><span>Culto de jóvenes</span><p style="font-size:60px">viernes 3 de octubre</p><div style="width:300px;background:#0b6668;font-size:150px;white-space:nowrap">10:30 a. m.</div></div>`;
  await conCanvas({ 'Main.dc.html': pagina(tablero + retiro) }, {}, async (dir, salida) => {
    const e = unico(await exportStills({ dir, doc, salida, executable }), 'texto-desbordado');
    assert.equal(e.slug, 'culto-jovenes');
    assert.match(e.mensaje, /"10:30 a\. m\."/);
  });
});

// Chrome serialises an opaque colour whose blue channel is 0 as "rgb(r, g, 0)"; that must not be mistaken for a
// transparent one (a rgba(..., 0) alpha), or a tile painted in the IPUC gold would never be treated as a box.
for (const color of ['#F0AB00', '#ffd700', '#ff0000', '#ffa500']) {
  test(`a time that runs out of a tile painted ${color} (blue channel 0) is texto-desbordado`, CON_NAVEGADOR, async () => {
    const doc = { ...DOC, events: [{ ...CULTO, hora: '10:30', horaTexto: '10:30 a. m.' }, RETIRO] };
    const tablero = `<div class="ab" data-slug="culto-jovenes"><span>Culto de jóvenes</span><p style="font-size:60px">viernes 3 de octubre</p><div style="width:300px;background:${color};font-size:150px;white-space:nowrap">10:30 a. m.</div></div>`;
    await conCanvas({ 'Main.dc.html': pagina(tablero + retiro) }, {}, async (dir, salida) => {
      const e = unico(await exportStills({ dir, doc, salida, executable }), 'texto-desbordado');
      assert.equal(e.slug, 'culto-jovenes');
    });
  });
}

test('a fully transparent tile (alpha 0, even with a blue channel of 0) is not a box: the artboard is the only frame', CON_NAVEGADOR, async () => {
  const doc = { ...DOC, events: [{ ...CULTO, hora: '10:30', horaTexto: '10:30 a. m.' }, RETIRO] };
  const tablero = `<div class="ab" data-slug="culto-jovenes"><span>Culto de jóvenes</span><p style="font-size:60px">viernes 3 de octubre</p><div style="width:300px;background:rgba(255, 215, 0, 0);font-size:150px;white-space:nowrap">10:30 a. m.</div></div>`;
  await conCanvas({ 'Main.dc.html': pagina(tablero + retiro) }, {}, async (dir, salida) => {
    assert.deepEqual((await exportStills({ dir, doc, salida, executable })).errores, []);
  });
});

test('a time that bleeds off the bottom of the artboard is texto-desbordado', CON_NAVEGADOR, async () => {
  const tablero = `<div class="ab" data-slug="culto-jovenes"><span>Culto de jóvenes</span><div style="position:absolute;left:100px;top:1000px;font-size:150px;white-space:nowrap">7:00 p. m.</div></div>`;
  await conCanvas({ 'Main.dc.html': pagina(tablero + retiro) }, {}, async (dir, salida) => {
    const e = unico(await exportStills({ dir, doc: DOC, salida, executable }), 'texto-desbordado');
    assert.equal(e.slug, 'culto-jovenes');
  });
});

test('a giant word with no digit may bleed off the artboard on purpose', CON_NAVEGADOR, async () => {
  const gigante = '<div style="position:absolute;left:92px;top:572px;font-size:620px;line-height:1;white-space:nowrap">Culto</div>';
  await conCanvas({ 'Main.dc.html': pagina(culto(gigante) + retiro) }, {}, async (dir, salida) => {
    assert.deepEqual((await exportStills({ dir, doc: DOC, salida, executable })).errores, []);
  });
});

test('an error path leaves no staging or profile folder behind', CON_NAVEGADOR, async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto() + retiro) }, {}, async (dir, salida) => {
    const antes = residuos();
    const doc = { ...DOC, events: [{ ...CULTO, hora: '20:00', horaTexto: '8:00 p. m.' }, RETIRO] };
    const r = await exportStills({ dir, doc, salida, executable });
    assert.deepEqual(reglas(r), ['hora-ajena']);
    assert.equal(residuos(), antes);
  });
});

test('a stalled page fails fast and leaves no folder behind', CON_NAVEGADOR, async () => {
  // a server that accepts connections and never answers: the image never finishes loading
  const sockets = new Set();
  const servidor = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((res) => servidor.listen(0, '127.0.0.1', res));
  const { port } = servidor.address();
  try {
    const cuerpo = culto(`<img src="http://127.0.0.1:${port}/x.png" width="10" height="10">`) + retiro;
    await conCanvas({ 'Main.dc.html': pagina(cuerpo) }, {}, async (dir, salida) => {
      const antes = residuos();
      const inicio = Date.now();
      await assert.rejects(() => exportStills({ dir, doc: DOC, salida, executable, espera: 1500 }), /did not finish loading/);
      assert.ok(Date.now() - inicio < 15000, 'it must give up long before the default timeout');
      assert.equal(residuos(), antes);
    });
  } finally {
    for (const socket of sockets) socket.destroy();
    servidor.close();
  }
});

test('a browser that cannot be started rejects and leaves no profile folder behind', async () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'no-exec-'));
  try {
    const falso = join(carpeta, 'browser');
    writeFileSync(falso, '#!/bin/sh\nexit 0\n', { mode: 0o644 }); // no execute bit
    const antes = residuos();
    await assert.rejects(() => openPage(falso));
    assert.equal(residuos(), antes);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

test('the sandbox and /dev/shm are turned off on Linux only, and the profile folder is always passed', () => {
  const linux = argumentosNavegador('/perfil', 'linux');
  assert.ok(linux.includes('--no-sandbox') && linux.includes('--disable-setuid-sandbox') && linux.includes('--disable-dev-shm-usage'));
  const mac = argumentosNavegador('/perfil', 'darwin');
  assert.equal(mac.includes('--no-sandbox') || mac.includes('--disable-setuid-sandbox') || mac.includes('--disable-dev-shm-usage'), false);
  for (const banderas of [linux, mac]) assert.ok(banderas.includes('--user-data-dir=/perfil') && banderas.includes('--headless'));
});

/** Runs `fn` with REMOTION_BROWSER_EXECUTABLE unset (it takes precedence over the search), then restores it. */
async function sinVariable(fn) {
  const antes = process.env.REMOTION_BROWSER_EXECUTABLE;
  delete process.env.REMOTION_BROWSER_EXECUTABLE;
  try {
    return await fn();
  } finally {
    if (antes !== undefined) process.env.REMOTION_BROWSER_EXECUTABLE = antes;
  }
}

/** A fake Remotion download folder in a temp dir: `archivos` are paths relative to it. Runs `fn(base)`, always cleans up. */
async function conDescarga(archivos, fn) {
  const base = mkdtempSync(join(tmpdir(), 'descarga-'));
  try {
    for (const ruta of archivos) {
      mkdirSync(join(base, ruta, '..'), { recursive: true });
      writeFileSync(join(base, ruta), '');
    }
    return await fn(base);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

test('resolveBrowser finds the mac headless shell and ignores the VERSION file beside the platform folder', async () => {
  const ruta = 'mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  await conDescarga(['VERSION', ruta], (base) => sinVariable(async () => assert.equal(await resolveBrowser({ base }), join(base, ruta))));
});

test('resolveBrowser finds the linux-arm64 headless shell, which Remotion names headless_shell', async () => {
  const ruta = 'linux-arm64/chrome-headless-shell-linux-arm64/headless_shell';
  await conDescarga(['VERSION', ruta], (base) => sinVariable(async () => assert.equal(await resolveBrowser({ base }), join(base, ruta))));
});

test('resolveBrowser prefers chrome-headless-shell when both names are present', async () => {
  const carpeta = 'linux64/chrome-headless-shell-linux64';
  await conDescarga([`${carpeta}/headless_shell`, `${carpeta}/chrome-headless-shell`], (base) =>
    sinVariable(async () => assert.equal(await resolveBrowser({ base }), join(base, carpeta, 'chrome-headless-shell'))),
  );
});

test('resolveBrowser says how to get a browser when none is downloaded, and a lone VERSION file is not one', async () => {
  const mensaje = /no headless Chromium found: run \(cd video && npx remotion browser ensure\), or set REMOTION_BROWSER_EXECUTABLE/;
  await conDescarga(['VERSION', 'mac-arm64/chrome-headless-shell-mac-arm64/LICENSE'], (base) => sinVariable(() => assert.rejects(() => resolveBrowser({ base }), mensaje)));
  await sinVariable(() => assert.rejects(() => resolveBrowser({ base: join(tmpdir(), 'no-such-remotion-folder') }), mensaje));
});

/**
 * A fake browser: a shell script that announces a DevTools address and then only sleeps. `puerto`
 * is where it says it listens. Runs `fn(ejecutable)`, always cleans up.
 */
async function conNavegadorFalso(puerto, fn) {
  const carpeta = mkdtempSync(join(tmpdir(), 'fake-browser-'));
  try {
    const falso = join(carpeta, 'browser');
    writeFileSync(falso, `#!/bin/sh\necho "DevTools listening on ws://127.0.0.1:${puerto}/devtools/browser/x" >&2\nexec sleep 30\n`, { mode: 0o755 });
    return await fn(falso);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
}

/** A TCP server that accepts connections and never answers. Runs `fn(port)`, always closes it. */
async function conServidorMudo(fn) {
  const sockets = new Set();
  const servidor = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((res) => servidor.listen(0, '127.0.0.1', res));
  try {
    return await fn(servidor.address().port);
  } finally {
    for (const socket of sockets) socket.destroy();
    servidor.close();
  }
}

test('a browser whose DevTools connection never opens is given up in time and leaves no profile behind', { timeout: 60000 }, async () => {
  await conServidorMudo((port) =>
    conNavegadorFalso(port, async (falso) => {
      const antes = residuos();
      const inicio = Date.now();
      await assert.rejects(() => openPage(falso, { arranque: 1000 }), /could not connect to the browser/);
      assert.ok(Date.now() - inicio < 10000, 'it must give up at the start-up limit, not wait forever');
      assert.equal(residuos(), antes);
    }),
  );
});

test('a page load stops waiting as soon as the connection drops', CON_NAVEGADOR, async () => {
  await conServidorMudo(async (port) => {
    await conCanvas({ 'Main.dc.html': pagina(culto(`<img src="http://127.0.0.1:${port}/x.png" width="10" height="10">`)) }, {}, async (dir) => {
      const driver = await openPage(executable, { espera: 20000 });
      const inicio = Date.now();
      const carga = driver.navigate(pathToFileURL(join(dir, 'project', 'Main.dc.html')).href);
      setTimeout(() => driver.close(), 1000);
      await assert.rejects(() => carga, /closed the connection|exited/);
      assert.ok(Date.now() - inicio < 10000, 'it must not wait for the full page-load limit');
    });
  });
});

test('page scripts do not run: an inline script cannot add text to the audit or the photo', CON_NAVEGADOR, async () => {
  const guion = `<script>document.currentScript.parentElement.append('Trae tu Biblia')</script>`;
  const fotos = [];
  for (const cuerpo of [culto(guion), culto()]) {
    await conCanvas({ 'Main.dc.html': pagina(cuerpo + retiro) }, {}, async (dir, salida) => {
      const r = await exportStills({ dir, doc: DOC, slugs: ['culto-jovenes'], salida, executable });
      // had the script run, the audit would have read "Trae tu Biblia" (token-ajeno)
      assert.deepEqual(r.errores, []);
      fotos.push(readFileSync(salida('culto-jovenes')));
    });
  }
  // and the photo is the one of the same artboard without the script
  assert.equal(Buffer.compare(fotos[0], fotos[1]), 0);
});

test('a /_blob reference with no downloaded asset stops before any browser is opened', async () => {
  await conCanvas({ 'Main.dc.html': pagina(culto(`<img src="/_blob/${LOGO}">`) + retiro) }, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable: '/no/browser/needed' });
    assert.deepEqual(reglas(r), ['asset-faltante']);
    assert.deepEqual(r.escritos, []);
  });
});

test('a download with no artboards is an error', async () => {
  await conCanvas({}, {}, async (dir, salida) => {
    const r = await exportStills({ dir, doc: DOC, salida, executable: '/no/browser/needed' });
    assert.deepEqual(reglas(r), ['sin-artboards']);
  });
});

test('resolveBrowser explains how to set the browser when the named one does not exist', async () => {
  const antes = process.env.REMOTION_BROWSER_EXECUTABLE;
  process.env.REMOTION_BROWSER_EXECUTABLE = '/no/such/browser';
  try {
    await assert.rejects(() => resolveBrowser(), /REMOTION_BROWSER_EXECUTABLE/);
  } finally {
    if (antes === undefined) delete process.env.REMOTION_BROWSER_EXECUTABLE;
    else process.env.REMOTION_BROWSER_EXECUTABLE = antes;
  }
});

test('--dir with no path is a usage error, not a silent fallback to the default folder', () => {
  const cli = fileURLToPath(new URL('../export-stills.mjs', import.meta.url));
  for (const args of [['--dir'], ['--dir='], ['culto-jovenes', '--dir']]) {
    const r = spawnSync(process.execPath, [cli, '1999-W01', ...args], { encoding: 'utf8' });
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stderr, /--dir needs a path/);
    assert.match(r.stderr, /<week> \[slug \.\.\.\] \[--dir path\]/);
  }
});
