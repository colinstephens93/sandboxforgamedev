// Registers the three UI panels (dyno, ailive, shop) and the per-frame hook that connects AI Live to the truck.
import css from './ailive.css?inline';
import { createDynoPanel, createDynoAlerts } from './dynoPanel.js';
import { createAILivePanel } from './ailive.js';
import { createShopMenu } from './shopMenu.js';
import { loadCal } from '../sim/calibrations.js';

export function registerUi(game) {
  if (!document.getElementById('dds-ui-css')) {
    const st = document.createElement('style'); st.id = 'dds-ui-css'; st.textContent = css; document.head.appendChild(st);
  }
  const panels = { dyno: createDynoPanel(game), ailive: createAILivePanel(game), shop: createShopMenu(game) };
  const alerts = createDynoAlerts(game);
  game.uiPanels = panels; game.uiAlerts = alerts;
  for (const [name, p] of Object.entries(panels)) {
    game.ui.addPanel(name, p.el);
    game.registerPanel(name, { el: p.el, open: () => p.open(), close: () => p.close(), update: (dt) => p.update(dt) });
  }
  game.ui.addPanel('alerts', alerts.el);
  // The game's key handler ignores keys typed into form controls; make Esc and the panel's own key still work there.
  const PANEL_KEY = { dyno: 'KeyT', ailive: 'KeyL', shop: 'KeyM' };
  for (const [name, p] of Object.entries(panels)) {
    p.el.addEventListener('keydown', (e) => {
      if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Escape') game.closePanels(); else if (e.code === PANEL_KEY[name] && e.target.type !== 'text') game.openPanel(name);
    });
  }

  let flicker = false;
  // every frame, before the simulation step (Game.update calls hooks first)
  game.hooks.push((dt) => {
    const ai = game.ai, ign = game.ign;
    // Bench tunes apply immediately; shop flashes wait for a key cycle. Both load the same calibration and vane settings.
    if ((ai.directTuning || ign.key < 2) && ai.needsKeyCycle) {
      const a = ai.keyCycled();
      if (a) { game.plant.setCalibration(loadCal(a.tune)); game.plant.pp.sound = a.sound; panels.ailive.setApplied(a.sound); }
    }
    // a failed write leaves the ECM unable to run: the ignition refuses to crank, the cluster is dark or flickers
    ign.blocked = ai.noStartReason();
    ign.clusterFault = !!ai.bricked;
    if (ai.bricked && ign.key >= 2) { const on = Math.sin(game.time * 13.1) + Math.sin(game.time * 29.7) > 0.35; ign.gaugesOn = on; ign.dicPowered = on; flicker = true; } // cluster flickers: the ECM is half-programmed
    else if (flicker) { ign.gaugesOn = ign.dicPowered = ign.key >= 2; flicker = false; }
    alerts.tick(dt); panels.ailive.tick(); panels.shop.tick(dt);
    for (const p of Object.values(panels)) if (p.state && p.state.open) p.update(dt);
  });
  return panels;
}
