// =============================================================================
// truckSpec.js: the single source of real-world numbers for the Duramax Dyno Shop.
//
// Rules (PROMPT.md section 0):
//  * Every leaf value carries a trailing comment:  // <confirmed|estimated> : <source>
//  * Values are kept in the source units (in, ft, lb, hp, lb-ft, psi, degF) and converted in code
//    with the helpers exported below. The model uses meters.
//  * Nothing here is invented silently: anything unverified is `estimated` and is also listed in ACCURACY.md.
//  * tests/spec.test.js enforces the comment-tag rule on every numeric/array leaf line.
//
// Source keys used in comments:
//   OM    = 2005 Chevrolet Silverado owner's manual (assets.gm.com/manuals/chevrolet/2005_chevrolet_silverado_owners.pdf)
//   DS    = 2005 Duramax diesel supplement, GM part 15101364 (reference/manuals/)
//   PLC   = door tire/loading placard in reference/IMG_2858.jpeg
//   OWN   = confirmed by the owner (PROMPT.md / reference/tuning/README.md)
//   RES   = docs/research/facts.md (research agent, with URLs there)
// =============================================================================

// ---- unit helpers (meters, kilograms, newtons, pascals) ----
export const IN = 0.0254;
export const FT = 0.3048;
export const LB = 0.45359237;
export const LBF = 4.4482216;
export const LBFT = 1.3558179; // N*m per lb-ft
export const HP = 745.69987; // W per mechanical hp
export const PSI = 6894.757; // Pa per psi
export const GAL = 0.003785412; // m3 per US gal
export const MPH = 0.44704;
export const degFtoC = (f) => (f - 32) * (5 / 9);
export const degCtoF = (c) => c * (9 / 5) + 32;
export const RPM = (2 * Math.PI) / 60; // rad/s per rpm
export const HP_CONST = 5252; // hp = torque(lb-ft) * rpm / 5252 (5252.11)

export const spec = {
  identity: {
    year: 2005, // confirmed: owner
    make: 'Chevrolet', // confirmed: owner
    model: 'Silverado 2500HD', // confirmed: owner
    trim: 'LT', // confirmed: owner
    cab: 'Crew Cab', // confirmed: owner
    boxLengthFt: 6.5, // confirmed: owner (6.5 ft short box)
    drive: '4WD', // confirmed: owner
    color: 'Summit White', // confirmed: owner
    engine: '6.6L Duramax LLY (VIN code 2)', // confirmed: DS (VIN code 2 = 6.6L V8 Turbo Diesel)
    transmission: 'Allison 1000, 5-speed', // confirmed: owner
    bodyStyle: 'GMT800 Classic (2003-2007)', // confirmed: owner
    gvwrLb: 9200, // confirmed: PLC (IMG_2858 placard, GVWR 4173 kg = 9,200 lb)
    gawrFrontLb: 4670, // confirmed: PLC
    gawrRearLb: 6084, // confirmed: PLC
  },

  // ---------- body dimensions (inches, source units) ----------
  dims: {
    wheelbaseIn: 153.0, // confirmed: owner (crew cab short box; 8 ft box is 167.0 in)
    widthIn: 79.7, // confirmed: owner (without mirrors)
    heightIn: 77.0, // estimated: owner "about 77 in" and autopadre 2005 HD crew cab LT 4WD, single source (RES item 1)
    lengthIn: 237.3, // estimated: autopadre 2005 HD crew cab LT, one source; consistent with 153 in wheelbase + about 84 in of overhangs (RES item 1)
    frontOverhangIn: 38.5, // estimated: derived 237.3 - 153.0 = 84.3 in split front/rear, checked against IMG_2851
    rearOverhangIn: 45.8, // estimated: derived (includes the rear bumper), checked against IMG_2851
    trackFrontIn: 68.6, // estimated: Auto Channel 2005 2500HD 4x4 crew cab listing (RES item 1)
    trackRearIn: 66.0, // estimated: Auto Channel 2005 2500HD 4x4 crew cab listing (RES item 1)
    groundClearanceIn: 9.1, // estimated: autopadre front axle 9.1 in, listings conflict up to 10.6 in (RES item 1)
    curbWeightLb: 6350, // estimated: Duramax/Allison 4WD crew cab short box, derived from listings 6,049-6,131 lb plus diesel (RES item 1)
    frontWeightFraction: 0.57, // estimated: front-heavy diesel truck (RES item 1)
    cabLengthIn: 80.0, // estimated: crew cab firewall to rear cab wall from side photos
    bedInsideLengthIn: 78.7, // estimated: GMT800 6 ft 6 in box convention (RES item 1)
    bedInsideWidthIn: 66.0, // estimated: GMT800 box inside width about 66 in
    bedBetweenWheelWellsIn: 50.0, // confirmed: Auto Channel + carspecs.us (RES item 1)
    bedSideHeightIn: 20.0, // estimated: cars.com 2005 2500 listing (RES item 1)
    bedRailHeightFromGroundIn: 55.0, // estimated: photos IMG_2851 against the 30.5 in tire
    tailgateHeightFromGroundIn: 38.0, // estimated: photos IMG_2855 (tailgate down) against tire
    stepInHeightIn: 22.0, // estimated: IMG_2868 rocker/sill height of 4WD HD
    doorHandleHeightIn: 45.0, // estimated: photos IMG_2851, handle about at beltline of 76 in tall body
    hoodGapMm: 4.5, // estimated: PROMPT.md section 1 (about 4-5 mm panel gaps)
    panelGapMm: 4.5, // estimated: PROMPT.md section 1
  },

  tires: {
    size: 'LT245/75R16E', // confirmed: PLC, 06-stock-wheel-tire
    sectionWidthMm: 245, // confirmed: size code
    aspect: 0.75, // confirmed: size code
    rimDiameterIn: 16, // confirmed: PLC (16x6.5J)
    rimWidthIn: 6.5, // confirmed: PLC
    frontPsi: 55, // confirmed: PLC (380 kPa)
    rearPsi: 80, // confirmed: PLC (550 kPa)
    lugs: 8, // confirmed: owner
    boltPatternIn: 6.5, // confirmed: owner (8 x 165.1 mm)
    boltPatternMm: 165.1, // confirmed: owner
    wheelNutTorqueLbFt: 140, // confirmed: OM
    // Overall diameter from the size code: 2*245*0.75 + 16*25.4 = 773.9 mm = 30.47 in (nominal, new tire)
    // loaded rolling radius is lower; ratio from the usual 0.96 for LT truck tires
    overallDiameterIn: 30.5, // confirmed: Michelin LTX M/S2 LT245/75R16 via tiresize.com + tires-easy.com (RES item 9)
    revsPerMile: 683, // confirmed: tiresize.com + level4x4 (RES item 9)
    rollingRadiusIn: 14.76, // estimated: derived 63,360 / (683 x 2 pi), used for wheel speed and gearing (RES item 9)
    loadRatingLb: 3042, // confirmed: tires-easy listing, 120/116R at 80 psi (RES item 9)
    treadDepthMm: 11, // estimated: new LT highway tire about 11-13 mm
  },

  drivetrain: {
    axleRatio: 3.73, // confirmed: OM (only ratio listed for the 6.6L diesel K2500 crew cab short box HD)
    trans: {
      gears: [3.1, 1.81, 1.41, 1.0, 0.71], // confirmed: owner (Allison 1000 5-speed forward ratios)
      reverse: 4.49, // confirmed: owner
      // Torque converter: stall behavior is an estimate (see ACCURACY.md)
      converterStallRpm: 1500, // estimated: factory-stall units listed 1,300-1,500 rpm (ATS listing, RES item 3)
      converterStallTorqueRatio: 1.8, // estimated: sources conflict 1.25 to 2.0 (RES item 3)
      lockupRpmMin: 1150, // estimated: converter lockup in 3rd/4th/5th at part throttle (RES)
      normalTempF: [180, 200], // confirmed: OM (normal transmission temperature)
      hotWarningF: 265, // confirmed: OM (TRANSMISSION HOT)
      protectionExitF: 260, // confirmed: PROMPT.md / OM (protection until below 260 F)
      capacityLbFtInput: 565, // estimated: DieselHub lists 565 lb-ft input for 2005 (520 for 2001-2004); conflicts with the 605 lb-ft engine rating (RES item 3)
    },
    transferCase: '2-speed electronic 4WD', // estimated: GMT800 2500HD 4WD NP-261; wording only
    driveLossRange: [0.15, 0.2], // confirmed: PROMPT.md (about 15 to 20 percent, 4WD automatic)
    driveLossNominal: 0.175, // estimated: midpoint of the range above, used by the model
    drivelineInertiaKgM2: 9.0, // estimated: two 45 kg wheel/tire assemblies about 7.8 kg m^2 plus axle and driveshaft referred to the wheels (derived, RES item 10 method)
  },

  // ---------- engine ratings and geometry ----------
  engine: {
    code: 'LLY', // confirmed: DS (VIN code 2)
    displacementL: 6.6, // confirmed: DS
    cylinders: 8, // confirmed: DS (V8)
    boreMm: 103, // confirmed: 4.055 in, GM Authority + DieselHub (RES item 6)
    strokeMm: 99, // confirmed: 3.897 in, GM Authority + XtremeDiesel (RES item 6)
    compressionRatio: 17.5, // estimated: DieselHub + Diesel Army say 17.5:1 for 2004.5-2005, 16.8:1 is cited for the 2006 LLY; conflict logged in ACCURACY.md (RES item 6)
    ratedHp: 310, // confirmed: owner/PROMPT.md (published rating, Allison)
    ratedHpRpm: 3000, // confirmed: PROMPT.md
    ratedTorqueLbFt: 605, // confirmed: PROMPT.md (Allison-equipped)
    ratedTorqueRpm: 1600, // confirmed: PROMPT.md
    governorRpm: 3200, // confirmed: PROMPT.md (falling torque toward the governor near 3,200 rpm)
    redlineRpm: 3250, // estimated: governed region, tach dashed zone start in 01-dash-cluster-lit
    idleRpm: 680, // confirmed: DS (normal idle 680 rpm)
    elevatedIdleRpm: 1200, // confirmed: DS (elevated idle 680 to 1,200 rpm)
    oilPressureNormalMinPsi: 80, // confirmed: DS (above 80 psi is normal especially when cold)
    coolantCapacityQt: 24.0, // confirmed: DS
    oilCapacityQt: 10.0, // confirmed: DS (engine oil with filter)
    fuelTankGal: 26.0, // confirmed: OM (short bed)
    thermostatOpenF: 187, // estimated: start-to-open about 180-190 F (RES item 6)
    coolantNormalF: 205, // estimated: typical running coolant temperature on a stock LLY
    coolantHotF: 235, // estimated: GM gauge hot-zone onset/overheat warning region
    heatingValueMjKg: 42.8, // confirmed: typical No. 2 diesel lower heating value (physical constant, generic reference)
    dieselDensityGPerL: 832, // estimated: typical No. 2 diesel
    stoichAfr: 14.5, // confirmed: typical diesel stoichiometric air-fuel ratio
    glowPlugs: 'fast warm-up', // confirmed: DS
  },

  // ---------- start sequence (DS, 2005 Duramax diesel supplement) ----------
  start: {
    waitToStartSecondsCold: 2.2, // estimated: "much shorter than most diesels" (DS); typical fast glow plug about 2-3 s
    waitToStartSecondsMild: 1.2, // estimated: shorter when warm (DS: may not come on with a hot engine)
    waitToStartMaxCoolantF: 150, // estimated: light does not come on with a hot engine (DS), threshold is an estimate
    crankMaxSeconds: 15, // confirmed: DS (holding in START longer than 15 s)
    starterCooldownSeconds: 60, // confirmed: DS (wait one minute for the starter to cool)
    crankRpm: 190, // estimated: typical diesel cranking speed
    elevatedIdleBelowAirF: 32, // confirmed: DS (outside temperature below 32 F)
    elevatedIdleBelowCoolantF: 150, // confirmed: DS (coolant below 150 F)
    elevatedIdleDelaySec: 8, // estimated: DS says "a few seconds up to approximately two minutes"
    elevatedIdleRampSec: 25, // estimated: DS "slowly ramp"
  },

  // ---------- US HD automatic cluster (OM, 01-dash-cluster-lit, IMG_2867) ----------
  cluster: {
    speedoMaxMph: 120, // confirmed: IMG_2867/01-dash-cluster-lit (0-120 mph)
    tachMaxRpm: 5000, // confirmed: 01-dash-cluster-lit (0-5 x1000)
    tachDashedRedStartRpm: 3200, // estimated: 01-dash-cluster-lit (red ticks from about 3,200 rpm)
    tachSolidRedStartRpm: 3600, // estimated: 01-dash-cluster-lit (solid red zone near the end)
    coolantRangeF: [160, 260], // confirmed: IMG_2867 (160-260 F scale)
    transTempRangeF: [100, 300], // confirmed: 01-dash-cluster-lit (100-300 F)
    oilPressureRangePsi: [0, 120], // confirmed: 01-dash-cluster-lit (0-120 psi)
    voltRange: [9, 19], // confirmed: IMG_2867 (voltmeter 9-19 V)
  },

  // ---------- turbocharger (RES item 2) ----------
  turbo: {
    model: 'Garrett GT3788VA', // confirmed: vendor listings (Garrett P/N 848212-5001S, BD Diesel), RES item 2
    type: 'variable-geometry turbine (VNT), oil-pressure piston actuator driven by a PWM solenoid', // confirmed: DieselHub + vendor parts listings, RES item 2
    vaneConvention: '0 percent open, higher percent more closed', // estimated: tuner forum usage (HP Academy, duramaxdiesels.com), RES item 2
    vaneMaxClosed: 0.85, // estimated: usable travel limit offered on the Turbo Sound page; the mechanical stop is at 0.95 (RES item 2: closed end found by commanding to the stop)
    overspeedRpm: 135000, // estimated: GT37-class danger line, no data sheet found; research range 125-140k (RES item 2)
    overspeedHoldS: 2.0, // estimated: seconds above the line that damage the wheel (game balance)
    typicalWotVanePct: 40, // estimated: logged LLY about 40 percent at WOT (forum, RES item 2)
    peakBoostStockPsi: 26, // estimated: 22-26 psig typical, up to 28-30 briefly (RES item 2)
    boostMaxRecommendedPsi: 40, // estimated: Stainless Diesel max recommended boost for drop-in turbos (RES item 2)
  },

  // ---------- thermal and failure limits (every limit sourced or estimated; PROMPT.md section 5A) ----------
  limits: {
    egtContinuousPreTurboF: 1300, // confirmed: GM guidance quoted by three sources (RES item 2)
    egtPistonDamageF: 1650, // estimated: pre-turbo EGT held where aluminum piston crowns erode; sources say sustained 1,500 F starts damage, 1,600-1,700 F melts (RES item 7); tuned trucks run brief 1,600 F pulls
    egtPistonDamageHoldS: 14, // estimated: damage accumulates over this many weighted seconds above the line (game balance)
    egtTurboDamageF: 1800, // estimated: pre-turbo EGT that damages the turbine wheel and housing (RES item 7)
    cylPressureSoftPsi: 2900, // estimated: head gasket distress begins (RES item 6, general diesel practice)
    cylPressureLiftPsi: 3300, // estimated: gasket lifts when held above this (RES item 6)
    cylPressureHoldS: 6, // estimated: seconds above the lift pressure (game balance)
    transSumpMaxF: 250, // estimated: Allison max sump temperature quoted by Allison via forum (RES item 3)
    transBurnF: 285, // estimated: fluid breakdown and clutch glazing region (RES item 3: GM engineer, degrades above 270 F)
    clutchCapacityLbFt: 840, // estimated: from the magazine anecdote that stock clutches slip near 350 whp (RES item 3)
    clutchBurnSlipEnergyKj: 250, // estimated: accumulated slip energy that burns the clutch packs (game balance)
    coolantHotF: 235, // estimated: GM gauge hot zone (RES item 6)
    coolantOverheatF: 250, // estimated: engine protection (REDUCED ENGINE POWER) region
  },

  // ---------- chassis dyno (generic heavy-duty in-ground inertia + eddy current) ----------
  dyno: {
    rollerDiameterIn: 24, // estimated: Mustang-style truck dyno rollers 24 in (RES item 10)
    rollerInertiaKgM2PerSet: 150, // estimated: 24 in steel drum set (about 97 kg m^2 solid-cylinder figure per RES item 10) plus the dyno's coupled flywheel mass; tuned for a 8-12 s pull
    rollerPairGapIn: 17, // estimated
    saeStdTempC: 25, // confirmed: SAE J1349 standard (25 C, 99 kPa dry air)
    saeStdDryPressureKpa: 99, // confirmed: SAE J1349
    maxRunsHeatSoakAfter: 3, // estimated: game-balance
  },
};
