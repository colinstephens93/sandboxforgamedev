// Dyno control stand (rolling desk, monitor with a live canvas, computer, keyboard, e-stop, throttle/load panel, cables
// to the pit) and the weather station beside it.
import * as THREE from 'three';
import { aabb } from '../../core/geom.js';
import { makeCanvas } from '../../core/proc.js';
import { Batch, mx, cyl, mbox, instanced, mesh, tubeThrough } from './util.js';
import { formatAir, PIT } from './logic.js';
import { PIT_BOX } from './pit.js';

export const STAND_POS = { x: -3.2, z: 2.4 };
export const WEATHER_POS = { x: -2.55, z: 3.75 };
const DESK_H = 0.92;

function consoleTexture() {
  const c = makeCanvas(512, 320), g = c.getContext('2d');
  g.fillStyle = '#20252a'; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = '#e6e6e0'; g.lineWidth = 3; g.fillStyle = '#e6e6e0'; g.font = 'bold 22px Arial, sans-serif'; g.textAlign = 'center';
  g.strokeRect(14, 14, 484, 292);
  g.fillText('LOAD', 150, 60); g.fillText('THROTTLE', 330, 60); g.fillText('EMERGENCY', 410, 244); g.fillText('STOP', 410, 270);
  g.font = 'bold 16px Arial, sans-serif';
  g.fillText('START', 60, 250); g.fillText('ABORT', 130, 250); g.fillText('HOLD', 200, 250);
  for (let i = 0; i <= 10; i++) { const a = -2.3 + (i / 10) * 4.6 * 0.5 + 0; g.beginPath(); g.moveTo(150 + Math.sin(a) * 66, 140 - Math.cos(a) * 66); g.lineTo(150 + Math.sin(a) * 76, 140 - Math.cos(a) * 76); g.stroke(); }
  g.textAlign = 'left'; g.font = '14px Arial, sans-serif';
  g.fillText('0', 292, 270); g.fillText('100 %', 296, 90);
  g.fillStyle = '#d9a400'; g.fillRect(360, 120, 100, 100); g.fillStyle = '#20252a'; g.fillRect(366, 126, 88, 88);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ----- the live screen shared with the integrator -----
function makeScreen() {
  const canvas = makeCanvas(1280, 720), ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return { canvas, ctx, texture, autoDraw: true };
}
export function drawPlaceholder(screen, st) {
  const { ctx, canvas } = screen, W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#071018'; ctx.fillRect(0, 0, W, H);
  // graph grid
  ctx.strokeStyle = 'rgba(80,140,170,0.25)'; ctx.lineWidth = 1;
  for (let x = 80; x < W - 40; x += 100) { ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, H - 90); ctx.stroke(); }
  for (let y = 120; y < H - 90; y += 70) { ctx.beginPath(); ctx.moveTo(80, y); ctx.lineTo(W - 40, y); ctx.stroke(); }
  ctx.fillStyle = '#12303f'; ctx.fillRect(0, 0, W, 84);
  ctx.fillStyle = '#9fe3ff'; ctx.font = 'bold 40px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.fillText('CHASSIS DYNO', 30, 56);
  ctx.textAlign = 'right'; ctx.fillStyle = '#7fb4c8'; ctx.font = '28px "Courier New", monospace';
  const run = st && st.run;
  ctx.fillText(run && run.phase ? String(run.phase).toUpperCase() : 'IDLE', W - 30, 54);
  ctx.textAlign = 'center'; ctx.fillStyle = '#4de0a0'; ctx.font = 'bold 96px "Courier New", monospace';
  ctx.fillText('DYNO READY', W / 2, H / 2 + 30);
  ctx.font = '30px "Courier New", monospace'; ctx.fillStyle = '#7fb4c8';
  const rpm = run && Number.isFinite(run.rpm) ? Math.round(run.rpm) : 0;
  const hp = run && Number.isFinite(run.hp) ? run.hp.toFixed(0) : '--', tq = run && Number.isFinite(run.tq) ? run.tq.toFixed(0) : '--';
  ctx.fillText(`ENGINE ${rpm} RPM    WHEEL ${hp} HP    ${tq} LB-FT`, W / 2, H - 40);
  screen.texture.needsUpdate = true;
}

function keyboard(B, M) {
  B.add(new THREE.BoxGeometry(0.44, 0.016, 0.15), M.plasticBlack, mx(0, 0.008, 0));
  const keys = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) keys.push(mx(-0.2 + c * 0.0283, 0.0185, -0.054 + r * 0.0245));
  return keys;
}

export function buildStand(M, quality) {
  const root = new THREE.Group(); root.name = 'dyno_stand_root';
  const stand = new THREE.Group(); stand.name = 'dyno_stand'; stand.userData.labelId = 'dyno.stand';
  stand.position.set(STAND_POS.x, 0, STAND_POS.z); stand.rotation.y = -Math.PI / 2; // operator side (local +Z) faces -X
  root.add(stand);
  const B = new Batch();
  const colliders = [];

  // ---------------- desk frame ----------------
  const hw = 0.56, hd = 0.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.add(mbox(0.04, DESK_H - 0.12, 0.04), M.steelDark, mx(sx * hw, 0.1 + (DESK_H - 0.12) / 2, sz * hd));
    B.add(mbox(0.1, 0.012, 0.1), M.steelRaw, mx(sx * hw, 0.105, sz * hd));
    B.add(mbox(0.012, 0.075, 0.07), M.steelRaw, mx(sx * hw - 0.032, 0.06, sz * hd)); B.add(mbox(0.012, 0.075, 0.07), M.steelRaw, mx(sx * hw + 0.032, 0.06, sz * hd));
    B.add(cyl(0.05, 0.036, 'x', 16), M.rubber, mx(sx * hw, 0.05, sz * hd));
    B.add(cyl(0.022, 0.04, 'x', 10), M.steelMachined, mx(sx * hw, 0.05, sz * hd));
  }
  B.add(mbox(1.22, 0.04, 0.68), M.plasticBlack, mx(0, DESK_H - 0.02, 0));                          // work surface
  B.add(mbox(1.24, 0.008, 0.7), M.steelRaw, mx(0, DESK_H - 0.042, 0));                             // steel edge band under
  B.add(mbox(1.2, 0.012, 0.012), M.steelRaw, mx(0, DESK_H + 0.001, 0.34));                         // front edge strip
  B.add(mbox(1.12, 0.022, 0.6), M.steelDark, mx(0, 0.2, 0));                                        // lower shelf
  B.add(mbox(1.12, 0.04, 0.012), M.steelDark, mx(0, 0.24, 0.3)); B.add(mbox(1.12, 0.04, 0.012), M.steelDark, mx(0, 0.24, -0.3));
  for (const sz of [-1, 1]) B.add(mbox(1.12, 0.04, 0.04), M.steelDark, mx(0, DESK_H - 0.09, sz * hd)); // top rails
  for (const sx of [-1, 1]) B.add(mbox(0.04, 0.04, 0.6), M.steelDark, mx(sx * hw, DESK_H - 0.09, 0));
  // pull-out handle on the pit side
  B.add(cyl(0.012, 0.9, 'x', 8), M.zinc, mx(0, DESK_H - 0.02, -0.4)); B.add(cyl(0.01, 0.06, 'z', 8), M.zinc, mx(-0.42, DESK_H - 0.02, -0.37)); B.add(cyl(0.01, 0.06, 'z', 8), M.zinc, mx(0.42, DESK_H - 0.02, -0.37));

  // ---------------- computer tower on the shelf ----------------
  B.add(mbox(0.21, 0.44, 0.46), M.plasticBlack, mx(-0.34, 0.211 + 0.22, 0.02));
  B.add(mbox(0.19, 0.3, 0.004), M.plasticGrey, mx(-0.34, 0.22 + 0.27, 0.256));                      // mesh front
  B.add(mbox(0.12, 0.012, 0.004), M.steelMachined, mx(-0.34, 0.211 + 0.17, 0.254));               // drive bay
  B.add(cyl(0.012, 0.01, 'z', 12), M.steelMachined, mx(-0.34, 0.211 + 0.4, 0.256));              // power button

  // ---------------- keyboard and mouse ----------------
  const kbGroup = new THREE.Group(); kbGroup.position.set(-0.2, DESK_H, 0.17); kbGroup.rotation.x = 0;
  const kb = new Batch(); const keys = keyboard(kb, M); kb.build(kbGroup, { name: 'kb' });
  kbGroup.add(instanced(new THREE.BoxGeometry(0.024, 0.008, 0.021), M.plasticGrey, keys));
  stand.add(kbGroup);
  B.add(new THREE.CapsuleGeometry(0.03, 0.04, 4, 10).rotateX(Math.PI / 2), M.plasticBlack, mx(0.06, DESK_H + 0.014, 0.17, 0, 0, 0, 1, 0.55, 1));

  // ---------------- monitor on an arm ----------------
  const SCR_W = 0.7, SCR_H = 0.394;
  const monY = DESK_H + 0.62, monZ = -0.08;
  B.add(cyl(0.025, 0.012, 'y', 18), M.steelDark, mx(0, DESK_H + 0.006, -0.2));
  B.add(cyl(0.017, 0.46, 'y', 12), M.steelDark, mx(0, DESK_H + 0.23, -0.2));
  B.add(mbox(0.05, 0.05, 0.18), M.steelDark, mx(0, monY - 0.03, -0.14));
  B.add(mbox(SCR_W + 0.03, SCR_H + 0.03, 0.04), M.plasticBlack, mx(0, monY, monZ));
  B.add(mbox(0.2, 0.18, 0.025), M.plasticGrey, mx(0, monY, monZ - 0.03));
  B.add(mbox(0.07, 0.006, 0.01), M.ledGreen, mx(0.3, monY - SCR_H / 2 - 0.004, monZ + 0.022));
  const screen = makeScreen();
  drawPlaceholder(screen, null);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1, 1, 1), emissiveMap: screen.texture, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0, envMapIntensity: 0.6 });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), screenMat);
  screenMesh.position.set(0, monY, monZ + 0.0205); screenMesh.name = 'dyno_screen'; stand.add(screenMesh);

  // ---------------- operator console (load, throttle, e-stop) ----------------
  const cons = new THREE.Group(); cons.position.set(0.36, DESK_H + 0.07, 0.1); cons.rotation.x = 0.32; stand.add(cons);
  {
    const cb = new Batch();
    cb.add(mbox(0.42, 0.14, 0.3), M.steelDark, mx(0, 0, 0));
    cb.build(cons, { name: 'cons' });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.28), new THREE.MeshStandardMaterial({ map: consoleTexture(), roughness: 0.6, metalness: 0.1 }));
    panel.rotation.x = -Math.PI / 2; panel.position.y = 0.0705; cons.add(panel);
    const cc = new Batch();
    // emergency stop: yellow collar, red mushroom, in the yellow square
    const ex = 0.4 * (400 / 512 - 0.5) + 0.0, ez = 0.28 * (170 / 320 - 0.5);
    cc.add(cyl(0.032, 0.02, 'y', 24), M.safetyYellow, mx(ex, 0.08, ez));
    cc.add(cyl(0.012, 0.024, 'y', 12), M.steelDark, mx(ex, 0.098, ez));
    cc.add(new THREE.SphereGeometry(0.03, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1), M.safetyRed, mx(ex, 0.108, ez));
    // push buttons
    [[60, M.ledGreen], [130, M.ledRed], [200, M.safetyYellow]].forEach(([px, m]) => cc.add(cyl(0.012, 0.014, 'y', 14), m, mx(0.4 * (px / 512 - 0.5), 0.078, 0.28 * (222 / 320 - 0.5))));
    // load knob (rotary)
    const kx = 0.4 * (150 / 512 - 0.5), kz = 0.28 * (140 / 320 - 0.5);
    cc.add(cyl(0.026, 0.026, 'y', 24), M.plasticBlack, mx(kx, 0.083, kz));
    cc.add(cyl(0.022, 0.004, 'y', 24), M.steelMachined, mx(kx, 0.098, kz));
    cc.add(mbox(0.004, 0.003, 0.02), M.paintWhite, mx(kx, 0.101, kz - 0.01, 0, 0.5, 0));
    // throttle fader: slot, cap
    const fx = 0.4 * (330 / 512 - 0.5), fz = 0.28 * (170 / 320 - 0.5);
    cc.add(mbox(0.008, 0.002, 0.15), M.plasticBlack, mx(fx, 0.0715, fz));
    cc.add(mbox(0.026, 0.016, 0.02), M.plasticBlack, mx(fx, 0.08, fz + 0.03));
    cc.add(mbox(0.026, 0.002, 0.003), M.paintWhite, mx(fx, 0.089, fz + 0.03));
    cc.build(cons, { name: 'ctl' });
    // LED bar
    const bar = [];
    for (let i = 0; i < 10; i++) bar.push(mx(0.4 * (292 / 512 - 0.5) + 0.02, 0.0735, 0.09 - i * 0.017));
    cons.add(instanced(new THREE.BoxGeometry(0.01, 0.004, 0.011), M.ledGreen, bar));
  }

  B.build(stand, { cast: true, name: 'standbatch' });

  // ---------------- cables from the tower to the pit (world frame) ----------------
  const cx = STAND_POS.x, cz0 = STAND_POS.z;
  const cableZ = PIT.cz - PIT.hl + 0.356; // z at which the bundle crosses the pit edge (pit north half)
  const mats = [M.cable, M.cableGrey, new THREE.MeshStandardMaterial({ color: 0x1c4f9d, roughness: 0.5 })];
  mats.forEach((m, k) => {
    const o = (k - 1) * 0.013;
    const pts = [
      [cx + 0.3, 0.32, cz0 - 0.34 + o], [cx + 0.34, 0.12, cz0 - 0.3 + o], [cx + 0.42, 0.012, cz0 - 0.25 + o * 1.5], [cx + 0.8, 0.012, cz0 - 0.15 + o * 2],
      [-2.5, 0.012, cableZ + 0.1 + o * 1.5], [-2.2, 0.012, cableZ + o], [-1.95, 0.013, cableZ + o], [-1.82, 0.021, cableZ + o], [-1.762, 0.021, cableZ + o], [-1.738, 0.0, cableZ + o],
      [-1.73, -0.2, cableZ + o], [-1.72, -0.5, cableZ + o * 0.7], [-1.55, -0.52, cableZ - 0.06], [PIT_BOX.x + 0.18, PIT_BOX.y - 0.1, PIT.cz - PIT.hl + 0.24],
    ];
    const g = tubeThrough(pts, 0.0085, { seg: 90, radial: 7, tension: 0.4 });
    const m1 = new THREE.Mesh(g, m); m1.castShadow = false; root.add(m1);
  });
  // rubber cable protector where the bundle crosses the hazard band
  {
    const pg = new THREE.Group(); pg.position.set(-2.07, 0, cableZ);
    pg.add(mesh(new THREE.BoxGeometry(0.34, 0.019, 0.17), M.safetyYellow, 0, 0.0095, 0, { cast: false }));
    for (const s of [-1, 1]) pg.add(mesh(new THREE.BoxGeometry(0.04, 0.012, 0.17), M.safetyYellow, s * 0.19, 0.006, 0, { cast: false }));
    for (const k of [-1, 0, 1]) pg.add(mesh(new THREE.BoxGeometry(0.34, 0.003, 0.02), M.plasticBlack, 0, 0.0205, k * 0.045, { cast: false }));
    root.add(pg);
  }

  colliders.push(aabb(STAND_POS.x, 0.78, STAND_POS.z, 0.37, 0.78, 0.62));
  return { group: root, stand, colliders, screen, screenMat, drawPlaceholder };
}

// ---------------- weather station ----------------
export function buildWeather(M) {
  const g = new THREE.Group(); g.name = 'dyno_weather'; g.userData.labelId = 'dyno.weather';
  g.position.set(WEATHER_POS.x, 0, WEATHER_POS.z);
  g.rotation.y = Math.atan2(-1.2, -1.35); // display faces the control stand / operator
  const B = new Batch();
  // tripod
  B.add(cyl(0.02, 1.5, 'y', 12), M.steelMachined, mx(0, 0.95, 0));
  B.add(cyl(0.028, 0.5, 'y', 12), M.steelDark, mx(0, 0.5, 0));
  B.add(cyl(0.04, 0.08, 'y', 16), M.castGrey, mx(0, 0.5, 0));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4, r = 0.36, ty = 0.5;
    const len = Math.hypot(r, ty), mid = [Math.cos(a) * r / 2, ty / 2, Math.sin(a) * r / 2];
    const dir = new THREE.Vector3(Math.cos(a) * r, -ty, Math.sin(a) * r).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...mid), q, new THREE.Vector3(1, 1, 1));
    B.add(new THREE.CylinderGeometry(0.014, 0.014, len, 8), M.steelDark, m);
    B.add(cyl(0.028, 0.016, 'y', 10), M.rubber, mx(Math.cos(a) * r, 0.008, Math.sin(a) * r));
  }
  // radiation shield (stack of louvered plates) with the temperature/humidity element
  const plates = [];
  for (let i = 0; i < 9; i++) plates.push(mx(0, 1.52 + i * 0.016, 0));
  g.add(instanced(new THREE.CylinderGeometry(0.052, 0.07, 0.008, 24), M.plasticWhite, plates, { cast: true }));
  B.add(cyl(0.02, 0.17, 'y', 10), M.plasticGrey, mx(0, 1.52 + 0.08, 0));
  B.add(cyl(0.056, 0.012, 'y', 24), M.plasticWhite, mx(0, 1.67, 0));
  // barometer enclosure with a vent port, and a hygro-thermo probe on a side arm
  B.add(mbox(0.12, 0.09, 0.05), M.plasticGrey, mx(0, 1.36, 0.05));
  B.add(cyl(0.007, 0.012, 'z', 8), M.plasticBlack, mx(0.03, 1.36, 0.08));
  B.add(cyl(0.011, 0.14, 'x', 10), M.plasticWhite, mx(0.1, 1.42, 0.0));
  B.add(cyl(0.013, 0.04, 'x', 10), M.cableGrey, mx(0.19, 1.42, 0.0));
  // display unit
  const disp = new THREE.Group(); disp.position.set(0, 1.12, 0.05); disp.rotation.x = -0.25; g.add(disp);
  B.add(mbox(0.3, 0.15, 0.045), M.plasticBlack, mx(0, 1.12, 0.05, -0.25, 0, 0));
  B.add(mbox(0.04, 0.12, 0.05), M.steelDark, mx(0, 1.12, 0.0));
  B.build(g, { cast: true, name: 'wx' });
  const canvas = makeCanvas(512, 256), cx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.12), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1, 1, 1), emissiveMap: tex, emissiveIntensity: 1.0, roughness: 0.3 }));
  lcd.position.set(0, 0, 0.0235); disp.add(lcd);
  let last = '';
  function draw(air) {
    const key = formatAir(air);
    if (key === last) return;
    last = key;
    cx.fillStyle = '#c2d0b4'; cx.fillRect(0, 0, 512, 256);
    cx.fillStyle = '#17210f'; cx.textAlign = 'left'; cx.font = 'bold 66px "Courier New", monospace';
    const t = air && Number.isFinite(air.tempC) ? air.tempC.toFixed(1) : '--', p = air && Number.isFinite(air.pressureKpa) ? air.pressureKpa.toFixed(1) : '--', h = air && Number.isFinite(air.humidityPct) ? Math.round(air.humidityPct) : '--';
    cx.fillText(`${t} C`, 22, 84); cx.fillText(`${h} % RH`, 22, 238);
    cx.font = 'bold 66px "Courier New", monospace'; cx.fillText(`${p} kPa`, 22, 161);
    cx.font = 'bold 22px "Courier New", monospace'; cx.textAlign = 'right'; cx.fillText('TEMP', 498, 34); cx.fillText('BARO', 498, 112); cx.fillText('HUMID', 498, 190);
    tex.needsUpdate = true;
  }
  draw(null);
  const colliders = [aabb(WEATHER_POS.x, 0.8, WEATHER_POS.z, 0.34, 0.8, 0.34)];
  return { group: g, colliders, draw };
}
