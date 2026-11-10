// Frame-time measurement of the shop game (shop.html) at the three quality settings (PROMPT.md section 11: "frame time is reasonable",
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
import { startApp } from './lib/browser.mjs';
import { measureShop } from './lib/shopPerf.mjs';

const only = process.argv[2] && ['low', 'bench', 'medium', 'high'].includes(process.argv[2]) ? process.argv[2] : null;
const size = (process.argv[3] || process.env.PERF_SIZE || '1920x1080').split('x').map(Number);
const W = size[0] || 1920, H = size[1] || 1080;
const qualities = only ? [only] : ['low', 'medium', 'high'];

const app = await startApp();
const rows = [];
for (const quality of qualities) {
  const row = await measureShop({ app, quality, W, H, frames: +(process.env.FRAMES || 45) }); // FRAMES=<n> shortens the run (software rendering is slow)
  if (!row) { console.log(`${quality}: FAILED to start`); continue; }
  rows.push(row);
  console.log(`${quality.padEnd(6)} ${row.frames} frames  avg ${row.avgMs.toFixed(2)} ms  p50 ${row.p50Ms.toFixed(2)} ms  ` +
    `p95 ${row.p95Ms.toFixed(2)} ms  max ${row.maxMs.toFixed(2)} ms  (${row.fps.toFixed(1)} fps)  [${row.gpu}]` +
    (row.errors.length ? `  ERRORS: ${row.errors.slice(0, 2).join(' | ')}` : ''));
}
await app.close();
fs.mkdirSync('.dev', { recursive: true });
fs.writeFileSync('.dev/perf.json', JSON.stringify({ resolution: [W, H], measured: new Date().toISOString(), rows }, null, 1));
console.log(`\nwrote .dev/perf.json (${W}x${H}). Per-frame cost includes update + render, waited for on the GPU.`);
process.exit(rows.length && rows.every((r) => r.p95Ms < 33 && r.errors.length === 0) ? 0 : 1);
