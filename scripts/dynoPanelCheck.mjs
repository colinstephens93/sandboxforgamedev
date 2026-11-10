// Regression checks for live graph invalidation and collapsed-panel work.
// Uses Chromium via CHROME_PATH when provided; does not need WebGL.
import assert from 'node:assert/strict';
import { startApp, openPage } from './lib/browser.mjs';
const app = await startApp();
let browser;
try {
  const opened = await openPage({ url: app.url, path: 'scripts/uilab/index.html' });
  browser = opened.browser;
  const { page, logs } = opened;
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const g = window.__game, d = g.dyno, panel = g.uiPanels.dyno;
    d.strapAll(true); g.plant.startEngine(); d.startRun();
    let calls = 0;
    d.liveAnalysis = () => { calls++; return null; };
    g.openPanel('dyno');
    const opened = calls;
    panel.update(.13); panel.update(.13);
    const unchanged = calls;
    d.rec.t.push(.01); panel.update(.13);
    const sampled = calls; // point count still unchanged, but new samples must refresh
    panel.el.querySelector('.dx-collapse').click();
    d.rec.t.push(.02); panel.update(.13);
    const collapsed = calls;
    panel.el.querySelector('.dx-collapse').click(); panel.update(.13);
    const expanded = calls;
    g.plant.air.tempC++; panel.update(.13);
    return { opened, unchanged, sampled, collapsed, expanded, weather: calls };
  });
  assert.deepEqual(result, { opened: 1, unchanged: 1, sampled: 2, collapsed: 2, expanded: 3, weather: 4 });
  assert.equal(logs.filter(l => l.includes('[pageerror]')).length, 0, logs.join('\n'));
  console.log('Live graph checks passed:', result);
} finally {
  if (browser) await browser.close();
  await app.close();
}
