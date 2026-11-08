// The scripted play-through used to look at the UI: stock pull, flash the Street tune, LBZ regulator, second pull, breakage.
// Works on the full game (window.__game) and on the UI lab (scripts/uilab). All drive through the same public API as the player.
import fs from 'node:fs';

export async function runScript(page, { dir, only = null }) {
  fs.mkdirSync(dir, { recursive: true });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name) => { await page.waitForTimeout(300); await page.screenshot({ path: `${dir}/${name}.png`, timeout: 300000 }); console.log('shot', name); };
  const adv = (s) => ev((s) => window.__game.advance(s), s);
  const panel = async (name) => { await ev((n) => { const g = window.__game; g.closePanels(); g.openPanel(n); }, name); await adv(0.3); };
  const start = async () => {
    await ev(() => window.__game.ign.setKey(2, { coolantF: 70, range: 'P' })); await adv(4);
    await ev(() => window.__game.ign.setKey(3, { coolantF: 70, range: 'P' })); await adv(3);
    await ev(() => window.__game.ign.releaseStart()); await adv(3);
  };
  const finishRun = () => ev(() => { const g = window.__game; for (let i = 0; i < 200 && !['done', 'idle', 'refused'].includes(g.dyno.phase); i++) g.advance(1); });
  const redraw = () => ev(() => window.__game.uiPanels.dyno.redraw());
  const out = {};

  // ---- dyno: empty, refused, live, finished (stock baseline)
  await ev(() => window.__game.plant.warm(198, 188));
  await start();
  await panel('dyno'); await redraw(); await shot('01-dyno-empty');
  await ev(() => window.__game.dyno.startRun()); await adv(0.2); await redraw(); await shot('02-dyno-refused');
  await ev(() => { const d = window.__game.dyno; d.strapAll(true); d.setFan(true); });
  await ev(() => window.__game.dyno.startRun()); await adv(13); await redraw(); await shot('03-dyno-live');
  await finishRun(); await adv(2); await redraw(); await shot('04-dyno-stock-done');
  out.stock = await ev(() => { const r = window.__game.dyno.last; return `${r.peakHp.toFixed(1)} whp ${r.peakTq.toFixed(0)} lb-ft`; });

  // ---- AI Live: connect, read, backup, write Street with the charger on, cycle the key
  await ev(() => window.__game.ign.setKey(0)); await adv(1);
  await panel('ailive'); await shot('10-ailive-connect-start');
  await ev(() => { const g = window.__game; g.ai.plug(true); g.ai.setCharger(true); g.ign.setKey(2, { coolantF: 70, range: 'P' }); }); await adv(3);
  await shot('11-ailive-connect-ready');
  await ev(() => window.__game.uiPanels.ailive.go('truck')); await ev(() => document.querySelector('.al-act[data-a="read"] .go').click()); await adv(5); await shot('12-ailive-truck-reading');
  await adv(10); await ev(() => document.querySelector('.al-act[data-a="backup"] .go').click()); await adv(7);
  await ev(() => window.__game.uiPanels.ailive.go('tunes')); await adv(0.3); await shot('13-ailive-tunes-lly');
  await ev(() => { document.querySelectorAll('.al-tune')[4].querySelector('.wr').click(); }); await adv(24); await shot('14-ailive-truck-writing');
  await adv(40); await shot('15-ailive-truck-writedone');
  await ev(() => window.__game.ign.setKey(0)); await adv(1);
  out.afterCycle = await ev(() => `${window.__game.plant.cal.id} installed=${window.__game.ai.installed}`);
  await start();

  // ---- turbo sound with preview on
  await ev(() => { const g = window.__game; g.ai.setSound(0.6, 0.2); g.uiPanels.ailive.go('sound'); g.uiPanels.ailive.state.preview = true; }); await adv(6); await shot('16-ailive-sound');
  await ev(() => { const g = window.__game; g.uiPanels.ailive.state.preview = false; g.ai.resetSound('stock'); g.plant.pp.sound = { close: 0, hold: 0 }; });

  // ---- shop menu: LBZ regulator
  await ev(() => window.__game.ign.setKey(0)); await adv(1);
  await panel('shop'); await ev(() => { document.querySelector('.sm-tabs [data-tab="parts"]').click(); document.querySelector('.sm .inst').click(); }); await adv(4); await shot('20-shop-regulator-install');
  await adv(6); await shot('21-shop-after-regulator');

  // ---- second pull: Street + LBZ regulator
  await ev(() => window.__game.plant.warm(198, 188));
  await start();
  await ev(() => window.__game.dyno.startRun()); await adv(3); await finishRun(); await adv(2);
  await panel('dyno');
  await ev(() => { const el = document.querySelector('.dx-compare'); el.checked = true; el.dispatchEvent(new Event('change')); }); await adv(0.4); await redraw();
  await shot('30-dyno-compare');
  out.runs = await ev(() => window.__game.dyno.runs.map((r) => `${r.id} ${r.tuneName} ${r.regulator} ${r.peakHp.toFixed(1)}whp ${r.peakTq.toFixed(0)}lbft`).join(' | '));
  await panel('ailive');
  for (const [p, n] of [['compare', '31-ailive-compare'], ['datalog', '32-ailive-datalog'], ['tunes', '33-ailive-tunes-lbz'], ['truck', '35-ailive-truck-idle']]) {
    await ev((p) => window.__game.uiPanels.ailive.go(p), p); await adv(0.5); await shot(n);
  }
  await panel('shop'); await ev(() => document.querySelector('.sm-tabs [data-tab="shop"]').click()); await shot('34-shop-menu');

  // ---- breakage: Race tune with the vanes held closed at full load overspeeds the turbo
  await ev(() => { const g = window.__game; g.plant.setCalibration(window.__loadCal ? window.__loadCal('race') : g.plant.cal); g.plant.pp.sound = { close: 1, hold: 1 }; g.plant.warm(198, 188); });
  let broke = null;
  for (let i = 0; i < 4 && !broke; i++) {
    await ev(() => window.__game.dyno.startRun()); await finishRun(); await adv(1);
    broke = await ev(() => { const f = window.__game.plant.fail.events; return f.length ? f[f.length - 1].title : null; });
  }
  out.broke = broke;
  out.lastRun = await ev(() => { const r = window.__game.dyno.last; return r ? `${r.tuneName} ${r.invalid ? 'INVALID' : r.peakHp.toFixed(0) + ' whp'} turbo ${r.maxTurboKrpm}k egt ${r.maxEgtF}` : ''; });
  await panel('dyno'); await adv(0.5); await redraw();
  await shot('40-failure');
  if (broke) {
    await ev(() => { const b = document.querySelector('.dx-modal .go'); if (b) b.click(); }); await adv(0.3); await shot('42-shop-repairs');
    await ev(() => document.querySelector('.sm .rep:not(:disabled)').click()); await adv(2); await shot('43-shop-repairing');
    await adv(8); await shot('44-shop-repaired');
  }
  console.log(JSON.stringify(out, null, 1));
  return out;
}
