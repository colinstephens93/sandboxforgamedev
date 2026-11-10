// Loads the production build (dist/, after `npm run build`) of every page in headless Chromium:
// index.html (the bench), shop.html (the shop game) and studio.html. Fails on a console error or a page that does not start.
// The build uses base './' so it works from any hosting path (a GitHub Pages project site); to prove that, dist/ is
// served under a sub-path here.   node scripts/distCheck.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CHROME_FLAGS } from './lib/browser.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const DIST = path.resolve('dist'), SUB = '/sandboxforgamedev/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(SUB)) { res.writeHead(404); res.end('outside the project path'); return; }
  let rel = decodeURIComponent(url.pathname.slice(SUB.length)) || 'index.html';
  const file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}${SUB}`;
const pages = [
  ['', 'bench', () => window.__bench && window.__bench.controlsUi && window.__bench.frames > 2 && !!window.__bench.uiPanels, '?debug=1&quality=bench'],
  ['shop.html', 'shop game', () => window.__game && window.__game.frames > 2, '?debug=1&quality=low'],
  ['studio.html', 'studio', () => window.__studio && window.__studio.ready(), '?quality=low'],
];
let ok = true;
const browser = await pw.chromium.launch({ args: CHROME_FLAGS, headless: process.env.HEADED !== '1', ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
for (const [file, label, ready, query] of pages) {
  const html = fs.readFileSync(path.join(DIST, file || 'index.html'), 'utf8');
  const absolute = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const logs = [], failed = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(base + file + query);
  const started = await page.waitForFunction(ready, null, { timeout: 600000 }).then(() => true).catch(() => false);
  const title = await page.title();
  const errs = logs.filter((l) => !/WebGLShadowMap|GPU stall|ReadPixels/.test(l));
  const good = started && !errs.length && !failed.length && !absolute.length;
  ok &&= good;
  console.log(`${good ? 'PASS' : 'FAIL'} dist/${file || 'index.html'} (${label}): "${title}" ${started ? 'started' : 'DID NOT START'}, ${errs.length} console errors, ${failed.length} failed requests, ${absolute.length} absolute asset paths`);
  for (const l of [...errs, ...failed, ...absolute].slice(0, 5)) console.log('   ' + l);
  await page.close();
}
await browser.close(); server.close();
process.exit(ok ? 0 : 1);
