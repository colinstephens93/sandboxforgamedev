import { describe, it, expect } from 'vitest';
import {
  firingHz, coldFactor, thinFactor, combustionGain, turboWhistleHz, turboWhistleGain, intakeHissGain, intakeHissHz,
  exhaustHissGain, sirenAmount, sirenQ, distanceGain, spatialMix, computeMix, normalizeState, normalizeListener,
  FIRING_ORDER, turboBladePassHz, TURBO_BLADES,
} from '../src/audio/mapping.js';
import { FiringScheduler, PulseScheduler, NodeBudget, MAX_GRAIN_HZ, NODE_BUDGET_PER_SEC } from '../src/audio/scheduler.js';
import * as D from '../src/audio/dsp.js';

const range = (a, b, step) => { const o = []; for (let x = a; x <= b + 1e-9; x += step) o.push(x); return o; };
const increasing = (arr) => arr.every((v, i) => i === 0 || v > arr[i - 1]);
const nondecreasing = (arr) => arr.every((v, i) => i === 0 || v >= arr[i - 1] - 1e-12);

describe('engine firing', () => {
  it('firing frequency of the V8 four-stroke is rpm / 60 * 4, exactly', () => {
    expect(firingHz(680)).toBe((680 / 60) * 4);
    expect(firingHz(680)).toBeCloseTo(45.3333, 4);
    expect(firingHz(3200)).toBeCloseTo(213.333, 3);
    expect(firingHz(0)).toBe(0);
  });
  it('firing order is the LLY order 1-2-7-8-4-5-6-3 and uses every cylinder once', () => {
    expect(FIRING_ORDER).toEqual([1, 2, 7, 8, 4, 5, 6, 3]);
    expect([...FIRING_ORDER].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('cold factor is higher when the coolant is cold, 0 at operating temperature, 1 in the cold', () => {
    expect(coldFactor(20)).toBe(1);
    expect(coldFactor(190)).toBe(0);
    expect(coldFactor(40)).toBeGreaterThan(coldFactor(100));
    expect(coldFactor(100)).toBeGreaterThan(coldFactor(160));
    expect(coldFactor(160)).toBeGreaterThan(coldFactor(190));
    const f = range(0, 220, 5).map(coldFactor);
    expect(f.every((v, i) => i === 0 || v <= f[i - 1] + 1e-12)).toBe(true);
  });
  it('combustion level is louder cold than warm, and rises with rpm and load', () => {
    const base = { rpm: 680, load: 0.16, qty: 8 };
    expect(combustionGain({ ...base, cold: 1 })).toBeGreaterThan(combustionGain({ ...base, cold: 0 }) * 1.2);
    expect(combustionGain({ rpm: 2500, load: 1, qty: 70, cold: 0 })).toBeGreaterThan(combustionGain({ ...base, cold: 0 }));
    expect(combustionGain({ ...base, cold: 0, catchEnv: 1 })).toBeGreaterThan(combustionGain({ ...base, cold: 0 }) * 2);
  });
});

describe('turbo whistle comes from the modeled shaft speed', () => {
  const rpms = range(20000, 135000, 1000);
  it('blade pass is turboRpm / 60 * 11', () => {
    expect(TURBO_BLADES).toBe(11);
    expect(turboBladePassHz(60000)).toBeCloseTo(11000, 6);
  });
  it('whistle frequency is strictly monotonic in turbo rpm and stays within 300-2,500 Hz over 20k-135k rpm', () => {
    const f = rpms.map(turboWhistleHz);
    expect(increasing(f)).toBe(true);
    expect(Math.min(...f)).toBeGreaterThanOrEqual(300);
    expect(Math.max(...f)).toBeLessThanOrEqual(2500);
  });
  it('whistle sits near 400 Hz at 36k rpm and 1.5 kHz at 130k rpm and tracks the shaft speed proportionally', () => {
    expect(turboWhistleHz(36000)).toBeGreaterThan(380); expect(turboWhistleHz(36000)).toBeLessThan(450);
    expect(turboWhistleHz(130000)).toBeGreaterThan(1400); expect(turboWhistleHz(130000)).toBeLessThan(1600);
    expect(turboWhistleHz(120000) / turboWhistleHz(60000)).toBeCloseTo(2, 1);
  });
  it('whistle gain rises with vane closure at the same flow, shaft speed and boost', () => {
    const g = range(0, 1, 0.05).map((vane) => turboWhistleGain({ turboRpm: 80000, mAir: 0.2, vane, boostPsi: 15, driveKpa: 250 }));
    expect(increasing(g)).toBe(true);
    expect(g[g.length - 1] / g[0]).toBeGreaterThan(2);
  });
  it('whistle gain rises with shaft speed, airflow, boost and drive pressure, and is near zero when the turbo is stopped', () => {
    const base = { turboRpm: 60000, mAir: 0.15, vane: 0.5, boostPsi: 10, driveKpa: 200 };
    expect(increasing(range(10000, 135000, 5000).map((turboRpm) => turboWhistleGain({ ...base, turboRpm })))).toBe(true);
    expect(increasing(range(0, 0.28, 0.02).map((mAir) => turboWhistleGain({ ...base, mAir })))).toBe(true);
    expect(nondecreasing(range(0, 0.5, 0.02).map((mAir) => turboWhistleGain({ ...base, mAir })))).toBe(true);
    expect(increasing(range(0, 28, 2).map((boostPsi) => turboWhistleGain({ ...base, boostPsi })))).toBe(true);
    expect(increasing(range(100, 350, 10).map((driveKpa) => turboWhistleGain({ ...base, driveKpa })))).toBe(true);
    expect(turboWhistleGain({ ...base, turboRpm: 0 })).toBeLessThan(1e-9);
    expect(turboWhistleGain({ ...base, turboRpm: 120000, mAir: 0.3, vane: 0.8, boostPsi: 28, driveKpa: 350 })).toBeLessThan(1); // sane scale
  });
  it('siren component is stronger and narrower with closed vanes and high drive pressure', () => {
    expect(sirenAmount(0.9, 300)).toBeGreaterThan(sirenAmount(0.2, 300));
    expect(sirenAmount(0.9, 300)).toBeGreaterThan(sirenAmount(0.9, 110));
    expect(sirenQ(0.9)).toBeGreaterThan(sirenQ(0.2));
    expect(increasing(range(0, 1, 0.1).map(sirenQ))).toBe(true);
  });
  it('intake hiss is monotonic in airflow, silent without flow, and brighter with more flow', () => {
    const g = range(0, 0.5, 0.01).map(intakeHissGain);
    expect(g[0]).toBe(0);
    expect(increasing(g)).toBe(true);
    expect(intakeHissHz(0.3)).toBeGreaterThan(intakeHissHz(0.05));
    expect(intakeHissHz(0.3)).toBeLessThanOrEqual(8000);
    expect(intakeHissHz(0)).toBeGreaterThanOrEqual(3000);
  });
  it('exhaust / drive-pressure hiss is monotonic in drive pressure and in airflow', () => {
    expect(exhaustHissGain(101.3, 0.3)).toBe(0);
    expect(increasing(range(105, 400, 15).map((p) => exhaustHissGain(p, 0.2)))).toBe(true);
    expect(increasing(range(0.01, 0.4, 0.02).map((m) => exhaustHissGain(250, m)))).toBe(true);
  });
  it('a damaged turbo whistles rough and low with less gain (flutter, lower pitch)', () => {
    const st = { running: true, rpm: 2500, load: 1, turboRpm: 100000, mAir: 0.3, vane: 0.6, boostPsi: 20, driveKpa: 300 };
    const ok = computeMix(st).turbo, bad = computeMix({ ...st, fail: { turbo: true } }).turbo;
    expect(bad.whistleHz).toBeLessThan(ok.whistleHz * 0.9);
    expect(bad.whistleGain).toBeLessThan(ok.whistleGain * 0.6);
    expect(bad.flutterCents).toBeGreaterThan(30); expect(ok.flutterCents).toBe(0);
    expect(bad.sirenQ).toBeLessThan(ok.sirenQ);
  });
  it('the Turbo Sound page works through the physics: more closed vanes at idle -> faster shaft -> higher, louder whistle', () => {
    const idle = computeMix({ running: true, rpm: 680, load: 0.16, turboRpm: 17700, vane: 0.4, mAir: 0.04, driveKpa: 106 }).turbo;
    const closed = computeMix({ running: true, rpm: 680, load: 0.16, turboRpm: 52000, vane: 0.85, mAir: 0.05, driveKpa: 190, boostPsi: 2 }).turbo;
    expect(closed.whistleHz).toBeGreaterThan(idle.whistleHz * 1.5);
    expect(closed.whistleGain).toBeGreaterThan(idle.whistleGain * 5);
  });
});

describe('mix mapping', () => {
  it('engine layers are silent when the engine is off; the starter works only while cranking', () => {
    const off = computeMix({ running: false, rpm: 0 });
    expect(off.engine.combGain).toBe(0); expect(off.engine.exhGain).toBe(0); expect(off.turbo.whistleGain).toBe(0); expect(off.starter.gain).toBe(0);
    const crank = computeMix({ cranking: true, running: false, rpm: 190 });
    expect(crank.starter.gain).toBeGreaterThan(0.05);
    expect(crank.starter.meshHz).toBeCloseTo((130 * 190) / 60, 3);
    expect(crank.starter.lugHz).toBeCloseTo(firingHz(190), 6); // compression strokes at the firing rate
    expect(crank.starter.thumpGain).toBeGreaterThan(0);
  });
  it('cold coolant raises the combustion gain in the mix', () => {
    const st = { running: true, rpm: 680, load: 0.16, qty: 8 };
    expect(computeMix({ ...st, coolantF: 30 }).engine.combGain).toBeGreaterThan(computeMix({ ...st, coolantF: 195 }).engine.combGain * 1.2);
  });
  it('fan clutch roar scales with duty and rpm; the shop fan is a constant loud source', () => {
    const f = (fanDuty, rpm) => computeMix({ running: true, rpm, fanDuty }).fan.noiseGain;
    expect(f(1, 2000)).toBeGreaterThan(f(0.3, 2000)); expect(f(1, 3000)).toBeGreaterThan(f(1, 800)); expect(f(0, 3000)).toBe(0);
    expect(computeMix({ shopFan: true }).shopFan.gain).toBeGreaterThan(0.1);
    expect(computeMix({ shopFan: false }).shopFan.gain).toBe(0);
  });
  it('roller whine follows roller speed: rpm = rad/s * 60 / 2pi, louder and higher with speed', () => {
    const r = (w) => computeMix({ rollerRad: w }).roller;
    expect(r(100).rpm).toBeCloseTo((100 * 60) / (2 * Math.PI), 6);
    expect(r(120).bearingHz).toBeGreaterThan(r(60).bearingHz); expect(r(120).tireHz).toBeGreaterThan(r(60).tireHz);
    expect(r(120).tireNoiseGain).toBeGreaterThan(r(60).tireNoiseGain); expect(r(0).tireNoiseGain).toBe(0);
  });
  it('exhaust hose muffles the exhaust note', () => {
    const st = { running: true, rpm: 2500, load: 1 };
    expect(computeMix({ ...st, exhaustHose: true }).engine.exhLpHz).toBeLessThan(computeMix(st).engine.exhLpHz);
  });
  it('failures add their own sounds: transmission whine, head gasket bubbling, piston slap', () => {
    const st = { running: true, rpm: 1800, load: 0.8 };
    expect(computeMix({ ...st, fail: { transmission: true } }).trans.whineGain).toBeGreaterThan(computeMix(st).trans.whineGain);
    expect(computeMix({ ...st, fail: { headGasket: true } }).gasket.bubbleGain).toBeGreaterThan(0); expect(computeMix(st).gasket.bubbleGain).toBe(0);
    expect(computeMix({ ...st, fail: { piston: true } }).piston.slap).toBe(true); expect(computeMix(st).piston.slap).toBe(false);
  });
  it('every output is finite and non-negative for random states (fuzz, including missing and garbage fields)', () => {
    let seed = 12345; const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const walk = (o, path = '') => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'number') { expect(Number.isFinite(v), path + k).toBe(true); } else if (Array.isArray(v)) v.forEach((x) => expect(Number.isFinite(x), path + k).toBe(true)); else if (v && typeof v === 'object' && k !== 'st' && k !== 'L') walk(v, path + k + '.'); } };
    for (let i = 0; i < 400; i++) {
      const st = { running: r() < 0.7, cranking: r() < 0.2, rpm: r() * 3400, load: r() * 1.2 - 0.1, qty: r() * 100, turboRpm: r() < 0.2 ? undefined : r() * 150000, vane: r() * 1.2 - 0.1, boostPsi: r() * 40 - 5, mAir: r() < 0.2 ? undefined : r() * 0.5, driveKpa: 90 + r() * 400, smoke: r(), coolantF: -10 + r() * 280, fanDuty: r(), rollerRad: r() * 200, cpSlipRpm: r() * 600, fail: { turbo: r() < 0.3, headGasket: r() < 0.3, piston: r() < 0.3, transmission: r() < 0.3 }, doorsOpenCount: Math.floor(r() * 5) };
      if (i % 50 === 0) { st.rpm = NaN; st.coolantF = 'x'; st.load = undefined; }
      const m = computeMix(st, { inCab: r() < 0.5, doorOpen: r() < 0.5, distanceToTruck: r() * 30, distanceToDyno: r() * 30, pan: r() * 2 - 1 }, { catchEnv: r() });
      walk(m);
      for (const g of [m.engine.combGain, m.engine.exhGain, m.turbo.whistleGain, m.turbo.sirenGain, m.starter.gain, m.fan.noiseGain, m.shopFan.gain, m.roller.tireNoiseGain]) expect(g).toBeGreaterThanOrEqual(0);
    }
  });
  it('state and listener defaults are sane', () => {
    const s = normalizeState({}); expect(s.running).toBe(false); expect(s.coolantF).toBeGreaterThan(150); expect(s.fail.turbo).toBe(false);
    const l = normalizeListener({ pan: 5 }); expect(l.pan).toBe(1); expect(l.inCab).toBe(false);
    // missing air path while running falls back to something audible instead of silence
    expect(normalizeState({ running: true, rpm: 2000, load: 1 }).turboRpm).toBeGreaterThan(30000);
  });
});

describe('space: distance, cab, doors, pan', () => {
  const st = normalizeState({});
  it('distance attenuation is monotonic and clamps near the source', () => {
    expect(distanceGain(0)).toBe(1); expect(distanceGain(1)).toBe(1);
    const g = range(1.5, 40, 0.5).map(distanceGain);
    expect(g.every((v, i) => i === 0 || v < g[i - 1])).toBe(true);
    expect(distanceGain(20)).toBeLessThan(0.15);
  });
  it('the cab low-passes around 1.2 kHz, opens up with a door open, and has less reverb and more bass', () => {
    const out = spatialMix(normalizeListener({ distanceToTruck: 6 }), st);
    const cab = spatialMix(normalizeListener({ inCab: true, distanceToTruck: 2 }), st);
    const cabOpen = spatialMix(normalizeListener({ inCab: true, doorOpen: true, distanceToTruck: 2 }), st);
    expect(cab.truck.lp).toBeGreaterThan(1000); expect(cab.truck.lp).toBeLessThan(1500);
    expect(cabOpen.truck.lp).toBeGreaterThan(cab.truck.lp * 1.5);
    expect(out.truck.lp).toBeGreaterThan(8000);
    expect(cab.send).toBeLessThan(out.send * 0.4);
    expect(cab.bassDb).toBeGreaterThan(out.bassDb);
    expect(cab.turboCab).toBeLessThan(0.7); expect(out.turboCab).toBe(1);
    expect(cab.pan).toBe(0);
  });
  it('engine level falls with distance to the truck and the pan follows the listener pan gently', () => {
    const near = computeMix({ running: true, rpm: 700 }, { distanceToTruck: 2, pan: 0.5 }).space, far = computeMix({ running: true, rpm: 700 }, { distanceToTruck: 20, pan: 0.5 }).space;
    expect(near.truck.gain).toBeGreaterThan(far.truck.gain * 3); expect(near.truck.lp).toBeGreaterThan(far.truck.lp);
    expect(near.pan).toBeGreaterThan(0); expect(Math.abs(near.pan)).toBeLessThanOrEqual(0.6);
    expect(far.send).toBeGreaterThan(near.send); // farther: wetter
  });
  it('an open hood makes the engine louder from outside', () => {
    const a = spatialMix(normalizeListener({}), normalizeState({ hoodOpen: true })), b = spatialMix(normalizeListener({}), normalizeState({}));
    expect(a.truck.gain).toBeGreaterThan(b.truck.gain);
  });
});

describe('firing scheduler', () => {
  // emulate the engine: planning every frame with a 100 ms look-ahead
  function run(rpm, secs, fps = 60, opts = {}) {
    const s = new FiringScheduler(opts), ev = []; const dt = 1 / fps;
    for (let t = 0; t < secs; t += dt) ev.push(...s.plan(t, t + 0.1, typeof rpm === 'function' ? rpm(t) : rpm));
    return ev;
  }
  it('produces one grain per firing at the right interval at idle (680 rpm -> 45.33 Hz)', () => {
    const ev = run(680, 4);
    const inWindow = ev.filter((e) => e.t >= 0.5 && e.t < 3.5);
    expect(inWindow.length / 3).toBeGreaterThan(44); expect(inWindow.length / 3).toBeLessThan(46.7);
    const gaps = inWindow.slice(1).map((e, i) => e.t - inWindow[i].t), mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeCloseTo(1 / firingHz(680), 3);
    expect(Math.min(...gaps)).toBeGreaterThan(0.004); // never stacked
    expect(ev.every((e) => e.thin === 1)).toBe(true);
  });
  it('is irregular: gap spread and per-cylinder amplitude variance are non-zero but small', () => {
    const ev = run(680, 4), gaps = ev.slice(1).map((e, i) => e.t - ev[i].t), mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
    expect(sd / mean).toBeGreaterThan(0.01); expect(sd / mean).toBeLessThan(0.15);
    const amps = ev.map((e) => e.amp), am = amps.reduce((a, b) => a + b, 0) / amps.length, asd = Math.sqrt(amps.reduce((a, v) => a + (v - am) ** 2, 0) / amps.length);
    expect(asd / am).toBeGreaterThan(0.05);
  });
  it('events are in time order and cycle through the firing order 1-2-7-8-4-5-6-3', () => {
    const ev = run(680, 2);
    expect(ev.every((e, i) => i === 0 || e.t >= ev[i - 1].t)).toBe(true);
    ev.forEach((e, i) => expect(e.cyl).toBe(FIRING_ORDER[i % 8]));
  });
  it('rate follows rpm changes and no event is scheduled in the past', () => {
    const s = new FiringScheduler(), seen = []; let t = 0;
    for (; t < 3; t += 1 / 60) { const rpm = 680 + (3200 - 680) * Math.min(1, t / 3); for (const e of s.plan(t, t + 0.1, rpm)) { expect(e.t).toBeGreaterThanOrEqual(t - 1e-9); seen.push(e); } }
    const first = seen.filter((e) => e.t < 1).length, last = seen.filter((e) => e.t >= 2 && e.t < 3).length;
    expect(last).toBeGreaterThan(first);
  });
  it('thins firings above the grain budget: never more than MAX_GRAIN_HZ grains per second at any rpm', () => {
    for (const rpm of [100, 400, 680, 1200, 1800, 2400, 3000, 3200, 3400]) {
      const ev = run(rpm, 3), perSec = ev.filter((e) => e.t >= 1 && e.t < 2).length;
      expect(perSec, `rpm ${rpm}`).toBeLessThanOrEqual(MAX_GRAIN_HZ * 1.05);
      if (firingHz(rpm) <= MAX_GRAIN_HZ) expect(perSec).toBeGreaterThan(firingHz(rpm) * 0.9);
    }
    expect(thinFactor(firingHz(3200), MAX_GRAIN_HZ)).toBe(4);
    expect(thinFactor(firingHz(680), MAX_GRAIN_HZ)).toBe(1);
  });
  it('stops below the minimum rpm and restarts cleanly without a burst of stale events', () => {
    const s = new FiringScheduler(); s.plan(0, 0.1, 680);
    expect(s.plan(0.2, 0.3, 0)).toEqual([]);
    const ev = s.plan(5, 5.1, 680); expect(ev.length).toBeLessThanOrEqual(6); expect(ev.every((e) => e.t >= 5)).toBe(true);
  });
  it('periodic pulses (piston slap) come at the requested rate', () => {
    const p = new PulseScheduler(), ev = []; for (let t = 0; t < 4; t += 1 / 60) ev.push(...p.plan(t, t + 0.1, 12));
    const n = ev.filter((e) => e.t >= 1 && e.t < 3).length; expect(n).toBeGreaterThanOrEqual(23); expect(n).toBeLessThanOrEqual(25);
  });
});

describe('node budget', () => {
  it('keeps created nodes per second within the limit and recovers as the window slides', () => {
    const b = new NodeBudget(NODE_BUDGET_PER_SEC, 1); let ok = 0;
    for (let i = 0; i < 400; i++) if (b.tryTake(1, i * 0.005)) ok++; // 200 requests per second offered
    expect(ok).toBeLessThanOrEqual(NODE_BUDGET_PER_SEC * 2 + 2); // two seconds offered: at most 120 per second
    expect(b.used(1.999)).toBeLessThanOrEqual(NODE_BUDGET_PER_SEC);
    expect(b.canAfford(1, 10)).toBe(true);
  });
  it('a full steady engine (combustion grains at the cap plus slap) stays within the budget over any second', () => {
    const b = new NodeBudget(NODE_BUDGET_PER_SEC, 1), s = new FiringScheduler(), sl = new PulseScheduler(); let peak = 0;
    for (let t = 0; t < 5; t += 1 / 60) {
      for (const e of s.plan(t, t + 0.1, 3200)) { void e; b.tryTake(1, t); }
      for (const e of sl.plan(t, t + 0.1, 3200 / 120)) { void e; b.tryTake(1, t); }
      peak = Math.max(peak, b.used(t));
    }
    expect(peak).toBeLessThanOrEqual(NODE_BUDGET_PER_SEC);
  });
});

describe('dsp', () => {
  it('FFT finds a sine at the right bin', () => {
    const sr = 8000, n = 8192, x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * 1000 * i) / sr);
    const sp = D.powerSpectrum(x, sr, 2048), p = D.peakIn(sp, 500, 1500, 300);
    expect(Math.abs(p.hz - 1000)).toBeLessThan(sp.df); expect(p.prominenceDb).toBeGreaterThan(40);
  });
  it('knock grains are finite, short, band-limited bursts: 1.5-4 kHz noise plus a 60-200 Hz thump, harder when cold', () => {
    const sr = 44100, warm = D.renderKnock(sr, { seed: 3, fc: 2500, q: 2.0 }), cold = D.renderKnock(sr, { seed: 3, fc: 2000, q: 1.3, tau: 0.011, secondary: 0.5, noiseAmp: 1.15, thumpAmp: 0.3 });
    for (const g of [warm, cold]) { expect(D.hasNaN(g)).toBe(false); expect(D.peakAbs(g)).toBeGreaterThan(0.3); expect(D.peakAbs(g)).toBeLessThan(3); expect(g.length).toBeLessThan(sr * 0.12); }
    const band = (x, lo, hi) => D.rms(D.biquad(D.biquad(x, 'highpass', sr, lo, 0.7), 'lowpass', sr, hi, 0.7));
    expect(band(warm, 1500, 4000)).toBeGreaterThan(band(warm, 6000, 12000) * 2);
    expect(band(warm, 60, 220)).toBeGreaterThan(0.01);
    // cold: longer ringing, so more energy in the knock band over the whole grain
    expect(band(cold, 1500, 4000)).toBeGreaterThan(band(warm, 1500, 4000) * 0.9);
  });
  it('compression and slap grains are finite', () => {
    for (const g of [D.renderCompression(44100), D.renderSlap(44100)]) { expect(D.hasNaN(g)).toBe(false); expect(D.peakAbs(g)).toBeGreaterThan(0.5); }
  });
});

describe('shop reverb impulse response', () => {
  const sr = 44100, ir = D.renderImpulseResponse(sr);
  it('is stereo, finite, about 2.4 s long and has a 20 ms pre-delay of silence', () => {
    expect(ir.channels.length).toBe(2); expect(D.hasNaN(ir.channels[0])).toBe(false); expect(D.hasNaN(ir.channels[1])).toBe(false);
    expect(ir.length / sr).toBeGreaterThan(2); expect(ir.length / sr).toBeLessThan(3);
    const pre = Math.floor(0.02 * sr); for (let i = 0; i < pre - 1; i++) expect(ir.channels[0][i]).toBe(0);
    let first = 0; while (first < ir.length && Math.abs(ir.channels[0][first]) < 1e-9) first++;
    expect(first / sr).toBeGreaterThanOrEqual(0.0199); expect(first / sr).toBeLessThan(0.03);
  });
  it('energy decays monotonically (100 ms windows after the early reflections)', () => {
    for (const ch of ir.channels) {
      const e = D.windowEnergies(ch, sr, 0.1, 0.1);
      expect(e.length).toBeGreaterThan(15);
      for (let i = 1; i < e.length; i++) expect(e[i], `window ${i}`).toBeLessThan(e[i - 1]);
    }
  });
  it('RT60 is in the 1.2-1.6 s range of a large steel building with a concrete floor', () => {
    for (const ch of ir.channels) { const rt = D.schroederRt60(ch, sr); expect(rt).toBeGreaterThan(1.2); expect(rt).toBeLessThan(1.6); }
  });
  it('highs decay faster than lows (frequency-dependent decay) and the two ears are decorrelated', () => {
    const lo = D.biquad(ir.channels[0], 'lowpass', sr, 400, 0.7), hi = D.biquad(ir.channels[0], 'highpass', sr, 8000, 0.7);
    expect(D.schroederRt60(lo, sr)).toBeGreaterThan(D.schroederRt60(hi, sr) * 1.6);
    let c = 0, a = 0, b = 0; const L = ir.channels[0], R = ir.channels[1]; for (let i = 0; i < ir.length; i++) { c += L[i] * R[i]; a += L[i] * L[i]; b += R[i] * R[i]; }
    expect(Math.abs(c / Math.sqrt(a * b))).toBeLessThan(0.2);
  });
});
