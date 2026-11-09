// Shared Playwright helper: starts a Vite dev server and a headless Chromium with software WebGL.
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

// Software WebGL (SwiftShader) is the default so the scripts run on machines without a GPU (slow).
// Set GPU=1 to use the machine's real GPU (much faster; recommended on a desktop).
export const CHROME_FLAGS = process.env.GPU === '1'
  ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-webgl', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle',
    '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'];

export async function startApp(port = 5300 + Math.floor(Math.random() * 2500)) {
  const server = await createServer({ server: { port, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

export async function openPage({ url, width = 1280, height = 720, dpr = 1, quality = 'medium', logs = [] }) {
  const browser = await pw.chromium.launch({ args: CHROME_FLAGS, headless: process.env.HEADED !== '1' });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
  await page.goto(url + `?quality=${quality}&test=1`);
  return { browser, page, logs };
}
