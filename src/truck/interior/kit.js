// Geometry and batching helpers for the interior. All interior geometry is authored in INCHES in the truck frame
// (x lateral, +x passenger; y up; z = s rearward) and converted to meters by scaling a parent group by IN_TO_M.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const IN = 0.0254;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smooth = (t) => t * t * (3 - 2 * t);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// matrix from position, euler rotation (radians, XYZ) and scale
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'XYZ'); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_v, _q, _s);
}
// matrix that places an object at p, with its local +Z axis along dir (and local +Y as close to up as possible)
export function lookM(p, dir, up = [0, 1, 0]) {
  const d = new THREE.Vector3(...dir).normalize(), u = new THREE.Vector3(...up);
  const x = new THREE.Vector3().crossVectors(u, d); if (x.lengthSq() < 1e-8) x.set(1, 0, 0); x.normalize();
  const y = new THREE.Vector3().crossVectors(d, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, d).setPosition(p[0], p[1], p[2]);
}

// ---- batching: many small parts merged into one mesh per material ----
export class Batch {
  constructor(materials) { this.materials = materials; this.map = new Map(); }
  add(geom, key, matrix) {
    let g = geom.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(g);
    return this;
  }
  build(parent, { cast = false, receive = true, prefix = '' } = {}) {
    const out = [];
    for (const [key, list] of this.map) {
      const geo = mergeGeometries(list, false); list.forEach((g) => g.dispose());
      const mat = this.materials[key]; if (!mat) throw new Error('Batch: no material ' + key);
      const m = new THREE.Mesh(geo, mat); m.name = prefix + key; m.castShadow = cast; m.receiveShadow = receive;
      parent.add(m); out.push(m);
    }
    this.map.clear();
    return out;
  }
}

// ---- primitive geometries (inches) ----
export const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cylG = (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
export const cylX = (rt, rb, h, seg = 20) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); g.rotateZ(Math.PI / 2); return g; };
export const cylZ = (rt, rb, h, seg = 20) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); g.rotateX(Math.PI / 2); return g; };

// rounded-rectangle shape in the XY plane
export function rrShape(w, h, r, cx = 0, cy = 0) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const s = new THREE.Shape(); const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// rounded plate: w x h face in XY, thickness d along +Z (front face at z = d), with a bevel of b on the front edge
export function plateG(w, h, d, r = 0.2, bevel = 0.05, hole = null) {
  const s = rrShape(w, h, r);
  if (hole) s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(d - bevel, 0.001), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 1, curveSegments: 4 });
  return g;
}
// generic extruded shape given as [[x,y],...] points
export function polyG(pts, depth = 1, bevel = 0, closed = true) {
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
}

// weld normals of duplicated vertices (same position) so a built-from-faces mesh shades smoothly across seams
export function smoothSeams(g, eps = 1e-3) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const key = (i) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`;
  const acc = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = key(i); const a = acc.get(k) || [0, 0, 0];
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); acc.set(k, a);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1;
    nor.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  nor.needsUpdate = true;
  return g;
}

// axis coordinate list with extra resolution in the rounded bands: ends at +-H, bands of width r, interior steps ~ step
function axisCoords(H, r, step, bandSegs) {
  const out = [-H];
  for (let i = 1; i <= bandSegs; i++) out.push(-H + (r * i) / bandSegs);
  const a = -H + r, b = H - r, n = Math.max(1, Math.round((b - a) / step));
  for (let i = 1; i < n; i++) out.push(a + ((b - a) * i) / n);
  for (let i = 0; i < bandSegs; i++) out.push(H - r + (r * i) / bandSegs);
  out.push(H);
  return [...new Set(out.map((v) => +v.toFixed(5)))].sort((p, q) => p - q);
}

// A rounded box with a dense grid that can be deformed (padded seat cushions, pillows, door pulls).
// deform(p, o) mutates p = [x,y,z] (the rounded position); o = [x,y,z] is the original box-surface position.
// UVs are planar in inches by dominant face so a grain texture keeps a real-world scale.
export function softBox({ w, h, d, r = 0.6, step = 1.0, band = 2, deform = null, stepX, stepY, stepZ }) {
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  const xs = axisCoords(w / 2, r, stepX || step, band), ys = axisCoords(h / 2, r, stepY || step, band), zs = axisCoords(d / 2, r, stepZ || step, band);
  const pos = [], uv = [], idx = [];
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const face = (axis, sign, A, B, uvf) => { // A, B coordinate arrays of the two other axes
    const base = pos.length / 3;
    for (let j = 0; j < B.length; j++) for (let i = 0; i < A.length; i++) {
      const o = [0, 0, 0];
      const ax = [0, 1, 2].filter((k) => k !== axis);
      o[axis] = sign * [w, h, d][axis] / 2; o[ax[0]] = A[i]; o[ax[1]] = B[j];
      const q = [clamp(o[0], -hx, hx), clamp(o[1], -hy, hy), clamp(o[2], -hz, hz)];
      const dir = [o[0] - q[0], o[1] - q[1], o[2] - q[2]]; const l = Math.hypot(...dir) || 1;
      const p = [q[0] + (dir[0] / l) * r, q[1] + (dir[1] / l) * r, q[2] + (dir[2] / l) * r];
      if (deform) deform(p, o);
      pos.push(p[0], p[1], p[2]); uv.push(...uvf(o));
    }
    const nA = A.length;
    for (let j = 0; j < B.length - 1; j++) for (let i = 0; i < nA - 1; i++) {
      const a = base + j * nA + i, b = a + 1, c = a + nA + 1, dd = a + nA;
      // orientation chosen below by the sign/axis parity
      const flip = (sign > 0) === (axis !== 1);
      if (flip) idx.push(a, b, dd, b, c, dd); else idx.push(a, dd, b, b, dd, c);
    }
  };
  // axis 0 (x faces): A = y, B = z ; axis 1 (y faces): A = x, B = z ; axis 2 (z faces): A = x, B = y
  face(0, 1, ys, zs, (o) => [o[2], o[1]]); face(0, -1, ys, zs, (o) => [o[2], o[1]]);
  face(1, 1, xs, zs, (o) => [o[0], o[2]]); face(1, -1, xs, zs, (o) => [o[0], o[2]]);
  face(2, 1, xs, ys, (o) => [o[0], o[1]]); face(2, -1, xs, ys, (o) => [o[0], o[1]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return smoothSeams(g);
}

// A heightfield patch lying on a surface: grid over (u,v) in [-1,1]^2 mapped by f(u,v) -> [x,y,z]; normals computed.
export function surfaceG(nu, nv, f, { flip = false } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * 2 - 1, v = (j / nv) * 2 - 1; const p = f(u, v); pos.push(p[0], p[1], p[2]); uv.push(p[3] ?? p[0], p[4] ?? p[2]);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
    if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// A flat ribbon (seat belt webbing, stitching) along a polyline of [x,y,z] points. `normal` is the face normal hint.
export function ribbonG(points, width, normal = [0, 1, 0], thickness = 0) {
  const pos = [], uv = [], idx = [];
  const n = new THREE.Vector3(...normal);
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const p = new THREE.Vector3(...points[i]);
    const a = new THREE.Vector3(...points[Math.max(0, i - 1)]), b = new THREE.Vector3(...points[Math.min(points.length - 1, i + 1)]);
    const t = b.clone().sub(a).normalize();
    const side = new THREE.Vector3().crossVectors(t, n).normalize().multiplyScalar(width / 2);
    if (i) acc += p.distanceTo(new THREE.Vector3(...points[i - 1]));
    const l = p.clone().sub(side), r = p.clone().add(side);
    pos.push(l.x, l.y, l.z, r.x, r.y, r.z); uv.push(0, acc, 1, acc);
  }
  for (let i = 0; i < points.length - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (thickness > 0) { // give it a back face (double sided look) by merging an offset reversed copy
    const g2 = g.clone(); g2.translate(-n.x * thickness, -n.y * thickness, -n.z * thickness);
    const ix = g2.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g2.computeVertexNormals();
    return mergeGeometries([g.toNonIndexed(), g2.toNonIndexed()], false);
  }
  return g;
}

// stitching: a row of short thin dashes (instanced as merged boxes) along a polyline lying on a surface
export function stitchesG(points, { len = 0.16, gap = 0.1, w = 0.05, h = 0.04, normals = null, up = [0, 1, 0] } = {}) {
  const parts = [];
  // resample the polyline by arc length
  const segs = []; let total = 0;
  for (let i = 0; i < points.length - 1; i++) { const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]); const l = a.distanceTo(b); segs.push([a, b, l]); total += l; }
  const step = len + gap; const count = Math.max(1, Math.floor(total / step));
  const at = (dist) => { let acc = 0; for (const [a, b, l] of segs) { if (dist <= acc + l || l === segs[segs.length - 1][2]) { const t = clamp((dist - acc) / (l || 1), 0, 1); return [a.clone().lerp(b, t), b.clone().sub(a).normalize()]; } acc += l; } return null; };
  const base = new THREE.PlaneGeometry(len, w); base.rotateX(-Math.PI / 2); // a flat dash lying on the surface (2 triangles)
  for (let i = 0; i < count; i++) {
    const r = at(i * step + len / 2 + (total - count * step) / 2); if (!r) continue;
    const [p, t] = r; const n = new THREE.Vector3(...(normals ? normals(p) : up));
    const side = new THREE.Vector3().crossVectors(n, t).normalize(); const nn = new THREE.Vector3().crossVectors(t, side).normalize();
    const m = new THREE.Matrix4().makeBasis(t, nn, side.clone().negate()).setPosition(p.x + nn.x * h * 0.5, p.y + nn.y * h * 0.5, p.z + nn.z * h * 0.5);
    parts.push(base.clone().applyMatrix4(m).toNonIndexed());
  }
  return parts.length ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
}

// tube along a path of points (cables, hoses, grab handles)
export function tubeG(points, r = 0.1, seg = 24, radial = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, r, radial, closed);
}

// plane with a given size, facing +Z, UV 0..1
export const planeG = (w, h) => new THREE.PlaneGeometry(w, h);

// Re-assign UVs by dominant face normal, in inches (planar, triplanar-ish): keeps a grain texture at real-world scale on
// extruded / lofted parts whose native UVs are stretched. (x,y,z) are truck inches.
export function boxUV(g, scale = 1) {
  const p = g.attributes.position, n = g.attributes.normal; const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) { uv[i * 2] = p.getZ(i) * scale; uv[i * 2 + 1] = p.getY(i) * scale; }
    else if (ay >= az) { uv[i * 2] = p.getX(i) * scale; uv[i * 2 + 1] = p.getZ(i) * scale; }
    else { uv[i * 2] = p.getX(i) * scale; uv[i * 2 + 1] = p.getY(i) * scale; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Prism: a profile polygon given in the (s, y) plane (s = truck z, inches), extruded along X from x0 to x1.
// Triangle winding is fixed so normals point out of the solid.
export function prismX(profile, x0, x1) {
  const n = profile.length; const pos = [], idx = [];
  let area = 0; for (let i = 0; i < n; i++) { const [a, b] = profile[i], [c, d] = profile[(i + 1) % n]; area += a * d - c * b; }
  const ccw = area > 0;
  const pushTri = (A, B, C, want) => {
    const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ac = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const dot = cr[0] * want[0] + cr[1] * want[1] + cr[2] * want[2];
    const base = pos.length / 3; pos.push(...A, ...B, ...C); idx.push(base, base + (dot >= 0 ? 1 : 2), base + (dot >= 0 ? 2 : 1));
  };
  for (let i = 0; i < n; i++) {
    const [s0, y0] = profile[i], [s1, y1] = profile[(i + 1) % n];
    const ds = s1 - s0, dy = y1 - y0; const l = Math.hypot(ds, dy) || 1;
    const nz = ccw ? dy / l : -dy / l, ny = ccw ? -ds / l : ds / l;
    const want = [0, ny, nz];
    pushTri([x0, y0, s0], [x1, y0, s0], [x1, y1, s1], want); pushTri([x0, y0, s0], [x1, y1, s1], [x0, y1, s1], want);
  }
  const tri = THREE.ShapeUtils.triangulateShape(profile.map(([s, y]) => new THREE.Vector2(s, y)), []);
  for (const [a, b, c] of tri) {
    pushTri([x0, profile[a][1], profile[a][0]], [x0, profile[b][1], profile[b][0]], [x0, profile[c][1], profile[c][0]], [-1, 0, 0]);
    pushTri([x1, profile[a][1], profile[a][0]], [x1, profile[b][1], profile[b][0]], [x1, profile[c][1], profile[c][0]], [1, 0, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return boxUV(toCreasedNormals(g.toNonIndexed(), Math.PI / 4.2));
}

// canvas texture from a drawing function
export function canvasTex(w, h, draw, { srgb = true, aniso = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso; return t;
}
