// Truck studio from the command line (studio.html: the truck and engine alone, no shop).
//
//   GPU=1 node scripts/studio.mjs perf                  # frame time per view at low / medium / high, 1920 x 1080
//   GPU=1 node scripts/studio.mjs perf high 1280x720    # one quality, another resolution
//   GPU=1 node scripts/studio.mjs shots [quality] [WxH] # one PNG per view in .dev/studio-<view>.png
//
// MERGE=0 draws every part on its own (no draw-call merging), to compare; its files get the suffix -unmerged.
// Without GPU=1 the browser renders in software: the pictures are right but the times only compare with each other.
// perf writes .dev/studio-perf.json. Frames are timed one at a time, each waited for on the GPU (see Studio.bench).
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';

const [mode = 'perf', a2, a3] = process.argv.slice(2);
const Q = ['low', 'medium', 'high'];
const only = Q.includes(a2) ? a2 : null;
const [W, H] = ((Q.includes(a2) ? a3 : a2) || '1920x1080').split('x').map(Number);
const frames = +(process.env.FRAMES || 45);
const unmerged = process.env.MERGE === '0', tag = unmerged ? '-unmerged' : '';
fs.mkdirSync('.dev', { recursive: true });

const app = await startApp();
const open = async (quality) => {
  const logs = [];
  const { browser, page } = await openPage({ url: app.url, path: 'studio.html', query: unmerged ? '&merge=0' : '', width: W, height: H, quality, logs });
  await page.waitForFunction(() => window.__studio && window.__studio.ready(), null, { timeout: 900000 });
  return { browser, page, logs };
};
const errors = (logs) => logs.filter((l) => /error/i.test(l) && !/WebGLShadowMap|GPU stall|ReadPixels|Failed to load resource/.test(l));
let ok = true;

if (mode === 'shots') {
  const quality = only || 'high';
  const { browser, page, logs } = await open(quality);
  const names = await page.evaluate(() => import('/src/studio/studio.js').then((m) => m.VIEW_ORDER));
  for (const name of names) {
    const data = await page.evaluate((n) => { const s = window.__studio; s.busy = true; s.setView(n, true); s.shot(); return s.shot(); }, name);
    fs.writeFileSync(`.dev/studio-${name}${tag}.png`, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`saved .dev/studio-${name}${tag}.png`);
  }
  const e = errors(logs); if (e.length) { ok = false; console.log('ERRORS:\n' + e.join('\n')); }
  await browser.close();
} else {
  const out = [];
  for (const quality of only ? [only] : Q) {
    const { browser, page, logs } = await open(quality);
    const res = await page.evaluate((n) => window.__studio.bench({ frames: n }), frames);
    const e = errors(logs); if (e.length) ok = false;
    out.push({ ...res, errors: e.slice(0, 3) });
    console.log(`\n${quality}  ${res.resolution.join(' x ')}  [${res.gpu}]`);
    for (const r of res.rows) console.log(`  ${r.view.padEnd(10)} avg ${r.avgMs.toFixed(2).padStart(8)} ms  p95 ${r.p95Ms.toFixed(2).padStart(8)} ms  ${r.fps.toFixed(1).padStart(6)} fps  script ${r.cpuMs.toFixed(2).padStart(6)} ms  ${String(r.calls).padStart(5)} draw calls  ${String(r.tris).padStart(9)} triangles`);
    if (e.length) console.log('  ERRORS: ' + e.slice(0, 2).join(' | '));
    await browser.close();
  }
  fs.writeFileSync(`.dev/studio-perf${tag}.json`, JSON.stringify({ measured: new Date().toISOString(), results: out }, null, 1));
  console.log(`\nwrote .dev/studio-perf${tag}.json`);
}
await app.close();
process.exit(ok ? 0 : 1);
