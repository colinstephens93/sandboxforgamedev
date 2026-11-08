// Shared helpers for the shop equipment: a geometry merger (one draw call per material per item),
// shared PBR materials, and small utilities. Everything is generated in code.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCanvas, noiseField, canvasFromField, heightToNormal, tex, rng } from '../../core/proc.js';
import { mat as coreMat } from '../../core/materials.js';
import { metricBox, roundedBoxGeometry } from '../../core/geom.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);

// Rounded box with the exact outer size (roundedBoxGeometry grows by r on each side).
export function rbox(w, h, d, r = 0.006, seg = 2) {
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  if (r <= 0.0005) return metricBox(w, h, d);
  const g = roundedBoxGeometry(w - 2 * r, h - 2 * r, d, r, seg);
  return g;
}

// Collects primitives (already transformed to the item's local frame) and merges them per material.
export class Part {
  constructor() { this.map = new Map(); this.tris = 0; }
  push(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    if (geo.index) geo = geo.toNonIndexed();
    _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    geo.applyMatrix4(_m);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(geo);
    this.tris += geo.attributes.position.count / 3;
    return this;
  }
  // box: o = { rx, ry, rz, r (corner radius) }
  box(mat, w, h, d, x = 0, y = 0, z = 0, o = {}) {
    const g = o.r ? rbox(w, h, d, o.r, o.seg || 2) : metricBox(w, h, d);
    return this.push(mat, g, x, y, z, o.rx, o.ry, o.rz);
  }
  // cylinder along o.axis ('y' default, 'x', 'z'); r2 = other end radius
  cyl(mat, r, h, x = 0, y = 0, z = 0, o = {}) {
    const g = new THREE.CylinderGeometry(r, o.r2 ?? r, h, o.seg || 16, 1, !!o.open);
    const ax = o.axis || 'y';
    let rx = o.rx || 0, ry = o.ry || 0, rz = o.rz || 0;
    if (ax === 'x') rz += Math.PI / 2; else if (ax === 'z') rx += Math.PI / 2;
    return this.push(mat, g, x, y, z, rx, ry, rz);
  }
  sph(mat, r, x = 0, y = 0, z = 0, o = {}) {
    const g = new THREE.SphereGeometry(r, o.seg || 12, o.seg ? Math.ceil(o.seg * 0.7) : 8);
    return this.push(mat, g, x, y, z, 0, 0, 0, o.sx || 1, o.sy || 1, o.sz || 1);
  }
  torus(mat, R, r, x = 0, y = 0, z = 0, o = {}) {
    const g = new THREE.TorusGeometry(R, r, o.rseg || 8, o.seg || 24);
    const ax = o.axis || 'z'; // torus lies in XY by default (axis z)
    let rx = 0, ry = 0;
    if (ax === 'y') rx = Math.PI / 2; else if (ax === 'x') ry = Math.PI / 2;
    return this.push(mat, g, x, y, z, rx, ry, 0, o.sx || 1, o.sy || 1, o.sz || 1);
  }
  lathe(mat, pts, x = 0, y = 0, z = 0, o = {}) {
    const g = new THREE.LatheGeometry(pts.map(([r, yy]) => new THREE.Vector2(r, yy)), o.seg || 24);
    return this.push(mat, g, x, y, z, o.rx, o.ry, o.rz);
  }
  // a rod between two points
  rod(mat, a, b, r, o = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    if (len < 1e-5) return this;
    const g = new THREE.CylinderGeometry(r, o.r2 ?? r, len, o.seg || 8, 1, !!o.open).toNonIndexed();
    const dir = B.clone().sub(A).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    return this._raw(mat, g.applyMatrix4(new THREE.Matrix4().compose(mid, q, _one)));
  }
  _raw(mat, geo) {
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(geo);
    this.tris += geo.attributes.position.count / 3;
    return this;
  }
  // polyline pipe with elbow spheres at the corners
  tube(mat, pts, r, o = {}) {
    for (let i = 0; i < pts.length - 1; i++) this.rod(mat, pts[i], pts[i + 1], r, o);
    if (o.elbows !== false) for (let i = 1; i < pts.length - 1; i++) this.sph(mat, r * 1.12, pts[i][0], pts[i][1], pts[i][2], { seg: 8 });
    return this;
  }
  // smooth curve (hose) through points
  hose(mat, pts, r, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.4);
    const g = new THREE.TubeGeometry(curve, o.segs || 24, r, o.radial || 8, false);
    return this._raw(mat, g.index ? g.toNonIndexed() : g);
  }
  build(parent, { cast = false, receive = true, name = '' } = {}) {
    const out = [];
    for (const [mat, geos] of this.map) {
      const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach((x) => x.dispose());
      const m = new THREE.Mesh(g, mat);
      m.castShadow = cast; m.receiveShadow = receive;
      if (name) m.name = name;
      parent.add(m); out.push(m);
    }
    this.map.clear();
    return out;
  }
}

// ---------------- materials ----------------
function woodTexture(size) {
  const n = Math.min(size, 512);
  const c = makeCanvas(n, n), g = c.getContext('2d');
  const r = rng(77);
  const strips = 8, sw = n / strips;
  for (let i = 0; i < strips; i++) {
    const base = 178 + r() * 26;
    g.fillStyle = `rgb(${base + 12},${base - 18},${base - 74})`;
    g.fillRect(i * sw, 0, sw, n);
    for (let k = 0; k < 40; k++) {
      const x = i * sw + r() * sw, w = 0.5 + r() * 1.6;
      g.strokeStyle = `rgba(${96 + r() * 40},${58 + r() * 24},${24 + r() * 12},${0.08 + r() * 0.16})`;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, 0);
      let xx = x; for (let y = 0; y <= n; y += n / 8) { xx += (r() - 0.5) * 2.2; g.lineTo(xx, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(60,35,15,0.55)'; g.fillRect(i * sw, 0, 1.2, n);
  }
  return c;
}

function pegboardTexture() {
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#3d4247'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#05060a'; g.beginPath(); g.arc(32, 32, 7, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 8.5, 0.6, 3.2); g.stroke();
  return c;
}

function sprinkleNormal(n, seed, cells, str) {
  const f = noiseField(n, n, cells, seed, 3, 0.6);
  return tex(heightToNormal(f, n, n, str), { repeat: [1, 1], srgb: false });
}

export function makeMaterials(quality) {
  const T = quality.tex, A = quality.aniso;
  const M = {};
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M.red = phys({ color: 0xbd1d21, roughness: 0.36, metalness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 1.0 });
  M.black = phys({ color: 0x141518, roughness: 0.42, metalness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.18, envMapIntensity: 0.9 });
  M.chrome = coreMat.chrome();
  M.satin = phys({ color: 0xc9cdd0, metalness: 1.0, roughness: 0.32, envMapIntensity: 1.2 });
  M.steel = std({ color: 0x5f666b, metalness: 0.55, roughness: 0.5, envMapIntensity: 0.8 });
  M.lightSteel = std({ color: 0x9aa1a5, metalness: 0.6, roughness: 0.42, envMapIntensity: 0.9 });
  M.darkSteel = std({ color: 0x25282c, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.8 });
  M.cast = std({ color: 0x3b3f43, metalness: 0.8, roughness: 0.62, envMapIntensity: 0.8 });
  M.zinc = std({ color: 0xb6bcbf, metalness: 0.9, roughness: 0.4, envMapIntensity: 1.0, normalMap: sprinkleNormal(256, 5, 24, 1.2), normalScale: new THREE.Vector2(0.35, 0.35) });
  M.yellow = phys({ color: 0xe0a216, roughness: 0.42, metalness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  M.safetyYellow = std({ color: 0xf1c200, roughness: 0.5, metalness: 0.1 });
  M.blue = phys({ color: 0x15498f, roughness: 0.4, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  M.orange = std({ color: 0xd2601a, roughness: 0.48, metalness: 0.2 });
  M.green = std({ color: 0x2d5a3d, roughness: 0.5, metalness: 0.25 });
  M.gray = std({ color: 0x8b9094, roughness: 0.5, metalness: 0.3 });
  M.rubber = coreMat.rubber();
  M.plastic = coreMat.blackPlastic(0.5);
  M.whitePlastic = std({ color: 0xe6e8e6, roughness: 0.45, metalness: 0.0 });
  M.grayPlastic = std({ color: 0x777b7e, roughness: 0.55, metalness: 0.0 });
  M.beige = std({ color: 0xcfc7b3, roughness: 0.55, metalness: 0.0 });
  M.brass = phys({ color: 0xc89b3c, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.3 });
  M.copper = phys({ color: 0xb4693a, metalness: 1.0, roughness: 0.26, envMapIntensity: 1.3 });
  M.blackIron = std({ color: 0x232426, metalness: 0.7, roughness: 0.58, envMapIntensity: 0.7 });
  M.glass = coreMat.glassClear();
  M.paper = std({ color: 0xe9e7df, roughness: 0.85 });
  M.stone = std({ color: 0x8e8d86, roughness: 0.95, metalness: 0 });
  M.foam = std({ color: 0x2c2f33, roughness: 0.9, metalness: 0 });
  M.foamRed = std({ color: 0x8c1a1a, roughness: 0.9, metalness: 0 });
  M.fabric = std({ color: 0x2b3038, roughness: 0.95, metalness: 0 });
  M.rubberTread = std({ color: 0x1a1a1b, roughness: 0.9 });
  M.oil = phys({ color: 0x0b0a07, roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
  M.jugWhite = phys({ color: 0xe7e9e4, roughness: 0.35, transmission: 0, metalness: 0, clearcoat: 0.3 });
  const wt = tex(woodTexture(T), { repeat: [1 / 0.6, 1 / 0.6], aniso: A });
  M.wood = std({ map: wt, roughness: 0.62, metalness: 0 });
  const pt = tex(pegboardTexture(), { repeat: [1 / 0.0254, 1 / 0.0254], aniso: A });
  M.pegboard = std({ map: pt, roughness: 0.7, metalness: 0.1 });
  M.emissiveWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0.95, 0.97, 1), emissiveIntensity: 3.5, roughness: 0.4 });
  M.bulb = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1, 0.96, 0.85), emissiveIntensity: 3.0, roughness: 0.4 });
  M.ledGreen = new THREE.MeshStandardMaterial({ color: 0x113311, emissive: new THREE.Color(0.1, 1, 0.2), emissiveIntensity: 2.5 });
  M.ledRed = new THREE.MeshStandardMaterial({ color: 0x331111, emissive: new THREE.Color(1, 0.1, 0.1), emissiveIntensity: 2.5 });
  return M;
}

// A small textured material from a canvas
export function canvasMaterial(canvas, { roughness = 0.5, metalness = 0, emissive = false, repeat = [1, 1], aniso = 4, extra = {} } = {}) {
  const t = tex(canvas, { wrap: repeat[0] !== 1 || repeat[1] !== 1, repeat, aniso });
  const o = { map: t, roughness, metalness, ...extra };
  if (emissive) { o.emissive = new THREE.Color(1, 1, 1); o.emissiveMap = t; o.emissiveIntensity = emissive === true ? 1.0 : emissive; }
  return new THREE.MeshStandardMaterial(o);
}

// A flat plane with metric UV rectangle (u0,v0,u1,v1) into an atlas
export function atlasPlane(w, h, uv) {
  const g = new THREE.PlaneGeometry(w, h);
  const a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
  return g;
}

// World-frame AABB of a local box placed with a translation and a rotation about Y.
export function worldBox(cx, cy, cz, hx, hy, hz, x = 0, z = 0, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const ex = Math.abs(c) * hx + Math.abs(s) * hz;
  const ez = Math.abs(s) * hx + Math.abs(c) * hz;
  const px = x + c * cx + s * cz;
  const pz = z - s * cx + c * cz;
  return new THREE.Box3(new THREE.Vector3(px - ex, cy - hy, pz - ez), new THREE.Vector3(px + ex, cy + hy, pz + ez));
}

// Tag a group as inspectable
export function label(obj, id) { obj.userData.labelId = id; return obj; }

// Make an object usable with E. prompt may be a function for a dynamic prompt.
export function interactive(obj, prompt, run) {
  obj.userData.interact = {
    run,
    get prompt() { return typeof prompt === 'function' ? prompt() : prompt; },
  };
  return obj;
}

export function place(group, x, y, z, ry = 0) { group.position.set(x, y, z); group.rotation.y = ry; return group; }

export { THREE, makeCanvas, noiseField, canvasFromField, heightToNormal, tex, rng, metricBox, roundedBoxGeometry };
