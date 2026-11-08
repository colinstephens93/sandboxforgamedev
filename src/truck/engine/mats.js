// Materials and procedural textures for the engine bay (cast iron, cast and machined aluminum, black plastics with grain, rubber, painted
// steel, zinc, translucent reservoirs, generic decals). Everything is drawn on canvases in code (no downloaded assets).
import * as THREE from 'three';
import { makeCanvas, noiseField, canvasFromField, heightToNormal, tex, rng } from '../../core/proc.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

function heightFromCanvas(c) {
  const g = c.getContext('2d'), w = c.width, h = c.height, d = g.getImageData(0, 0, w, h).data, f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = d[i * 4] / 255; return f;
}

// sand-cast / grain normal map from value noise
function grainNormal(n, cells, seed, strength, repeat = [1, 1]) {
  const f = noiseField(n, n, cells, seed, 4, 0.55);
  return tex(heightToNormal(f, n, n, strength), { repeat, srgb: false });
}
// color map: base color with lighter dusty patches and darker oily patches (light road dust)
function dustyMap(base, n, seed, dust = 0.15, oil = 0.1, repeat = [1, 1]) {
  const f = noiseField(n, n, 14, seed, 5, 0.55), f2 = noiseField(n, n, 40, seed + 5, 3, 0.5);
  const b = new THREE.Color(base);
  const c = canvasFromField(f, n, n, (v, i) => {
    const k = f2[i];
    const dd = Math.max(0, v - 0.55) * 2 * dust * (0.6 + 0.8 * k), oo = Math.max(0, 0.42 - v) * 2 * oil;
    const r = b.r * (1 - oo) + 0.62 * dd, g = b.g * (1 - oo) + 0.58 * dd, bb = b.b * (1 - oo) + 0.5 * dd;
    const to = (x) => Math.round(Math.pow(Math.min(1, x), 1 / 2.2) * 255);
    return [to(r), to(g), to(bb)];
  });
  return tex(c, { repeat, srgb: true });
}

// finned core (radiator / condenser / intercooler): horizontal louvered fins with dark gaps
function finTexture(n, vertical = false) {
  const c = makeCanvas(n, n), g = c.getContext('2d');
  g.fillStyle = '#16181a'; g.fillRect(0, 0, n, n);
  const step = n / 32;
  for (let i = 0; i < 32; i++) {
    const grad = g.createLinearGradient(0, i * step, 0, (i + 1) * step);
    grad.addColorStop(0, '#9a9fa4'); grad.addColorStop(0.45, '#6a6f74'); grad.addColorStop(1, '#2b2e31');
    g.fillStyle = grad;
    if (vertical) g.fillRect(i * step, 0, step * 0.8, n); else g.fillRect(0, i * step, n, step * 0.8);
  }
  // fine louvers
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < n; i += 3) { if (vertical) g.fillRect(0, i, n, 1); else g.fillRect(i, 0, 1, n); }
  return tex(c, { repeat: [1, 1] });
}

// ---------- engine cover: height map with diamond-tread border and raised "6.6 TURBO DIESEL" lettering ----------
export function engineCoverTextures(size) {
  const n = size;
  const c = makeCanvas(n, n), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
  // diamond tread plate over the whole face, then a smooth panel is cleared in the middle (where the lettering sits)
  const cell = n / 26;
  g.save();
  for (let j = 0; j < 30; j++) for (let i = 0; i < 30; i++) {
    const cx = (i + 0.5) * cell, cy = (j + 0.5) * cell, a = ((i + j) % 2 ? 1 : -1) * Math.PI / 4;
    g.save(); g.translate(cx, cy); g.rotate(a);
    const grd = g.createLinearGradient(0, -cell * 0.14, 0, cell * 0.14); grd.addColorStop(0, '#9a9a9a'); grd.addColorStop(0.5, '#ffffff'); grd.addColorStop(1, '#9a9a9a');
    g.fillStyle = grd; g.beginPath(); g.roundRect(-cell * 0.42, -cell * 0.12, cell * 0.84, cell * 0.24, cell * 0.1); g.fill(); g.restore();
  }
  g.restore();
  // smooth panel: slightly raised flat area with a soft frame
  const px = n * 0.14, py = n * 0.2, pw = n * 0.72, ph = n * 0.62;
  g.fillStyle = '#7c7c7c'; g.beginPath(); g.roundRect(px, py, pw, ph, n * 0.04); g.fill();
  g.strokeStyle = '#c8c8c8'; g.lineWidth = n * 0.006; g.beginPath(); g.roundRect(px, py, pw, ph, n * 0.04); g.stroke();
  // lettering, raised
  g.fillStyle = '#f2f2f2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(n * 0.24)}px "Arial Black", Impact, Arial, sans-serif`; g.fillText('6.6', n * 0.5, n * 0.36);
  g.font = `800 ${Math.round(n * 0.1)}px "Arial Black", Impact, Arial, sans-serif`; g.fillText('TURBO', n * 0.5, n * 0.58); g.fillText('DIESEL', n * 0.5, n * 0.71);
  const h = heightFromCanvas(c);
  const normal = tex(heightToNormal(h, n, n, 3.2), { wrap: false, srgb: false });
  // color: black plastic, ridge tops slightly lighter (worn)
  const col = canvasFromField(h, n, n, (v) => { const k = 0.07 + Math.max(0, v - 0.5) * 0.1; const s = Math.round(Math.pow(k, 1 / 2.2) * 255); return [s, s, Math.round(s * 1.02)]; });
  const map = tex(col, { wrap: false });
  return { normal, map };
}

// ---------- decals (generic warnings, no brand logos) ----------
function decalCanvas(w, h, draw) { const c = makeCanvas(w, h), g = c.getContext('2d'); draw(g, w, h); return c; }
export function decal(kind) {
  const draw = {
    warn: (g, w, h) => { g.fillStyle = '#e9e7dd'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2c200'; g.fillRect(0, 0, w, h * 0.2); g.fillStyle = '#111'; g.font = `bold ${h * 0.14}px Arial`; g.textAlign = 'center'; g.fillText('CAUTION', w / 2, h * 0.16);
      g.font = `${h * 0.075}px Arial`; g.textAlign = 'left'; ['ENGINE FAN AND BELTS CAN START', 'WITHOUT WARNING. KEEP HANDS', 'AND LOOSE CLOTHING CLEAR.', 'HOT COOLANT UNDER PRESSURE.', 'DO NOT OPEN CAP WHEN HOT.'].forEach((t, i) => g.fillText(t, w * 0.06, h * (0.34 + i * 0.12))); },
    emissions: (g, w, h) => { g.fillStyle = '#d8d9d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; g.font = `bold ${h * 0.13}px Arial`; g.textAlign = 'left'; g.fillText('VEHICLE EMISSION', w * 0.05, h * 0.2); g.fillText('CONTROL INFORMATION', w * 0.05, h * 0.36);
      g.font = `${h * 0.08}px Arial`; for (let i = 0; i < 5; i++) g.fillText('6.6 LITER DIESEL  -  ' + 'XXXXXXXX'.slice(0, 6 + (i % 3)) + '  -  CATALYST', w * 0.05, h * (0.52 + i * 0.1)); },
    battery: (g, w, h) => { g.fillStyle = '#c9cac4'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1f21'; g.fillRect(0, 0, w, h * 0.3); g.fillStyle = '#e8e8e2'; g.font = `bold ${h * 0.2}px Arial`; g.textAlign = 'center'; g.fillText('12 V  MAINTENANCE FREE', w / 2, h * 0.22);
      g.fillStyle = '#222'; g.font = `bold ${h * 0.22}px Arial`; g.fillText('770 CCA', w / 2, h * 0.62); g.font = `${h * 0.1}px Arial`; g.fillText('GROUP 78  -  SIDE TERMINAL SERIES', w / 2, h * 0.85); },
    fuse: (g, w, h) => { g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#303236'; g.lineWidth = w * 0.01; g.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
      g.fillStyle = '#34363a'; g.beginPath(); g.moveTo(w * 0.52, h * 0.22); g.lineTo(w * 0.36, h * 0.54); g.lineTo(w * 0.48, h * 0.54); g.lineTo(w * 0.42, h * 0.8); g.lineTo(w * 0.64, h * 0.46); g.lineTo(w * 0.52, h * 0.46); g.closePath(); g.fill(); },
    airbox: (g, w, h) => { g.fillStyle = '#d9d8cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = `bold ${h * 0.2}px Arial`; g.textAlign = 'center'; g.fillText('AIR FILTER', w / 2, h * 0.38); g.font = `${h * 0.14}px Arial`; g.fillText('SERVICE WHEN INDICATOR SHOWS', w / 2, h * 0.64); g.fillText('RESTRICTION', w / 2, h * 0.84); },
    radiator: (g, w, h) => { g.fillStyle = '#e4e3da'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = `bold ${h * 0.12}px Arial`; g.textAlign = 'left'; g.fillText('SERVICE COOLING SYSTEM', w * 0.05, h * 0.2);
      g.font = `${h * 0.085}px Arial`; ['EXTENDED LIFE COOLANT', '50 / 50 WITH WATER', 'CHECK LEVEL AT SURGE TANK', 'WITH ENGINE COOLED DOWN'].forEach((t, i) => g.fillText(t, w * 0.05, h * (0.4 + i * 0.17))); },
    icons: (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = h * 0.06;
      const k = w / 4; // up arrow, hazard triangle, battery, up arrow
      g.beginPath(); g.moveTo(k * 0.5, h * 0.9); g.lineTo(k * 0.5, h * 0.15); g.moveTo(k * 0.2, h * 0.4); g.lineTo(k * 0.5, h * 0.12); g.lineTo(k * 0.8, h * 0.4); g.stroke();
      g.beginPath(); g.moveTo(k * 1.5, h * 0.1); g.lineTo(k * 1.88, h * 0.85); g.lineTo(k * 1.12, h * 0.85); g.closePath(); g.stroke();
      g.strokeRect(k * 2.15, h * 0.28, k * 0.7, h * 0.55); g.fillRect(k * 2.28, h * 0.12, k * 0.14, h * 0.14); g.fillRect(k * 2.58, h * 0.12, k * 0.14, h * 0.14);
      g.beginPath(); g.moveTo(k * 3.5, h * 0.9); g.lineTo(k * 3.5, h * 0.15); g.moveTo(k * 3.2, h * 0.4); g.lineTo(k * 3.5, h * 0.12); g.lineTo(k * 3.8, h * 0.4); g.stroke(); },
    washer: (g, w, h) => { g.fillStyle = '#1d6fb8'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(w / 2, h * 0.62, w * 0.3, h * 0.2, 0, Math.PI, 0); g.fill(); g.fillRect(w * 0.2, h * 0.62, w * 0.6, h * 0.05);
      g.strokeStyle = '#fff'; g.lineWidth = h * 0.05; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(w / 2 + i * w * 0.14, h * 0.4); g.lineTo(w / 2 + i * w * 0.2, h * 0.16); g.stroke(); } },
    brake: (g, w, h) => { g.fillStyle = '#f2c200'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#111'; g.lineWidth = w * 0.05;
      g.beginPath(); g.arc(w / 2, h / 2, w * 0.22, 0.6, Math.PI * 2 - 0.6); g.stroke(); g.fillStyle = '#111'; g.font = `bold ${w * 0.3}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', w / 2, h / 2 + 2); },
    oilcap: (g, w, h) => { g.fillStyle = '#17181a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8d8d0'; g.lineWidth = w * 0.035; g.beginPath(); g.arc(w / 2, h / 2, w * 0.3, 0.3, Math.PI * 2 - 0.3); g.stroke();
      g.beginPath(); g.moveTo(w * 0.64, h * 0.3); g.lineTo(w * 0.78, h * 0.22); g.lineTo(w * 0.74, h * 0.4); g.stroke(); },
    coolant: (g, w, h) => { g.fillStyle = '#e6e2c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#b21a1a'; g.font = `bold ${h * 0.22}px Arial`; g.textAlign = 'center'; g.fillText('WARNING', w / 2, h * 0.3); g.fillStyle = '#111'; g.font = `${h * 0.14}px Arial`; g.fillText('HOT - DO NOT OPEN', w / 2, h * 0.58); g.fillText('WHEN ENGINE IS HOT', w / 2, h * 0.8); },
  }[kind];
  const c = decalCanvas(kind === 'icons' ? 512 : 256, kind === 'icons' ? 128 : 192, draw);
  return tex(c, { wrap: false, aniso: 4 });
}

export function makeMats(quality) {
  const N = Math.min(quality.tex, 1024);
  const sandIron = grainNormal(N, 90, 11, 1.6, [2, 2]);
  const sandAl = grainNormal(N, 140, 12, 1.2, [2, 2]);
  const grain = grainNormal(N, 160, 13, 1.0, [3, 3]);
  const rubberGrain = grainNormal(Math.min(N, 512), 60, 14, 1.4, [4, 4]);
  const fins = finTexture(Math.min(N, 512));
  fins.repeat.set(1, 1);
  const M = {};
  M.iron = std({ color: 0x4a4b4b, metalness: 0.85, roughness: 0.62, normalMap: sandIron, normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 0.9 });
  M.ironDark = std({ color: 0x2f2d2b, metalness: 0.8, roughness: 0.7, normalMap: sandIron, normalScale: new THREE.Vector2(1, 1), envMapIntensity: 0.7 });
  M.manifold = std({ color: 0x4a3a30, metalness: 0.7, roughness: 0.75, normalMap: sandIron, envMapIntensity: 0.6 });
  M.alum = std({ color: 0x8e9295, metalness: 0.9, roughness: 0.52, normalMap: sandAl, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 1.0 });
  M.alumDark = std({ color: 0x6d7073, metalness: 0.85, roughness: 0.58, normalMap: sandAl, envMapIntensity: 0.9 });
  M.alumMach = std({ color: 0xc6cacd, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.3 });
  M.alumPipe = std({ color: 0xb8bcbf, metalness: 1.0, roughness: 0.36, envMapIntensity: 1.2 });
  M.plastic = std({ color: 0x15161a, metalness: 0, roughness: 0.58, normalMap: grain, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.7, side: THREE.DoubleSide });
  M.plasticDust = std({ color: 0xffffff, map: dustyMap(0x181a1c, Math.min(N, 512), 21, 0.2, 0.1, [2, 2]), metalness: 0, roughness: 0.62, normalMap: grain, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 0.7, side: THREE.DoubleSide });
  M.plasticGray = std({ color: 0xffffff, map: dustyMap(0x35383b, Math.min(N, 512), 22, 0.25, 0.1, [2, 2]), metalness: 0, roughness: 0.6, normalMap: grain, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 0.7, side: THREE.DoubleSide });
  M.rubber = std({ color: 0x0f1011, metalness: 0, roughness: 0.9, normalMap: rubberGrain, normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.4 });
  M.loom = std({ color: 0x0b0c0d, metalness: 0, roughness: 0.55, envMapIntensity: 0.6 });
  M.cable = std({ color: 0x0c0d0e, metalness: 0, roughness: 0.5, envMapIntensity: 0.6 });
  M.cableRed = std({ color: 0x6e0f14, metalness: 0, roughness: 0.55, envMapIntensity: 0.5 });
  M.steelBlack = std({ color: 0xffffff, map: dustyMap(0x1b1d1f, Math.min(N, 512), 23, 0.18, 0.12, [1.5, 1.5]), metalness: 0.55, roughness: 0.5, envMapIntensity: 0.8, side: THREE.DoubleSide });
  M.steelRaw = std({ color: 0x8c8e8c, metalness: 0.85, roughness: 0.45, envMapIntensity: 0.9 });
  M.apron = std({ color: 0xffffff, map: dustyMap(0xdcdcd6, Math.min(N, 512), 24, 0.35, 0.12, [3, 3]), metalness: 0.0, roughness: 0.55, envMapIntensity: 0.9, side: THREE.DoubleSide });
  M.innerWhite = std({ color: 0xffffff, map: dustyMap(0xe8e8e2, Math.min(N, 512), 25, 0.12, 0.05, [3, 3]), metalness: 0, roughness: 0.5, envMapIntensity: 0.9, side: THREE.DoubleSide });
  M.zinc = std({ color: 0xaeb2ae, metalness: 0.9, roughness: 0.38, envMapIntensity: 1.0 });
  M.zincGold = std({ color: 0xb09a52, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.9 });
  M.stainless = std({ color: 0xcfd2d4, metalness: 1.0, roughness: 0.25, envMapIntensity: 1.3 });
  M.brass = std({ color: 0xb58a3e, metalness: 1.0, roughness: 0.35, envMapIntensity: 1.1 });
  M.foil = std({ color: 0xb9bdbf, metalness: 1.0, roughness: 0.42, normalMap: grainNormal(256, 50, 15, 2.2, [3, 3]), envMapIntensity: 1.0 });
  M.heatShield = std({ color: 0x8a8c8e, metalness: 0.9, roughness: 0.5, normalMap: sandAl, envMapIntensity: 0.9, side: THREE.DoubleSide });
  M.teal = std({ color: 0x1f7f84, metalness: 0, roughness: 0.5, envMapIntensity: 0.6 });
  M.yellow = std({ color: 0xf0bf00, metalness: 0, roughness: 0.42, envMapIntensity: 0.8 });
  M.red = std({ color: 0x9e1218, metalness: 0, roughness: 0.5, envMapIntensity: 0.7 });
  M.orange = std({ color: 0xd8601a, metalness: 0, roughness: 0.5, envMapIntensity: 0.7 });
  M.blueCap = std({ color: 0x1d5aa5, metalness: 0, roughness: 0.45 });
  M.tankWhite = phys({ color: 0xe9e6d6, metalness: 0, roughness: 0.38, transparent: true, opacity: 0.8, clearcoat: 0.3, envMapIntensity: 0.9, side: THREE.DoubleSide, depthWrite: true });
  M.coolant = std({ color: 0xd8761f, metalness: 0, roughness: 0.3, transparent: true, opacity: 0.85, envMapIntensity: 0.6 });
  M.brakeFluid = std({ color: 0xc89a3c, metalness: 0, roughness: 0.3, transparent: true, opacity: 0.85 });
  M.washerFluid = std({ color: 0x3f9ad8, metalness: 0, roughness: 0.3, transparent: true, opacity: 0.8 });
  M.lens = phys({ color: 0xcfe0a0, metalness: 0, roughness: 0.1, transparent: true, opacity: 0.8, clearcoat: 1 });
  M.battery = std({ color: 0x1b1c1e, metalness: 0, roughness: 0.55, normalMap: grain, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.6 });
  M.lead = std({ color: 0x8d9094, metalness: 0.9, roughness: 0.5, envMapIntensity: 0.8 });
  M.masterCyl = std({ color: 0x5e4c3c, metalness: 0.75, roughness: 0.65, normalMap: sandIron, envMapIntensity: 0.6 });
  M.fins = std({ color: 0xffffff, map: fins, metalness: 0.7, roughness: 0.5, envMapIntensity: 0.8 });
  M.fan = std({ color: 0x131416, metalness: 0, roughness: 0.55, envMapIntensity: 0.7, side: THREE.DoubleSide });
  M.pad = std({ color: 0xffffff, map: dustyMap(0x17181a, Math.min(N, 512), 26, 0.002, 0.0, [3, 3]), metalness: 0, roughness: 1.0, normalMap: grainNormal(Math.min(N, 512), 120, 27, 2.0, [4, 4]), normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 0.3, side: THREE.DoubleSide });
  M.padClip = std({ color: 0x0a0a0b, metalness: 0, roughness: 0.5, envMapIntensity: 0.5 });
  M.hosePaint = std({ color: 0x1b1c1d, metalness: 0, roughness: 0.85 });
  // textured plates
  const dk = {}; const tx = (k) => (dk[k] ||= decal(k));
  M.decal = (k) => std({ map: tx(k), color: 0xc8c8c4, metalness: 0, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, transparent: false });
  const ct = engineCoverTextures(Math.min(quality.tex, 1024));
  M.cover = std({ color: 0x8a8a8a, map: ct.map, normalMap: ct.normal, normalScale: new THREE.Vector2(1.9, 1.9), metalness: 0, roughness: 0.55, envMapIntensity: 0.7 });
  M.dispose = () => { /* textures live for the page lifetime */ };
  return M;
}
