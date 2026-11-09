// Export the game truck's side silhouette to `.dev/profile.json` for the Blender measurement overlay.
//
// Source of truth: `src/truck/skin.js` (and through it `src/data/truckSpec.js`). Nothing here re-states a
// real-world dimension: every number is read from the skin module and converted to meters.
//
// Frame: truck frame, as in docs/CONVENTIONS.md. z = distance rearward of the front axle (m), y = height above
// the ground (m). The side silhouette is sampled at the truck centerline (x = 0) for the crowned top surfaces,
// which is what a side-view silhouette shows.
//
// Usage: node tools/blender/exportProfile.mjs [outfile]
//   default outfile: .dev/profile.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ST, H, S_FRONT, S_REAR, WB, HALF_W, ARCH_R, AXLE_Y, IN_TO_M,
  hoodHeight, roofHeight, archY,
} from '../../src/truck/skin.js';
import { spec } from '../../src/data/truckSpec.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const outPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, '.dev', 'profile.json');

const M = (inches) => inches * IN_TO_M;      // inches -> meters
const P = (s, y) => [M(s), M(y)];            // (station, height) in inches -> [z, y] in meters
const round = (v) => Math.round(v * 1e5) / 1e5;

// ---- named lines ----------------------------------------------------------------------------------------
// Hood: the front axle to the cowl. The prompt/DEEPSEEK_PROMPT text says "s -30.5 to 19.3 in"; skin.js has
// ST.hoodFront = -30.5 and ST.cowl = 19.5. The 0.2 in difference is the cowl seam (HoodCowl = 54.2 vs the
// crowned hood at 54.4); we export the skin's own range so the overlay always matches the game.
const HOOD_S = [-30.5, ST.cowl];
const ROOF_S = [43.6, ST.cabBack];           // as specified for the overlay
const BEDRAIL_S = [ST.bedFront, ST.bedEnd];

const sample = (s0, s1, n, fn) => {
  const out = [];
  for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * (i / n); out.push({ s: round(s), y: round(fn(s)), z: round(M(s)), h: round(M(fn(s))) }); }
  return out;
};

const hood = sample(HOOD_S[0], HOOD_S[1], 60, (s) => hoodHeight(s, 0));
const roof = sample(ROOF_S[0], ROOF_S[1], 60, (s) => roofHeight(s, 0));

// ---- the closed side silhouette -----------------------------------------------------------------------
// Walked counter-clockwise in the (z, y) plane, starting at the front bumper's lower corner.
const hoodLine = hood.map((p) => [p.s, p.y]);
const roofLine = roof.map((p) => [p.s, p.y]);
const WIND_BASE = [ST.cowl, hoodHeight(ST.cowl, 0)];
const ROOF_FRONT = [ROOF_S[0], roofHeight(ROOF_S[0], 0)];
const ROOF_REAR = [ROOF_S[1], roofHeight(ROOF_S[1], 0)];
const CAB_BACK_BOTTOM = [ST.cabBack, H.beltline];
const BED_FRONT_TOP = [ST.bedFront, H.bedRail];
const BED_RAIL_END = [ST.bedEnd, H.bedRail - 0.55];     // bed.js: bedTop() drops 0.55 in at the rear
const TAILGATE_BOTTOM = [ST.bedEnd, 30.4];              // rear.js: bumper pad / shell top behind the gate
const RB_TOP = [S_REAR, 30.4];                          // rear.js: pad surface 30.15 + lip
const RB_BOTTOM = [S_REAR, 19.2];                       // rear.js: bumper underside
const FB_TOP = [S_FRONT, 32.0];                         // front.js: bumper cap top 32.0
const FB_BOTTOM = [S_FRONT, 16.8];                      // front.js: valance bottom 16.8
const GRILLE_TOP = [-32.8, 45.6];                       // front.js faceS(0, 45.6) at the grille's top corner

const outline = [];
const push = (pt) => { const [s, y] = pt; outline.push([round(M(s)), round(M(y))]); };
push(FB_BOTTOM);
push(FB_TOP);
push(GRILLE_TOP);
for (const p of hoodLine) push(p);                       // hood, front to cowl
push(ROOF_FRONT);                                        // windshield line (straight)
for (const p of roofLine) push(p);                       // roof, front to rear
push(ROOF_REAR);
push(CAB_BACK_BOTTOM);                                   // cab back panel
push(BED_FRONT_TOP);                                     // step up to the bed rail (the cab/bed gap)
for (const p of bedRailLine()) push(p);                  // bed rail, front to rear
push(BED_RAIL_END);
push(TAILGATE_BOTTOM);                                   // tailgate outer face
push(RB_TOP);
push(RB_BOTTOM);
push([S_REAR, 18.0]);
// underside, walking forward along the bottom with the two wheel openings cut out
push([WB + ARCH_R + 0.4, 18.0]);
for (const p of archLine(WB, ARCH_R + 0.4, 18.0, true)) push(p);
push([ST.doorR1, 18.0]);
push([ARCH_R, 18.0]);
for (const p of archLine(0, ARCH_R, 18.0, true)) push(p);
push([-20.0, 18.0]);

function bedRailLine() {
  const out = [];
  for (let i = 1; i <= 40; i++) {
    const s = BEDRAIL_S[0] + (BEDRAIL_S[1] - BEDRAIL_S[0]) * (i / 40);
    const y = H.bedRail - 0.55 * smooth(clamp((s - ST.bedEnd + 8) / 8, 0, 1));
    out.push([s, Math.max(y, H.bedRail - 0.55)]);
  }
  return out;
}

// the wheel-opening edge, rear to front (side = +1 walks rearward)
function archLine(centerS, r, yBottom, rearward) {
  const out = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const d = rearward ? r - (2 * r * i) / N : -r + (2 * r * i) / N;
    const s = centerS + d;
    const a = archY(s, centerS, r);
    out.push([s, a == null ? yBottom : Math.max(a, yBottom)]);
  }
  return out;
}

function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function smooth(t) { return t * t * (3 - 2 * t); }

// ---- the key stations the report compares ---------------------------------------------------------------
// Each entry: id, label, s in inches (the game's own station), the height used when a photo edge is scanned.
const GRILLE = -32.8;
const features = [
  { id: 'nose', label: 'Nose (front bumper face)', s: S_FRONT, y: 24.0 },
  { id: 'hoodEnd', label: 'Hood front edge', s: ST.hoodFront, y: hoodHeight(ST.hoodFront, 0) },
  { id: 'windshieldBase', label: 'Windshield base (cowl)', s: ST.cowl, y: hoodHeight(ST.cowl, 0) },
  { id: 'roofFront', label: 'Roof front', s: ROOF_S[0], y: roofHeight(ROOF_S[0], 0) },
  { id: 'roofRear', label: 'Roof rear', s: ROOF_S[1], y: roofHeight(ROOF_S[1], 0) },
  { id: 'cabBack', label: 'Cab back', s: ST.cabBack, y: H.beltline },
  { id: 'bedFront', label: 'Bed front', s: ST.bedFront, y: H.bedRail },
  { id: 'bedRailEnd', label: 'Bed rail end', s: ST.bedEnd, y: H.bedRail },
  { id: 'tailgateEnd', label: 'Tailgate end', s: ST.bedEnd, y: 44.0 },
  { id: 'rearBumperEnd', label: 'Rear bumper end', s: S_REAR, y: 25.0 },
];

// ---- envelope self check --------------------------------------------------------------------------------
const zs = outline.map((p) => p[0]);
const ys = outline.map((p) => p[1]);
const bbox = { lengthIn: (Math.max(...zs) - Math.min(...zs)) / IN_TO_M, heightIn: Math.max(...ys) / IN_TO_M };

const profile = {
  generator: 'tools/blender/exportProfile.mjs',
  source: 'src/truck/skin.js (dimensions from src/data/truckSpec.js)',
  units: 'm',
  frame: 'truck frame: z = distance rearward of the front axle, y = height above the ground (docs/CONVENTIONS.md)',
  conventions: { face: '-z', driverSide: '-x', passengerSide: '+x' },
  envelope: {
    lengthIn: spec.dims.lengthIn,
    wheelbaseIn: spec.dims.wheelbaseIn,
    widthIn: spec.dims.widthIn,
    heightIn: spec.dims.heightIn,
    frontOverhangIn: spec.dims.frontOverhangIn,
    rearOverhangIn: spec.dims.rearOverhangIn,
  },
  bboxIn: { lengthIn: round(bbox.lengthIn), heightIn: round(bbox.heightIn) },
  stations: Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, { in: v, z: round(M(v)) }])),
  heights: Object.fromEntries(Object.entries(H).map(([k, v]) => [k, { in: v, y: round(M(v)) }])),
  wheelbase: { in: WB, z: round(M(WB)) },
  wheels: [
    { id: 'front', sIn: 0, yIn: AXLE_Y, rIn: spec.tires.rollingRadiusIn, z: round(M(0)), h: round(M(AXLE_Y)), r: round(M(spec.tires.rollingRadiusIn)) },
    { id: 'rear', sIn: WB, yIn: AXLE_Y, rIn: spec.tires.rollingRadiusIn, z: round(M(WB)), h: round(M(AXLE_Y)), r: round(M(spec.tires.rollingRadiusIn)) },
  ],
  lines: {
    hood: hood.map((p) => [p.z, p.h]),
    roof: roof.map((p) => [p.z, p.h]),
    beltline: [P(ST.doorF0, H.beltline), P(ST.cabBack, H.beltline)],
    bedRail: bedRailLine().map(([s, y]) => P(s, y)),
    bumperFront: [P(S_FRONT, FB_BOTTOM[1]), P(S_FRONT, FB_TOP[1])],
    bumperRear: [P(S_REAR, RB_BOTTOM[1]), P(S_REAR, RB_TOP[1])],
    rocker: [P(ST.doorF0, H.rocker), P(ST.cabBack, H.rocker)],
  },
  features: features.map((f) => ({
    id: f.id, label: f.label,
    sIn: round(f.s), yIn: round(f.y), z: round(M(f.s)), h: round(M(f.y)),
  })),
  outline,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(profile, null, 1));
console.log(`profile -> ${path.relative(ROOT, outPath)}`);
console.log(`  outline points: ${outline.length}`);
console.log(`  bbox: length ${bbox.lengthIn.toFixed(2)} in, height ${bbox.heightIn.toFixed(2)} in ` +
  `(spec ${spec.dims.lengthIn} x ${spec.dims.heightIn})`);
console.log(`  wheelbase ${WB} in, front overhang ${spec.dims.frontOverhangIn} in, rear overhang ${spec.dims.rearOverhangIn} in`);
if (Math.abs(bbox.lengthIn - spec.dims.lengthIn) > 0.6) console.warn('WARNING: outline length differs from the spec envelope by more than 0.6 in');
if (Math.abs(bbox.heightIn - spec.dims.heightIn) > 0.2) console.warn('WARNING: outline height differs from the spec envelope');
