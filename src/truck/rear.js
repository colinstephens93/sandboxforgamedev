// Rear of the 2005 Silverado 2500HD Classic: factory steel box (floor with lengthwise stamped ribs, stamped inner walls, wheel tubs,
// headache wall, tie-down hooks, stake pockets, black plastic rail caps), the working tailgate on its hinge axis with support cables,
// the chrome LT step bumper with its black step pad, receiver hitch and trailer plug, taillamps, CHMSL/cargo lamp, license plate.
// Badges and decals are in badges.js (the SILVERADO badge is attached to the tailgate here so it travels with the gate).
//
// Frame: the truck frame (origin at the front axle on the floor, truck faces -Z, +X passenger side, z = s rearward).
// Everything is authored in INCHES inside one group scaled by IN_TO_M, like the real drawings; pure helpers (cables, angles, ribs) are exported
// for the unit tests (tests/rear.test.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from '../core/materials.js';
import { makeCanvas, noiseField, heightToNormal, tex } from '../core/proc.js';
import { roundedBoxGeometry } from '../core/geom.js';
import { halfWidth, ST, H, IN_TO_M, WB, S_REAR } from './skin.js';
import { spec } from '../data/truckSpec.js';
import { buildSilveradoBadge } from './badges.js';

const IN = IN_TO_M;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => t * t * (3 - 2 * t);
const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
const hasDom = () => typeof document !== 'undefined';

// ---------------------------------------------------------------------------------------------------------------
// Inspection labels (ids under truck.*; the integrator merges this object into the truck label file)
export const REAR_LABELS = {
  'truck.bed': { name: 'Cargo box', desc: 'Factory steel 6.5 ft box: stamped floor, double-wall sides with painted inner panels, black plastic rail caps.' },
  'truck.bed_floor': { name: 'Bed floor', desc: 'Painted steel floor with lengthwise stamped ribs; no spray-in liner on the stock truck.' },
  'truck.bed_wall': { name: 'Bed inner side panel', desc: 'Painted inner side wall with stamped vertical pockets for stiffness.' },
  'truck.headache_wall': { name: 'Bed front wall', desc: 'Front wall of the box with stamped ribs; the cab rear wall and glass sit above it.' },
  'truck.wheel_tub': { name: 'Wheel tub', desc: 'Wheel housing bulging into the box over the rear tire; 50 in between the tubs.' },
  'truck.tie_down': { name: 'Tie-down hook', desc: 'Stamped steel cargo hook, four on each side of the box.' },
  'truck.stake_pocket': { name: 'Stake pocket', desc: 'Rectangular pocket in the rail cap for stakes or a bed divider.' },
  'truck.bed_rail_cap': { name: 'Bed rail cap', desc: 'Black plastic cap over the top of the box sides and the front wall.' },
  'truck.cargo_lamp': { name: 'Cargo lamp', desc: 'Clear lenses at the ends of the center high-mounted stop lamp light the box.' },
  'truck.tailgate': { name: 'Tailgate', desc: 'Stamped steel gate on bottom hinge pins; lift the handle and pull to drop it to horizontal on its cables.' },
  'truck.tailgate_handle': { name: 'Tailgate handle', desc: 'Recessed black pull handle at the top center; lifting it releases the two side latches.' },
  'truck.tailgate_cable': { name: 'Tailgate support cable', desc: 'Steel cable that holds the open gate level; slack when closed, taut at horizontal.' },
  'truck.tailgate_hinge': { name: 'Tailgate hinge pin', desc: 'Steel hinge pin and bracket at the lower rear corner of the box side.' },
  'truck.tailgate_latch': { name: 'Tailgate latch striker', desc: 'Steel striker on the box side that the gate latch catches.' },
  'truck.taillamp': { name: 'Taillamp', desc: 'Vertical rear lamp: red brake and tail section, amber turn section, clear backup section.' },
  'truck.rear_marker': { name: 'Rear side marker', desc: 'Red side marker lens that wraps the rear corner of the bedside.' },
  'truck.chmsl': { name: 'Center high-mounted stop lamp', desc: 'Third brake lamp on the rear edge of the cab roof.' },
  'truck.rear_bumper': { name: 'Rear step bumper', desc: 'Chrome steel LT bumper with a black rubber step pad on top and a black lower valance.' },
  'truck.bumper_step': { name: 'Bumper step pad', desc: 'Black textured rubber pad, the step used to climb into the box.' },
  'truck.license_plate': { name: 'License plate', desc: 'Rear plate position in the bumper face; the plate shown is blank.' },
  'truck.hitch': { name: 'Receiver hitch', desc: 'Plain 2 in receiver tube mounted under the rear bumper.' },
  'truck.trailer_plug': { name: 'Trailer wiring socket', desc: '7-pin round trailer connector on a bracket beside the hitch.' },
  'truck.safety_chain_loop': { name: 'Safety chain loop', desc: 'Steel D-ring on the hitch crossmember for trailer safety chains.' },
  'truck.bumper_bracket': { name: 'Bumper bracket', desc: 'Black steel arm carrying the bumper from the frame rail.' },
  'truck.fuel_door': { name: 'Fuel filler door', desc: 'Round door on the driver-side bedside, hinged at its forward edge, over the diesel filler.' },
  'truck.fuel_cap': { name: 'Diesel fuel cap', desc: 'Black filler cap marked DIESEL FUEL ONLY.' },
  'truck.badge_duramax': { name: 'DURAMAX badge', desc: 'Black and red Duramax diesel badge on the front door.' },
  'truck.badge_2500hd': { name: '2500 HD badge', desc: 'Chrome 2500HD badge with the small bowtie on the front door.' },
  'truck.badge_silverado': { name: 'SILVERADO badge', desc: 'Chrome Silverado nameplate with bowtie on the lower left of the tailgate; the only tailgate lettering.' },
  'truck.decal_4x4': { name: '4x4 decal', desc: 'Silver 4x4 decal with a red X on the bedside, ahead of the taillamp.' },
};
const L = (id) => { if (!REAR_LABELS[id]) throw new Error(`rear.js: unknown label ${id}`); return id; };

// ---------------------------------------------------------------------------------------------------------------
// Dimensions (inches). Spec values come from truckSpec.js; the rest are read off IMG_2859, 2854, 2855, 2861, 2872 and 05b..05d.
const D = spec.dims;
export const BED = {
  sFront: ST.bedFront + 0.4,           // where the bedside skin panels start (body.js)
  sFloorFront: 111.9,                  // inner face of the headache wall
  sEnd: ST.bedEnd,                     // rear end faces of the box sides
  floorY: H.bedFloor,                  // top of the rib valleys (spec estimate 37.4 in)
  railY: H.bedRail,                    // top of the rail caps (56.0 in)
  inHalf: D.bedInsideWidthIn / 2,      // 33.0 in half width between the inner walls
  tubHalf: D.bedBetweenWheelWellsIn / 2, // 25.0 in half width between the wheel tubs
  tubHeight: 8.8,                      // tub top above the floor (IMG_2854: tub is a bit under half the wall height)
  tubLength: 18.6,                     // half length of the tub at the floor
  axleS: WB,
};
export const GATE = {
  pivotS: 190.8, pivotY: BED.floorY + 0.4, // hinge pin axis; the inner face is flush with the floor when the gate is down
  halfW: 35.0, vBottom: -5.2, vTop: 18.2,  // gate-local: v is the height above the pivot (top = 56.0 in)
  wInner: 0.4, wOuter: 2.5,                // inner and outer skin planes, measured rearward from the pivot axis
  openAngle: Math.PI / 2,
  cable: { box: [34.1, 45.5, 191.1], gate: [35.25, 12.0, 0.9] }, // anchor on the box side end face / on the gate edge (gate-local)
  gap: D.panelGapMm / 25.4,
};

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers (unit tested)
export const tailgateAngle = (open01) => clamp(open01, 0, 1) * GATE.openAngle;

// gate-local point (x, v, w) -> truck-frame inches for a given hinge angle (rotation about the +X axis through the pivot)
export function gatePointAt(angle, local) {
  const [x, v, w] = local; const c = Math.cos(angle), s = Math.sin(angle);
  return [x, GATE.pivotY + v * c - w * s, GATE.pivotS + v * s + w * c];
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const cableDistance = (angle, side = 1) => {
  const A = [side * GATE.cable.box[0], GATE.cable.box[1], GATE.cable.box[2]];
  const G3 = gatePointAt(angle, [side * GATE.cable.gate[0], GATE.cable.gate[1], GATE.cable.gate[2]]);
  return dist3(A, G3);
};
// cable length: exactly taut at the fully open (horizontal) position
export const CABLE_LENGTH = cableDistance(GATE.openAngle);

// points of a hanging cable between A and B of length L: the chord plus a vertical parabolic sag (gravity), the sag solved so
// that the arc length equals the cable length
export function cablePoints(A, B, L, n = 14) {
  const d = dist3(A, B);
  const at = (sag, m) => { const out = []; for (let i = 0; i <= m; i++) { const t = i / m; out.push([lerp(A[0], B[0], t), lerp(A[1], B[1], t) - 4 * sag * t * (1 - t), lerp(A[2], B[2], t)]); } return out; };
  let sag = 0;
  if (L > d + 1e-9) {
    let lo = 0, hi = L; // the sag can never exceed the cable length
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (polylineLength(at(mid, 40)) < L) lo = mid; else hi = mid; }
    sag = (lo + hi) / 2;
  }
  return at(sag, n);
}
export const polylineLength = (pts) => pts.reduce((s, p, i) => (i ? s + dist3(p, pts[i - 1]) : 0), 0);

// timeline of the tailgate: returns { open01, handle01, done } for t seconds after pressing E.
// open: lift the handle (0.3 s), the gate drops under its own weight (about 0.55 s), cables snap taut with a small rebound.
// close: the gate is pushed up (0.8 s, eased), the handle drops back when the latch catches.
export function tailgateTimeline(dir, t) {
  if (dir === 'open') {
    const hRamp = clamp(t / 0.3, 0, 1);
    const tau = (t - 0.22) / 0.55; // gate starts falling a little before the handle is fully up
    let o = 0, done = false;
    if (tau <= 0) o = 0;
    else if (tau < 1) o = tau * tau;
    else { const b = (tau - 1) / 0.42; o = b < 1 ? 1 - 0.035 * Math.sin(Math.PI * b) : 1; done = b >= 1; }
    return { open01: clamp(o, 0, 1), handle01: hRamp, done };
  }
  const k = clamp(t / 0.85, 0, 1);
  const o = 1 - smooth(k);
  return { open01: o, handle01: 0, done: t >= 0.95 };
}

// stamped floor ribs: distance-based profile, 13 ribs, lengthwise (IMG_2855). Returns the raised fraction (0..1) at lateral x.
export const RIBS = { period: 5.08, count: 13, topW: 1.75, slopeW: 0.85, height: 0.55 };
export function ribFraction(x) {
  const p = RIBS.period, half = (RIBS.count - 1) / 2;
  const k = clamp(Math.round(x / p), -half, half);
  const d = Math.abs(x - k * p);
  return 1 - sstep(RIBS.topW / 2, RIBS.topW / 2 + RIBS.slopeW, d);
}

// ---------------------------------------------------------------------------------------------------------------
// geometry helpers
// grid surface: us, vs are parameter arrays; fn(u, v, i, j) -> [x, y, z, uTex?, vTex?]
function surf(us, vs, fn, { flip = false } = {}) {
  const nu = us.length, nv = vs.length;
  const pos = new Float32Array(nu * nv * 3), uv = new Float32Array(nu * nv * 2);
  let k = 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const p = fn(us[i], vs[j], i, j);
    pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
    uv[k * 2] = p[3] !== undefined ? p[3] : us[i]; uv[k * 2 + 1] = p[4] !== undefined ? p[4] : vs[j]; k++;
  }
  const idx = [];
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const a = j * nu + i, b = a + 1, c = a + nu + 1, d = a + nu;
    if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => lerp(a, b, i / n));
// sorted sample list over [a, b]: a coarse grid plus fine sampling around feature edges
function samples(a, b, coarse, edges = [], zone = 0.4, fine = 0.13) {
  const set = new Set([+a.toFixed(4), +b.toFixed(4)]);
  for (let v = a; v < b; v += coarse) set.add(+v.toFixed(4));
  for (const e of edges) for (let d = -zone; d <= zone + 1e-6; d += fine) { const v = e + d; if (v > a + 1e-3 && v < b - 1e-3) set.add(+v.toFixed(4)); }
  return [...set].sort((p, q) => p - q);
}
// closed convex-ish polygon (points [x,y,z]) filled with a fan: lids and end closures
function fanGeometry(pts) {
  const c = [0, 0, 0]; pts.forEach((p) => { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; });
  const pos = [...c]; pts.forEach((p) => pos.push(...p));
  const idx = []; for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  return g;
}
const withUV = (g) => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 2).fill(0), 2)); return g; };
// stamped rounded-rectangle pocket indicator (1 inside, smooth edge) on a periodic strip
function pocketMask(a, b, { P, c0, pw, b0, b1, r }) {
  const k = Math.round((a - c0) / P), c = c0 + k * P;
  const dx = Math.abs(a - c) - (pw / 2 - r), bc = (b0 + b1) / 2, dy = Math.abs(b - bc) - ((b1 - b0) / 2 - r);
  const sd = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
  return 1 - sstep(-0.28, 0.28, sd);
}

// ---------------------------------------------------------------------------------------------------------------
// textures (browser only; nodes without a DOM get plain materials so the builder stays testable)
function grainNormal(size, seed, strength = 0.8, repeat = [1, 1]) {
  if (!hasDom()) return null;
  const n = Math.min(size, 256), f = noiseField(n, n, 56, seed, 3, 0.6);
  return tex(heightToNormal(f, n, n, strength), { repeat, srgb: false });
}
function padNormal(size) {
  if (!hasDom()) return null;
  const n = Math.min(size, 512), field = new Float32Array(n * n);
  // tile = 4 x 2 raised rectangular cells, with narrow grooves between them and a soft rolled edge
  const cw = n / 4, ch = n / 2, groove = n * 0.028, soft = n * 0.02;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const fx = x % cw, fy = y % ch;
    const d = Math.min(fx, cw - fx, fy, ch - fy);
    field[y * n + x] = smooth(clamp((d - groove) / soft, 0, 1));
  }
  return tex(heightToNormal(field, n, n, 2.4), { repeat: [1 / 16, 1 / 4.4], srgb: false });
}
function plateTexture() {
  if (!hasDom()) return null;
  const c = makeCanvas(512, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#f2f3f4'); g.addColorStop(1, '#dfe2e4'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  x.strokeStyle = '#24304f'; x.lineWidth = 7; x.strokeRect(14, 14, 484, 228);
  x.strokeStyle = '#8a93a6'; x.lineWidth = 2; x.strokeRect(26, 26, 460, 204);
  x.fillStyle = '#7f8794'; for (const px of [150, 362]) { x.beginPath(); x.arc(px, 28, 9, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------------------------------------------------------------------------------------------------------------
export function buildRear({ quality } = {}) {
  const root = new THREE.Group(); root.name = 'rear'; root.scale.setScalar(IN);
  const parts = {};
  const texSize = (quality && quality.tex) || 512;

  // ---- materials ----
  const paint = mat.paint(); paint.side = THREE.DoubleSide;
  const chrome = mat.chrome(); chrome.side = THREE.DoubleSide;
  const grain = grainNormal(texSize, 11, 0.6, [0.12, 0.12]);
  const capBlack = new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide, normalMap: grain, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.7 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2c2e32, roughness: 0.58, metalness: 0.35, side: THREE.DoubleSide, normalMap: grain, normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.8 });
  const wallPaint = mat.paint(); wallPaint.side = THREE.DoubleSide;
  const steelBlack = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.8 });
  const steelRaw = new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 0.38, metalness: 0.95, envMapIntensity: 1.1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.9, metalness: 0, normalMap: padNormal(texSize), normalScale: new THREE.Vector2(1.0, 1.0), side: THREE.DoubleSide });
  const holeBlack = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 1, metalness: 0 });
  const add = (parent, geom, material, name, { cast = true, label = null } = {}) => {
    const m = new THREE.Mesh(geom, material); m.name = name; m.castShadow = cast; m.receiveShadow = true;
    if (label) m.userData.labelId = L(label); parent.add(m); return m;
  };

  const FY = BED.floorY, SE = BED.sEnd, IH = BED.inHalf;
  const bed = new THREE.Group(); bed.name = 'bed_box'; bed.userData.labelId = L('truck.bed'); root.add(bed);

  // =========================================================================================================
  // 1. BED BOX
  // ---- floor: lengthwise ribs, 13 ribs; valleys at floorY, ribs raised 0.55 in; slab below ----
  {
    const xs = new Set([-IH, IH]);
    const half = (RIBS.count - 1) / 2;
    for (let k = -half; k <= half; k++) for (const o of [-(RIBS.topW / 2 + RIBS.slopeW), -RIBS.topW / 2, RIBS.topW / 2, RIBS.topW / 2 + RIBS.slopeW]) { const x = k * RIBS.period + o; if (Math.abs(x) < IH) xs.add(+x.toFixed(3)); }
    const us = [...xs].sort((a, b) => a - b);
    const s0 = BED.sFloorFront, s1 = SE - 4.8; // ribs end before the rear sill
    const vs = [s0, s0 + 1.0, s0 + 2.4, 130, 160, s1 - 2.6, s1 - 1.0, s1];
    const g = surf(us, vs, (x, s) => {
      const taper = sstep(s0 + 0.6, s0 + 2.4, s) * (1 - sstep(s1 - 2.6, s1 - 0.8, s));
      return [x, FY + RIBS.height * ribFraction(x) * taper, s, x, s];
    }, { flip: true });
    add(bed, g, floorMat, 'bed_floor', { cast: false, label: 'truck.bed_floor' });
    // rear sill (flat step under the gate) and the slab under the floor
    add(bed, new THREE.BoxGeometry(2 * IH, 1.2, 4.9), floorMat, 'bed_sill', { cast: false, label: 'truck.bed_floor' }).position.set(0, FY - 0.5, SE - 2.4);
    add(bed, new THREE.BoxGeometry(2 * IH + 0.4, 1.4, SE - s0 + 0.4), steelBlack, 'bed_floor_slab', { cast: false }).position.set(0, FY - 0.8, (s0 + SE) / 2);
  }

  // ---- inner side walls: body color, stamped vertical pockets pushed outward; sample lines follow the pocket edges ----
  const WALL = { P: 8.9, c0: 116.45, pw: 5.4, b0: 41.6, b1: 52.2, r: 1.3, depth: 0.55 };
  for (const sg of [-1, 1]) {
    const edges = []; for (let k = -2; k < 12; k++) { const c = WALL.c0 + k * WALL.P; edges.push(c - WALL.pw / 2, c + WALL.pw / 2); }
    const us = samples(BED.sFloorFront, SE, 4, edges), vs = samples(FY - 0.2, 55.4, 3.0, [WALL.b0, WALL.b1]);
    const g = surf(us, vs, (s, y) => [sg * (IH + WALL.depth * pocketMask(s, y, { P: WALL.P, c0: WALL.c0, pw: WALL.pw, b0: WALL.b0, b1: WALL.b1, r: WALL.r })), y, s, s, y], { flip: sg > 0 });
    add(bed, g, wallPaint, `bed_wall_${sg > 0 ? 'R' : 'L'}`, { cast: false, label: 'truck.bed_wall' });
    // quarter-round bead where the wall meets the floor
    const bead = new THREE.CylinderGeometry(0.45, 0.45, SE - BED.sFloorFront, 8); bead.rotateX(Math.PI / 2);
    const bm = add(bed, bead, floorMat, `bed_floor_bead_${sg > 0 ? 'R' : 'L'}`, { cast: false }); bm.position.set(sg * (IH - 0.25), FY + 0.1, (BED.sFloorFront + SE) / 2);
  }

  // ---- headache (front) wall: stamped pockets recessed toward the cab ----
  {
    const FW = { P: 5.5, c0: 0, pw: 3.5, b0: 40.8, b1: 52.8, r: 0.9, depth: 0.5 };
    const edges = []; for (let k = -7; k <= 7; k++) edges.push(k * FW.P - FW.pw / 2, k * FW.P + FW.pw / 2);
    const us = samples(-IH, IH, 4, edges), vs = samples(FY - 0.2, 55.3, 3, [FW.b0, FW.b1]);
    const g = surf(us, vs, (x, y) => [x, y, BED.sFloorFront - FW.depth * pocketMask(x, y, FW), x, y]);
    add(bed, g, wallPaint, 'bed_front_wall', { cast: false, label: 'truck.headache_wall' });
    // cab rear wall above and behind it (body color), up to the rear glass
    const cb = surf(lin(-1, 1, 20), lin(0, 1, 8), (u, v) => {
      const y = lerp(43.0, 58.5, v), x = u * 36.0;
      const s = lerp(110.05, 109.4, sstep(0.86, 1, v)) + 0.7 * (1 - u * u) * 0.0;
      return [x, y, s, x, y];
    });
    add(bed, cb, paint, 'cab_rear_wall', { cast: false, label: 'truck.headache_wall' });
  }

  // ---- wheel tubs ----
  for (const sg of [-1, 1]) {
    const prof = [[24.2, 0], [24.65, 0.3], [25.4, 0.7], [26.6, 0.93], [28.4, 1.0], [30.4, 0.985], [31.8, 0.97], [33.4, 0.99]];
    const phis = lin(-Math.PI / 2, Math.PI / 2, 40);
    const A = BED.tubLength, HT = BED.tubHeight;
    const g = surf(prof.map((_, i) => i), phis, (i, phi) => {
      const d = Math.sin(phi); // -1..1 along the tub
      const h = HT * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(d), 3.1)), 1 / 3.1);
      const [x, f] = prof[i];
      return [sg * x, FY + 0.05 + h * f, BED.axleS + A * d, x, BED.axleS + A * d];
    }, { flip: sg < 0 });
    add(bed, g, floorMat, `wheel_tub_${sg > 0 ? 'R' : 'L'}`, { label: 'truck.wheel_tub' });
  }

  // ---- black plastic rail caps over the sides (also covering the seam to the bedside skin) ----
  const capGeo = (sg) => {
    const ss = lin(BED.sFront - 0.25, SE, 44);
    const P = (s) => {
      const f = (y) => halfWidth(s, y);
      return [[f(52.4) + 0.2, 52.4], [f(53.6) + 0.22, 53.6], [f(54.8) + 0.22, 54.8], [f(55.6) + 0.12, 55.7], [f(55.8) - 0.5, 56.0], [(f(55.8) - 0.5 + 34.2) / 2, 56.07], [34.4, 56.0], [33.5, 55.75], [32.8, 55.2], [32.7, 54.0]];
    };
    const g = surf(lin(0, 9, 9), ss, (i, s) => { const p = P(s)[i]; return [sg * p[0], p[1], s, s, i]; }, { flip: sg > 0 });
    const ends = [ss[0], ss[ss.length - 1]].map((s) => fanGeometry(P(s).map((p) => [sg * p[0], p[1], s])));
    return mergeGeometries([g, ...ends.map(withUV)], false);
  };
  for (const sg of [-1, 1]) add(bed, capGeo(sg), capBlack, `rail_cap_${sg > 0 ? 'R' : 'L'}`, { label: 'truck.bed_rail_cap' });
  // front rail cap across the headache wall
  {
    const gm = roundedBoxGeometry(2 * IH + 1.4, 1.1, 2.6, 0.3, 3); const m = add(bed, withUV(gm), capBlack, 'rail_cap_front', { label: 'truck.bed_rail_cap' });
    m.position.set(0, 55.45, 112.2);
  }

  // ---- rear end faces of the box sides (body color) ----
  for (const sg of [-1, 1]) {
    const g = surf(lin(0, 1, 6), lin(0, 1, 10), (u, v) => {
      const y = lerp(FY, BED.railY - 0.25, v);
      const xo = halfWidth(SE, y) - 0.12;
      return [sg * lerp(IH, xo, u), y, SE + 0.03, u, v];
    }, { flip: sg < 0 });
    add(bed, g, paint, `bed_end_face_${sg > 0 ? 'R' : 'L'}`, { cast: false });
  }

  // ---- stake pockets in the rail caps: dark pockets with a raised lip ----
  {
    const sPocket = [117.0, 184.4];
    for (const sg of [-1, 1]) for (const s of sPocket) {
      const grp = new THREE.Group(); grp.userData.labelId = L('truck.stake_pocket'); grp.name = 'stake_pocket';
      const lip = new THREE.Mesh(roundedBoxGeometry(2.7, 3.3, 0.18, 0.06, 2), capBlack); lip.rotation.x = Math.PI / 2; lip.position.y = 0.02;
      const hole = new THREE.Mesh(roundedBoxGeometry(2.0, 2.6, 0.2, 0.05, 2), holeBlack); hole.rotation.x = Math.PI / 2; hole.position.y = 0.1;
      grp.add(lip, hole); grp.position.set(sg * 34.6, 56.0, s); root.add(grp);
    }
  }

  // ---- tie-down hooks (4 per side), instanced: stamped base plate and a bent loop ----
  {
    const loop = new THREE.TorusGeometry(0.95, 0.19, 8, 20, Math.PI * 1.35); loop.rotateY(Math.PI / 2); loop.translate(0.55, 0.0, 0);
    const base = new THREE.BoxGeometry(0.16, 1.5, 2.4); base.translate(0.08, 0, 0);
    const hook = mergeGeometries([withUV(loop), withUV(base)], false);
    const sList = [120.9, 129.8, 174.3, 183.2];
    const im = new THREE.InstancedMesh(hook, steelBlack, sList.length * 2); im.name = 'tie_down_hooks'; im.castShadow = true; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    let n = 0;
    for (const sg of [-1, 1]) for (const s of sList) {
      q.setFromEuler(new THREE.Euler(0, sg > 0 ? Math.PI : 0, 0)); p.set(sg * (IH - 0.01), 45.0, s); m4.compose(p, q, sc); im.setMatrixAt(n++, m4);
    }
    im.userData.labelId = L('truck.tie_down'); bed.add(im);
  }

  // ---- bed lamp: cargo lamps are part of the CHMSL (below) ----

  // =========================================================================================================
  // 2. TAILGATE (pivot group on the hinge axis; geometry is built relative to the pivot)
  const gateGroup = new THREE.Group(); gateGroup.name = 'tailgate';
  gateGroup.position.set(0, GATE.pivotY, GATE.pivotS);
  const gate = { group: gateGroup, openAngle: GATE.openAngle, open01: 0 };
  {
    const HW = GATE.halfW, WI = GATE.wInner, WO = GATE.wOuter;
    const vB = GATE.vBottom, vT = 15.2, R = 0.8;
    const wBase = (x, v) => WO + 0.11 * (1 - Math.pow(x / HW, 2)) + 0.28 * (1 - sstep(-2.35, -1.55, v)) - 0.06 * sstep(2, 9, v) + 0.0;
    const edgeW = (x, v) => { const d = Math.min(HW - Math.abs(x), v - vB); if (d >= R) return wBase(x, v); const q = Math.sqrt(1 - Math.pow(1 - d / R, 2)); return lerp(WI, wBase(x, v), q); };
    const ex = [0, 0.06, 0.16, 0.3, 0.48, 0.7, R].map((d) => HW - d), xsOuter = [...ex.map((x) => -x).reverse(), ...[-28, -20, -12, -5.8, 0, 5.8, 12, 20, 28], ...ex];
    const ev = [0, 0.06, 0.16, 0.3, 0.48, 0.7].map((d) => vB + d);
    const vsOuter = [...ev, -2.5, -2.2, -1.9, -1.6, -1.3, -0.9, 0.5, 2, 4.5, 7, 9.5, 12, 14, vT];
    const outer = surf(xsOuter, vsOuter, (x, v) => [x, v, edgeW(x, v), x, v]);
    add(gateGroup, outer, paint, 'gate_outer', { label: 'truck.tailgate' });

    // inner panel: faces the bed; ribbed like the floor (ribs toward the viewer), dark e-coat like the floor
    const xsIn = (() => { const s = new Set([-HW, HW, -HW + 0.4, HW - 0.4]); const half = (RIBS.count - 1) / 2; for (let k = -half; k <= half; k++) for (const o of [-(RIBS.topW / 2 + RIBS.slopeW), -RIBS.topW / 2, RIBS.topW / 2, RIBS.topW / 2 + RIBS.slopeW]) { const x = k * RIBS.period + o; if (Math.abs(x) < HW - 0.8) s.add(+x.toFixed(3)); } return [...s].sort((a, b) => a - b); })();
    const vsIn = [vB, vB + 0.5, vB + 1.4, 0, 7, 11.5, vT - 3.0 - 0.2, 14.6, vT - 3.4];
    vsIn.sort((a, b) => a - b);
    const inner = surf(xsIn, [...new Set(vsIn)], (x, v) => {
      const edge = sstep(HW - 0.9, HW - 0.3, Math.abs(x)) , vedge = 1 - sstep(vB + 0.4, vB + 1.4, v);
      const rib = ribFraction(x) * (1 - Math.max(edge, vedge)) * (1 - sstep(13.6, 14.6, v));
      return [x, v, WI + 0.5 * (1 - rib) * (1 - Math.max(edge, vedge)) * 1.0 + 0.0, x, v];
    }, { flip: true });
    add(gateGroup, inner, floorMat, 'gate_inner', { cast: false, label: 'truck.tailgate' });
    // latch pocket on the inner panel with three bolts, as in IMG_2854
    const pocketPlate = new THREE.Mesh(roundedBoxGeometry(9.6, 5.2, 0.12, 0.05, 2), steelBlack); pocketPlate.position.set(0, 2.2, WI + 0.28); gateGroup.add(pocketPlate);
    for (const bx of [-2.6, 0, 2.6]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), steelRaw); b.rotation.x = Math.PI / 2; b.position.set(bx, 0.6, WI + 0.38); gateGroup.add(b); }

    // top cap: black plastic, rounded, spanning the whole gate (IMG_2859: wide black band across the top)
    const sh = new THREE.Shape();
    sh.moveTo(-0.4, 14.9); sh.lineTo(2.78, 14.9); sh.lineTo(2.78, 17.55); sh.quadraticCurveTo(2.78, 18.2, 2.12, 18.2); sh.lineTo(-0.0, 18.2); sh.quadraticCurveTo(-0.4, 18.2, -0.4, 17.8); sh.closePath();
    const cg = new THREE.ExtrudeGeometry(sh, { depth: 2 * HW + 0.5, bevelEnabled: false, curveSegments: 6 });
    cg.rotateY(-Math.PI / 2); cg.translate(HW + 0.25, 0, 0); cg.computeVertexNormals();
    add(gateGroup, cg, capBlack, 'gate_cap', { label: 'truck.tailgate' });

    // handle: bezel, finger recess and pull lever (the lever lifts when the gate is released)
    const handle = new THREE.Group(); handle.name = 'tailgate_handle'; handle.userData.labelId = L('truck.tailgate_handle');
    const wH = WO + 0.11 + 0.02;
    const bezel = new THREE.Mesh(withUV(roundedBoxGeometry(10.4, 4.9, 0.9, 0.55, 4)), capBlack); bezel.position.set(0, 0, wH - 0.35); handle.add(bezel);
    const recess = new THREE.Mesh(withUV(roundedBoxGeometry(8.7, 2.5, 0.3, 0.45, 3)), holeBlack); recess.position.set(0, -0.8, wH + 0.12); handle.add(recess);
    const lever = new THREE.Group(); lever.position.set(0, 0.95, wH + 0.2);
    const bar = new THREE.Mesh(withUV(roundedBoxGeometry(8.0, 1.2, 0.5, 0.22, 3)), capBlack); bar.position.set(0, -0.6, 0.0); lever.add(bar); handle.add(lever);
    handle.position.set(0, 10.4, 0); gateGroup.add(handle);
    gate.handle = { group: handle, lever, set: (h01) => { lever.rotation.x = -0.55 * clamp(h01, 0, 1); lever.position.z = wH + 0.2 + 0.25 * clamp(h01, 0, 1); } };
    for (const o of handle.children) { o.castShadow = false; o.receiveShadow = true; }

    // SILVERADO badge, lower left as seen from behind
    const bd = buildSilveradoBadge({ wSkin: WO + 0.28 });
    if (bd) gateGroup.add(bd);

    // hinge pins on both sides, and eyelets for the cables
    for (const sg of [-1, 1]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.0, 14), steelRaw); pin.rotation.z = Math.PI / 2; pin.position.set(sg * (HW + 0.2), 0, 0); pin.name = 'tailgate_hinge_pin'; pin.userData.labelId = L('truck.tailgate_hinge'); pin.castShadow = false; gateGroup.add(pin);
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 8, 14), steelRaw); eye.rotation.y = Math.PI / 2; eye.position.set(sg * (GATE.cable.gate[0] + 0.25), GATE.cable.gate[1], GATE.cable.gate[2]); eye.userData.labelId = L('truck.tailgate_cable'); gateGroup.add(eye);
    }
  }
  root.add(gateGroup);
  // hinge brackets (steel) and latch strikers on the box end faces
  for (const sg of [-1, 1]) {
    const hb = new THREE.Mesh(withUV(roundedBoxGeometry(2.4, 5.4, 0.35, 0.12, 2)), steelBlack); hb.position.set(sg * 34.2, 39.6, SE + 0.22); hb.userData.labelId = L('truck.tailgate_hinge'); root.add(hb);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 14), steelBlack); cup.rotation.z = Math.PI / 2; cup.position.set(sg * 34.2, GATE.pivotY, GATE.pivotS + 0.3); cup.userData.labelId = L('truck.tailgate_hinge'); root.add(cup);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 10), steelRaw); st.rotation.x = Math.PI / 2; st.position.set(sg * 34.0, 53.0, SE + 0.55); st.userData.labelId = L('truck.tailgate_latch'); root.add(st);
    const anc = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 8, 14), steelRaw); anc.position.set(sg * GATE.cable.box[0], GATE.cable.box[1], GATE.cable.box[2] + 0.1); anc.userData.labelId = L('truck.tailgate_cable'); root.add(anc);
  }

  // ---- support cables (steel, tube follows a sagging parabola between the anchors) ----
  const cables = {};
  {
    const N = 14, RAD = 6, r = 0.13;
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.45, envMapIntensity: 1.0 });
    for (const sg of [-1, 1]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * RAD * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((N + 1) * RAD * 2), 2));
      const idx = []; for (let i = 0; i < N; i++) for (let k = 0; k < RAD; k++) { const a = i * RAD + k, b = i * RAD + (k + 1) % RAD, c = a + RAD, d = b + RAD; idx.push(a, b, c, b, d, c); }
      g.setIndex(idx);
      const mesh = new THREE.Mesh(g, cableMat); mesh.name = `tailgate_cable_${sg > 0 ? 'R' : 'L'}`; mesh.userData.labelId = L('truck.tailgate_cable'); mesh.frustumCulled = false; mesh.castShadow = false; root.add(mesh);
      cables[sg] = { mesh, update(angle) {
        const A = [sg * GATE.cable.box[0], GATE.cable.box[1], GATE.cable.box[2] + 0.1];
        const B = gatePointAt(angle, [sg * GATE.cable.gate[0], GATE.cable.gate[1], GATE.cable.gate[2]]);
        const pts = cablePoints(A, B, CABLE_LENGTH + 0.1, N);
        const pos = g.attributes.position.array;
        for (let i = 0; i <= N; i++) {
          const p = pts[i], q = pts[Math.min(N, i + 1)], o = pts[Math.max(0, i - 1)];
          const T = new THREE.Vector3(q[0] - o[0], q[1] - o[1], q[2] - o[2]).normalize();
          const N1 = new THREE.Vector3().crossVectors(T, new THREE.Vector3(1, 0, 0)); if (N1.lengthSq() < 1e-6) N1.set(0, 1, 0); N1.normalize();
          const N2 = new THREE.Vector3().crossVectors(T, N1).normalize();
          for (let k = 0; k < RAD; k++) { const a = (k / RAD) * Math.PI * 2; const cx = Math.cos(a) * r, cy = Math.sin(a) * r; const j = (i * RAD + k) * 3; pos[j] = p[0] + N1.x * cx + N2.x * cy; pos[j + 1] = p[1] + N1.y * cx + N2.y * cy; pos[j + 2] = p[2] + N1.z * cx + N2.z * cy; }
        }
        g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
      } };
    }
  }
  gate.cables = cables;
  gate.anchors = { box: { L: GATE.cable.box.map((v, i) => (i === 0 ? -v : v)), R: GATE.cable.box.slice() }, gateLocal: { L: GATE.cable.gate.map((v, i) => (i === 0 ? -v : v)), R: GATE.cable.gate.slice() }, units: 'inches, truck frame / gate local (x, v above hinge, w rearward)' };
  gate.cableLengthIn = CABLE_LENGTH;
  gate.set = (open01, handle01) => {
    const o = clamp(open01, 0, 1); gate.open01 = o;
    const ang = tailgateAngle(o); gateGroup.rotation.x = ang;
    cables[-1].update(ang); cables[1].update(ang);
    if (handle01 !== undefined) gate.handle.set(handle01);
  };
  // interaction: E toggles; the timeline drives gate and handle
  const tgState = { open: false, busy: false };
  gateGroup.userData.labelId = L('truck.tailgate');
  gateGroup.userData.interact = {
    get prompt() { return tgState.open ? 'Close tailgate' : 'Open tailgate'; },
    run(ctx) {
      if (tgState.busy) return; tgState.busy = true;
      const dir = tgState.open ? 'close' : 'open'; let t = 0;
      ctx.say?.(dir === 'open' ? 'Lift the handle and pull the tailgate toward you' : 'Push the tailgate firmly up until it latches');
      ctx.animate?.((dt) => {
        t += dt; const s = tailgateTimeline(dir, t); gate.set(s.open01, s.handle01);
        if (s.done) { tgState.open = dir === 'open'; tgState.busy = false; gate.set(tgState.open ? 1 : 0, 0); ctx.say?.(tgState.open ? 'Tailgate down, hanging on its cables' : 'Tailgate latched'); return true; }
        return false;
      });
    },
  };
  gate.state = tgState;
  gate.set(0, 0);
  parts.tailgate = gate;

  // =========================================================================================================
  // 3. REAR END
  // ---- rear corner pods: painted lower corner, black lamp housing, lens sections ----
  const POD = { xi: 35.3, sRear: 193.3, yPaint0: 26.0, yPaintTop: 36.0, yLamp0: 35.9, yLamp1: 52.6, yLens0: 36.8, yLens1: 51.9 };
  // plan curve of the corner at height y: t in [0, 1] runs along a quarter ellipse from the side skin at the box end (s = 191) around to the
  // rear face; t < 0 continues forward along the side skin so that the lens can wrap a little onto the bedside (05d)
  const plan = (sg, y, t, off = 0) => {
    const xo = halfWidth(SE, y);
    if (t < 0) { const s = SE + t * 4.5; return [sg * (halfWidth(s, y) + off), s]; }
    const a = xo - POD.xi, b = POD.sRear - SE;
    const ang = (t * Math.PI) / 2, x = POD.xi + a * Math.cos(ang), s = SE + b * Math.sin(ang);
    // outward normal of the quarter ellipse in the (x, s) plane
    const tx = -a * Math.sin(ang), ts = b * Math.cos(ang), nl = Math.hypot(tx, ts) || 1, nx = ts / nl, ns = -tx / nl;
    return [sg * (x + nx * off), s + ns * off];
  };
  const lampMats = {
    red: new THREE.MeshPhysicalMaterial({ color: 0x9c0d0d, roughness: 0.08, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0xff1010, emissiveIntensity: 0.0, envMapIntensity: 1.5, side: THREE.DoubleSide }),
    amber: new THREE.MeshPhysicalMaterial({ color: 0xd88410, roughness: 0.08, transparent: true, opacity: 0.8, clearcoat: 1, emissive: 0xff8c10, emissiveIntensity: 0.0, envMapIntensity: 1.3, side: THREE.DoubleSide }),
    clear: new THREE.MeshPhysicalMaterial({ color: 0xeff2f1, roughness: 0.06, transparent: true, opacity: 0.4, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.0, envMapIntensity: 1.5, side: THREE.DoubleSide }),
    marker: new THREE.MeshPhysicalMaterial({ color: 0xb01212, roughness: 0.15, transparent: true, opacity: 0.9, clearcoat: 1, emissive: 0xff1a1a, emissiveIntensity: 0.0, side: THREE.DoubleSide }),
  };
  const reflMat = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
  const reflRed = reflMat(0x4a0606), reflAmber = reflMat(0x6a3a06), reflClear = reflMat(0xb9bdbe);
  const lampGroups = [];
  for (const sg of [-1, 1]) {
    const pod = new THREE.Group(); pod.name = `rear_corner_${sg > 0 ? 'R' : 'L'}`;
    const tss = lin(0, 1, 14);
    // painted corner under the lamp (bedside rear corner), with a bottom lid
    const paintG = surf(tss, lin(POD.yPaint0, POD.yPaintTop, 5), (t, y) => { const [x, s] = plan(sg, y, t); return [x, y, s, t, y]; }, { flip: sg > 0 });
    add(pod, paintG, paint, 'pod_paint', { cast: true });
    add(pod, withUV(fanGeometry([...tss.map((t) => { const [x, s] = plan(sg, POD.yPaint0, t); return [x, POD.yPaint0, s]; }), [sg * POD.xi, POD.yPaint0, SE], [sg * halfWidth(SE, POD.yPaint0), POD.yPaint0, SE]].reverse())), paint, 'pod_paint_lid', { cast: false });
    // lamp housing (black plastic) with top and bottom lids
    const hts = lin(-0.35, 1, 18);
    const hg = surf(hts, lin(POD.yLamp0, POD.yLamp1, 8), (t, y) => { const [x, s] = plan(sg, y, t, t < 0 ? 0.07 : 0.0); return [x, y, s, t, y]; }, { flip: sg > 0 });
    add(pod, hg, capBlack, 'lamp_housing', { cast: false, label: 'truck.taillamp' });
    const lid = (y) => withUV(fanGeometry([...hts.map((t) => { const [x, s] = plan(sg, y, t, t < 0 ? 0.07 : 0.0); return [x, y, s]; }), [sg * POD.xi, y, SE], [sg * POD.xi, y, SE + hts[0] * 4.5]]));
    add(pod, lid(POD.yLamp1), capBlack, 'lamp_top', { cast: false, label: 'truck.taillamp' });
    // lens sections (bottom to top): clear backup, amber turn, red brake/tail
    const sections = [
      { y0: POD.yLens0, y1: 40.4, m: lampMats.clear, r: reflClear, key: 'reverse' },
      { y0: 40.4, y1: 44.6, m: lampMats.amber, r: reflAmber, key: 'turn' },
      { y0: 44.6, y1: POD.yLens1, m: lampMats.red, r: reflRed, key: 'brake' },
    ];
    const bulge = (y) => 0.2 + 0.12 * Math.sin(Math.PI * clamp((y - POD.yLens0) / (POD.yLens1 - POD.yLens0), 0, 1));
    const lensT = (t) => -0.28 + 1.25 * t;
    for (const sec of sections) {
      const ys = lin(sec.y0 + 0.04, sec.y1 - 0.04, 5), ts = lin(0, 1, 9);
      add(pod, surf(ts, ys, (t, y) => { const [x, s] = plan(sg, y, lensT(t), bulge(y)); return [x, y, s, t, y]; }, { flip: sg > 0 }), sec.m, `lens_${sec.key}`, { cast: false, label: 'truck.taillamp' });
      // reflector behind with horizontal fins
      const fins = Math.max(3, Math.round((sec.y1 - sec.y0) / 0.7));
      add(pod, surf(lin(0, 1, 5), lin(sec.y0 + 0.1, sec.y1 - 0.1, fins * 2), (t, y, i, j) => { const fin = (j % 2) * 0.16; const [x, s] = plan(sg, y, lensT(t), 0.02 + fin); return [x, y, s, t, y]; }), sec.r, `reflector_${sec.key}`, { cast: false });
    }
    // bulbs behind the lens (small, shows through the plastic)
    for (const [y, c] of [[48.2, 0xffd0c0], [42.5, 0xffc070], [38.6, 0xffffff]]) { const [x, s] = plan(sg, y, 0.75, 0.0); const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.1, roughness: 0.3 })); b.position.set(x, y, s - 0.05); b.castShadow = false; pod.add(b); }
    // rear side marker: red lens low on the wrap, as in 05d
    add(pod, surf(lin(0, 1, 4), lin(37.4, 43.6, 4), (t, y) => { const [x, s] = plan(sg, y, 0.04 + 0.2 * t, 0.2); return [x, y, s, t, y]; }, { flip: sg > 0 }), lampMats.marker, 'rear_marker', { cast: false, label: 'truck.rear_marker' });
    root.add(pod); lampGroups.push(pod);
  }
  parts.taillamps = lampGroups;
  const lamps = {
    set({ tail = 0, brake = 0, turn = 0, reverse = 0 } = {}) {
      lampMats.red.emissiveIntensity = Math.max(tail * 0.35, brake) * 1.6; lampMats.marker.emissiveIntensity = tail * 0.8;
      lampMats.amber.emissiveIntensity = turn * 2.0; lampMats.clear.emissiveIntensity = reverse * 1.2; lampMats.clear.opacity = 0.4 + 0.2 * reverse;
    },
  };
  parts.lamps = lamps;

  // ---- CHMSL and cargo lamps on the rear edge of the cab roof (IMG_2859) ----
  {
    const g = new THREE.Group(); g.name = 'chmsl'; g.userData.labelId = L('truck.chmsl');
    const body = new THREE.Mesh(withUV(roundedBoxGeometry(11.6, 1.5, 1.0, 0.32, 3)), capBlack); g.add(body);
    const red = new THREE.Mesh(withUV(roundedBoxGeometry(5.8, 1.1, 0.4, 0.2, 3)), lampMats.red); red.position.set(0, 0, 0.5); g.add(red);
    for (const sg of [-1, 1]) { const c = new THREE.Mesh(withUV(roundedBoxGeometry(2.1, 1.0, 0.36, 0.2, 3)), lampMats.clear); c.position.set(sg * 4.1, 0, 0.5); c.userData.labelId = L('truck.cargo_lamp'); g.add(c); }
    g.position.set(0, 74.0, 109.0); root.add(g); parts.chmsl = g;
  }

  // ---- rear step bumper: chrome face, black rubber step pad, valance, shell ----
  const bumper = new THREE.Group(); bumper.name = 'rear_bumper'; bumper.userData.labelId = L('truck.rear_bumper');
  {
    const sR = S_REAR;              // bumper face at the center
    const hwB = 39.3, flat = 21.5, sEnd = 194.6;
    const NC = 16, half = [];  // right half of the path: straight center, then a quarter ellipse wrapping forward to the tip
    for (let i = 0; i <= NC; i++) {
      const phi = (Math.PI / 2) * (i / NC); // 0 at the straight, 90 deg at the tip
      const X = flat + (hwB - flat) * Math.sin(phi), S = sR - (sR - sEnd) * (1 - Math.cos(phi));
      const dx = (hwB - flat) * Math.cos(phi), ds = (sR - sEnd) * Math.sin(phi); // d(x)/dphi, -d(s)/dphi
      const nl = Math.hypot(dx, ds); half.push({ x: X, s: S, nx: ds / nl, ns: dx / nl });
    }
    const P = [];
    for (let i = half.length - 1; i >= 1; i--) P.push({ x: -half[i].x, s: half[i].s, nx: -half[i].nx, ns: half[i].ns });
    P.push({ x: -flat * 0.5, s: sR, nx: 0, ns: 1 }, { x: 0, s: sR, nx: 0, ns: 1 }, { x: flat * 0.5, s: sR, nx: 0, ns: 1 });
    for (let i = 0; i < half.length; i++) P.push(half[i]);
    const yLow = (x) => lerp(21.4, 24.2, 1 - sstep(8, 30, Math.abs(x)));
    // chrome face profile: [v, dn]
    const cp = [[0, -1.1], [0.03, -0.45], [0.08, -0.08], [0.16, 0], [0.86, 0], [0.93, -0.06], [0.98, -0.4], [1, -1.0]];
    const chromeG = surf(lin(0, cp.length - 1, cp.length - 1), P.map((_, i) => i), (ci, pi) => {
      const [v, dn] = cp[ci], p = P[pi];
      const y = lerp(yLow(p.x) - 0.1, 29.15, v);
      return [p.x + p.nx * dn, y, p.s + p.ns * dn, pi, v * 6];
    }, { flip: true });
    add(bumper, chromeG, chrome, 'bumper_chrome', { label: 'truck.rear_bumper' });
    // step pad: black rubber top with a raised rim, forward limit tucks under the box corner
    const padFront = (p) => clamp(p.s - 193.9, 1.7, 7.3);
    const padG = surf(lin(0, 1, 6), P.map((_, i) => i), (u, pi) => {
      const p = P[pi], pf = padFront(p), dn = lerp(-0.7, -pf, u);
      const rim = 0.28 * (sstep(0.0, 0.04, u) * 0 + (1 - sstep(0.04, 0.12, u)) + sstep(0.9, 0.97, u)); // raised rim at both edges
      return [p.x + p.nx * dn, 30.15 + rim * 0.9, p.s + p.ns * dn, p.x, -dn];
    }, { flip: true });
    add(bumper, padG, rubber, 'bumper_pad', { label: 'truck.bumper_step' });
    // lip under the pad edge and rear fascia strip joining chrome to pad
    const lipG = surf(lin(0, 1, 3), P.map((_, i) => i), (v, pi) => { const p = P[pi]; const y = lerp(29.15, 30.4, v); const dn = lerp(-0.1, -0.75, v * v); return [p.x + p.nx * dn, y, p.s + p.ns * dn, pi, v]; }, { flip: true });
    add(bumper, lipG, rubber, 'bumper_pad_lip', { cast: false, label: 'truck.bumper_step' });
    // front edge of the pad and the steel shell below it (visible from under the truck)
    const shell = surf(lin(0, 3, 3), P.map((_, i) => i), (k, pi) => {
      const p = P[pi], pf = padFront(p) + 0.3;
      const pts = [[-0.7, 30.1], [-pf, 30.1], [-pf, 28.6], [-pf, 19.2]][k];
      return [p.x + p.nx * pts[0], pts[1], p.s + p.ns * pts[0], pi, k];
    });
    add(bumper, shell, steelBlack, 'bumper_shell', { cast: false });
    const under = surf(lin(0, 1, 2), P.map((_, i) => i), (u, pi) => { const p = P[pi], pf = padFront(p) + 0.3, dn = lerp(-1.1, -pf, u); return [p.x + p.nx * dn, 19.2, p.s + p.ns * dn, pi, u]; });
    add(bumper, under, steelBlack, 'bumper_underside', { cast: false });
    // black lower valance (center), recessed slightly
    const valP = P.filter((p) => Math.abs(p.x) <= 27.5);
    const val = surf(lin(0, 3, 3), valP.map((_, i) => i), (k, pi) => {
      const p = valP[pi]; const yTop = yLow(p.x) + 0.35; const y = [19.0, 19.5, yTop - 0.6, yTop][k]; const dn = [-1.0, -0.35, -0.3, -0.5][k];
      return [p.x + p.nx * dn, y, p.s + p.ns * dn, pi, k];
    }, { flip: true });
    add(bumper, val, steelBlack, 'bumper_valance', { label: 'truck.rear_bumper' });
    // valance end caps
    for (const sgn of [-1, 1]) { const p = valP[sgn < 0 ? 0 : valP.length - 1]; const yTop = yLow(p.x) + 0.35; const e = fanGeometry([[p.x - p.nx * 1.0, 19.0, p.s - p.ns * 1.0], [p.x - p.nx * 0.35, 19.5, p.s - p.ns * 0.35], [p.x - p.nx * 0.5, yTop, p.s - p.ns * 0.5], [p.x - p.nx * 1.0, yTop, p.s - p.ns * 1.0]]); add(bumper, withUV(e), steelBlack, 'valance_end', { cast: false }); }
    // license plate pocket and plate, blank
    {
      const frame = new THREE.Mesh(withUV(roundedBoxGeometry(13.4, 6.7, 0.5, 0.35, 3)), steelBlack); frame.position.set(0, 26.2, sR + 0.15); frame.name = 'plate_frame'; frame.userData.labelId = L('truck.license_plate'); bumper.add(frame);
      const plate = new THREE.Mesh(withUV(new THREE.PlaneGeometry(12.0, 6.0)), new THREE.MeshStandardMaterial({ color: 0xffffff, map: plateTexture(), roughness: 0.45, metalness: 0.15 })); plate.position.set(0, 26.2, sR + 0.45); plate.name = 'license_plate'; plate.userData.labelId = L('truck.license_plate'); bumper.add(plate);
      parts.licensePlate = plate;
    }
    // bumper brackets (black steel arms to the frame rails)
    for (const sg of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.8, 16), steelBlack); b.position.set(sg * 17.2, 22.8, sR - 7.5 - 8); b.userData.labelId = L('truck.bumper_bracket'); bumper.add(b); }
  }
  root.add(bumper); parts.bumper = bumper;

  // ---- receiver hitch (plain 2 in receiver), safety chain loops, 7-pin plug ----
  {
    const hitch = new THREE.Group(); hitch.name = 'hitch'; hitch.userData.labelId = L('truck.hitch');
    const tube = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 22), steelBlack); tube.position.set(0, 16.1, 188.2); hitch.add(tube);
    const flange = new THREE.Mesh(withUV(roundedBoxGeometry(4.4, 4.4, 0.35, 0.1, 2)), steelBlack); flange.position.set(0, 16.1, 199.3); hitch.add(flange);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(2.04, 2.04, 0.2), holeBlack); hole.position.set(0, 16.1, 199.5); hitch.add(hole);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 3.9, 10), steelRaw); pin.rotation.z = Math.PI / 2; pin.position.set(0, 16.1, 196.2); hitch.add(pin);
    for (const sg of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.22, 8, 16), steelBlack); ring.position.set(sg * 6.4, 16.4, 198.6); ring.userData.labelId = L('truck.safety_chain_loop'); hitch.add(ring); const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.3), steelBlack); plate.position.set(sg * 6.4, 16.4, 198.1); hitch.add(plate); }
    // 7-pin round connector on a bracket
    const plug = new THREE.Group(); plug.name = 'trailer_plug'; plug.userData.labelId = L('truck.trailer_plug');
    const br = new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.6, 0.3), steelBlack); br.position.set(0, 0, 0); plug.add(br);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 20), capBlack); sock.rotation.x = Math.PI / 2; sock.position.set(-0.4, 0, 0.7); plug.add(sock);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20), holeBlack); face.position.set(-0.4, 0, 1.31); plug.add(face);
    for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI * 2; const px = i === 6 ? 0 : Math.cos(a) * 0.55, py = i === 6 ? 0 : Math.sin(a) * 0.55; const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 6), steelRaw); pp.rotation.x = Math.PI / 2; pp.position.set(-0.4 + px, py, 1.4); plug.add(pp); }
    const cover = new THREE.Mesh(withUV(roundedBoxGeometry(2.6, 0.5, 0.25, 0.1, 2)), capBlack); cover.position.set(-0.4, 1.55, 1.5); cover.rotation.x = 0.7; plug.add(cover);
    const flat4 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 0.9), capBlack); flat4.position.set(1.6, -1.1, 0.6); plug.add(flat4);
    plug.position.set(-9.6, 17.2, 196.4); hitch.add(plug);
    root.add(hitch); parts.hitch = hitch;
  }

  parts.bed = bed;
  root.userData.parts = parts;
  return { group: root, parts, colliders: [], lamps };
}
