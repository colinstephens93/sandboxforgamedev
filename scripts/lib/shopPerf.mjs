// Frame-time measurement of the shop game (shop.html), shared by scripts/perf.mjs and scripts/benchPerf.mjs.
// Frames are timed one at a time and waited for on the GPU with a one-pixel read-back (gl.finish() alone returns
// early in Chrome), so the figure is update + render and does not depend on the display's refresh rate.
import { openPage } from './browser.mjs';

export const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))));
  return s[i];
};
export const summarize = (timings) => {
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  return { frames: timings.length, avgMs: avg, p50Ms: pct(timings, 50), p95Ms: pct(timings, 95), maxMs: Math.max(...timings), fps: 1000 / avg };
};
export const realErrors = (logs) => logs.filter((l) => /error/i.test(l) && !/WebGLShadowMap|GPU stall|ReadPixels|Failed to load resource/.test(l));

// scene 'hero': the hero bookmark with the engine off (what scripts/perf.mjs has always measured).
// scene 'engine': hood open, engine running, the camera where the bench's engine view puts it.
export async function measureShop({ app, quality, W, H, frames = 45, scene = 'hero' }) {
  const logs = [];
  const { browser, page } = await openPage({ url: app.url, path: 'shop.html', width: W, height: H, quality, logs, dpr: 1 });
  const ready = await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 900000 }).then(() => true).catch(() => false);
  if (!ready) { await browser.close(); return null; }
  await page.evaluate((scene) => {
    const g = window.__game;
    g.introT = 999; g.advance(0.5); g.setMode('walk'); g.mode = 'fixed';
    if (scene === 'engine') {
      g.prepare({ rollup: true, hideRails: true, fanAside: true, hood: true, engine: true });
      const z = g.truck.group.position.z;
      g.cam([0.95, 2.2, z - 2.1], [0, 1.08, z + 0.2], 46);
    } else {
      g.prepare({ rollup: true, hideRails: true, fanAside: true });
      g.cam([3.9, 0.7, -4.5], [-0.25, 0.95, -0.7], 38);
    }
  }, scene);
  await page.waitForTimeout(1500);
  const gpu = await page.evaluate(() => {
    const gl = window.__game.R.renderer.getContext();
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const timings = await page.evaluate((n) => {
    const g = window.__game;
    const gl = g.R.renderer.getContext();
    // one pixel is read back to make the browser wait for the GPU: gl.finish() alone returns early in Chrome
    const px = new Uint8Array(4);
    const one = () => { const t0 = performance.now(); g.update(0.016); g.R.render(0.016); g.R.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
    for (let i = 0; i < 8; i++) one();           // warm up: shader compiles, uploads, first-use caches
    const out = [];
    for (let i = 0; i < n; i++) out.push(one());
    return out;
  }, frames);
  // draw calls and triangles of one whole frame (every pass, shadow maps included)
  const counts = await page.evaluate(() => {
    const g = window.__game, info = g.R.renderer.info, keep = info.autoReset;
    info.autoReset = false; info.reset(); g.R.render(0.016, true);
    const c = { calls: info.render.calls, tris: info.render.triangles, running: g.plant.running, rpm: Math.round(g.plant.rpm) };
    info.autoReset = keep; return c;
  });
  const errors = realErrors(logs);
  await browser.close();
  return { page: 'shop.html', scene, quality, ...summarize(timings), ...counts, gpu, errors: errors.slice(0, 3) };
}
