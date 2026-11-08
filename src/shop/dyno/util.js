// Small geometry helpers for the dyno hardware: matrix shorthand and a batcher that merges static parts per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// Matrix from position, euler rotation (radians, XYZ) and scale.
export function mx(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

// Position/normal/uv, non-indexed (so geometries of any origin can be merged).
export function plain(g) {
  const x = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k);
  if (!x.attributes.normal) x.computeVertexNormals();
  if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
  return x;
}

// Cylinder along an axis ('x' | 'y' | 'z'), UVs unchanged.
export function cyl(r, len, axis = 'y', seg = 24, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1);
  if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
}

// Box with UVs in meters so a tiled texture keeps its scale.
export function mbox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return g;
}

// Collects static geometry per material and emits one merged mesh per material.
export class Batch {
  constructor() { this.map = new Map(); }
  add(geom, material, matrix) {
    const g = plain(geom);
    if (matrix) g.applyMatrix4(matrix);
    let e = this.map.get(material);
    if (!e) { e = []; this.map.set(material, e); }
    e.push(g);
    return this;
  }
  build(parent, { cast = false, receive = true, name = 'batch' } = {}) {
    const out = [];
    let i = 0;
    for (const [material, list] of this.map) {
      const m = new THREE.Mesh(mergeGeometries(list, false), material);
      m.castShadow = cast; m.receiveShadow = receive; m.name = `${name}_${i++}`;
      parent.add(m); out.push(m);
      list.forEach((g) => g.dispose());
    }
    this.map.clear();
    return out;
  }
}

// One multi-material mesh from [geometry, materialIndex, matrix] triples (for parts that move as a unit).
export function composite(parts, materials, { cast = false, receive = true } = {}) {
  const per = materials.map(() => []);
  for (const [g, mi, m] of parts) { const p = plain(g); if (m) p.applyMatrix4(m); per[mi].push(p); }
  const geos = [], groups = [];
  let start = 0;
  per.forEach((list, mi) => {
    if (!list.length) return;
    const merged = mergeGeometries(list, false);
    geos.push(merged);
    groups.push({ start, count: merged.attributes.position.count, materialIndex: mi });
    start += merged.attributes.position.count;
  });
  const all = mergeGeometries(geos, false);
  groups.forEach((g) => all.addGroup(g.start, g.count, g.materialIndex));
  const mesh = new THREE.Mesh(all, materials);
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  return mesh;
}

export function instanced(geom, material, matrices, { cast = false, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geom, material, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = cast; im.receiveShadow = receive;
  return im;
}

export function mesh(geom, material, x = 0, y = 0, z = 0, { cast = false, receive = true, name } = {}) {
  const m = new THREE.Mesh(geom, material);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}

// Tube swept through points with a Catmull-Rom curve.
export function tubeThrough(points, r, { seg = 48, radial = 8, closed = false, tension = 0.5 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', tension);
  return new THREE.TubeGeometry(curve, seg, r, radial, closed);
}

// Corrugated flexible tube (hose / duct): a fixed number of rings along a curve with a sinusoidal ridge profile.
// The geometry can be re-fitted to a new curve each frame (accordion effect: the ridge count stays constant).
export class CorrugatedTube {
  constructor(rings, radial, radius, ridges, amp = 0.09) {
    this.rings = rings; this.radial = radial; this.radius = radius; this.ridges = ridges; this.amp = amp;
    const vc = (rings + 1) * (radial + 1);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
    const uv = new Float32Array(vc * 2);
    const idx = [];
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= radial; j++) {
      uv[(i * (radial + 1) + j) * 2] = j / radial; uv[(i * (radial + 1) + j) * 2 + 1] = (i / rings) * ridges;
      if (i < rings && j < radial) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(idx);
  }
  fit(curve) {
    const { rings, radial, radius, ridges, amp } = this;
    const frames = curve.computeFrenetFrames(rings, false);
    const pos = this.geometry.attributes.position.array, P = new THREE.Vector3();
    for (let i = 0; i <= rings; i++) {
      curve.getPointAt(i / rings, P);
      const N = frames.normals[i], Bn = frames.binormals[i];
      const r = radius * (1 + amp * Math.cos((i / rings) * ridges * Math.PI * 2));
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r, k = (i * (radial + 1) + j) * 3;
        pos[k] = P.x + N.x * c + Bn.x * s; pos[k + 1] = P.y + N.y * c + Bn.y * s; pos[k + 2] = P.z + N.z * c + Bn.z * s;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere(); this.geometry.computeBoundingBox();
  }
}
