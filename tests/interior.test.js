import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spec } from '../src/data/truckSpec.js';
import { KEY } from '../src/sim/startSequence.js';
import { Ignition } from '../src/sim/startSequence.js';
import {
  GAUGES, needleAngle, valueAtAngle, makeNeedle, stepNeedle, sweepFraction, SWEEP_SECONDS, nextKeyPosition, keyTwist, cycleGear, nextGear,
  odometerText, dicLine, defaultClusterState, effectiveLights, REST, DIC_MESSAGES, KEY_NAMES,
} from '../src/truck/interior/logic.js';
import { INTERIOR_LABELS } from '../src/truck/interior/labels.js';

describe('cluster gauge scales match spec.cluster', () => {
  const C = spec.cluster;
  it('physical ranges', () => {
    expect([GAUGES.speed.v0, GAUGES.speed.v1]).toEqual([0, C.speedoMaxMph]);
    expect([GAUGES.tach.v0, GAUGES.tach.v1]).toEqual([0, C.tachMaxRpm]);
    expect([GAUGES.coolant.v0, GAUGES.coolant.v1]).toEqual(C.coolantRangeF);
    expect([GAUGES.trans.v0, GAUGES.trans.v1]).toEqual(C.transTempRangeF);
    expect([GAUGES.oil.v0, GAUGES.oil.v1]).toEqual(C.oilPressureRangePsi);
    expect([GAUGES.volts.v0, GAUGES.volts.v1]).toEqual(C.voltRange);
    expect([GAUGES.fuel.v0, GAUGES.fuel.v1]).toEqual([0, 1]);
  });
  it('red zone of the tach is inside the scale and ordered', () => {
    expect(C.tachDashedRedStartRpm).toBeLessThan(C.tachSolidRedStartRpm);
    expect(C.tachSolidRedStartRpm).toBeLessThan(C.tachMaxRpm);
  });
});

describe('needle angle mapping', () => {
  it('maps the scale ends and the middle for every gauge', () => {
    for (const [k, g] of Object.entries(GAUGES)) {
      expect(needleAngle(k, g.v0)).toBeCloseTo(g.a0, 6);
      expect(needleAngle(k, g.v1)).toBeCloseTo(g.a1, 6);
      expect(needleAngle(k, (g.v0 + g.v1) / 2)).toBeCloseTo((g.a0 + g.a1) / 2, 6);
    }
  });
  it('clamps outside the scale', () => {
    expect(needleAngle('speed', -50)).toBe(GAUGES.speed.a0);
    expect(needleAngle('speed', 400)).toBe(GAUGES.speed.a1);
    expect(needleAngle('tach', 9000)).toBe(GAUGES.tach.a1);
    expect(needleAngle('volts', 3)).toBe(GAUGES.volts.a0);
    expect(needleAngle('fuel', 2)).toBe(GAUGES.fuel.a1);
  });
  it('is monotonic and invertible', () => {
    for (const [k, g] of Object.entries(GAUGES)) {
      let prev = -1e9;
      for (let i = 0; i <= 20; i++) { const v = g.v0 + ((g.v1 - g.v0) * i) / 20; const a = needleAngle(k, v); expect(a).toBeGreaterThan(prev); prev = a; expect(valueAtAngle(k, a)).toBeCloseTo(v, 6); }
    }
  });
  it('known photo readings: speedometer 60 mph is straight up, coolant 210 F and 14 V near vertical, fuel half is vertical', () => {
    expect(needleAngle('speed', 60)).toBeCloseTo(0, 6);
    expect(needleAngle('volts', 14)).toBeCloseTo(0, 6);
    expect(needleAngle('coolant', 210)).toBeCloseTo(0, 6);
    expect(needleAngle('oil', 60)).toBeCloseTo(0, 6);
    expect(needleAngle('fuel', 0.5)).toBeCloseTo(0, 6);
  });
  it('tach 0 is at the lower left and 5 at upper right of the pivot (01-dash-cluster-lit)', () => {
    expect(needleAngle('tach', 0)).toBeLessThan(-100);
    expect(needleAngle('tach', 5000)).toBeGreaterThan(0);
    expect(needleAngle('tach', 5000)).toBeLessThan(40);
    expect(needleAngle('tach', 1000)).toBeCloseTo(-86, 0); // the "1" numeral sits at 9 o'clock
  });
});

describe('needle dynamics', () => {
  it('settles on the target without exploding and lags the target', () => {
    const n = makeNeedle('speed');
    stepNeedle(n, 100, 0.05); expect(n.pos).toBeGreaterThan(0); expect(n.pos).toBeLessThan(100);
    for (let i = 0; i < 100; i++) stepNeedle(n, 100, 0.05); expect(n.pos).toBeCloseTo(100, 0);
  });
  it('slow gauges (temperature, fuel) lag more than fast ones (tach)', () => {
    const a = makeNeedle('tach'), b = makeNeedle('coolant'); a.pos = 0; b.pos = GAUGES.coolant.v0;
    stepNeedle(a, 2500, 0.3); stepNeedle(b, GAUGES.coolant.v0 + 50, 0.3);
    expect(a.pos / 2500).toBeGreaterThan((b.pos - GAUGES.coolant.v0) / 50);
  });
  it('never leaves the scale by more than 2 percent (the needle stops against the pin)', () => {
    const n = makeNeedle('oil'); for (let i = 0; i < 400; i++) stepNeedle(n, 1000, 0.02);
    expect(n.pos).toBeLessThanOrEqual(GAUGES.oil.v1 * 1.021);
  });
  it('is stable for large time steps', () => {
    const n = makeNeedle('tach'); stepNeedle(n, 3000, 1.0); expect(Number.isFinite(n.pos)).toBe(true); expect(Math.abs(n.pos)).toBeLessThan(5500);
  });
  it('start-up sweep goes to full scale and back inside its time window', () => {
    expect(sweepFraction(-0.1)).toBeNull(); expect(sweepFraction(SWEEP_SECONDS + 0.01)).toBeNull();
    let peak = 0; for (let t = 0; t < SWEEP_SECONDS; t += 0.02) peak = Math.max(peak, sweepFraction(t));
    expect(peak).toBeGreaterThan(0.97); expect(sweepFraction(0)).toBe(0); expect(sweepFraction(SWEEP_SECONDS - 0.001)).toBeLessThan(0.05);
  });
  it('rest positions are at the low end of each scale', () => {
    for (const k of Object.keys(GAUGES)) expect(REST[k]).toBe(GAUGES[k].v0);
  });
});

describe('ignition key stepping', () => {
  it('LOCK -> ACC -> RUN -> START, and START returns to RUN', () => {
    expect(nextKeyPosition(KEY.LOCK)).toBe(KEY.ACC);
    expect(nextKeyPosition(KEY.ACC)).toBe(KEY.RUN);
    expect(nextKeyPosition(KEY.RUN, false)).toBe(KEY.START);
    expect(nextKeyPosition(KEY.START)).toBe(KEY.RUN);
  });
  it('with the engine running the next step from RUN is LOCK (never START)', () => {
    expect(nextKeyPosition(KEY.RUN, true)).toBe(KEY.LOCK);
  });
  it('key twist angle increases with position', () => {
    for (let i = 1; i < 4; i++) expect(keyTwist(i)).toBeGreaterThan(keyTwist(i - 1));
    expect(KEY_NAMES).toEqual(['LOCK', 'ACCESSORY', 'RUN', 'START']);
  });
  it('driving the real Ignition with the stepping helper reaches RUN then cranks the engine to start', () => {
    const ig = new Ignition(); const arg = { coolantF: 60, range: 'P' };
    ig.setKey(nextKeyPosition(ig.key), arg); ig.setKey(nextKeyPosition(ig.key), arg);
    expect(ig.key).toBe(KEY.RUN);
    for (let t = 0; t < 3; t += 0.05) ig.update(0.05, { coolantF: 60, airF: 70, range: 'P', brake: 0, pedal: 0 });
    ig.setKey(nextKeyPosition(ig.key, ig.engineRunning), arg); expect(ig.key).toBe(KEY.START); expect(ig.cranking).toBe(true);
    for (let t = 0; t < 4 && !ig.engineRunning; t += 0.05) ig.update(0.05, { coolantF: 60, airF: 70, range: 'P', brake: 0, pedal: 0 });
    ig.releaseStart(); expect(ig.key).toBe(KEY.RUN); expect(ig.engineRunning).toBe(true);
    ig.setKey(nextKeyPosition(ig.key, ig.engineRunning), arg); expect(ig.key).toBe(KEY.LOCK); expect(ig.engineRunning).toBe(false);
  });
});

describe('gear selector and DIC', () => {
  it('E-press cycle is P R N D P', () => {
    let g = 'P'; const seq = []; for (let i = 0; i < 5; i++) { g = cycleGear(g); seq.push(g); }
    expect(seq).toEqual(['R', 'N', 'D', 'P', 'R']);
  });
  it('manual ranges 3 2 1 are reachable from D and clamp at the ends', () => {
    expect(nextGear('D', 1)).toBe('3'); expect(nextGear('1', 1)).toBe('1'); expect(nextGear('P', -1)).toBe('P');
  });
  it('DIC odometer and message priority', () => {
    expect(odometerText(193469)).toBe('ODOMETER: 193469 MI');
    expect(odometerText(0)).toBe('ODOMETER: 0 MI');
    const s = defaultClusterState();
    expect(dicLine(s, 0)).toBe('ODOMETER: 193469 MI');
    s.dicMessage = 'TRANSMISSION HOT'; expect(dicLine(s)).toBe('TRANSMISSION HOT');
    for (const m of ['TRANSMISSION HOT', 'REDUCED ENGINE POWER', 'ELEVATED IDLE ENABLED', 'ELEVATED IDLE DISABLED', 'WATER IN FUEL']) expect(DIC_MESSAGES).toContain(m);
  });
  it('engine hours and trip pages exist', () => {
    const s = defaultClusterState(); s.engineHours = 12.34; s.tripMi = 4.2;
    expect(dicLine(s, 1)).toMatch(/TRIP/); expect(dicLine(s, 2)).toMatch(/ENGINE HOURS: 12.3/);
  });
});

describe('warning lamps', () => {
  it('everything is dark with the key off', () => {
    const s = defaultClusterState(); s.keyPos = 0; s.lights.checkEngine = true; s.lights.tow = true;
    expect(Object.values(effectiveLights(s, 1)).some(Boolean)).toBe(false);
  });
  it('Wait to Start, Tow/Haul, O/D off and 4WD follow the flags in RUN', () => {
    const s = defaultClusterState(); s.keyPos = KEY.RUN; s.lights = { ...s.lights, waitToStart: true, tow: true, odOff: true, fourWd: true };
    const L = effectiveLights(s, 10); expect(L.waitToStart && L.tow && L.odOff && L.fourWd).toBe(true);
  });
  it('bulb check: check engine and brake lamps are on briefly before the engine runs, then off once running', () => {
    const s = defaultClusterState(); s.keyPos = KEY.RUN; const early = effectiveLights(s, 0.5); expect(early.checkEngine && early.brake).toBe(true);
    s.rpm = 700; const run = effectiveLights(s, 20); expect(run.checkEngine).toBe(false); expect(run.oil).toBe(false);
  });
  it('TRANSMISSION HOT lamp at 265 F', () => {
    const s = defaultClusterState(); s.keyPos = KEY.RUN; s.rpm = 700; s.transF = spec.drivetrain.trans.hotWarningF; expect(effectiveLights(s, 10).transHot).toBe(true);
    s.transF = 200; expect(effectiveLights(s, 10).transHot).toBe(false);
  });
});

describe('interior labels', () => {
  const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/truck/interior');
  const used = new Set();
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.js') && f !== 'labels.js') for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/'(interior\.[A-Za-z0-9]+)'/g)) used.add(m[1]);
  it('every labelId used in the interior code has a label', () => {
    expect(used.size).toBeGreaterThan(20);
    for (const id of used) expect(INTERIOR_LABELS[id], id).toBeTruthy();
  });
  it('every label has a name and a description and the interior prefix', () => {
    for (const [id, v] of Object.entries(INTERIOR_LABELS)) { expect(id.startsWith('interior.')).toBe(true); expect(v.name.length).toBeGreaterThan(2); expect(v.desc.length).toBeGreaterThan(10); }
  });
  it('the key controls are all labelled', () => {
    for (const id of ['interior.cluster', 'interior.steeringWheel', 'interior.shifter', 'interior.ignition', 'interior.hoodRelease', 'interior.obdPort', 'interior.transferCase', 'interior.parkBrake', 'interior.radio', 'interior.climate', 'interior.glovebox', 'interior.seatFrontL', 'interior.seatRear', 'interior.placard', 'interior.overhead']) expect(INTERIOR_LABELS[id], id).toBeTruthy();
  });
});
