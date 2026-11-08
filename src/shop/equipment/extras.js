// The extras that make it a real diesel shop: parts washer, floor jack and stands, rolling drain pan, used-oil drum,
// floor trench drain, trash can, rolling stool, overhead exhaust hose reel and a cord reel with a drop light.
import { THREE, Part, label, place } from './common.js';
import { foot } from './plan.js';
import { SHOP } from '../layout.js';

function partsWasher(M) {
  const g = new THREE.Group(); g.name = 'partsWasher';
  const P = new Part();
  // local: +x toward the room, back (wall) at x = -0.32
  P.cyl(M.darkSteel, 0.27, 0.56, 0.0, 0.3, 0.0, { seg: 20 });                          // solvent drum under the sink
  P.torus(M.steel, 0.27, 0.01, 0, 0.18, 0, { axis: 'y', seg: 20, rseg: 5 }); P.torus(M.steel, 0.27, 0.01, 0, 0.42, 0, { axis: 'y', seg: 20, rseg: 5 });
  P.box(M.steel, 0.62, 0.16, 0.9, 0, 0.64, 0, { r: 0.01 });                            // sink tub
  P.box(M.darkSteel, 0.54, 0.04, 0.82, 0, 0.72, 0, { r: 0.004 });                      // sink floor seen through the opening
  P.box(M.steel, 0.62, 0.03, 0.04, 0, 0.73, 0.43); P.box(M.steel, 0.62, 0.03, 0.04, 0, 0.73, -0.43);
  P.box(M.steel, 0.04, 0.03, 0.9, 0.29, 0.73, 0); P.box(M.steel, 0.04, 0.03, 0.9, -0.29, 0.73, 0);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) P.box(M.steel, 0.05, 0.56, 0.05, sx * 0.27, 0.28, sz * 0.4);
  // parts basket and drain tray
  P.box(M.lightSteel, 0.4, 0.04, 0.5, 0.0, 0.76, 0.0);
  // gooseneck faucet and brush, solvent pump
  P.hose(M.black, [[-0.25, 0.74, 0.0], [-0.25, 1.05, 0.0], [-0.16, 1.18, 0.0], [-0.02, 1.1, 0.0], [0.04, 0.94, 0.0]], 0.011, { segs: 16, radial: 6 });
  P.cyl(M.safetyYellow, 0.02, 0.07, 0.04, 0.92, 0.0, { seg: 8 });                         // brush head
  P.box(M.black, 0.1, 0.1, 0.1, -0.22, 0.86, 0.3, { r: 0.008 });                          // pump
  // hinged lid, standing up against the wall behind the sink (fusible link)
  P.box(M.safetyYellow, 0.02, 0.62, 0.9, -0.32, 1.1, 0.0, { r: 0.004, rz: -0.12 });
  P.box(M.darkSteel, 0.03, 0.03, 0.94, -0.3, 0.8, 0.0);
  P.build(g, { cast: true });
  label(g, 'shop.partsWasher');
  return g;
}

function floorJack(M) {
  const g = new THREE.Group(); g.name = 'floorJack';
  const P = new Part();
  // local: +z = front (saddle end). 3 ton, red. rear caster wheels, front steel wheels
  P.box(M.red, 0.07, 0.1, 0.62, -0.11, 0.1, 0.0, { r: 0.008 }); P.box(M.red, 0.07, 0.1, 0.62, 0.11, 0.1, 0.0, { r: 0.008 });
  P.box(M.red, 0.3, 0.07, 0.1, 0.0, 0.1, 0.2);
  P.box(M.red, 0.22, 0.12, 0.2, 0.0, 0.16, -0.05, { r: 0.01 });                             // pump housing
  P.cyl(M.chrome, 0.025, 0.14, 0.0, 0.2, 0.15, { seg: 10 });                                // ram
  P.box(M.red, 0.04, 0.05, 0.3, 0.0, 0.2, 0.3, { rx: -0.1 });                               // lift arm
  P.cyl(M.darkSteel, 0.055, 0.025, 0.0, 0.215, 0.46, { seg: 14 });                          // saddle
  P.cyl(M.rubber, 0.045, 0.01, 0.0, 0.232, 0.46, { seg: 12 });
  for (const sx of [-1, 1]) { P.cyl(M.rubber, 0.05, 0.035, sx * 0.14, 0.05, 0.28, { axis: 'x', seg: 14 }); P.cyl(M.darkSteel, 0.045, 0.035, sx * 0.13, 0.05, -0.28, { axis: 'x', seg: 14 }); P.cyl(M.rubber, 0.04, 0.03, sx * 0.14, 0.04, -0.28, { axis: 'x', seg: 12 }); }
  // pump handle, angled back with a rubber grip
  P.rod(M.darkSteel, [0, 0.2, -0.15], [0, 0.78, -0.82], 0.014);
  P.cyl(M.black, 0.019, 0.2, 0, 0.84, -0.9, { seg: 8, rx: 0.75 });
  P.build(g, { cast: false });
  label(g, 'shop.floorJack');
  return g;
}

function jackStand(M) {
  const g = new THREE.Group();
  const P = new Part();
  P.box(M.blue, 0.3, 0.03, 0.03, 0, 0.015, 0.0, { r: 0.004 }); P.box(M.blue, 0.03, 0.03, 0.3, 0, 0.015, 0.0, { r: 0.004 });
  P.box(M.blue, 0.03, 0.03, 0.28, 0, 0.015, 0.0, { ry: Math.PI / 4 });
  P.cyl(M.blue, 0.038, 0.36, 0.0, 0.2, 0.0, { seg: 10 });                                  // column
  P.cyl(M.darkSteel, 0.022, 0.3, 0.0, 0.34, 0.0, { seg: 8 });                              // ratchet post
  for (let i = 0; i < 5; i++) P.box(M.darkSteel, 0.052, 0.006, 0.01, 0, 0.26 + i * 0.045, 0.02);
  P.box(M.darkSteel, 0.1, 0.02, 0.06, 0.0, 0.5, 0.0);                                       // saddle
  P.box(M.black, 0.1, 0.02, 0.02, 0.0, 0.52, 0.03); P.box(M.black, 0.1, 0.02, 0.02, 0.0, 0.52, -0.03);
  for (const sx of [-1, 1]) P.rod(M.blue, [sx * 0.12, 0.025, 0.12], [sx * 0.03, 0.3, 0.0], 0.012), P.rod(M.blue, [sx * 0.12, 0.025, -0.12], [sx * 0.03, 0.3, 0.0], 0.012);
  P.build(g, { cast: false });
  return g;
}

function drainPan(M) {
  const g = new THREE.Group(); g.name = 'oilDrain';
  const P = new Part();
  // rolling waste-oil drain: low tank on a wheeled frame, wide funnel pan on a telescoping post, sight tube, hose
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { P.cyl(M.rubber, 0.04, 0.03, sx * 0.24, 0.04, sz * 0.24, { axis: 'x', seg: 12 }); P.box(M.darkSteel, 0.03, 0.06, 0.05, sx * 0.24, 0.09, sz * 0.24); }
  P.box(M.darkSteel, 0.56, 0.025, 0.56, 0, 0.115, 0, { r: 0.004 });
  P.cyl(M.orange, 0.235, 0.3, 0, 0.275, 0, { seg: 24 });                                  // tank
  P.torus(M.orange, 0.235, 0.008, 0, 0.14, 0, { axis: 'y', seg: 24, rseg: 5 });
  P.cyl(M.darkSteel, 0.05, 0.4, 0.0, 0.57, 0.0, { seg: 10 });                             // post
  P.lathe(M.orange, [[0.05, 0.0], [0.1, 0.02], [0.33, 0.07], [0.335, 0.09], [0.32, 0.09], [0.1, 0.045], [0.05, 0.03]], 0, 0.7, 0, { seg: 28 }); // dish funnel
  P.torus(M.darkSteel, 0.33, 0.006, 0, 0.79, 0, { axis: 'y', seg: 28, rseg: 5 });
  for (let i = -3; i <= 3; i++) P.box(M.darkSteel, 0.012, 0.01, 0.4, i * 0.06, 0.755, 0);   // grate bars
  P.box(M.darkSteel, 0.4, 0.01, 0.012, 0, 0.755, 0.0);
  // sight tube and drain valve with a hose on the side
  P.cyl(M.glass, 0.014, 0.26, 0.2, 0.28, 0.2, { seg: 8 }); P.cyl(M.oil, 0.008, 0.14, 0.2, 0.22, 0.2, { seg: 6 });
  P.cyl(M.brass, 0.02, 0.05, 0.0, 0.17, 0.24, { axis: 'z', seg: 8 });
  P.hose(M.black, [[0.0, 0.17, 0.27], [0.1, 0.12, 0.36], [0.25, 0.05, 0.38]], 0.012, { segs: 12, radial: 6 });
  // push handle
  P.rod(M.darkSteel, [-0.2, 0.5, -0.2], [-0.2, 0.9, -0.3], 0.012); P.rod(M.darkSteel, [0.2, 0.5, -0.2], [0.2, 0.9, -0.3], 0.012); P.cyl(M.black, 0.015, 0.4, 0, 0.9, -0.3, { axis: 'x', seg: 8 });
  P.build(g, { cast: true });
  label(g, 'shop.oilDrain');
  return g;
}

function usedOilDrum(M) {
  const g = new THREE.Group(); g.name = 'usedOilDrum';
  const P = new Part();
  P.cyl(M.black, 0.29, 0.88, 0, 0.44, 0, { seg: 24 });
  for (const y of [0.15, 0.44, 0.73]) P.torus(M.black, 0.29, 0.009, 0, y, 0, { axis: 'y', seg: 24, rseg: 5 });
  P.torus(M.darkSteel, 0.295, 0.012, 0, 0.88, 0, { axis: 'y', seg: 24, rseg: 5 });
  P.lathe(M.safetyYellow, [[0.01, 0.0], [0.04, 0.0], [0.15, 0.12], [0.155, 0.15], [0.14, 0.15], [0.04, 0.04]], 0.0, 0.88, 0, { seg: 20 });  // funnel
  P.cyl(M.chrome, 0.03, 0.02, 0.17, 0.895, 0.1, { seg: 10 });
  P.build(g, { cast: true });
  label(g, 'shop.usedOilDrum');
  return g;
}

function trashCan(M) {
  const g = new THREE.Group(); g.name = 'trashCan';
  const P = new Part();
  P.cyl(M.grayPlastic, 0.26, 0.8, 0, 0.4, 0, { seg: 22, r2: 0.22 });
  P.torus(M.grayPlastic, 0.26, 0.012, 0, 0.8, 0, { axis: 'y', seg: 22, rseg: 5 });
  P.cyl(M.black, 0.245, 0.12, 0, 0.8, 0, { seg: 22, open: true });                         // liner bag cuff
  P.box(M.grayPlastic, 0.08, 0.05, 0.02, 0.26, 0.55, 0.0);                                  // handle
  P.build(g, { cast: true });
  label(g, 'shop.trashCan');
  return g;
}

function stool(M) {
  const g = new THREE.Group(); g.name = 'rollingStool';
  const P = new Part();
  P.cyl(M.black, 0.17, 0.07, 0, 0.5, 0, { seg: 18 });                                      // padded seat
  P.cyl(M.darkSteel, 0.14, 0.02, 0, 0.455, 0, { seg: 12 });
  P.cyl(M.chrome, 0.025, 0.3, 0, 0.3, 0, { seg: 8 });                                      // gas lift
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; P.box(M.darkSteel, 0.04, 0.03, 0.26, Math.sin(a) * 0.13, 0.1, Math.cos(a) * 0.13, { ry: a }); P.sph(M.black, 0.03, Math.sin(a) * 0.26, 0.04, Math.cos(a) * 0.26, { seg: 8 }); }
  P.torus(M.chrome, 0.2, 0.008, 0, 0.2, 0, { axis: 'y', seg: 18, rseg: 4 });                // foot ring
  P.build(g, { cast: false });
  label(g, 'shop.stool');
  return g;
}

function trenchDrain(M, x0, x1, z) {
  const g = new THREE.Group(); g.name = 'trenchDrain';
  const L = x1 - x0, W = 0.26;
  const P = new Part();
  const cx = (x0 + x1) / 2;
  P.box(M.black, L - 0.04, 0.002, W - 0.04, cx, 0.003, z);                                 // the dark channel seen between the bars
  P.box(M.zinc, L, 0.02, 0.03, cx, 0.01, z - W / 2 + 0.015); P.box(M.zinc, L, 0.02, 0.03, cx, 0.01, z + W / 2 - 0.015);     // frame angles
  P.box(M.zinc, 0.03, 0.02, W, x0 + 0.015, 0.01, z); P.box(M.zinc, 0.03, 0.02, W, x1 - 0.015, 0.01, z);
  const n = Math.floor(L / 0.045);
  for (let i = 0; i < n; i++) P.box(M.zinc, 0.012, 0.016, W - 0.06, x0 + 0.06 + i * ((L - 0.12) / (n - 1)), 0.016, z);
  P.box(M.zinc, L - 0.1, 0.012, 0.012, cx, 0.012, z);                                       // center bearing bar
  // round floor drain with a grate near the lift centerline
  P.build(g, { cast: false });
  label(g, 'shop.trench');
  return g;
}

function exhaustReel(M) {
  const g = new THREE.Group(); g.name = 'exhaustReel';
  const P = new Part();
  // hangs on two rods from the roof structure; drum axis along x
  P.cyl(M.zinc, 0.34, 0.06, -0.24, 0, 0, { axis: 'x', seg: 28 }); P.cyl(M.zinc, 0.34, 0.06, 0.24, 0, 0, { axis: 'x', seg: 28 });
  P.cyl(M.darkSteel, 0.14, 0.5, 0, 0, 0, { axis: 'x', seg: 18 });
  P.cyl(M.black, 0.3, 0.4, 0, 0, 0, { axis: 'x', seg: 28 });                              // coiled hose
  for (let i = -4; i <= 4; i++) P.cyl(M.darkSteel, 0.302, 0.012, i * 0.045, 0, 0, { axis: 'x', seg: 28 }); // corrugation
  P.box(M.orange, 0.62, 0.05, 0.12, 0, 0.42, 0, { r: 0.006 });                              // mounting yoke
  for (const sx of [-1, 1]) { P.box(M.orange, 0.05, 0.78, 0.05, sx * 0.3, 0.1, 0.0, { r: 0.004 }); P.rod(M.steel, [sx * 0.3, 0.55, 0], [sx * 0.3, 2.8, 0], 0.012); }
  P.box(M.darkSteel, 0.14, 0.02, 0.14, -0.3, 2.82, 0); P.box(M.darkSteel, 0.14, 0.02, 0.14, 0.3, 2.82, 0);
  // 6 in corrugated exhaust hose hanging in a lazy S to a rubber nozzle
  const pts = [[0, -0.3, 0.0], [0.0, -0.55, 0.15], [0.12, -1.0, 0.35], [0.5, -1.55, 0.6], [0.9, -1.7, 0.8], [1.4, -1.55, 0.95]].map((p) => p);
  P.hose(M.rubber, pts, 0.085, { segs: 40, radial: 12 });
  P.cyl(M.rubber, 0.13, 0.22, 1.45, -1.5, 0.98, { axis: 'x', seg: 14, r2: 0.09, rz: 0.2 });   // slip-on tailpipe cone
  P.cyl(M.steel, 0.1, 0.03, 1.33, -1.5, 0.97, { axis: 'x', seg: 14 });
  P.build(g, { cast: false });
  label(g, 'shop.exhaustReel');
  return g;
}

function dropLightReel(M) {
  const g = new THREE.Group(); g.name = 'dropLightReel';
  const P = new Part();
  // wall-mounted cord reel (local +z out of the wall) with a caged LED work light on a retractable cord
  P.box(M.darkSteel, 0.2, 0.3, 0.012, 0, 0, 0.006);
  P.cyl(M.yellow, 0.14, 0.12, 0, 0, 0.075, { axis: 'z', seg: 22 });
  P.cyl(M.black, 0.145, 0.015, 0, 0, 0.14, { axis: 'z', seg: 22 });
  P.cyl(M.chrome, 0.03, 0.02, 0, 0, 0.15, { axis: 'z', seg: 12 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.box(M.darkSteel, 0.012, 0.09, 0.01, Math.sin(a) * 0.06, Math.cos(a) * 0.06, 0.15, { rz: -a }); }
  // cord and cage light hanging down
  P.hose(M.yellow, [[0, -0.14, 0.075], [0.0, -0.3, 0.1], [0.03, -0.45, 0.12], [0.04, -0.55, 0.12]], 0.007, { segs: 12, radial: 6 });
  P.box(M.black, 0.06, 0.05, 0.06, 0.04, -0.58, 0.12, { r: 0.006 });
  P.cyl(M.black, 0.02, 0.06, 0.04, -0.62, 0.12, { seg: 8 });
  P.cyl(M.chrome, 0.045, 0.02, 0.04, -0.66, 0.12, { seg: 12 });
  P.sph(M.bulb, 0.04, 0.04, -0.7, 0.12, { seg: 10 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.rod(M.satin, [0.04 + Math.sin(a) * 0.052, -0.66, 0.12 + Math.cos(a) * 0.052], [0.04, -0.77, 0.12], 0.0025, { seg: 4 }); }
  P.torus(M.satin, 0.052, 0.003, 0.04, -0.69, 0.12, { axis: 'y', seg: 14, rseg: 4 });
  P.build(g, { cast: false });
  label(g, 'shop.dropLight');
  return g;
}

export function buildExtras(ctx) {
  const { M, group, signs } = ctx;
  const pw = foot('partsWasher');
  const w = partsWasher(M); place(w, pw.x, 0, pw.z, 0); group.add(w);
  signs.add('solvent', 0.26, pw.x + 0.275, 0.36, pw.z, Math.PI / 2);
  const fj = foot('floorJack'), js = foot('jackStands');
  const j = floorJack(M); place(j, fj.x, 0, fj.z, 0.35); group.add(j);
  for (const [dx, dz, ry] of [[-0.14, 0.1, 0.4], [0.18, -0.08, -0.3]]) { const s = jackStand(M); place(s, js.x + dx, 0, js.z + dz, ry); label(s, 'shop.jackStands'); group.add(s); }
  const dp = foot('drainPan'); const pan = drainPan(M); place(pan, dp.x, 0, dp.z, 0.4); group.add(pan);
  const dr = foot('drum'); const drum = usedOilDrum(M); place(drum, dr.x, 0, dr.z, 0); group.add(drum);
  signs.add('oilOnly', 0.28, -SHOP.halfX + 0.006, 1.45, dr.z, Math.PI / 2);
  const tr = foot('trash'); const trash = trashCan(M); place(trash, tr.x, 0, tr.z, 0); group.add(trash);
  const st = stool(M); place(st, -10.45, 0, -4.0, 0.4); group.add(st);
  const tdr = trenchDrain(M, -9.6, -6.0, 0.9); group.add(tdr);
  const ex = exhaustReel(M); place(ex, -8.2, 4.2, 0.3, 0); group.add(ex);
  const dl = dropLightReel(M); place(dl, -SHOP.halfX + 0.0, 2.0, 3.55, Math.PI / 2); group.add(dl);
}
