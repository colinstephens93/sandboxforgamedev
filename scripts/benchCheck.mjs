// Browser regression check for the simplified bench views and direct tuning.
// CHROME_PATH=/usr/bin/chromium node scripts/benchCheck.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
const app = await startApp();
let browser;
try {
  const opened = await openPage({ url: app.url, quality: 'bench', width: 1280, height: 720 });
  browser = opened.browser;
  const { page, logs } = opened;
  await page.waitForFunction(() => window.__bench?.controlsUi, null, { timeout: 180000 });
  await page.waitForSelector('#loading', { state: 'detached' });
  await page.evaluate(() => { window.__bench.paused = true; });
  const advance = (seconds = .2) => page.evaluate(s => window.__bench.advance(s), seconds);
  assert.deepEqual(await page.locator('#controls [data-view]').allTextContents(), ['Engine', 'Engine alone', 'Cutaway', 'Rear wheels']);
  for (const [index, view] of ['engine', 'engineAlone', 'cutaway', 'rearWheels'].entries()) {
    await page.keyboard.press(`Digit${index + 1}`); await advance(1);
    assert.equal(await page.evaluate(() => window.__bench.view), view);
  }
  await page.keyboard.press('Digit5');
  assert.equal(await page.evaluate(() => window.__bench.view), 'rearWheels');
  // A fresh, stopped engine must be tunable without any connection setup.
  await page.evaluate(async () => { const { resetTruck } = await import('/src/ui/shopMenu.js'); resetTruck(window.__bench); });
  await page.locator('[data-panel="ailive"]').click(); await advance();
  assert.deepEqual(await page.locator('.al-navbtn').allTextContents(), ['QUICK TUNES', 'TURBO SOUND', 'DATALOG', 'COMPARE']);
  assert.equal(await page.locator('.al-connect,.al-truck').count(), 0);
  const tune = id => page.locator('.al-tune').filter({ has: page.locator('h3', { hasText: id }) }).locator('.wr');
  await tune('Street').click(); await advance();
  assert.deepEqual(await page.evaluate(() => {
    const b = window.__bench;
    return [b.plant.cal.id, b.ai.installed, b.ai.cable, b.ai.charger, b.ai.backup, b.ign.key, b.ai.needsKeyCycle];
  }), ['street', 'street', false, false, false, 0, false]);
  await page.locator('[data-view="cutaway"]').click(); await advance(15);
  assert.equal(await page.evaluate(() => window.__bench.plant.running), true);
  await page.locator('.al-navbtn').filter({ hasText: 'TURBO SOUND' }).click();
  await page.locator('.al-sound input[data-r="close"]').fill('20');
  await page.locator('.al-navbtn').filter({ hasText: 'QUICK TUNES' }).click();
  await tune('Stock').click(); await advance();
  assert.deepEqual(await page.evaluate(() => {
    const b = window.__bench;
    return [b.plant.cal.id, b.ai.installed, b.plant.running, b.ign.key, b.plant.pp.sound.close, b.ai.needsKeyCycle];
  }), ['stock', 'stock', true, 2, .2, false]);
  // Tune changes must not alter a pull already in progress.
  await page.evaluate(() => window.__bench.dyno.startRun()); await advance();
  assert.equal(await tune('Street').isDisabled(), true);
  await page.evaluate(() => window.__bench.dyno.abort()); await advance();
  assert.equal(await tune('Street').isEnabled(), true);
  await page.evaluate(async () => { const { resetTruck } = await import('/src/ui/shopMenu.js'); resetTruck(window.__bench); });
  await advance(); await tune('Street').click(); await advance();
  assert.equal(await page.evaluate(() => window.__bench.plant.cal.id), 'street');
  await page.locator('[data-view="engineAlone"]').click();
  await page.evaluate(() => { const b = window.__bench; b.settle(); b.draw(.016, true); });
  fs.mkdirSync('.dev', { recursive: true });
  await page.screenshot({ path: '.dev/bench-direct-tuning.png' });
  assert.equal(logs.filter(l => l.includes('[pageerror]')).length, 0, logs.join('\n'));
  console.log('PASS: four views and shortcuts; direct tuning stopped/running; turbo sound; active-run guard; reset; no page errors.');
} finally {
  if (browser) await browser.close();
  await app.close();
}
