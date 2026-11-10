// Cross-checks between the places a real-world number appears: the spec file against itself (values that are derived
// from one another), the detailed LLY engine entry against the spec, and the engine's own geometry against its
// firing order. A failure here means two sources of the same fact have drifted apart.
import { describe, it, expect } from 'vitest';
import { spec } from '../src/data/truckSpec.js';
import entry from '../src/truck/engine/detailed/engines/lly/index.js';
import { kinematicsFor } from '../src/truck/engine/detailed/engines/families/v8-ohv-kinematics.js';
import { roofHeight, roofHalfWidth, hoodHeight, hoodHalfWidth, H, ST, S_FRONT, S_REAR, WB } from '../src/truck/skin.js';
import { HUB_HEIGHT_IN, DEFLECTION_IN } from '../src/truck/wheels.js';

describe('truckSpec is self-consistent', () => {
  const { dims: D, tires: T, engine: E } = spec;
  it('overall length is the wheelbase plus the two overhangs', () => {
    expect(D.frontOverhangIn + D.wheelbaseIn + D.rearOverhangIn).toBeCloseTo(D.lengthIn, 6);
    expect(S_REAR - S_FRONT).toBeCloseTo(D.lengthIn, 6);
  });
  it('tire diameter follows the size code and the rolling radius follows revolutions per mile', () => {
    const fromCode = (2 * T.sectionWidthMm * T.aspect + T.rimDiameterIn * 25.4) / 25.4;
    expect(Math.abs(fromCode - T.overallDiameterIn)).toBeLessThan(0.1);
    expect(63360 / (T.revsPerMile * 2 * Math.PI)).toBeCloseTo(T.rollingRadiusIn, 2);
    expect(T.rollingRadiusIn).toBeLessThan(T.overallDiameterIn / 2); // a loaded tire rolls on less than its free radius
    expect(T.boltPatternIn * 25.4).toBeCloseTo(T.boltPatternMm, 1);
  });
  it('the drawn hub height is the free tire radius less the loaded deflection', () => {
    expect(T.overallDiameterIn / 2 - DEFLECTION_IN).toBeCloseTo(HUB_HEIGHT_IN, 6);
  });
  it('displacement follows bore, stroke and cylinder count', () => {
    const litres = (Math.PI / 4) * (E.boreMm / 100) ** 2 * (E.strokeMm / 100) * E.cylinders;
    expect(litres).toBeCloseTo(E.displacementL, 1);
  });
  it('rated power and torque do not contradict each other', () => {
    // torque at the rated-power speed can not exceed the rated torque, and power at the torque peak is below rated power
    expect((E.ratedHp * 5252) / E.ratedHpRpm).toBeLessThan(E.ratedTorqueLbFt);
    expect((E.ratedTorqueLbFt * E.ratedTorqueRpm) / 5252).toBeLessThan(E.ratedHp);
    expect(E.idleRpm).toBeLessThan(E.ratedTorqueRpm);
    expect(E.ratedHpRpm).toBeLessThan(E.governorRpm);
    expect(E.governorRpm).toBeLessThanOrEqual(E.redlineRpm);
  });
  it('limits that appear twice agree, and each escalation is in order', () => {
    const L = spec.limits, X = spec.drivetrain.trans;
    expect(L.coolantHotF).toBe(E.coolantHotF);
    expect(E.thermostatOpenF).toBeLessThan(E.coolantNormalF);
    expect(E.coolantNormalF).toBeLessThan(L.coolantHotF);
    expect(L.coolantHotF).toBeLessThan(L.coolantOverheatF);
    expect(L.egtContinuousPreTurboF).toBeLessThan(L.egtPistonDamageF);
    expect(L.egtPistonDamageF).toBeLessThan(L.egtTurboDamageF);
    expect(L.cylPressureSoftPsi).toBeLessThan(L.cylPressureLiftPsi);
    expect(X.normalTempF[1]).toBeLessThan(L.transSumpMaxF);
    expect(X.protectionExitF).toBeLessThan(X.hotWarningF);
    expect(X.hotWarningF).toBeLessThan(L.transBurnF);
    expect(spec.turbo.peakBoostStockPsi).toBeLessThan(spec.turbo.boostMaxRecommendedPsi);
  });
  it('gauge faces can show the values the model produces', () => {
    const C = spec.cluster;
    expect(C.tachMaxRpm).toBeGreaterThan(E.redlineRpm);
    expect(C.coolantRangeF[0]).toBeLessThan(E.thermostatOpenF); expect(C.coolantRangeF[1]).toBeGreaterThan(spec.limits.coolantOverheatF);
    expect(C.transTempRangeF[1]).toBeGreaterThan(spec.limits.transBurnF);
    expect(C.oilPressureRangePsi[1]).toBeGreaterThan(E.oilPressureNormalMinPsi);
  });
});

describe('detailed LLY entry agrees with the truck spec', () => {
  const E = spec.engine, g = entry.geometry, r = entry.ratings;
  it('bore, stroke, displacement and cylinder count', () => {
    expect(g.boreMm).toBe(E.boreMm); expect(g.strokeMm).toBe(E.strokeMm);
    expect(g.crankRadiusMm).toBe(E.strokeMm / 2);
    expect(entry.layout.cylinders.length).toBe(E.cylinders);
    const cc = (Math.PI / 4) * (g.boreMm / 10) ** 2 * (g.strokeMm / 10) * E.cylinders;
    expect(cc).toBeCloseTo(g.displacementCc, 0);
    expect(g.displacementCc / 16.387064).toBeCloseTo(g.displacementCid, 0);
    expect(g.boreMm / g.strokeMm).toBeCloseTo(g.boreStrokeRatio, 2);
  });
  it('ratings of the Allison calibration, idle and redline', () => {
    const a = r.calibrations[r.defaultCalibration];
    expect(r.defaultCalibration).toBe('allison');
    expect(a.peakHp).toBe(E.ratedHp); expect(a.peakPowerRpm).toBe(E.ratedHpRpm);
    expect(a.peakTorqueLbFt).toBe(E.ratedTorqueLbFt); expect(a.peakTorqueRpm).toBe(E.ratedTorqueRpm);
    expect(r.idleRpm).toBe(E.idleRpm); expect(r.redlineRpm).toBe(E.redlineRpm);
    expect(entry.oil.capacityUsQt).toBe(E.oilCapacityQt);
    expect(entry.startSequence.crankRpm).toBe(spec.start.crankRpm);
    expect(entry.turbo.model).toContain('GT3788VA'); expect(spec.turbo.model).toContain('GT3788VA');
  });
  it('the illustrative torque curve passes through the rated points', () => {
    const pts = entry.curves.torque.points.allison;
    const at = (rpm) => pts.find((p) => p[0] === rpm)[1];
    expect(at(E.ratedTorqueRpm)).toBe(E.ratedTorqueLbFt);
    expect(Math.max(...pts.map((p) => p[1]))).toBe(E.ratedTorqueLbFt);
    expect((at(E.ratedHpRpm) * E.ratedHpRpm) / 5252).toBeCloseTo(E.ratedHp, 0);
    // rated power is the maximum of the curve, for both calibrations: no point past the peak may exceed it
    for (const [id, cal] of Object.entries(r.calibrations)) {
      const hp = entry.curves.torque.points[id].map((p) => (p[1] * p[0]) / 5252);
      expect(Math.max(...hp), id).toBeLessThan(cal.peakHp + 0.5);
      expect(hp[entry.curves.torque.points[id].findIndex((p) => p[0] === cal.peakPowerRpm)], id).toBeCloseTo(Math.max(...hp), 6);
    }
  });
});

describe('detailed LLY kinematics', () => {
  const K = kinematicsFor(entry);
  const R = entry.geometry.crankRadiusMm, L = entry.geometry.rodLengthMm;
  it('firing order is 1-2-7-8-4-5-6-3 at even 90 degree intervals, derived from the per-cylinder angles', () => {
    expect(K.firingOrder).toEqual([1, 2, 7, 8, 4, 5, 6, 3]);
    expect(K.firingOrder).toEqual(entry.layout.firingOrder);
    const angles = K.firingOrder.map((n) => K.cylinderByNumber.get(n).fireAngle);
    expect(angles).toEqual([0, 90, 180, 270, 360, 450, 540, 630]);
  });
  it('odd cylinders are on the passenger bank and even on the driver bank, numbered front to rear', () => {
    for (const c of K.cylinders) expect(c.bank).toBe(c.number % 2 ? 'R' : 'L');
    for (const bank of ['R', 'L']) {
      const z = K.cylinders.filter((c) => c.bank === bank).sort((a, b) => a.number - b.number).map((c) => c.z);
      for (let i = 1; i < z.length; i++) expect(z[i]).toBeLessThan(z[i - 1]); // front is +Z in the model
    }
  });
  it('every piston is exactly at top dead centre at its own firing angle, and at the bottom 180 degrees later', () => {
    for (const c of K.cylinders) {
      const tdc = K.pistonKinematics(c, c.fireAngle), bdc = K.pistonKinematics(c, c.fireAngle + 180);
      expect(tdc.pistonTravelFromTdc).toBeCloseTo(0, 9); expect(tdc.wristY).toBeCloseTo(R + L, 9);
      expect(bdc.pistonTravelFromTdc).toBeCloseTo(entry.geometry.strokeMm, 9);
      expect(K.cylinderState(c, c.fireAngle).stroke).toBe('POWER');
      expect(K.cylinderState(c, c.fireAngle + 719.9).stroke).toBe('COMPRESSION');
    }
  });
  it('piston travel matches the closed-form crank-slider equation', () => {
    const c = K.cylinderByNumber.get(1);
    for (const deg of [10, 45, 90, 137, 180, 263, 359]) {
      const th = (deg * Math.PI) / 180;
      const x = R * (1 - Math.cos(th)) + L - Math.sqrt(L * L - (R * Math.sin(th)) ** 2);
      expect(K.pistonKinematics(c, deg).pistonTravelFromTdc).toBeCloseTo(x, 9);
    }
    // a finite rod puts the piston past mid-stroke at 90 degrees
    expect(K.pistonKinematics(c, 90).pistonTravelFromTdc).toBeGreaterThan(entry.geometry.strokeMm / 2);
  });
  it('the two rods on one crank pin belong to cylinders that fire 90 degrees apart, and the crank is cross-plane', () => {
    for (let s = 0; s < 4; s++) {
      const r = K.cylinderByStationBank.get(`${s}R`), l = K.cylinderByStationBank.get(`${s}L`);
      expect(((l.fireAngle - r.fireAngle) % 360 + 360) % 360).toBe(90);
    }
    expect(entry.layout.throwOffsetDeg.slice().sort((a, b) => a - b)).toEqual([0, 90, 180, 270]);
  });
  it('valves are shut through compression and the power stroke, and only one cylinder is at firing TDC at a time', () => {
    for (const cyc of [570, 600, 700, 0, 60, 120]) { expect(K.valveLift(cyc, 'intake')).toBe(0); expect(K.valveLift(cyc, 'exhaust')).toBe(0); }
    expect(K.valveLift(entry.valvetrain.timing.intake.centerDeg, 'intake')).toBeCloseTo(entry.valvetrain.timing.intake.liftMm, 9);
    for (let deg = 0; deg < 720; deg += 90) expect(K.cylinders.filter((c) => K.cylinderState(c, deg).firing).length).toBe(1);
  });
});

describe('body skin surfaces', () => {
  it('the roof reaches the spec height on the centreline and never exceeds it', () => {
    let top = 0;
    for (let s = 44; s <= ST.cabBack; s += 0.5) for (let x = 0; x <= roofHalfWidth(s); x += 0.5) top = Math.max(top, roofHeight(s, x));
    expect(top).toBeCloseTo(spec.dims.heightIn, 6);
    expect(H.roof).toBe(spec.dims.heightIn);
  });
  it('the roof is crowned with no crease: height falls smoothly from the centre to the edge', () => {
    for (const s of [50, 60, 80, 100, 106]) {
      const hw = roofHalfWidth(s), n = 200, h = [];
      for (let i = 0; i <= n; i++) h.push(roofHeight(s, (hw * i) / n));
      for (let i = 1; i <= n; i++) expect(h[i]).toBeLessThan(h[i - 1]); // strictly falling: no flat cap
      // second difference stays small everywhere: a crease would show as one large step in slope
      let worst = 0; for (let i = 1; i < n; i++) worst = Math.max(worst, Math.abs(h[i + 1] - 2 * h[i] + h[i - 1]));
      expect(worst).toBeLessThan(0.002);
    }
  });
  it('the hood rises from its leading edge to the cowl and is symmetric', () => {
    let prev = -Infinity;
    for (let s = ST.hoodFront; s <= ST.cowl; s += 1) { const h = hoodHeight(s, 0); expect(h).toBeGreaterThan(prev); prev = h; }
    for (const s of [-25, -5, 15]) expect(hoodHeight(s, 7)).toBe(hoodHeight(s, -7));
    expect(hoodHalfWidth(0)).toBeLessThan(spec.dims.widthIn / 2);
    expect(ST.axleR).toBe(WB);
  });
});
