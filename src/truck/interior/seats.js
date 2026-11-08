// Tan leather power front buckets with perforated inserts, stitched panels and seat-side power controls; the center console with
// cupholder tray and padded lid; the crew cab rear bench with three headrests and a folding center armrest; seat belts.
// Reference: IMG_2869, IMG_2870, IMG_2871 (front buckets, console), IMG_2869 (rear bench and armrest), 07b (rear bench shape).
import * as THREE from 'three';
import { Batch, M, boxG, cylG, cylX, cylZ, plateG, softBox, surfaceG, stitchesG, ribbonG, tubeG, lerp, clamp, smooth, boxUV, hitMesh } from './kit.js';

const FLOOR = 22;

// ---- shared pad deformation helpers (all local to a seat-part box, y up, z rearward) ----
const sm = (t) => smooth(clamp(t, 0, 1));

// cushion top height offset at (x, z) in cushion-local coordinates (box centered at 0; w=22.2, d=21)
const cushionLift = (x, z, w, d) => {
  const ax = Math.abs(x);
  const bol = sm((ax - 5.2) / 4.4) * 1.9;                          // side bolsters
  const dish = -0.95 * (1 - sm(ax / 8.5)) * (1 - sm((Math.abs(z + 1.0) - 5.5) / 6)); // seat pan dish
  const waterfall = -1.0 * sm((-z - (d / 2 - 4.5)) / 4.2);           // front edge rolls down
  const rearUp = 0.0;
  return bol + dish + waterfall + rearUp;
};
const backShift = (x, y, w, h) => {                                // seat back: surface offset along -z (toward the driver) at (x, y)
  const ax = Math.abs(x);
  const bol = sm((ax - 5.4) / 4.2) * 2.4;
  const hollow = -0.45 * (1 - sm(ax / 8)) * sm((y + h / 2 - 1) / 4) * (1 - sm((y - h / 2 + 8) / 6));
  const lumbar = 0.5 * (1 - sm(ax / 7)) * Math.exp(-Math.pow((y + h * 0.22) / 3.2, 2));
  return bol + hollow + lumbar;
};

export function buildSeats(env) {
  const { root, M: MT, quality, anchors, state } = env;
  const seatsG = new THREE.Group(); seatsG.name = 'seats'; root.add(seatsG);
  const B = new Batch(MT);
  const stepS = quality.tex >= 2048 ? 1.0 : 1.25;

  // ---------------- one front bucket seat ----------------
  // side: -1 driver (outer = -x), +1 passenger. xc seat centerline, sF cushion front edge (s)
  function frontSeat(side, xc, sF) {
    const outer = side; // outboard direction (x sign)
    const lab = new THREE.Group(); lab.name = side < 0 ? 'seat_front_L' : 'seat_front_R'; lab.userData.labelId = side < 0 ? 'interior.seatFrontL' : 'interior.seatFrontR';
    lab.position.set(xc, 0, sF); seatsG.add(lab);
    const SB = new Batch(MT); // in seat-local coordinates, then built into `lab`
    const W = 22.2, Dc = 21.0, Hc = 5.0, Cy = 28.6, Cz = Dc / 2;
    // cushion
    const cush = softBox({ w: W, h: Hc, d: Dc, r: 1.4, step: stepS, stepZ: stepS,
      deform: (p, o) => { const wgt = sm((p[1] + Hc / 2 - 0.2) / (Hc * 0.75)); p[1] += cushionLift(p[0], p[2], W, Dc) * wgt; } });
    SB.add(cush, 'leather', M(0, Cy, Cz));
    // insert (perforated) on the cushion: flat patch following the same lift function
    const inX = 6.6, inZ0 = -3.6, inZ1 = 8.8;
    const topY = (x, z) => Cy + Hc / 2 + cushionLift(x, z, W, Dc);
    const patch = surfaceG(14, 20, (u, v) => { const x = u * inX, z = lerp(inZ0, inZ1, (v + 1) / 2); return [x, topY(x, z) + 0.035, Cz + z, x, z]; }, { flip: true });
    SB.add(patch, 'leatherPerf');
    // stitching around the insert, along the bolster seams, and the front edge welt
    const loop = []; const N = 18;
    for (let i = 0; i <= N; i++) loop.push([lerp(-inX, inX, i / N), inZ0]); for (let i = 1; i <= N; i++) loop.push([inX, lerp(inZ0, inZ1, i / N)]);
    for (let i = 1; i <= N; i++) loop.push([lerp(inX, -inX, i / N), inZ1]); for (let i = 1; i <= N; i++) loop.push([-inX, lerp(inZ1, inZ0, i / N)]);
    SB.add(stitchesG(loop.map(([x, z]) => [x, topY(x, z) + 0.06, Cz + z]), { len: 0.17, gap: 0.1, w: 0.05, h: 0.04 }), 'thread');
    for (const sx of [-1, 1]) { // double stitch along the bolster crease
      const line = []; for (let i = 0; i <= 20; i++) { const z = lerp(-4.5, 17.5, i / 20); line.push([sx * 8.6, topY(sx * 8.6, z) + 0.05, Cz + z]); }
      SB.add(stitchesG(line, { len: 0.17, gap: 0.1 }), 'thread');
    }
    // piping along the front lower edge
    const front = []; for (let i = 0; i <= 20; i++) { const x = lerp(-W / 2 + 2, W / 2 - 2, i / 20); front.push([x, Cy + Hc / 2 - 1.3, 0.25]); }
    SB.add(stitchesG(front, { len: 0.17, gap: 0.1, normals: () => [0, 0.3, -1] }), 'thread');

    // seat back
    const Hb = 25.5, Wb = 21.6, Db = 5.2; const lean = 0.30; // 17 degrees
    const pivot = [0, 30.2, 19.6];
    const bm = M(pivot[0], pivot[1], pivot[2], lean, 0, 0);
    const mB = (x, y, z, rx = 0, ry = 0, rz = 0) => bm.clone().multiply(M(x, y, z, rx, ry, rz));
    const back = softBox({ w: Wb, h: Hb, d: Db, r: 2.0, step: stepS, stepY: stepS * 1.3,
      deform: (p, o) => { p[0] *= 1 - 0.08 * sm((p[1] - Hb / 2 + 9) / 9); if (p[2] < 0) { const wgt = sm((-p[2] - 0.2) / (Db * 0.45)); p[2] -= backShift(p[0], p[1], Wb, Hb) * wgt; } } });
    SB.add(back, 'leather', mB(0, Hb / 2 - 0.5, 0.4));
    // back insert + stitching
    const bx = 6.6, by0 = -8.2, by1 = 9.6; const faceZ = (x, y) => 0.4 - Db / 2 - backShift(x, y, Wb, Hb) - 0.035;
    const bpatch = surfaceG(14, 24, (u, v) => { const x = u * bx, y = lerp(by0, by1, (v + 1) / 2); return [x, Hb / 2 - 0.5 + y, faceZ(x, y), x, y]; }, { flip: true });
    SB.add(bpatch.applyMatrix4(bm), 'leatherPerf');
    const bl = []; for (let i = 0; i <= N; i++) bl.push([lerp(-bx, bx, i / N), by0]); for (let i = 1; i <= N; i++) bl.push([bx, lerp(by0, by1, i / N)]); for (let i = 1; i <= N; i++) bl.push([lerp(bx, -bx, i / N), by1]); for (let i = 1; i <= N; i++) bl.push([-bx, lerp(by1, by0, i / N)]);
    const bpts = bl.map(([x, y]) => new THREE.Vector3(x, Hb / 2 - 0.5 + y, faceZ(x, y) - 0.03).applyMatrix4(bm).toArray());
    SB.add(stitchesG(bpts, { len: 0.17, gap: 0.1, normals: () => [0, Math.sin(lean), -Math.cos(lean)] }), 'thread');
    for (const sx of [-1, 1]) { const l2 = []; for (let i = 0; i <= 22; i++) { const y = lerp(-10, 11.5, i / 22); l2.push(new THREE.Vector3(sx * 9.0, Hb / 2 - 0.5 + y, faceZ(sx * 9.0, y) - 0.03).applyMatrix4(bm).toArray()); } SB.add(stitchesG(l2, { len: 0.17, gap: 0.1, normals: () => [0, Math.sin(lean), -Math.cos(lean)] }), 'thread'); }
    // headrest and posts
    const hr = softBox({ w: 12.2, h: 6.8, d: 4.4, r: 2.0, step: stepS, deform: (p) => { if (p[2] < 0) p[2] -= 0.5 * (1 - Math.abs(p[0] / 6.1)) ** 1; } });
    SB.add(hr, 'leather', mB(0, Hb - 0.5 + 3.0 + 0.6, 0.6));
    for (const sx of [-1, 1]) SB.add(cylG(0.28, 0.28, 3.4, 10), 'steel', mB(sx * 2.7, Hb - 0.5 - 0.4, 0.6));
    // headrest stitch seam across
    const hs = []; for (let i = 0; i <= 14; i++) { const x = lerp(-4.5, 4.5, i / 14); hs.push(new THREE.Vector3(x, Hb + 3.1, -2.8 - 0.5 * (1 - Math.abs(x / 6.1))).applyMatrix4(bm).toArray()); }
    SB.add(stitchesG(hs, { len: 0.17, gap: 0.1, normals: () => [0, 0.2, -1] }), 'thread');
    // seat back rear shell (tan plastic) and the map pocket on the back
    SB.add(softBox({ w: Wb - 1.2, h: Hb - 2, d: 0.9, r: 0.35, step: 3 }), 'tanPlastic', mB(0, Hb / 2 - 1.0, 2.6));

    // base: tan plastic shrouds and the seat tracks
    SB.add(softBox({ w: 2.6, h: 5.8, d: 18.5, r: 0.7, step: 2 }), 'tanPlastic', M(-outer * 0 + 0 - 9.4, 24.4, 10.8));
    SB.add(softBox({ w: 2.6, h: 5.8, d: 18.5, r: 0.7, step: 2 }), 'tanPlastic', M(9.4, 24.4, 10.8));
    SB.add(softBox({ w: 15.5, h: 3.6, d: 15, r: 0.7, step: 3 }), 'blackSoft', M(0, 25.2, 11.0));
    for (const sx of [-1, 1]) SB.add(boxG(1.1, 1.0, 21), 'steel', M(sx * 8.6, FLOOR + 0.8, 11.0));
    // power seat control panel on the outboard shroud: a plate, two rocker switches and the recline knob (IMG_2870)
    const cx = outer * 10.75; const cm = M(cx, 24.9, 8.8, 0, outer * Math.PI / 2, 0);
    SB.add(plateG(5.2, 2.4, 0.3, 0.35, 0.04), 'tanPlastic', cm);
    SB.add(plateG(1.5, 0.75, 0.3, 0.12, 0.03), 'blackSoft', cm.clone().multiply(M(-1.6, 0.35, 0.28)));
    SB.add(plateG(0.8, 1.2, 0.3, 0.12, 0.03), 'blackSoft', cm.clone().multiply(M(0.0, -0.1, 0.28)));
    SB.add(cylZ(0.5, 0.5, 0.3, 18), 'blackSoft', cm.clone().multiply(M(1.5, -0.1, 0.3)));
    SB.add(cylZ(0.24, 0.24, 0.12, 14), 'satin', cm.clone().multiply(M(1.5, -0.1, 0.45)));
    // seat belt buckle stalk on the inboard side (red release button) and the stowed shoulder belt on the pillar
    const inner = -outer; SB.add(softBox({ w: 1.3, h: 4.6, d: 0.55, r: 0.2, step: 2 }), 'black', M(inner * 11.0, Cy + 3.8, 17.0, 0, 0, inner * 0.15));
    SB.add(plateG(0.9, 0.7, 0.2, 0.1, 0.02), 'redBtn', M(inner * 11.0, Cy + 6.3, 17.0, 0, 0, inner * 0.15));
    SB.build(lab, { cast: false });
    return lab;
  }

  const drv = frontSeat(-1, -16, 57.2); const pas = frontSeat(1, 16, 57.2);
  anchors.seatDriver = drv; anchors.seatPassenger = pas;

  // ---------------- belts (stowed along the pillar: webbing from the D-ring down to the retractor, latch plate resting at the pillar) ----------------
  const beltB = new Batch(MT);
  const belt = (x, yTop, s, yBot, sRet, latchY) => {
    const sg = Math.sign(x);
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([x - sg * (0.4 + 0.5 * t), lerp(yTop, yBot, t), lerp(s, sRet, t) - 0.0]); }
    beltB.add(ribbonG(pts, 1.9, [-sg, 0, 0], 0.05), 'webbing');
    beltB.add(plateG(1.9, 3.6, 0.25, 0.3, 0.03), 'satin', M(x - sg * 1.2, latchY, s + (sRet - s) * (yTop - latchY) / (yTop - yBot) - 0.0, 0, sg * Math.PI / 2, 0));
    beltB.add(boxG(0.6, 2.2, 2.6), 'tanPlastic', M(x - sg * 0.2, yTop + 1.0, s - 0.3)); // D-ring cover
  };
  belt(-34.4, 53.5, 72.8, 30.0, 73.6, 42.0); belt(34.4, 53.5, 72.8, 30.0, 73.6, 42.0);
  belt(-34.2, 52.0, 99.0, 34.0, 100.2, 41.0); belt(34.2, 52.0, 99.0, 34.0, 100.2, 41.0);
  beltB.build(seatsG, {});

  // ---------------- floor console (IMG_2869 to IMG_2871) ----------------
  const con = new THREE.Group(); con.name = 'floor_console'; con.userData.labelId = 'interior.console'; seatsG.add(con);
  const CB = new Batch(MT);
  // body: sides from the floor to the tray / lid
  CB.add(softBox({ w: 11.0, h: 10.0, d: 31, r: 1.2, step: 3 }), 'tanPlastic', M(0, 27.2, 64.0));
  // front tray (s 47 to 61) with two cupholder holes: extrude with holes
  const trayShape = new THREE.Shape(); { const w = 10.6, h = 15.0, r = 1.2, x = -w / 2, y = -h / 2; trayShape.moveTo(x + r, y); trayShape.lineTo(x + w - r, y); trayShape.quadraticCurveTo(x + w, y, x + w, y + r); trayShape.lineTo(x + w, y + h - r); trayShape.quadraticCurveTo(x + w, y + h, x + w - r, y + h); trayShape.lineTo(x + r, y + h); trayShape.quadraticCurveTo(x, y + h, x, y + h - r); trayShape.lineTo(x, y + r); trayShape.quadraticCurveTo(x, y, x + r, y); }
  for (const cx of [-2.65, 2.65]) { const p = new THREE.Path(); p.absarc(cx, 1.4, 1.75, 0, Math.PI * 2, true); trayShape.holes.push(p); }
  const trayG = new THREE.ExtrudeGeometry(trayShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2, curveSegments: 14 });
  trayG.rotateX(Math.PI / 2); // lay it flat: shape (x, y) -> (x, z), extrude down
  trayG.computeVertexNormals(); CB.add(boxUV(trayG), 'tanPlastic', M(0, 32.9, 54.0));
  for (const cx of [-2.65, 2.65]) { // cup wells (black rubber liners)
    CB.add(new THREE.CylinderGeometry(1.7, 1.55, 3.2, 22, 1, true), 'rubberMatBS', M(cx, 31.1, 55.4));
    CB.add(new THREE.CylinderGeometry(1.55, 1.55, 0.1, 22), 'black', M(cx, 29.5, 55.4));
    CB.add(new THREE.TorusGeometry(1.76, 0.1, 6, 24), 'graphite', M(cx, 32.95, 55.4, Math.PI / 2, 0, 0));
  }
  // lid: padded armrest with a rounded, slightly crowned top; tan plastic with the ribbed mesh insert (IMG_2871)
  const lidFront = 62.5, lidLen = 17, lidTop = 36.4;
  const lid = new THREE.Group(); lid.name = 'console_lid'; lid.userData.labelId = 'interior.consoleLid'; con.add(lid);
  const LB = new Batch(MT);
  LB.add(softBox({ w: 10.4, h: 3.2, d: lidLen, r: 1.3, step: 2, deform: (p) => { if (p[1] > 0) p[1] += 0.35 * (1 - (p[0] / 5.2) ** 2) * (1 - (p[2] / (lidLen / 2)) ** 2); } }), 'leather', M(0, lidTop - 1.6, lidFront + lidLen / 2));
  LB.add(softBox({ w: 6.9, h: 0.3, d: 2.9, r: 0.12, step: 1 }), 'meshGray', M(0, lidTop + 0.38, lidFront + 5.2));
  LB.add(boxG(2.4, 0.5, 0.7), 'tanPlastic', M(0, lidTop - 1.2, lidFront - 0.2)); // latch tab
  LB.build(lid, {});
  // trim ring around the cup wells region and the rear of the console
  CB.add(softBox({ w: 10.0, h: 6.0, d: 4.5, r: 0.9, step: 2 }), 'tanPlastic', M(0, 30.4, 78.6));
  CB.build(con, { cast: false });
  // 12 V outlet on the rear face of the console (seen from the rear bench)
  const outlet = new THREE.Mesh(cylG(0.5, 0.5, 0.3, 18), MT.black); outlet.rotation.x = Math.PI / 2; outlet.position.set(0, 29.6, 80.9); con.add(outlet);
  anchors.console = con; anchors.consoleLid = lid;
  // lid interaction: lift
  let lidTarget = 0;
  lid.userData.interact = { prompt: 'Open console lid', run(ctx) { lidTarget = lidTarget ? 0 : 1; ctx.say?.(lidTarget ? 'Console open' : 'Console closed'); } };
  lid.userData.pivot = [0, lidTop - 0.8, lidFront + lidLen];

  // ---------------- rear bench ----------------
  const rear = new THREE.Group(); rear.name = 'seat_rear'; rear.userData.labelId = 'interior.seatRear'; seatsG.add(rear);
  const RB = new Batch(MT);
  {
    const W = 61.0, D = 20.5, H = 5.8, Cy = 29.6, Zc = 97.0; // bench cushion: z range 86.75 to 107.25? set below
    const front = 86.6;
    const cush = softBox({ w: W, h: H, d: D, r: 1.6, step: 1.8, stepZ: 1.8,
      deform: (p) => { const wgt = sm((p[1] + H / 2 - 0.2) / (H * 0.75)); const ax = Math.abs(p[0]);
        // three seating positions: outer bolsters and a gentle hump at each seam
        const seat = (cx) => Math.exp(-Math.pow((p[0] - cx) / 6.5, 2));
        const dish = -0.55 * (seat(-19) + seat(19)) * (1 - sm((Math.abs(p[2]) - 5) / 5));
        const edge = sm((ax - 25.5) / 4) * 1.1;
        const wf = -0.8 * sm((-p[2] - (D / 2 - 4)) / 3.5);
        p[1] += (dish + edge + wf) * wgt; } });
    RB.add(cush, 'leather', M(0, Cy, front + D / 2));
    // seam lines and stitching on the cushion (panels per seating position)
    for (const sx of [-10.3, 10.3]) { const l = []; for (let i = 0; i <= 26; i++) { const z = lerp(-8, 8.5, i / 26); l.push([sx, Cy + H / 2 + 0.06 + 0.0 - 0.0 * z, front + D / 2 + z]); } RB.add(stitchesG(l, { len: 0.18, gap: 0.1 }), 'thread'); }
    for (const sx of [-1, 1]) { const l = []; for (let i = 0; i <= 26; i++) { const z = lerp(-8, 8.5, i / 26); l.push([sx * 28.2, Cy + H / 2 + 0.7, front + D / 2 + z]); } RB.add(stitchesG(l, { len: 0.18, gap: 0.1 }), 'thread'); }
    // base box (plastic) below the cushion
    RB.add(softBox({ w: 57, h: 7.5, d: 18.5, r: 0.8, step: 4 }), 'tanPlastic', M(0, 25.7, front + 9.6));
    // seat back: 60/40 split, slightly reclined
    const Hb = 25.5, Db = 5.4; const lean = 0.26, pv = [0, 31.2, 106.0];
    const bm = M(pv[0], pv[1], pv[2], lean, 0, 0);
    const mB = (x, y, z) => bm.clone().multiply(M(x, y, z));
    for (const [cx, w] of [[-9.0, 42.0], [21.8, 17.5]]) {
      const bx = softBox({ w: w - 0.5, h: Hb, d: Db, r: 1.6, step: 1.5, stepY: 1.8,
        deform: (p) => { if (p[2] < 0) { const wgt = sm((-p[2] - 0.2) / (Db * 0.4)); let dd = 0; for (const c of [-19, 0, 19]) dd = Math.max(dd, Math.exp(-Math.pow((p[0] + cx - c) / 6.2, 2))); const edge = sm((Math.abs(p[0] + cx) - 25.5) / 4); p[2] += (0.3 * dd * (1 - sm((p[1] - Hb / 2 + 8) / 5)) - 1.0 * edge) * wgt; } } });
      RB.add(bx, 'leather', mB(cx, Hb / 2 - 0.5, 0.3));
    }
    // 60/40 split seam
    const splitX = 12.4;
    const ln = []; for (let i = 0; i <= 28; i++) ln.push(new THREE.Vector3(splitX, lerp(1.5, Hb - 2, i / 28), -Db / 2 + 0.2).applyMatrix4(bm).toArray());
    RB.add(stitchesG(ln, { len: 0.18, gap: 0.1, normals: () => [0, Math.sin(lean), -Math.cos(lean)] }), 'thread');
    // vertical panel stitching on the back: two lines per seating position
    for (const x of [-27.5, -19, -10.5, 10.5 + 5, 22.0, 28.0]) { const l = []; for (let i = 0; i <= 24; i++) l.push(new THREE.Vector3(x, lerp(2.0, Hb - 3, i / 24), -Db / 2 - 0.0).applyMatrix4(bm).toArray()); RB.add(stitchesG(l, { len: 0.18, gap: 0.1, normals: () => [0, Math.sin(lean), -Math.cos(lean)] }), 'thread'); }
    // three headrests: outer left, center (small), outer right
    for (const [x, w] of [[-19, 9.5], [0, 8.2], [19, 9.5]]) {
      RB.add(softBox({ w, h: 5.8, d: 3.6, r: 1.6, step: 1.2 }), 'leather', mB(x, Hb + 3.6, 0.4));
      for (const sx of [-1, 1]) RB.add(cylG(0.24, 0.24, 3.2, 10), 'steel', mB(x + sx * 2.3, Hb - 0.2, 0.4));
    }
  }
  RB.build(rear, { cast: false });
  // folding center armrest with two cupholders (down in the reference photos)
  const arm = new THREE.Group(); arm.name = 'rear_armrest'; arm.userData.labelId = 'interior.armrestRear'; rear.add(arm);
  {
    const AB = new Batch(MT); const L = 15.5;
    AB.add(softBox({ w: 15.5, h: 3.8, d: L, r: 1.4, step: 1.5 }), 'leather', M(0, 0, -L / 2 + 0.0));
    const sh = new THREE.Shape(); { const w = 14.4, h = 14.2, r = 1.4, x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); }
    for (const cx of [-3.6, 3.6]) { const p = new THREE.Path(); p.absarc(cx, 0.0, 1.75, 0, Math.PI * 2, true); sh.holes.push(p); }
    const plate = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false, curveSegments: 14 }); plate.rotateX(-Math.PI / 2);
    plate.computeVertexNormals(); AB.add(boxUV(plate), 'black', M(0, 2.0, -L / 2 - 0.1));
    for (const cx of [-3.6, 3.6]) AB.add(new THREE.CylinderGeometry(1.75, 1.6, 2.2, 22, 1, true), 'rubberMatBS', M(cx, 1.0, -L / 2 - 0.1));
    AB.build(arm, {});
  }
  // armrest pivot: hinged at the seat back, lower position: top surface at 39.6 in
  const armPivot = [0, 37.6, 105.6]; arm.position.set(...armPivot); arm.rotation.x = 0; // z length extends toward -z (forward)
  const hit = hitMesh(boxG(16, 5, 16)); hit.position.set(0, 0, -8); arm.add(hit);
  let armTarget = 0; arm.userData.interact = { prompt: 'Fold rear armrest', run(ctx) { armTarget = armTarget ? 0 : 1; ctx.say?.(armTarget ? 'Armrest up' : 'Armrest down'); } };
  anchors.rearArmrest = arm;

  const update = (dt) => {
    arm.rotation.x += ((armTarget ? -1.35 : 0) - arm.rotation.x) * (1 - Math.exp(-dt / 0.12));
    const l = lid.rotation.x; const target = lidTarget ? -1.15 : 0; const nv = l + (target - l) * (1 - Math.exp(-dt / 0.12));
    const pv = lid.userData.pivot; lid.position.set(0, 0, 0); // rotate about the rear hinge: translate to pivot
    lid.rotation.x = nv; const c = Math.cos(nv), s = Math.sin(nv);
    lid.position.set(0, pv[1] - (pv[1] * c - pv[2] * s) + 0, pv[2] - (pv[1] * s + pv[2] * c));
  };
  return { anchors: {}, update };
}
