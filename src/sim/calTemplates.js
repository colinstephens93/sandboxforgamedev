// Calibration templates: the SHAPE of each tune (boost target, rail, timing, smoke limiter, torque limiter,
// Allison behaviour). The fuel quantity and vane feed-forward tables are SOLVED by scripts/fit.mjs against the
// physics (so that the stock calibration reproduces the published 310 hp / 605 lb-ft and each tune lands at the owner's
// measured wheel-horsepower gain) and stored in src/data/calFit.js.
// GM's calibration tables are not public: every number here is `estimated` (ACCURACY.md, "calibration").
export const RPM_NODES = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400];
const tbl = (ys) => ({ x: RPM_NODES, y: ys });

// target crank torque curve of the stock engine, lb-ft, at full pedal (used ONLY to fit the stock fuel table)
export const STOCK_TORQUE_TARGET = [270, 300, 350, 540, 598, 605, 603, 598, 592, 584, 574, 560, 542.71, 500, 400];

export const TEMPLATES = {
  stock: {
    id: 'stock', name: 'Stock', desc: 'Factory 2005 LLY calibration, as shipped.',
    boostPsi: [0, 0, 4, 11, 19, 25, 26, 26, 25.5, 25, 24.5, 24, 23.5, 22, 20],
    railPsi: [6000, 7500, 10000, 13500, 17000, 19500, 21000, 22000, 22800, 23200, 23500, 23500, 23500, 23500, 23500],
    timing: [2, 4, 6, 8, 10, 12, 14, 15.5, 17, 18.5, 20, 21.5, 23, 24, 24],
    lambdaMin: 1.42, torqueLimit: [330, 380, 440, 560, 640, 650, 650, 650, 650, 650, 650, 650, 650, 600, 500],
    govStart: 3050, govEnd: 3230, railIdle: 5200,
    vaneLight: 0.55,
    trans: { lineP: 1.0, tccApplyRpm: 1500, upshiftRpm: [3050, 3050, 3050, 3050], tccWotLock: true, mode: 'comfort' },
  },
};

// Boost target shapes: stock boost plus an increment that fades in with rpm (spool-limited at the bottom end)
const boostPlus = (inc) => TEMPLATES.stock.boostPsi.map((b, i) => (b <= 0 ? 0 : b + inc * [0, 0, 0.35, 0.6, 0.85, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1][i]));
const railPlus = (inc) => TEMPLATES.stock.railPsi.map((r, i) => r + inc * [0.1, 0.1, 0.3, 0.5, 0.7, 0.9, 1, 1, 1, 1, 1, 1, 1, 1, 1][i]);
const timingPlus = (inc) => TEMPLATES.stock.timing.map((t, i) => t + inc * [0, 0, 0.3, 0.5, 0.7, 0.9, 1, 1, 1, 1, 1, 1, 1, 1, 1][i]);
const tl = (mult) => TEMPLATES.stock.torqueLimit.map((v, i) => (i < 3 ? v : v * mult));

// The owner's five switchable positions; gains are rear-wheel horsepower on the chassis dyno (owner-confirmed).
// Boost/rail/timing/smoke/torque-limit/Allison values are estimates (ACCURACY.md); the fuel tables are fitted.
export const GAIN_WHP = { heavytow: 30, lighttow: 60, economy: 120, street: 175, race: 230 };
Object.assign(TEMPLATES, {
  heavytow: { ...TEMPLATES.stock, id: 'heavytow', name: 'Heavy Tow', position: 1, desc: 'Conservative tow tune: small power gain, firm Allison, cool exhaust.',
    boostPsi: boostPlus(2), railPsi: railPlus(500), timing: timingPlus(1), lambdaMin: 1.36, torqueLimit: tl(1.12),
    trans: { lineP: 1.12, tccApplyRpm: 1250, upshiftRpm: [3150, 3150, 3150, 3150], tccWotLock: true, mode: 'tow' } },
  lighttow: { ...TEMPLATES.stock, id: 'lighttow', name: 'Light Tow', position: 2, desc: 'Moderate tow tune: more mid-range torque, still conservative on the transmission.',
    boostPsi: boostPlus(4), railPsi: railPlus(1000), timing: timingPlus(2), lambdaMin: 1.32, torqueLimit: tl(1.22),
    trans: { lineP: 1.2, tccApplyRpm: 1300, upshiftRpm: [3200, 3200, 3200, 3200], tccWotLock: true, mode: 'tow' } },
  economy: { ...TEMPLATES.stock, id: 'economy', name: 'Economy', position: 3, desc: 'Efficiency at part throttle with strong wide-open power. Advanced timing at cruise.',
    boostPsi: boostPlus(7), railPsi: railPlus(1500), timing: timingPlus(3), lambdaMin: 1.27, torqueLimit: tl(1.4),
    trans: { lineP: 1.25, tccApplyRpm: 1150, upshiftRpm: [3000, 3000, 3000, 3000], tccWotLock: true, mode: 'economy' } },
  street: { ...TEMPLATES.stock, id: 'street', name: 'Street', position: 4, desc: 'Hard-hitting street tune: big power, visible smoke at the top, firm shifts.',
    boostPsi: boostPlus(10), railPsi: railPlus(2500), timing: timingPlus(4), lambdaMin: 1.21, torqueLimit: tl(1.62),
    trans: { lineP: 1.3, tccApplyRpm: 1250, upshiftRpm: [3300, 3300, 3300, 3300], tccWotLock: true, mode: 'performance' } },
  race: { ...TEMPLATES.stock, id: 'race', name: 'Race', position: 5, desc: 'Maximum power for the dyno and the strip. Hard on the stock Allison and on the exhaust.',
    boostPsi: boostPlus(13), railPsi: railPlus(3000), timing: timingPlus(5), lambdaMin: 1.15, torqueLimit: tl(1.9),
    trans: { lineP: 1.4, tccApplyRpm: 1350, upshiftRpm: [3400, 3400, 3400, 3400], tccWotLock: true, mode: 'race' } },
});
export const TUNE_ORDER = ['stock', 'heavytow', 'lighttow', 'economy', 'street', 'race'];
