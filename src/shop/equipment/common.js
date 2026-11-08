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
    return this._raw(mat, geo);
  }
  // append another Part's geometry (transformed by a placement) into this one
  merge(other, x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
    for (const [mat, geos] of other.map) for (const g of geos) { g.applyMatrix4(m); this._push(mat, g); }
    other.map.clear();
    return this;
  }
  _push(mat, geo) {
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
  // Materials with userData.bake = { base, color } are drawn through a shared base material with the color baked
  // into a vertex color attribute, so many painted parts collapse into very few draw calls.
  _raw(mat, geo) {
    const bake = mat.userData && mat.userData.bake;
    if (bake) {
      const four = !!bake.base.userData.vcol4, k = four ? 4 : 3;
      const n = geo.attributes.position.count, arr = new Float32Array(n * k), c = bake.color;
      for (let i = 0; i < n; i++) { arr[i * k] = c.r; arr[i * k + 1] = c.g; arr[i * k + 2] = c.b; if (four) arr[i * k + 3] = bake.alpha; }
      geo.setAttribute('color', new THREE.BufferAttribute(arr, k));
      mat = bake.base;
    }
    return this._push(mat, geo);
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
  // Shared base materials: the color of each "virtual" material below is baked into a vertex color so that all
  // painted / steel / plastic / bare-metal parts of an item merge into one draw call per base.
  // 'uber' draws paint, satin metal and chrome in one material: the vertex color alpha selects the finish
  // (0 = clearcoated paint, 0.5 = satin metal such as brass and copper, 1 = chrome). Steel and plastic have their own bases.
  const uber = phys({ color: 0xffffff, vertexColors: true, roughness: 0.4, metalness: 0.25, clearcoat: 0.45, clearcoatRoughness: 0.15, envMapIntensity: 1.0 });
  uber.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      #ifdef USE_COLOR_ALPHA
        float finishAmt = step(0.25, vColor.a);
        metalnessFactor = mix(metalnessFactor, 1.0, finishAmt);
        roughnessFactor = mix(roughnessFactor, mix(0.3, 0.06, clamp((vColor.a - 0.5) * 2.0, 0.0, 1.0)), finishAmt);
      #endif`);
  };
  uber.customProgramCacheKey = () => 'equipment-uber';
  uber.userData.vcol4 = true;
  const direct = {
    paint: phys({ color: 0xffffff, roughness: 0.4, metalness: 0.25, clearcoat: 0.45, clearcoatRoughness: 0.15, envMapIntensity: 1.0 }),
    steel: std({ color: 0xffffff, roughness: 0.5, metalness: 0.55, envMapIntensity: 0.85 }),
    plastic: std({ color: 0xffffff, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.7 }),
    chrome: phys({ color: 0xffffff, roughness: 0.07, metalness: 1.0, envMapIntensity: 1.6 }),
    metal: phys({ color: 0xffffff, roughness: 0.3, metalness: 1.0, envMapIntensity: 1.3 }),
  };
  const base = {
    uber,
    steel: std({ color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0.55, envMapIntensity: 0.85 }),
    plastic: std({ color: 0xffffff, vertexColors: true, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.7 }),
  };
  M.base = base;
  // kind = which look; the baked material (uber/steel/plastic) and the finish alpha follow from it
  const BAKE = { paint: ['uber', 0], chrome: ['uber', 1], metal: ['uber', 0.5], steel: ['steel', 1], plastic: ['plastic', 1] };
  const virt = (kind, hex) => {
    const m = direct[kind].clone(); m.color.set(hex);
    const [b, alpha] = BAKE[kind];
    m.userData.bake = { base: base[b], color: new THREE.Color(hex), alpha };
    return m;
  };
  M.virt = virt;
  M.red = virt('paint', 0xbd1d21); M.black = virt('paint', 0x141518); M.blue = virt('paint', 0x15498f); M.yellow = virt('paint', 0xe0a216);
  M.safetyYellow = virt('paint', 0xf1c200); M.orange = virt('paint', 0xd2601a); M.green = virt('paint', 0x2d5a3d);
  M.steel = virt('steel', 0x5f666b); M.lightSteel = virt('steel', 0x9aa1a5); M.darkSteel = virt('steel', 0x25282c);
  M.cast = virt('steel', 0x3b3f43); M.blackIron = virt('steel', 0x232426); M.gray = virt('steel', 0x8b9094); M.zinc = virt('steel', 0xb6bcbf);
  M.plastic = virt('plastic', 0x141517); M.whitePlastic = virt('plastic', 0xe6e8e6); M.grayPlastic = virt('plastic', 0x777b7e);
  M.beige = virt('plastic', 0xcfc7b3); M.foam = virt('plastic', 0x2f3237); M.foamRed = virt('plastic', 0x8c1a1a); M.fabric = virt('plastic', 0x2b3038);
  M.rubber = virt('plastic', 0x0e0e0f); M.paper = virt('plastic', 0xe9e7df); M.stone = virt('plastic', 0x8e8d86); M.rubberTread = virt('plastic', 0x1a1a1b);
  M.chrome = virt('chrome', 0xf2f4f6); M.satin = virt('metal', 0xc9cdd0); M.brass = virt('metal', 0xc89b3c); M.copper = virt('metal', 0xb4693a);
  M.polishedAlu = virt('chrome', 0xdde1e4);
  M.glass = coreMat.glassClear();
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
