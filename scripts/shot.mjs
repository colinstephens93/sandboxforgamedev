// Quick screenshot helper for development: node scripts/shot.mjs <name> "<camx,camy,camz>" "<tx,ty,tz>" [fov] [quality] [W] [H]
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
const [name = 'test', cam = '-10.5,1.65,7.5', tgt = '0,1.2,-1', fov = '60', quality = 'medium', W = '1280', H = '720'] = process.argv.slice(2);
const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, width: +W, height: +H, quality, logs });
await page.waitForFunction(() => window.__game && window.__game.frames > 1, null, { timeout: 180000 });
await page.evaluate(([c, t, f]) => window.__game.setCam(c.split(',').map(Number), t.split(',').map(Number), +f), [cam, tgt, fov]);
await page.waitForTimeout(1500);
const data = await page.evaluate(() => window.__game.shot());
fs.mkdirSync('screenshots', { recursive: true });
fs.writeFileSync(`screenshots/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
console.log('saved screenshots/' + name + '.png', 'fps~', await page.evaluate(() => window.__game.fps.toFixed(1)));
if (logs.length) console.log('LOGS:\n' + logs.join('\n'));
await browser.close(); await app.close();
