// Model coefficients for the physical simulation. These are modelling choices (not data about the real truck);
// the real-world inputs are in src/data/truckSpec.js. Every value here is `estimated` (see ACCURACY.md, "model coefficients").
import { spec } from '../data/truckSpec.js';

export const P = {
  // ---- combustion ----
  eta0: 0.485, // peak indicated efficiency of a modern turbo diesel at optimum timing and lean mixture
  mbtBase: 8, mbtPerRpm: 0.0048, // optimum start of injection, deg BTDC = base + perRpm * rpm
  timingK: 0.0028, timingMin: 0.82, // efficiency loss per deg^2 away from the optimum, floor
  lambdaFull: 1.3, // above this lambda there is no rich penalty
  richK: 0.42, richExp: 1.5, // rich-side efficiency loss
  heatLossFrac: 0.085, // fuel energy lost to coolant/oil beyond the indicated efficiency, goes to exhaust otherwise
  // fuel properties: real-world inputs, taken from the spec so there is one copy of each
  lhvJPerKg: spec.engine.heatingValueMjKg * 1e6,
  stoichAfr: spec.engine.stoichAfr,
  fuelDensityGPerMm3: spec.engine.dieselDensityGPerL * 1e-6,
  // friction and pumping
  fmepBase: 0.95, fmepPerRpm: 0.00022, fmepPerRpm2: 6e-8, // bar
  accessoryNm: 9, // alternator, power steering, A/C compressor, fan clutch on average
  pumpK: 0.9, // fraction of (drive pressure - intake pressure) work charged against the engine
  // ---- air path ----
  volEffBase: 0.96, volEffPerRpm: 0.000028,
  icEffectiveness: 0.72, // intercooler
  // charge-air pressure drop as a fraction of compressor outlet pressure: fixed part + flow part * (mAir / ref)^2
  icDropFrac: 0.03, icDropFlow: 0.0356, icDropRefFlow: 0.4, // kg/s; about 6.6 percent at rated air flow
  // ---- turbo (Garrett GT3788VA class, lumped) ----
  turboInertia: 6.0e-5, // kg m^2
  compEta: 0.72, psiEta: 0.52, // psi * eta_c, so that PR = (1 + psiEta*u^2/(cp*T1))^3.5
  compTipRadius: 0.0405, // m
  turbEta: 0.68, mechEta: 0.97,
  turbArea: 0.064, // K*A0: kg/s*sqrt(K)/kPa at fully open vanes
  vaneAreaGain: 0.85, // A_eff = A0 * (1 - gain * v)
  scavengeK: 0.15, // manifold temperature rise per unit of vane closure from reduced scavenging (estimated)
  pulseGain: 3.2, pulseFlow: 0.07, // exhaust pulse energy at low flow (estimated)
  turboOmegaMin: 1200, turboOmegaMax: 16000, // rad/s
  backPressureK: 12, // kPa at 0.35 kg/s through the exhaust
  // ---- injection ----
  injFlowK: 0.00643, // mm3 / (us * sqrt(MPa))
  // ---- cylinder pressure ----
  polyN: 1.3, // polytropic exponent for compression pressure
  firePerMm3: 1.0, // bar of combustion pressure rise per mm3 of burned fuel at reference timing
  fireTimingK: 0.032, // fractional rise per deg of advance beyond 10
  // ---- idle governor (Plant._idleQty), mm3/stroke ----
  idlePid: { ki: 0.0016, kp: 0.06, base: 8, iMax: 60, maxQty: 45 },
  // ---- reduced engine power (limp mode) ----
  limpMode: { pedalScale: 0.55, maxQtyMm3: 45.0 },
};
