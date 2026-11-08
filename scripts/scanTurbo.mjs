import { Powerplant } from '../src/sim/engine.js';
import { makeAir } from '../src/sim/atmos.js';
import { P } from '../src/sim/params.js';
import { TEMPLATES, RPM_NODES } from '../src/sim/calTemplates.js';
const air = makeAir();
const t = TEMPLATES.stock;
const tbl = (ys) => ({ x: RPM_NODES, y: ys });
const qty = { 1600: 86, 3000: 90 };
for (const [k, v] of Object.entries(process.env.PARAMS ? JSON.parse(process.env.PARAMS) : {})) P[k] = v;
for (const rpm of [1000, 1600, 2400, 3000]) {
  const row = [];
  for (const v of [0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
    const cal = { ...t, fuel: tbl(RPM_NODES.map((r) => r < 1000 ? 30 : r < 1400 ? 55 + (r-1000)*0.07 : 84 + (r-1600)*0.003)), timing: tbl(t.timing), rail: tbl(t.railPsi), boost: tbl(t.boostPsi), torqueLimit: tbl(t.torqueLimit), vane: { x: RPM_NODES, light: RPM_NODES.map(() => 0.5), full: RPM_NODES.map(() => v) } };
    cal.torqueLimit = tbl(RPM_NODES.map(() => 5000));
    const pp = new Powerplant({ cal, regulator: 'LBZ', air });
    pp._vane = () => v;
    let o; for (let i = 0; i < 1500; i++) { o = pp.compute(rpm, { pedal: 1 }, 0.01); pp.advance(0.01); }
    row.push(`v${v}: ${o.boostPsi.toFixed(1)}psi ${(o.turboRpm / 1000).toFixed(0)}k tq${o.torqueLbFt.toFixed(0)} drv${(o.driveKpa / 6.895).toFixed(0)}psi egt${((o.egtPreK - 273.15) * 1.8 + 32).toFixed(0)}`);
  }
  console.log(rpm, '\n  ' + row.join('\n  '));
}
