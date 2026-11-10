// Frame time of the bench page (index.html) next to the shop game (shop.html), same quality and resolution.
//
//   GPU=1 node scripts/benchPerf.mjs                      # quality 'bench', 1920 x 1080
//   GPU=1 node scripts/benchPerf.mjs medium 1280x720      # another preset and size
//   FRAMES=20 shortens the run (software rendering is slow); SHOP=0 skips the shop rows.
//
// Rows:
//   bench  engine view, engine running   the bench as it is used: hood up, engine idling, motion shadows capped at 30 Hz
//   bench  engine view, engine off       what one frame costs when it has to be drawn; left alone the page draws none (idle skip)
//   bench  rear wheels view, engine running    the whole truck
//   shop   hero bookmark                 exactly what scripts/perf.mjs measures (scripts/lib/shopPerf.mjs)
//   shop   engine bay, engine running    the same camera on the same engine inside the shop, for a like-for-like figure
// Every frame is update + all passes, waited for on the GPU with a one-pixel read-back. Without GPU=1 the browser
// renders in software: the numbers then only compare with each other. Writes .dev/bench-perf.json.
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
import { measureShop, summarize, realErrors } from './lib/shopPerf.mjs';

const args = process.argv.slice(2);
const quality = ['low', 'bench', 'medium', 'high'].includes(args[0]) ? args.shift() : 'bench';
const [W, H] = (args[0] || process.env.PERF_SIZE || '1920x1080').split('x').map(Number);
const frames = +(process.env.FRAMES || 45);
const rows = [];
const app = await startApp();

{
  const logs = [];
  const { browser, page } = await openPage({ url: app.url, width: W, height: H, quality, logs, dpr: 1 });
  await page.waitForFunction(() => window.__bench && window.__bench.controlsUi && window.__bench.frames > 2, null, { timeout: 900000 });
  const gpu = await page.evaluate(() => window.__bench.gpuName());
  const measure = async (scene, setup) => {
    await page.evaluate(setup);
    const res = await page.evaluate((n) => {
      const b = window.__bench, t = b.timeFrames(n);
      b.draw(0.016, true); // one frame with the shadow pass, for the counts
      const info = b.R.renderer.info.render, size = [b.canvas.width, b.canvas.height];
      return { t, calls: info.calls, tris: info.triangles, running: b.plant.running, rpm: Math.round(b.plant.rpm), size, view: b.view, quality: b.R.qualityName };
    }, frames);
    rows.push({ page: 'index.html (bench)', scene, quality: res.quality, ...summarize(res.t), calls: res.calls, tris: res.tris, running: res.running, rpm: res.rpm, size: res.size, gpu });
  };
  // engine off first (the page has just loaded), then start it through the normal start sequence
  await measure('engine view, engine off', () => { const b = window.__bench; b.paused = true; b.setView('engine', true); b.advance(1); });
  await measure('engine view, engine running', () => { const b = window.__bench; b.autoStart(); b.advance(14); });
  await measure('rear wheels view, engine running', () => { const b = window.__bench; b.setView('rearWheels', true); b.advance(1); });
  const e = realErrors(logs); if (e.length) console.log('bench ERRORS:\n' + e.join('\n'));
  await browser.close();
}
if (process.env.SHOP !== '0') {
  for (const scene of ['hero', 'engine']) {
    const r = await measureShop({ app, quality, W, H, frames, scene });
    if (r) rows.push({ ...r, scene: scene === 'hero' ? 'hero bookmark, engine off (scripts/perf.mjs)' : 'engine bay, hood open, engine running', size: [W, H] });
    else console.log(`shop.html ${scene}: FAILED to start`);
  }
}
await app.close();

console.log(`\nquality ${quality}, ${W} x ${H}, ${frames} frames each  [${rows[0] ? rows[0].gpu : '?'}]`);
for (const r of rows) console.log(`  ${r.page.padEnd(19)} ${r.scene.padEnd(44)} avg ${r.avgMs.toFixed(1).padStart(8)} ms  p95 ${r.p95Ms.toFixed(1).padStart(8)} ms  ${r.fps.toFixed(1).padStart(6)} fps  ${String(r.calls).padStart(5)} draw calls  ${String(r.tris).padStart(9)} triangles  ${r.running ? `${r.rpm} rpm` : 'engine off'}`);
const b = rows.find((r) => /bench/.test(r.page) && r.scene === 'engine view, engine running'), sh = rows.find((r) => r.page === 'shop.html' && /perf\.mjs/.test(r.scene)), se = rows.find((r) => r.page === 'shop.html' && /engine bay/.test(r.scene));
if (b && sh) console.log(`\n  bench engine view (running) vs shop hero bookmark:        ${(sh.avgMs / b.avgMs).toFixed(2)}x faster`);
if (b && se) console.log(`  bench engine view (running) vs shop engine bay (running): ${(se.avgMs / b.avgMs).toFixed(2)}x faster`);
fs.mkdirSync('.dev', { recursive: true });
fs.writeFileSync('.dev/bench-perf.json', JSON.stringify({ measured: new Date().toISOString(), quality, resolution: [W, H], frames, rows }, null, 1));
console.log('\nwrote .dev/bench-perf.json');
process.exit(rows.some((r) => r.errors && r.errors.length) ? 1 : 0);
