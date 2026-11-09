// The labeled body-mounted parts and the plumbing between them: air cleaner and intake tube, restriction indicator, coolant surge tank,
// the two batteries, underhood fuse block, washer reservoir with its hose, brake master cylinder with the reservoir, charge air pipes,
// Allison dipstick, battery cables and split-loom harnesses. Truck-frame inches. Positions follow layout.js (the supplement diagram).
import * as THREE from 'three';
import { Batch, T, V, tube, cylAxis, rbox, boxAt, lerp } from './geo.js';
import { POS, BAY, ENGINE } from './layout.js';
import { STACK } from './cooling.js';

const part = (parent, name, labelId) => { const g = new THREE.Group(); g.name = name; if (labelId) g.userData.labelId = labelId; parent.add(g); return g; };

// split loom (corrugated black tube) with optional connector blocks at the ends; pitch = ridge spacing in inches
export function loom(b, pts, r = 0.5, { ridged = true, conn = true, pitch = 0.55 } = {}) {
  const probe = tube(pts, r, { radial: 4, caps: false, segs: 8 }); const len = probe.userData.length;
  const n = ridged ? Math.max(4, Math.round(len / pitch)) : 0;
  b.add('loom', tube(pts, r, { radial: ridged ? 8 : 6, ridges: n, ridgeAmp: 0.13, segs: ridged ? n * 3 : Math.ceil(len / 1.2), uvScale: 0.2 }));
  if (conn) for (const [p, q] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
    const a = V(...p), c = V(...q), dir = a.clone().sub(c).normalize(); const e = a.clone().addScaledVector(dir, 0.55);
    b.add('plastic', T(rbox([0, 0, 0], r * 3.2, r * 2.6, 1.3, 0.2), [e.x, e.y, e.z], [0, Math.atan2(dir.x, dir.z), 0]));
  }
}

export function buildBits({ mats, d, fast }) {
  const root = new THREE.Group(); root.name = 'bay_parts';
  const A = {}; const rad = Math.max(10, Math.round(20 * d)); const ridged = d >= 0.7;

  // ================= A engine air cleaner / filter =================
  {
    const p = POS.airbox, g = part(root, 'air_cleaner', 'engine.air_cleaner'); const b = new Batch();
    const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, s0 = p.s - p.l / 2, s1 = p.s + p.l / 2, y0 = p.y - p.h / 2, y1 = p.y + p.h / 2;
    b.add('plasticDust', rbox([p.x, y0 + (p.h - 1.2) / 2, p.s], p.w, p.h - 1.2, p.l, 0.8, 3));
    b.add('plasticDust', rbox([p.x, y1 - 0.5, p.s], p.w + 0.3, 1.5, p.l + 0.3, 0.55, 3)); // lid
    for (let i = 0; i < 12; i++) b.add('plasticDust', boxAt([p.x - 0.4, y1 + 0.35, s0 + 2.4 + i * 1.1], p.w - 3.0, 0.32, 0.45)); // lid ribs (front part)
    for (let i = 0; i < 8; i++) b.add('plasticDust', boxAt([p.x + 0.2, y1 + 0.3, s0 + 1.4 + i * 1.7], 0.4, 0.26, 1.0));
    // outlet collar at the rear of the lid on the inboard side, intake snorkel at the front (inlet scoop from the fender side)
    b.add('plastic', cylAxis('z', [17.0, 39.3, s1 + 0.6], 2.25, 1.8, rad));
    b.add('plastic', cylAxis('z', [17.0, 39.3, s1 + 1.6], 2.35, 0.5, rad));
    b.add('plastic', rbox([x1 - 1.6, y1 - 2.0, s0 - 0.9], 3.8, 3.2, 2.4, 0.6)); // intake snorkel inlet
    // four spring clips on the lid edge
    for (const sx of [x0 - 0.12, x1 + 0.12]) for (const s of [s0 + 2.5, s1 - 2.5]) b.add('steelRaw', boxAt([sx, y1 - 0.9, s], 0.18, 1.6, 0.9));
    b.add('rubber', rbox([p.x, y0 - 0.1, p.s], p.w - 1, 0.6, p.l - 1, 0.2)); // mounting grommet pads
    b.flush(g, mats, { cast: true, name: 'ab' });
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2), mats.decal('airbox')); dec.rotation.set(-Math.PI / 2, 0, Math.PI); dec.position.set(p.x + 0.8, y1 + 0.52, s1 - 3.4); g.add(dec);
    A.airbox = g;
  }

  // ================= intake tube (airbox -> turbo compressor inlet) and D restriction indicator =================
  {
    const g = part(root, 'intake_tube', 'engine.intake_tube'); const b = new Batch();
    const pts = [[17.0, 39.3, -11.0], [17.0, 39.4, -8.6], [16.4, 39.8, -6.4], [14.9, 40.4, -2.4], [13.0, 40.9, 2.6], [11.8, 40.5, 7.0], [11.0, 39.6, 10.6], [11.6, 38.3, 13.4], [11.6, 37.1, 15.0], [9.0, 37.0, 15.0]];
    const t0 = 0.17, t1 = 0.46; // corrugated section
    const nR = 13;
    const rf = (t) => { const base = lerp(1.95, 2.15, Math.min(1, t * 1.3)); return t > t0 && t < t1 ? base * (1 + (ridged ? 0.1 : 0.0) * Math.sin(((t - t0) / (t1 - t0)) * nR * Math.PI * 2)) : base; };
    b.add('plastic', tube(pts, rf, { radial: rad, segs: ridged ? 140 : 40 }));
    b.flush(g, mats, { cast: true, name: 'it' });
    fast.clamp([17.0, 39.3, -10.6], [0, 0, 1], 2.3); fast.clamp([9.4, 37.0, 15.0], [1, 0, 0], 2.15);
    // black rubber coupler lines and a warning decal on the tube
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), mats.decal('warn')); dm.position.set(14.0, 42.9, -0.2); dm.rotation.set(-Math.PI / 2 + 0.28, 0, 0.35); g.add(dm);
    A.intakeTube = g;
    // restriction indicator: clear window with the yellow piston, on the tube next to the airbox outlet
    const p = POS.restriction, rg = part(root, 'restriction_indicator', 'engine.restriction_indicator'); const rb = new Batch();
    rb.add('plastic', cylAxis('y', [p.x, p.y - 1.5, p.s], 0.8, 0.9, 12));
    rb.add('lens', cylAxis('y', [p.x, p.y - 0.4, p.s], 0.62, 1.4, 12));
    rb.add('yellow', cylAxis('y', [p.x, p.y - 0.7, p.s], 0.4, 0.5, 10));
    rb.add('plastic', cylAxis('y', [p.x, p.y + 0.55, p.s], 0.7, 0.4, 12));
    rb.add('plastic', cylAxis('y', [p.x, p.y + 0.95, p.s], 0.45, 0.45, 10));
    rb.flush(rg, mats, { name: 'ri' });
    A.restriction = rg;
  }

  // ================= B coolant surge tank =================
  {
    const p = POS.surgeTank, g = part(root, 'surge_tank', 'engine.surge_tank'); const b = new Batch();
    const y0 = p.y - p.h / 2, x0 = p.x - p.w / 2;
    b.add('tankWhite', rbox([p.x, p.y, p.s], p.w, p.h, p.l, 1.2, 3));
    b.add('coolant', rbox([p.x, y0 + 3.0, p.s], p.w - 0.9, 5.8, p.l - 0.9, 1.0));
    for (let i = 0; i < 5; i++) b.add('tankWhite', rbox([x0 - 0.12, p.y - 0.4, p.s - p.l / 2 + 1.4 + i * 2.4], 0.5, p.h - 1.2, 1.2, 0.3));
    for (let i = 0; i < 5; i++) b.add('tankWhite', rbox([p.x + p.w / 2 + 0.12, p.y - 0.4, p.s - p.l / 2 + 1.4 + i * 2.4], 0.5, p.h - 1.2, 1.2, 0.3));
    // filler neck with pressure cap (anchor surgeCap): knurled grip and a decal
    const c = POS.surgeCap;
    b.add('tankWhite', cylAxis('y', [c.x, p.y + p.h / 2 + 0.5, c.s], 2.1, 1.4, rad));
    b.add('plastic', cylAxis('y', [c.x, c.y, c.s], 2.35, 1.1, rad));
    b.add('plastic', cylAxis('y', [c.x, c.y + 0.7, c.s], 1.9, 0.5, rad));
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; b.add('plastic', boxAt([c.x + Math.cos(a) * 2.35, c.y, c.s + Math.sin(a) * 2.35], 0.3, 1.1, 0.45, [0, -a, 0])); }
    b.add('steelRaw', rbox([p.x, y0 - 0.5, p.s], p.w - 1.2, 0.6, p.l - 1.2, 0.2)); // bracket
    b.flush(g, mats, { cast: false, name: 'st' });
    const dm = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), mats.decal('coolant')); dm.rotation.x = -Math.PI / 2; dm.position.set(c.x, c.y + 0.97, c.s); g.add(dm);
    const cap = new THREE.Object3D(); cap.name = 'surge_cap_anchor'; cap.position.set(c.x, c.y + 1.0, c.s); g.add(cap); A.surgeTankCap = cap; A.surgeTank = g;
  }

  // ================= C batteries (factory dual set) with posts, caps, hold-down and cables =================
  const batt = (key, side, labelId) => {
    const p = POS[key], g = part(root, `battery_${side}`, labelId); const b = new Batch();
    const sgn = side === 'pass' ? 1 : -1; const y0 = p.y - p.h / 2;
    b.add('battery', rbox([p.x, p.y, p.s], p.w, p.h, p.l, 0.45));
    b.add('battery', rbox([p.x, y0 + p.h - 0.15, p.s], p.w + 0.3, 0.6, p.l + 0.3, 0.2)); // cover lip
    b.add('steelBlack', rbox([p.x, y0 - 0.45, p.s], p.w + 2.0, 0.9, p.l + 1.6, 0.25)); // tray
    // top posts and caps on the front edge; positive is inboard on the passenger battery and outboard on the driver battery
    const posX = p.x - sgn * (p.w / 2 - 1.7), negX = p.x + sgn * (p.w / 2 - 1.7), ps = p.s - p.l / 2 + 1.1, top = p.y + p.h / 2 + 0.4;
    b.add('lead', cylAxis('y', [posX, top, ps], 0.55, 0.9, 12)); b.add('lead', cylAxis('y', [negX, top, ps], 0.45, 0.9, 12));
    b.add('red', rbox([posX, top + 0.4, ps], 1.5, 0.9, 1.5, 0.25)); b.add('plastic', rbox([negX, top + 0.4, ps], 1.4, 0.8, 1.4, 0.25));
    b.add('steelRaw', rbox([posX, top - 0.1, ps - 0.2], 1.7, 0.3, 1.0, 0.1)); b.add('steelRaw', rbox([negX, top - 0.1, ps - 0.2], 1.7, 0.3, 1.0, 0.1));
    // hold-down bar across the top with two J-bolts
    b.add('steelRaw', rbox([p.x, p.y + p.h / 2 + 0.2, p.s + 0.6], p.w * 0.9, 0.35, 1.0, 0.1));
    for (const dx of [-1, 1]) { b.add('zinc', cylAxis('y', [p.x + dx * (p.w / 2 - 1.2), p.y + p.h / 2 + 0.8, p.s + 0.6], 0.28, 1.2, 8)); b.add('zinc', cylAxis('y', [p.x + dx * (p.w / 2 - 1.2), p.y + p.h / 2 + 1.5, p.s + 0.6], 0.5, 0.35, 6)); }
    // handle/vent details
    b.add('battery', rbox([p.x, p.y + p.h / 2 + 0.25, p.s - 1.2], 2.6, 0.4, 1.0, 0.15));
    b.flush(g, mats, { cast: true, name: 'bt' });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.6), mats.decal('battery')); lab.rotation.set(-Math.PI / 2, 0, Math.PI); lab.position.set(p.x, p.y + p.h / 2 + 0.33, p.s + 1.2); g.add(lab);
    g.userData.posts = { pos: V(posX, top, ps), neg: V(negX, top, ps) };
    return g;
  };
  A.batteryPass = batt('batteryPass', 'pass', 'engine.battery_pass');
  A.batteryDriver = batt('batteryDriver', 'driver', 'engine.battery_driver');

  // ================= N underhood fuse block =================
  {
    const p = POS.fuseBlock, g = part(root, 'fuse_block', 'engine.fuse_block'); const b = new Batch();
    const y0 = p.y - p.h / 2, y1 = p.y + p.h / 2, s0 = p.s - p.l / 2, s1 = p.s + p.l / 2;
    b.add('plasticDust', rbox([p.x, p.y - 0.6, p.s], p.w, p.h - 1.2, p.l, 0.8, 3));
    b.add('plasticDust', rbox([p.x, y1 - 0.6, p.s], p.w + 0.5, 1.4, p.l + 0.5, 0.5, 3)); // lid
    b.add('plasticDust', rbox([p.x + 0.8, y0 - 0.6, s0 + 2.5], p.w - 1.6, 2.4, p.l - 5, 0.6)); // skirt/step at the front-lower
    b.add('plasticDust', rbox([p.x, y1 + 0.35, p.s], p.w - 1.6, 0.4, p.l - 1.6, 0.2)); // raised panel on the lid
    for (const sx of [p.x - p.w / 2 - 0.35, p.x + p.w / 2 + 0.35]) for (const s of [p.s - 3.4, p.s + 3.4]) b.add('plastic', rbox([sx, y1 - 1.8, s], 0.5, 2.4, 1.5, 0.15)); // lid latches
    // battery feed stud under a red cover at the front corner, harness exits on the rear and inboard faces
    b.add('red', rbox([p.x + 3.4, y1 + 0.2, s0 + 1.8], 2.6, 1.6, 2.6, 0.4));
    b.add('steelRaw', rbox([p.x, y0 - 1.9, p.s], p.w + 0.6, 0.6, p.l + 0.6, 0.2));
    b.flush(g, mats, { cast: true, name: 'fb' });
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(p.w - 2.4, p.l - 2.4), mats.decal('fuse')); lid.rotation.set(-Math.PI / 2, 0, Math.PI); lid.position.set(p.x, y1 + 0.57, p.s); g.add(lid);
    A.fuseBlock = g;
  }

  // ================= O washer fluid reservoir (low in the driver fender) with filler neck, pump, hose =================
  {
    const wc = POS.washerCap, g = part(root, 'washer_reservoir', 'engine.washer_reservoir'); const b = new Batch();
    b.add('tankWhite', rbox([-22.4, 28.0, -17.6], 5.4, 8.4, 11.6, 1.0, 3));
    b.add('tankWhite', rbox([-22.8, 31.8, -13.0], 4.6, 5.6, 4.2, 0.9, 3)); // raised rear lobe under the filler neck
    b.add('washerFluid', rbox([-22.4, 26.6, -17.6], 4.6, 5.4, 10.8, 0.8));
    b.add('tankWhite', cylAxis('y', [wc.x + 0.1, wc.y - 1.6, wc.s], 1.15, 2.8, 14));
    b.add('blueCap', cylAxis('y', [wc.x + 0.1, wc.y, wc.s], 1.65, 0.7, 16));
    b.add('blueCap', cylAxis('y', [wc.x + 0.1, wc.y + 0.45, wc.s], 1.3, 0.35, 16));
    b.add('plastic', cylAxis('x', [-19.2, 26.5, -22.0], 0.8, 1.0, 12)); // pump motor
    b.flush(g, mats, { cast: false, name: 'wr' });
    const dm = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), mats.decal('washer')); dm.rotation.x = -Math.PI / 2; dm.position.set(wc.x + 0.1, wc.y + 0.65, wc.s); g.add(dm);
    A.washerCap = g;
    // hose along the inner apron edge up to the cowl (clipped), then over to the hood hinge where hoodUnder.js takes it
    const wh = part(root, 'washer_hose', 'engine.washer_jets'); const hb = new Batch();
    const at = (s, dy = -0.8) => [-(BAY.apronHalf(s) - 0.45), BAY.apronTopY(s) + dy, s];
    const hose = [[-20.0, 27.4, -22.0], [-24.2, 27.2, -22.6], [-25.3, 34, -22.2], at(-20, -1.2), at(-10), at(0), at(10), at(17), [-25.0, 52.6, 19.2], [-24.5, 54.0, 19.6]];
    hb.add('cable', tube(hose, 0.24, { radial: 6, segs: 60 }));
    hb.flush(wh, mats, { name: 'wh' });
    for (const s of [-16, -4, 8, 15]) { const q = at(s); fast.bolt([q[0] + 0.15, q[1] + 0.4, q[2]], [0.4, 1, 0], 0.4); }
    A.washerHoseEnd = V(-24.5, 54.0, 19.6);
  }

  // ================= L brake fluid reservoir on the master cylinder / hydroboost =================
  {
    const p = POS.brakeReservoir, g = part(root, 'brake_master', 'engine.master_cylinder'); const b = new Batch();
    const my = 39.0;
    b.add('steelBlack', cylAxis('z', [p.x, my, 21.0], 4.6, 6.8, 36)); // hydroboost housing
    b.add('steelBlack', cylAxis('z', [p.x, my, 17.4], 3.6, 1.2, 28));
    b.add('ironDark', cylAxis('z', [p.x, my, 16.4], 1.85, 3.0, 24));
    b.add('masterCyl', cylAxis('z', [p.x, my + 0.2, 14.2], 1.5, 6.0, 24));
    b.add('masterCyl', rbox([p.x, my + 0.7, 14.8], 4.2, 1.6, 4.4, 0.6)); // reservoir seat
    for (const dx of [-3.1, 3.1]) b.add('steelBlack', rbox([p.x + dx, my + 2.4, 18.8], 0.8, 1.0, 1.0, 0.2));
    // brake line ports and the lines leaving toward the ABS unit
    for (const dx of [-0.9, 0.9]) b.add('brass', cylAxis('y', [p.x + dx, my - 1.2, 11.9], 0.34, 1.0, 8));
    b.add('steelRaw', tube([[p.x - 0.9, my - 1.5, 11.9], [p.x - 2.0, my - 3.5, 10.6], [p.x - 4.5, my - 6.5, 9.0]], 0.2, { radial: 6 }));
    b.add('steelRaw', tube([[p.x + 0.9, my - 1.5, 11.9], [p.x + 1.2, my - 3.8, 10.4], [p.x + 0.2, my - 7.5, 9.6]], 0.2, { radial: 6 }));
    b.flush(g, mats, { cast: true, name: 'mc' });
    const rg = part(root, 'brake_reservoir', 'engine.brake_reservoir'); const rb = new Batch();
    const ry = 43.8;
    rb.add('tankWhite', rbox([p.x, ry, p.s], 4.0, 6.6, 4.6, 1.0, 3));
    rb.add('brakeFluid', rbox([p.x, ry - 0.9, p.s], 3.2, 4.4, 3.8, 0.8));
    rb.add('tankWhite', rbox([p.x, ry - 3.0, p.s], 4.6, 1.2, 5.0, 0.5)); // base flange
    rb.add('tankWhite', cylAxis('y', [p.x, ry + 3.7, p.s], 1.2, 0.9, 14));
    rb.add('plastic', cylAxis('y', [p.x, p.y, p.s], 1.7, 0.9, 20)); // black cap with the yellow brake marking
    rb.add('plastic', cylAxis('y', [p.x, p.y + 0.5, p.s], 1.45, 0.3, 20));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; rb.add('plastic', boxAt([p.x + Math.cos(a) * 1.7, p.y, p.s + Math.sin(a) * 1.7], 0.26, 0.9, 0.5, [0, -a, 0])); }
    rb.add('plastic', rbox([p.x - 2.2, ry + 0.5, p.s], 0.6, 2.2, 1.6, 0.2)); // level sensor connector
    rb.flush(rg, mats, { name: 'br' });
    const dm = new THREE.Mesh(new THREE.CircleGeometry(1.05, 20), mats.decal('brake')); dm.rotation.x = -Math.PI / 2; dm.position.set(p.x, p.y + 0.67, p.s); rg.add(dm);
    A.brakeReservoir = rg; A.brakeCap = dm;
  }

  // ================= F Allison transmission dipstick (long tube up the firewall, black loop handle) =================
  {
    const p = POS.dipstickTrans, g = part(root, 'dipstick_trans', 'engine.dipstick_trans'); const b = new Batch();
    b.add('steelRaw', tube([[p.x, 24.0, 31.6], [p.x, 31.0, 28.4], [p.x, 36.0, 26.0], [p.x - 0.1, p.y - 2.2, p.s + 2.6], [p.x - 0.2, p.y - 1.0, p.s + 0.9]], 0.4, { radial: 8 }));
    b.add('plastic', cylAxis('y', [p.x - 0.2, p.y - 0.6, p.s + 0.9], 0.62, 1.0, 10));
    b.add('plastic', tube([[p.x - 0.2, p.y - 0.1, p.s + 0.9], [p.x - 0.2, p.y + 0.9, p.s + 0.9], [p.x - 1.0, p.y + 1.7, p.s + 0.9], [p.x - 2.1, p.y + 1.7, p.s + 0.9], [p.x - 2.8, p.y + 0.8, p.s + 0.9], [p.x - 2.1, p.y - 0.1, p.s + 0.9], [p.x - 1.0, p.y - 0.1, p.s + 0.9]], 0.32, { radial: 8 }));
    b.add('steelRaw', rbox([p.x, 36.0, 26.4], 1.8, 0.4, 1.6, 0.12)); // firewall clip
    b.flush(g, mats, { name: 'dt' });
    A.dipstickTrans = g;
  }

  // ================= charge air pipes: turbo -> intercooler (driver side), intercooler return -> intake manifold (passenger side) =================
  {
    const t = ENGINE.turbo, g = part(root, 'charge_pipe', 'engine.charge_pipe'); const b = new Batch();
    const pipe = [[t.x + 3.6, t.y + 4.2, t.s + 2.3], [3.5, 41.2, 17.5], [1.0, 42.8, 19.2], [-3.0, 42.8, 19.6], [-7.2, 40.2, 18.4], [-10.8, 36.8, 16.4], [-13.0, 32.6, 14.6], [-14.2, 28.4, 13.8]];
    b.add('alumPipe', tube(pipe, 1.45, { radial: rad, tension: 0.5 }));
    b.add('teal', tube([[-6.2, 41.2, 18.9], [-8.4, 39.6, 18.0]], 1.8, { radial: rad, caps: false }));
    b.add('alumMach', cylAxis('y', [3.5, 41.2, 17.5], 1.6, 0.35, rad));
    b.add('alumMach', cylAxis('y', [-13.0, 32.6, 14.6], 1.6, 0.35, rad));
    // hot side hose from the end of the aluminum pipe, down the driver side of the engine along the frame rail, to the intercooler
    const IC = STACK.intercooler, ic = V(-(IC.hw + 4.1), IC.y0 + 3.4, (IC.s0 + IC.s1) / 2);
    const hose = [[-14.2, 28.4, 13.8], [-15.6, 26.6, 12.4], [-17.8, 26.4, 5.0], [-18.4, 26.4, -7.0], [-18.8, 26.8, -17.0], [-19.0, 28.0, -24.0], [-17.8, 32.0, -26.4], [ic.x + 0.2, ic.y, ic.z]];
    b.add('rubber', tube(hose, 1.7, { radial: rad, tension: 0.5, ridges: ridged ? 5 : 0, ridgeAmp: 0.015 }));
    // the cold side: from the passenger stub back, below the air cleaner, up to the manifold inlet boot
    const ip = V(IC.hw + 4.1, IC.y0 + 3.4, ic.z);
    const back = [[ip.x - 0.2, ip.y, ip.z], [18.0, 31.6, -26.4], [18.6, 28.8, -23.6], [18.4, 27.4, -16.0], [17.2, 28.8, -12.8], [14.2, 31.6, -12.4], [9.5, 34.0, -12.4], [5.2, 36.3, -10.8], [3.4, 36.0, -8.8]];
    b.add('rubber', tube(back, 1.5, { radial: rad, tension: 0.5 }));
    b.add('alumMach', cylAxis('y', [3.4, 36.0, -8.8], 1.7, 0.5, rad));
    b.flush(g, mats, { cast: true, name: 'cp' });
    for (const [x, y, s, dx, dy, dz, r] of [[-8.0, 39.8, 18.0, 0.6, -0.5, -0.3, 1.8], [-5.6, 41.5, 19.0, 0.8, 0.3, 0, 1.8], [-14.0, 29.6, 13.9, -0.3, -1, 0, 1.7], [-17.8, 26.4, 5.0, 0, 0, 1, 1.7], [-19.0, 28.0, -24.0, 0, 0.5, -1, 1.7], [-17.2, 32.6, -26.6, 0.9, 0.3, -0.2, 1.7], [ic.x - 0.6, ic.y, ic.z, 1, 0, 0, 1.9], [ip.x + 0.6, ip.y, ip.z, 1, 0, 0, 1.9], [4.4, 36.5, -9.5, 0.8, 0.2, 0.5, 1.6]]) fast.clamp([x, y, s], [dx, dy, dz], r);
    A.chargePipe = g;
  }

  // ================= battery cables and split-loom harnesses =================
  {
    const g = part(root, 'wiring', 'engine.wiring'); const b = new Batch();
    const bp = A.batteryPass.userData.posts, bd = A.batteryDriver.userData.posts;
    const fb = POS.fuseBlock;
    // red feed from the passenger battery across the firewall to the fuse block; ground cables from each battery
    b.add('cableRed', tube([[bp.pos.x, bp.pos.y + 1.2, bp.pos.z], [bp.pos.x - 0.5, bp.pos.y + 1.6, bp.pos.z + 1.6], [10.5, 41.2, 14.6], [8, 41.4, 22.0], [-2, 42.4, 23.6], [-10, 42.0, 23.2], [-16.2, 42.2, 19.5], [fb.x + 3.4, fb.y + 4.7, fb.s - fb.l / 2 + 2.5]], 0.55, { radial: 8 }));
    b.add('cableRed', tube([[bd.pos.x, bd.pos.y + 1.2, bd.pos.z], [bd.pos.x - 0.4, bd.pos.y + 2.0, bd.pos.z + 1.0], [fb.x + 4.4, fb.y + 4.6, fb.s - fb.l / 2 + 1.5]], 0.5, { radial: 8 }));
    b.add('cable', tube([[bd.neg.x, bd.neg.y + 1.2, bd.neg.z - 0.2], [bd.neg.x + 1.4, bd.neg.y + 2.2, bd.neg.z - 1.4], [-13.5, 33.4, -5.0], [-12.4, 30.6, -7.2]], 0.5, { radial: 8 }));
    b.add('cable', tube([[bp.neg.x, bp.neg.y + 1.2, bp.neg.z - 0.2], [bp.neg.x - 0.2, bp.neg.y + 2.4, bp.neg.z - 1.6], [16.2, 40.8, 2.0], [14.6, 36.8, -2.8], [13.8, 32.6, -6.4]], 0.5, { radial: 8 }));
    b.add('steelRaw', rbox([-12.4, 30.2, -7.4], 1.6, 0.8, 1.0, 0.2));
    // main harness: fuse block -> front bulkhead -> radiator support (lamps, fan relay, sensors), clipped along the driver apron
    loom(b, [[-26.0, 38.0, 8.0], [-26.2, 41.0, -2.0], [-25.6, 42.2, -12.0], [-24.6, 41.0, -22.0], [-22.0, 40.2, -28.2]], 0.62, { ridged });
    loom(b, [[-20.8, 40.8, 6.2], [-18.0, 43.6, -1.0], [-13.0, 43.0, -6.4], [-9.4, 41.2, -9.0]], 0.5, { ridged });
    // firewall bulkhead -> engine harness running along the rear of the valley
    loom(b, [[-6.4, 41.6, 23.0], [-5.6, 40.2, 17.5], [-8.8, 38.6, 10.0], [-11.0, 37.2, 2.0]], 0.62, { ridged });
    loom(b, [[-3.0, 41.6, 23.0], [0.0, 39.2, 20.4], [4.2, 38.4, 17.4]], 0.48, { ridged });
    // alternator and sensor loom on the passenger side up to the battery
    loom(b, [[10.0, 31.4, -7.6], [13.4, 33.8, -3.0], [16.6, 36.4, 4.0], [17.2, 38.8, 7.2]], 0.5, { ridged });
    b.flush(g, mats, { name: 'wr' });
    A.wiring = g;
  }

  // ---------- extra density: additional loom and hose runs visible from the open-hood camera ----------
  {
    const g = part(root, 'extra_density', 'engine.wiring'); const b = new Batch(); const ridged = d >= 0.7;
    // driver-side harness along the fender apron
    loom(b, [[-22.0, 36.5, -18.0], [-21.2, 38.0, -8.0], [-19.5, 39.5, 2.0], [-17.0, 40.0, 10.0]], 0.48, { ridged });
    // passenger-side sensor loom near the alternator
    loom(b, [[14.0, 32.0, -12.0], [16.5, 34.5, -4.0], [15.0, 36.5, 4.0], [12.5, 37.5, 12.0]], 0.42, { ridged });
    // small hose from surge tank area toward the radiator
    b.add('rubber', tube([[-8.0, 42.0, -6.0], [-6.0, 40.5, -2.0], [-4.0, 38.0, 2.0], [-2.5, 36.5, 6.0]], 0.28, { radial: 6, segs: 24 }));
    // intercooler-to-engine charge pipe segment detail
    b.add('alumPipe', tube([[8.0, 30.0, -14.0], [6.0, 32.5, -8.0], [3.0, 34.0, -2.0]], 0.9, { radial: 8, segs: 16 }));
    b.flush(g, mats, { name: 'xd' });
  }

  return { group: root, anchors: A };
}

// harness on the engine itself: injector rails along each valve cover and the glow plug / sensor looms (shakes with the engine)
export function buildEngineWiring({ mats, d, fast }, root) {
  const g = new THREE.Group(); g.name = 'engine_wiring'; g.userData.labelId = 'engine.wiring'; root.add(g);
  const b = new Batch(); const ridged = d >= 0.7;
  const SQ = Math.SQRT1_2, C = ENGINE.crank;
  const bank = (sgn, u, w, s) => V(sgn * (u + w) * SQ, C.y + (u - w) * SQ, s);
  for (const sgn of [-1, 1]) {
    const L = (s) => { const p = bank(sgn, 17.0, -3.7, s); return [p.x, p.y, p.z]; };
    loom(b, [L(-7.0), L(-1.0), L(5.0), L(11.0), [sgn * 7.0, 38.6, 12.8], [sgn * 4.0, 37.4, 18.4]], 0.55, { ridged, conn: false });
    for (const s of [-4.5, 0.3, 5.1, 9.9]) { const p = bank(sgn, 16.4, -4.7, s), q = bank(sgn, 17.0, -3.7, s); b.add('cable', tube([[q.x, q.y, q.z], [p.x - sgn * 0.3, p.y + 0.5, p.z + 0.4], [p.x, p.y, p.z]], 0.2, { radial: 6, caps: false })); }
  }
  loom(b, [[-6.0, 36.4, -8.4], [-9.0, 33.4, -9.6], [-9.2, 27.0, -9.8], [-5.6, 24.2, -11.0]], 0.5, { ridged });
  loom(b, [[6.0, 36.0, -8.5], [9.4, 32.8, -9.6], [10.0, 28.0, -10.4]], 0.5, { ridged });
  loom(b, [[-2.8, 37.6, -3.6], [-6.8, 33.8, -6.4], [-9.2, 31.6, -8.8]], 0.4, { ridged, conn: false });
  b.flush(g, mats, { name: 'ew' });
  return g;
}
