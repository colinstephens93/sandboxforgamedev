// Screenshots of the UI panels on the real simulation, no 3D scene (fast). node scripts/uilab.mjs [W] [H]
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
import { runScript } from './lib/uiScript.mjs';
const [W = '1280', H = '720'] = process.argv.slice(2);
const app = await startApp(5301);
const logs = [];
const { browser, page } = await openPage({ url: app.url + 'scripts/uilab/index.html', width: +W, height: +H, quality: 'low', logs });
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
fs.mkdirSync('.dev/ui', { recursive: true });
await runScript(page, { dir: `.dev/ui/lab${W}` });
console.log(logs.length ? 'LOGS:\n' + logs.join('\n') : 'no console errors');
await browser.close(); await app.close();
