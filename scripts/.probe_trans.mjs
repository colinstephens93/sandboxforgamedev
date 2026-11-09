import { startApp, openPage } from './lib/browser.mjs';
const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, quality: 'low', logs });
await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 180000 });
const out = await page.evaluate(() => {
  const g = window.__game;
  g.introT = 999; g.setMode('walk'); g.mode = 'fixed';
  const env = () => ({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning });
  g.ign.setKey(0, {}); g.advance(0.2); g.plant.stopEngine();
  g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(0.5);
  g.ai.plug(true); g.ai.setCharger(true); g.plant.setRegulator('LBZ');
  g.ai.read(env()); g.advance(14); g.ai.saveBackup(env()); g.advance(7);
  g.ai.write(env(), 'race'); g.advance(65); g.ign.setKey(0, {}); g.advance(1);
  g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(3); g.ign.setKey(3, { coolantF: 190, range: 'P' }); g.advance(4); g.ign.releaseStart(); g.advance(8);
  g.plant.warm(198, 190);
  const rows = [];
  for (let i = 0; i < 30; i++) {
    g.dyno.strapAll(true); g.dyno.setFan(true); g.dyno.startRun();
    let n = 0; let maxSlip = 0;
    while (!['done', 'idle', 'refused'].includes(g.dyno.phase) && n++ < 4000) { g.advance(0.25, 0.01); maxSlip = Math.max(maxSlip, g.plant.dl.cpSlip); }
    rows.push({ i, hp: g.dyno.last ? +g.dyno.last.peakHp.toFixed(0) : null, slip: +g.plant.dl.slipEnergyKj.toFixed(1), transF: +g.plant.dl.transF.toFixed(0), maxSlipRpm: +maxSlip.toFixed(0), fail: g.plant.fail.state.transmission });
    if (g.plant.fail.state.transmission) break;
  }
  return { cal: g.plant.cal.id, reg: g.plant.pp.regulator, rows };
});
console.log(JSON.stringify(out, null, 0).slice(0, 4000));
await browser.close(); await app.close();
