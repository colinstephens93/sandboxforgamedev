import { startApp, openPage } from './lib/browser.mjs';
const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, width: 1920, height: 1080, quality: 'low', logs });
await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 300000 });
console.log('ready, frames', await page.evaluate(() => window.__game.frames));
await page.evaluate(() => { const g = window.__game; g.introT = 999; g.advance(0.5); g.setMode('walk'); g.mode = 'fixed'; });
const t = await page.evaluate(() => new Promise((resolve) => {
  const arr = []; const loop = (ts) => { arr.push(ts); if (arr.length < 21) requestAnimationFrame(loop); else resolve(arr); };
  requestAnimationFrame(loop);
}));
const d = []; for (let i = 1; i < t.length; i++) d.push(+(t[i] - t[i - 1]).toFixed(1));
console.log('20 intervals:', d.join(' '));
const burst = await page.evaluate(() => { const g = window.__game; const gl = g.R.renderer.getContext(); const t0 = performance.now(); for (let i = 0; i < 10; i++) { g.update(0.016); g.R.render(0.016); } gl.finish(); return (performance.now() - t0) / 10; });
console.log('burst ms/frame:', burst.toFixed(2));
await browser.close(); await app.close();
