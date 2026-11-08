// Geometry kit for the engine bay. Everything here is authored in INCHES (the engine group is scaled by IN_TO_M once at the root).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const D2R = Math.PI / 180;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// ---------------- pure helpers (tested) ----------------
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Convex wrap of a set of circles (belt around pulleys): returns the closed hull outline as 2D points (x, y), sampling each arc.
export function beltHull(circles, arcStep = 0.25) {
  const pts = [];
  for (const c of circles) for (let a = 0; a < Math.PI * 2; a += arcStep) pts.push([c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r]);
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = []; for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper); // counter-clockwise
}
export function polyLength(pts, closed = true) {
  let L = 0; for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return L;
}
// Engine vibration on its mounts: displacement (inches) and roll (radians) at time t. Frequency follows rpm; amplitude fades when not running.
export function engineShake(t, rpm, running, amp = 1) {
  const a = running ? amp * clamp(rpm / 700, 0.25, 1.6) : 0;
  const f = (Math.max(rpm, 0) / 60) * 2; // firing-order frequency (Hz) as in the brief
  const lo = Math.sin(t * 2 * Math.PI * 5.3) * 0.6 + Math.sin(t * 2 * Math.PI * 3.1) * 0.4; // slow lumpy idle rock
  const hi = Math.sin(t * 2 * Math.PI * f) ;
  return { dx: a * (0.010 * lo + 0.006 * hi), dy: a * (0.008 * hi + 0.004 * lo), roll: a * (0.0011 * lo + 0.0005 * hi) };
}
// Fan: angular speed (rad/s) from the engine rpm and the duty (clutch engagement, 0..1). The real fan turns at about engine speed when the
// clutch is locked; the visual speed is scaled down and capped so the 8 blades do not strobe at 60 fps (blade spacing 0.79 rad).
export function fanOmega(rpm, duty) {
  const slip = clamp(duty, 0, 1);
  return Math.min(Math.max(rpm, 0) * 2 * Math.PI / 60 * 0.2 * (0.15 + 0.85 * slip), 24);
}
// Corrugation: radius multiplier for a hose with n ridges along t in 0..1
export function ridge(t, n, amp) { return 1 + amp * Math.sin(t * n * Math.PI * 2); }

// ---------------- geometry building ----------------
// Make any geometry mergeable: non-indexed, with position, normal and uv only.
export function plain(g) {
  let h = g.index ? g.toNonIndexed() : g;
  if (!h.attributes.normal) h.computeVertexNormals();
  if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
  for (const k of Object.keys(h.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') h.deleteAttribute(k);
  h.clearGroups();
  return h;
}
export function mergeAll(list) {
  const g = list.filter(Boolean).map(plain);
  return g.length === 1 ? g[0] : mergeGeometries(g, false);
}

// transform helper: position, euler (radians), uniform or per-axis scale; edits and returns the geometry
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
export function T(g, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e);
  const sc = typeof s === 'number' ? _s.set(s, s, s) : _s.set(s[0], s[1], s[2]);
  _m.compose(_p.set(p[0], p[1], p[2]), _q, sc);
  g.applyMatrix4(_m); return g;
}
// orient a Y-axis geometry (centered at the origin) along a -> b, centered at the midpoint
export function alongY(g, a, b) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
export const vec = (p) => (Array.isArray(p) ? V(p[0], p[1], p[2]) : p);
// cylinder between two points (inches)
export function cylBetween(a, b, r0, r1 = r0, seg = 12, open = false) {
  a = vec(a); b = vec(b);
  const len = a.distanceTo(b);
  return alongY(new THREE.CylinderGeometry(r1, r0, len, seg, 1, open), a, b);
}
// cylinder with its axis along x, y or z, centered at c, length L
export function cylAxis(axis, c, r, L, seg = 16, r1 = r) {
  const g = new THREE.CylinderGeometry(r1, r, L, seg, 1);
  if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(c[0], c[1], c[2]); return g;
}
export function boxAt(c, w, h, d, rot = [0, 0, 0]) {
  const g = new THREE.BoxGeometry(w, h, d); return T(g, c, rot);
}
// rounded box centered at c (w x h x d), edge radius r
export function rbox(c, w, h, d, r = 0.2, seg = 2, rot = [0, 0, 0]) {
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: r > 0.001, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: seg * 2 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return T(g, c, rot);
}
// extrude a 2D polygon [[x, y], ...] (in the xy plane) by depth along z (centered), with bevel
export function polyExtrude(pts, depth, bevel = 0.1, holes = []) {
  const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  for (const h of holes) s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2); return g;
}
export function circlePts(cx, cy, r, n = 24) { const a = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; a.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } return a; }

// swept tube along a Catmull-Rom path through points (arrays or Vector3). opts: radial, segs, radius (number or f(t)), caps, tension
export function tube(points, r, { radial = 10, segs, caps = true, closed = false, tension = 0.5, uvScale = 0.1, ridges = 0, ridgeAmp = 0.07 } = {}) {
  const pts = points.map(vec);
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', tension);
  const len = curve.getLength();
  const n = segs || Math.max(8, Math.ceil(len / 0.9));
  const fr = curve.computeFrenetFrames(n, closed);
  const rf = typeof r === 'function' ? r : () => r;
  const P = [], UV = [], I = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, c = curve.getPointAt(t);
    let rr = rf(t); if (ridges) rr *= ridge(t, ridges, ridgeAmp);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      P.push(c.x + (fr.normals[i].x * cs + fr.binormals[i].x * sn) * rr, c.y + (fr.normals[i].y * cs + fr.binormals[i].y * sn) * rr, c.z + (fr.normals[i].z * cs + fr.binormals[i].z * sn) * rr);
      UV.push(t * len * uvScale, j / radial);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1;
    I.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals();
  const out = [g];
  if (caps && !closed) {
    for (const end of [0, 1]) {
      const c = curve.getPointAt(end), tn = curve.getTangentAt(end).multiplyScalar(end ? 1 : -1), rr = rf(end);
      const cap = new THREE.CircleGeometry(rr, radial); // disc normal (+z) is turned along the end tangent below
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tn);
      cap.applyQuaternion(q); cap.translate(c.x, c.y, c.z); out.push(cap);
    }
  }
  const m = mergeAll(out); m.userData = { length: len };
  return m;
}
export function curveOf(points, tension = 0.5) { return new THREE.CatmullRomCurve3(points.map(vec), false, 'catmullrom', tension); }

// closed polyline (2D, counter-clockwise) -> flat belt ring: outer outline offset out by t/2 and in by t/2, width along z (centered at z = 0)
export function beltRing(poly, thick, width) {
  const n = poly.length, outer = [], inner = [];
  for (let i = 0; i < n; i++) {
    const p = poly[(i + n - 1) % n], c = poly[i], q = poly[(i + 1) % n];
    let tx = q[0] - p[0], ty = q[1] - p[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = ty, ny = -tx; // outward normal for counter-clockwise
    outer.push([c[0] + nx * thick / 2, c[1] + ny * thick / 2]); inner.push([c[0] - nx * thick / 2, c[1] - ny * thick / 2]);
  }
  const s = new THREE.Shape(outer.map((p) => new THREE.Vector2(p[0], p[1])));
  s.holes.push(new THREE.Path(inner.slice().reverse().map((p) => new THREE.Vector2(p[0], p[1]))));
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2); return g;
}

// ---------------- batching ----------------
// A Batch collects geometry per material key and flushes one merged Mesh per material into a parent group.
export class Batch {
  constructor() { this.map = new Map(); }
  add(key, geo) { if (!geo) return this; (this.map.get(key) || this.map.set(key, []).get(key)).push(geo); return this; }
  flush(parent, mats, { cast = false, receive = true, name = '' } = {}) {
    for (const [key, list] of this.map) {
      const m = mats[key]; if (!m) throw new Error('no material ' + key);
      const mesh = new THREE.Mesh(mergeAll(list), m); mesh.name = name ? `${name}_${key}` : key; mesh.castShadow = cast; mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh);
    }
    this.map.clear(); return parent;
  }
}
// Instanced fasteners: hex bolt heads and hose clamps collected per assembly, flushed as InstancedMeshes
export class Fasteners {
  constructor(mats) { this.mats = mats; this.bolts = []; this.clamps = []; this.washers = []; }
  // bolt head at position p (inches) pointing along dir, head radius r
  bolt(p, dir = [0, 1, 0], r = 0.28) { this.bolts.push([vec(p), vec(dir).normalize(), r]); }
  clamp(p, dir, r) { this.clamps.push([vec(p), vec(dir).normalize(), r]); }
  flush(parent) {
    const make = (list, geo, mat, name) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length); im.name = name; im.castShadow = false; im.receiveShadow = true;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      list.forEach(([p, d, r], i) => { q.setFromUnitVectors(Y_AXIS, d); m.compose(p, q, new THREE.Vector3(r, r, r)); im.setMatrixAt(i, m); });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; parent.add(im);
    };
    const hex = new THREE.CylinderGeometry(1, 1, 0.55, 6); hex.translate(0, 0.27, 0);
    make(this.bolts, hex, this.mats.zinc, 'bolts');
    // clamp: a band (short open ring) plus a screw housing, radius 1 scaled by the hose radius
    const band = new THREE.CylinderGeometry(1.1, 1.1, 0.5, 14, 1, true); const bandB = new THREE.CylinderGeometry(1.1, 1.1, 0.5, 14, 1, true);
    bandB.scale(0.94, 1, 0.94);
    const hous = new THREE.BoxGeometry(0.5, 0.46, 0.3); hous.translate(1.15, 0, 0);
    const screw = new THREE.CylinderGeometry(0.1, 0.1, 0.52, 6); screw.rotateX(Math.PI / 2); screw.translate(1.15, 0, 0);
    const cg = mergeAll([band, bandB, hous, screw]);
    make(this.clamps, cg, this.mats.stainless, 'clamps');
    this.bolts.length = 0; this.clamps.length = 0;
  }
}
