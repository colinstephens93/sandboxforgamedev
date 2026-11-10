// The whole truck as one simulation: powerplant + driveline + thermal state. Pure JS, no rendering.
import { spec, degCtoF, LBFT } from '../data/truckSpec.js';
import { Powerplant } from './engine.js';
import { Driveline, DL, TIRE_R } from './driveline.js';
import { makeAir } from './atmos.js';
import { clamp, lag, interp } from './util.js';
import { FailureModel } from './failures.js';
import { P } from './params.js';

const E = spec.engine;

export class Plant {
  constructor({ cal, regulator = 'LLY', weather } = {}) {
    this.air = makeAir(weather);
    this.pp = new Powerplant({ cal, regulator, air: this.air });
    this.dl = new Driveline();
    this.fail = new FailureModel();
    this.cal = cal;
    this.running = false;
    this.we = 0; // engine rad/s
    this.coolantC = this.air.tempC + 0; // cold truck at shop temperature
    this.oilC = this.air.tempC;
    this.fanOn = false; this.fanDuty = 0;
    this.idleI = 0; this.idleTargetRpm = E.idleRpm;
    this.starter = false;
    this.fuelLevel = 0.62; // fraction of the tank (spec.engine.fuelTankGal); not consumed by running
    this.volts = 12.6; this.charger = false; this.battery = 1.0;
    this.shopFan = true; // dyno cooling fan in front of the grille
    this.hoodClosed = false;
    this.pedal = 0; this.brake = 0;
    this.t = 0;
    this.out = this.pp.compute(1, { qty: 0 });
    this.messages = new Set();
    this.reducedPower = false;
    // starting odometer ~145,000 mi for a 20-year-old working truck (estimated; see ACCURACY.md)
    this.odometerKm = 145000 * 1.609344;
    this.engineSeconds = 0;
  }

  get rpm() { return this.we * 30 / Math.PI; }
  get coolantF() { return degCtoF(this.coolantC); }
  setCalibration(cal) { this.cal = cal; this.pp.setCalibration(cal); this.dl.lineP = cal.trans.lineP; }
  setRegulator(r) { this.pp.regulator = r; }

  // seed a warm, steady condition (used by tests and by the dyno after warm-up)
  warm(coolantF = 200, transF = 190) { this.coolantC = (coolantF - 32) / 1.8; this.dl.transF = transF; this.oilC = this.coolantC - 8; }

  startEngine() {
    if (this.running) return;
    this.running = true; this.we = (E.idleRpm * Math.PI) / 30; this.pp.omega = 3000;
  }
  stopEngine() { this.running = false; }

  // update ambient air (shop temperature slider): keeps plant.air and the powerplant's air in sync
  setWeather(weather = {}) {
    this.air = makeAir({
      tempC: weather.tempC ?? this.air.tempC,
      pressureKpa: weather.pressureKpa ?? this.air.pressureKpa,
      humidityPct: weather.humidityPct ?? this.air.humidityPct,
    });
    this.pp.air = this.air;
    if (!this.running && this.engineSeconds === 0) { this.coolantC = this.air.tempC; this.oilC = this.air.tempC; }
  }

  _idleQty(rpm, dt) {
    const k = P.idlePid;
    const e = this.idleTargetRpm - rpm;
    this.idleI = clamp(this.idleI + e * k.ki * dt * 60, 0, k.iMax);
    return clamp(k.base + this.idleI + e * k.kp, 0, k.maxQty);
  }

  step(dt, { pedal = 0, brake = 0, brakeNm = 0, range, gear, tcc } = {}) {
    this.t += dt;
    if (range !== undefined) this.dl.range = range;
    if (gear !== undefined) this.dl.gear = gear;
    this.pedal = pedal; this.brake = brake;
    const rpm = Math.max(this.rpm, 1);
    const cal = this.cal;
    // demand: pedal map, with the idle governor as the floor
    let demand = { pedal };
    if (this.running) {
      const qFull = interp(cal.fuel, rpm);
      const qPed = qFull * pedal;
      const qIdle = this._idleQty(rpm, dt);
      demand = qPed > qIdle ? { pedal } : { qty: qIdle };
      if (this.reducedPower) {
        demand = demand.qty != null
          ? { ...demand, qty: Math.min(demand.qty, P.limpMode.maxQtyMm3) }
          : { ...demand, pedal: pedal * P.limpMode.pedalScale };
      }
    } else demand = { qty: 0 };
    const out = this.pp.compute(rpm, demand, dt);
    let tEng = out.torqueNm;
    if (this.starter && !this.running) tEng += 260 * clamp(1 - rpm / 260, 0, 1);
    // transmission-side torque converter lockup demand from the calibration
    this.dl.tccWanted = tcc !== undefined ? tcc : (rpm > cal.trans.tccApplyRpm && this.dl.gear >= 2);
    this.dl.lineP = cal.trans.lineP;
    const noise = this.dl.cpSlip > 1 ? (Math.sin(this.t * 83) * 0.03 + Math.sin(this.t * 31.7) * 0.025) : 0;
    const res = this.dl.step(dt, this.we, tEng, { brakeNm, tccAllowed: this.dl.transF < 275, noise });
    this.we = res.we;
    if (!this.running && !this.starter) this.we = Math.max(0, this.we);
    if (this.running && this.rpm < 150) this.running = false; // stalled
    this.pp.advance(dt);
    this._thermal(dt, out);
    this.fail.update(dt, this, out);
    this.out = out;
    if (this.running) this.engineSeconds += dt;
    // accumulate odometer from tire linear speed
    const speedMs = Math.abs(this.dl.wheelSpeed() * TIRE_R);
    this.odometerKm += (speedMs * dt) / 1000;
    return out;
  }

  _thermal(dt, o) {
    const rpm = this.rpm;
    // heat rejected to coolant: about 30 percent of fuel energy beyond the work and exhaust share
    const fuelPowerKw = (o.fuelGPerS * 1e-3 * P.lhvJPerKg) / 1000;
    const qCoolant = this.running ? (0.17 + 0.10 * clamp(rpm / 3000, 0, 1)) * fuelPowerKw + 4 : 0;
    const cEng = 200; // kJ/K, coolant (24 qt) plus engine mass (estimated)
    const tAirC = this.air.tempC;
    // thermostat starts to open at spec.engine.thermostatOpenF and is fully open 12 F above it
    const tF = degCtoF(this.coolantC);
    const thermo = clamp((tF - spec.engine.thermostatOpenF) / 12, 0.04, 1);
    const fanOn = this.running && (tF > 215 || this.fanOn);
    const airflow = 0.35 + (this.shopFan ? 0.9 : 0) + (fanOn ? 0.55 : 0) + 0.00025 * rpm;
    const uaKwK = 0.8 * airflow * thermo * (this.fail.state.headGasket ? 0.7 : 1);
    const qRad = uaKwK * (this.coolantC - tAirC);
    this.coolantC += ((qCoolant - qRad) / cEng) * dt;
    this.fanDuty = lag(this.fanDuty, fanOn ? 1 : 0, 0.8, dt);
    this.oilC = lag(this.oilC, this.coolantC + 4 + 8 * (o.load || 0), 25, dt);
    // intercooler heat soak builds slowly with boost (up to 12 K above about 44 psi; estimated)
    const soakTarget = clamp((o.boostPsi - 10) * 0.35, 0, 12);
    this.pp.icSoakK = lag(this.pp.icSoakK, this.running ? soakTarget : 0, 40, dt);
    // reduced engine power protection
    const trip = this.coolantF > spec.limits.coolantOverheatF || this.dl.transF > spec.drivetrain.trans.hotWarningF;
    if (trip) { this.reducedPower = true; }
    else if (this.reducedPower && this.coolantF < spec.limits.coolantOverheatF - 10 && this.dl.transF < spec.drivetrain.trans.protectionExitF) this.reducedPower = false;
  }
}
