// npm run shots: opens the app in headless Chromium (software WebGL), applies each named camera bookmark and saves the 12 showcase screenshots.
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
import { BOOKMARKS, BOOKMARK_ORDER } from '../src/game/bookmarks.js';
const quality = process.env.SHOTS_QUALITY || 'high';
const only = process.argv.slice(2);
const W = +(process.env.SHOTS_W || 1920), H = +(process.env.SHOTS_H || 1080);
const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, width: W, height: H, quality, logs, dpr: 1 });
await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 900000 });
await page.evaluate(() => { const g = window.__game; g.introT = 999; g.advance(0.5); g.setMode('walk'); g.mode = 'fixed'; });
fs.mkdirSync('screenshots', { recursive: true });
// the bookmark module is imported in Node for its data; the setup functions are re-resolved in the page by name
for (const name of BOOKMARK_ORDER) {
  if (only.length && !only.includes(name)) continue;
  const b = BOOKMARKS[name];
  console.log('shot', name);
  await page.evaluate(([n]) => {
    const g = window.__game;
    const presets = {
      hero: { rollup: true }, side: {}, rear: { tailgate: true, straps: true }, engine: { hood: true }, driver: { engine: true }, door: { door: 'fL' },
      dynoScreen: { run: 'stock' }, pit: { straps: true }, shopWide: { rollup: true }, wheel: {}, ailive: { flash: 'writing' }, compare: { compare: 'race' },
    };
    g.prepare(presets[n]); g.mode = 'fixed';
  }, [name]);
  if (b.pos) await page.evaluate(([p, t, f]) => window.__game.cam(p, t, f), [b.pos, b.tgt, b.fov]);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.__game; g.paused = true; });
  await page.waitForTimeout(500);
  if (b.dom) await page.screenshot({ path: `screenshots/${b.file}.png`, timeout: 300000 });
  else {
    const data = await page.evaluate(() => { const g = window.__game; g.R.render(0.016); return g.canvas.toDataURL('image/png'); });
    fs.writeFileSync(`screenshots/${b.file}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  await page.evaluate(() => { window.__game.paused = false; });
}
const errs = logs.filter((l) => /error/i.test(l));
if (errs.length) console.log('console errors:\n' + errs.join('\n'));
await browser.close(); await app.close();
