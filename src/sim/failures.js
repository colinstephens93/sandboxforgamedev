// Breakage model (PROMPT.md section 5A): parts fail only past believable limits, never randomly.
// Every limit lives in truckSpec.limits / spec.turbo with a source and a confidence tag.
import { spec } from '../data/truckSpec.js';
import { clamp } from './util.js';

const L = spec.limits;
const K2F = (k) => (k - 273.15) * 1.8 + 32;

export class FailureModel {
  constructor() { this.reset(); }
  reset() {
    this.state = { transmission: false, headGasket: false, turbo: false, piston: false };
    this.acc = { overspeed: 0, turboEgt: 0, pistonEgt: 0, cylLift: 0, slipKj: 0, hotTrans: 0 };
    this.events = [];
  }
  repair(part) {
    if (part === 'all') { this.reset(); return; }
    this.state[part] = false;
    const m = { transmission: ['slipKj', 'hotTrans'], headGasket: ['cylLift'], turbo: ['overspeed', 'turboEgt'], piston: ['pistonEgt'] }[part] || [];
    m.forEach((k) => { this.acc[k] = 0; });
  }
  _fail(part, title, why) {
    if (this.state[part]) return;
    this.state[part] = true;
    this.events.push({ part, title, why });
  }

  update(dt, plant, o) {
    if (!plant.running && plant.dl.cpSlip < 1) return;
    const a = this.acc;
    const egtF = K2F(o.egtPreK);
    // ---- turbocharger: overspeed or extreme exhaust temperature ----
    if (o.turboRpm > spec.turbo.overspeedRpm) a.overspeed += dt; else a.overspeed = Math.max(0, a.overspeed - dt * 0.25);
    if (egtF > L.egtTurboDamageF) a.turboEgt += dt; else a.turboEgt = Math.max(0, a.turboEgt - dt * 0.25);
    if (a.overspeed > spec.turbo.overspeedHoldS || a.turboEgt > 4) {
      this._fail('turbo', 'TURBOCHARGER DAMAGED', a.overspeed > spec.turbo.overspeedHoldS
        ? `The turbo shaft ran above ${Math.round(spec.turbo.overspeedRpm / 1000)},000 rpm for too long. The compressor wheel rubbed the housing and lost blade tips, so boost drops and the whistle turns rough.`
        : `Exhaust gas temperature stayed above ${L.egtTurboDamageF} F before the turbine and the turbine wheel and housing were damaged, so boost drops.`);
    }
    // ---- pistons: extreme EGT held over time ----
    if (egtF > L.egtPistonDamageF) a.pistonEgt += dt * clamp((egtF - L.egtPistonDamageF) / 100 + 0.5, 0.5, 3); else a.pistonEgt = Math.max(0, a.pistonEgt - dt * 0.3);
    if (a.pistonEgt > L.egtPistonDamageHoldS) {
      this._fail('piston', 'PISTONS DAMAGED', `Pre-turbo exhaust temperature stayed above ${L.egtPistonDamageF} F. The aluminum piston crowns eroded, so the engine loses power and blows smoke.`);
    }
    // ---- head gaskets: sustained high cylinder pressure ----
    if (o.pCylPsi > L.cylPressureLiftPsi) a.cylLift += dt * clamp((o.pCylPsi - L.cylPressureLiftPsi) / 150 + 1, 1, 3);
    else a.cylLift = Math.max(0, a.cylLift - dt * 0.2);
    if (a.cylLift > L.cylPressureHoldS) {
      this._fail('headGasket', 'HEAD GASKETS LIFTED', `Cylinder pressure stayed above ${L.cylPressureLiftPsi} psi. The heads lifted and the gaskets leak: white smoke, coolant loss and climbing temperature.`);
    }
    // ---- Allison: prolonged clutch slip burns the clutches ----
    a.slipKj = plant.dl.slipEnergyKj;
    if (plant.dl.transF > L.transBurnF) a.hotTrans += dt; else a.hotTrans = Math.max(0, a.hotTrans - dt * 0.2);
    plant.dl.health = this.state.transmission ? 0 : clamp(1 - 0.5 * a.slipKj / L.clutchBurnSlipEnergyKj - 0.04 * a.hotTrans, 0.05, 1);
    if (a.slipKj > L.clutchBurnSlipEnergyKj || a.hotTrans > 25) {
      this._fail('transmission', 'ALLISON CLUTCHES BURNED', 'The clutch packs slipped too long and overheated. The transmission cannot hold the load any more and needs a rebuild.');
    }
    // effects of failures feed back into the powerplant
    const pp = plant.pp;
    pp.damage.boostLoss = this.state.turbo ? 0.45 : 0;
    pp.damage.piston = this.state.piston ? 0.12 : 0;
  }
}
