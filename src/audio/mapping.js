// Pure parameter mapping for the procedural sound engine: simulation state in, synthesis parameters out.
// No Web Audio and no DOM here, so every function is unit tested in Node (tests/audio.test.js).
// Design by physical reasoning, since nobody can listen while building it:
//  * a 4-stroke V8 fires 4 cylinders per crank revolution, so the firing frequency is rpm / 60 * 4 (45.33 Hz at 680 rpm);
//  * the turbo whistle follows the modeled compressor shaft speed (blade pass of the 11-blade wheel), its loudness
//    follows airflow, boost, drive pressure and vane closure, and the intake / exhaust hiss follow airflow and drive pressure.
import { spec, IN } from '../data/truckSpec.js';
import { clamp, clamp01, smoothstep } from './dsp.js';

const sat = clamp01;
const ROLLER_R = (spec.dyno.rollerDiameterIn / 2) * IN; // m
const TIRE_R = spec.tires.rollingRadiusIn * IN; // m, rolling radius

// ---------------------------------------------------------------- constants (source and confidence in the comments)
export const FIRING_ORDER = [1, 2, 7, 8, 4, 5, 6, 3]; // confirmed: LLY service manual / task brief
export const CYLINDERS = spec.engine.cylinders;
export const IDLE_RPM = spec.engine.idleRpm; // confirmed: DS 680 rpm
export const GOVERNOR_RPM = spec.engine.governorRpm; // confirmed: 3,200
export const TURBO_BLADES = 11; // task brief: compressor wheel blade count (full blades, VGT compressor)
export const WHISTLE_DIV = 16; // the true blade pass (6.6 kHz at 36k rpm) is shifted down four octaves into the audible whistle band
export const STARTER_RING_TEETH = 130; // estimated: flexplate ring gear teeth, sets the starter gear-mesh whine (rpm * teeth / 60)
export const TIMING_GEAR_TEETH = 28; // estimated: crank gear teeth for the mechanical whine at high rpm
export const FAN_BLADES = 9; // estimated: factory clutch fan
export const TIRE_TREAD_ELEMENTS = 60; // estimated: tread pitch elements around the LT245/75R16E tire
export const BEARING_ORDER = 7.1; // estimated: outer-race ball-pass order of the roller bearings (about 0.44 x 16 balls)

// ---------------------------------------------------------------- state defaults
export const DEFAULT_STATE = Object.freeze({
  running: false, cranking: false, rpm: 0, load: 0, qty: 0, turboRpm: undefined, vane: 0.4, boostPsi: 0, mAir: undefined,
  driveKpa: 101.3, smoke: 0, coolantF: 190, fanDuty: 0, rollerRad: 0, tccLocked: false, cpSlipRpm: 0,
  fail: { turbo: false, headGasket: false, piston: false, transmission: false }, doorsOpenCount: 0, wtsOn: false,
  shopFan: false, exhaustHose: false, hoodOpen: false, keyChime: false,
});
export const DEFAULT_LISTENER = Object.freeze({ x: 0, y: 1.65, z: 0, inCab: false, doorOpen: false, distanceToTruck: 6, distanceToDyno: 6, pan: 0 });

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function normalizeState(st = {}) {
  const s = { ...DEFAULT_STATE, ...st };
  s.fail = { ...DEFAULT_STATE.fail, ...(st.fail || {}) };
  s.running = !!s.running; s.cranking = !!s.cranking;
  s.rpm = Math.max(0, num(s.rpm, 0));
  s.load = clamp01(num(s.load, 0));
  s.qty = Math.max(0, num(s.qty, 0));
  s.vane = clamp01(num(s.vane, 0.4));
  s.boostPsi = num(s.boostPsi, 0);
  s.driveKpa = num(s.driveKpa, 101.3);
  s.smoke = clamp01(num(s.smoke, 0));
  s.coolantF = num(s.coolantF, 190);
  s.fanDuty = clamp01(num(s.fanDuty, 0));
  s.rollerRad = Math.max(0, num(s.rollerRad, 0));
  s.cpSlipRpm = Math.max(0, num(s.cpSlipRpm, 0));
  s.doorsOpenCount = Math.max(0, num(s.doorsOpenCount, 0));
  // when the integrator omits the air path, fall back to a plausible value from rpm and load so something sane is heard
  const rN = clamp01(s.rpm / GOVERNOR_RPM);
  s.turboRpm = Math.max(0, num(st.turboRpm, s.running ? 16000 + 55000 * s.load * rN : 0));
  s.mAir = Math.max(0, num(st.mAir, s.running ? 0.04 + 0.22 * rN * (0.3 + 0.7 * s.load) : 0));
  return s;
}

export function normalizeListener(l = {}) {
  const o = { ...DEFAULT_LISTENER, ...l };
  o.inCab = !!o.inCab; o.doorOpen = !!o.doorOpen;
  o.distanceToTruck = Math.max(0, num(o.distanceToTruck, 6));
  o.distanceToDyno = Math.max(0, num(o.distanceToDyno, 6));
  o.pan = clamp(num(o.pan, 0), -1, 1);
  return o;
}

// ---------------------------------------------------------------- engine
// Firing frequency of a 4-stroke engine: each cylinder fires once per two revolutions.
export const firingHz = (rpm, cylinders = CYLINDERS) => (rpm / 60) * (cylinders / 2);

// Cold factor, 0 warm to 1 cold: the manual says 'your engine will sound louder when it's cold'. Ignition delay is longer
// with cold air and cold walls, so more fuel burns in the premixed phase and the knock is harder.
export const coldFactor = (coolantF) => 1 - smoothstep(40, 180, coolantF);

// Thinning: the scheduler is allowed at most maxHz noise grains per second to stay within the node budget. Above that rate
// only every n-th firing gets its own grain and the continuous roar layer fills in the rest.
export const thinFactor = (hz, maxHz = 60) => Math.max(1, Math.ceil(hz / maxHz));

// level of the discrete knock grains (linear gain of the combustion bus)
export function combustionGain({ rpm, load, qty, cold, catchEnv = 0 }) {
  const rN = clamp(rpm / GOVERNOR_RPM, 0, 1.1), f = fuelEffort(load, qty);
  return 0.62 * (0.55 + 0.45 * rN) * (0.7 + 0.6 * f) * (1 + 0.35 * cold) * (1 + 1.8 * catchEnv);
}
// 0..1 combination of throttle load and injected quantity (mm3/stroke, about 80 at the stock peak)
export const fuelEffort = (load, qty) => clamp01(0.55 * load + 0.45 * clamp01(qty / 80));

// ---------------------------------------------------------------- turbo
export const turboBladePassHz = (turboRpm) => (turboRpm / 60) * TURBO_BLADES; // physical, mostly ultrasonic

// Whistle pitch. Exactly proportional to the modeled shaft speed (blade pass / 16), with a soft floor at 300 Hz so the
// slowest spin still falls inside the specified 300-2,500 Hz band: 36k rpm -> 416 Hz, 130k rpm -> 1,490 Hz.
export function turboWhistleHz(turboRpm) {
  const x = turboBladePassHz(Math.max(0, turboRpm)) / WHISTLE_DIV, d = x - 300;
  return clamp(300 + 0.5 * (d + Math.sqrt(d * d + 1600)), 300, 2500);
}

// Whistle loudness from the physics: shaft speed (tip Mach number), airflow, boost and drive pressure, and vane closure.
// Closed vanes accelerate the exhaust through narrow nozzle passages, so for the same flow the siren is louder.
export function turboWhistleGain({ turboRpm = 0, mAir = 0, vane = 0.4, boostPsi = 0, driveKpa = 101.3 } = {}) {
  const s = sat((turboRpm - 8000) / (135000 - 8000));
  const speedT = Math.pow(s, 0.9);
  const flowT = 0.30 + 0.70 * sat(mAir / 0.30);
  const vaneT = 0.55 + 0.90 * sat(vane);
  const driveT = 0.75 + 0.50 * sat((driveKpa - 100) / 250);
  const boostT = 0.85 + 0.30 * sat(boostPsi / 30);
  return 0.42 * speedT * flowT * vaneT * driveT * boostT;
}
// siren share of the whistle: narrowband noise around the blade-pass tone, stronger with closed vanes and drive pressure
export const sirenAmount = (vane, driveKpa) => clamp01(0.15 + 0.85 * Math.pow(sat(vane), 1.5) * sat((driveKpa - 101.3) / 250));
// narrower (more tonal) the more closed the vanes are
export const sirenQ = (vane) => 6 + 34 * Math.pow(sat(vane), 1.2);

export const intakeHissGain = (mAir) => 0.16 * (1 - Math.exp(-Math.pow(Math.max(0, mAir) / 0.16, 1.5)));
export const intakeHissHz = (mAir) => 3000 + 4500 * sat(mAir / 0.30);
export function exhaustHissGain(driveKpa, mAir) {
  const pr = clamp((driveKpa - 101.3) / 300, 0, 1.5);
  return 0.10 * pr * (0.35 + 0.65 * (1 - Math.exp(-Math.max(0, mAir) / 0.15)));
}

// ---------------------------------------------------------------- space: distance, cab, doors, pan
export const distanceGain = (d) => (d <= 1.5 ? 1 : 1 / (1 + 0.45 * (d - 1.5)));
export const airLpHz = (d) => 18000 / (1 + Math.max(0, d) / 10);

export function spatialMix(L, st) {
  const open = L.inCab ? sat((L.doorOpen ? 1 : 0) + 0.3 * st.doorsOpenCount) : 1;
  const dT = L.distanceToTruck, dD = L.distanceToDyno;
  const base = (d, cabGain) => (L.inCab
    ? { gain: cabGain * (0.85 + 0.15 * open), lp: 1100 + 2500 * open }
    : { gain: distanceGain(d), lp: airLpHz(d) });
  // one-shots apply their own per-event distance gain, so outside the cab the world chain passes them unchanged
  const truck = base(dT, 0.40), dyno = base(dD, 0.30), world = L.inCab ? base(0, 0.5) : { gain: 1, lp: 20000 };
  if (!L.inCab && st.hoodOpen) { truck.gain *= 1.3; truck.lp = Math.min(20000, truck.lp * 1.2); }
  const dist = Math.min(dT, dD);
  return {
    cab: L.inCab, open,
    truck, dyno, world,
    bassDb: L.inCab ? 6 * (1 - 0.6 * open) : 0, // cab is bass heavy
    send: L.inCab ? 0.05 + 0.12 * open : Math.min(0.5, 0.22 + 0.02 * dist), // reverb send level
    pan: L.inCab ? 0 : clamp(L.pan * 0.6, -0.6, 0.6),
    turboCab: L.inCab ? 0.5 * (0.7 + 0.3 * open) : 1, // whistle softer in the cab
  };
}

// ---------------------------------------------------------------- everything at once
export function computeMix(stIn, lIn, extras = {}) {
  const st = normalizeState(stIn), L = normalizeListener(lIn), catchEnv = extras.catchEnv || 0;
  const on = st.running ? 1 : 0, rpm = st.rpm, rN = clamp(rpm / GOVERNOR_RPM, 0, 1.1);
  const f = fuelEffort(st.load, st.qty), cold = coldFactor(st.coolantF), fHz = firingHz(rpm), space = spatialMix(L, st);

  const engine = {
    on, firingHz: fHz, thin: thinFactor(fHz, extras.maxGrainHz || 60), cold,
    combGain: on * combustionGain({ rpm, load: st.load, qty: st.qty, cold, catchEnv }),
    growlGain: on * 0.05 * (0.3 + 0.7 * f) * (0.4 + 0.6 * rN) * (1 + 0.5 * cold),
    growlHz: 130 + 130 * f,
    roarGain: on * 0.10 * (0.8 * f + 0.1) * Math.pow(rN, 1.1) * (1 + 0.25 * st.smoke),
    roarHz: 450 + 900 * rN,
    whineGain: on * 0.05 * Math.pow(rN, 2.5) * (0.8 + 0.4 * cold),
    whineHz: (TIMING_GEAR_TEETH * rpm) / 60,
    exhGain: on * 0.08 * (0.35 + 0.65 * st.load) * (0.5 + 0.5 * rN) * (st.exhaustHose ? 0.6 : 1),
    exhLpHz: (160 + 900 * st.load * rN + 200 * rN) * (st.exhaustHose ? 0.5 : 1),
    exhOrders: [firingHz(rpm), (rpm / 60) * 2, rpm / 60, rpm / 120], // 4th, 2nd, 1st and half order of crank speed
    rumbleGain: on * 0.07 * (0.4 + 0.6 * st.load) * (0.3 + 0.7 * rN),
    hose: st.exhaustHose ? 1 : 0,
  };

  // transmission: pump / gear whine when failed, clutch groan under slip
  const trans = {
    whineGain: on * (0.05 * sat(st.cpSlipRpm / 300) + (st.fail.transmission ? 0.05 * (0.4 + 0.6 * st.load) : 0)),
    whineHz: 11 * Math.max(rpm, 300) / 60 * (st.fail.transmission ? 1.0 : 0.8),
  };
  const gasket = {
    bubbleGain: on * (st.fail.headGasket ? 0.05 + 0.05 * st.load : 0),
    hissGain: on * (st.fail.headGasket ? 0.02 + 0.02 * st.load : 0),
  };
  const piston = { slap: !!(st.running && st.fail.piston), slapGain: on * (st.fail.piston ? 0.55 + 0.3 * st.load : 0) };

  // turbo
  const failT = st.fail.turbo;
  let wG = turboWhistleGain(st), wHz = turboWhistleHz(st.turboRpm);
  const vane = st.vane, h2 = 0.2 + 0.35 * vane, h3 = 0.06 + 0.2 * vane;
  if (failT) { wG *= 0.45; wHz *= 0.82; }
  const norm = 1 / (1 + h2 + h3), sirenG = wG * 0.9 * sirenAmount(vane, st.driveKpa);
  const turbo = {
    on, whistleHz: wHz, whistleGain: on * wG, gains: [wG * norm * on, wG * norm * h2 * on, wG * norm * h3 * on],
    vibratoCents: failT ? 6 : 3, vibratoHz: 5.3, detuneCents: [0, 2.5, -3.5],
    flutterCents: failT ? 70 : 0, flutterHz: 21, flutterAmp: failT ? 0.5 * wG * on : 0,
    sirenHz: wHz, sirenQ: failT ? 3 : sirenQ(vane), sirenGain: on * sirenG * (failT ? 1.4 : 1),
    intakeGain: on * intakeHissGain(st.mAir), intakeHz: intakeHissHz(st.mAir),
    exhaustHissGain: on * exhaustHissGain(st.driveKpa, st.mAir) * (st.exhaustHose ? 0.6 : 1), exhaustHissHz: 1600 + 1200 * sat((st.driveKpa - 101.3) / 250),
    cab: space.turboCab,
  };

  // starter: Bendix pinion meshing the flexplate ring gear. Mesh whine = ring teeth * engine rev rate; the armature spins
  // about 14.4 * 3.8 faster (ring/pinion and planetary reduction). Compression strokes make it lug at the firing rate.
  const crank = st.cranking && !st.running;
  const crankRpm = Math.max(rpm, 60);
  const starter = {
    gain: crank ? 0.16 * (1 - 0.5 * smoothstep(300, 520, rpm)) : 0,
    meshHz: (STARTER_RING_TEETH * crankRpm) / 60, armHz: (crankRpm / 60) * 14.4 * 3.8 * 0.5,
    lugHz: firingHz(crankRpm), lugDepth: crank ? 0.35 : 0,
    thumpGain: st.running ? 0 : crank ? 0.55 : (rpm > 15 ? 0.25 : 0), // compression pulse grain level (also the spin-down after key-off)
  };

  // cooling fan: clutch roar (broadband swish) plus the blade-pass tone
  const fanRpm = rpm * 0.85 * st.fanDuty;
  const fan = {
    noiseGain: on * 0.16 * Math.pow(st.fanDuty, 1.5) * (0.35 + 0.65 * rN), noiseHz: 380 + 700 * rN,
    toneGain: on * 0.05 * st.fanDuty * st.fanDuty * Math.pow(rN, 1.5), toneHz: (FAN_BLADES * fanRpm) / 60,
  };
  const shopFan = { gain: st.shopFan ? 0.28 : 0 };

  // dyno rollers: steel drums + tires. Rollers spin at rollerRad rad/s; the tire hum is the tread-element pass frequency.
  const v = st.rollerRad * ROLLER_R, fr = st.rollerRad / (2 * Math.PI), vN = sat(v / 40);
  const roller = {
    rpm: (st.rollerRad * 60) / (2 * Math.PI), surfaceSpeed: v, rotHz: fr,
    rumbleHz: Math.max(fr, 0.1), rumbleGain: 0.10 * Math.pow(vN, 1.5),
    bearingHz: clamp(BEARING_ORDER * fr, 20, 1200), bearingGain: 0.08 * Math.pow(vN, 1.2),
    tireHz: clamp((TIRE_TREAD_ELEMENTS * v) / (2 * Math.PI * TIRE_R), 20, 2500), tireGain: 0.03 * vN * vN, tireNoiseGain: 0.2 * vN * vN,
  };

  return { st, L, space, cold, engine, trans, gasket, piston, turbo, starter, fan, shopFan, roller };
}
