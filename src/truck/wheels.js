// Factory 2005 Silverado 2500HD wheel and tire (increment 2.2).
// 16 x 6.5 polished forged aluminum 8-lug wheel with the gold bowtie cap, Michelin LTX M/S2 LT245/75R16 E,
// brake rotor and caliper behind it. Everything is generated in code; nothing is downloaded.
// Reference: reference/06-stock-wheel-tire.jpg (the wheel face has 5 large tangential ovals alternating with
// 5 small round windows, a raised hub boss carrying 8 lug nuts on a 6.5 in circle, and a bowtie cap).
//
// Local frame of a wheel group: origin at the hub center on the tire's center plane, the axle is the local X axis,
// the outward-facing side is +X for side 'R'; side 'L' is the same wheel turned 180 degrees about the vertical (outward = -X,
// lettering still reads correctly from outside, calipers stay on the same end of the axle).
// Angles on the wheel ("phi") are measured clockwise from the top as seen from outside: a point is at
// (x, r cos phi, -r sin phi), so phi = 90 deg is toward the front of the truck on the passenger side.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { spec, IN } from '../data/truckSpec.js';
import { mat } from '../core/materials.js';
import { roundedBoxGeometry } from '../core/geom.js';
import { makeCanvas, noiseField, heightToNormal, tex, rng } from '../core/proc.js';

const T = spec.tires;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------------------------------
// Real numbers (spec file first; the two below are not in the spec yet, see the comments)
// ---------------------------------------------------------------------------------------------------------------
export const HUB_HEIGHT_IN = 14.5;   // confirmed: 15.25 in tire radius less 0.75 in loaded deflection (task brief, matches the placeholder wheels)
export const DEFLECTION_IN = 0.75;   // estimated: LT tire at 55-80 psi under the axle load (task brief)
export const SECTION_WIDTH_IN = 9.8; // confirmed: Michelin LTX M/S2 LT245/75R16 overall width on a 6.5 in rim (spec has the 245 mm nominal)
const TREAD_END_IN = 5.3;            // arc length from the crown center to the end of the tread pattern (design number)

export const WHEEL_DIM = {
  tireRadius: (T.overallDiameterIn / 2) * IN,
  tireWidth: SECTION_WIDTH_IN * IN,
  rimRadius: (T.rimDiameterIn / 2) * IN,
  rimWidth: T.rimWidthIn * IN,
  boltRadius: T.boltPatternMm / 2 / 1000,
  lugs: T.lugs,
  treadDepth: T.treadDepthMm / 1000,
  centerHeight: HUB_HEIGHT_IN * IN,
  deflection: DEFLECTION_IN * IN,
};

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers (no DOM): unit tested in tests/wheels.test.js
// ---------------------------------------------------------------------------------------------------------------

/** Lug positions on the bolt circle: n points equally spaced; angle phi clockwise from the top (as seen from outside). */
export function boltCircle(n = T.lugs, radius = T.boltPatternMm / 2 / 1000, phase = 0) {
  return Array.from({ length: n }, (_, k) => {
    const a = phase + (k * TAU) / n;
    return { angle: a, r: radius, y: radius * Math.cos(a), z: -radius * Math.sin(a) };
  });
}

/** Noise-treatment pitch variation: n circumferential tread pitches (radians, summing to 2 pi), three lengths, never long runs. */
export function pitchSequence(n, seed = 7) {
  const r = rng(seed);
  const lens = [0.84, 1.0, 1.18];
  const raw = [];
  let prev = -1, run = 0;
  for (let i = 0; i < n; i++) {
    let k = Math.floor(r() * 3);
    if (k === prev && (run >= 2 || r() < 0.55)) k = (k + 1 + Math.floor(r() * 2)) % 3;
    run = k === prev ? run + 1 : 1; prev = k;
    raw.push(lens[k]);
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => (v / sum) * TAU);
}

// Outer half of the tire carcass (axial x outward, radius r), inches, crown center to the bead (embedded in the rim lip).
// 245/75R16: sidewall 0.75 * 245 = 183.75 mm = 7.23 in, 16 in rim, 30.5 in overall, 9.8 in wide at the belly (x = 4.9 in).
const PROFILE_IN = [
  [0, 15.25], [1.3, 15.235], [2.6, 15.185], [3.6, 15.09], [4.05, 14.93], [4.42, 14.65], [4.66, 14.25], [4.80, 13.75],
  [4.88, 13.1], [4.91, 12.3], [4.90, 11.5], [4.86, 10.75], [4.76, 10.1], [4.58, 9.62], [4.38, 9.3],
  [4.27, 9.13], [4.32, 9.03], [4.28, 8.93], [4.12, 8.85], [3.85, 8.73], [3.5, 8.58],
];

let _profile = null;
/** Sampled tire profile in meters with arc length S from the crown center: { x[], r[], L, at(S) -> {x, r, nx, nr} }. */
export function tireProfile() {
  if (_profile) return _profile;
  const pts = PROFILE_IN.map(([x, r]) => new THREE.Vector3(x * IN, r * IN, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const N = 720;
  const P = curve.getSpacedPoints(N);
  const x = new Float64Array(N + 1), r = new Float64Array(N + 1), S = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    x[i] = P[i].x; r[i] = P[i].y;
    if (i) S[i] = S[i - 1] + Math.hypot(x[i] - x[i - 1], r[i] - r[i - 1]);
  }
  const L = S[N];
  const at = (s) => {
    const f = clamp(s / L, 0, 1) * N;
    const i0 = Math.min(N - 1, Math.floor(f)), t = f - i0;
    const dx = x[i0 + 1] - x[i0], dr = r[i0 + 1] - r[i0], l = Math.hypot(dx, dr) || 1;
    return { x: x[i0] + dx * t, r: r[i0] + dr * t, nx: -dr / l, nr: dx / l, tx: dx / l, tr: dr / l };
  };
  _profile = { x, r, S, L, N, at };
  return _profile;
}

/** Overall diameter and width of the tire from the profile (meters). */
export function tireDimensions() {
  const p = tireProfile();
  let rmax = 0, xmax = 0;
  for (let i = 0; i <= p.N; i++) { rmax = Math.max(rmax, p.r[i]); xmax = Math.max(xmax, p.x[i]); }
  return { diameter: 2 * rmax, width: 2 * xmax, bead: p.r[p.N] };
}

/** Tread rows across the crown, S in inches from the center, symmetric. kind 'top' = tread surface, 'floor' = circumferential groove floor. */
export function treadRows() {
  const pos = [
    { S: 0.0, kind: 'top', rib: 'c' },
    { S: 0.80, kind: 'top', rib: 'c' }, { S: 0.87, kind: 'floor' }, { S: 1.13, kind: 'floor' }, { S: 1.20, kind: 'top', rib: 'i' },
    { S: 2.55, kind: 'top', rib: 'i' }, { S: 2.62, kind: 'floor' }, { S: 2.88, kind: 'floor' }, { S: 2.95, kind: 'top', rib: 's' },
    { S: 3.60, kind: 'top', rib: 's' }, { S: 4.20, kind: 'top', rib: 's' }, { S: 4.70, kind: 'top', rib: 's' },
    { S: 5.00, kind: 'top', rib: 's' }, { S: TREAD_END_IN, kind: 'top', rib: 's' },
  ];
  const rows = [];
  for (let i = pos.length - 1; i >= 1; i--) rows.push({ ...pos[i], S: -pos[i].S });
  rows.push(pos[0]);
  for (let i = 1; i < pos.length; i++) rows.push(pos[i]);
  return rows;
}
/** How deep a lateral groove cuts in a rib at arc position S (inches): 0 = none, 1 = full tread depth. */
export function lateralDepth(sIn, rib) {
  if (rib === 'c') return 0;
  if (rib === 'i') return 0.7;
  return 1 - smooth(4.5, TREAD_END_IN, Math.abs(sIn));
}
/** Sidewall rows (arc length S in meters from the crown): coarse over the sidewall, finer around the rim protector ridge. */
export function sidewallRows(stepA = 0.45, stepB = 0.12) {
  const p = tireProfile(), a = TREAD_END_IN * IN;
  let sr = p.L;
  for (let s = a; s < p.L; s += 0.002) if (p.at(s).r < 9.6 * IN) { sr = s; break; }
  const rows = [];
  for (let s = a; s < sr - 1e-6; s += stepA * IN) rows.push(s);
  for (let s = sr; s < p.L - 1e-6; s += stepB * IN) rows.push(s);
  rows.push(p.L);
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry utilities (THREE only, no DOM)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Surface of revolution about the X axis. profile: [[x, r], ...]. The outward normal is the LEFT normal of the profile
 * direction (flip = true for the right normal). Corners sharper than `crease` (dot of segment normals) are split.
 * Point at angle phi: (x, r cos phi, -r sin phi).
 */
export function lathe(profile, seg, { flip = false, crease = 0.6, closed = false } = {}) {
  const n = profile.length;
  const segN = [];
  let total = 0;
  const cum = [0];
  for (let k = 0; k < n - 1; k++) {
    const dx = profile[k + 1][0] - profile[k][0], dr = profile[k + 1][1] - profile[k][1];
    const l = Math.hypot(dx, dr) || 1e-9;
    let nx = -dr / l, nr = dx / l;
    if (flip) { nx = -nx; nr = -nr; }
    segN.push([nx, nr]);
    total += l; cum.push(total);
  }
  const rings = [];
  const pushRing = (k, nx, nr) => {
    const l = Math.hypot(nx, nr) || 1;
    rings.push({ x: profile[k][0], r: profile[k][1], nx: nx / l, nr: nr / l, v: total ? cum[k] / total : 0 });
    return rings.length - 1;
  };
  const vr = [];
  for (let k = 0; k < n; k++) {
    const prev = k > 0 ? k - 1 : (closed ? n - 2 : -1);
    const next = k < n - 1 ? k : (closed ? 0 : -1);
    const a = prev >= 0 ? segN[prev] : null, b = next >= 0 ? segN[next] : null;
    if (a && b) {
      if (a[0] * b[0] + a[1] * b[1] >= crease) { const i = pushRing(k, a[0] + b[0], a[1] + b[1]); vr.push([i, i]); }
      else vr.push([pushRing(k, a[0], a[1]), pushRing(k, b[0], b[1])]);
    } else { const s = a || b; const i = pushRing(k, s[0], s[1]); vr.push([i, i]); }
  }
  const W = seg + 1;
  const pos = new Float32Array(rings.length * W * 3), nor = new Float32Array(rings.length * W * 3), uv = new Float32Array(rings.length * W * 2);
  rings.forEach((rg, ri) => {
    for (let i = 0; i <= seg; i++) {
      const phi = (i / seg) * TAU, c = Math.cos(phi), s = Math.sin(phi), o = ri * W + i;
      pos.set([rg.x, rg.r * c, -rg.r * s], o * 3);
      nor.set([rg.nx, rg.nr * c, -rg.nr * s], o * 3);
      uv.set([i / seg, rg.v], o * 2);
    }
  });
  const idx = [];
  for (let k = 0; k < n - 1; k++) {
    const ra = vr[k][1], rb = vr[k + 1][0];
    for (let i = 0; i < seg; i++) {
      const a = ra * W + i, b = a + 1, c = rb * W + i, d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function plain(g) {
  const h = g.index ? g.toNonIndexed() : g;
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', h.getAttribute('position'));
  o.setAttribute('normal', h.getAttribute('normal'));
  o.setAttribute('uv', h.getAttribute('uv') || new THREE.BufferAttribute(new Float32Array(h.getAttribute('position').count * 2), 2));
  return o;
}
function merged(list) { return mergeGeometries(list.map(plain), false); }
const inches = (g) => { g.scale(IN, IN, IN); return g; };

// cylinder / disc along X from x0 to x1 (capped)
const cylX = (r, x0, x1, seg) => lathe([[x0, 0], [x0, r], [x1, r], [x1, 0]], seg);

// box with axial extent ax (x), radial extent rd (y) and tangential extent tg (z), centered at (x, r), rounded.
function rbox(ax, rd, tg, rad, x, r) {
  const g = roundedBoxGeometry(tg, rd, ax, rad, 2);
  g.rotateY(Math.PI / 2);
  g.translate(x, r, 0);
  return g;
}
const atPhi = (g, phi) => { g.rotateX(-phi); return g; };

// ---------------------------------------------------------------------------------------------------------------
// Tire geometry: tread (grid with real blocks and grooves) and sidewall (lathe)
// ---------------------------------------------------------------------------------------------------------------
const SLANT = 0.38; // lateral groove slope: circumferential inches per inch of axial travel
const TREAD_A = [0.435, 0.47, 0.53, 0.565]; // in-pitch positions: block edge, groove floor, groove floor, block edge (groove centered at 0.5)

function seamFix(geom, nRows, nCols) {
  const n = geom.getAttribute('normal');
  for (let j = 0; j < nRows; j++) {
    const a = j * nCols, b = a + nCols - 1;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
}

export function buildTreadGeometry({ pitches = 54 } = {}) {
  const prof = tireProfile();
  const seq = pitchSequence(pitches);
  const cols = [];
  let th = 0;
  for (let p = 0; p < pitches; p++) {
    for (let k = 0; k < 4; k++) cols.push({ th: th + TREAD_A[k] * seq[p], u: p + TREAD_A[k], top: k === 0 || k === 3 });
    th += seq[p];
  }
  cols.push({ th: cols[0].th + TAU, u: pitches + TREAD_A[0], top: true });
  const rows = treadRows();
  const nC = cols.length, nR = rows.length;
  const R0 = WHEEL_DIM.tireRadius, depthM = WHEEL_DIM.treadDepth;
  const pos = new Float32Array(nR * nC * 3), uv = new Float32Array(nR * nC * 2), load = new Float32Array(nR * nC * 2);
  for (let j = 0; j < nR; j++) {
    const row = rows[j], sIn = row.S, sgn = sIn < 0 ? -1 : 1, sAbs = Math.abs(sIn);
    const pr = prof.at(sAbs * IN);
    const px = sgn * pr.x, nx = sgn * pr.nx, nr = pr.nr;
    const shift = (SLANT * sAbs * IN) / R0;
    for (let i = 0; i < nC; i++) {
      const c = cols[i];
      const frac = row.kind === 'floor' ? 1 : (c.top ? 0 : lateralDepth(sAbs, row.rib));
      const d = depthM * frac;
      const r = pr.r - nr * d, x = px - nx * d;
      const a = c.th + shift, o = j * nC + i;
      pos[o * 3] = x; pos[o * 3 + 1] = r * Math.cos(a); pos[o * 3 + 2] = -r * Math.sin(a);
      uv[o * 2] = c.u; uv[o * 2 + 1] = (sIn + TREAD_END_IN) / (2 * TREAD_END_IN);
      load[o * 2] = d; load[o * 2 + 1] = 1;
    }
  }
  const idx = [];
  for (let j = 0; j < nR - 1; j++) for (let i = 0; i < nC - 1; i++) {
    const a = j * nC + i, b = a + 1, c = a + nC, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aLoad', new THREE.BufferAttribute(load, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  seamFix(g, nR, nC);
  return g;
}

/** Sidewall from the end of the tread to the bead. inner = the inboard side (mirrored in x, texture flipped). */
export function buildSidewallGeometry({ seg = 144, stepA = 0.45, stepB = 0.12, inner = false } = {}) {
  const prof = tireProfile();
  const rows = sidewallRows(stepA, stepB);
  const nR = rows.length, W = seg + 1, sx = inner ? -1 : 1;
  const sEnd = TREAD_END_IN * IN;
  const pos = new Float32Array(nR * W * 3), nor = new Float32Array(nR * W * 3), uv = new Float32Array(nR * W * 2), load = new Float32Array(nR * W * 2);
  for (let j = 0; j < nR; j++) {
    const s = rows[j], pr = prof.at(s);
    const v = 1 - (s - sEnd) / (prof.L - sEnd);
    const w = 1 - smooth(sEnd, sEnd + 2.0 * IN, s);
    for (let i = 0; i <= seg; i++) {
      const phi = (i / seg) * TAU, c = Math.cos(phi), sn = Math.sin(phi), o = j * W + i;
      pos.set([sx * pr.x, pr.r * c, -pr.r * sn], o * 3);
      nor.set([sx * pr.nx, pr.nr * c, -pr.nr * sn], o * 3);
      uv.set([inner ? 1 - i / seg : i / seg, v], o * 2);
      load.set([0, w], o * 2);
    }
  }
  const idx = [];
  for (let j = 0; j < nR - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    if (inner) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aLoad', new THREE.BufferAttribute(load, 2));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Wheel geometry (inches inside, scaled to meters at the end)
// ---------------------------------------------------------------------------------------------------------------
const FACE_X = 1.95;      // back of the face plate (in from the tire center plane)
const FACE_T = 0.45;      // face plate thickness
const BOSS_TOP = 2.95;    // top of the hub boss (the lug nuts sit here)
const CAP_TOP = 3.12;
const VALVE_PHI = (6 * Math.PI) / 180;
const WIN_PHI0 = (6 * Math.PI) / 180; // photo 06: a large oval sits 6 deg clockwise of the top

// barrel (rim) cross-section, closed loop traveling counterclockwise (flip = true): outer tire-facing surface then the cavity
const BARREL_IN = [
  [3.58, 8.45], [3.57, 8.62], [3.50, 8.69], [3.38, 8.69], [3.29, 8.60], [3.26, 8.30], [3.20, 8.04], [3.05, 8.0], [2.10, 8.0],
  [1.90, 7.93], [1.70, 7.80], [1.35, 7.35], [0.95, 7.12], [0.20, 7.10], [-0.90, 7.10], [-1.35, 7.35], [-1.70, 7.80], [-1.90, 7.93],
  [-2.10, 8.0], [-3.05, 8.0], [-3.20, 8.04], [-3.26, 8.30], [-3.29, 8.60], [-3.38, 8.69], [-3.50, 8.69], [-3.57, 8.62], [-3.58, 8.45],
  [-3.50, 8.25], [-3.38, 7.98], [-3.20, 7.84], [-3.0, 7.80], [-2.10, 7.80], [-1.95, 7.76], [-1.55, 7.60], [-1.20, 7.20], [-0.90, 6.92],
  [0.20, 6.92], [0.95, 6.94], [1.30, 7.20], [1.65, 7.60], [2.05, 7.76], [2.20, 7.80], [3.0, 7.80], [3.38, 7.98], [3.50, 8.25], [3.58, 8.45],
];
export const barrelProfile = () => BARREL_IN.map(([x, r]) => [x, r]);

function superEllipse(a, b, n, p = 2.6) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU, c = Math.cos(th), s = Math.sin(th);
    out.push([a * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / p)]);
  }
  return out;
}
// window outline in face-plate shape coordinates (sx = r sin phi, sy = r cos phi)
function windowPath(phiC, rho, a, b, n) {
  return superEllipse(a, b, n).map(([t, s]) => {
    const ang = phiC + t / rho, rad = rho + s;
    return new THREE.Vector2(rad * Math.sin(ang), rad * Math.cos(ang));
  });
}

function buildFace(L) {
  const bevel = 0.07, depth = FACE_T - 2 * bevel;
  const shape = new THREE.Shape();
  const Rf = 7.9 - bevel + 0.02;
  const nOut = L.hi ? 96 : 56;
  for (let i = 0; i < nOut; i++) { const a = (i / nOut) * TAU; const p = [Rf * Math.sin(a), Rf * Math.cos(a)]; if (i) shape.lineTo(p[0], p[1]); else shape.moveTo(p[0], p[1]); }
  shape.closePath();
  const nw = L.windowPts * 4;
  for (let k = 0; k < 5; k++) {
    for (const [phi, rho, a, b] of [[WIN_PHI0 + k * (TAU / 5), 5.75, 2.05, 0.95], [WIN_PHI0 + (k + 0.5) * (TAU / 5), 6.05, 0.62, 0.78]]) {
      const pts = windowPath(phi, rho, a, b, nw);
      const hole = new THREE.Path();
      pts.forEach((p, i) => (i ? hole.lineTo(p.x, p.y) : hole.moveTo(p.x, p.y)));
      hole.closePath();
      shape.holes.push(hole);
    }
  }
  let g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: L.hi ? 3 : 2, steps: 1, curveSegments: 4 });
  g.rotateY(Math.PI / 2); // extrusion +Z -> +X, shape x -> -z
  g.translate(FACE_X + bevel, 0, 0);
  g = toCreasedNormals(g, 0.25); // small angle: the bevel stays faceted and the big flat caps stay flat
  return g;
}

// Chevrolet bowtie outline (traced from reference/05a-bowtie.jpg), normalized to width 1, y up, centered
function bowtieShape() {
  const px = [[325, 430], [388, 430], [392, 400], [515, 400], [520, 430], [608, 428], [580, 480], [508, 482], [503, 512], [395, 512], [390, 482], [297, 478]];
  const pts = px.map(([x, y]) => [(x - 452) / 311, -(y - 456) / 311]);
  return pts;
}

function buildWheelGeometries(L) {
  const seg = L.seg;
  const out = {};
  out.face = inches(buildFace(L));

  // boss profile includes a small groove ring just outside the lug circle
  const boss = lathe([[2.40, 4.05], [2.52, 4.03], [2.68, 3.98], [2.84, 3.86], [2.93, 3.70], [BOSS_TOP, 3.58], [BOSS_TOP, 3.52], [BOSS_TOP - 0.06, 3.47], [BOSS_TOP - 0.06, 3.40], [BOSS_TOP, 3.35], [BOSS_TOP, 1.80], [2.88, 1.72], [2.70, 1.66]], seg, { crease: 0.3 });
  out.polished = inches(merged([boss]));

  out.barrel = inches(lathe(BARREL_IN, L.barrelSeg, { flip: true, crease: 0.55 }));

  // cap: slightly domed disc in the boss socket
  out.cap = inches(lathe([[2.72, 1.66], [3.00, 1.64], [3.09, 1.57], [3.12, 1.45], [CAP_TOP + 0.005, 0]], seg, { crease: 0.3 }));
  out.navy = inches(lathe([[CAP_TOP + 0.01, 1.52], [CAP_TOP + 0.01, 1.27]], seg));
  // gold bowtie, long axis vertical (as in the photo), slightly tilted
  {
    const pts = bowtieShape();
    const sh = new THREE.Shape();
    const S = 2.1; // long axis 2.1 in
    // rotate 90 deg: (x, y) -> (-y, x); shape x maps to -z (see buildFace), so use sx = -y'*S... keep upright: sx = y', sy = x'
    // short axis widened 30 percent: the cap's bowtie is chunkier than the grille's
    pts.forEach(([x, y], i) => { const sx = -y * S * 1.3, sy = x * S; if (i) sh.lineTo(sx, sy); else sh.moveTo(sx, sy); });
    sh.closePath();
    let g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.rotateY(Math.PI / 2);
    g.translate(CAP_TOP + 0.012, 0, 0);
    g.rotateX(-(3 * Math.PI) / 180);
    out.bowtie = inches(toCreasedNormals(g, 0.5));
  }

  // lug nuts: 8 chrome nuts on the 165.1 mm circle
  {
    const nutR = T.boltPatternMm / 2 / 25.4;
    const parts = [], washers = [];
    boltCircle().forEach((b) => {
      const nut = new THREE.CylinderGeometry(0.42, 0.5, 0.74, 6).toNonIndexed();
      nut.computeVertexNormals();
      nut.rotateZ(-Math.PI / 2);
      nut.rotateX(0.2);
      nut.translate(BOSS_TOP + 0.14 + 0.37, nutR, 0);
      parts.push(atPhi(nut, b.angle));
      const w = new THREE.CylinderGeometry(0.60, 0.60, 0.16, 20);
      w.rotateZ(-Math.PI / 2);
      w.translate(BOSS_TOP + 0.08, nutR, 0);
      washers.push(atPhi(w, b.angle));
    });
    out.nuts = inches(merged(parts));
    out.washers = inches(merged(washers));
  }

  // valve stem
  {
    const stemR = 7.3;
    const st = cylX(0.17, 1.55, 2.95, 10); st.translate(0, stemR, 0);
    const cap = cylX(0.22, 2.95, 3.35, 10); cap.translate(0, stemR, 0);
    out.stem = inches(merged([atPhi(st, VALVE_PHI)]));
    out.stemCap = inches(merged([atPhi(cap, VALVE_PHI)]));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Brake geometry behind the wheel
// ---------------------------------------------------------------------------------------------------------------
const ROTOR = { rOut: 6.5, rIn: 4.45, outFace: 0.95, plate: 0.25, gap: 0.65, hatTop: 1.25 };

function buildBrakes(L, axle) {
  const seg = L.seg;
  const o = {};
  const xo1 = ROTOR.outFace, xo0 = xo1 - ROTOR.plate;           // outboard plate 0.70..0.95
  const xi1 = xo0 - ROTOR.gap, xi0 = xi1 - ROTOR.plate;          // inboard plate -0.30..-0.05
  const plate = (x0, x1) => lathe([[x0, ROTOR.rIn], [x0, ROTOR.rOut], [x1, ROTOR.rOut], [x1, ROTOR.rIn], [x0, ROTOR.rIn]], seg, { closed: true, crease: 0.3 });
  const hat = lathe([[0.70, 4.45], [0.95, 4.45], [1.10, 4.05], [1.25, 3.92], [1.25, 1.95], [1.05, 1.95], [1.05, 3.72], [0.90, 3.85], [0.70, 4.15], [0.70, 4.45]], seg, { closed: true, crease: 0.3 });
  const vanes = [];
  const nv = L.vanes;
  for (let k = 0; k < nv; k++) {
    const v = new THREE.BoxGeometry(ROTOR.gap + 0.04, ROTOR.rOut - ROTOR.rIn, 0.30);
    v.translate((xi1 + xo0) / 2, (ROTOR.rOut + ROTOR.rIn) / 2, 0);
    v.rotateX(-(k / nv) * TAU);
    vanes.push(v);
  }
  o.rotor = inches(merged([plate(xo0, xo1), plate(xi0, xi1), hat, ...vanes]));
  // hub: fills the hat, studs
  const hub = [cylX(3.3, 0.0, 1.05, seg), cylX(1.9, 1.05, 1.25, seg)];
  boltCircle().forEach((b) => { const s = cylX(0.2, 0.9, 1.95, 10); s.translate(0, T.boltPatternMm / 2 / 25.4, 0); hub.push(atPhi(s, b.angle)); });
  o.hub = inches(merged(hub));

  // caliper (static): bridge + outboard leg + inboard housing, pads, bolts
  const phiC = axle === 'front' ? (255 * Math.PI) / 180 : (300 * Math.PI) / 180;
  // (the left wheel is the right wheel turned 180 degrees about the vertical, so its caliper angle is mirrored to stay on the same end)
  const mkCal = () => {
    const cal = [
      rbox(0.30, 1.85, 3.8, 0.1, 1.30, 5.85),   // outboard leg (pad 0.95..1.15 sits between it and the rotor)
      rbox(0.60, 2.0, 4.0, 0.12, -0.80, 5.7),   // inboard housing (pistons)
      rbox(2.55, 0.50, 3.8, 0.1, 0.175, 6.80),  // bridge over the rotor edge
    ];
    for (const sgn of [-1, 1]) {
      const ear = rbox(0.5, 1.1, 0.9, 0.08, -0.75, 5.75); ear.translate(0, 0, sgn * 2.35); cal.push(ear);
      const bolt = cylX(0.26, -1.55, -0.95, 8); bolt.translate(0, 5.75, sgn * 2.35); cal.push(bolt);
    }
    const bleeder = cylX(0.14, 0, 0.5, 8); bleeder.rotateZ(Math.PI / 2); bleeder.translate(0.4, 7.05, 0); // bleeder screw standing on the bridge
    cal.push(bleeder);
    return cal;
  };
  const mkPads = () => [rbox(0.20, 1.25, 3.0, 0.03, 1.04, 5.6), rbox(0.20, 1.25, 3.0, 0.03, xi0 - 0.10, 5.6)];
  o.caliper = {}; o.pads = {};
  for (const [side, ph] of [['R', phiC], ['L', -phiC]]) {
    o.caliper[side] = inches(merged(mkCal().map((g) => atPhi(g, ph))));
    o.pads[side] = inches(merged(mkPads().map((g) => atPhi(g, ph))));
  }

  // knuckle / axle behind the rotor (static)
  const st = [];
  if (axle === 'front') {
    st.push(cylX(3.7, -2.4, -0.55, seg));                                  // steering knuckle
    st.push(cylX(1.05, -7.5, -2.4, 20));                                     // CV shaft stub
    st.push(lathe([[-5.4, 1.05], [-5.2, 1.35], [-4.2, 1.75], [-3.3, 1.35], [-3.1, 1.05]], 24));     // CV boot
  } else {
    st.push(cylX(2.0, -9.0, -0.55, seg));                                    // axle shaft housing end
    st.push(cylX(3.0, -1.6, -0.55, seg));                                    // bearing retainer bell
  }
  o.cast = inches(merged(st));
  // backing / dust shield: thin disc with a notch
  o.shield = inches(lathe([[-0.55, 0.0], [-0.55, 6.05], [-0.62, 6.05], [-0.62, 0.0]], seg, { crease: 0.3, flip: true }));
  return o;
}

// ---------------------------------------------------------------------------------------------------------------
// Textures (DOM canvases; built once per quality tier)
// ---------------------------------------------------------------------------------------------------------------
function canvasField(c) {
  const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data;
  const f = new Float32Array(c.width * c.height);
  for (let i = 0; i < f.length; i++) f[i] = d[i * 4] / 255;
  return f;
}
function boxBlur(f, w, h, r) {
  const tmp = new Float32Array(f.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0; const o = y * w;
    for (let k = -r; k <= r; k++) acc += f[o + ((k + w) % w)];
    for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += f[o + ((x + r + 1) % w)] - f[o + ((x - r + w) % w)]; }
  }
  const out = new Float32Array(f.length);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = acc / n; acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x]; }
  }
  return out;
}

// Tread detail: sipes (thin wavy slits across every block) and rubber grain, tiling once per pitch in u
function treadNormalCanvas(tw, th) {
  const h = noiseField(tw, th, 96, 5, 3, 0.55);
  for (let i = 0; i < h.length; i++) h[i] = 0.5 + (h[i] - 0.5) * 0.12;
  // v = (S + end) / (2 end); canvas row y <-> v = 1 - y/(th-1)
  const grooveS = [1.0, 2.75];
  const sOfY = (y) => ((1 - y / (th - 1)) * 2 - 1) * TREAD_END_IN;
  const sipes = [0.78, 1.0, 1.22];
  for (let y = 0; y < th; y++) {
    const s = sOfY(y), sa = Math.abs(s);
    if (grooveS.some((g) => Math.abs(sa - g) < 0.2)) continue;
    const v = y / th;
    for (const a0 of sipes) {
      const wob = 0.028 * Math.sin(TAU * (v * 16 + a0 * 3));
      const cx = ((((a0 + wob) % 1) + 1) % 1) * tw, c0 = Math.round(cx);
      for (let dx = -3; dx <= 3; dx++) {
        const xx = c0 + dx, x = ((xx % tw) + tw) % tw;
        h[y * tw + x] -= 0.42 * Math.exp(-((xx - cx) * (xx - cx)) / 1.6);
      }
    }
  }
  return heightToNormal(h, tw, th, 1.4);
}

// Rotor friction-face stripes (concentric machining) along u, rust toward the edges: v maps across the ring
function rotorCanvas(n) {
  const c = makeCanvas(n, n), g = c.getContext('2d');
  const r = rng(3);
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    const band = 0.52 + 0.1 * Math.sin(y * 0.9) + (r() - 0.5) * 0.12;
    for (let x = 0; x < n; x++) {
      const k = clamp(band + (r() - 0.5) * 0.06, 0, 1);
      const i = (y * n + x) * 4;
      img.data[i] = 120 * k + 40; img.data[i + 1] = 118 * k + 40; img.data[i + 2] = 116 * k + 40; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// -------- sidewall --------
const FONT = '"Arial Narrow","Liberation Sans Narrow","Nimbus Sans Narrow","Helvetica Neue",Arial,"Liberation Sans","DejaVu Sans",sans-serif';
const FONT_HEAVY = '"Arial Black","Liberation Sans","DejaVu Sans",Arial,sans-serif';
const U = 100; // local text units per inch

function sidewallCanvases(W) {
  const Hc = W / 8;
  const prof = tireProfile();
  const sEnd = TREAD_END_IN * IN, span = prof.L - sEnd;
  const pxV = Hc / (span / IN);                       // px per inch along the sidewall
  const sOfR = (rIn) => { for (let s = sEnd; s < prof.L; s += 0.0005) if (prof.at(s).r <= rIn * IN) return s; return prof.L; };
  const yOfR = (rIn) => ((sOfR(rIn) - sEnd) / span) * Hc;
  const pxH = (rIn) => W / (TAU * rIn);               // px per inch circumferentially at radius r

  const layout = (ctx, pal) => {
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, Hc);
    const place = (deg, rIn, fn) => {
      ctx.save();
      ctx.translate((deg / 360) * W, yOfR(rIn));
      ctx.scale(pxH(rIn) / U, pxV / U);
      ctx.fillStyle = pal.ink; ctx.strokeStyle = pal.ink;
      fn();
      ctx.restore();
    };
    const fit = (str, widthIn, capIn, { heavy = false, slant = 0, align = 'center' } = {}) => {
      const F = (capIn / 0.716) * U;
      ctx.font = `${heavy ? 'italic 900' : 'bold'} ${F}px ${heavy ? FONT_HEAVY : FONT}`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      let w = ctx.measureText(str).width;
      if (!heavy && widthIn * U / w > 1.25 && 'letterSpacing' in ctx) {
        // widen with tracking instead of stretching the glyphs
        const sp = (widthIn * U / 1.2 - w) / Math.max(1, str.length - 1);
        ctx.letterSpacing = `${sp}px`;
        w = ctx.measureText(str).width;
      }
      const k = (widthIn * U) / w;
      ctx.save();
      ctx.scale(k, 1);
      if (slant) ctx.transform(1, 0, -slant, 1, 0, 0);
      const x0 = align === 'center' ? -w / 2 : align === 'left' ? 0 : -w;
      ctx.fillText(str, x0, (capIn * U) / 2);
      ctx.restore();
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    };
    // fine hairline ring pattern on the upper sidewall (just below the tread edge) and on the lower one
    ctx.save();
    ctx.strokeStyle = pal.hatch; ctx.lineWidth = Math.max(1, W / 3000);
    for (let rr = 13.55; rr < 14.05; rr += 0.045) { const y = yOfR(rr); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let rr = 9.55; rr < 9.78; rr += 0.05) { const y = yOfR(rr); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.lineWidth = Math.max(1.5, W / 1800);
    for (const rr of [13.38, 14.12]) { const y = yOfR(rr); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    // big raised brand and size lettering (positions follow photo 06)
    place(328, 11.55, () => fit('MICHELIN', 9.6, 1.5, { heavy: true, slant: 0.18 }));
    place(66, 12.6, () => fit('LT245/75R16', 8.4, 1.08));
    place(240, 12.45, () => fit('LTX M/S²', 9.2, 1.3, { heavy: true, slant: 0.16 }));
    // Michelin man (Bibendum): stacked tire rolls with a head and raised arms
    place(298.5, 11.4, () => {
      ctx.lineWidth = 6;
      for (let i = 0; i < 6; i++) { const w = 42 - Math.abs(i - 2.6) * 3.5; ctx.beginPath(); ctx.ellipse(0, 62 - i * 25, w, 15, 0, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, -104, 24, 0, TAU); ctx.fill();
      ctx.lineCap = 'round'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(-34, 20); ctx.lineTo(-86, -26); ctx.moveTo(34, 20); ctx.lineTo(80, -38); ctx.stroke();
    });
    // small print block under MICHELIN (photo: LOAD RANGE E, TUBELESS RADIAL, max load line)
    const small = (deg, r, str, w, cap = 0.2) => place(deg, r, () => fit(str, w, cap));
    small(342, 10.42, 'MICHELIN  LTX M/S2   TUBELESS  RADIAL', 6.6);
    small(342, 10.06, 'LT245/75R16  120/116R  LOAD RANGE E', 6.4);
    small(342, 9.72, 'MAX. LOAD 3042 LB (1380 KG) @ 80 PSI (550 KPA) MAX. PRESS.', 6.6, 0.17);
    small(4, 12.35, 'TUBELESS', 2.0); small(4, 12.75, 'RADIAL', 1.6);
    // right: DOT block, M+S, treadwear and traction rows
    place(112, 10.45, () => fit('DOT  MC3H 7V6R 3504', 5.0, 0.24));
    small(112, 10.0, 'TREADWEAR 580', 3.2, 0.2); small(112, 9.62, 'TRACTION A   TEMPERATURE A', 4.6, 0.2);
    place(95, 11.2, () => { ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 42, 0, TAU); ctx.stroke(); fit('M+S', 0.62, 0.26); });
    // bottom: size again, load and tread-wear rows
    small(236, 9.62, 'LT245/75R16  120/116R  (E)  LOAD RANGE E', 6.8, 0.2);
    small(236, 9.98, 'MICHELIN  LTX M/S2  RADIAL  TUBELESS', 6.6, 0.2);
    small(168, 9.4, 'LT245/75R16   120/116R', 4.4, 0.24);
    small(185, 10.1, 'MADE IN U.S.A.', 2.6, 0.2);
    // mold vent nubs (small dots) around the shoulder and at the ridge
    for (let i = 0; i < 90; i++) place((i / 90) * 360 + 1.7, 13.2, () => { ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); });
    for (let i = 0; i < 60; i++) place((i / 60) * 360 + 3.1, 9.45, () => { ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill(); });
  };

  const mk = () => { const c = makeCanvas(W, Hc); return [c, c.getContext('2d')]; };
  const [cH, gH] = mk(), [cC, gC] = mk(), [cR, gR] = mk();
  layout(gH, { bg: 'rgb(62,62,62)', ink: 'rgb(205,205,205)', hatch: 'rgb(100,100,100)' });
  layout(gC, { bg: 'rgb(29,29,30)', ink: 'rgb(66,66,69)', hatch: 'rgb(46,46,48)' });
  layout(gR, { bg: 'rgb(150,150,150)', ink: 'rgb(214,214,214)', hatch: 'rgb(206,206,206)' });

  // height -> normal map with softened edges and a fine grain
  const f = canvasField(cH);
  const grain = noiseField(512, 128, 60, 11, 3, 0.55);
  const b = boxBlur(f, W, Hc, Math.max(1, Math.round(W / 3000)));
  for (let y = 0; y < Hc; y++) for (let x = 0; x < W; x++) b[y * W + x] += (grain[(y % 128) * 512 + (x % 512)] - 0.5) * 0.035;
  const normalC = heightToNormal(b, W, Hc, 2.2);

  // color: dust and satin variation
  {
    const img = gC.getImageData(0, 0, W, Hc), d = img.data;
    const nz = noiseField(512, 128, 14, 21, 4, 0.6);
    for (let y = 0; y < Hc; y++) {
      const low = y / Hc;
      for (let x = 0; x < W; x++) {
        const n = nz[(y % 128) * 512 + (x % 512)];
        const a = Math.max(0, n - 0.5) * (0.10 + 0.16 * low);   // dust: stronger near the rim
        const k = 1 + (n - 0.5) * 0.16;
        const o = (y * W + x) * 4;
        d[o] = d[o] * (1 - a) * k + 112 * a; d[o + 1] = d[o + 1] * (1 - a) * k + 110 * a; d[o + 2] = d[o + 2] * (1 - a) * k + 108 * a;
      }
    }
    gC.putImageData(img, 0, 0);
  }
  // roughness: satin variation
  {
    const img = gR.getImageData(0, 0, W, Hc), d = img.data;
    const nz = noiseField(512, 128, 20, 31, 3, 0.5);
    for (let y = 0; y < Hc; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, k = 1 + (nz[(y % 128) * 512 + (x % 512)] - 0.5) * 0.18;
      d[o] = d[o + 1] = d[o + 2] = clamp(d[o] * k, 0, 255);
    }
    gR.putImageData(img, 0, 0);
  }
  return { color: cC, normal: normalC, rough: cR };
}

// ---------------------------------------------------------------------------------------------------------------
// Shared build (once per quality tier)
// ---------------------------------------------------------------------------------------------------------------
function lodFor(tier) {
  const hi = tier === 'high';
  return {
    hi, pitches: hi ? 66 : 44, sideSeg: hi ? 144 : 88, innerSeg: hi ? 72 : 48, stepA: hi ? 0.45 : 0.7, stepB: hi ? 0.12 : 0.2,
    barrelSeg: hi ? 72 : 40, windowPts: hi ? 14 : 8, seg: hi ? 64 : 36, vanes: hi ? 36 : 24,
    sideTex: hi ? 4096 : 2048, treadTex: hi ? [512, 1024] : [256, 512], rotorTex: hi ? 256 : 128,
  };
}
const tierOf = (quality) => (quality && quality.tex >= 2048 ? 'high' : 'low');
const sharedCache = {};

function polishedFace() {
  const m = mat.polishedAluminum();
  m.color.set(0xffffff); m.emissive.set(0x24262a);
  m.envMapIntensity = 3.0; m.roughness = 0.22;
  return m;
}

function buildShared(tier, aniso) {
  const L = lodFor(tier);
  const S = { L };
  S.tire = {
    tread: buildTreadGeometry({ pitches: L.pitches }),
    sideOut: buildSidewallGeometry({ seg: L.sideSeg, stepA: L.stepA, stepB: L.stepB }),
    sideIn: buildSidewallGeometry({ seg: L.innerSeg, stepA: L.stepA * 1.6, stepB: L.stepB * 2, inner: true }),
  };
  S.wheel = buildWheelGeometries(L);
  S.brakes = { front: buildBrakes(L, 'front'), rear: buildBrakes(L, 'rear') };

  const sw = sidewallCanvases(L.sideTex);
  const sideMap = tex(sw.color, { srgb: true, aniso }); const sideNormal = tex(sw.normal, { srgb: false, aniso }); const sideRough = tex(sw.rough, { srgb: false, aniso });
  for (const t of [sideMap, sideNormal, sideRough]) t.wrapT = THREE.ClampToEdgeWrapping;
  const treadNormal = tex(treadNormalCanvas(L.treadTex[0], L.treadTex[1]), { srgb: false, aniso });
  const rotorMap = tex(rotorCanvas(L.rotorTex), { srgb: true, aniso });

  S.mats = {
    sidewall: new THREE.MeshStandardMaterial({ color: 0xffffff, map: sideMap, normalMap: sideNormal, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: sideRough, roughness: 1.0, metalness: 0, envMapIntensity: 0.55 }),
    tread: new THREE.MeshStandardMaterial({ color: 0x2a2b2c, normalMap: treadNormal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.9, metalness: 0, envMapIntensity: 0.4 }),
    polished: polishedFace(),
    nut: new THREE.MeshStandardMaterial({ color: 0x9a9ea2, metalness: 1.0, roughness: 0.3, envMapIntensity: 1.1 }),
    barrel: new THREE.MeshStandardMaterial({ color: 0xb9bdc1, metalness: 1.0, roughness: 0.34, envMapIntensity: 1.0, side: THREE.DoubleSide }),
    chrome: mat.chrome(),
    washer: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1.0, roughness: 0.22, envMapIntensity: 1.3 }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xd9b45c, metalness: 1.0, roughness: 0.26, envMapIntensity: 1.5 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x14224d, roughness: 0.35, metalness: 0.2 }),
    cap: new THREE.MeshPhysicalMaterial({ color: 0xe3e6e8, metalness: 1.0, roughness: 0.24, envMapIntensity: 1.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x101011, roughness: 0.85, metalness: 0 }),
    rotor: new THREE.MeshStandardMaterial({ color: 0xc9c9c8, map: rotorMap, metalness: 0.85, roughness: 0.5, envMapIntensity: 0.8 }),
    hub: mat.castMetal(0x55585b),
    caliper: new THREE.MeshStandardMaterial({ color: 0x16171a, metalness: 0.35, roughness: 0.48, envMapIntensity: 0.8 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x3a3430, metalness: 0.2, roughness: 0.9 }),
    cast: new THREE.MeshStandardMaterial({ color: 0x2e3033, metalness: 0.6, roughness: 0.6, envMapIntensity: 0.6 }),
    shield: new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide }),
  };
  return S;
}

// Spin and contact-patch deformation in the vertex shader: the tire rotates with the spin group, but the flat patch
// must stay under the hub, so the vertex is rotated back into the non-spinning frame, clamped to the floor, and rotated forward again.
function patchLoad(m, u) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSpin = u.uSpin; sh.uniforms.uFloor = u.uFloor; sh.uniforms.uBulge = u.uBulge;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aLoad;\nuniform float uSpin;\nuniform float uFloor;\nuniform float uBulge;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float cs = cos(uSpin), sn = sin(uSpin);
          vec3 q = vec3(transformed.x, transformed.y * cs - transformed.z * sn, transformed.y * sn + transformed.z * cs);
          float lim = uFloor + aLoad.x;
          float push = max(0.0, lim - q.y) * aLoad.y;
          q.y += push;
          q.x *= 1.0 + uBulge * aLoad.y * exp(-(q.z * q.z) / 0.05);
          transformed = vec3(q.x, q.y * cs + q.z * sn, -q.y * sn + q.z * cs);
        }`);
  };
  m.customProgramCacheKey = () => 'wheelTireLoad1';
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------------------------------------------
export const WHEEL_LABELS = {
  'truck.wheel': { name: 'Factory wheel', desc: '16 x 6.5 polished aluminum 8-lug wheel (165.1 mm bolt circle), gold Chevrolet bowtie center cap. Lug nut torque 140 lb-ft.' },
  'truck.tire': { name: 'Michelin LTX M/S2 tire', desc: 'LT245/75R16 E, 120/116R, 3,042 lb at 80 psi, 30.5 in tall. Door placard: 55 psi front, 80 psi rear.' },
  'truck.wheelcap': { name: 'Bowtie center cap', desc: 'Polished cap with the gold Chevrolet bowtie.' },
  'truck.lugs': { name: 'Wheel lug nuts', desc: 'Eight lug nuts on an 8 x 165.1 mm (6.5 in) bolt circle.' },
  'truck.rotor': { name: 'Vented brake rotor', desc: 'Vented disc brake rotor on the wheel hub, turning with the wheel.' },
  'truck.caliper': { name: 'Brake caliper', desc: 'Disc brake caliper bolted to the knuckle or axle; it stays still while the rotor turns.' },
};

export function buildWheel({ quality, axle = 'front', side = 'R' } = {}) {
  const tier = tierOf(quality);
  const S = (sharedCache[tier] ||= buildShared(tier, quality && quality.aniso ? quality.aniso : 4));
  const B = S.brakes[axle === 'rear' ? 'rear' : 'front'];
  const M = S.mats;

  const group = new THREE.Group();
  group.name = `wheel_${axle}_${side}`;
  if (side === 'L') group.rotation.y = Math.PI; // same wheel turned around (not mirrored): lettering reads correctly from outside
  const spinG = new THREE.Group(); spinG.name = 'spin';
  group.add(spinG);

  const add = (parent, geom, material, name, { cast = false, label = null } = {}) => {
    const m = new THREE.Mesh(geom, material);
    m.name = name; m.castShadow = cast; m.receiveShadow = true;
    if (label) m.userData.labelId = label;
    parent.add(m);
    return m;
  };

  // tire (per-wheel material clones so each wheel has its own spin and load uniforms)
  const u = { uSpin: { value: 0 }, uFloor: { value: -WHEEL_DIM.tireRadius }, uBulge: { value: 0 } };
  const swMat = patchLoad(M.sidewall.clone(), u), trMat = patchLoad(M.tread.clone(), u);
  const tireG = new THREE.Group(); tireG.name = 'tire'; tireG.userData.labelId = 'truck.tire'; spinG.add(tireG);
  add(tireG, S.tire.tread, trMat, 'tread', { cast: true });
  add(tireG, S.tire.sideOut, swMat, 'sidewall_out', { cast: true });
  add(tireG, S.tire.sideIn, swMat, 'sidewall_in');

  // wheel
  const wheelG = new THREE.Group(); wheelG.name = 'rim'; wheelG.userData.labelId = 'truck.wheel'; spinG.add(wheelG);
  add(wheelG, S.wheel.face, M.polished, 'face');
  add(wheelG, S.wheel.polished, M.polished, 'boss');
  add(wheelG, S.wheel.barrel, M.barrel, 'barrel');
  add(wheelG, S.wheel.stem, M.rubber, 'valve_stem');
  add(wheelG, S.wheel.stemCap, M.chrome, 'valve_cap');
  const capG = new THREE.Group(); capG.name = 'cap'; capG.userData.labelId = 'truck.wheelcap'; wheelG.add(capG);
  add(capG, S.wheel.cap, M.cap, 'cap_disc');
  add(capG, S.wheel.navy, M.navy, 'cap_ring');
  add(capG, S.wheel.bowtie, M.gold, 'bowtie');
  const lugG = new THREE.Group(); lugG.name = 'lugs'; lugG.userData.labelId = 'truck.lugs'; wheelG.add(lugG);
  add(lugG, S.wheel.nuts, M.nut, 'lug_nuts');
  add(lugG, S.wheel.washers, M.washer, 'lug_seats');

  // brakes: rotor and hub spin; caliper, knuckle and shield stay put
  const rotorG = new THREE.Group(); rotorG.name = 'rotor'; rotorG.userData.labelId = 'truck.rotor'; spinG.add(rotorG);
  add(rotorG, B.rotor, M.rotor, 'rotor');
  add(rotorG, B.hub, M.hub, 'hub');
  const calG = new THREE.Group(); calG.name = 'caliper'; calG.userData.labelId = 'truck.caliper'; group.add(calG);
  add(calG, B.caliper[side === 'L' ? 'L' : 'R'], M.caliper, 'caliper');
  add(calG, B.pads[side === 'L' ? 'L' : 'R'], M.pad, 'pads');
  add(calG, B.cast, M.cast, 'knuckle');
  add(calG, B.shield, M.shield, 'dust_shield');

  // spin(angle): the same angle on all four wheels rolls the truck the same way (the left wheel is turned around, so its local angle is negated)
  const dirSign = side === 'L' ? -1 : 1;
  const spin = (angle) => { const a = dirSign * angle; spinG.rotation.x = a; u.uSpin.value = a; };
  const setLoadFlat = (a) => {
    const t = clamp(a, 0, 1);
    u.uFloor.value = -(WHEEL_DIM.tireRadius - t * WHEEL_DIM.deflection);
    u.uBulge.value = 0.035 * t;
  };
  group.userData.wheel = { axle, side };
  return { group, spin, setLoadFlat, radius: WHEEL_DIM.tireRadius, width: WHEEL_DIM.tireWidth, centerY: WHEEL_DIM.centerHeight };
}
