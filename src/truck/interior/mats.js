// Interior materials: tan leather (pebble grain normal map), perforated inserts, tan and graphite plastics, carpet, rubber mats,
// headliner fabric, glass. All textures are generated in code (canvas). UVs are in inches (see kit.js), so repeats are 1/tileInches.
import * as THREE from 'three';
import { makeCanvas, noiseField, heightToNormal, tex, rng } from '../../core/proc.js';

// ---- Voronoi (cellular) height field, tileable: pebbled leather grain ----
function voronoiHeight(n, cells, seed = 3) {
  const r = rng(seed); const pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + 0.7 * r()) / cells, (j + 0.15 + 0.7 * r()) / cells]);
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, v = y / n; const ci = Math.floor(u * cells), cj = Math.floor(v * cells);
    let d1 = 9, d2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + cells) % cells, jj = (cj + dj + cells) % cells; const p = pts[jj * cells + ii];
      let dx = Math.abs(u - p[0]); dx = Math.min(dx, 1 - dx); let dy = Math.abs(v - p[1]); dy = Math.min(dy, 1 - dy);
      const dd = Math.hypot(dx * cells, dy * cells);
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
    }
    // ridge between cells is low, cell centers high
    out[y * n + x] = Math.min(1, Math.max(0, (d2 - d1) * 1.4));
  }
  return out;
}

const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

function leatherNormal(n) {
  return once('leatherN' + n, () => {
    const v = voronoiHeight(n, 44, 5), f = noiseField(n, n, 40, 9, 3, 0.5);
    const h = new Float32Array(n * n);
    for (let i = 0; i < h.length; i++) h[i] = v[i] * 0.8 + f[i] * 0.2;
    return heightToNormal(h, n, n, 2.2);
  });
}
function mottled(n, base, vary, seed, cells = 6) {
  const f = noiseField(n, n, cells, seed, 4, 0.55);
  const c = makeCanvas(n, n), g = c.getContext('2d'); const img = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const k = 1 + (f[i] - 0.5) * vary;
    img.data[i * 4] = Math.min(255, base[0] * k); img.data[i * 4 + 1] = Math.min(255, base[1] * k); img.data[i * 4 + 2] = Math.min(255, base[2] * k); img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}

export function makeMaterials(quality) {
  const T = Math.min(quality.tex, 1024); // grain textures need no more than 1024
  const tile = (canvas, inches, srgb = true) => tex(canvas, { repeat: [1 / inches, 1 / inches], srgb, aniso: quality.aniso });

  const grainN = tile(leatherNormal(Math.max(256, T / 2)), 2.4, false);
  const leatherMap = tile(mottled(256, [166, 140, 106], 0.16, 21, 5), 14);
  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: leatherMap, roughness: 0.52, metalness: 0, normalMap: grainN, normalScale: new THREE.Vector2(0.38, 0.38),
    clearcoat: 0.12, clearcoatRoughness: 0.45, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xe8d7b6), envMapIntensity: 0.8,
  });

  // perforated insert: dark dots on a diamond grid, pressed into the grain
  const perfCanvas = once('perf', () => {
    const n = 256, c = makeCanvas(n, n), g = c.getContext('2d');
    g.fillStyle = '#bca27c'; g.fillRect(0, 0, n, n);
    return c;
  });
  const perfHeight = once('perfH', () => {
    const n = 256, h = new Float32Array(n * n).fill(0.7); const cell = 16; // 16 px = 0.25 in at tile 4 in
    for (let j = 0; j < n / cell * 2; j++) for (let i = 0; i < n / cell; i++) {
      const cx = (i + (j % 2 ? 0.5 : 0)) * cell + cell / 2, cy = (j * cell) / 2 + cell / 4;
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = Math.hypot(x, y); if (d <= 2.4) { const px = (Math.round(cx) + x + n) % n, py = (Math.round(cy) + y + n) % n; h[py * n + px] = 0; } }
    }
    return h;
  });
  const perfMapC = once('perfMap', () => {
    const n = 256, c = makeCanvas(n, n), g = c.getContext('2d'); const img = g.createImageData(n, n); const h = perfHeight; const m = mottled(n, [166, 140, 106], 0.12, 22, 5).getContext('2d').getImageData(0, 0, n, n).data;
    for (let i = 0; i < n * n; i++) { const k = h[i] > 0.3 ? 1 : 0.22; img.data[i * 4] = m[i * 4] * k; img.data[i * 4 + 1] = m[i * 4 + 1] * k; img.data[i * 4 + 2] = m[i * 4 + 2] * k; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); return c;
  });
  const perfNormalC = once('perfN', () => {
    const n = 256; const base = voronoiHeight(n, 34, 5); const h = new Float32Array(n * n);
    for (let i = 0; i < h.length; i++) h[i] = perfHeight[i] * 0.9 + base[i] * 0.1;
    return heightToNormal(h, n, n, 2.0);
  });
  const leatherPerf = leather.clone();
  leatherPerf.map = tile(perfMapC, 4); leatherPerf.normalMap = tile(perfNormalC, 4, false); leatherPerf.normalScale = new THREE.Vector2(0.9, 0.9);

  // stitching thread: slightly darker, matte
  const thread = new THREE.MeshStandardMaterial({ color: 0x8c7653, roughness: 0.85, metalness: 0 });

  // tan injection-molded plastic with a fine leather-like grain (door cards, dash pad, trim)
  const plasticN = tile(heightToNormal(noiseField(256, 256, 64, 11, 3, 0.6), 256, 256, 0.8), 1.6, false);
  const tanPlastic = new THREE.MeshStandardMaterial({ color: 0x9a8a6a, roughness: 0.62, metalness: 0, normalMap: plasticN, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.7 });
  const tanDash = new THREE.MeshStandardMaterial({ color: 0x8a7c5f, roughness: 0.7, metalness: 0, normalMap: plasticN, normalScale: new THREE.Vector2(1.0, 1.0), envMapIntensity: 0.6 });
  const tanSoft = new THREE.MeshStandardMaterial({ color: 0x95845f, roughness: 0.55, metalness: 0, normalMap: grainN, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.7 }); // vinyl wrapped door card panels
  const graphite = new THREE.MeshStandardMaterial({ color: 0x25272a, roughness: 0.5, metalness: 0, normalMap: plasticN, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0f1011, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 });
  const blackSoft = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.8, metalness: 0, normalMap: plasticN, normalScale: new THREE.Vector2(0.5, 0.5) });
  const satin = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.38, metalness: 0.9, envMapIntensity: 1.1 }); // satin silver trim
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f6, metalness: 1, roughness: 0.08, envMapIntensity: 1.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.9, metalness: 0 });
  const rubberGrip = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.78, metalness: 0, normalMap: grainN, normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.5, metalness: 0.8 });
  const whitePaint = new THREE.MeshPhysicalMaterial({ color: 0xf3f3ef, roughness: 0.4, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const bodyPaintInner = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });

  // carpet
  const carpetN = once('carpetN', () => { const n = 256; const f = noiseField(n, n, 90, 31, 2, 0.8); const g = noiseField(n, n, 20, 32, 3, 0.5); const h = new Float32Array(n * n); for (let i = 0; i < h.length; i++) h[i] = f[i] * 0.7 + g[i] * 0.3; return heightToNormal(h, n, n, 1.4); });
  const carpet = new THREE.MeshStandardMaterial({ color: 0x8c7c5d, roughness: 0.97, metalness: 0, map: tile(mottled(256, [200, 192, 168], 0.28, 33, 40), 10), normalMap: tile(carpetN, 6, false), normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 0.25 });

  // all-weather rubber floor mat: ribbed with a raised border
  const matC = once('mat', () => {
    const n = 256, h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = (y % 32) / 32; h[y * n + x] = r < 0.62 ? 1 : 0.15 + 0.85 * Math.abs(Math.sin(r * 6)) * 0; }
    return heightToNormal(h, n, n, 1.6);
  });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.86, metalness: 0, normalMap: tile(matC, 3.5, false), normalScale: new THREE.Vector2(1, 1), envMapIntensity: 0.3 });
  // diamond plate (pedal area on the mats in IMG_2871)
  const diamondC = once('diamond', () => {
    const n = 256, h = new Float32Array(n * n); const cell = 64;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const cx = i * cell + cell / 2, cy = j * cell + cell / 2, ang = (i + j) % 2 ? Math.PI / 4 : -Math.PI / 4;
      for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) {
        const rx = x * Math.cos(ang) + y * Math.sin(ang), ry = -x * Math.sin(ang) + y * Math.cos(ang);
        if (Math.abs(rx) < 22 && Math.abs(ry) < 5) { const px = (cx + x + n) % n, py = (cy + y + n) % n; h[py * n + px] = Math.max(h[py * n + px], 1 - Math.abs(ry) / 6); }
      }
    }
    return heightToNormal(h, n, n, 3);
  });
  const diamondMat = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.7, metalness: 0, normalMap: tile(diamondC, 4, false), normalScale: new THREE.Vector2(1, 1), envMapIntensity: 0.3 });

  // headliner cloth: light tan, fine weave
  const clothN = tile(heightToNormal(noiseField(256, 256, 110, 41, 2, 0.7), 256, 256, 1.3), 1.2, false);
  const headliner = new THREE.MeshStandardMaterial({ color: 0xb4a787, roughness: 0.95, metalness: 0, normalMap: clothN, normalScale: new THREE.Vector2(0.3, 0.3), side: THREE.DoubleSide, envMapIntensity: 0.4 });
  const tanSeat = headliner.clone(); tanSeat.color = new THREE.Color(0x9b8b69);

  const glassClear = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, envMapIntensity: 1.6, ior: 1.5, side: THREE.DoubleSide, depthWrite: false });
  const mirrorGlass = new THREE.MeshStandardMaterial({ color: 0xb9c0c4, metalness: 1, roughness: 0.05, envMapIntensity: 1.4 });
  const webbing = new THREE.MeshStandardMaterial({ color: 0x9d8d6b, roughness: 0.9, metalness: 0, normalMap: clothN, normalScale: new THREE.Vector2(0.8, 0.8), side: THREE.DoubleSide });
  const lampLens = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.3, metalness: 0 });
  const fabricDark = new THREE.MeshStandardMaterial({ color: 0x1a1a1b, roughness: 0.95, metalness: 0, normalMap: clothN, normalScale: new THREE.Vector2(1, 1) });

  const graphiteSat = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.4, metalness: 0.7, envMapIntensity: 1.0 });
  const knob = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.42, metalness: 0.15, normalMap: plasticN, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.9 });
  const tanSeam = new THREE.MeshStandardMaterial({ color: 0x7d6e53, roughness: 0.9, metalness: 0 });
  const tanSoftTwo = tanDash.clone(); tanSoftTwo.side = THREE.DoubleSide;
  const redBtn = new THREE.MeshStandardMaterial({ color: 0xb01a1a, roughness: 0.4, metalness: 0 });
  const rubberMatBS = rubberMat.clone(); rubberMatBS.side = THREE.BackSide;
  const meshGray = new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 0.55, metalness: 0.5, normalMap: tile(heightToNormal(noiseField(128, 128, 32, 51, 2, 0.4), 128, 128, 3), 0.6, false), envMapIntensity: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.3, metalness: 1 });
  const wheelGrain = grainN.clone(); wheelGrain.repeat.set(36, 2.4); wheelGrain.needsUpdate = true;
  const wheelLeather = new THREE.MeshPhysicalMaterial({ color: 0x232426, roughness: 0.5, metalness: 0, normalMap: wheelGrain, normalScale: new THREE.Vector2(0.9, 0.9), clearcoat: 0.18, clearcoatRoughness: 0.4, envMapIntensity: 0.8 });
  const wheelThread = new THREE.MeshStandardMaterial({ color: 0x5b5a55, roughness: 0.8, metalness: 0 });
  const wheelPlastic = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.55, metalness: 0, normalMap: grainN, normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 0.8 });
  const shiftHandle = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 0.42, metalness: 0.1, normalMap: plasticN, normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.9 });
  return {
    redBtn, rubberMatBS, meshGray, graphiteSat, knob, tanSeam, tanSoftTwo, brass, wheelLeather, wheelThread, wheelPlastic, shiftHandle,
    leather, leatherPerf, thread, tanPlastic, tanDash, tanSoft, graphite, black, blackSoft, satin, chrome, rubber, rubberGrip, steel, whitePaint, bodyPaintInner,
    carpet, rubberMat, diamondMat, headliner, tanSeat, glassClear, mirrorGlass, webbing, lampLens, fabricDark,
    _tile: tile,
  };
}
