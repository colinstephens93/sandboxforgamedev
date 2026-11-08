// Truck body shell: panels cut from the parametric skin (skin.js), crowned hood and roof, glass.
// Everything is in the truck frame: origin on the floor at the front axle centerline, truck faces -Z (s = +Z), +X passenger.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { spec } from '../data/truckSpec.js';
import { gridPanel, colPos, rowPos } from './panels.js';
import * as K from './skin.js';
import { halfWidth, wMax, archY, hoodHalfWidth, hoodHeight, roofHalfWidth, roofHeight, ST, H, IN_TO_M, ARCH_R, AXLE_Y, WB } from './skin.js';

export const GAP = spec.dims.panelGapMm / 25.4; // 4.5 mm in inches
const IN = IN_TO_M;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (t) => t * t * (3 - 2 * t);

// ---- geometry of the greenhouse lines (inches) ----
export const A = { s0: 23.0, y0: H.beltline, s1: 43.0, y1: 75.4 };
export const sA = (y) => lerp(A.s0, A.s1, (y - A.y0) / (A.y1 - A.y0));        // A-pillar outer line
export const ROOF_EDGE_Y = 75.4;
export const DOOR = {
  f: { s0: ST.doorF0, s1: ST.doorF1 },
  r: { s0: ST.doorF1 + GAP, s1: ST.doorR1 },
};
// window openings
export const win = {
  f: { sf: (y) => sA(y) + 3.0, sr: (y) => 66.2 - (y - H.beltline) * 0.1, yb: H.beltline + 0.9, yt: 72.9 },
  r: { sf: (y) => 72.6 - (y - H.beltline) * 0.05, sr: (y) => 102.6 - (y - H.beltline) * 0.28, yb: H.beltline + 0.9, yt: 72.9 },
};

// ---- fender: skin with a rounded shoulder that follows the hood edge ----
const fenderTopY = (s) => hoodHeight(s, hoodHalfWidth(s) + GAP) - 0.55;
function fenderW(s, y) {
  const yt = fenderTopY(s);
  const base = wMax(s) * (y < 22 ? 0.9 + 0.1 * smooth(clamp((y - 14) / 8, 0, 1)) : 1);
  const hh = hoodHalfWidth(s) + GAP;
  const t = clamp((y - (yt - 9.5)) / 9.5, 0, 1);
  // quarter-ellipse shoulder from the flare to the hood edge
  const shoulder = 1 - Math.sqrt(1 - Math.pow(1 - t, 2));
  const wTop = hh + 0.15;
  return t <= 0 ? base : lerp(wTop, base, clamp(Math.sqrt(Math.max(0, 1 - t * t)), 0, 1));
}

export function buildBodyGeometry() {
  const G = {}; // name -> { left, right } BufferGeometries (truck meters)
  const both = (fn) => ({ L: fn(-1), R: fn(1) });

  // ---------------- front fender ----------------
  const fenderHem = (s) => lerp(24.5, 21.4, smooth(clamp((s + 33) / 14, 0, 1)));
  G.fender = both((side) => gridPanel({
    nI: 46, nJ: 22, side, w: fenderW, depth: 1.3,
    pos: (u, v) => {
      const s = lerp(K.S_FRONT + 3.2, ST.doorF0 - GAP, Math.pow(u, 1));
      const a = archY(s, 0, ARCH_R);
      const yb = a != null ? a : fenderHem(s);
      return [s, lerp(yb, fenderTopY(s), v)];
    },
  }));

  // ---------------- doors: lower skins ----------------
  const hem = H.hem;
  for (const key of ['f', 'r']) {
    const d = DOOR[key], wn = win[key];
    G[`door_${key}_lower`] = both((side) => gridPanel({
      nI: 36, nJ: 18, side, depth: 1.5,
      pos: colPos(d.s0, d.s1, hem, H.beltline),
    }));
    // frame strips around the window (body-color part of the door)
    const topY = ROOF_EDGE_Y - 0.25;
    const yTopFrame = (key === 'f') ? topY : topY - 0.3;
    const frontEdge = (y) => (key === 'f' ? sA(y) + GAP : d.s0);
    const rearEdge = (y) => d.s1 - (key === 'r' ? (y - H.beltline) * 0.28 + 0 : (y - H.beltline) * 0.1);
    G[`door_${key}_fstrip`] = both((side) => gridPanel({
      nI: 4, nJ: 16, side, depth: 1.0,
      pos: rowPos(H.beltline, yTopFrame, frontEdge, (y) => wn.sf(y)),
    }));
    G[`door_${key}_rstrip`] = both((side) => gridPanel({
      nI: 4, nJ: 16, side, depth: 1.0,
      pos: rowPos(H.beltline, yTopFrame, (y) => wn.sr(y), rearEdge),
    }));
    G[`door_${key}_header`] = both((side) => gridPanel({
      nI: 28, nJ: 3, side, depth: 1.0,
      pos: (u, v) => {
        const y = lerp(wn.yt, yTopFrame, v);
        const a = frontEdge(y), b = rearEdge(y);
        return [lerp(a, b, u), y];
      },
    }));
    // the belt strip between the lower skin and the window bottom
    G[`door_${key}_belt`] = both((side) => gridPanel({
      nI: 24, nJ: 2, side, depth: 1.0,
      pos: (u, v) => { const y = lerp(H.beltline, wn.yb, v); return [lerp(frontEdge(y), rearEdge(y), u), y]; },
    }));
  }

  // ---------------- rocker panel strip between the wheel openings ----------------
  G.rocker = both((side) => gridPanel({ nI: 30, nJ: 3, side, depth: 1.2, pos: colPos(ST.doorF0, ST.bedFront - 0.2, H.rocker, hem - GAP) }));

  // ---------------- cab back corner (C pillar) and cab back wall strip ----------------
  G.cabCorner = both((side) => gridPanel({
    nI: 8, nJ: 24, side, depth: 1.2,
    pos: (u, v) => {
      const y = lerp(hem, ROOF_EDGE_Y - 0.6, v);
      const a = DOOR.r.s1 - (y > H.beltline ? (y - H.beltline) * 0.28 : 0) + GAP;
      return [lerp(a, ST.cabBack + 1.4, u), y];
    },
  }));

  // ---------------- bed sides ----------------
  const bedTop = (s) => H.bedRail - 0.2 - 0.35 * smooth(clamp((s - ST.bedEnd + 8) / 8, 0, 1));
  const bedHem = 21.6;
  G.bed = both((side) => gridPanel({
    nI: 70, nJ: 26, side, depth: 1.4,
    pos: (u, v) => {
      const s = lerp(ST.bedFront + 0.4, ST.bedEnd, u);
      const a = archY(s, WB, ARCH_R + 0.4);
      return [s, lerp(a != null ? a : bedHem, bedTop(s), v)];
    },
  }));
  return G;
}

// ---------------- tops ----------------
// A crowned top panel: surface y = height(s, x) over x in [-xh(s), xh(s)], with a rolled edge down to the side line.
export function topPanel({ s0, s1, xh, height, nI = 24, nJ = 40, thick = 0.9, edgeDrop = 1.4, flipNormals = false }) {
  const P = [], uv = [];
  const idx = (i, j) => j * (nI + 1) + i;
  for (let j = 0; j <= nJ; j++) {
    const s = lerp(s0, s1, j / nJ);
    for (let i = 0; i <= nI; i++) {
      const t = (i / nI) * 2 - 1; // -1..1
      const x = t * xh(s);
      P.push(new THREE.Vector3(x * IN, height(s, x) * IN, s * IN));
      uv.push(x * IN, s * IN);
    }
  }
  const pos = [], ind = [];
  for (const p of P) pos.push(p.x, p.y, p.z);
  for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) {
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
    // normal up for increasing x and increasing z: cross(b-a, d-a) = x_hat x z_hat = -y; so flip
    ind.push(a, b, d, b, c, d);
  }
  // want +Y normal: cross((+x),(+z)) = -y, therefore reverse
  const ind2 = []; for (let k = 0; k < ind.length; k += 3) ind2.push(ind[k], ind[k + 2], ind[k + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(flipNormals ? ind : ind2);
  g.computeVertexNormals();
  return g;
}

// downward skirt along a polyline of points (meters), used for hood/roof edges
export function skirtStrip(points, drop = 1.4, inward = 0.25, upNormalSign = 1) {
  const pos = [], ind = [];
  points.forEach((p) => {
    pos.push(p.x, p.y, p.z);
    const q = p.clone(); q.y -= drop * IN; q.x -= Math.sign(p.x) * inward * IN; pos.push(q.x, q.y, q.z);
  });
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    if (upNormalSign > 0) ind.push(a, b, c, c, b, d); else ind.push(a, c, b, c, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
  g.setIndex(ind); g.computeVertexNormals();
  return g;
}

// the perimeter of a top panel (front edge, right side, rear edge, left side) as points in meters
export function topPerimeter({ s0, s1, xh, height, n = 40 }) {
  const pts = [];
  const P = (s, x) => new THREE.Vector3(x * IN, height(s, x) * IN, s * IN);
  for (let i = 0; i <= n; i++) pts.push(P(s0, lerp(-xh(s0), xh(s0), i / n))); // front edge, left to right
  for (let i = 1; i <= n; i++) { const s = lerp(s0, s1, i / n); pts.push(P(s, xh(s))); } // right side, front to back
  for (let i = 1; i <= n; i++) pts.push(P(s1, lerp(xh(s1), -xh(s1), i / n))); // rear edge right to left
  for (let i = 1; i <= n; i++) { const s = lerp(s1, s0, i / n); pts.push(P(s, -xh(s))); } // left side back to front
  return pts;
}
