export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function mod(a, n) {
  return ((a % n) + n) % n;
}

export function wrapSignedDeg(angle, period = 720) {
  let a = mod(angle, period);
  if (a > period / 2) a -= period;
  return a;
}

/**
 * Four-stroke cycle in degrees after the compression/ignition TDC.
 * 0–180 power, 180–360 exhaust, 360–540 intake, 540–720 compression.
 */
export function cycleAngle(cylinder, crankDeg) {
  return mod(crankDeg - cylinder.fireAngle, 720);
}

export function strokeAtCycle(cycle) {
  if (cycle < 180) return 'POWER';
  if (cycle < 360) return 'EXHAUST';
  if (cycle < 540) return 'INTAKE';
  return 'COMPRESSION';
}

export const STROKE_COLORS = {
  POWER: '#ff9637',
  EXHAUST: '#8e8175',
  INTAKE: '#6bb5d8',
  COMPRESSION: '#d8c56b',
};

export function camshaftAngleDeg(crankDeg) {
  return crankDeg * 0.5;
}
