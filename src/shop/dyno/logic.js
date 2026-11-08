// Pure logic and constants of the dyno hardware (no three.js, no DOM): unit tested in tests/dynohw.test.js.
// Shop frame: meters, floor y = 0, truck faces -Z; the truck origin is the front axle centerline.
import { spec, IN } from '../../data/truckSpec.js';
import { DYNO } from '../layout.js';

const TAU = Math.PI * 2;

// ---------------- geometry constants (real numbers come from the spec file) ----------------
export const ROLLER_R = (spec.dyno.rollerDiameterIn / 2) * IN;       // 24 in rollers
export const ROLLER_LEN = 36 * IN;                                   // design: 36 in long drums (PROMPT / task brief)
export const TIRE_R = (spec.tires.overallDiameterIn / 2) * IN;       // 15.25 in unloaded
export const TIRE_REST_Y = spec.tires.rollingRadiusIn * IN;          // tire center height at factory ride height
export const REAR_TRACK = spec.dims.trackRearIn * IN;                // 66.0 in
export const FRONT_TRACK_WHEELS_X = 34.3 * IN;                       // front tire center x (task brief)
export const WHEELBASE = 3.886;                                      // matches src/shop/shell.js (153.0 in)
export const REAR_AXLE_Z = DYNO.truckOrigin.z + WHEELBASE;           // pit center z
export const FRONT_AXLE_Z = DYNO.truckOrigin.z;
export const PIT = { hw: DYNO.pit.halfW, hl: DYNO.pit.len / 2, depth: DYNO.pit.depth, cz: REAR_AXLE_Z };
export const ROLLER_GAP = 0.10;        // design: clear gap between the two drums of a set (the spec's 17 in cannot hold floor-level tops)
export const ROLLER_TOP_Y = 0.02;      // drum tops sit 20 mm proud of the floor, like the cover plates of a real in-ground dyno

// Roller cradle: where the drum axes are so that the loaded tire touches both drums of a set.
export function rollerLayout() {
  const half = ROLLER_R + ROLLER_GAP / 2;                 // drum axis offset from the tire center in z
  const cy = ROLLER_TOP_Y - ROLLER_R;                     // drum axis height
  const vert = Math.sqrt((TIRE_R + ROLLER_R) ** 2 - half ** 2);
  const tireY = cy + vert;                                // tire center height when seated in the cradle
  return {
    half, cy, tireY, zFront: REAR_AXLE_Z - half, zRear: REAR_AXLE_Z + half,
    setX: [-REAR_TRACK / 2, REAR_TRACK / 2],
    rearAxleDrop: TIRE_REST_Y - tireY,                    // how far the truck's rear axle sits lower than at rest
  };
}

// ---------------- roller angle integration ----------------
// Roller angle about +X. Positive angle moves the drum TOP toward +Z, which is where the tire contact patch moves
// when the truck drives forward (-Z): tire and drum surfaces run together at the contact, so the drum turns the
// opposite way to the wheel.
export function advanceAngle(angle, omega, dt) {
  let a = (angle + omega * dt) % TAU;
  if (a < 0) a += TAU;
  return a;
}
export const rollerSurfaceSpeed = (omega) => omega * ROLLER_R; // m/s

// ---------------- weather display ----------------
export function formatAir(air) {
  if (!air) return '-- C  -- kPa  -- % RH';
  const t = Number.isFinite(air.tempC) ? air.tempC.toFixed(1) : '--';
  const p = Number.isFinite(air.pressureKpa) ? air.pressureKpa.toFixed(1) : '--';
  const h = Number.isFinite(air.humidityPct) ? Math.round(air.humidityPct) : '--';
  return `${t} C  ${p} kPa  ${h} % RH`;
}

// ---------------- strap anchors ----------------
// Truck-side attachment points, truck frame inches: front tow hooks and rear frame/bumper points (task brief).
export const STRAP_TRUCK_LOCAL_IN = [
  [-17, 17, -32],   // 0 front driver side (truck +X is the passenger side)
  [17, 17, -32],    // 1 front passenger side
  [-24, 20, 196],   // 2 rear driver side
  [24, 20, 196],    // 3 rear passenger side
];
export function strapPoints() {
  const o = DYNO.truckOrigin;
  const truck = STRAP_TRUCK_LOCAL_IN.map(([x, y, z]) => [o.x + x * IN, y * IN, o.z + z * IN]);
  const floor = truck.map(([x, , z], i) => {
    const side = Math.sign(x) || 1;
    return i < 2 ? [x + side * 1.2, 0, z - 1.15]   // front: about 1.15 m ahead, 1.2 m outboard (clears the fan cart)
      : [x + side * 0.85, 0, z + 0.95];               // rear: behind the truck, outboard
  });
  return { truck, floor };
}

// ---------------- strap ribbon ----------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const V = { sub, add, mul, len, nrm, cross, lerp3 };
export const smoothstep = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// Parabolic sag for a strap of free length (dist + slack): arc length ~ d + 8 s^2 / (3 d)  =>  s = sqrt(3 d slack / 8)
export function sagFor(dist, slack) { return Math.sqrt((3 * dist * Math.max(0, slack)) / 8); }

// Points of a strap between A and B with n segments, sagging by `sag` (meters, straight down), never below floorY.
export function strapCurve(A, B, n, sag, floorY = 0.004) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = lerp3(A, B, t);
    p[1] -= sag * 4 * t * (1 - t);
    if (p[1] < floorY) p[1] = floorY;
    pts.push(p);
  }
  return pts;
}

// Flat coil of webbing lying on the floor (width horizontal): outer start, inner end. Archimedean spiral.
export function coilCurve(center, n, rOuter = 0.25, rInner = 0.12, turns = 2, startAngle = 0, y = 0.004) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = rOuter + (rInner - rOuter) * t;
    const a = startAngle + t * turns * TAU;
    pts.push([center[0] + r * Math.cos(a), y, center[2] + r * Math.sin(a)]);
  }
  return pts;
}

export function polylineLength(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += len(sub(pts[i], pts[i - 1])); return s; }

// Position and tangent at fraction t (0..1) of arc length along a polyline.
export function pointAt(pts, t) {
  const total = polylineLength(pts);
  let target = Math.min(1, Math.max(0, t)) * total, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = len(sub(pts[i], pts[i - 1]));
    if (acc + l >= target || i === pts.length - 1) {
      const u = l > 0 ? Math.min(1, (target - acc) / l) : 0;
      return { p: lerp3(pts[i - 1], pts[i], u), tangent: nrm(sub(pts[i], pts[i - 1])), index: i - 1 };
    }
    acc += l;
  }
  return { p: pts[0], tangent: [0, 0, 1], index: 0 };
}

// Triangle strip data for a flat ribbon of the given width following the points. The width axis is horizontal and
// perpendicular to the direction of travel (a strap does not twist between its hooks). UV v runs in meters / tile.
export function ribbonData(pts, width, tile = 0.1) {
  const n = pts.length;
  const positions = new Float32Array(n * 2 * 3), normals = new Float32Array(n * 2 * 3), uvs = new Float32Array(n * 2 * 2);
  const indices = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const T = nrm(sub(b, a));
    let w = cross(T, [0, 1, 0]);
    if (len(w) < 1e-4) w = [1, 0, 0];
    w = nrm(w);
    const N = nrm(cross(w, T));
    if (i > 0) s += len(sub(pts[i], pts[i - 1]));
    const L = add(pts[i], mul(w, -width / 2)), R = add(pts[i], mul(w, width / 2));
    positions.set(L, i * 6); positions.set(R, i * 6 + 3);
    normals.set(N, i * 6); normals.set(N, i * 6 + 3);
    uvs.set([0, s / tile, 1, s / tile], i * 4);
    if (i < n - 1) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  return { positions, normals, uvs, indices, length: s };
}

// Frame (width, normal, tangent) of a ribbon at a tangent direction, for placing buckles and hooks.
export function ribbonFrame(T) {
  T = nrm(T);
  let w = cross(T, [0, 1, 0]);
  if (len(w) < 1e-4) w = [1, 0, 0];
  w = nrm(w);
  return { w, n: nrm(cross(w, T)), t: T };
}

// Exponential approach (frame-rate independent).
export function approach(cur, target, rate, dt) { return target + (cur - target) * Math.exp(-rate * dt); }

// ---------------- exhaust hose ----------------
// Cubic bezier through reel outlet P0 and the cone-side end P3, with end tangent control along `arrive` (unit vector
// pointing from the end back along the hose).
export function bezier(P0, P1, P2, P3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [0, 1, 2].map((k) => a * P0[k] + b * P1[k] + c * P2[k] + d * P3[k]);
}
export function hoseControls(P0, mouth, arrive, coneLen, dropA = 1.4, reachB = 1.0) {
  const P3 = add(mouth, mul(arrive, coneLen));
  return [P0, add(P0, [0, -dropA, 0]), add(P3, mul(arrive, reachB)), P3];
}
export function hosePath(P0, mouth, arrive, coneLen, n, dropA = 1.4, reachB = 1.0) {
  const [a, b, c, d] = hoseControls(P0, mouth, arrive, coneLen, dropA, reachB);
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(bezier(a, b, c, d, i / n));
  return pts;
}

export const HOSE = {
  radius: 2 * IN,                    // 4 in hose (outer radius)
  reel: [0.0, 4.25, 6.2],            // reel drum center (design)
  tailpipe: [0.6, 0.45, DYNO.truckOrigin.z + 5.05], // tailpipe tip: passenger side (photos 03 and IMG_2872), 5.05 m behind the front axle
  coneLen: 0.24,
};
