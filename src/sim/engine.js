// Powerplant: LLY Duramax combustion + air path + VGT turbo. Torque is COMPUTED from the calibration (fuel quantity,
// timing, rail pressure, boost/vane targets, smoke and torque limiters) and limited by the air the turbo delivers.
// It is never read from a fixed torque curve (PROMPT.md section 5).
import { spec, LBFT, PSI, HP_CONST } from '../data/truckSpec.js';
import { P } from './params.js';
import { clamp, interp, lag, smoothstep } from './util.js';
import * as TB from './turbo.js';

const E = spec.engine;
const VD = E.displacementL / 1000; // m3
const FOUR_PI = 4 * Math.PI;
const PSI_KPA = PSI / 1000;
const R_AIR = 287.05; // J/(kg K), dry air

// Fuel pressure regulator on the CP3: rail pressure the pump can hold = p0 - r * injected volume flow (cc/s).
// LBZ regulator flows more than the LLY one (square vs triangular slot). Values are estimates (ACCURACY.md).
export const REGULATORS = {
  LLY: { name: 'LLY (stock)', p0: 31000, r: 240 },
  LBZ: { name: 'LBZ', p0: 31000, r: 100 },
};

export class Powerplant {
  constructor({ cal, regulator = 'LLY', air }) {
    this.cal = cal; this.regulator = regulator; this.air = air;
    this.omega = 3500; // turbo shaft rad/s
    this.vaneTrim = 0; this.railAct = 5000; this.t = 0;
    this.icSoakK = 0; // intercooler heat soak, K
    this.sound = { close: 0, hold: 0 }; // Turbo Sound page (AI Live)
    this.damage = { turbo: 0, boostLoss: 0 }; // set by the failure model: efficiency loss factors
    this.out = null;
  }

  setCalibration(cal) { this.cal = cal; this.vaneTrim = 0; }

  // Instantaneous outputs for given rpm and driver demand at the CURRENT turbo state.
  // demand: { pedal (0..1) } or { qty } (absolute mm3 per stroke, used by the idle governor)
  compute(rpm, demand, dt = 0) {
    const { cal, air } = this;
    const T1 = air.T + 3; // intake restriction/heating, K
    const PR = TB.prFromOmega(this.omega, T1) * (1 - 0.5 * this.damage.boostLoss);
    const Tc2 = TB.compressorOutletK(PR, T1);
    const Tim = T1 + (Tc2 - T1) * (1 - P.icEffectiveness) + this.icSoakK;
    const volEff = P.volEffBase - P.volEffPerRpm * rpm;
    // Charge-air pressure drop grows with the square of the air flow, and the flow depends on the manifold pressure the
    // drop leaves, so the pair is solved together (the loop converges in two or three passes; the drop is a few percent).
    let Pim = 0, airG = 0, mAir = 0;
    for (let i = 0, dp = P.icDropFrac; i < 3; i++) {
      Pim = air.pressureKpa * PR * (1 - dp); // kPa abs
      airG = ((Pim * 1000) / (R_AIR * Tim)) * volEff * VD * 1000; // g per cycle, all cylinders
      mAir = (airG / 1000) * (rpm / 120); // kg/s
      dp = P.icDropFrac + P.icDropFlow * Math.pow(mAir / P.icDropRefFlow, 2);
    }

    // ---- fuel command ----
    const qtyFull = interp(cal.fuel, rpm);
    const load = demand.qty != null ? clamp(demand.qty / Math.max(qtyFull, 1), 0, 1) : clamp(demand.pedal, 0, 1);
    let qtyCmd = demand.qty != null ? demand.qty : qtyFull * load;
    // smoke limiter: fuel can not exceed the air divided by the minimum allowed lambda
    const qtySmoke = airG / (P.stoichAfr * cal.lambdaMin) / (P.fuelDensityGPerMm3 * E.cylinders);
    let qty = Math.min(qtyCmd, qtySmoke);
    // governor taper
    const gov = 1 - smoothstep(cal.govStart, cal.govEnd, rpm);
    qty *= gov;
    // rail pressure target and what the CP3 + regulator can hold
    const railTgt = cal.railIdle + (interp(cal.rail, rpm) - cal.railIdle) * Math.pow(load, 0.8);
    const reg = REGULATORS[this.regulator];
    const flowCcS = (qty * E.cylinders * (rpm / 120)) / 1000;
    const railCap = reg.p0 - reg.r * flowCcS;
    const railNow = Math.min(railTgt, railCap);
    this.railAct = dt > 0 ? lag(this.railAct, railNow, 0.12, dt) : railNow;
    const railRatio = clamp(this.railAct / Math.max(railTgt, 1), 0.3, 1.0);

    // timing (deg BTDC) at this load
    const soi = interp(cal.timing, rpm) * (0.55 + 0.45 * load) * (load < 0.02 ? 0 : 1) + (load < 0.02 ? 3 : 0);
    const mbt = P.mbtBase + P.mbtPerRpm * rpm;

    // ---- combustion for a given delivered quantity (used for the torque limiter loop) ----
    const burn = (qDel) => {
      const mf = qDel * E.cylinders * P.fuelDensityGPerMm3; // g per cycle
      const lambda = mf > 1e-6 ? airG / (mf * P.stoichAfr) : 99;
      const x = clamp((P.lambdaFull - lambda) / 0.3, 0, 3);
      const fLam = lambda >= 1 ? 1 - P.richK * Math.pow(Math.min(x, 1), P.richExp) : (1 - P.richK) * lambda;
      const fRail = 0.9 + 0.1 * railRatio;
      const fTime = Math.max(P.timingMin, 1 - P.timingK * Math.pow(soi - mbt, 2));
      const etaI = P.eta0 * fTime * fRail * fLam * (1 - (this.damage.piston || 0));
      const tInd = (mf * 1e-3 * P.lhvJPerKg * etaI) / FOUR_PI;
      return { mf, lambda, etaI, tInd, fTime };
    };
    const fmep = (P.fmepBase + P.fmepPerRpm * rpm + P.fmepPerRpm2 * rpm * rpm) * 1e5;
    const tFric = (fmep * VD) / FOUR_PI;

    // exhaust path needs ~mf, so evaluate with delivered qty
    let qDel = qty * Math.sqrt(railRatio);
    let b = burn(qDel);
    const mExhEst = mAir + (b.mf * 1e-3 * rpm) / 120;
    const T3guess = Tim + (b.mf * 1e-3 * P.lhvJPerKg * (1 - b.etaI - P.heatLossFrac)) / ((airG + b.mf) * 1e-3 * TB.TURBO_CONST.CP_EXH);
    const p4 = TB.exhaustBackKpa(air.pressureKpa, mExhEst);
    const vane = this._vane(rpm, load, Pim, dt);
    const p3 = TB.drivePressureKpa(mExhEst, T3guess, p4, vane);
    const tPump = P.pumpK * Math.max(p3 - Pim, -20) * 1000 * VD / FOUR_PI;
    let tNet = b.tInd - tFric - tPump - P.accessoryNm;
    // torque limiter (cal): scale fuel back until net torque is within the limit
    const tLim = interp(cal.torqueLimit, rpm) * LBFT;
    if (demand.qty == null && tNet > tLim) {
      for (let i = 0; i < 3; i++) {
        const k = (tLim + tFric + tPump + P.accessoryNm) / Math.max(b.tInd, 1);
        qDel *= clamp(k, 0.3, 1);
        b = burn(qDel);
        tNet = b.tInd - tFric - tPump - P.accessoryNm;
      }
    }
    const Qexh = b.mf * 1e-3 * P.lhvJPerKg * Math.max(0, 1 - b.etaI - P.heatLossFrac);
    // scavenging: closing the vanes raises back pressure, leaves more hot residual gas and pumping heat in the cylinder, and
    // raises manifold temperature even though the extra air dilutes it (empirical, about 15 percent per unit of vane travel)
    const T3 = (Tim + Qexh / ((airG + b.mf) * 1e-3 * TB.TURBO_CONST.CP_EXH)) * (1 + P.scavengeK * (vane - 0.5));
    const mExh = mAir + (b.mf * 1e-3 * rpm) / 120;
    const p4b = TB.exhaustBackKpa(air.pressureKpa, mExh);
    const p3b = TB.drivePressureKpa(mExh, T3, p4b, vane);
    const pt = TB.turbinePowerW(mExh, T3, p3b, p4b, vane) * P.mechEta;
    const pc = TB.compressorPowerW(mAir, PR, T1);
    const t4 = T3 * (1 - TB.turbineEta(vane) * (1 - Math.pow(p4b / p3b, TB.TURBO_CONST.G_EXH)));

    // cylinder pressure: compression (polytropic) + combustion rise
    const pComp = (Pim / 100) * Math.pow(E.compressionRatio, P.polyN); // bar
    const burnedMm3 = b.mf / (P.fuelDensityGPerMm3 * E.cylinders);
    const pFire = pComp + P.firePerMm3 * burnedMm3 * Math.max(0.3, 1 + P.fireTimingK * (soi - 10)) * 0.5 * (1 / Math.max(0.8, Pim / 180));
    const pulseUs = qDel / (P.injFlowK * Math.sqrt(Math.max(this.railAct, 500) * PSI * 1e-6));
    const boostPsi = (Pim - air.pressureKpa) / PSI_KPA;
    const smoke = clamp((1.5 - b.lambda) / 0.4, 0, 1);

    const out = {
      rpm, load, vane, pr: PR, boostPsi, imKpa: Pim, imTempK: Tim, airG, mAir, mAirLbMin: mAir * 132.277,
      qtyCmd, qty: qDel, qtySmoke, railTgt, rail: this.railAct, railErr: railTgt - this.railAct, soi, mbt, pulseUs,
      lambda: b.lambda, smoke, etaI: b.etaI, tInd: b.tInd, tFric, tPump, torqueNm: tNet, torqueLbFt: tNet / LBFT,
      powerKw: (tNet * rpm * Math.PI) / 30 / 1000,
      egtPreK: T3, egtPostK: t4, mExh, driveKpa: p3b, backKpa: p4b, turboPowerW: pt, compPowerW: pc,
      turboRpm: (this.omega * 60) / (2 * Math.PI), pCylPsi: (pFire * 1e5) / PSI,
      fuelGPerS: (b.mf * rpm) / 120,
    };
    out.hp = (tNet / LBFT) * rpm / HP_CONST;
    this.out = out;
    return out;
  }

  _vane(rpm, load, Pim, dt) {
    const { cal } = this;
    const light = interp({ x: cal.vane.x, y: cal.vane.light }, rpm);
    const full = interp({ x: cal.vane.x, y: cal.vane.full }, rpm);
    const ff = light + (full - light) * Math.pow(load, 0.7);
    // closed-loop boost control only under load: PI trim of limited authority
    const boostPsi = (Pim - this.air.pressureKpa) / PSI_KPA; // manifold boost, what the MAP sensor reads
    const target = interp(cal.boost, rpm);
    if (dt > 0 && load > 0.35) {
      const e = target - boostPsi;
      // boost below target: close the vanes. Overboost unwinds the integrator several times faster (anti-windup)
      this.vaneTrim = clamp(this.vaneTrim + e * (e > 0 ? 0.012 : 0.06) * dt, -0.18, 0.18);
    } else if (dt > 0) this.vaneTrim = lag(this.vaneTrim, 0, 1.5, dt);
    const trimmed = clamp(ff + (load > 0.35 ? this.vaneTrim + clamp((target - boostPsi) * 0.004, -0.06, 0.06) : 0), 0, 1);
    // Turbo Sound: close further toward the stop at idle and light load, fading out as throttle comes in
    const s = this.sound;
    if (s.close > 0) {
      const w = 1 + (s.hold - 1) * smoothstep(0.08, 0.8, load);
      const vMax = spec.turbo.vaneMaxClosed;
      return clamp(trimmed + s.close * Math.max(0, vMax - trimmed) * w, 0, spec.turbo.vaneMaxClosed);
    }
    return clamp(trimmed, 0, 1);
  }

  // advance the turbo shaft with the last computed powers; call after compute(dt)
  advance(dt) {
    const o = this.out; if (!o) return;
    const w = Math.max(this.omega, 1500);
    const dw = (o.turboPowerW - o.compPowerW) / (P.turboInertia * w);
    this.omega = clamp(this.omega + dw * dt, P.turboOmegaMin, P.turboOmegaMax);
    this.t += dt;
  }
}
