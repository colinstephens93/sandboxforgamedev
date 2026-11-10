// Fits calibration tables against the physics. Run: node scripts/fit.mjs  -> writes src/data/calFit.js
import fs from 'node:fs';
import { Powerplant } from '../src/sim/engine.js';
import { makeAir } from '../src/sim/atmos.js';
import { TEMPLATES, RPM_NODES, STOCK_TORQUE_TARGET } from '../src/sim/calTemplates.js';
import { LBFT } from '../src/data/truckSpec.js';
import { P } from '../src/sim/params.js';

const air = makeAir();
const tbl = (ys) => ({ x: RPM_NODES, y: ys.slice() });

function buildCal(t, fuel, vaneFull) {
  return {
    ...t, fuel: tbl(fuel), timing: tbl(t.timing), rail: tbl(t.railPsi), boost: tbl(t.boostPsi),
    torqueLimit: tbl(t.torqueLimit), vane: { x: RPM_NODES, light: RPM_NODES.map(() => t.vaneLight), full: vaneFull.slice() },
  };
}

function settle(pp, rpm, pedal, seconds = 10, dt = 0.01) {
  let o;
  for (let t = 0; t < seconds; t += dt) { o = pp.compute(rpm, { pedal }, dt); pp.advance(dt); }
  return o;
}

export function fitNodes(t, TARGET, reg = 'LLY') {
  const fuel = RPM_NODES.map((r) => 20 + 0.03 * r);
  const vane = RPM_NODES.map(() => 0.5);
  const cal = buildCal(t, fuel, vane);
  const pp = new Powerplant({ cal, regulator: reg, air });
  const report = [];
  for (let i = 0; i < RPM_NODES.length; i++) {
    const rpm = RPM_NODES[i];
    // governor taper: at rated nodes beyond govStart the target is reduced by the same factor; fit with taper bypassed
    const saved = [cal.govStart, cal.govEnd]; cal.govStart = 9999; cal.govEnd = 10000;
    const tgt = TARGET[i] * LBFT;
    const boostT = t.boostPsi[i];
    let o;
    pp.omega = 6000; pp.vaneTrim = 0;
    for (let it = 0; it < 28; it++) {
      o = settle(pp, rpm, 1, 6, 0.01);
      const kF = (tgt + o.tFric + o.tPump + P.accessoryNm) / Math.max(o.tInd, 1);
      cal.fuel.y[i] = Math.min(rpm < 1200 ? 95 : 260, cal.fuel.y[i] * (1 + 0.8 * (kF - 1)));
      const eB = Math.max(-3, Math.min(3, boostT - o.boostPsi));
      cal.vane.full[i] = Math.min(0.9, Math.max(0, cal.vane.full[i] + pp.vaneTrim - eB * 0.012));
      pp.vaneTrim = 0;
      cal.vane.light[i] = t.vaneLight;
    }
    pp.vaneTrim = 0;
    o = settle(pp, rpm, 1, 8, 0.01);
    cal.govStart = saved[0]; cal.govEnd = saved[1];
    report.push({ rpm, qty: +cal.fuel.y[i].toFixed(2), vane: +cal.vane.full[i].toFixed(3), tq: +o.torqueLbFt.toFixed(1), tgt: TARGET[i], boost: +o.boostPsi.toFixed(1), egtF: +((o.egtPreK - 273.15) * 1.8 + 32).toFixed(0), lam: +o.lambda.toFixed(2), turboK: +(o.turboRpm / 1000).toFixed(0), trim: +pp.vaneTrim.toFixed(3), pcyl: +o.pCylPsi.toFixed(0) });
  }
  return { fuel: cal.fuel.y.map((v) => +v.toFixed(2)), vaneFull: cal.vane.full.map((v) => +v.toFixed(4)), report };
}

import { Plant } from '../src/sim/plant.js';
import { Dyno } from '../src/sim/dyno.js';
import { GAIN_WHP } from '../src/sim/calTemplates.js';

export function dynoPeak(cal0, regulator = 'LBZ', freeTrans = false) {
  // freeTrans: fit as if the transmission could hold any torque, so the fit isolates the engine's gain from clutch slip
  const cal = freeTrans ? { ...cal0, trans: { ...cal0.trans, lineP: 8 } } : cal0;
  const plant = new Plant({ cal, regulator }); plant.setCalibration(cal);
  plant.startEngine(); plant.warm(198, 188);
  const dyno = new Dyno(plant); dyno.strapAll(true); dyno.setFan(true); dyno.startRun();
  let n = 0; while (!['done', 'refused', 'idle'].includes(dyno.phase) && n++ < 200000) dyno.update(0.005);
  return dyno.last;
}

const SHAPE = [0, 0, 0.3, 0.55, 0.8, 0.95, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // how the torque gain is distributed over rpm (air-limited at the bottom)

function fitTune(id, baseWhp, stockFit) {
  const t = TEMPLATES[id];
  const goal = baseWhp + GAIN_WHP[id];
  const evalG = (g) => {
    const target = STOCK_TORQUE_TARGET.map((v, i) => v * (1 + g * SHAPE[i]));
    const r = fitNodes(t, target, 'LBZ');
    const cal = buildCal(t, r.fuel, r.vaneFull);
    const run = dynoPeak(cal, 'LBZ', true);
    return { g, r, whp: run.peakHp, run };
  };
  let lo = { g: 0, whp: baseWhp }, hi = null;
  let g = (GAIN_WHP[id] / baseWhp) * 1.1;
  let cur = evalG(g);
  // secant / bisection on g
  let a = { g: 0, whp: baseWhp }, b = cur;
  for (let it = 0; it < 14 && Math.abs(b.whp - goal) > 0.6; it++) {
    const slope = (b.whp - a.whp) / (b.g - a.g || 1e-6);
    const gn = Math.max(0, b.g + (goal - b.whp) / Math.max(slope, 50));
    a = b; b = evalG(gn);
    console.log(`  ${id} it${it} g=${b.g.toFixed(4)} whp=${b.whp.toFixed(1)} goal=${goal.toFixed(1)}`);
  }
  return b;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2];
  const outPath = new URL('../src/data/calFit.js', import.meta.url);
  let existing = {};
  try { existing = (await import('../src/data/calFit.js?' + Date.now())).default; } catch {}
  const stock = fitNodes(TEMPLATES.stock, STOCK_TORQUE_TARGET, 'LLY');
  existing.stock = { fuel: stock.fuel, vaneFull: stock.vaneFull };
  const baseRun = dynoPeak(buildCal(TEMPLATES.stock, stock.fuel, stock.vaneFull), 'LBZ');
  console.log('stock peak whp (LBZ reg)', baseRun.peakHp.toFixed(1));
  for (const id of Object.keys(GAIN_WHP)) {
    if (only && only !== id) continue;
    const r = fitTune(id, baseRun.peakHp, stock);
    existing[id] = { fuel: r.r.fuel, vaneFull: r.r.vaneFull, g: +r.g.toFixed(4), fitWhp: +r.whp.toFixed(1), baseWhp: +baseRun.peakHp.toFixed(1) };
    console.log(id, 'whp', r.whp.toFixed(1), 'gain', (r.whp - baseRun.peakHp).toFixed(1));
    if (process.env.TABLE) console.table(r.r.report);
  }
  fs.writeFileSync(outPath, '// GENERATED by scripts/fit.mjs: fitted fuel and vane feed-forward tables. Do not edit by hand.\nexport default ' + JSON.stringify(existing, null, 1) + ';\n');
  console.log('wrote', outPath.pathname);
}
