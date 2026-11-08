// UI lab: the real UI modules on top of the real simulation, without the 3D scene. Used by scripts/uilab.mjs.
import { Game } from '/src/game/game.js';
import { UI } from '/src/ui/ui.js';
import { registerUi } from '/src/ui/index.js';
import { loadCal } from '/src/sim/calibrations.js';

const G = Game.prototype;
class Fake {
  constructor() {
    this.hooks = []; this.state = {}; this.time = 0; this.qname = 'low'; this.pedal = 0;
    this.R = { setQuality() {} }; this.input = { unlock() {} }; this.truckCtl = { hood: { open: true } };
    this.ui = new UI(document.getElementById('ui')); this.initSim();
    this.state.dyno = this.dyno; this.state.ailive = this.ai; this.state.plant = this.plant;
  }
  update(dt) {
    this.time += dt; for (const h of this.hooks) h(dt);
    this.simAcc += dt; let n = 0;
    while (this.simAcc >= 1 / 120 && n < 8) { this.stepSim(1 / 120); this.simAcc -= 1 / 120; n++; }
    if (this.simAcc > 0.1) this.simAcc = 0;
    this.ui.update(dt);
  }
}
for (const k of ['initSim', 'registerPanel', 'openPanel', 'closePanels', 'setShopTemp', 'stepSim', 'advance']) Fake.prototype[k] = G[k];
const g = new Fake();
registerUi(g);
window.__game = g;
window.__loadCal = loadCal;
window.__ready = true;
