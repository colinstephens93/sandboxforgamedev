// Office interior (the walls and glazing come from shell.js): steel desk with a pedestal, office chair, the shop
// computer (monitor with a generated shop-management screen, tower, keyboard), a four-drawer filing cabinet,
// a laser printer on a stand, a wall calendar, a clock and a ceiling troffer that follows the shop light switch.
import { THREE, Part, interactive, label, canvasMaterial, makeCanvas, tex, rng } from './common.js';
import { shopScreenCanvas, calendarCanvas, font, rr } from './art.js';
import { foot } from './plan.js';
import { ZONES } from '../layout.js';

function keyboardCanvas() {
  const w = 256, h = 96, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#16181b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a2d32';
  for (let row = 0; row < 5; row++) for (let i = 0; i < 15; i++) { const x = 6 + i * 16.2, y = 6 + row * 16.6; const wide = (row === 4 && i > 3 && i < 11); if (wide && i !== 4) continue; rr(g, x, y, wide ? 16.2 * 7 - 2 : 14.4, 14, 2); g.fill(); }
  return c;
}

function clockCanvas() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#f2f1ea'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.sin(a) * 52, 64 - Math.cos(a) * 52); g.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(0.7) * 30, 64 - Math.cos(0.7) * 30); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(3.3) * 46, 64 - Math.cos(3.3) * 46); g.stroke();
  return c;
}

function whiteboardCanvas() {
  const w = 512, h = 384, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#f6f7f5'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1b4f9c'; g.lineWidth = 3; g.fillStyle = '#1b4f9c'; g.font = font(30); g.textAlign = 'left';
  g.fillText('DYNO / BAY SCHEDULE', 24, 46);
  g.beginPath(); g.moveTo(24, 58); g.lineTo(w - 24, 58); g.stroke();
  g.font = font(22, 'normal'); g.fillStyle = '#222';
  ['TUE  8:30  2005 Silverado LLY - baseline', 'TUE 11:00  Ram 3500 - EGR cooler', 'WED  9:00  F-250 - injector balance', 'THU  8:30  Silverado - tune pull', 'THU  2:00  LML oil + fuel filters'].forEach((t, i) => g.fillText(t, 24, 98 + i * 40));
  g.fillStyle = '#c41820'; g.font = font(22); g.fillText('PARTS ORDER BY NOON', 24, 330);
  g.strokeStyle = '#2d7a4a'; g.lineWidth = 4; g.beginPath(); g.moveTo(330, 318); g.lineTo(350, 338); g.lineTo(390, 296); g.stroke();
  return c;
}

export function buildOffice(ctx) {
  const { M, group, quality, shop, anchors, interactables, updaters } = ctx;
  const O = new THREE.Group(); O.name = 'officeFurniture';
  const laminate = M.virt('plastic', 0x4d4034);
  const cabGray = M.virt('steel', 0x8e9498);
  const P = new Part();
  const d = foot('office.desk');
  // ---- desk: top, modesty panel, pedestal on the south end, legs on the north end (desk runs along z) ----
  const dx = d.x, dz = d.z, L = d.hz * 2, D = d.hx * 2, TH = 0.74;
  P.box(laminate, D, 0.03, L, dx, TH - 0.015, dz, { r: 0.004 });
  P.box(M.darkSteel, D - 0.06, 0.05, 0.04, dx - 0.0, TH - 0.055, dz - L / 2 + 0.05);
  P.box(laminate, 0.02, 0.4, L - 0.55, dx + D / 2 - 0.02, TH - 0.25, dz - 0.27);       // modesty panel at the wall side
  P.box(M.darkSteel, 0.05, TH - 0.03, 0.05, dx - D / 2 + 0.05, (TH - 0.03) / 2, dz - L / 2 + 0.06);        // legs
  P.box(M.darkSteel, 0.05, TH - 0.03, 0.05, dx + D / 2 - 0.05, (TH - 0.03) / 2, dz - L / 2 + 0.06);
  const pz = dz + L / 2 - 0.25;                                                          // pedestal (3 drawers)
  P.box(cabGray, D - 0.06, 0.66, 0.46, dx, 0.35, pz, { r: 0.006 });
  for (let i = 0; i < 3; i++) {
    P.box(M.lightSteel, 0.012, 0.2, 0.42, dx - D / 2 + 0.03, 0.17 + i * 0.22, pz, { r: 0.003 });
    P.box(M.chrome, 0.014, 0.012, 0.18, dx - D / 2 + 0.014, 0.25 + i * 0.22, pz);
  }
  // ---- on the desk ----
  const topY = TH;
  P.box(M.black, 0.16, 0.05, 0.22, dx + 0.1, topY + 0.025, dz + 0.45, { r: 0.01 });      // desk phone
  P.box(M.paper, 0.22, 0.04, 0.3, dx - 0.12, topY + 0.02, dz + 0.66, { r: 0.002, ry: 0.15 });  // paper stack
  P.cyl(M.whitePlastic, 0.04, 0.09, dx - 0.2, topY + 0.045, dz - 0.62, { seg: 12 });     // mug
  P.cyl(M.red, 0.04, 0.012, dx - 0.2, topY + 0.09, dz - 0.62, { seg: 12 });
  const deskG = new THREE.Group(); deskG.name = 'desk'; P.build(deskG, { cast: false }); label(deskG, 'shop.desk'); O.add(deskG);
  const compG = new THREE.Group(); compG.name = 'shopComputerParts'; O.add(compG);
  const Q = new Part();
  Q.box(M.black, 0.2, 0.012, 0.2, dx - 0.05, topY + 0.006, dz - 0.1, { r: 0.004 });      // monitor base
  Q.box(M.black, 0.04, 0.2, 0.03, dx - 0.05, topY + 0.1, dz - 0.1);                      // neck
  Q.box(M.black, 0.03, 0.33, 0.56, dx - 0.05, topY + 0.38, dz - 0.1, { r: 0.008 });      // bezel/body
  Q.box(M.keyboard || M.black, 0.15, 0.018, 0.44, dx - 0.5 + 0.08, topY + 0.009, dz - 0.1, { r: 0.006 });
  Q.box(M.black, 0.05, 0.024, 0.08, dx - 0.5 + 0.14, topY + 0.012, dz + 0.25, { r: 0.012 });       // mouse
  // tower under the desk
  Q.box(M.black, 0.45, 0.42, 0.2, dx + 0.0, 0.21, dz - 0.45, { r: 0.012 });
  Q.box(M.darkSteel, 0.01, 0.38, 0.17, dx - 0.226, 0.21, dz - 0.45);
  Q.cyl(M.ledGreen, 0.004, 0.004, dx - 0.232, 0.32, dz - 0.43, { axis: 'x', seg: 6 });
  Q.build(compG, { cast: false });

  // the monitor screen plane (facing the chair, -x)
  const scrMat = canvasMaterial(shopScreenCanvas(quality.tex), { roughness: 0.25, emissive: 0.9 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.31), scrMat);
  screen.rotation.y = -Math.PI / 2; screen.position.set(dx - 0.05 - 0.016, topY + 0.38, dz - 0.1); screen.name = 'shopComputerScreen'; compG.add(screen);
  // keyboard keys
  const kbMat = canvasMaterial(keyboardCanvas(), { roughness: 0.5 });
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.44), kbMat); kb.rotation.x = -Math.PI / 2; kb.rotation.z = -Math.PI / 2; kb.position.set(dx - 0.5 + 0.08, topY + 0.019, dz - 0.1);
  kb.rotation.set(-Math.PI / 2, 0, Math.PI / 2); compG.add(kb);
  const pc = new THREE.Object3D(); pc.name = 'shopComputer'; pc.position.copy(screen.position); pc.rotation.y = -Math.PI / 2; O.add(pc);
  pc.userData.screenMesh = screen; pc.userData.screenMaterial = scrMat;
  anchors.shopComputer = pc;
  label(compG, 'shop.computer');
  interactive(compG, 'Look at the shop computer', (c) => c?.say?.('Shop manager: work order 10452, 2005 Silverado 2500HD, dyno baseline + tune.'));
  interactables.push(compG);

  // ---- chair ----
  const ch = foot('office.chair');
  const C = new Part(); const cg = new THREE.Group(); cg.position.set(ch.x, 0, ch.z); cg.rotation.y = Math.PI / 2 * 1 + 0.18; // faces the desk (+x)
  const seatY = 0.5;
  C.box(M.fabric, 0.5, 0.07, 0.48, 0, seatY, 0, { r: 0.03, seg: 3 });
  C.box(M.fabric, 0.46, 0.5, 0.07, 0, seatY + 0.32, -0.25, { r: 0.03, rx: -0.12, seg: 3 });
  C.box(M.black, 0.1, 0.3, 0.05, 0, seatY + 0.13, -0.2);
  C.cyl(M.chrome, 0.025, 0.3, 0, seatY - 0.2, 0, { seg: 10 });
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; C.box(M.black, 0.05, 0.03, 0.3, Math.sin(a) * 0.15, 0.09, Math.cos(a) * 0.15, { ry: a }); C.sph(M.black, 0.03, Math.sin(a) * 0.3, 0.035, Math.cos(a) * 0.3, { seg: 8 }); }
  for (const s of [-1, 1]) { C.box(M.black, 0.04, 0.02, 0.26, s * 0.27, seatY + 0.22, -0.02); C.box(M.black, 0.03, 0.2, 0.03, s * 0.27, seatY + 0.12, 0.05); }
  C.build(cg, { cast: false }); label(cg, 'shop.officeChair'); O.add(cg);

  // ---- filing cabinet ----
  const f = foot('office.cabinet');
  const F = new Part(); const fg = new THREE.Group(); fg.position.set(f.x, 0, f.z); fg.rotation.y = -Math.PI / 2;   // front toward the room (-x)
  const fw = f.hz * 2, fd = f.hx * 2, fh = f.h;
  F.box(cabGray, fw, fh, fd, 0, fh / 2, 0, { r: 0.008 });
  for (let i = 0; i < 4; i++) {
    const y = 0.2 + i * 0.3;
    F.box(M.lightSteel, fw - 0.04, 0.27, 0.014, 0, y + 0.0, fd / 2 + 0.002, { r: 0.004 });
    F.box(M.chrome, 0.16, 0.022, 0.02, 0, y + 0.09, fd / 2 + 0.015);
    F.box(M.paper, 0.1, 0.04, 0.003, 0, y - 0.02, fd / 2 + 0.011);
  }
  F.cyl(M.chrome, 0.011, 0.01, fw / 2 - 0.05, fh - 0.06, fd / 2 + 0.01, { axis: 'z', seg: 10 });
  F.build(fg, { cast: false }); label(fg, 'shop.filingCabinet'); O.add(fg);
  // coffee maker on the cabinet
  const cm = new Part(); cm.box(M.black, 0.2, 0.3, 0.2, 0, 0.15, 0, { r: 0.015 }); cm.cyl(M.glass, 0.07, 0.15, 0, 0.1, 0.0, { seg: 12 }); cm.box(M.red, 0.03, 0.02, 0.03, 0.06, 0.28, 0.101);
  const cmg = new THREE.Group(); cm.build(cmg); cmg.position.set(f.x, fh, f.z); O.add(cmg);

  // ---- printer on a stand ----
  const pr = foot('office.printer');
  const R = new Part(); const rg = new THREE.Group(); rg.position.set(pr.x, 0, pr.z); rg.rotation.y = -Math.PI / 2;
  R.box(M.black, 0.5, 0.62, 0.52, 0, 0.31, 0, { r: 0.01 });
  R.box(M.darkSteel, 0.46, 0.02, 0.02, 0, 0.3, 0.261);
  R.box(M.grayPlastic, 0.46, 0.27, 0.4, 0, 0.62 + 0.135, 0, { r: 0.015 });
  R.box(M.whitePlastic, 0.46, 0.04, 0.4, 0, 0.62 + 0.29, 0, { r: 0.01 });
  R.box(M.black, 0.34, 0.02, 0.18, 0, 0.62 + 0.18, 0.2);                                  // output tray
  R.box(M.paper, 0.3, 0.012, 0.2, 0, 0.62 + 0.195, 0.2);
  R.box(M.black, 0.12, 0.05, 0.03, 0.14, 0.62 + 0.23, 0.2, { rx: -0.5 });                  // panel
  R.box(M.ledGreen, 0.01, 0.01, 0.004, 0.18, 0.62 + 0.24, 0.215);
  R.build(rg, { cast: false }); label(rg, 'shop.printer'); O.add(rg);

  // ---- wall calendar and clock on the inside faces of the office walls ----
  {
    const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.45), canvasMaterial(calendarCanvas(), { roughness: 0.7 }));
    cal.position.set(6.46 + 0.004, 1.5, 7.6); cal.rotation.y = Math.PI / 2; cal.receiveShadow = true; O.add(cal);
    const cp = new Part(); cp.box(M.red, 0.01, 0.03, 0.12, 6.46 + 0.003, 1.74 + 0.0, 7.6); const cpg = new THREE.Group(); cp.build(cpg); O.add(cpg);
    const calg = new THREE.Group(); calg.userData.labelId = 'shop.calendar'; calg.add(cal); O.add(calg);
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.15, 28), canvasMaterial(clockCanvas(), { roughness: 0.5 }));
    clock.position.set(9.2, 2.15, 8.985); clock.rotation.y = Math.PI; O.add(clock);
    const ring = new Part(); ring.torus(M.black, 0.15, 0.012, 9.2, 2.15, 8.985, { axis: 'z', seg: 28, rseg: 6 }); const rgp = new THREE.Group(); ring.build(rgp); O.add(rgp);
    const clg = new THREE.Group(); clg.userData.labelId = 'shop.clock'; clg.add(clock, rgp); O.add(clg);
  }
  // ---- whiteboard on the south wall, visitor chair ----
  {
    const wbm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), canvasMaterial(whiteboardCanvas(), { roughness: 0.25 }));
    wbm.position.set(8.4, 1.75, 8.994); wbm.rotation.y = Math.PI; wbm.receiveShadow = true;
    const wf = new Part();
    wf.box(M.lightSteel, 1.24, 0.03, 0.02, 8.4, 2.21, 8.99); wf.box(M.lightSteel, 1.24, 0.03, 0.02, 8.4, 1.29, 8.99);
    wf.box(M.lightSteel, 0.03, 0.96, 0.02, 7.79, 1.75, 8.99); wf.box(M.lightSteel, 0.03, 0.96, 0.02, 9.01, 1.75, 8.99);
    wf.box(M.lightSteel, 0.5, 0.025, 0.07, 8.4, 1.28, 8.95);
    wf.box(M.blue, 0.012, 0.012, 0.12, 8.2, 1.3, 8.95, { ry: 1.4 }); wf.box(M.red, 0.012, 0.012, 0.12, 8.28, 1.3, 8.95, { ry: 1.6 });
    const wg = new THREE.Group(); wg.userData.labelId = 'shop.whiteboard'; wg.add(wbm); wf.build(wg); O.add(wg);
    const vc = new Part(); const vg = new THREE.Group(); vg.position.set(7.9, 0, 4.5); vg.rotation.y = 2.6;
    vc.box(M.blue, 0.42, 0.04, 0.4, 0, 0.45, 0, { r: 0.012 }); vc.box(M.blue, 0.4, 0.34, 0.035, 0, 0.66, -0.19, { r: 0.012, rx: -0.1 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) vc.box(M.darkSteel, 0.03, 0.43, 0.03, sx * 0.18, 0.215, sz * 0.17);
    vc.build(vg, { cast: false }); label(vg, 'shop.visitorChair'); O.add(vg);
  }
  // ---- rug and wastebasket ----
  {
    const rb = new Part(); rb.box(M.virt('plastic', 0x3b4655), 1.5, 0.006, 1.8, 10.75, 0.015, 5.5);
    rb.cyl(M.black, 0.14, 0.3, 11.1, 0.15, 7.3, { seg: 14, r2: 0.12 });
    const rbg = new THREE.Group(); rb.build(rbg); O.add(rbg);
  }
  // ---- ceiling troffer: follows the shop light switch ----
  const oz = ZONES.office;
  const tro = new Part();
  tro.box(M.darkSteel, 0.62, 0.05, 1.22, oz.x, 2.675, oz.z, { r: 0.004 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1, 0.98, 0.92), emissiveIntensity: 4.5, roughness: 0.5 });
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.01, 1.16), lensMat); lens.position.set(oz.x, 2.648, oz.z);
  const troG = new THREE.Group(); troG.add(lens); tro.build(troG, {}); label(troG, 'shop.officeLight'); O.add(troG);
  const pl = new THREE.PointLight(0xfff1de, 9, 7.5, 1.6); pl.position.set(oz.x - 0.2, 2.35, oz.z); O.add(pl);
  updaters.push(() => { const on = shop?.lights?.on !== false; lensMat.emissiveIntensity = on ? 4.5 : 0.0; pl.intensity = on ? 9 : 0; scrMat.emissiveIntensity = 0.9; });
  group.add(O);
  return O;
}
