// Scripted verification (PROMPT.md section 11) in headless Chromium. node scripts/check.mjs [--full]
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
const full = process.argv.includes('--full');
const app = await startApp(5197);
const logs = [];
const { browser, page } = await openPage({ url: app.url, quality: 'low', logs });
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); };
await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 180000 });
const ev = (fn, arg) => page.evaluate(fn, arg);

// intro plays and skips
ok('intro mode on load', await ev(() => window.__game.mode === 'intro'));
await page.keyboard.press('KeyX');
await page.waitForTimeout(500);
ok('intro skips on a key', await ev(() => window.__game.mode === 'intro' ? false : true));
// (the skip jumps introT; the mode switches to walk on the next update)
ok('walk mode after intro', await page.waitForFunction(() => window.__game.mode === 'walk', null, { timeout: 5000 }).then(() => true).catch(() => false));

// every door opens and closes with the hinge limit
for (const k of ['fL', 'fR', 'rL', 'rR']) {
  await ev((k) => { const d = window.__game.truckCtl.doors[k]; d.toggle(window.__game.ctx, true); }, k);
  await ev(() => window.__game.advance(2));
  const a = await ev((k) => window.__game.truckCtl.doors[k].angle, k);
  ok(`door ${k} opens to its limit`, Math.abs(Math.abs(a) - (k[0] === 'f' ? 72 : 78) * Math.PI / 180) < 0.02, `angle ${(a * 180 / Math.PI).toFixed(1)} deg`);
  await ev((k) => { window.__game.truckCtl.doors[k].toggle(window.__game.ctx, false); }, k);
  await ev(() => window.__game.advance(2));
  ok(`door ${k} closes`, await ev((k) => window.__game.truckCtl.doors[k].angle === 0, k));
}
// hood sequence
await ev(() => { const g = window.__game; const it = g.truckCtl.hoodPivot.userData.interact; it.run(g.ctx); });
ok('hood refuses while latched', await ev(() => window.__game.truckCtl.hood.target === 0));
await ev(() => { const g = window.__game; g.truckCtl.releaseHoodFromCab(g.ctx); g.truckCtl.hoodPivot.userData.interact.run(g.ctx); });
ok('hood refuses without the secondary release', await ev(() => window.__game.truckCtl.hood.target === 0));
await ev(() => { const g = window.__game; g.truckCtl.pullSecondary(g.ctx); g.truckCtl.hoodPivot.userData.interact.run(g.ctx); });
await ev(() => window.__game.advance(3));
ok('hood opens after both releases', await ev(() => window.__game.truckCtl.hood.state === 1));
const errs = logs.filter((l) => /error/i.test(l) && !/WebGLShadowMap|GPU stall|ReadPixels/.test(l));
ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
await browser.close(); await app.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
