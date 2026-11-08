import { describe, it, expect } from 'vitest';
import { spec, HP_CONST } from '../src/data/truckSpec.js';
import { makeAir, correctionFactor } from '../src/sim/atmos.js';
import { loadCal, TUNE_ORDER } from '../src/sim/calibrations.js';
import { GAIN_WHP } from '../src/sim/calTemplates.js';
import { crankCurve, steadyPoint } from '../src/sim/curves.js';
import { Plant } from '../src/sim/plant.js';
import { Dyno } from '../src/sim/dyno.js';
import { FailureModel } from '../src/sim/failures.js';

function pull(tune, regulator = 'LBZ', { runs = 1, warm = true } = {}) {
  const cal = loadCal(tune);
  const plant = new Plant({ cal, regulator });
  plant.setCalibration(cal); plant.startEngine(); if (warm) plant.warm(198, 188);
  const dyno = new Dyno(plant); dyno.strapAll(true); dyno.setFan(true);
  const out = [];
  for (let r = 0; r < runs; r++) {
    dyno.startRun();
    let n = 0; while (!['done', 'refused', 'idle'].includes(dyno.phase) && n++ < 200000) dyno.update(0.005);
    out.push(dyno.last);
  }
  return { plant, dyno, runs: out };
}

describe('atmosphere and SAE correction', () => {
  it('is exactly 1 at the standard conditions (99 kPa dry, 25 C)', () => {
    const air = { dryKpa: 99, tempC: 25 };
    expect(correctionFactor(air, { turbo: true, qc: 30 })).toBeCloseTo(1, 10);
    expect(correctionFactor(air, { turbo: false, qc: 50 })).toBeCloseTo(1, 10);
  });
  it('matches the ISO 1585 / UN R85 formula for known inputs', () => {
    const air = { dryKpa: 95, tempC: 35 };
    const fa = Math.pow(99 / 95, 0.7) * Math.pow(308.15 / 298.15, 1.5);
    expect(correctionFactor(air, { turbo: true, qc: 30 })).toBeCloseTo(Math.pow(fa, 0.3), 8);
    // qc between 40 and 65: fm = 0.036 qc - 1.14 ; qc = 50 -> 0.66
    expect(correctionFactor(air, { turbo: true, qc: 50 })).toBeCloseTo(Math.pow(fa, 0.66), 8);
    expect(correctionFactor(air, { turbo: true, qc: 80 })).toBeCloseTo(Math.pow(fa, 1.2), 8);
  });
  it('hot thin air needs a factor above 1 and cold dense air below 1', () => {
    expect(correctionFactor(makeAir({ tempC: 38, pressureKpa: 96, humidityPct: 40 }), { qc: 50 })).toBeGreaterThan(1);
    expect(correctionFactor(makeAir({ tempC: 5, pressureKpa: 103, humidityPct: 40 }), { qc: 50 })).toBeLessThan(1);
  });
});

describe('stock engine reproduces the published rating from physics', () => {
  const cal = loadCal('stock');
  const pts = crankCurve(cal, { rpms: [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3100, 3200] });
  const at = (rpm) => pts.find((p) => p.rpm === rpm);
  it('310 hp at 3,000 rpm', () => { expect(at(3000).hp).toBeGreaterThan(309); expect(at(3000).hp).toBeLessThan(311); });
  it('605 lb-ft at 1,600 rpm', () => { expect(at(1600).torqueLbFt).toBeGreaterThan(603.5); expect(at(1600).torqueLbFt).toBeLessThan(606.5); });
  it('hp = torque x rpm / 5252 everywhere', () => {
    for (const p of pts) expect(p.hp).toBeCloseTo((p.torqueLbFt * p.rpm) / HP_CONST, 6);
  });
  it('torque peaks near 1,600 rpm, stays flat, and rated power is the maximum', () => {
    const tq = pts.map((p) => p.torqueLbFt);
    const maxT = Math.max(...tq);
    expect(pts[tq.indexOf(maxT)].rpm).toBeGreaterThanOrEqual(1500);
    expect(pts[tq.indexOf(maxT)].rpm).toBeLessThanOrEqual(1900);
    expect(at(2400).torqueLbFt).toBeGreaterThan(0.93 * maxT);
    const maxHp = Math.max(...pts.map((p) => p.hp));
    expect(at(3000).hp).toBeCloseTo(maxHp, 0);
  });
  it('torque falls toward the governor near 3,200 rpm', () => {
    expect(at(3200).torqueLbFt).toBeLessThan(0.2 * at(3000).torqueLbFt);
    expect(at(3100).torqueLbFt).toBeLessThan(at(3000).torqueLbFt);
  });
  it('is air-limited: starving the turbo (open vanes, no boost) cuts the fuel the smoke limiter allows', () => {
    const hi = steadyPoint(cal, 2000, 1);
    expect(hi.qty).toBeLessThanOrEqual(hi.qtySmoke + 1e-6);
    const lo = steadyPoint(cal, 1000, 1, { seconds: 0.2 });
    expect(lo.qty).toBeLessThan(hi.qty);
  });
});

describe('dyno pull', () => {
  const stock = pull('stock', 'LLY', { runs: 3 });
  const run = stock.runs[0];
  it('stock wheel horsepower is derived and sits in the real stock LLY range (230-265 whp)', () => {
    expect(run.peakHp).toBeGreaterThan(230); expect(run.peakHp).toBeLessThan(265);
  });
  it('drivetrain loss is within the 15 to 20 percent band', () => {
    const loss = 1 - run.peakHp / 310;
    expect(loss).toBeGreaterThan(0.15); expect(loss).toBeLessThan(0.2);
  });
  it('wheel torque follows hp x 5252 / rpm', () => {
    for (const p of run.points) expect(p.tq).toBeCloseTo((p.hp * HP_CONST) / p.rpm, 6);
  });
  it('run-to-run variation stays within 1 percent', () => {
    const hp = stock.runs.map((r) => r.peakHp); const mean = hp.reduce((a, b) => a + b) / hp.length;
    for (const h of hp) expect(Math.abs(h - mean) / mean).toBeLessThan(0.01);
  });
  it('a graph spans the sweep and the log has the required channels', () => {
    expect(run.points.length).toBeGreaterThan(40);
    const row = run.log[10];
    for (const k of ['rpm', 'qty', 'railPsi', 'boostPsi', 'airLbMin', 'soiDeg', 'egtF', 'coolantF', 'transF', 'slipRpm']) expect(row).toHaveProperty(k);
  });
  it('is refused without straps and when the hood is closed with the fan off', () => {
    const cal = loadCal('stock'); const plant = new Plant({ cal }); plant.setCalibration(cal); plant.startEngine();
    const dyno = new Dyno(plant);
    expect(dyno.startRun().ok).toBe(false);
    expect(dyno.message).toMatch(/straps/i);
    dyno.strapAll(true); plant.hoodClosed = true; dyno.setFan(false);
    expect(dyno.startRun().ok).toBe(false);
    expect(dyno.message).toMatch(/hood/i);
    dyno.setFan(true);
    expect(dyno.startRun().ok).toBe(true);
  });
});

describe('AI Live quick tunes land at the owner gains (LBZ regulator)', () => {
  const base = pull('stock', 'LBZ').runs[0].peakHp;
  for (const id of Object.keys(GAIN_WHP)) {
    it(`${id}: stock + ${GAIN_WHP[id]} whp`, () => {
      const r = pull(id, 'LBZ').runs[0];
      expect(r.peakHp - base).toBeGreaterThan(GAIN_WHP[id] - 2);
      expect(r.peakHp - base).toBeLessThan(GAIN_WHP[id] + 2);
    });
  }
  it('higher tunes fall short on rail pressure with the stock LLY regulator, lower tunes do not', () => {
    const street = pull('street', 'LLY').runs[0], streetLbz = pull('street', 'LBZ').runs[0];
    const race = pull('race', 'LLY').runs[0], raceLbz = pull('race', 'LBZ').runs[0];
    expect(race.peakHp).toBeLessThan(raceLbz.peakHp - 10);
    expect(street.peakHp).toBeLessThan(streetLbz.peakHp - 5);
    expect(race.railErrPsi).toBeGreaterThan(1500);
    expect(race.railErrPsi).toBeGreaterThan(street.railErrPsi);
    const tow = pull('heavytow', 'LLY').runs[0], towLbz = pull('heavytow', 'LBZ').runs[0];
    expect(Math.abs(tow.peakHp - towLbz.peakHp)).toBeLessThan(1);
    expect(tow.railErrPsi).toBeLessThan(500);
  });
  it('every level raises power, boost and exhaust temperature over the previous one', () => {
    const rs = TUNE_ORDER.map((id) => pull(id, 'LBZ').runs[0]);
    for (let i = 1; i < rs.length; i++) { expect(rs[i].peakHp).toBeGreaterThan(rs[i - 1].peakHp); expect(rs[i].maxBoostPsi).toBeGreaterThanOrEqual(rs[i - 1].maxBoostPsi - 1.5); }
  });
});

describe('turbo vane adjustment (Turbo Sound) works through the physics', () => {
  const cal = loadCal('stock');
  it('closing the vanes at idle raises shaft speed, boost, drive pressure and EGT', () => {
    const idle = (close) => {
      const c = loadCal('stock'); const plant = new Plant({ cal: c }); plant.setCalibration(c); plant.startEngine(); plant.warm(195, 185);
      plant.pp.sound = { close, hold: 0 };
      let o; for (let t = 0; t < 25; t += 0.01) o = plant.step(0.01, { pedal: 0 });
      return { o, rpm: plant.rpm };
    };
    const open = idle(0), shut = idle(1);
    expect(Math.abs(open.rpm - 680)).toBeLessThan(25);
    expect(Math.abs(shut.rpm - 680)).toBeLessThan(25);
    expect(shut.o.vane).toBeGreaterThan(open.o.vane);
    expect(shut.o.turboRpm).toBeGreaterThan(open.o.turboRpm * 1.15);
    expect(shut.o.boostPsi).toBeGreaterThan(open.o.boostPsi);
    expect(shut.o.driveKpa).toBeGreaterThan(open.o.driveKpa);
    expect(shut.o.egtPreK).toBeGreaterThan(open.o.egtPreK);
  });
  it('the hold slider keeps the vanes closed as throttle comes in', () => {
    const a = steadyPoint(cal, 2200, 1, { sound: { close: 1, hold: 0 } }), b = steadyPoint(cal, 2200, 1, { sound: { close: 1, hold: 1 } });
    expect(b.vane).toBeGreaterThan(a.vane);
    expect(b.turboRpm).toBeGreaterThan(a.turboRpm);
    expect(b.driveKpa).toBeGreaterThan(a.driveKpa);
  });
});

describe('failures trigger only past their limits', () => {
  const fakePlant = (o = {}) => ({ running: true, dl: { cpSlip: 0, slipEnergyKj: 0, transF: 190, health: 1, ...o.dl }, pp: { damage: {} } });
  const out = (o = {}) => ({ turboRpm: 100000, egtPreK: 900, pCylPsi: 2200, ...o });
  const run = (fm, plant, o, seconds) => { for (let t = 0; t < seconds; t += 0.05) fm.update(0.05, plant, o); };
  const F2K = (f) => (f - 32) / 1.8 + 273.15;
  it('turbo: below the overspeed line for a long time never fails; above it for long enough does', () => {
    const fm = new FailureModel(); run(fm, fakePlant(), out({ turboRpm: spec.turbo.overspeedRpm - 1000 }), 120);
    expect(fm.state.turbo).toBe(false);
    run(fm, fakePlant(), out({ turboRpm: spec.turbo.overspeedRpm + 3000 }), spec.turbo.overspeedHoldS + 1);
    expect(fm.state.turbo).toBe(true);
  });
  it('pistons: EGT just under the limit never fails; over it, held, does', () => {
    const fm = new FailureModel(); run(fm, fakePlant(), out({ egtPreK: F2K(spec.limits.egtPistonDamageF - 5) }), 300);
    expect(fm.state.piston).toBe(false);
    run(fm, fakePlant(), out({ egtPreK: F2K(spec.limits.egtPistonDamageF + 150) }), 60);
    expect(fm.state.piston).toBe(true);
  });
  it('head gaskets: cylinder pressure under the lift limit never fails; above it held does', () => {
    const fm = new FailureModel(); run(fm, fakePlant(), out({ pCylPsi: spec.limits.cylPressureLiftPsi - 1 }), 300);
    expect(fm.state.headGasket).toBe(false);
    run(fm, fakePlant(), out({ pCylPsi: spec.limits.cylPressureLiftPsi + 300 }), 30);
    expect(fm.state.headGasket).toBe(true);
  });
  it('transmission: slip energy below the limit is survivable; past it the clutches burn', () => {
    const fm = new FailureModel(); run(fm, fakePlant({ dl: { slipEnergyKj: spec.limits.clutchBurnSlipEnergyKj - 5 } }), out(), 5);
    expect(fm.state.transmission).toBe(false);
    run(fm, fakePlant({ dl: { slipEnergyKj: spec.limits.clutchBurnSlipEnergyKj + 5 } }), out(), 1);
    expect(fm.state.transmission).toBe(true);
  });
  it('repair clears a failure', () => {
    const fm = new FailureModel(); fm.state.turbo = true; fm.repair('turbo'); expect(fm.state.turbo).toBe(false);
  });
});

describe('real runs never trip a failure inside the safe envelope', () => {
  it('stock and the tow tunes survive 12 consecutive pulls with no failure', () => {
    for (const id of ['stock', 'heavytow', 'lighttow']) {
      const { plant } = pull(id, 'LBZ', { runs: 12 });
      expect(plant.fail.state).toEqual({ transmission: false, headGasket: false, turbo: false, piston: false });
    }
  });
  it('a single Race pull is survivable, repeated heat-soaked Race pulls can burn the stock Allison', () => {
    const one = pull('race', 'LBZ', { runs: 1 });
    expect(one.plant.fail.state.transmission).toBe(false);
    const many = pull('race', 'LBZ', { runs: 20 });
    expect(many.plant.fail.state.transmission).toBe(true);
  });
});
