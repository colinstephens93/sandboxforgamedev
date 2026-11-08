// Tire area: tire geometry, wheels, tire changer, wheel balancer, tire rack and a stack of tires.
import { THREE, Part, interactive, label, tex, canvasMaterial, place } from './common.js';
import { tireCanvas, balancerScreenCanvas } from './art.js';
import { foot } from './plan.js';

// LT265/70R17: 265 mm section width, 70 percent aspect, 17 in rim => about 0.82 m overall diameter
const RIM_R = 17 * 0.0254 / 2;
const SEC_W = 0.265;
const SIDE_H = 0.265 * 0.7;
export const TIRE_R = RIM_R + SIDE_H;   // 0.4 m

// tire cross-section (radius, axial) points; index fraction maps to texture v (sidewall text, tread)
export function tireProfile(n = 31) {
  const pts = [];
  const hw = SEC_W / 2;
  const at = (i) => i / (n - 1);
  for (let i = 0; i < n; i++) {
    const v = at(i);
    let r, y;
    if (v < 0.06) { // lower bead seat
      const k = v / 0.06; r = RIM_R + 0.004 + 0.01 * k; y = -hw * (0.78 + 0.1 * k);
    } else if (v < 0.33) { // lower sidewall: bulge out then the shoulder
      const k = (v - 0.06) / 0.27;
      y = -hw * (0.88 + 0.12 * Math.sin(k * Math.PI * 0.62)) + (k > 0.8 ? (k - 0.8) / 0.2 * hw * 0.12 : 0);
      r = RIM_R + 0.014 + (SIDE_H - 0.026) * Math.pow(k, 0.9);
    } else if (v < 0.67) { // tread with a slight crown
      const k = (v - 0.33) / 0.34; y = -hw * 0.74 + k * hw * 1.48;
      r = TIRE_R - 0.012 * Math.pow(Math.abs(k - 0.5) * 2, 2.4);
    } else if (v < 0.94) { // upper sidewall
      const k = (v - 0.67) / 0.27;
      y = hw * (1.0 - 0.12 * Math.sin((1 - k) * Math.PI * 0.62)) - (k < 0.2 ? (0.2 - k) / 0.2 * hw * 0.12 : 0);
      r = TIRE_R - 0.012 - (SIDE_H - 0.026) * Math.pow(k, 1.1);
    } else {
      const k = (v - 0.94) / 0.06; r = RIM_R + 0.014 - 0.01 * k; y = hw * (0.88 - 0.1 * k);
    }
    pts.push(new THREE.Vector2(r, y));
  }
  return pts;
}

export function tireGeometry(seg = 56) {
  const g = new THREE.LatheGeometry(tireProfile(), seg);
  return g;
}

export function makeTireKit(M, quality) {
  const geo = tireGeometry(quality.tex >= 1024 ? 72 : 48);
  const map = tex(tireCanvas(quality.tex), { repeat: [1, 1], aniso: quality.aniso });
  map.wrapS = THREE.RepeatWrapping;
  const tireMat = new THREE.MeshStandardMaterial({ map, roughness: 0.88, metalness: 0, color: 0xdddddd });
  const alu = M.polishedAlu || M.satin;
  return { geo, tireMat, alu };
}

// Builds a complete wheel (rim + tire), axis = Y, origin at the center of the wheel.
export function buildWheel(M, kit) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(kit.geo, kit.tireMat); tire.castShadow = false; tire.receiveShadow = true; g.add(tire);
  const P = new Part();
  const alu = kit.alu, hw = 0.1;
  P.lathe(alu, [[RIM_R - 0.035, -hw], [RIM_R - 0.012, -hw * 0.98], [RIM_R + 0.006, -hw * 0.92], [RIM_R + 0.016, -hw * 0.84], [RIM_R - 0.006, -hw * 0.7], [RIM_R - 0.03, -hw * 0.45], [RIM_R - 0.03, hw * 0.45], [RIM_R - 0.006, hw * 0.7], [RIM_R + 0.016, hw * 0.84], [RIM_R + 0.006, hw * 0.92], [RIM_R - 0.012, hw * 0.98], [RIM_R - 0.035, hw]], 0, 0, 0, { seg: 36 });
  // dish: 8 spokes from the hub out to the barrel, set back toward the outboard face
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const len = RIM_R - 0.07, mid = 0.075 + len / 2;
    P.box(alu, 0.042, 0.02, len, Math.sin(a) * mid, hw * 0.55, Math.cos(a) * mid, { ry: a });
  }
  P.cyl(alu, 0.095, 0.024, 0, hw * 0.55, 0, { seg: 24 });
  P.cyl(M.darkSteel, 0.045, 0.01, 0, hw * 0.55 + 0.014, 0, { seg: 14 });  // center cap
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P.cyl(M.chrome, 0.0105, 0.022, Math.sin(a) * 0.0825, hw * 0.55 + 0.016, Math.cos(a) * 0.0825, { seg: 6 }); }
  P.build(g, { cast: false });
  return g;
}

// ---------------- tire changer ----------------
function buildChanger(M, kit) {
  const g = new THREE.Group(); g.name = 'tireChanger';
  const P = new Part();
  const body = M.gray;
  P.box(body, 0.62, 0.72, 0.7, 0, 0.36 + 0.02, -0.1, { r: 0.015 });             // cabinet
  P.box(M.darkSteel, 0.66, 0.04, 0.74, 0, 0.02, -0.1, { r: 0.008 });            // plinth
  P.cyl(M.blue, 0.36, 0.05, 0, 0.775, -0.05, { seg: 32 });                      // turntable
  P.cyl(M.darkSteel, 0.3, 0.012, 0, 0.805, -0.05, { seg: 32 });
  for (let i = 0; i < 4; i++) {                                                  // clamp jaws on slots
    const a = i * Math.PI / 2 + Math.PI / 4, r = 0.19;
    P.box(M.cast, 0.05, 0.04, 0.12, Math.sin(a) * r, 0.83, -0.05 + Math.cos(a) * r, { ry: a });
    P.box(M.lightSteel, 0.035, 0.03, 0.03, Math.sin(a) * (r + 0.07), 0.855, -0.05 + Math.cos(a) * (r + 0.07), { ry: a });
  }
  P.cyl(M.chrome, 0.03, 0.06, 0, 0.84, -0.05, { seg: 12 });                      // center clamp nut
  // tower on the back with a swing arm and mount head
  P.box(body, 0.14, 1.45, 0.14, 0, 0.78 + 0.0, -0.56, { r: 0.01 });
  P.box(M.blue, 0.16, 0.12, 0.16, 0, 1.52, -0.56, { r: 0.01 });
  P.box(body, 0.1, 0.1, 0.7, 0, 1.38, -0.2, { r: 0.008 });                       // horizontal arm
  P.box(M.darkSteel, 0.16, 0.08, 0.2, 0, 1.38, -0.5, { r: 0.006 });
  P.cyl(M.lightSteel, 0.03, 0.3, 0, 1.18, 0.12, { seg: 10 });                    // vertical shaft
  P.box(M.black, 0.06, 0.06, 0.1, 0, 1.03, 0.14, { r: 0.006 });                  // plastic mount head
  P.cyl(M.chrome, 0.012, 0.09, 0, 1.0, 0.2, { seg: 8 });
  // bead breaker on the side: pneumatic cylinder, arm, shovel
  P.cyl(M.darkSteel, 0.05, 0.45, 0.44, 0.45, 0.1, { axis: 'z', seg: 12 });
  P.box(M.blue, 0.07, 0.07, 0.55, 0.43, 0.95, 0.0, { r: 0.006 });
  P.box(M.lightSteel, 0.05, 0.22, 0.04, 0.37, 0.88, -0.22, { rz: 0.3 });
  P.box(M.cast, 0.1, 0.28, 0.1, 0.44, 0.8, -0.3);
  P.box(M.black, 0.08, 0.03, 0.12, 0.44, 0.65, 0.28); // rubber guard
  // pedals
  for (let i = 0; i < 3; i++) { P.box(M.black, 0.1, 0.02, 0.14, -0.2 + i * 0.2, 0.06, 0.34, { rx: -0.2 }); P.box(M.safetyYellow, 0.03, 0.03, 0.12, -0.2 + i * 0.2, 0.1, 0.27); }
  P.cyl(M.chrome, 0.012, 0.06, 0.3, 0.36, 0.265, { axis: 'z', seg: 8 });
  P.build(g, { cast: true });
  // wheel on the turntable: tire flat
  const w = buildWheel(M, kit); w.position.set(0, 0.805 + SEC_W / 2 + 0.0, -0.05); g.add(w);
  label(g, 'shop.tireChanger');
  return g;
}

// ---------------- wheel balancer ----------------
function buildBalancer(M, kit, quality) {
  const g = new THREE.Group(); g.name = 'balancer';
  const P = new Part();
  P.box(M.gray, 0.82, 0.92, 0.72, 0, 0.46, -0.4, { r: 0.02 });                 // housing
  P.box(M.darkSteel, 0.74, 0.12, 0.6, 0, 0.06, -0.38);                          // feet area
  P.box(M.black, 0.8, 0.04, 0.5, 0, 0.94, -0.35, { r: 0.01 });                  // top cover
  // weight tray with lids (back top)
  P.box(M.gray, 0.5, 0.04, 0.16, 0.12, 0.98, -0.6);
  P.box(M.darkSteel, 0.5, 0.05, 0.015, 0.12, 1.02, -0.68);
  // display head with a screen
  P.box(M.black, 0.56, 0.3, 0.1, -0.08, 1.2, -0.62, { r: 0.012, rx: -0.3 });
  // spindle and shaft projecting toward the operator
  P.cyl(M.darkSteel, 0.07, 0.1, -0.05, 0.9, -0.05, { axis: 'z', seg: 16 });
  P.cyl(M.lightSteel, 0.025, 0.6, -0.05, 0.9, 0.22, { axis: 'z', seg: 12 });
  P.cyl(M.chrome, 0.05, 0.03, -0.05, 0.9, 0.5, { axis: 'z', seg: 14 });           // cone + wing nut
  P.cyl(M.darkSteel, 0.07, 0.06, -0.05, 0.9, 0.55, { axis: 'z', seg: 12 });
  // wheel weights: tape and clip-on boxes on the tray
  for (let i = 0; i < 7; i++) P.box(M.lightSteel, 0.04, 0.018, 0.08, -0.06 + i * 0.05, 1.015, -0.6, { ry: 0.0 });
  P.build(g, { cast: true });
  // hood: a half cylinder hinged behind the wheel, swung up out of the way
  const hoodMat = M.black.clone(); hoodMat.side = THREE.DoubleSide;
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 24, 1, true, 0, Math.PI), hoodMat);
  hood.rotation.x = Math.PI / 2;
  const hoodPivot = new THREE.Group(); hoodPivot.position.set(-0.05, 0.9, -0.1);
  hoodPivot.add(hood); hoodPivot.rotation.x = 0.9; hood.position.set(0, 0, 0.0); g.add(hoodPivot);
  // screen plane
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.24), canvasMaterial(balancerScreenCanvas(), { roughness: 0.3, emissive: 1.1 }));
  scr.position.set(-0.08, 1.2, -0.565); scr.rotation.x = -0.3; scr.translateZ(0.003); g.add(scr);
  // wheel on the shaft, axis along z
  const w = buildWheel(M, kit); w.rotation.x = Math.PI / 2; w.position.set(-0.05, 0.9, 0.3); g.add(w);
  label(g, 'shop.balancer');
  return g;
}

// ---------------- tire rack + loose tires (instanced) ----------------
function buildRack(M) {
  const g = new THREE.Group(); g.name = 'tireRack';
  const P = new Part();
  const L = 1.5, D = 0.8, H = 1.9;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(M.safetyYellow, 0.05, H, 0.05, sx * (L / 2 - 0.025), H / 2, sz * (D / 2 - 0.025), { r: 0.005 });
  for (const y of [0.1, 0.98]) {
    for (const sz of [-1, 1]) P.box(M.blue, L, 0.05, 0.05, 0, y, sz * (D / 2 - 0.025)); // rails (front/back) carrying the tires
    for (const sz of [-0.25, 0.25]) P.box(M.steel, L - 0.1, 0.03, 0.03, 0, y + 0.02, sz); // inner cradle rails
    for (const sx of [-1, 1]) P.box(M.blue, 0.05, 0.05, D, sx * (L / 2 - 0.025), y, 0);
  }
  for (const sx of [-1, 1]) P.box(M.safetyYellow, 0.04, 0.04, D, sx * (L / 2 - 0.025), H - 0.02, 0);
  P.box(M.safetyYellow, L, 0.04, 0.04, 0, H - 0.02, D / 2 - 0.02); P.box(M.safetyYellow, L, 0.04, 0.04, 0, H - 0.02, -D / 2 + 0.02);
  P.build(g, { cast: true });
  label(g, 'shop.tireRack');
  return g;
}

export function buildTireArea(ctx) {
  const { M, group, quality } = ctx;
  const kit = makeTireKit(M, quality);
  const ch = buildChanger(M, kit); const fc = foot('tireChanger'); place(ch, fc.x, 0, fc.z, Math.PI); group.add(ch);
  const ba = buildBalancer(M, kit, quality); const fb = foot('balancer'); place(ba, fb.x, 0, fb.z + 0.0, Math.PI); group.add(ba);
  const rk = buildRack(M); const fr = foot('tireRack'); place(rk, fr.x, 0, fr.z, 0); group.add(rk);
  // loose tires: 8 standing in the rack (axis along x), 4 stacked flat
  const stack = foot('tireStack');
  const inst = new THREE.InstancedMesh(kit.geo, kit.tireMat, 12);
  inst.castShadow = false; inst.receiveShadow = true; inst.name = 'looseTires';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  let k = 0;
  const put = (x, y, z, rx, ry, rz) => { q.setFromEuler(e.set(rx, ry, rz, 'YXZ')); m.compose(p.set(x, y, z), q, s); inst.setMatrixAt(k++, m); };
  for (const [li, y] of [[0, 0.1 + 0.025 + 0.4 - 0.012], [1, 0.98 + 0.025 + 0.4 - 0.012]]) {
    for (let i = 0; i < 4; i++) put(fr.x - 0.56 + i * 0.37, y, fr.z, 0, i * 1.3 + li, Math.PI / 2);
  }
  for (let i = 0; i < 4; i++) put(stack.x + (i % 2 ? 0.015 : -0.01), 0.1325 + i * 0.265, stack.z + (i % 2 ? -0.012 : 0.01), 0, i * 0.9, 0);
  group.add(inst);
  inst.userData.labelId = 'shop.tires';
  return { kit };
}
