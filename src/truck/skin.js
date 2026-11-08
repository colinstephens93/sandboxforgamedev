// Parametric outer skin of the 2005 GMT800 Classic crew cab short box.
// Everything is in INCHES in the "body frame": s = distance rearward of the front axle, y = height above the ground
// at the factory ride height, w = half width (distance from the centerline). Converted to meters at the end.
// Station values were read from the reference photos (IMG_2851, 2862, 2852, 2873) by measuring pixel positions
// against the 153.0 in wheelbase, then fitted to the spec envelope (width 79.7 in, height 77 in, length 237.3 in).
// The photos show a lifted truck, so heights follow the spec envelope (ACCURACY.md: body line heights estimated).
import { spec } from '../data/truckSpec.js';

const D = spec.dims;
export const WB = D.wheelbaseIn;                       // 153.0
export const S_FRONT = -D.frontOverhangIn;             // front bumper face
export const S_REAR = WB + D.rearOverhangIn;           // rear bumper end
export const HALF_W = D.widthIn / 2;                   // 39.85

// ---- key stations along the truck (inches from the front axle) ----
export const ST = {
  nose: S_FRONT, hoodFront: -30.5, cowl: 19.5,
  fenderEnd: 20.2, doorF0: 22.6, doorF1: 69.6, doorR0: 71.6, doorR1: 105.8, cabBack: 108.6,
  bedFront: 110.8, bedEnd: 191.0,
  axleF: 0, axleR: WB,
};
export const ARCH_R = 19.4;       // wheel opening radius
export const AXLE_Y = spec.tires.rollingRadiusIn + 0.6; // wheel center height

// ---- heights (inches above ground) ----
export const H = {
  roof: D.heightIn, beltline: 54.6, hoodNose: 46.8, hoodCowl: 54.2, rocker: 17.6, hem: 20.6,
  bedRail: 56.0, bedFloor: 37.4, bumperTop: 30.5, bumperBottom: 18.0, tailgateTop: 55.5,
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => t * t * (3 - 2 * t);

function tab(points, x) {
  // points: [[x,y],...] ascending; smoothstep-interpolated
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) { const t = (x - points[i - 1][0]) / (points[i][0] - points[i - 1][0]); return lerp(points[i - 1][1], points[i][1], smooth(t)); }
  }
  return points[points.length - 1][1];
}

// maximum half-width along the length (body line at the widest height)
const W_MAX = [
  [-38.5, 32.0], [-33, 33.8], [-28, 36.4], [-20, 38.4], [-8, 39.45], [0, 39.85], [12, 39.7], [20, 39.45],
  [23, 39.3], [35, 39.15], [60, 39.3], [90, 39.2], [105, 38.9], [109, 38.2],
  [111, 38.8], [125, 39.3], [140, 39.85], [153, 39.85], [166, 39.85], [178, 39.5], [191, 38.5], [199, 36.5],
];
export const wMax = (s) => tab(W_MAX, s);

// cross-section: fraction of wMax at each height, per region
const P_FENDER = [[14, 0.90], [18, 0.955], [22, 0.985], [28, 1.0], [44, 1.0], [48, 0.945], [51, 0.865], [54.5, 0.74], [58, 0.7]];
const P_CAB = [[14, 0.89], [17.6, 0.93], [21, 0.985], [27, 1.0], [48, 1.0], [54.6, 0.99], [62, 0.955], [70, 0.885], [75.5, 0.79], [77.2, 0.62], [78, 0.5]];
const P_BED = [[16, 0.9], [20, 0.945], [24, 0.985], [30, 1.0], [48, 1.0], [53.5, 0.985], [55.2, 0.95], [56.4, 0.9], [57, 0.88]];

export function halfWidth(s, y) {
  const w = wMax(s);
  const pf = tab(P_FENDER, y), pc = tab(P_CAB, y), pb = tab(P_BED, y);
  // blend regions across the gaps
  let p;
  if (s <= ST.fenderEnd) p = pf;
  else if (s <= ST.fenderEnd + 4) p = lerp(pf, pc, smooth((s - ST.fenderEnd) / 4));
  else if (s <= ST.cabBack) p = pc;
  else if (s <= ST.bedFront + 3) p = lerp(pc, pb, smooth((s - ST.cabBack) / (ST.bedFront + 3 - ST.cabBack)));
  else p = pb;
  // plan-view bulge: doors curve slightly, fender top follows the hood
  return w * p;
}

// wheel opening lower bound for a column at station s (inches); returns y of the opening edge or null if not in the arch
export function archY(s, sc, r = ARCH_R, yc = AXLE_Y) {
  const d = Math.abs(s - sc);
  if (d >= r) return null;
  return yc + Math.sqrt(r * r - d * d) * 0.97 + 0.4 * (d / r) * (d / r);
}

// top surface of the hood, crowned: height at station s and lateral offset x (inches)
export function hoodHalfWidth(s) {
  return tab([[-30.5, 26.0], [-24, 27.2], [-10, 28.0], [8, 28.6], [19.5, 28.8]], s);
}
export function hoodHeight(s, x) {
  const hc = tab([[-30.5, 47.6], [-24, 48.8], [-10, 50.4], [8, 52.6], [19.5, 54.4]], s);
  const hw = hoodHalfWidth(s);
  const t = clamp(Math.abs(x) / hw, 0, 1);
  // crown with a powerdome (two raised bulges for the HD hood) and a downward roll at the edge
  const crown = 2.1 * t * t + 2.2 * Math.pow(t, 6);
  return hc - crown + 0.35 * (1 - Math.abs(t - 0.28) / 0.72);
}

// roof: half width at the roof edge and crown height
export function roofHalfWidth(s) { return tab([[43, 25.5], [52, 30.5], [70, 31.8], [100, 31.5], [108.6, 29.0]], s); }
export function roofHeight(s, x) {
  const hw = roofHalfWidth(s);
  const t = clamp(Math.abs(x) / hw, 0, 1);
  const sFront = tab([[40, 71.5], [46, 75.6], [56, 76.8], [100, 76.8], [106, 75.9], [109, 74.4]], s);
  return Math.min(H.roof, sFront + 0.75 * (1 - t * t)) - 1.6 * Math.pow(t, 4);
}

export const IN_TO_M = 0.0254;
