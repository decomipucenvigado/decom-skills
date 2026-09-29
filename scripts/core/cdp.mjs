// A tiny page driver over the Chrome DevTools protocol, using only Node built-ins
// (child_process and the global WebSocket) and the headless Chromium Remotion already
// downloaded for the video, so exporting an image adds no dependency and downloads nothing.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './project.mjs';

/** The browser to use: the one the environment names, else Remotion's local headless shell. Never downloads. */
export async function resolveBrowser() {
  const elegido = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (elegido) {
    if (existsSync(elegido)) return elegido;
    throw new Error(`REMOTION_BROWSER_EXECUTABLE points to ${elegido}, which does not exist`);
  }
  const base = join(ROOT, 'video', 'node_modules', '.remotion', 'chrome-headless-shell');
  if (existsSync(base)) {
    // Remotion also leaves a VERSION file next to the platform folder: only directories can hold the browser.
    const carpetas = (ruta) => readdirSync(ruta, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const plataforma of carpetas(base)) {
      const raiz = join(base, plataforma.name);
      for (const version of carpetas(raiz)) {
        const candidato = join(raiz, version.name, 'chrome-headless-shell');
        if (existsSync(candidato)) return candidato;
      }
    }
  }
  throw new Error('no headless Chromium found: render a week once so Remotion downloads it, or set REMOTION_BROWSER_EXECUTABLE to a chrome-headless-shell path');
}

/** Launches the browser and returns a driver for one 1920x1080 page. Call `close()` when done. */
export async function openPage(executable) {
  const perfil = mkdtempSync(join(tmpdir(), 'cdp-profile-'));
  const proc = spawn(
    executable,
    ['--headless', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--hide-scrollbars', '--force-color-profile=srgb', '--no-first-run', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const terminado = new Promise((res) => proc.once('exit', res));
  // Kills the browser and only then removes its profile: while it shuts down it is still writing there.
  const cerrar = async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
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
      plazo = setTimeout(() => rej(new Error(`the browser did not start in time: ${buf.trim()}`)), 15000);
    }).finally(() => clearTimeout(plazo));
    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', () => rej(new Error('could not connect to the browser')));
    });
  } catch (err) {
    await cerrar();
    throw err;
  }

  let id = 0;
  const pendientes = new Map();
  const oyentes = [];
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
      const i = ++id;
      pendientes.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });

  try {
    const { targetId } = await enviar('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
    const cmd = (method, params) => enviar(method, params, sessionId);
    await cmd('Page.enable');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

    return {
      async navigate(url) {
        const cargada = new Promise((res) => {
          const oyente = (m) => {
            if (m.method === 'Page.loadEventFired') {
              oyentes.splice(oyentes.indexOf(oyente), 1);
              res();
            }
          };
          oyentes.push(oyente);
        });
        await cmd('Page.navigate', { url });
        await cargada;
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
