// The AI Live hardware: a rolling laptop cart with a rugged laptop and an OBD-II interface on a cable, and a 12 V shop battery
// charger with clamp leads. World frame = shop frame (meters). Everything is generated in code.
//
//   buildAILiveRig({ quality, shop, game }) -> { group, colliders, interactables, anchors, update(dt), setObdPort(v3), setBatteryPorts(plus, minus) }
//   anchors.obdPort / batteryPlus / batteryMinus are THREE.Vector3 in the shop frame (defaults below; the integrator can set the real ones).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from '../core/materials.js';
import { aabb } from '../core/geom.js';
import { PAGES, writeRemainingSec } from '../ui/ailive.js';
import { fmtClock } from '../ui/uiKit.js';

export const AILIVE_LABELS = {
  'shop.ailive_laptop': { name: 'Rugged laptop running AI Live', desc: 'The shop\'s tuning laptop. AI Live reads, backs up and writes the truck\'s tune over the OBD-II interface. Press E to use it (L opens the same screen).' },
  'shop.ailive_cable': { name: 'OBD-II interface and cable', desc: 'The interface plugs into the OBD-II port under the left side of the dash. Pulling it out during a write leaves the ECM half-programmed and the truck will not start. Press E to plug it in or take it out.' },
  'shop.battery_charger': { name: '12 V shop battery charger', desc: 'Clamped to the batteries before every flash so the voltage cannot sag below the write limit. Press E to connect the clamps or take them off.' },
  'shop.laptop_cart': { name: 'Rolling laptop cart', desc: 'A two-shelf steel utility cart on locking casters, parked beside the driver door.' },
};

export const RIG = {
  cart: { x: -3.6, z: 1.0, yaw: -Math.PI / 2, len: 0.86, depth: 0.52, topY: 0.86, lowY: 0.17 },
  charger: { x: -1.9, z: -1.25, yaw: Math.PI * 0.5 },
  obdPort: [-0.46, 0.86, 0.37], // truck frame x -18 in, y 34 in, s 46 in; shop z = s * 0.0254 - 0.8
  batteryPlus: [-0.61, 1.168, -1.105], batteryMinus: [0.61, 1.168, -1.105], // truck frame x +-24 in, y 46 in, s -12 in
};

// ---------------------------------------------------------------- pure geometry helpers (unit tested)
const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

// Interface cable route in the shop frame. Plugged: from the laptop over the cart edge, along the floor, up through the open driver
// door region to the dongle under the dash. Unplugged: a short slack loop to the dongle resting on the cart.
export function cableRoute({ start, port, plugged, rest }) {
  const a = v3(start); const pts = [a.clone()];
  if (!plugged) {
    const r = v3(rest); const mid = a.clone().lerp(r, 0.5);
    pts.push(a.clone().add(new THREE.Vector3(0, 0.012, 0)).lerp(mid, 0.35).setY(a.y + 0.006));
    pts.push(mid.add(new THREE.Vector3(0, 0.02, 0.07)));
    pts.push(r.clone().lerp(a, 0.25).setY(r.y + 0.004));
    pts.push(r);
    return pts;
  }
  const p = v3(port); const end = p.clone().add(new THREE.Vector3(0, -0.115, 0)); // the dongle hangs below the port, boot end down
  const d = new THREE.Vector3(end.x - a.x, 0, end.z - a.z).normalize();
  const side = new THREE.Vector3(-d.z, 0, d.x);
  const shelfEdge = a.clone().addScaledVector(d, 0.30);
  pts.push(a.clone().addScaledVector(d, 0.14).setY(a.y + 0.004));
  pts.push(shelfEdge.clone().setY(a.y - 0.02));
  pts.push(a.clone().addScaledVector(d, 0.38).setY(a.y - 0.34));
  pts.push(a.clone().addScaledVector(d, 0.5).setY(0.05));
  const floorEnd = new THREE.Vector3(p.x - 0.85, 0.012, p.z + 0.1);
  const floorStart = a.clone().addScaledVector(d, 0.62).setY(0.012);
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n; const q = floorStart.clone().lerp(floorEnd, t);
    q.addScaledVector(side, 0.16 * Math.sin(t * Math.PI * 1.6 + 0.4) * Math.sin(t * Math.PI)); q.y = 0.012 + 0.003 * Math.sin(t * 9);
    pts.push(q);
  }
  pts.push(new THREE.Vector3(p.x - 0.62, 0.30, p.z + 0.06));
  pts.push(new THREE.Vector3(p.x - 0.36, 0.66, p.z + 0.03));
  pts.push(new THREE.Vector3(p.x - 0.14, p.y - 0.27, p.z));
  pts.push(end);
  return pts;
}

// Charger lead route: from the charger terminal to the battery post (clamped) or a short coil hanging on the
// charger (rest). The clamped lead arcs over the fender and hood line (`via`, a control point at the top of the
// arch) so it does not pass through the bodywork, which the first pass did.
export function leadRoute({ from, to, clamped, rest, sag = 0.18, via = null }) {
  const a = v3(from); const b = v3(clamped ? to : rest);
  const arch = clamped && via ? v3(via) : null;
  const pts = [a.clone()];
  const n = 10;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    let q;
    if (arch) {
      const w0 = (1 - t) * (1 - t), w1 = 2 * (1 - t) * t, w2 = t * t;
      q = new THREE.Vector3(
        a.x * w0 + arch.x * w1 + b.x * w2,
        a.y * w0 + arch.y * w1 + b.y * w2,
        a.z * w0 + arch.z * w1 + b.z * w2);
    } else {
      q = a.clone().lerp(b, t);
      q.y += -Math.sin(t * Math.PI) * 0.07;
    }
    pts.push(q);
  }
  pts.push(b);
  return pts;
}

// ---------------------------------------------------------------- the laptop screen (also unit tested without a DOM)
export function screenModel(ai, env, page) {
  const label = (PAGES.find((p) => p[0] === page) || PAGES[0])[1];
  return {
    page: label, cable: !!ai.cable, keyPos: env.keyPos, engine: !!env.engineRunning, volts: ai.volts, charger: !!ai.charger, stage: ai.stage,
    progress: ai.progress, writing: ai.writing, bricked: !!ai.bricked, needsKeyCycle: !!ai.needsKeyCycle, installed: ai.installed, message: ai.message || '',
    remaining: writeRemainingSec(ai),
  };
}
export const screenSignature = (m) => [m.page, m.cable, m.keyPos, m.engine, m.volts.toFixed(1), m.charger, m.stage, Math.round(m.progress * 100), m.writing, m.bricked, m.needsKeyCycle, m.installed, m.message].join('|');

function drawLogo(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 64, s / 64);
  const g = ctx.createLinearGradient(0, 0, 64, 64); g.addColorStop(0, '#14b8a6'); g.addColorStop(1, '#2563eb');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(2, 2, 60, 60, 15); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(13, 41); ctx.lineTo(23, 13); ctx.lineTo(33, 41); ctx.moveTo(17.2, 31); ctx.lineTo(28.8, 31); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(40, 13, 6, 28, 3); ctx.fill();
  ctx.strokeStyle = '#a7f3ee'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(7, 51);
  for (let i = 0; i < 8; i++) { const x0 = 7 + i * 6.8; ctx.quadraticCurveTo(x0 + 1.7, i % 2 ? 51 + 9 : 51 - 9, x0 + 3.4 + 0, 51); ctx.quadraticCurveTo(x0 + 5.1, i % 2 ? 51 - 9 : 51 + 9, x0 + 6.8, 51); }
  ctx.stroke(); ctx.restore();
}

export function drawScreen(ctx, W, H, m) {
  const s = W / 640;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d1219'); g.addColorStop(1, '#070a0e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // title bar
  ctx.fillStyle = '#111821'; ctx.fillRect(0, 0, W, 54 * s); ctx.fillStyle = '#1f2a36'; ctx.fillRect(0, 54 * s, W, 1.5 * s);
  drawLogo(ctx, 12 * s, 8 * s, 38 * s);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 ${22 * s}px system-ui, sans-serif`; ctx.fillText('AI', 58 * s, 24 * s);
  ctx.fillStyle = '#2dd4bf'; ctx.fillText('LIVE', 88 * s, 24 * s);
  ctx.fillStyle = '#7c8794'; ctx.font = `600 ${8.5 * s}px system-ui, sans-serif`; ctx.fillText('ENGINE TUNING SUITE', 58 * s, 42 * s);
  const key = ['LOCK', 'ACC', 'RUN', 'START'][m.keyPos] || '?';
  const chip = (x, label, val, ok) => { ctx.fillStyle = '#0c1118'; ctx.beginPath(); ctx.roundRect(x, 15 * s, 104 * s, 24 * s, 12 * s); ctx.fill(); ctx.fillStyle = ok ? '#4ade80' : '#f5b83d'; ctx.beginPath(); ctx.arc(x + 12 * s, 27 * s, 4 * s, 0, 7); ctx.fill(); ctx.fillStyle = '#8592a1'; ctx.font = `700 ${8 * s}px system-ui, sans-serif`; ctx.fillText(label, x + 22 * s, 27.5 * s); ctx.fillStyle = '#e8edf3'; ctx.font = `700 ${10 * s}px ui-monospace, monospace`; ctx.textAlign = 'right'; ctx.fillText(val, x + 98 * s, 27.5 * s); ctx.textAlign = 'left'; };
  chip(W - 330 * s, 'CABLE', m.cable ? 'PLUGGED' : 'OFF', m.cable); chip(W - 218 * s, 'KEY', key, m.keyPos === 2); chip(W - 106 * s, 'BATT', `${m.volts.toFixed(1)} V`, m.volts > 12.1);
  // page title
  ctx.fillStyle = '#e8edf3'; ctx.font = `800 ${24 * s}px system-ui, sans-serif`; ctx.fillText(m.page, 22 * s, 88 * s);
  ctx.fillStyle = '#7c8794'; ctx.font = `500 ${11 * s}px system-ui, sans-serif`;
  ctx.fillText(m.stage === 'writing' || m.stage === 'reading' || m.stage === 'backing' ? 'Operation in progress' : 'Connection and tune status', 22 * s, 108 * s);
  // main card
  const cx = 22 * s, cy = 126 * s, cw = W - 44 * s, ch = 168 * s;
  const busy = ['reading', 'backing', 'writing'].includes(m.stage);
  let tone = '#223040', head = '', sub = '', headCol = '#e8edf3';
  if (m.stage === 'writing') { tone = '#93291f'; head = `WRITING ${String(m.writing || '').toUpperCase()}`; sub = 'DO NOT TOUCH THE KEY OR THE CABLE'; headCol = '#ffb4ab'; }
  else if (m.stage === 'reading') { tone = '#1c5953'; head = 'READING THE TRUCK'; sub = 'Keep the key in RUN'; }
  else if (m.stage === 'backing') { tone = '#1c5953'; head = 'SAVING BACKUP'; sub = 'Keep the key in RUN'; }
  else if (m.bricked) { tone = '#93291f'; head = 'WRITE FAILED: NO START'; sub = 'Plug in, key to RUN, write a tune to recover'; headCol = '#ffb4ab'; }
  else if (m.needsKeyCycle) { tone = '#1f7a45'; head = 'WRITE COMPLETE'; sub = 'Cycle the key, then start the engine'; headCol = '#86efac'; }
  else if (m.cable && m.keyPos === 2 && !m.engine) { tone = '#1c5953'; head = 'TRUCK CONNECTED'; sub = `Truck carries: ${String(m.installed).toUpperCase()}`; headCol = '#7ff3e4'; }
  else { head = m.cable ? 'WAITING FOR KEY RUN' : 'NO INTERFACE'; sub = m.cable ? 'Turn the key to RUN with the engine off' : 'Plug the cable into the OBD-II port'; headCol = '#f5b83d'; }
  ctx.fillStyle = '#0e141c'; ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 8 * s); ctx.fill(); ctx.strokeStyle = tone; ctx.lineWidth = 2 * s; ctx.stroke();
  ctx.fillStyle = headCol; ctx.font = `800 ${22 * s}px system-ui, sans-serif`; ctx.fillText(head, cx + 18 * s, cy + 34 * s);
  ctx.fillStyle = '#aab4c2'; ctx.font = `600 ${12 * s}px system-ui, sans-serif`; ctx.fillText(sub, cx + 18 * s, cy + 60 * s);
  if (busy) {
    const bx = cx + 18 * s, by = cy + 92 * s, bw = cw - 36 * s, bh = 26 * s;
    ctx.fillStyle = '#0a0d12'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6 * s); ctx.fill(); ctx.strokeStyle = '#2a323d'; ctx.lineWidth = 1.5 * s; ctx.stroke();
    const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0); fg.addColorStop(0, '#0f9d8f'); fg.addColorStop(1, '#3b82f6');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(bh * 0.6, bw * m.progress), bh, 6 * s); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `800 ${15 * s}px ui-monospace, monospace`; ctx.fillText(`${Math.round(m.progress * 100)} %`, bx + bw / 2, by + bh / 2 + 1 * s); ctx.textAlign = 'left';
    if (m.stage === 'writing') { ctx.fillStyle = '#e8edf3'; ctx.font = `700 ${14 * s}px ui-monospace, monospace`; ctx.fillText(`${fmtClock(m.remaining)} remaining`, bx, by + 50 * s); ctx.fillStyle = m.charger ? '#4ade80' : '#f5b83d'; ctx.textAlign = 'right'; ctx.fillText(m.charger ? 'CHARGER ON' : 'NO CHARGER', bx + bw, by + 50 * s); ctx.textAlign = 'left'; }
  } else {
    const rows = [['Interface', m.cable ? 'plugged in' : 'not connected'], ['Key', `${key}${m.engine ? ', engine running' : ''}`], ['Charger', m.charger ? 'connected' : 'not connected'], ['Battery', `${m.volts.toFixed(2)} V`]];
    rows.forEach(([k, v], i) => { const y = cy + 92 * s + i * 17 * s; ctx.fillStyle = '#7c8794'; ctx.font = `600 ${11 * s}px system-ui, sans-serif`; ctx.fillText(k, cx + 18 * s, y); ctx.fillStyle = '#dbe2ea'; ctx.font = `700 ${12 * s}px ui-monospace, monospace`; ctx.fillText(v, cx + 120 * s, y); });
  }
  // status line
  ctx.fillStyle = '#0c1016'; ctx.fillRect(0, H - 30 * s, W, 30 * s); ctx.fillStyle = '#1f2a36'; ctx.fillRect(0, H - 30 * s, W, 1.5 * s);
  ctx.fillStyle = '#9fb0c0'; ctx.font = `500 ${10.5 * s}px ui-monospace, monospace`; ctx.textBaseline = 'middle';
  const msg = m.message.length > 78 ? m.message.slice(0, 77) + '…' : m.message; ctx.fillText(msg || 'Ready.', 14 * s, H - 14 * s);
}

// ---------------------------------------------------------------- the rig
const hasDom = typeof document !== 'undefined';
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export function buildAILiveRig({ quality = { tex: 1024, aniso: 4 }, shop, game }) {
  const group = new THREE.Group(); group.name = 'ailive-rig';
  const colliders = []; const interactables = [];
  const texSize = Math.min(1024, quality.tex || 1024);
  const aniso = quality.aniso || 4;
  const rbox = (w, h, d, r, material, x = 0, y = 0, z = 0, shadow = false) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), material);
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
  };
  const cyl = (r, h, material, x = 0, y = 0, z = 0, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; return m; };

  // ---- materials
  const steel = mat.steelPainted(0x30353b, 0.5), steelLight = mat.steelPainted(0x5a6068, 0.42), chrome = mat.chrome(), rubber = mat.rubber(), plastic = mat.blackPlastic(0.5);
  const laptopBlack = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.6 });
  const bumper = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.85, metalness: 0.0 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xd9741c, roughness: 0.6, metalness: 0.0 });
  const redPaint = new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.42, metalness: 0.25, envMapIntensity: 0.9 });

  // ================================================================ cart
  const cart = new THREE.Group(); cart.name = 'laptop_cart';
  cart.position.set(RIG.cart.x, 0, RIG.cart.z); cart.rotation.y = RIG.cart.yaw; group.add(cart);
  const { len, depth, topY, lowY } = RIG.cart;
  const shelf = (y) => {
    const g = new THREE.Group(); g.position.y = y;
    g.add(rbox(len, 0.025, depth, 0.008, steel));
    const lipH = 0.035, t = 0.012;
    g.add(rbox(len, lipH, t, 0.004, steel, 0, lipH / 2 + 0.0125, depth / 2 - t / 2)); g.add(rbox(len, lipH, t, 0.004, steel, 0, lipH / 2 + 0.0125, -depth / 2 + t / 2));
    g.add(rbox(t, lipH, depth, 0.004, steel, len / 2 - t / 2, lipH / 2 + 0.0125, 0)); g.add(rbox(t, lipH, depth, 0.004, steel, -len / 2 + t / 2, lipH / 2 + 0.0125, 0));
    // non-slip mat
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.04, depth - 0.04), new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.95 }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.0135; pad.receiveShadow = true; g.add(pad);
    return g;
  };
  cart.add(shelf(topY - 0.0125)); cart.add(shelf(lowY));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * (len / 2 - 0.022), pz = sz * (depth / 2 - 0.022);
    cart.add(cyl(0.0125, topY - 0.1 + 0.02, chrome, px, (topY + 0.1) / 2 - 0.01, pz, 12));
    // swivel caster: plate, fork, wheel
    cart.add(rbox(0.05, 0.006, 0.05, 0.002, steelLight, px, 0.126, pz));
    cart.add(rbox(0.004, 0.06, 0.04, 0.001, steelLight, px + 0.017, 0.092, pz)); cart.add(rbox(0.004, 0.06, 0.04, 0.001, steelLight, px - 0.017, 0.092, pz));
    const w = cyl(0.05, 0.026, rubber, px, 0.05, pz, 20); w.rotation.z = Math.PI / 2; cart.add(w);
    const hub = cyl(0.022, 0.032, steelLight, px, 0.05, pz, 12); hub.rotation.z = Math.PI / 2; cart.add(hub);
  }
  // push handle at one end: a chrome U-bar rising from the top shelf
  const hx = -len / 2 + 0.01;
  for (const sz of [-1, 1]) cart.add(cyl(0.011, 0.3, chrome, hx, topY + 0.14, sz * (depth / 2 - 0.05), 10));
  const bar = cyl(0.011, depth - 0.1 + 0.022, chrome, hx, topY + 0.29, 0, 10); bar.rotation.x = Math.PI / 2; cart.add(bar);
  // lower shelf: a hard equipment case and a coil of extension cord
  const caseM = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.6, metalness: 0.1 });
  cart.add(rbox(0.36, 0.13, 0.26, 0.012, caseM, 0.2, lowY + 0.0125 + 0.065, 0.02));
  cart.add(rbox(0.04, 0.02, 0.012, 0.004, accent, 0.2, lowY + 0.0125 + 0.095, 0.158));
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 28), new THREE.MeshStandardMaterial({ color: 0xe9a21b, roughness: 0.7 })); coil.rotation.x = Math.PI / 2; coil.position.set(-0.22, lowY + 0.0125 + 0.02, 0); coil.castShadow = true; cart.add(coil);
  cart.userData.labelId = 'shop.laptop_cart';

  // ================================================================ laptop (on the top shelf)
  const laptop = new THREE.Group(); laptop.name = 'ailive_laptop';
  laptop.position.set(0.05, topY + 0.0135, 0.02); laptop.userData.labelId = 'shop.ailive_laptop';
  cart.add(laptop);
  const BW = 0.38, BD = 0.265, BH = 0.026;
  laptop.add(rbox(BW, BH, BD, 0.009, laptopBlack, 0, BH / 2 + 0.004, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { laptop.add(rbox(0.05, BH + 0.004, 0.05, 0.012, bumper, sx * (BW / 2 - 0.02), BH / 2 + 0.004, sz * (BD / 2 - 0.02))); laptop.add(rbox(0.012, 0.006, 0.012, 0.003, accent, sx * (BW / 2 - 0.0065), BH + 0.004, sz * (BD / 2 - 0.0065), false)); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) laptop.add(rbox(0.03, 0.004, 0.03, 0.002, rubber, sx * (BW / 2 - 0.03), 0.002, sz * (BD / 2 - 0.03), false));
  // keyboard deck textures
  let kbMap = null, padMap = null;
  if (hasDom) {
    const kc = mk(1024, 420); const k = kc.getContext('2d'); k.fillStyle = '#0e1012'; k.fillRect(0, 0, 1024, 420);
    const rowsN = [14, 14, 14, 13, 12, 8]; const kh = 52, gap = 7; let y0 = 10;
    rowsN.forEach((n, r) => { const kw = (1024 - 20 - gap * (n - 1)) / n; for (let i = 0; i < n; i++) { const x = 10 + i * (kw + gap); const isSpace = r === 5 && i === 3; const w = isSpace ? kw * 3.2 : kw; const xx = r === 5 && i > 3 ? x + kw * 2.2 : x; k.fillStyle = '#25282c'; k.beginPath(); k.roundRect(xx, y0, w, r === 0 ? kh * 0.7 : kh, 6); k.fill(); k.fillStyle = '#31353a'; k.beginPath(); k.roundRect(xx + 2, y0 + 2, w - 4, (r === 0 ? kh * 0.7 : kh) - 8, 5); k.fill(); k.fillStyle = '#8d949c'; k.font = '600 17px system-ui,sans-serif'; k.textAlign = 'center'; if (!isSpace) k.fillText('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[(r * 7 + i * 3) % 36], xx + w / 2, y0 + (r === 0 ? 27 : 34)); } y0 += (r === 0 ? kh * 0.7 : kh) + gap; });
    kbMap = new THREE.CanvasTexture(kc); kbMap.colorSpace = THREE.SRGBColorSpace; kbMap.anisotropy = aniso;
  }
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(0.335, 0.1375), new THREE.MeshStandardMaterial({ color: 0xffffff, map: kbMap, roughness: 0.6, metalness: 0.05 }));
  kb.rotation.x = -Math.PI / 2; kb.position.set(0, BH + 0.0043, -0.045); kb.receiveShadow = true; laptop.add(kb);
  laptop.add(rbox(0.115, 0.0012, 0.075, 0.004, new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.4, metalness: 0.2 }), 0, BH + 0.0048, 0.085, false));
  laptop.add(rbox(0.12, 0.0008, 0.079, 0.004, new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.9 }), 0, BH + 0.0044, 0.085, false));
  // side port (USB-A) where the cable plugs in: right side, rear
  laptop.add(rbox(0.006, 0.008, 0.016, 0.001, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 }), BW / 2 + 0.0005, BH / 2 + 0.006, -0.07, false));
  // lid on a hinge at the rear edge
  const lid = new THREE.Group(); lid.position.set(0, BH + 0.004, -BD / 2 + 0.004); lid.rotation.x = -(108 - 90) * Math.PI / 180; laptop.add(lid);
  const LH = 0.255, LW = BW, LT = 0.022;
  lid.add(rbox(LW, LH, LT, 0.008, laptopBlack, 0, LH / 2, -LT / 2 + 0.001));
  for (const sx of [-1, 1]) { lid.add(rbox(0.05, 0.05, LT + 0.006, 0.012, bumper, sx * (LW / 2 - 0.02), LH - 0.02, -LT / 2 + 0.001)); lid.add(rbox(0.05, 0.05, LT + 0.006, 0.012, bumper, sx * (LW / 2 - 0.02), 0.02, -LT / 2 + 0.001)); }
  lid.add(rbox(0.12, 0.012, 0.004, 0.002, accent, 0, LH * 0.5, -LT - 0.0005, false));
  lid.add(rbox(LW - 0.02, LH - 0.02, 0.0025, 0.004, new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.35, metalness: 0.2 }), 0, LH / 2, 0.0012, false)); // bezel
  // the screen: a live canvas of the AI Live home / progress screen
  let screenTex = null, screenCtx = null, screenCanvas = null;
  if (hasDom) { screenCanvas = mk(texSize, Math.round(texSize * 0.625)); screenCtx = screenCanvas.getContext('2d'); screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = aniso; }
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1.0, roughness: 0.9, metalness: 0.0, envMapIntensity: 0 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(LW - 0.036, (LW - 0.036) * 0.625), screenMat);
  screen.position.set(0, LH / 2 + 0.002, 0.0028); lid.add(screen);
  // glow on the keyboard
  const glow = new THREE.PointLight(0x7fd8ff, 0.3, 1.2, 2); glow.position.set(0, 0.09, 0.12); laptop.add(glow);
  laptop.updateMatrixWorld(true);

  // interaction on the laptop
  laptop.userData.interact = { prompt: 'Use AI Live', run: (ctx) => { const g = (ctx && ctx.game) || game; if (g) g.openPanel('ailive'); } };
  interactables.push(laptop);

  // a notepad beside the laptop, for the "real shop" feel
  const pad = rbox(0.15, 0.012, 0.21, 0.002, new THREE.MeshStandardMaterial({ color: 0xe9e6d8, roughness: 0.9 }), -0.3, 0.0065, 0.04); pad.rotation.y = 0.2; laptop.parent.add(pad); pad.position.set(0.32, topY + 0.0135 + 0.006, 0.0);
  const spiral = rbox(0.152, 0.004, 0.012, 0.002, chrome, 0, 0.007, -0.1, false); pad.add(spiral);

  // ================================================================ dongle + cable
  const dongle = new THREE.Group(); dongle.name = 'obd_dongle';
  dongle.add(rbox(0.078, 0.022, 0.044, 0.007, plastic, 0, 0, 0));                                  // body
  dongle.add(rbox(0.03, 0.0012, 0.02, 0.0005, new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x2dd4bf, emissiveIntensity: 0.8 }), -0.02, 0.0116, 0.002, false)); // LED bar
  const conn = new THREE.Mesh(new THREE.ExtrudeGeometry(((() => { const s = new THREE.Shape(); s.moveTo(-0.019, -0.006); s.lineTo(0.019, -0.006); s.lineTo(0.016, 0.006); s.lineTo(-0.016, 0.006); s.closePath(); return s; })()), { depth: 0.022, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.5, metalness: 0.2 }));
  conn.position.set(0, 0, 0.022); conn.castShadow = true; dongle.add(conn);              // OBD-II D-shaped plug, points +Z
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0065, 0.026, 12), rubber); boot.rotation.x = Math.PI / 2; boot.position.set(0, 0, -0.033); dongle.add(boot); // strain relief, cable leaves at -Z
  dongle.userData.labelId = 'shop.ailive_cable';
  group.add(dongle);

  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0f1011, roughness: 0.7, metalness: 0.0 });
  const cableMesh = new THREE.Mesh(new THREE.BufferGeometry(), cableMat); cableMesh.castShadow = true; cableMesh.receiveShadow = true; group.add(cableMesh);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const cableHit = new THREE.Mesh(new THREE.BufferGeometry(), hitMat); cableHit.userData.labelId = 'shop.ailive_cable'; group.add(cableHit);
  const cableGroup = new THREE.Group(); cableGroup.userData.labelId = 'shop.ailive_cable'; // pickable cable end: dongle + cable + proxy
  cableMesh.userData.labelId = 'shop.ailive_cable';
  // The OBD-II port is under the left of the dash: with the driver's door shut the cable would have to pass
  // through the door skin (the clipping defect), so plugging in requires the door open, as it does in reality.
  // A rig built without a truck (the unit tests) has no door state to check and is left alone.
  const driverDoorOpen = () => {
    const doors = game && game.truckCtl && game.truckCtl.doors;
    const d = doors && doors.fL;
    if (!d) return true;
    return d.state > 0.35;
  };
  const cableUse = {
    prompt: () => (game && game.ai.cable ? 'Unplug the interface from the OBD-II port' : 'Plug the interface into the OBD-II port'),
    run: (ctx) => {
      const g = (ctx && ctx.game) || game; if (!g) return;
      if (!g.ai.cable && !driverDoorOpen()) { if (ctx && ctx.say) ctx.say('Open the driver\'s door to reach the OBD-II port under the dash.', 4); return; }
      g.ai.plug(!g.ai.cable);
      if (ctx && ctx.say) ctx.say(g.ai.cable ? 'Interface plugged into the OBD-II port under the dash.' : 'Interface unplugged and set back on the cart.', 3.5);
    },
  };
  for (const o of [dongle, cableMesh, cableHit]) { o.userData.interact = cableUse; interactables.push(o); }

  // ================================================================ charger
  const chargerG = new THREE.Group(); chargerG.name = 'battery_charger'; chargerG.position.set(RIG.charger.x, 0, RIG.charger.z); chargerG.rotation.y = RIG.charger.yaw; group.add(chargerG);
  chargerG.userData.labelId = 'shop.battery_charger';
  // a small two-tier wheeled stand
  const standShelf = (y, w, d) => { chargerG.add(rbox(w, 0.02, d, 0.006, steel, 0, y, 0)); };
  standShelf(0.12, 0.5, 0.4); standShelf(0.7, 0.5, 0.4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    chargerG.add(cyl(0.011, 0.6, chrome, sx * 0.225, 0.4, sz * 0.175, 10));
    const wh = cyl(0.04, 0.022, rubber, sx * 0.225, 0.04, sz * 0.175, 16); wh.rotation.z = Math.PI / 2; chargerG.add(wh);
    chargerG.add(rbox(0.04, 0.05, 0.03, 0.004, steelLight, sx * 0.225, 0.088, sz * 0.175));
  }
  chargerG.add(rbox(0.012, 0.012, 0.4, 0.004, chrome, -0.255, 0.7, 0)); // short rail
  // charger body (red housing, black handle, front panel)
  const body = new THREE.Group(); body.position.set(0, 0.7 + 0.01, 0); chargerG.add(body);
  body.add(rbox(0.36, 0.26, 0.23, 0.025, redPaint, 0, 0.13, 0));
  body.add(rbox(0.30, 0.03, 0.1, 0.012, bumper, 0, 0.275, 0));                // handle base
  const hnd = rbox(0.28, 0.022, 0.026, 0.01, bumper, 0, 0.305, 0); body.add(hnd);
  for (const sx of [-1, 1]) body.add(rbox(0.022, 0.05, 0.026, 0.008, bumper, sx * 0.13, 0.285, 0));
  for (let i = 0; i < 6; i++) body.add(rbox(0.22, 0.003, 0.004, 0.001, bumper, 0, 0.05 + i * 0.012, -0.1155, false)); // vents (rear)
  let panelTex = null;
  if (hasDom) {
    const c = mk(512, 400); const k = c.getContext('2d'); k.fillStyle = '#1b1d20'; k.fillRect(0, 0, 512, 400);
    k.fillStyle = '#e7e2d3'; k.beginPath(); k.arc(140, 150, 105, 0, 7); k.fill(); k.strokeStyle = '#111'; k.lineWidth = 6; k.stroke();
    k.fillStyle = '#111'; k.font = '700 26px system-ui,sans-serif'; k.textAlign = 'center'; for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.15 + 0.7 * i / 6); k.beginPath(); k.moveTo(140 + 80 * Math.cos(a), 150 + 80 * Math.sin(a)); k.lineTo(140 + 95 * Math.cos(a), 150 + 95 * Math.sin(a)); k.lineWidth = 4; k.stroke(); k.font = '600 20px system-ui'; k.fillText(String(i * 10), 140 + 66 * Math.cos(a), 156 + 66 * Math.sin(a)); }
    k.fillStyle = '#a33'; k.beginPath(); k.moveTo(140, 150); k.lineTo(140 + 90 * Math.cos(Math.PI * 1.32), 150 + 90 * Math.sin(Math.PI * 1.32)); k.lineWidth = 5; k.strokeStyle = '#b3261e'; k.stroke();
    k.fillStyle = '#111'; k.font = '700 22px system-ui'; k.fillText('AMPS', 140, 205); k.fillStyle = '#d1d5db'; k.font = '800 30px system-ui'; k.fillText('12 V  SHOP CHARGER', 330, 60); k.font = '600 22px system-ui'; k.fillStyle = '#9ca3af'; k.fillText('50 A BOOST / 10 A TRICKLE', 330, 96);
    for (const [x, y, t] of [[300, 180, '2'], [370, 180, '10'], [440, 180, '50']]) { k.fillStyle = '#d1d5db'; k.beginPath(); k.arc(x, y, 22, 0, 7); k.fill(); k.fillStyle = '#222'; k.fillRect(x - 3, y - 20, 6, 20); k.fillStyle = '#d1d5db'; k.font = '700 22px system-ui'; k.fillText(t, x, y + 50); }
    k.fillStyle = '#2dd4bf'; k.beginPath(); k.arc(310, 320, 12, 0, 7); k.fill(); k.fillStyle = '#d1d5db'; k.font = '600 20px system-ui'; k.fillText('CHARGING', 400, 326);
    panelTex = new THREE.CanvasTexture(c); panelTex.colorSpace = THREE.SRGBColorSpace; panelTex.anisotropy = aniso;
  }
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, map: panelTex, roughness: 0.5, metalness: 0.1 }));
  panel.position.set(0, 0.13, 0.1165); body.add(panel);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x22d39a, emissiveIntensity: 0, roughness: 0.4 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), ledMat); led.position.set(-0.045, 0.062, 0.1195); body.add(led);
  // terminals on the front panel (red +, black -) and clamp hooks on the stand
  const postR = cyl(0.01, 0.025, new THREE.MeshStandardMaterial({ color: 0xcc2b22, roughness: 0.4 }), 0.105, 0.055, 0.12, 12); postR.rotation.x = Math.PI / 2; body.add(postR);
  const postB = cyl(0.01, 0.025, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.4 }), 0.145, 0.055, 0.12, 12); postB.rotation.x = Math.PI / 2; body.add(postB);
  chargerG.updateMatrixWorld(true);
  const termPlus = chargerG.localToWorld(new THREE.Vector3(0.105, 0.71 + 0.055, 0.14)); const termMinus = chargerG.localToWorld(new THREE.Vector3(0.145, 0.71 + 0.055, 0.14));
  const restPlus = chargerG.localToWorld(new THREE.Vector3(-0.22, 0.58, 0.19)), restMinus = chargerG.localToWorld(new THREE.Vector3(0.22, 0.58, 0.19));

  // clamps (alligator style) and leads
  const clampMesh = (color) => {
    const g = new THREE.Group(); const sleeve = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    g.add(rbox(0.095, 0.03, 0.03, 0.009, sleeve, 0, 0, 0));
    const jawM = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.9 });
    const j1 = rbox(0.05, 0.007, 0.024, 0.002, jawM, 0.07, 0.011, 0); j1.rotation.z = -0.12; g.add(j1);
    const j2 = rbox(0.05, 0.007, 0.024, 0.002, jawM, 0.07, -0.011, 0); j2.rotation.z = 0.12; g.add(j2);
    for (let i = 0; i < 4; i++) { const t = rbox(0.004, 0.006, 0.02, 0.001, jawM, 0.052 + i * 0.01, 0.0045, 0, false); g.add(t); }
    group.add(g); g.userData.interact = chargerUse; g.userData.labelId = 'shop.battery_charger'; interactables.push(g); return g;
  };
  const leadMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const leadP = new THREE.Mesh(new THREE.BufferGeometry(), leadMat(0xc0281f)), leadM = new THREE.Mesh(new THREE.BufferGeometry(), leadMat(0x131416));
  for (const l of [leadP, leadM]) { l.castShadow = true; l.userData.labelId = 'shop.battery_charger'; group.add(l); }
  const chargerUse = { prompt: () => (game && game.ai.charger ? 'Remove the battery charger clamps' : 'Clamp the charger to the batteries'), run: (ctx) => { const g = (ctx && ctx.game) || game; if (!g) return; g.ai.setCharger(!g.ai.charger); if (ctx && ctx.say) ctx.say(g.ai.charger ? 'Charger clamped to the battery terminals.' : 'Charger clamps removed and stowed on the stand.', 3.5); } };
  const clampP = clampMesh(0xc0281f), clampM = clampMesh(0x1a1b1e);
  for (const o of [chargerG, leadP, leadM]) { o.userData.interact = chargerUse; interactables.push(o); }

  // ================================================================ anchors and per-state placement
  const anchors = { obdPort: v3(RIG.obdPort), batteryPlus: v3(RIG.batteryPlus), batteryMinus: v3(RIG.batteryMinus), cart, laptop, screen, charger: chargerG, dongle };
  const state = { cable: null, charger: null, port: '', batt: '', sig: '', acc: 0, glow: 0 };

  const setTube = (mesh, pts, r, seg = 80, radial = 8) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    mesh.geometry.dispose(); mesh.geometry = new THREE.TubeGeometry(curve, seg, r, radial, false);
  };
  const laptopPort = () => laptop.localToWorld(new THREE.Vector3(BW / 2 + 0.012, BH / 2 + 0.006, -0.07));
  const restPos = () => cart.localToWorld(new THREE.Vector3(0.28, topY + 0.0135 + 0.011, 0.19));
  function placeCable() {
    cart.updateMatrixWorld(true);
    const plugged = !!(game && game.ai.cable); const start = laptopPort();
    if (plugged) {
      dongle.position.copy(anchors.obdPort).add(new THREE.Vector3(0, -0.05, 0)); dongle.rotation.set(-Math.PI / 2, 0, 0); dongle.rotation.order = 'YXZ';
    } else {
      dongle.position.copy(restPos()); dongle.rotation.set(0, -0.5, 0);
    }
    dongle.updateMatrixWorld(true);
    const bootEnd = dongle.localToWorld(new THREE.Vector3(0, 0, -0.046));
    let pts;
    if (plugged) { pts = cableRoute({ start, port: anchors.obdPort, plugged: true }); pts[pts.length - 1].copy(bootEnd); }
    else { pts = cableRoute({ start, plugged: false, rest: bootEnd }); }
    setTube(cableMesh, pts, 0.0055, 120, 8);
    // pick proxy: a fatter invisible tube so the cable can be aimed at from a normal distance
    setTube(cableHit, pts, 0.035, 60, 6);
    state.cable = plugged;
  }
  function placeLeads() {
    const on = !!(game && game.ai.charger);
    clampP.position.copy(on ? anchors.batteryPlus : restPlus); clampM.position.copy(on ? anchors.batteryMinus : restMinus);
    // jaws point at the post when clamped (toward -x for the driver side battery post, +x for the other); on the stand they hang down
    clampP.rotation.set(0, on ? Math.PI : 0, on ? -0.15 : Math.PI / 2); clampM.rotation.set(0, on ? 0 : 0, on ? 0.15 : Math.PI / 2);
    clampP.updateMatrixWorld(true); clampM.updateMatrixWorld(true);
    const endP = clampP.localToWorld(new THREE.Vector3(-0.05, 0, 0)), endM = clampM.localToWorld(new THREE.Vector3(-0.05, 0, 0));
    // arc the clamped leads over the fender / hood line instead of through it
    const arch = (from, to) => new THREE.Vector3(
      from.x + Math.sign(from.x || -1) * 0.10,
      Math.max(from.y, to.y) + 0.26,
      (from.z + to.z) * 0.5);
    setTube(leadP, leadRoute({ from: termPlus, to: endP, clamped: on, rest: endP, via: arch(termPlus, endP) }), 0.0085, 70, 8);
    setTube(leadM, leadRoute({ from: termMinus, to: endM, clamped: on, rest: endM, sag: 0.3, via: arch(termMinus, endM) }), 0.0085, 70, 8);
    state.charger = on;
  }
  function place() { placeCable(); placeLeads(); state.port = anchors.obdPort.toArray().join(); state.batt = anchors.batteryPlus.toArray().join() + anchors.batteryMinus.toArray().join(); }
  place();

  // colliders: the cart and the charger stand footprint (world frame)
  colliders.push(aabb(RIG.cart.x, 0.5, RIG.cart.z, depth / 2 + 0.02, 0.5, len / 2 + 0.02));
  colliders.push(aabb(RIG.charger.x, 0.5, RIG.charger.z, 0.2, 0.5, 0.25));

  const env = () => ({ keyPos: game.ign.key, engineRunning: game.ign.engineRunning });
  function redrawScreen(force) {
    if (!screenCtx || !game) return;
    const m = screenModel(game.ai, env(), (game.state && game.state.ailivePage) || 'connect'); const sig = screenSignature(m);
    if (!force && sig === state.sig) return; state.sig = sig;
    drawScreen(screenCtx, screenCanvas.width, screenCanvas.height, m); screenTex.needsUpdate = true;
  }
  redrawScreen(true);

  const api = {
    group, colliders, interactables, anchors,
    setObdPort(p) { anchors.obdPort.copy(v3(p)); place(); },
    setBatteryPorts(plus, minus) { anchors.batteryPlus.copy(v3(plus)); anchors.batteryMinus.copy(v3(minus)); place(); },
    update(dt) {
      if (!game) return;
      state.acc += dt;
      if (state.cable !== !!game.ai.cable) placeCable();
      if (state.charger !== !!game.ai.charger) placeLeads();
      if (state.acc > 0.2) { state.acc = 0; redrawScreen(false); }
      // charger LED and screen glow follow the state
      ledMat.emissiveIntensity = game.ai.charger ? 2.0 : 0;
      glow.intensity = 0.3;
    },
  };
  // only the large pieces cast shadows (conventions): shelves, laptop base, charger body and stand shelves, the equipment case
  for (const sh of cart.children.filter((c) => c.isGroup && c.children.length > 4)) sh.children[0].castShadow = true;
  laptop.children[0].castShadow = true; body.children[0].castShadow = true; chargerG.children.slice(0, 2).forEach((c) => { c.castShadow = true; });
  return api;
}
