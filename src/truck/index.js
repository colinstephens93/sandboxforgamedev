// The truck: assembles body panels, glass, lamps, wheels, underside. Everything in the truck frame (see docs/CONVENTIONS.md).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { spec } from '../data/truckSpec.js';
import { mat } from '../core/materials.js';
import * as K from './skin.js';
import { hoodHalfWidth, hoodHeight, roofHalfWidth, roofHeight, ST, H, IN_TO_M, WB } from './skin.js';
import { buildBodyGeometry, topPanel, topPerimeter, skirtStrip, GAP, DOOR, win, sA, ROOF_EDGE_Y } from './body.js';
import { gridPanel, colPos, rowPos } from './panels.js';
import { buildFront, buildMirror, buildHandle } from './front.js';

const IN = IN_TO_M;
const lerp = (a, b, t) => a + (b - a) * t;

export function buildTruck({ quality }) {
  const root = new THREE.Group(); root.name = 'truck';
  const parts = {}; // named groups for openings and inspection
  const paint = mat.paint();
  paint.side = THREE.DoubleSide;
  const glass = mat.glassTinted();
  const trimBlack = mat.blackPlastic(0.5);
  const darkTub = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.9, metalness: 0 });

  const add = (parent, geom, material, name, cast = true) => {
    const m = new THREE.Mesh(geom, material); m.name = name; m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  };

  // ---------------- body panels ----------------
  const G = buildBodyGeometry();
  const body = new THREE.Group(); body.name = 'body'; root.add(body);
  const bodyKeys = ['fender', 'rocker', 'cabCorner', 'bed'];
  for (const k of bodyKeys) for (const side of ['L', 'R']) add(body, G[k][side], paint, `${k}_${side}`);
  parts.doors = {};
  for (const key of ['f', 'r']) for (const side of ['L', 'R']) {
    const g = new THREE.Group(); g.name = `door_${key}_${side}`;
    for (const piece of ['lower', 'fstrip', 'rstrip', 'header', 'belt']) add(g, G[`door_${key}_${piece}`][side], paint, `${g.name}_${piece}`);
    body.add(g); parts.doors[`${key}${side}`] = g;
  }

  // ---------------- hood ----------------
  const hoodGeo = topPanel({ s0: -30.5, s1: 19.3, xh: hoodHalfWidth, height: hoodHeight, nI: 28, nJ: 40 });
  const hoodSkirt = skirtStrip(topPerimeter({ s0: -30.5, s1: 19.3, xh: hoodHalfWidth, height: hoodHeight }), 1.8, 0.2, -1);
  const hood = new THREE.Group(); hood.name = 'hood'; root.add(hood);
  add(hood, mergeGeometries([hoodGeo, hoodSkirt], false), paint, 'hood_top');
  parts.hood = hood;

  // ---------------- roof ----------------
  const roofGeo = topPanel({ s0: 43.6, s1: ST.cabBack, xh: roofHalfWidth, height: roofHeight, nI: 28, nJ: 34 });
  const roofSkirt = skirtStrip(topPerimeter({ s0: 43.6, s1: ST.cabBack, xh: roofHalfWidth, height: roofHeight }), 1.4, 0.2, -1);
  add(body, mergeGeometries([roofGeo, roofSkirt], false), paint, 'roof');

  // ---------------- glass ----------------
  const glassGroup = new THREE.Group(); glassGroup.name = 'glass'; root.add(glassGroup);
  // windshield
  {
    const nI = 20, nJ = 14, P = [], ind = [], uv = [];
    for (let j = 0; j <= nJ; j++) for (let i = 0; i <= nI; i++) {
      const v = j / nJ, u = (i / nI) * 2 - 1;
      const hw = lerp(28.0, 24.4, v);
      const s = lerp(21.8, 43.2, v) - 0.9 * (1 - u * u) * Math.sin(Math.PI * v) - 0.25 * Math.abs(u) * (1 - v);
      const y = lerp(55.0, 75.4, v) + 0.35 * (1 - u * u) * Math.sin(Math.PI * v) * 0.0;
      P.push(u * hw * IN, y * IN, s * IN); uv.push(u, v);
    }
    for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) { const a = j * (nI + 1) + i, b = a + 1, c = a + nI + 2, d = a + nI + 1; ind.push(a, d, b, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
    add(glassGroup, g, glass, 'windshield', false);
  }
  // rear glass
  {
    const nI = 16, nJ = 8, P = [], ind = [];
    for (let j = 0; j <= nJ; j++) for (let i = 0; i <= nI; i++) {
      const v = j / nJ, u = (i / nI) * 2 - 1;
      const hw = lerp(27.8, 25.6, v); const y = lerp(58.2, 72.6, v);
      const s = lerp(ST.cabBack + 0.4, ST.cabBack - 1.0, v) + 0.7 * (1 - u * u);
      P.push(u * hw * IN, y * IN, s * IN);
    }
    for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) { const a = j * (nI + 1) + i, b = a + 1, c = a + nI + 2, d = a + nI + 1; ind.push(a, b, d, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(ind); g.computeVertexNormals();
    add(glassGroup, g, glass, 'rear_glass', false);
  }
  // door glass (belongs to the door groups so it opens with them)
  for (const key of ['f', 'r']) for (const side of ['L', 'R']) {
    const w = win[key];
    const g = gridPanel({ nI: 14, nJ: 10, side: side === 'R' ? 1 : -1, offset: -0.55, flange: false, pos: rowPos(w.yb, w.yt, w.sf, w.sr) });
    add(parts.doors[`${key}${side}`], g, glass, `door_glass_${key}${side}`, false);
  }

  // ---------------- front end, mirrors, handles ----------------
  const front = buildFront({ quality }); root.add(front.group); parts.front = front.group;
  for (const side of ['L', 'R']) {
    const sg = side === 'R' ? 1 : -1;
    const mir = buildMirror({ side: sg }); mir.position.set(sg * 45.0 * IN, 61.0 * IN, 28.0 * IN); parts.doors[`f${side}`].add(mir);
    const hf = buildHandle({ side: sg, key: 'f' }); hf.position.set(sg * 39.6 * IN, 47.0 * IN, 60.5 * IN); parts.doors[`f${side}`].add(hf);
    const hr = buildHandle({ side: sg, key: 'r' }); hr.position.set(sg * 39.5 * IN, 47.0 * IN, 100.0 * IN); parts.doors[`r${side}`].add(hr);
  }

  // ---------------- dark interior tub (seen through panel gaps) ----------------
  const tub = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * IN, h * IN, d * IN), darkTub); m.position.set(x * IN, y * IN, z * IN); root.add(m); return m; };
  tub(68, 52, 84, 0, 44, 65);          // cab volume (below the roofline, above the rocker)
  tub(68, 14, 80, 0, 29, 152);         // bed volume under the floor

  // ---------------- placeholder wheels (replaced in 2.2) ----------------
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  for (const [z, track] of [[0, spec.dims.trackFrontIn], [WB, spec.dims.trackRearIn]]) for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(15.25 * IN, 15.25 * IN, 9.8 * IN, 28), wheelMat);
    c.rotation.z = Math.PI / 2; c.position.set(sx * (track / 2 - 0.0) * IN, 14.5 * IN, z * IN); c.name = 'wheel_placeholder'; root.add(c);
  }
  root.userData.parts = parts;
  return { group: root, parts, colliders: [] };
}
