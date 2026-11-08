// Pure logic for the cab interior (no three.js, no DOM): gauge value -> needle angle mapping, needle damping,
// ignition key stepping, gear/DIC helpers. Unit tested in tests/interior.test.js.
import { spec } from '../../data/truckSpec.js';
import { KEY } from '../../sim/startSequence.js';

const C = spec.cluster;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---- gauge scales (physical value range comes from spec.cluster; sweep angles read from 01-dash-cluster-lit and IMG_2867) ----
// Angles are degrees clockwise from 12 o'clock at the needle pivot. a0 is the angle at v0, a1 at v1.
export const GAUGES = {
  speed:   { v0: 0,                 v1: C.speedoMaxMph,        a0: -108, a1: 108, unit: 'mph', tau: 0.10 },
  tach:    { v0: 0,                 v1: C.tachMaxRpm,          a0: -112, a1: 18,  unit: 'rpm', tau: 0.07 },
  volts:   { v0: C.voltRange[0],    v1: C.voltRange[1],        a0: -78,  a1: 78,  unit: 'V',   tau: 0.45 },
  coolant: { v0: C.coolantRangeF[0], v1: C.coolantRangeF[1],   a0: -75,  a1: 75,  unit: 'F',   tau: 1.4 },
  trans:   { v0: C.transTempRangeF[0], v1: C.transTempRangeF[1], a0: -95, a1: 10,  unit: 'F',   tau: 1.8 },
  oil:     { v0: C.oilPressureRangePsi[0], v1: C.oilPressureRangePsi[1], a0: -78, a1: 78, unit: 'psi', tau: 0.30 },
  fuel:    { v0: 0,                 v1: 1,                     a0: -62,  a1: 62,  unit: 'frac', tau: 2.2 },
};

// physical value -> needle angle (deg, clockwise from 12), clamped to the scale ends
export function needleAngle(gauge, value) {
  const g = GAUGES[gauge];
  const t = clamp((value - g.v0) / (g.v1 - g.v0), 0, 1);
  return g.a0 + (g.a1 - g.a0) * t;
}
// inverse: angle -> value (for tests and for drawing tick labels at the right place)
export function valueAtAngle(gauge, angle) {
  const g = GAUGES[gauge];
  return g.v0 + ((angle - g.a0) / (g.a1 - g.a0)) * (g.v1 - g.v0);
}

// Where the needle rests with the key off (below the scale: springs back to the stop)
export const REST = { speed: 0, tach: 0, volts: GAUGES.volts.v0, coolant: GAUGES.coolant.v0, trans: GAUGES.trans.v0, oil: 0, fuel: 0 };

// ---- needle dynamics: a damped spring (slightly underdamped for the fast gauges so they settle like a stepper-driven needle) ----
export function makeNeedle(gauge) { return { gauge, pos: REST[gauge], vel: 0 }; }
export function stepNeedle(n, target, dt) {
  const g = GAUGES[n.gauge];
  const tau = g.tau;
  const w = 1 / tau, zeta = tau < 0.2 ? 0.8 : 1.0; // fast gauges overshoot a touch, slow ones are critically damped
  const span = g.v1 - g.v0;
  // clamp the target to a hair beyond the scale (the needle bangs against the stop)
  const tg = clamp(target, g.v0 - span * 0.02, g.v1 + span * 0.02);
  let t = dt;
  while (t > 1e-6) {
    const h = Math.min(t, 0.005);
    const acc = w * w * (tg - n.pos) - 2 * zeta * w * n.vel;
    n.vel += acc * h; n.pos += n.vel * h; t -= h;
  }
  return n.pos;
}

// ---- start-up sweep: at key RUN the real cluster drives every needle to full scale and back (about 1.4 s) ----
export const SWEEP_SECONDS = 1.5;
// fraction of full scale the needles are commanded to at time t into the sweep (0..1), or null when finished
export function sweepFraction(t) {
  if (t < 0 || t >= SWEEP_SECONDS) return null;
  const up = 0.6;
  return t < up ? t / up : 1 - (t - up) / (SWEEP_SECONDS - up);
}

// ---- ignition key ----
export const KEY_NAMES = ['LOCK', 'ACCESSORY', 'RUN', 'START'];
// What one press of E does to the key: LOCK -> ACC -> RUN -> START (cranks until released/started) -> RUN.
// While the engine is already running the key does not go to START (the starter would grind): the next step is LOCK (off).
export function nextKeyPosition(pos, engineRunning = false) {
  if (pos === KEY.LOCK) return KEY.ACC;
  if (pos === KEY.ACC) return KEY.RUN;
  if (pos === KEY.RUN) return engineRunning ? KEY.LOCK : KEY.START;
  return KEY.RUN; // START springs back to RUN
}
// key twist angle of the lock cylinder in degrees (LOCK at 0, clockwise toward the driver)
export const KEY_TWIST = [0, 32, 64, 96];
export const keyTwist = (pos) => KEY_TWIST[clamp(pos | 0, 0, 3)];

// ---- gear selector ----
export const GEARS = ['P', 'R', 'N', 'D', '3', '2', '1'];
export const nextGear = (g, dir = 1) => GEARS[clamp(GEARS.indexOf(g) + dir, 0, GEARS.length - 1)];
// the cycle used by the single E-press interactable: P -> R -> N -> D -> P
export const cycleGear = (g) => ({ P: 'R', R: 'N', N: 'D', D: 'P' }[g] || 'P');

// ---- DIC ----
export const DIC_MESSAGES = ['TRANSMISSION HOT', 'REDUCED ENGINE POWER', 'ELEVATED IDLE ENABLED', 'ELEVATED IDLE DISABLED', 'WATER IN FUEL'];
export function odometerText(mi) { return `ODOMETER: ${String(Math.max(0, Math.floor(mi))).padStart(6, '0').replace(/^0+(?=\d)/, '')} MI`; }
export function engineHoursText(h) { return `ENGINE HOURS: ${h.toFixed(1)}`; }
export function tripText(mi) { return `TRIP: ${(Math.max(0, mi)).toFixed(1)} MI`; }

// what the cluster shows from the sim state (priority: warning message, otherwise the odometer page)
export function dicLine(state, page = 0) {
  if (state.dicMessage) return state.dicMessage;
  const pages = [odometerText(state.odometerMi || 0), tripText(state.tripMi || 0), engineHoursText(state.engineHours || 0)];
  return pages[((page % pages.length) + pages.length) % pages.length];
}

// default cluster state (key off, truck at rest)
export function defaultClusterState() {
  return {
    keyPos: 0, rpm: 0, mph: 0, coolantF: 70, transF: 70, oilPsi: 0, volts: 12.6, fuel: 0.62,
    lights: { waitToStart: false, checkEngine: false, tow: false, odOff: false, fourWd: false, waterInFuel: false, abs: false, brake: false, charge: false, oil: false, airbag: false, seatBelt: false, highBeam: false, turnL: false, turnR: false },
    dicMessage: '', gear: 'P', odometerMi: 193469, tripMi: 0, engineHours: 0,
  };
}

// bulb check: with the key in RUN (engine not yet running) the warning lights come on for a few seconds and the ones that
// are not part of a fault go out; this derives the lamp set the cluster actually shows from the sim flags
export function effectiveLights(state, t = 99) {
  const L = state.lights || {};
  const run = state.keyPos >= KEY.RUN;
  const engineRunning = (state.rpm || 0) > 400;
  const bulb = run && t < 3.2 && !engineRunning; // lamps are lit by the bulb check until the engine fires or time runs out
  return {
    waitToStart: run && !!L.waitToStart,
    checkEngine: run && (!!L.checkEngine || bulb || (state.keyPos === KEY.RUN && !engineRunning && t < 6)),
    abs: run && (!!L.abs || (bulb && t < 3)),
    brake: run && (!!L.brake || bulb),
    charge: run && (!!L.charge || (!engineRunning)),
    oil: run && (!!L.oil || (!engineRunning && (state.oilPsi || 0) < 5)),
    airbag: run && (!!L.airbag || t < 7),
    seatBelt: run && (!!L.seatBelt || t < 8),
    tow: run && !!L.tow, odOff: run && !!L.odOff, fourWd: run && !!L.fourWd, waterInFuel: run && !!L.waterInFuel,
    highBeam: run && !!L.highBeam, turnL: run && !!L.turnL, turnR: run && !!L.turnR,
    transHot: run && (state.transF || 0) >= spec.drivetrain.trans.hotWarningF,
  };
}
