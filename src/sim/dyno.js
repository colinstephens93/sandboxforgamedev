// Chassis dyno: inertia rollers, run state machine, power from roller acceleration, SAE correction, run history.
// Wheel horsepower is MEASURED the way a real inertia dyno does it: P = I_roller * w * dw/dt, plus a parasitic-loss
// compensation taken from a coast-down. Nothing here knows the engine's torque curve.
import { spec, LBFT, HP_CONST, HP } from '../data/truckSpec.js';
import { DL, Driveline, ROLLER_R, TIRE_R } from './driveline.js';
import { correctionFactor } from './atmos.js';
import { clamp, interp, mulberry32 } from './util.js';

export const DYNO_CFG = { startRpm: 1400, endRpm: 3150, binRpm: 25, sampleHz: 100, smoothSec: 0.6 };

// Coast-down calibration: roll the rollers (with tires on them) up to speed and let them coast in neutral;
// P_par(w) = I w (-dw/dt). Done once per dyno as a shop would at start of day.
export function coastDownCalibration() {
  const dl = new Driveline(); dl.range = 'N';
  const wr0 = (3500 * Math.PI) / 30 / (DL_G4()) * TIRE_R / ROLLER_R; // roller speed at the top of the pull
  dl.wr = wr0;
  const I = DL.Iroll + DL.Iw * Math.pow(ROLLER_R / TIRE_R, 2);
  const pts = []; const dt = 0.02;
  let prev = dl.wr;
  for (let t = 0; t < 400 && dl.wr > 5; t += dt) {
    dl.step(dt, 0, 0, {});
    const a = (dl.wr - prev) / dt; prev = dl.wr;
    pts.push({ w: dl.wr, p: I * dl.wr * -a });
  }
  pts.sort((a, b) => a.w - b.w);
  // thin to a table with smoothing
  const x = [], y = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const lo = Math.floor((i / n) * pts.length), hi = Math.floor(((i + 1) / n) * pts.length);
    let sw = 0, sp = 0, c = 0; for (let k = lo; k < hi; k++) { sw += pts[k].w; sp += pts[k].p; c++; }
    if (c) { x.push(sw / c); y.push(sp / c); }
  }
  return { x, y };
}
const DL_G4 = () => spec.drivetrain.trans.gears[3] * spec.drivetrain.axleRatio;

export class Dyno {
  constructor(plant) {
    this.plant = plant;
    this.straps = [false, false, false, false];
    this.chocks = false;
    this.fan = false; // high-velocity cooling fan
    this.hoseOn = false; // exhaust extraction hose
    this.gear = 4;
    this.phase = 'idle'; // idle, spinup, pull, coast, done, refused
    this.message = '';
    this.runs = []; this.current = null;
    this.parasitic = null;
    this.runCounter = 0;
    this.rng = mulberry32(2005);
  }

  setFan(on) { this.fan = on; this.plant.shopFan = on; }
  strapAll(on) { this.straps = this.straps.map(() => on); }

  // Returns { ok, reason }
  canStart() {
    const p = this.plant;
    if (!this.straps.every(Boolean)) return { ok: false, reason: 'Tie-down straps are not attached at all four corners. Strap the truck down before a pull.' };
    if (p.hoodClosed && !this.fan) return { ok: false, reason: 'The hood is closed and the cooling fan is off. Turn the dyno fan on or open the hood before a pull.' };
    if (!p.running) return { ok: false, reason: 'The engine is not running. Start the truck first.' };
    if (p.fail.state.transmission) return { ok: false, reason: 'The transmission failed (clutches burned) and cannot hold the load. Repair it from the shop menu.' };
    if (this.phase === 'spinup' || this.phase === 'pull' || this.phase === 'coast') return { ok: false, reason: 'A run is already in progress.' };
    return { ok: true, reason: '' };
  }

  startRun() {
    const c = this.canStart();
    if (!c.ok) { this.phase = 'refused'; this.message = c.reason; return c; }
    if (!this.parasitic) this.parasitic = coastDownCalibration();
    const p = this.plant;
    this.runCounter++;
    p.dl.range = 'D'; p.dl.gear = this.gear;
    this.rec = { t: [], rpm: [], wr: [], log: [] }; this._acc = 0; this._n = 0;
    this.air0 = { ...p.air };
    this.current = { id: this.runCounter, tuneId: p.cal.id, tuneName: p.cal.name, gear: this.gear, regulator: p.pp.regulator, air: this.air0, vane: { ...p.pp.sound } };
    this.phase = 'spinup'; this.t = 0; this.pedalCmd = 0; this.message = 'Spin-up: bringing the rollers to start speed';
    this.warns = [];
    return { ok: true, reason: '' };
  }

  abort(why = 'Run aborted') { this.phase = 'idle'; this.message = why; this.plant.dl.range = 'N'; this._release(); }
  _release() { this.pedalCmd = 0; }

  // advance the whole system by dt; returns the plant output
  update(dt) {
    const p = this.plant;
    let pedal = 0, brakeNm = 0;
    this.t = (this.t || 0) + dt;
    if (this.phase === 'spinup') {
      // operator feathers the throttle to reach the start rpm, then goes to full throttle
      const rpm = p.rpm;
      const target = DYNO_CFG.startRpm;
      pedal = clamp(0.45 + (target - rpm) * 0.0016, 0, 0.8);
      if (p.fail.state.transmission && this.t > 5) { this.abort('The transmission could not hold the load.'); }
      if (rpm >= target) { this.phase = 'pull'; this.pullT = 0; this.message = 'PULL: full throttle'; }
      else if (this.t > 120) { this.abort('Could not reach start speed.'); }
    } else if (this.phase === 'pull') {
      pedal = 1; this.pullT += dt;
      if (p.rpm >= DYNO_CFG.endRpm || this.pullT > 90) { this.phase = 'coast'; this.coastT = 0; this.message = 'Coast-down'; }
    } else if (this.phase === 'coast') {
      pedal = 0; this.coastT += dt;
      p.dl.range = 'N';
      brakeNm = 2200; // the eddy-current absorber slows the rollers after the run
      if (this.coastT > 4 || p.dl.wr < 20) { this.finish(); }
    }
    const out = p.step(dt, { pedal, brakeNm });
    if (this.phase === 'pull' || (this.phase === 'spinup' && p.rpm > DYNO_CFG.startRpm * 0.8)) this._sample(dt, out);
    return out;
  }

  _sample(dt, o) {
    const p = this.plant; const r = this.rec;
    this._acc = (this._acc || 0) + dt;
    const step = 1 / DYNO_CFG.sampleHz;
    if (this._acc < step - 1e-9) return;
    this._acc -= step;
    r.t.push(this.t); r.rpm.push(p.rpm); r.wr.push(p.dl.wr);
    this._n = (this._n || 0) + 1;
    if (this._n % 5 === 0) r.log.push(this._logRow(o)); // 20 Hz datalog
  }

  _logRow(o) {
    const p = this.plant;
    return { t: +this.t.toFixed(2), rpm: Math.round(p.rpm), qty: +o.qty.toFixed(1), railPsi: Math.round(o.rail), railTgtPsi: Math.round(o.railTgt), boostPsi: +o.boostPsi.toFixed(1), airLbMin: +o.mAirLbMin.toFixed(1), soiDeg: +o.soi.toFixed(1), egtF: Math.round((o.egtPreK - 273.15) * 1.8 + 32), coolantF: Math.round(p.coolantF), transF: Math.round(p.dl.transF), slipRpm: Math.round(p.dl.cpSlip * 30 / Math.PI), vanePct: Math.round(o.vane * 100), turboKrpm: +(o.turboRpm / 1000).toFixed(1), driveKpa: Math.round(o.driveKpa), lambda: +o.lambda.toFixed(2), tccLocked: p.dl.tccLocked ? 1 : 0, pCylPsi: Math.round(o.pCylPsi) };
  }

  finish() {
    const p = this.plant;
    let run = this.analyze();
    this.phase = 'done'; this.message = 'Run complete';
    p.dl.range = 'N';
    const tooShort = !run || run.points.length < 6 || (this.pullT || 0) < 1.5;
    if (tooShort) {
      // the engine flared to the end rpm in a fraction of a second: the transmission is not holding the load
      this.message = 'Run invalid: the transmission slipped and the engine flared to the end rpm. No usable data.';
      run = { id: this.runCounter, invalid: true, tuneId: this.current ? this.current.tuneId : p.cal.id, tuneName: this.current ? this.current.tuneName : p.cal.name, regulator: p.pp.regulator, gear: this.gear, points: [], peakHp: 0, peakTq: 0, peakHpRpm: 0, peakTqRpm: 0, cf: 1, log: this.rec ? this.rec.log : [], failures: { ...p.fail.state }, reason: this.message };
    }
    this.runs.push(run); this.last = run;
    this.current = null;
    return run;
  }

  // Power from roller acceleration, smoothed, binned by engine rpm, parasitic-compensated, corrected.
  analyze() {
    const r = this.rec; const n = r.t.length;
    if (n < 40) return null;
    const dt = 1 / DYNO_CFG.sampleHz;
    const rngLocal = mulberry32(this.runCounter * 7919 + 13);
    // roller speed as measured by an encoder: tiny noise
    const w = r.wr.map((v) => v * (1 + (rngLocal() - 0.5) * 0.0006));
    const half = Math.round((DYNO_CFG.smoothSec / dt) / 2);
    const rows = [];
    for (let i = half; i < n - half; i++) {
      const a = (w[i + half] - w[i - half]) / ((2 * half) * dt);
      const wi = (w[i + half] + w[i - half]) / 2;
      const pInertial = DL.Iroll * wi * a; // W, rollers only: that is all the dyno sees
      const pPar = interp(this.parasitic, wi);
      const wWheel = wi * ROLLER_R / TIRE_R;
      rows.push({ rpm: r.rpm[i], p: pInertial + pPar, wWheel, i });
    }
    // bin by engine rpm
    const bin = DYNO_CFG.binRpm;
    let rmin = Infinity, rmax = 0; for (const row of rows) { rmin = Math.min(rmin, row.rpm); rmax = Math.max(rmax, row.rpm); }
    const lo = Math.ceil(rmin / bin) * bin, hi = Math.floor(rmax / bin) * bin;
    const air = this.current ? this.current.air : this.air0;
    const cf = correctionFactor(air, { turbo: true, qc: 33 });
    const pts = [];
    for (let rpm = lo; rpm <= hi; rpm += bin) {
      let s = 0, c = 0;
      for (const row of rows) if (Math.abs(row.rpm - rpm) <= bin / 2) { s += row.p; c++; }
      if (!c) continue;
      const pw = s / c; // W
      const hp = pw / HP;
      pts.push({ rpm, hp: hp * cf, tq: (hp * cf * HP_CONST) / rpm, hpRaw: hp });
    }
    if (!pts.length) pts.push({ rpm: lo, hp: 0, tq: 0, hpRaw: 0 });
    // peaks
    let pk = pts[0], tk = pts[0];
    for (const q of pts) { if (q.hp > pk.hp) pk = q; if (q.tq > tk.tq) tk = q; }
    const meta = this.runMeta || {};
    const run = {
      id: this.runCounter, tuneId: this.current ? this.current.tuneId : this.plant.cal.id, tuneName: this.current ? this.current.tuneName : this.plant.cal.name,
      regulator: this.plant.pp.regulator, gear: this.gear, points: pts, peakHp: pk.hp, peakHpRpm: pk.rpm, peakTq: tk.tq, peakTqRpm: tk.rpm,
      cf, air: { tempC: air.tempC, pressureKpa: air.pressureKpa, humidityPct: air.humidityPct },
      log: r.log, endTransF: this.plant.dl.transF, endCoolantF: this.plant.coolantF, vane: this.current ? this.current.vane : { close: 0, hold: 0 },
      failures: { ...this.plant.fail.state }, maxEgtF: Math.max(...r.log.map((l) => l.egtF)), maxBoostPsi: Math.max(...r.log.map((l) => l.boostPsi)),
      maxSlipRpm: Math.max(...r.log.map((l) => l.slipRpm)), maxTurboKrpm: Math.max(...r.log.map((l) => l.turboKrpm)),
      railErrPsi: (() => { const q = r.log.filter((l) => l.rpm >= 2500); return q.length ? q.reduce((a, l) => a + (l.railTgtPsi - l.railPsi), 0) / q.length : 0; })(), maxCylPsi: Math.max(...r.log.map((l) => l.pCylPsi)),
      smokeMax: 0,
    };
    return run;
  }
}
