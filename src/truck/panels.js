// Panel builder: cuts a patch out of the parametric skin, gives it a folded edge flange so panel gaps look real.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { halfWidth, IN_TO_M } from './skin.js';

// pos(u,v) -> [s, y] in inches for u,v in [0,1]. Returns a BufferGeometry in truck meters (x lateral, y up, z = s).
// side: +1 passenger (+x), -1 driver (-x). depth: flange depth in inches. w(s,y): half width function.
export function gridPanel({ nI, nJ, pos, side = 1, depth = 1.1, w = halfWidth, offset = 0, uvK = 1, flange = true, back = true }) {
  const P = [], uv = [];
  const idx = (i, j) => j * (nI + 1) + i;
  for (let j = 0; j <= nJ; j++) for (let i = 0; i <= nI; i++) {
    const [s, y] = pos(i / nI, j / nJ);
    const x = w(s, y) + offset;
    P.push(new THREE.Vector3(side * x * IN_TO_M, y * IN_TO_M, s * IN_TO_M));
    uv.push(s * IN_TO_M * uvK, y * IN_TO_M * uvK);
  }
  // orientation: make normals point outward (+x for the passenger side)
  const probe = new THREE.Vector3().crossVectors(P[idx(1, 0)].clone().sub(P[idx(0, 0)]), P[idx(0, 1)].clone().sub(P[idx(0, 0)]));
  const flip = probe.x * side < 0;

  const tri = [];
  const quad = (a, b, c, d) => { // a b c d counter-clockwise for outward normal
    if (flip) { tri.push(a, c, b, a, d, c); } else { tri.push(a, b, c, a, c, d); }
  };
  // note: with unflipped, outward normal comes from (a,b,c) order as given by cross(b-a, c-a)
  const skinPos = [], skinUv = [], skinIdx = [];
  for (const p of P) skinPos.push(p.x, p.y, p.z);
  for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) {
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
    // quad a(i,j) b(i+1,j) c(i+1,j+1) d(i,j+1): orientation follows cross(b-a, d-a)
    if (flip) skinIdx.push(a, d, b, b, d, c); else skinIdx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(skinPos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(skinIdx);
  g.computeVertexNormals();
  const parts = [g];

  if (flange) {
    // boundary loop (counter-clockwise in grid order)
    const loop = [];
    for (let i = 0; i < nI; i++) loop.push(idx(i, 0));
    for (let j = 0; j < nJ; j++) loop.push(idx(nI, j));
    for (let i = nI; i > 0; i--) loop.push(idx(i, nJ));
    for (let j = nJ; j > 0; j--) loop.push(idx(0, j));
    const fp = [], fi = [];
    const inward = new THREE.Vector3(-side * depth * IN_TO_M, 0, 0);
    loop.forEach((k) => { const p = P[k]; fp.push(p.x, p.y, p.z); });
    loop.forEach((k) => { const p = P[k].clone().add(inward); fp.push(p.x, p.y, p.z); });
    const n = loop.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      // wall quad between outer loop k..k2 and inner loop; orientation chosen so the wall faces away from the panel interior
      if (flip) fi.push(k, n + k, k2, k2, n + k, n + k2); else fi.push(k, k2, n + k, k2, n + k2, n + k);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(fp.length / 3 * 2).fill(0), 2));
    fg.setIndex(fi);
    fg.computeVertexNormals();
    parts.push(fg);
    if (back) {
      const bp = [], bi = [];
      for (const p of P) { const q = p.clone().add(inward); bp.push(q.x, q.y, q.z); }
      for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) {
        const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
        // back face: opposite orientation of the skin
        if (flip) bi.push(a, b, d, b, c, d); else bi.push(a, d, b, b, d, c);
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
      bg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(bp.length / 3 * 2).fill(0), 2));
      bg.setIndex(bi); bg.computeVertexNormals();
      parts.push(bg);
    }
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

// helpers to build pos() lambdas -------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;

// columns mode: u -> s in [s0, s1]; v -> y between yb(s) and yt(s)
export const colPos = (s0, s1, yb, yt, uBias = 1) => (u, v) => {
  const s = lerp(s0, s1, Math.pow(u, uBias));
  const a = typeof yb === 'function' ? yb(s) : yb, b = typeof yt === 'function' ? yt(s) : yt;
  return [s, lerp(a, b, v)];
};
// rows mode: v -> y in [y0, y1]; u -> s between sl(y) and sr(y)
export const rowPos = (y0, y1, sl, sr) => (u, v) => {
  const y = lerp(y0, y1, v);
  const a = typeof sl === 'function' ? sl(y) : sl, b = typeof sr === 'function' ? sr(y) : sr;
  return [lerp(a, b, u), y];
};
