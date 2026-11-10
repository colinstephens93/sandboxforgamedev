// Driveline: engine -> torque converter (+ lockup clutch) -> Allison 1000 clutch packs -> 3.73 axle -> rear wheels -> rollers.
// Rigid-body dynamics with stick/slip friction elements. Slip heats the transmission fluid and feeds the failure model.
import { spec, IN, LB, LBFT } from '../data/truckSpec.js';
import { clamp } from './util.js';

const T = spec.drivetrain.trans;
export const TIRE_R = spec.tires.rollingRadiusIn * IN; // m (effective rolling radius)
export const ROLLER_R = (spec.dyno.rollerDiameterIn / 2) * IN;
export const AXLE = spec.drivetrain.axleRatio;
export const gearRatio = (g) => T.gears[clamp(g, 1, 5) - 1];

export const DL = {
  Ie: 1.15, // engine + flywheel + converter pump, kg m^2 (estimated)
  It: 0.14, // turbine + input shaft, kg m^2 (estimated)
  Iw: spec.drivetrain.drivelineInertiaKgM2, // wheels, axle, driveshaft at the wheel
  Iroll: 2 * spec.dyno.rollerInertiaKgM2PerSet, // both roller sets at the roller
  etaDl: 0.86, // gears, bearings, seals and fluid churning (drives the 15-20 percent loss, estimated)
  crr: 0.02, // rolling resistance coefficient of an 80 psi LT tire on a 24 in roller (estimated)
  rearLoadKg: spec.dims.curbWeightLb * LB * (1 - spec.dims.frontWeightFraction),
  tccCapNm: 1050, // lockup clutch torque capacity before line pressure (estimated)
  stallRpm: T.converterStallRpm, stallRatio: T.converterStallTorqueRatio,
  stallTorqueNm: 760, // engine torque at which the stall speed is quoted (estimated)
  windageNmPerRadS: 0.05, // roller bearing and air drag (estimated)
};
const KCONV2 = Math.pow((DL.stallRpm * Math.PI) / 30, 2) / DL.stallTorqueNm; // (w/K)^2 = Tp at SR=0

// converter torque ratio and capacity shape vs speed ratio
export const torqueRatio = (sr) => (sr >= 0.88 ? 1 : 1 + (DL.stallRatio - 1) * (1 - sr / 0.88));
// converter pump capacity vs speed ratio: flat to 0.78, falls to zero at the coupling point, negative on overrun
const capShape = (sr) => (sr <= 0.78 ? 1 : sr <= 1 ? 1 - Math.pow((sr - 0.78) / 0.22, 2) : -3 * (sr - 1));
export const pumpTorque = (we, sr) => (we * we / KCONV2) * capShape(sr);

export class Driveline {
  constructor() {
    this.wr = 0; // roller angular speed, rad/s
    this.wt = 0; // turbine / input shaft speed, rad/s
    this.we = 0;
    this.gear = 4; this.range = 'N'; // 'P','R','N','D'
    this.tccApply = 0; this.tccWanted = false;
    this.cpSlip = 0; // clutch pack slip, rad/s
    this.tccSlip = 0; this.tccLocked = false;
    this.transF = 185; // sump temperature, F
    this.slipEnergyKj = 0; this.slipPowerKw = 0; this.convHeatKw = 0;
    this.health = 1; // 1 good .. 0 burned
    this.lineP = 1; this.noiseSeed = 0;
    this.out = {};
  }

  wheelSpeed() { return this.wr * ROLLER_R / TIRE_R; }
  get G() { return gearRatio(this.gear) * AXLE; }

  // Capacity of the clutch packs, N m at the transmission input
  cpCapacity() {
    const lim = spec.limits;
    const hot = Math.max(0, this.transF - 240);
    const thermal = clamp(1 - 0.0085 * hot, 0.5, 1);
    return lim.clutchCapacityLbFt * LBFT * this.lineP * thermal * (0.35 + 0.65 * this.health);
  }

  // Parasitic torque at the wheel (rolling resistance on the roller + roller drag), N m, opposing motion
  parasiticAtWheel(ww) {
    const F = DL.crr * DL.rearLoadKg * 9.81;
    const tire = ww > 0.5 ? F * TIRE_R : 0;
    // drag torque at the roller (proportional to roller speed) acts on the wheel through the contact force, so it is
    // multiplied by Rw/Rr on the way to the wheel, the same direction the roller inertia is referred in step()
    const drag = DL.windageNmPerRadS * (ww * TIRE_R / ROLLER_R) * (TIRE_R / ROLLER_R);
    return tire + drag;
  }

  // One integration step. engine: { we, torqueNet } supplied from the powerplant for the current we.
  // Returns new engine speed and the data the dyno / gauges need.
  step(dt, we, tEng, { Ie = DL.Ie, brakeNm = 0, hold = true, tccAllowed = true, noise = 0 } = {}) {
    const G = this.G;
    const inGear = this.range === 'D' || this.range === 'R';
    const ww = this.wheelSpeed();
    const wtKin = G * ww; // turbine speed if clutch packs are locked
    const Ie_ = Ie;
    const par = this.parasiticAtWheel(ww) + brakeNm;
    const eta = DL.etaDl;
    // roller inertia referred to wheel speed: I * (wr/ww)^2 with wr/ww = Rw/Rr
    const IwTot = DL.Iw + DL.Iroll * Math.pow(TIRE_R / ROLLER_R, 2);
    const cap = this.cpCapacity() * (1 + noise);
    const tccCap = DL.tccCapNm * this.lineP * (0.6 + 0.4 * this.health);

    let weN = we, wrN = this.wr;
    let tOut = 0, heatConv = 0, heatTcc = 0, heatCp = 0, tIn = 0, tp = 0, tr = 1;

    if (!inGear) {
      // neutral/park: engine free, rollers coast under parasitic losses and brake
      const dwe = tEng / Ie_;
      weN = Math.max(0, we + dwe * dt);
      const ww2 = Math.max(0, ww - (par / IwTot) * dt);
      wrN = ww2 * TIRE_R / ROLLER_R;
      this.wt = 0; this.tccLocked = false; this.tccApply = 0; this.cpSlip = 0;
    } else {
      // tcc apply logic
      const want = this.tccWanted && tccAllowed;
      this.tccApply += (want ? 1 : -1) * dt / 0.8;
      this.tccApply = clamp(this.tccApply, 0, 1);
      const sgn = this.range === 'R' ? -1 : 1;
      const wt = this.cpSlip > 0 ? wtKin + this.cpSlip : wtKin;
      this.wt = wt;
      // --- decide TCC state ---
      const slipEt = we - wt;
      const lockedCandidate = this.tccApply > 0.98 && Math.abs(slipEt) < 12;
      if (lockedCandidate) this.tccLocked = true;
      if (this.tccLocked && (this.tccApply < 0.9)) this.tccLocked = false;
      const sr = we > 1 ? clamp(wt / we, 0, 1.3) : 0;
      tp = this.tccLocked ? 0 : pumpTorque(we, sr);
      tr = this.tccLocked ? 1 : torqueRatio(sr);
      const tTccK = this.tccApply * tccCap * clamp(slipEt / 25, -1, 1); // friction torque grows with slip, smoothing the apply
      if (!this.tccLocked) {
        // engine side
        const dwe = (tEng - tp - tTccK) / Ie_;
        weN = Math.max(0, we + dwe * dt);
        const tTurb = tr * tp + tTccK;
        tIn = tTurb;
        heatConv = tp * we - tr * tp * wt;
        heatTcc = Math.abs(tTccK) * Math.abs(slipEt);
        // clutch packs
        const wheelLoad = par / (G * eta);
        const accelLocked = (tTurb - wheelLoad) / (DL.It + IwTot / (G * G * eta));
        const needed = tTurb - DL.It * accelLocked;
        if (this.cpSlip <= 0 && Math.abs(needed) <= cap) {
          this.cpSlip = 0;
          const wtN = wt + accelLocked * dt;
          wrN = (wtN / G) * TIRE_R / ROLLER_R;
          tOut = Math.min(Math.abs(needed), cap);
        } else {
          // clutch packs slip: constant kinetic torque, input shaft runs ahead of the wheels
          const cp = cap;
          const dwt = (tTurb - cp) / DL.It;
          const dww = (cp * G * eta - par) / IwTot;
          const slipN = Math.max(0, this.cpSlip + (dwt - G * dww) * dt);
          this.cpSlip = slipN;
          wrN = Math.max(0, ww + dww * dt) * TIRE_R / ROLLER_R;
          tOut = cp; heatCp = cp * (this.cpSlip + 1e-3);
        }
      } else {
        // converter locked: engine and input shaft rotate together
        const wheelLoad = par / (G * eta);
        const accel = (tEng - wheelLoad) / (Ie_ + DL.It + IwTot / (G * G * eta));
        const tTransmit = tEng - Ie_ * accel; // torque through the lockup clutch
        if (Math.abs(tTransmit) > tccCap) { this.tccLocked = false; this.tccApply = 0.85; }
        const needed = tTransmit - DL.It * accel;
        if (this.cpSlip <= 0 && Math.abs(needed) <= cap && this.tccLocked) {
          this.cpSlip = 0;
          const wtN = wt + accel * dt;
          weN = wtN;
          wrN = (wtN / G) * TIRE_R / ROLLER_R;
          tIn = tTransmit; tOut = needed;
        } else if (this.tccLocked) {
          const cp = cap;
          const dwt = (tEng - cp) / (Ie_ + DL.It);
          const dww = (cp * G * eta - par) / IwTot;
          this.cpSlip = Math.max(0, this.cpSlip + (dwt - G * dww) * dt);
          weN = wt + dwt * dt;
          wrN = Math.max(0, ww + dww * dt) * TIRE_R / ROLLER_R;
          tIn = tEng; tOut = cp; heatCp = cp * (this.cpSlip + 1e-3);
        }
        heatConv = 0;
      }
      if (sgn < 0) { /* reverse not used on the dyno */ }
    }
    this.we = weN; this.wr = Math.max(0, wrN);
    // heat generation (kW) and transmission fluid temperature
    const gearLoss = inGear ? 0.10 * Math.abs(tIn) * this.wt : 0;
    this.convHeatKw = (heatConv + heatTcc + gearLoss) / 1000;
    this.slipPowerKw = heatCp / 1000;
    this.slipEnergyKj += this.slipPowerKw * dt;
    const cTrans = 22; // kJ/K: about 12 L of fluid plus the case that warms with it (estimated)
    const tC = (this.transF - 32) / 1.8;
    const coolantAssist = 0.12 + 0.2 * clamp((tC - 60) / 40, 0, 1);
    const qCool = coolantAssist * (tC - 80); // kW removed by the cooler, tuned for 180-200 F at light load
    const dT = ((this.convHeatKw + this.slipPowerKw) - Math.max(qCool, 0)) / cTrans;
    this.transF += dT * dt * 1.8;
    this.out = { tOut, tIn, heatConvKw: this.convHeatKw, heatCpKw: this.slipPowerKw, cap, tp, tr };
    return { we: this.we, wr: this.wr };
  }
}
