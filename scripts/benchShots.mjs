// One PNG per bench view (index.html) in .dev/bench-<view>.png, plus the page with each panel docked.
//   node scripts/benchShots.mjs [quality] [WxH]      (GPU=1 uses the real graphics card)
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';

const [quality = 'bench', size = '1366x768'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
fs.mkdirSync('.dev', { recursive: true });
const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, width: W, height: H, quality, logs });
await page.waitForFunction(() => window.__bench && window.__bench.ready() && window.__bench.controlsUi, null, { timeout: 900000 });
await page.evaluate(() => { window.__bench.paused = true; }); // the script advances time itself
const names = await page.evaluate(() => Object.keys(window.__bench.views));
const snap = async (file) => { await page.evaluate(() => { const b = window.__bench; b.controls.update(); b.tick(0); b.draw(0.016, true); }); await page.screenshot({ path: file }); console.log(`saved ${file}`); };
for (const name of names) {
  await page.evaluate((n) => { const b = window.__bench; b.setView(n, true); if (n === 'cutaway') b.autoStart(); b.advance(n === 'cutaway' ? 14 : 2); b.settle(); }, name);
  await snap(`.dev/bench-${name}.png`);
}
// the engine running in the engine view, then each panel docked beside it
await page.evaluate(() => { const b = window.__bench; b.setView('engine', true); b.autoStart(); b.advance(12); b.plant.warm(198, 188); b.dyno.strapAll(true); b.dyno.setFan(true); b.dyno.startRun(); let n = 0; while (b.dynoRunning && n++ < 4000) b.advance(0.25, 0.01); });
for (const p of ['dyno', 'ailive', 'shop']) {
  await page.evaluate((p) => { const b = window.__bench; b.openPanel(p); b.advance(0.5); }, p);
  await snap(`.dev/bench-panel-${p}.png`);
}
await page.evaluate(() => { const b = window.__bench; b.closePanels(); b.setView('rearWheels', true); b.advance(3); });
await snap('.dev/bench-rear-wheels-running.png');
const errs = logs.filter((l) => /error/i.test(l) && !/WebGLShadowMap|GPU stall|ReadPixels|Failed to load resource/.test(l));
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await browser.close(); await app.close();
process.exit(errs.length ? 1 : 0);
