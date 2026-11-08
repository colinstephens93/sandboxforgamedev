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
// tailgate and fuel door
await ev(() => { const g = window.__game; g.truck.parts.tailgate.group.userData.interact.run(g.ctx); g.advance(4); });
const tg = await ev(() => window.__game.truck.parts.tailgate.open01);
ok('tailgate opens to horizontal and hangs', tg > 0.98, `open01 ${tg}`);
await ev(() => { const g = window.__game; g.truck.parts.tailgate.group.userData.interact.run(g.ctx); g.advance(4); });
ok('tailgate closes and latches', await ev(() => window.__game.truck.parts.tailgate.open01 < 0.02));
await ev(() => { const g = window.__game; const f = g.truck.parts.fuelDoor; f.door.userData.interact.run(g.ctx); g.advance(3); });
ok('fuel door opens', await ev(() => window.__game.truck.parts.fuelDoor.open01 > 0.98));
// ---- engine start, dyno, tuning (PROMPT.md section 11) ----
await ev(() => { const g = window.__game; g.ign.setKey(2, { coolantF: 70, range: 'P' }); g.advance(0.5); });
ok('key RUN lights the gauges and the Wait to Start light', await ev(() => window.__game.ign.gaugesOn && window.__game.ign.wtsOn));
await ev(() => { const g = window.__game; g.advance(3); g.ign.setKey(3, { coolantF: 70, range: 'P' }); g.advance(4); g.ign.releaseStart(); g.advance(15); });
const idle = await ev(() => ({ run: window.__game.plant.running, rpm: window.__game.plant.rpm }));
ok('engine starts and idles near 680 rpm', idle.run && Math.abs(idle.rpm - 680) < 40, `rpm ${idle.rpm.toFixed(0)}`);
await ev(() => { const g = window.__game; g.plant.warm(198, 188); g.dyno.runs.length = 0; });
const refused = await ev(() => { const g = window.__game; const r = g.dyno.startRun(); return { ok: r.ok, msg: g.dyno.message }; });
ok('dyno run refused without straps', !refused.ok && /straps/i.test(refused.msg), refused.msg);
const pull = async (label) => {
  await ev(() => { const g = window.__game; g.dyno.strapAll(true); g.dyno.setFan(true); g.dyno.startRun(); });
  await ev(() => { const g = window.__game; let n = 0; while (!['done','idle','refused'].includes(g.dyno.phase) && n++ < 4000) g.advance(0.25, 0.01); });
  return ev(() => { const r = window.__game.dyno.last; return r ? { hp: r.peakHp, tq: r.peakTq, id: r.id, invalid: !!r.invalid, rail: r.railErrPsi } : null; });
};
const stock = await pull('stock');
ok('stock pull completes with a graph and peaks', stock && stock.hp > 230 && stock.hp < 265, JSON.stringify(stock));
// flash procedure
const env = () => ({ keyPos: 2, engineRunning: false });
await ev(() => { const g = window.__game; g.ign.setKey(0, {}); g.advance(0.2); g.plant.stopEngine(); g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(0.5); g.ai.plug(true); });
await ev(() => { const g = window.__game; g.ai.read({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }); g.advance(14); });
const noBackup = await ev(() => { const g = window.__game; return g.ai.write({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }, 'race'); });
ok('a backup is required before the first write', noBackup === false);
await ev(() => { const g = window.__game; g.ai.saveBackup({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }); g.advance(7); });
// interrupted write: key off mid-write
await ev(() => { const g = window.__game; g.ai.setCharger(true); g.ai.write({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }, 'race'); g.advance(10); g.ign.setKey(0, {}); g.advance(1); });
ok('an interrupted write fails and leaves a no-start state', await ev(() => window.__game.ai.bricked && !!window.__game.ai.noStartReason()));
await ev(() => { const g = window.__game; g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(0.5); g.ai.write({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }, 'street'); g.advance(65); g.ign.setKey(0, {}); g.advance(1); });
ok('a full write succeeds and recovers the truck', await ev(() => !window.__game.ai.bricked && window.__game.ai.installed === 'street'), await ev(() => window.__game.ai.message));
ok('calibration swapped to Street after the key cycle', await ev(() => window.__game.plant.cal.id === 'street'));
await ev(() => { const g = window.__game; g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(3); g.ign.setKey(3, { coolantF: 190, range: 'P' }); g.advance(4); g.ign.releaseStart(); g.advance(8); g.plant.warm(198, 188); });
ok('truck starts again on the new tune', await ev(() => window.__game.plant.running));
const streetLlY = await pull('street LLY');
await ev(() => { window.__game.plant.setRegulator('LBZ'); });
const streetLbz = await pull('street LBZ');
ok('street with the stock regulator falls short on rail pressure and power', streetLlY.rail > 800 && streetLbz.hp > streetLlY.hp + 5, JSON.stringify([streetLlY, streetLbz]));
ok('street with the LBZ regulator reaches stock + 175 whp', Math.abs(streetLbz.hp - stock.hp - 175) < 6, `${(streetLbz.hp - stock.hp).toFixed(1)}`);
const errs = logs.filter((l) => /error/i.test(l) && !/WebGLShadowMap|GPU stall|ReadPixels/.test(l));
ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
await browser.close(); await app.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
