// Experiment runner: loads the app once, applies several JS snippets, reports mean luminance of regions per variant.
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
const variants = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); // [{name, js}]
const app = await startApp(5198);
const logs = [];
const { browser, page } = await openPage({ url: app.url, path: 'shop.html', quality: 'low', logs });
await page.waitForFunction(() => window.__game && window.__game.frames > 1, null, { timeout: 120000 });
await page.evaluate(() => window.__game.cam([-10.5, 1.65, 7.5], [0, 1.4, -1], 60));
for (const v of variants) {
  await page.evaluate(v.js);
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => window.__game.shot());
  fs.writeFileSync(`/tmp/lab_${v.name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(v.name);
}
if (logs.length) console.log(logs.join('\n'));
await browser.close(); await app.close();
