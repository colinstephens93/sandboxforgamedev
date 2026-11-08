// Debug probe: loads the app and prints console output, with a hard time limit. node scripts/probe.mjs [quality] [seconds]
import { startApp, openPage } from './lib/browser.mjs';
const [quality = 'low', secs = '60'] = process.argv.slice(2);
const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, quality, logs });
const t0 = Date.now();
try {
  await page.waitForFunction(() => window.__game && window.__game.frames > 1, null, { timeout: +secs * 1000 });
  console.log('loaded in', Date.now() - t0, 'ms', await page.evaluate(() => window.__game.R.renderer.info.render));
} catch (e) { console.log('TIMEOUT', await page.evaluate(() => document.getElementById('loadmsg')?.textContent)); }
console.log(logs.slice(0, 12).join('\n').slice(0, 4000));
await browser.close(); await app.close();
