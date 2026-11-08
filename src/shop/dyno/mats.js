// Materials and procedural textures for the dyno hardware. Everything is generated in code (CONVENTIONS: no assets).
import * as THREE from 'three';
import { makeCanvas, noiseField, canvasFromField, heightToNormal, tex } from '../../core/proc.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Distance from p to the segment a-b (2D).
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

// Diamond (tread) plate: 2x2 cells per tile, lugs alternate +45 / -45 degrees. Tile = 0.0762 m (3 in).
function diamondPlateMaps(size) {
  const n = size, h = new Float32Array(n * n);
  const cell = n / 2, halfLen = cell * 0.36, rad = cell * 0.095;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const ox = (cx + 0.5) * cell, oy = (cy + 0.5) * cell;
    const dir = (cx + cy) % 2 === 0 ? 1 : -1;
    const d = segDist(x, y, ox - dir * halfLen * 0.7, oy - halfLen * 0.7, ox + dir * halfLen * 0.7, oy + halfLen * 0.7);
    h[y * n + x] = sstep(rad * 1.15, rad * 0.35, d);
  }
  const noise = noiseField(n, n, 8, 17, 3, 0.5);
  const color = canvasFromField(h, n, n, (v, i) => { const k = 150 + noise[i] * 38 + v * 22; return [k, k * 1.01, k * 1.03]; });
  return { color, normal: heightToNormal(h, n, n, 6) };
}

// Diamond knurl for the roller drums: crossed 45 degree grooves, worn smooth at the tips by use.
function knurlMaps(size) {
  const n = size, h = new Float32Array(n * n);
  const P = n / 6; // 6 pyramids per tile
  const wear = noiseField(n, n, 10, 5, 3, 0.55);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = Math.sin(((x + y) / P) * Math.PI * 2), b = Math.sin(((x - y) / P) * Math.PI * 2);
    h[y * n + x] = (0.5 + 0.5 * a * b) * (0.82 + wear[y * n + x] * 0.18);
  }
  const color = canvasFromField(h, n, n, (v, i) => { const k = 92 + v * 52 + (wear[i] - 0.5) * 44; return [k, k * 1.01, k * 1.04]; });
  const rough = canvasFromField(h, n, n, (v, i) => { const k = (0.5 - v * 0.22 + (wear[i] - 0.5) * 0.25) * 255; return [k, k, k]; });
  return { color, normal: heightToNormal(h, n, n, 3.2), rough };
}

// Poured concrete wall: form-board seams, tie holes, mottling. Tile 1.2 m x 1.2 m.
function wallConcreteMaps(size) {
  const n = size;
  const broad = noiseField(n, n, 5, 31, 4, 0.55), fine = noiseField(n, n, 80, 33, 3, 0.6);
  const h = new Float32Array(n * n);
  for (let i = 0; i < h.length; i++) h[i] = fine[i] * 0.6 + broad[i] * 0.25;
  const color = canvasFromField(broad, n, n, (v, i) => { const g = 112 + v * 36 + (fine[i] - 0.5) * 30; return [g, g * 0.99, g * 0.96]; });
  const g = color.getContext('2d');
  // form seams every 0.6 m (vertical) and 0.3 m (horizontal), tie holes on a 0.6 m grid
  g.fillStyle = 'rgba(40,40,38,0.55)';
  const sw = Math.max(1, n / 400);
  g.fillRect(0, 0, n, sw); g.fillRect(0, n / 2, n, sw); g.fillRect(0, 0, sw, n);
  g.fillRect(0, n * 0.25, n, sw * 0.6); g.fillRect(0, n * 0.75, n, sw * 0.6);
  g.fillStyle = 'rgba(25,25,24,0.8)';
  for (const [u, v] of [[0.25, 0.125], [0.75, 0.125], [0.25, 0.625], [0.75, 0.625]]) { g.beginPath(); g.arc(u * n, v * n, n * 0.011, 0, 7); g.fill(); }
  // rust bleed streaks below the tie holes
  g.fillStyle = 'rgba(95,60,38,0.18)';
  for (const [u, v] of [[0.25, 0.125], [0.75, 0.125], [0.25, 0.625], [0.75, 0.625]]) g.fillRect(u * n - n * 0.004, v * n, n * 0.008, n * 0.12);
  return { color, normal: heightToNormal(h, n, n, 1.4) };
}

// Pit floor: darker sealed concrete with oil stains and grit.
function pitFloorMaps(size) {
  const n = size;
  const broad = noiseField(n, n, 4, 41, 4, 0.55), fine = noiseField(n, n, 90, 43, 3, 0.6), oil = noiseField(n, n, 3, 45, 4, 0.6);
  const color = canvasFromField(broad, n, n, (v, i) => {
    const o = clamp((oil[i] - 0.55) * 4, 0, 0.7);
    const g = (92 + v * 30 + (fine[i] - 0.5) * 26) * (1 - o * 0.6);
    return [g, g, g * 0.97];
  });
  const rough = canvasFromField(oil, n, n, (v, i) => { const o = clamp((v - 0.55) * 4, 0, 0.7); const k = (0.85 - o * 0.55) * 255; return [k, k, k]; });
  const nh = new Float32Array(n * n);
  for (let i = 0; i < nh.length; i++) nh[i] = fine[i] * 0.6 + broad[i] * 0.2;
  return { color, rough, normal: heightToNormal(nh, n, n, 1.2) };
}

function hazardCanvas() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#e9b800'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#141414';
  for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * 64, 128); g.lineTo(k * 64 + 32, 128); g.lineTo(k * 64 + 160, 0); g.lineTo(k * 64 + 128, 0); g.fill(); }
  // paint wear
  const nz = noiseField(128, 128, 12, 51, 3, 0.55);
  const img = g.getImageData(0, 0, 128, 128);
  for (let i = 0; i < 128 * 128; i++) { const w = clamp((nz[i] - 0.5) * 1.6, -0.3, 0.3); for (let k = 0; k < 3; k++) img.data[i * 4 + k] = clamp(img.data[i * 4 + k] * (1 + w) + (w < -0.1 ? 40 : 0), 0, 255); }
  g.putImageData(img, 0, 0);
  return c;
}

// Webbing: 50 mm polyester strap, weave along the length (v), tile 0.1 m, with edge stitching lines.
function webbingMaps() {
  const w = 128, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#f7a21a'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 === 0 ? 'rgba(255,200,110,0.35)' : 'rgba(150,70,0,0.20)'; g.fillRect(0, y, w, 2); }
  g.fillStyle = 'rgba(90,40,0,0.5)'; g.fillRect(6, 0, 3, h); g.fillRect(w - 9, 0, 3, h); // selvedge ribs
  g.fillStyle = 'rgba(30,25,20,0.9)'; // stitch dashes along the edge
  for (let y = 0; y < h; y += 16) { g.fillRect(14, y, 2, 9); g.fillRect(w - 16, y, 2, 9); }
  const hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hgt[y * w + x] = (y % 4 < 2 ? 0.8 : 0.3) + (x % 6 < 3 ? 0.1 : 0);
  return { color: c, normal: heightToNormal(hgt, w, h, 1.4) };
}

// Corrugation pattern for hose: stripes across the length.
function corrugationMap() {
  const w = 16, h = 64, hgt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hgt[y * w + x] = 0.5 + 0.5 * Math.cos((y / h) * Math.PI * 2);
  return heightToNormal(hgt, w, h, 6);
}

export function makeMats(quality) {
  const T = Math.max(128, Math.min(512, quality.tex / 2));
  const an = quality.aniso || 4;
  const V2 = (a, b = a) => new THREE.Vector2(a, b);

  const dp = diamondPlateMaps(Math.min(256, T));
  const diamondPlate = new THREE.MeshStandardMaterial({
    map: tex(dp.color, { repeat: [1 / 0.0762, 1 / 0.0762], aniso: an }),
    normalMap: tex(dp.normal, { repeat: [1 / 0.0762, 1 / 0.0762], srgb: false, aniso: an }), normalScale: V2(1.1),
    metalness: 0.8, roughness: 0.4, envMapIntensity: 0.9,
  });
  const kn = knurlMaps(T);
  const knurlRepeatU = (2 * Math.PI * 0.3048) / 0.040, knurlRepeatV = (0.9144) / 0.040;
  const roller = new THREE.MeshStandardMaterial({
    map: tex(kn.color, { repeat: [knurlRepeatU, knurlRepeatV], aniso: an }),
    normalMap: tex(kn.normal, { repeat: [knurlRepeatU, knurlRepeatV], srgb: false, aniso: an }), normalScale: V2(1.2),
    roughnessMap: tex(kn.rough, { repeat: [knurlRepeatU, knurlRepeatV], srgb: false, aniso: an }),
    metalness: 0.92, roughness: 1.0, envMapIntensity: 1.0,
  });
  const wc = wallConcreteMaps(T);
  const wallConcrete = new THREE.MeshStandardMaterial({
    map: tex(wc.color, { repeat: [1 / 1.2, 1 / 1.2], aniso: an }), normalMap: tex(wc.normal, { repeat: [1 / 1.2, 1 / 1.2], srgb: false, aniso: an }),
    normalScale: V2(0.7), roughness: 0.92, metalness: 0, envMapIntensity: 0.6,
  });
  const pf = pitFloorMaps(T);
  const pitFloor = new THREE.MeshStandardMaterial({
    map: tex(pf.color, { repeat: [1 / 2, 1 / 2], aniso: an }), normalMap: tex(pf.normal, { repeat: [1 / 2, 1 / 2], srgb: false, aniso: an }),
    roughnessMap: tex(pf.rough, { repeat: [1 / 2, 1 / 2], srgb: false, aniso: an }), normalScale: V2(0.6), roughness: 1, metalness: 0, envMapIntensity: 0.6,
  });
  const hz = tex(hazardCanvas(), { repeat: [1 / 0.2, 1 / 0.2], aniso: an });
  const hazard = new THREE.MeshStandardMaterial({ map: hz, roughness: 0.55, metalness: 0, envMapIntensity: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const hazardSolid = new THREE.MeshStandardMaterial({ map: tex(hazardCanvas(), { repeat: [1 / 0.2, 1 / 0.2], aniso: an }), roughness: 0.5, metalness: 0.2 });
  const wb = webbingMaps();
  const webbing = new THREE.MeshStandardMaterial({
    map: tex(wb.color, { aniso: an }), normalMap: tex(wb.normal, { srgb: false, aniso: an }), normalScale: V2(0.8),
    roughness: 0.8, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5, emissive: new THREE.Color(0.32, 0.17, 0.02),
  });
  const hoseNormal = tex(corrugationMap(), { srgb: false, aniso: an });

  return {
    diamondPlate, roller, wallConcrete, pitFloor, hazard, hazardSolid, webbing, hoseNormal,
    steelRaw: new THREE.MeshStandardMaterial({ color: 0x5b5f64, metalness: 0.85, roughness: 0.5, envMapIntensity: 0.9 }),         // rolled curb / structural steel
    steelDark: new THREE.MeshStandardMaterial({ color: 0x2c2f33, metalness: 0.7, roughness: 0.55, envMapIntensity: 0.8 }),
    steelMachined: new THREE.MeshStandardMaterial({ color: 0xb4b8bc, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.2 }),    // shafts
    zinc: new THREE.MeshStandardMaterial({ color: 0xc6c9cc, metalness: 1.0, roughness: 0.32, envMapIntensity: 1.1 }),
    castBlue: new THREE.MeshStandardMaterial({ color: 0x1d3d66, metalness: 0.45, roughness: 0.5, envMapIntensity: 0.9 }),         // absorber paint
    castGrey: new THREE.MeshStandardMaterial({ color: 0x4a4e52, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.9 }),       // pillow blocks
    loadCell: new THREE.MeshStandardMaterial({ color: 0xb89b45, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.1 }), // anodised aluminium load cell
    safetyYellow: new THREE.MeshStandardMaterial({ color: 0xe7b500, metalness: 0.2, roughness: 0.45, envMapIntensity: 0.8 }),
    safetyRed: new THREE.MeshStandardMaterial({ color: 0xc4161c, metalness: 0.1, roughness: 0.35, envMapIntensity: 0.8 }),
    chockUrethane: new THREE.MeshStandardMaterial({ color: 0xd8a30a, roughness: 0.7, envMapIntensity: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x131314, roughness: 0.92, envMapIntensity: 0.4 }),
    rubberGrey: new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.9, envMapIntensity: 0.4 }),
    plasticBlack: new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.5, envMapIntensity: 0.7 }),
    plasticGrey: new THREE.MeshStandardMaterial({ color: 0x6b6f73, roughness: 0.55, envMapIntensity: 0.7 }),
    plasticWhite: new THREE.MeshStandardMaterial({ color: 0xe6e8e8, roughness: 0.45, envMapIntensity: 0.9 }),
    ledStrip: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0.9, 0.95, 1.0), emissiveIntensity: 3.0, roughness: 0.4 }),
    ledRed: new THREE.MeshStandardMaterial({ color: 0x300000, emissive: new THREE.Color(1, 0.1, 0.05), emissiveIntensity: 2.5, roughness: 0.4 }),
    ledGreen: new THREE.MeshStandardMaterial({ color: 0x002a08, emissive: new THREE.Color(0.1, 1, 0.25), emissiveIntensity: 2.5, roughness: 0.4 }),
    paintWhite: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5, metalness: 0, envMapIntensity: 0.8 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.6, envMapIntensity: 0.5 }),
    cableGrey: new THREE.MeshStandardMaterial({ color: 0x4d5155, roughness: 0.55, envMapIntensity: 0.5 }),
    hoseMat: new THREE.MeshStandardMaterial({ color: 0x2b2c2e, roughness: 0.68, metalness: 0.15, envMapIntensity: 0.6, normalMap: hoseNormal, normalScale: V2(0.0) }),
    glassDark: new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.4 }),
  };
}
