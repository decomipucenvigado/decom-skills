// A tiny page driver over the Chrome DevTools protocol, using only Node built-ins
// (child_process and the global WebSocket) and the headless Chromium Remotion already
// downloaded for the video, so exporting an image adds no dependency and downloads nothing.
//
// It never waits forever: every command and every page load has a time limit, and a browser that
// dies or cannot start rejects with an error the caller can catch, so cleanup always runs.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './project.mjs';

/** Where Remotion keeps the headless shell it downloaded: <platform>/chrome-headless-shell-<platform>/<binary>. */
const DESCARGA_REMOTION = join(ROOT, 'video', 'node_modules', '.remotion', 'chrome-headless-shell');

/**
 * The browser to use: the one the environment names, else Remotion's local headless shell under
 * `base`. Never downloads. Remotion names the binary `chrome-headless-shell`, except on Linux arm64
 * (and Amazon Linux), where it is `headless_shell`.
 */
export async function resolveBrowser({ base = DESCARGA_REMOTION } = {}) {
  const elegido = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (elegido) {
    if (existsSync(elegido)) return elegido;
    throw new Error(`REMOTION_BROWSER_EXECUTABLE points to ${elegido}, which does not exist`);
  }
  if (existsSync(base)) {
    // Remotion also leaves a VERSION file next to the platform folder: only directories can hold the browser.
    const carpetas = (ruta) => readdirSync(ruta, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const plataforma of carpetas(base)) {
      const raiz = join(base, plataforma.name);
      for (const version of carpetas(raiz)) {
        for (const nombre of ['chrome-headless-shell', 'headless_shell']) {
          const candidato = join(raiz, version.name, nombre);
          if (existsSync(candidato)) return candidato;
        }
      }
    }
  }
  throw new Error('no headless Chromium found: run (cd video && npx remotion browser ensure), or set REMOTION_BROWSER_EXECUTABLE to a chrome-headless-shell path');
}

/**
 * The launch flags. On Linux the sandbox is turned off, as Remotion's own launcher does: as root or
 * in a container chrome-headless-shell refuses to start without it, and this driver only opens local
 * files it staged itself. Also on Linux, shared memory goes to the temp dir instead of /dev/shm,
 * which containers often keep too small for a 1920x1080 page.
 */
export function argumentosNavegador(perfil, plataforma = process.platform) {
  return [
    '--headless',
    '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`,
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--no-first-run',
    ...(plataforma === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : []),
    'about:blank',
  ];
}

/**
 * Launches the browser and returns a driver for one 1920x1080 page. Call `close()` when done.
 * `espera` is how long, in milliseconds, one command or one page load may take before it rejects;
 * `arranque` is how long the browser may take to start and to accept the DevTools connection.
 * The page's own scripts never run: the page is only read and photographed, and a script could
 * change its text between the audit and the photo.
 */
export async function openPage(executable, { espera = 30000, arranque = 15000 } = {}) {
  const segundos = espera / 1000;
  const perfil = mkdtempSync(join(tmpdir(), 'cdp-profile-'));
  let proc;
  try {
    proc = spawn(executable, argumentosNavegador(perfil), { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    rmSync(perfil, { recursive: true, force: true });
    throw new Error(`could not start the browser ${executable}: ${err.message}`);
  }
  // Resolves on `exit`, or on `error` (a spawn failure has no `exit`), so waiting for it can never hang.
  // The `error` listener also stays attached for good: without one, a late error would crash Node.
  const terminado = new Promise((res) => {
    proc.on('exit', res);
    proc.on('error', res);
  });
  // Kills the browser and only then removes its profile: while it shuts down it is still writing there.
  const cerrar = async () => {
    if (proc.pid && proc.exitCode === null && proc.signalCode === null) {
      proc.kill();
      let plazo;
      const salio = await Promise.race([terminado.then(() => true), new Promise((res) => (plazo = setTimeout(() => res(false), 5000)))]);
      clearTimeout(plazo);
      if (!salio) {
        proc.kill('SIGKILL');
        await terminado;
      }
    }
    rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  };
  let ws;
  try {
    let plazo;
    const wsUrl = await new Promise((res, rej) => {
      let buf = '';
      proc.stderr.on('data', (d) => {
        buf += d;
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) res(m[1]);
      });
      proc.on('exit', () => rej(new Error(`the browser exited: ${buf.trim()}`)));
      proc.on('error', (err) => rej(new Error(`could not start the browser ${executable}: ${err.message}`)));
      plazo = setTimeout(() => rej(new Error(`the browser did not start in time: ${buf.trim()}`)), arranque);
    }).finally(() => clearTimeout(plazo));
    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', () => rej(new Error('could not connect to the browser')));
      ws.addEventListener('close', () => rej(new Error('could not connect to the browser: the connection closed')));
      terminado.then(() => rej(new Error('could not connect to the browser: it exited')));
      plazo = setTimeout(() => rej(new Error(`could not connect to the browser within ${arranque / 1000} s`)), arranque);
    }).finally(() => clearTimeout(plazo));
  } catch (err) {
    try {
      ws?.close(); // a connection still being opened is abandoned, so it cannot outlive the browser
    } catch {}
    await cerrar();
    throw err;
  }

  let id = 0;
  const pendientes = new Map();
  const cargas = new Set(); // the rejecters of the page loads being waited for
  const oyentes = [];
  let caida = null; // the error every command gets once the connection is gone
  const caer = () => {
    caida ??= new Error('the browser closed the connection');
    for (const { rej } of pendientes.values()) rej(caida);
    pendientes.clear();
    for (const rej of cargas) rej(caida);
    cargas.clear();
  };
  ws.addEventListener('close', caer);
  ws.addEventListener('error', caer);
  terminado.then(caer);
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) {
      const { res, rej } = pendientes.get(m.id);
      pendientes.delete(m.id);
      if (m.error) rej(new Error(m.error.message));
      else res(m.result);
    } else if (m.method) {
      for (const oyente of oyentes.slice()) oyente(m);
    }
  });
  const enviar = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      if (caida) return rej(caida);
      const i = ++id;
      const plazo = setTimeout(() => {
        pendientes.delete(i);
        rej(new Error(`the browser did not answer ${method} within ${segundos} s`));
      }, espera);
      pendientes.set(i, {
        res: (valor) => {
          clearTimeout(plazo);
          res(valor);
        },
        rej: (error) => {
          clearTimeout(plazo);
          rej(error);
        },
      });
      try {
        ws.send(JSON.stringify({ id: i, method, params, sessionId }));
      } catch (err) {
        pendientes.get(i)?.rej(err);
        pendientes.delete(i);
      }
    });

  try {
    const { targetId } = await enviar('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
    const cmd = (method, params) => enviar(method, params, sessionId);
    await cmd('Page.enable');
    await cmd('Emulation.setScriptExecutionDisabled', { value: true });
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

    return {
      async navigate(url) {
        let oyente;
        let plazo;
        let rechazar;
        const cargada = new Promise((res, rej) => {
          oyente = (m) => {
            if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) res();
          };
          oyentes.push(oyente);
          rechazar = rej;
          if (caida) rej(caida);
          else cargas.add(rej); // a dropped connection rejects it at once, instead of after `espera`
          plazo = setTimeout(() => rej(new Error(`the page did not finish loading within ${segundos} s: ${url}`)), espera);
        });
        cargada.catch(() => {}); // it may reject while `Page.navigate` is still awaited: never leave it unhandled
        try {
          const r = await cmd('Page.navigate', { url });
          if (r.errorText) throw new Error(`could not load ${url}: ${r.errorText}`);
          await cargada;
        } finally {
          clearTimeout(plazo);
          cargas.delete(rechazar);
          const donde = oyentes.indexOf(oyente);
          if (donde !== -1) oyentes.splice(donde, 1);
        }
      },
      async evaluate(expression) {
        const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(`the page threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        return r.result.value;
      },
      async screenshot({ x, y, width, height }) {
        const r = await cmd('Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 1 }, captureBeyondViewport: true });
        return Buffer.from(r.data, 'base64');
      },
      async close() {
        ws.close();
        await cerrar();
      },
    };
  } catch (err) {
    ws.close();
    await cerrar();
    throw err;
  }
}
