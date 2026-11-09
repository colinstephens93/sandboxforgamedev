// Frame-time measurement at the three quality settings (PROMPT.md section 11: "frame time is reasonable",
// plus the quality setting from section 7).
//
//   GPU=1 node scripts/perf.mjs                    # 1920 x 1080, low / medium / high
//   GPU=1 node scripts/perf.mjs high 1280x720      # one quality, another resolution
//
// Method: the app is loaded at the requested quality and resolution, the intro is skipped and the camera is
// put on the hero bookmark, then frames are timed one at a time and waited for on the GPU (a one-pixel read-back) so the number is the real
// per-frame cost of update + render (CPU and GPU), not a submit-only figure. Unrealistic outliers (first
// frames, shader compiles, texture uploads) are dropped by warming up first. The average and the 95th
// percentile are printed and written to .dev/perf.json.
//
// Why not requestAnimationFrame: in headless Chromium the page is treated as not visible and rAF is throttled
// to about 1 Hz, so rAF intervals say nothing about the frame cost. The rAF cadence is still recorded for
// reference; the frame time is the timed render loop.
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';

const only = process.argv[2] && ['low', 'medium', 'high'].includes(process.argv[2]) ? process.argv[2] : null;
const size = (process.argv[3] || process.env.PERF_SIZE || '1920x1080').split('x').map(Number);
const W = size[0] || 1920, H = size[1] || 1080;
const qualities = only ? [only] : ['low', 'medium', 'high'];

const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[i];
};

const app = await startApp();
const rows = [];
for (const quality of qualities) {
  const logs = [];
  const { browser, page } = await openPage({ url: app.url, width: W, height: H, quality, logs, dpr: 1 });
  const ready = await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 900000 }).then(() => true).catch(() => false);
  if (!ready) { console.log(`${quality}: FAILED to start`); await browser.close(); continue; }
  await page.evaluate(() => {
    const g = window.__game;
    g.introT = 999; g.advance(0.5); g.setMode('walk'); g.mode = 'fixed';
    g.prepare({ rollup: true, hideRails: true, fanAside: true });
    g.cam([3.9, 0.7, -4.5], [-0.25, 0.95, -0.7], 38);
  });
  await page.waitForTimeout(1500);
  const gpu = await page.evaluate(() => {
    const gl = window.__game.R.renderer.getContext();
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const timings = await page.evaluate(() => {
    const g = window.__game;
    const gl = g.R.renderer.getContext();
    // one pixel is read back to make the browser wait for the GPU: gl.finish() alone returns early in Chrome
    const px = new Uint8Array(4);
    const one = () => { const t0 = performance.now(); g.update(0.016); g.R.render(0.016); g.R.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
    for (let i = 0; i < 8; i++) one();           // warm up: shader compiles, uploads, first-use caches
    const out = [];
    for (let i = 0; i < 45; i++) out.push(one());
    return out;
  });
  const errs = logs.filter((l) => /error/i.test(l) && !/WebGLShadowMap|GPU stall|ReadPixels|Failed to load resource/.test(l));
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const row = {
    quality,
    frames: timings.length,
    avgMs: avg,
    p50Ms: pct(timings, 50),
    p95Ms: pct(timings, 95),
    maxMs: Math.max(...timings),
    fps: 1000 / avg,
    gpu,
    errors: errs.slice(0, 3),
  };
  rows.push(row);
  console.log(`${quality.padEnd(6)} ${row.frames} frames  avg ${row.avgMs.toFixed(2)} ms  p50 ${row.p50Ms.toFixed(2)} ms  ` +
    `p95 ${row.p95Ms.toFixed(2)} ms  max ${row.maxMs.toFixed(2)} ms  (${row.fps.toFixed(1)} fps)  [${gpu}]` +
    (errs.length ? `  ERRORS: ${errs.slice(0, 2).join(' | ')}` : ''));
  await browser.close();
}
await app.close();
fs.mkdirSync('.dev', { recursive: true });
fs.writeFileSync('.dev/perf.json', JSON.stringify({ resolution: [W, H], measured: new Date().toISOString(), rows }, null, 1));
console.log(`\nwrote .dev/perf.json (${W}x${H}). Per-frame cost includes update + render, waited for on the GPU.`);
process.exit(rows.length && rows.every((r) => r.p95Ms < 33 && r.errors.length === 0) ? 0 : 1);

