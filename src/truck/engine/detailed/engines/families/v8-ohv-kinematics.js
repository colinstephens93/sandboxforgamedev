import { DEG, cycleAngle, strokeAtCycle, wrapSignedDeg } from '../../kinematics.js';

/** Bind all mechanical calculations to one engine entry.
 * Explicit entry calls always derive a fresh result, including for mutable fixtures.
 */
export function kinematicsFor(entry) {
  if (!entry) throw new TypeError('Engine entry is required');
  const spec = Object.freeze({
    name: entry.identity.name,
    rpo: entry.identity.code,
    displacementCc: entry.geometry.displacementCc,
    displacementCid: entry.geometry.displacementCid,
    configuration: entry.identity.configuration,
    boreMm: entry.geometry.boreMm,
    strokeMm: entry.geometry.strokeMm,
    crankRadiusMm: entry.geometry.crankRadiusMm,
    rodLengthMm: entry.geometry.rodLengthMm,
    boreStrokeRatio: entry.geometry.boreStrokeRatio,
    compressionRatio: entry.geometry.compressionRatio,
    firingOrder: entry.layout.firingOrder,
    idleRpm: entry.ratings.idleRpm,
    peakTorqueRpm: entry.ratings.peakTorqueRpm,
    peakHpRpm: entry.ratings.peakPowerRpm,
    redlineRpm: entry.ratings.redlineRpm,
    peakTorqueLbFt: entry.ratings.peakTorqueLbFt,
    peakHp: entry.ratings.peakHp,
    valvesPerCylinder: entry.valvetrain.valvesPerCylinder,
    totalValves: entry.valvetrain.totalValves,
    oilCapacityQt: entry.oil.capacityUsQt,
    massLb: entry.geometry.massLb,
    envelopeIn: entry.geometry.envelopeIn,
    assembly: entry.identity.assembly,
  });

  const calibrations = Object.freeze(Object.fromEntries(
    Object.entries(entry.ratings.calibrations).map(([key, calibration]) => [key, {
      id: calibration.id,
      label: calibration.label,
      shortLabel: calibration.shortLabel,
      peakTorqueLbFt: calibration.peakTorqueLbFt,
      peakHp: calibration.peakHp,
      maxRailPsi: calibration.maxRailPsi,
      compressionRatio: calibration.compressionRatio,
    }]),
  ));

  // Longitudinal station centers, front (+Z) to rear (−Z), in millimetres.
  const stationZ = entry.layout.stationZmm;
  const crankReferenceDeg = entry.layout.banks.find((bank) => bank.id === 'R').axisDeg;
  // Each bore is slightly offset fore/aft between banks to package paired rods.
  const bankZOffset = {
    R: entry.layout.banks.find((bank) => bank.id === 'R').bankOffsetZmm,
    L: entry.layout.banks.find((bank) => bank.id === 'L').bankOffsetZmm,
  };

  // Crank throw phase offsets (degrees) which place each bank's TDC on its
  // prescribed firing event while retaining a four-throw cross-plane crank.
  const stationThrowOffset = entry.layout.throwOffsetDeg;

  // Cylinder bank numbering is the production Duramax convention.
  //Looking forward from the flywheel (−Z) toward the front cover (+Z) with +Y up:
  // 1,3,5,7 = passenger (right-hand, −X) bank -> +45° Three.js Z rotation (135° polar axis)
  // 2,4,6,8 = driver (left-hand, +X) bank -> −45° Three.js Z rotation (45° polar axis)
  const cylinders = entry.layout.cylinders
    .map((cylinder) => ({
      number: cylinder.number,
      bank: cylinder.bank,
      station: cylinder.station,
      fireAngle: cylinder.fireAngleDeg,
      bankLabel: entry.layout.banks.find((bank) => bank.id === cylinder.bank).label,
    }))
    .map((cylinder) => {
      const bank = entry.layout.banks.find((candidate) => candidate.id === cylinder.bank);
      return {
        ...cylinder,
        id: `cyl-${cylinder.number}`,
        z: stationZ[cylinder.station] + bankZOffset[cylinder.bank],
        throwOffset: stationThrowOffset[cylinder.station],
        bankRotationDeg: bank.rotationDeg,
        bankAxisDeg: bank.axisDeg,
      };
    });

  const cylinderByNumber = new Map(cylinders.map((c) => [c.number, c]));
  const firingOrder = cylinders.slice().sort((a, b) => a.fireAngle - b.fireAngle).map((c) => c.number);
  const cylinderByStationBank = new Map(cylinders.map((c) => [`${c.station}${c.bank}`, c]));

  /**
   * World-space crank pin angle for a station.
   * At 0° crank rotation, station 0's pin is aligned with the right/passenger bank
   * (135° in world XY), producing cylinder 1 compression TDC, and rotates
   * clockwise when viewed from the front (+Z).
   */
  function pinWorldAngleDeg(cylinder, crankDeg) {
    return crankReferenceDeg - cylinder.throwOffset - crankDeg;
  }

  /**
   * Exact crank-slider solution in the bank plane.
   * Returns wrist-pin radial distance from the crank centre line.
   */
  function pistonKinematics(cylinder, crankDeg) {
    const pinAngle = pinWorldAngleDeg(cylinder, crankDeg) * DEG;
    const axisAngle = cylinder.bankAxisDeg * DEG;
    const relative = pinAngle - axisAngle;
    const along = spec.crankRadiusMm * Math.cos(relative);
    const lateral = spec.crankRadiusMm * Math.sin(relative);
    const wristY = along + Math.sqrt(spec.rodLengthMm ** 2 - lateral ** 2);
    // Orientation of a +Y aligned connecting rod in bank-local space.
    const rodAngle = Math.atan2(lateral, wristY - along);
    return {
      pinAngle,
      pinAlong: along,
      pinLateral: lateral,
      wristY,
      rodAngle,
      pistonTravelFromTdc: spec.crankRadiusMm + spec.rodLengthMm - wristY,
    };
  }

  function crankPinWorld(cylinder, crankDeg, radius = spec.crankRadiusMm) {
    const a = pinWorldAngleDeg(cylinder, crankDeg) * DEG;
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius, z: stationZ[cylinder.station] };
  }

  const valveTiming = {
    intake: {
      center: entry.valvetrain.timing.intake.centerDeg,
      duration: entry.valvetrain.timing.intake.durationDeg,
      lift: entry.valvetrain.timing.intake.liftMm,
    },
    exhaust: {
      center: entry.valvetrain.timing.exhaust.centerDeg,
      duration: entry.valvetrain.timing.exhaust.durationDeg,
      lift: entry.valvetrain.timing.exhaust.liftMm,
    },
  };

  /** Smooth cam-like valve lift (mm) for a four-stroke cycle angle (deg). */
  function valveLift(cycle, kind) {
    const spec = valveTiming[kind];
    const delta = wrapSignedDeg(cycle - spec.center, 720);
    if (Math.abs(delta) >= spec.duration / 2) return 0;
    const c = Math.cos((Math.PI * delta) / spec.duration);
    return Math.max(0, spec.lift * c * c);
  }

  function valveVelocity(cycle, kind) {
    const h = 0.35;
    return (valveLift(cycle + h, kind) - valveLift(cycle - h, kind)) / (2 * h);
  }

  function cylinderState(cylinder, crankDeg) {
    const cycle = cycleAngle(cylinder, crankDeg);
    const kin = pistonKinematics(cylinder, crankDeg);
    const intakeLift = valveLift(cycle, 'intake');
    const exhaustLift = valveLift(cycle, 'exhaust');
    const stroke = strokeAtCycle(cycle);
    const distanceToTdc = Math.min(cycle, 720 - cycle);
    const preTdc = cycle > 700 ? (cycle - 700) / 20 : 0;
    const postTdc = cycle < 30 ? 1 - cycle / 30 : 0;
    const injection = Math.max(
      cycle > 702 ? Math.sin(((cycle - 702) / 18) * Math.PI) : 0,
      cycle < 5 ? 1 - cycle / 5 : 0,
    );
    const combustion = cycle < 48 ? Math.pow(1 - cycle / 48, 1.7) : 0;
    const firing = distanceToTdc < 7;
    return {
      cylinder,
      crankAngle: crankDeg,
      cycle,
      stroke,
      intakeLift,
      exhaustLift,
      injection: Math.max(0, injection),
      combustion,
      firing,
      preTdc,
      postTdc,
      distanceToTdc,
      ...kin,
    };
  }

  /**
   * Active injection/firing event order for a given crank angle.
   * Used by the telemetry UI to light the sequence display.
   */
  function activeFiringCylinder(crankDeg) {
    let best = null;
    let bestCycle = Infinity;
    for (const c of cylinders) {
      const cycle = cycleAngle(c, crankDeg);
      const d = Math.min(cycle, 720 - cycle);
      if (d < bestCycle) {
        bestCycle = d;
        best = c;
      }
    }
    return { cylinder: best, phase: bestCycle };
  }

  return {
    spec,
    calibrations,
    stationZ,
    crankReferenceDeg,
    bankZOffset,
    stationThrowOffset,
    cylinders,
    cylinderByNumber,
    firingOrder,
    cylinderByStationBank,
    pinWorldAngleDeg,
    pistonKinematics,
    crankPinWorld,
    valveTiming,
    valveLift,
    valveVelocity,
    cylinderState,
    activeFiringCylinder,
    crankRadiusMm: spec.crankRadiusMm,
    rodLengthMm: spec.rodLengthMm,
    redlineRpm: spec.redlineRpm,
  };
}
