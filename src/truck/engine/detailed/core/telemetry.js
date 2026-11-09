function interpolate(points, rpm, interp) {
  for (let i = 1; i < points.length; i++) {
    if (rpm <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const t = (rpm - x0) / (x1 - x0);
      const s = interp === 'linear' ? t : t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * s;
    }
  }
  return null;
}

export function torqueAtRpm(engine, rpm, calibration) {
  const curve = engine.curves.torque;
  if (rpm < curve.zeroBelowRpm) return 0;
  const points = curve.points[calibration];
  const value = interpolate(points, Math.max(0, rpm), curve.interp);
  return value === null ? points[points.length - 1][1] : value;
}

export function horsepowerAtRpm(engine, rpm, calibration) {
  return (torqueAtRpm(engine, rpm, calibration) * rpm) / 5252;
}

export function railPressureAtRpm(engine, rpm, calibration) {
  const curve = engine.curves.rail;
  if (rpm < curve.zeroBelowRpm) return 0;
  const scale = engine.ratings.calibrations[calibration].maxRailPsi / curve.scaleTo;
  const value = interpolate(curve.points, rpm, curve.interp);
  return (value === null ? curve.scaleTo : value) * scale;
}

export function boostAtRpm(engine, rpm) {
  const curve = engine.curves.boost;
  if (rpm < curve.zeroBelowRpm) return 0;
  const value = interpolate(curve.points, rpm, curve.interp);
  return value === null ? curve.points[curve.points.length - 1][1] : value;
}

export function vaneAtRpm(engine, rpm) {
  const curve = engine.curves.vane;
  if (rpm < curve.zeroBelowRpm) return 0;
  if (rpm <= curve.points[0][0]) return curve.points[0][1];
  const value = interpolate(curve.points, rpm, curve.interp);
  const result = value === null ? curve.points[curve.points.length - 1][1] : value;
  return curve.round ? Math.round(result) : result;
}

export function egtAtRpm(engine, rpm) {
  const curve = engine.curves.egt;
  if (rpm < curve.belowRpm) return curve.belowValue;
  return Math.round(curve.base + curve.span * Math.pow(Math.min(1, rpm / curve.atRpm), curve.exponent));
}

export function oilPressureAtRpm(engine, rpm) {
  const curve = engine.curves.oil;
  if (rpm < curve.zeroBelowRpm) return 0;
  return Math.round(curve.base + curve.span * Math.min(1, rpm / curve.atRpm));
}

export function coolantAtRpm(engine, rpm) {
  const curve = engine.curves.coolant;
  return Math.round(curve.base + Math.min(1, rpm / curve.atRpm) * curve.span);
}

export function telemetryValues(engine, { firing, rpm, calibration }) {
  const gates = engine.telemetry.gates;
  const notFiring = engine.telemetry.notFiring;
  const torque = firing && rpm > gates.torqueHpMinRpm
    ? torqueAtRpm(engine, rpm, calibration)
    : 0;
  const hp = firing && rpm > gates.torqueHpMinRpm
    ? horsepowerAtRpm(engine, rpm, calibration)
    : 0;
  const rail = !gates.railRequiresFiring || firing
    ? railPressureAtRpm(engine, rpm, calibration)
    : 0;
  const boost = !gates.boostRequiresFiring || firing
    ? Math.min(engine.curves.boost.capPsi, boostAtRpm(engine, rpm))
    : 0;
  const vane = rpm > gates.vaneMinRpm ? vaneAtRpm(engine, rpm) : 0;
  const egt = firing
    ? egtAtRpm(engine, rpm)
    : gates.egtRequiresFiring
      ? notFiring.egtBase + Math.max(0, rpm) * notFiring.egtPerRpm
      : egtAtRpm(engine, rpm);
  const oil = !gates.oilRequiresFiring || firing
    ? oilPressureAtRpm(engine, rpm)
    : 0;
  const coolant = rpm > gates.coolantMinRpm
    ? coolantAtRpm(engine, rpm)
    : notFiring.coolant;
  return { torque, hp, rail, boost, vane, egt, oil, coolant, firing };
}
