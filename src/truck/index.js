// The truck: assembles body panels, glass, lamps, wheels, underside. Everything in the truck frame (see docs/CONVENTIONS.md).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { spec } from '../data/truckSpec.js';
import { mat } from '../core/materials.js';
import * as K from './skin.js';
import { hoodHalfWidth, hoodHeight, roofHalfWidth, roofHeight, ST, H, IN_TO_M, WB } from './skin.js';
import { buildBodyGeometry, topPanel, topPerimeter, skirtStrip, GAP, DOOR, win, sA, ROOF_EDGE_Y, WS, RG } from './body.js';
import { gridPanel, colPos, rowPos } from './panels.js';
import { buildFront, buildMirror, buildHandle } from './front.js';
import { buildRear } from './rear.js';
import { buildBadges, buildFuelDoor } from './badges.js';
import { buildEngineBay } from './engine/index.js';
import { buildHoodUnder } from './hoodUnder.js';
import { buildUnderside } from './underside.js';
import { buildWheel } from './wheels.js';
import { buildInterior } from './interior/index.js';
import { fitInteriorToBody } from './interior/fit.js';

const IN = IN_TO_M;
const lerp = (a, b, t) => a + (b - a) * t;

export function buildTruck({ quality }) {
  const root = new THREE.Group(); root.name = 'truck';
  const parts = {}; // named groups for openings and inspection
  const paint = mat.paint();
  paint.side = THREE.DoubleSide;
  const glass = mat.glassTinted();
  // privacy glass has an outside and an inside face (src/core/materials.js); which triangle side is "outside" depends on how
  // each pane was wound, so it is read from the pane's own normal against the direction that points out of the cab
  const privacy = { out: mat.glassPrivacy(false), in: mat.glassPrivacy(true) };
  const flipped = (m) => { const c = m.clone(); c.side = m.side === THREE.FrontSide ? THREE.BackSide : THREE.FrontSide; return c; };
  privacy.outFlip = flipped(privacy.out); privacy.inFlip = flipped(privacy.in);
  const addPrivacy = (parent, g, name, ox, oz) => {
    const n = g.attributes.normal, mid = Math.floor(n.count / 2), faces = n.getX(mid) * ox + n.getZ(mid) * oz >= 0;
    add(parent, g, faces ? privacy.out : privacy.outFlip, name, false); add(parent, g, faces ? privacy.in : privacy.inFlip, `${name}_inner`, false);
  };
  const trimBlack = mat.blackPlastic(0.5);
  const darkTub = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.9, metalness: 0 });

  const add = (parent, geom, material, name, cast = true) => {
    const m = new THREE.Mesh(geom, material); m.name = name; m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  };

  // ---------------- body panels ----------------
  const G = buildBodyGeometry();
  const body = new THREE.Group(); body.name = 'body'; root.add(body);
  const bodyKeys = ['fender', 'rocker', 'cabCorner', 'bed', 'aPillar', 'cPillar'];
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
      P.push(u * WS.hw(v) * IN, WS.y(v) * IN, WS.s(v, u) * IN); uv.push(u, v);
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
      const s = RG.s(v) + 0.7 * (1 - u * u);
      P.push(u * RG.hw(v) * IN, RG.y(v) * IN, s * IN);
    }
    for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) { const a = j * (nI + 1) + i, b = a + 1, c = a + nI + 2, d = a + nI + 1; ind.push(a, b, d, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(ind); g.computeVertexNormals();
    addPrivacy(glassGroup, g, 'rear_glass', 0, 1);
  }
  // door glass (belongs to the door groups so it opens with them)
  for (const key of ['f', 'r']) for (const side of ['L', 'R']) {
    const w = win[key];
    const g = gridPanel({ nI: 14, nJ: 10, side: side === 'R' ? 1 : -1, offset: -0.55, flange: false, pos: rowPos(w.yb, w.yt, w.sf, w.sr) });
    if (key === 'r') addPrivacy(parts.doors[`${key}${side}`], g, `door_glass_${key}${side}`, side === 'R' ? 1 : -1, 0);
    else add(parts.doors[`${key}${side}`], g, glass, `door_glass_${key}${side}`, false);
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
  // the cab volume is the interior (src/truck/interior): door cards, floor, pillars and headliner are the dark backing
  const interior = buildInterior({ quality, parts }); root.add(interior.group); parts.interior = interior;
  fitInteriorToBody(interior.group, root); // the trim follows the body's inward lean above the beltline
  tub(68, 10, 80, 0, 33, 152);         // bed volume under the floor

  // ---------------- wheels and tires (wheels.js): front/rear, left/right; spin hooks live in parts.wheels ----------------
  {
    const wheels = { all: [] };
    for (const [axle, z, track] of [['front', 0, spec.dims.trackFrontIn], ['rear', WB, spec.dims.trackRearIn]]) for (const side of ['L', 'R']) {
      const w = buildWheel({ quality, axle, side });
      w.group.position.set((side === 'R' ? 1 : -1) * (track / 2) * IN, w.centerY, z * IN);
      w.setLoadFlat(1); // the truck stands on its tires: small contact patch at the floor
      root.add(w.group);
      wheels[(axle === 'front' ? 'F' : 'R') + side] = w;
      wheels.all.push(w);
    }
    wheels.spin = (angle) => { for (const w of wheels.all) w.spin(angle); }; // one angle for all four (positive = rolling toward +Z)
    parts.wheels = wheels;
  }
  // ---------------- rear: box, tailgate, bumper, lamps; badges, decals, fuel door ----------------
  const rear = buildRear({ quality }); root.add(rear.group); parts.rear = rear.parts; parts.tailgate = rear.parts.tailgate; parts.lamps = rear.lamps;
  root.add(buildBadges({ quality }));
  const fuel = buildFuelDoor({ side: 'L' }); root.add(fuel.group); parts.fuelDoor = fuel;
  // ---------------- engine bay (3.3) and hood underside with the spring-loaded hinges (3.2) ----------------
  const bay = buildEngineBay({ quality }); root.add(bay.group); parts.engineBay = bay;
  const hoodUnder = buildHoodUnder({ quality, mats: bay.mats }); hood.add(hoodUnder.group); parts.hoodUnder = hoodUnder;
  const anchors = { ...bay.anchors, ...hoodUnder.anchors, hoodHinge: bay.anchors.hoodHinge };
  root.userData.parts = parts;
  // ---------------- underside (frame, suspension, driveline, exhaust, fuel, spare) ----------------
  const underside = buildUnderside({ quality });
  root.add(underside.group);
  parts.underside = underside.anchors;
  root.userData.parts = parts;
  Object.assign(anchors, underside.anchors, { interior: interior.anchors });
  return { group: root, parts, colliders: underside.colliders, anchors, underside, interior, update: (dt, st) => bay.update(dt, st) };
}
