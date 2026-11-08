// Badges, decals and the fuel filler door of the 2005 Silverado 2500HD LT (increment 2.5 / 3.1).
//  * DURAMAX (black plate, red end) above the chrome 2500HD with its bowtie, on each front door at the front-lower corner,
//    just behind the fender gap (reference/05b-door-badge.jpg, IMG_2851, IMG_2862).
//  * chrome SILVERADO + bowtie for the lower left of the tailgate (placed by rear.js, it has to move with the gate).
//  * 4x4 decal (silver italic 4s with a red X) on each bedside ahead of the taillamp (reference/05d-4x4-decal.jpg).
//  * the round fuel filler door on the DRIVER side bedside with a real hinge, and the filler cap behind it.
// Everything is authored in inches in the truck frame (x lateral, +x passenger, y up, z = s rearward) inside a group
// scaled by IN_TO_M, so the returned groups can be added straight to the truck root.
// Raised lettering: artwork is drawn on a canvas, the alpha/height mask drives a fine displaced grid (real relief),
// the colour canvas carries the chrome gradient and the dark inlay. Nothing is downloaded.
import * as THREE from 'three';
import { halfWidth, IN_TO_M, ST, H } from './skin.js';
import { makeCanvas } from '../core/proc.js';
import { roundedBoxGeometry } from '../core/geom.js';

const IN = IN_TO_M;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hasDom = () => typeof document !== 'undefined';

// ---------------------------------------------------------------------------------------------------------------
// Placement data (inches, truck frame). Read from the photos; estimates are listed in ACCURACY.md by the integrator.
export const BADGE_PLACEMENT = {
  // door badges: front door, lower FRONT corner next to the fender gap (05b, IMG_2851, IMG_2862)
  door2500: { s: 29.8, y: 37.6, w: 9.0, h: 1.2 },
  doorDuramax: { s: 30.0, y: 39.1, w: 4.4, h: 0.9 },
  // 4x4 decal on the bedside, ahead of the taillamp
  decal4x4: { s: 179.2, y: 42.0, w: 11.0, h: 4.7 },
  // fuel filler door, driver side, ahead of the rear wheel opening (IMG_2862)
  fuelDoor: { s: 120.2, y: 40.2, r: 3.55 },
  // tailgate badge, gate-local: x measured from the center (negative = driver side seen from behind), v above the hinge line
  silverado: { x: -23.9, v: 0.9, w: 17.6, h: 2.1 },
};

// ---------------------------------------------------------------------------------------------------------------
// Stroke font for the badge lettering: squarish, slightly extended capitals like the GM badge face (not Helvetica).
// Glyph = { w, paths }, 8 units tall, paths are polylines (last point repeated to close).
const G = {
  S: { w: 5, p: [[[5, 1.2], [4, 0], [1, 0], [0, 1], [0, 3], [1, 4], [4, 4], [5, 5], [5, 7], [4, 8], [1, 8], [0, 6.8]]] },
  I: { w: 0, p: [[[0, 0], [0, 8]]] },
  L: { w: 5, p: [[[0, 0], [0, 8], [5, 8]]] },
  V: { w: 5, p: [[[0, 0], [2.5, 8], [5, 0]]] },
  E: { w: 5, p: [[[5, 0], [0, 0], [0, 8], [5, 8]], [[0, 4], [4, 4]]] },
  R: { w: 5, p: [[[0, 8], [0, 0], [4, 0], [5, 1], [5, 3], [4, 4], [0, 4]], [[2.4, 4], [5, 8]]] },
  A: { w: 5, p: [[[0, 8], [0, 1], [1, 0], [4, 0], [5, 1], [5, 8]], [[0, 4.6], [5, 4.6]]] },
  D: { w: 5, p: [[[0, 0], [0, 8], [3.8, 8], [5, 7], [5, 1], [3.8, 0], [0, 0]]] },
  O: { w: 5, p: [[[1, 0], [4, 0], [5, 1], [5, 7], [4, 8], [1, 8], [0, 7], [0, 1], [1, 0]]] },
  U: { w: 5, p: [[[0, 0], [0, 7], [1, 8], [4, 8], [5, 7], [5, 0]]] },
  M: { w: 5, p: [[[0, 8], [0, 0], [2.5, 4.2], [5, 0], [5, 8]]] },
  X: { w: 5, p: [[[0, 0], [5, 8]], [[5, 0], [0, 8]]] },
  H: { w: 5, p: [[[0, 0], [0, 8]], [[5, 0], [5, 8]], [[0, 4], [5, 4]]] },
  2: { w: 5, p: [[[0, 1], [1, 0], [4, 0], [5, 1], [5, 3], [0, 8], [5, 8]]] },
  5: { w: 5, p: [[[5, 0], [0, 0], [0, 3.6], [4, 3.6], [5, 4.6], [5, 7], [4, 8], [1, 8], [0, 7]]] },
  0: { w: 5, p: [[[1, 0], [4, 0], [5, 1], [5, 7], [4, 8], [1, 8], [0, 7], [0, 1], [1, 0]]] },
};

const KERN = { LV: -2.0, VE: -0.3, RA: -0.3 };
const kern = (text, i) => (i > 0 ? (KERN[text[i - 1] + text[i]] || 0) : 0);
const wordUnits = (text, xs, gap) => [...text].reduce((a, ch, i) => a + G[ch].w * xs + kern(text, i) * xs, 0) + gap * xs * (text.length - 1);
// lay out and draw a word; returns its width in glyph units. mode 'color' draws chrome rim + dark inlay, 'mask' a white silhouette
function drawWord(ctx, text, { x, y, k, xs = 1, gap = 2.6, lw = 1.5, skew = 0, mode = 'color', gradient, inlay = '#17181a', level = 255 }) {
  let cx = 0;
  const widths = [...text].map((ch) => (G[ch].w) * xs);
  const total = widths.reduce((a, b) => a + b, 0) + gap * xs * (text.length - 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, -skew, 1, 0, 0);
  ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  const strokeAll = (width, style) => {
    ctx.lineWidth = width * k; ctx.strokeStyle = style;
    let px = 0;
    [...text].forEach((ch, i) => {
      for (const path of G[ch].p) {
        ctx.beginPath();
        path.forEach(([gx, gy], n) => { const X = (px + gx * xs) * k, Y = (gy - 4) * k; n ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.stroke();
      }
      px += widths[i] + gap * xs + kern(text, i + 1) * xs;
    });
  };
  const c = `rgb(${level},${level},${level})`;
  if (mode === 'mask') strokeAll(lw, c);
  else { strokeAll(lw, gradient || '#d8dadd'); strokeAll(lw * 0.3, inlay); }
  ctx.restore();
  return total;
}

function chromeGradient(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fafbfc'); g.addColorStop(0.42, '#aeb3b8'); g.addColorStop(0.55, '#7d8288'); g.addColorStop(0.62, '#d4d7da'); g.addColorStop(1, '#eef0f2');
  return g;
}

const BOW = [[-1, 0.13], [-0.34, 0.2], [-0.22, 0.34], [0.22, 0.34], [0.34, 0.2], [1, 0.13], [1, -0.13], [0.34, -0.2], [0.22, -0.34], [-0.22, -0.34], [-0.34, -0.2], [-1, -0.13]];
function drawBowtie(ctx, cx, cy, w, mode, level = 255) {
  const k = w / 2;
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath(); BOW.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, -y * k) : ctx.moveTo(x * k, -y * k))); ctx.closePath();
  if (mode === 'mask') { ctx.fillStyle = `rgb(${level},${level},${level})`; ctx.fill(); }
  else {
    ctx.fillStyle = chromeGradient(ctx, -0.34 * k, 0.34 * k); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, w * 0.045); ctx.strokeStyle = '#303236'; ctx.stroke();
    // the center band of the real bowtie badge is a recessed darker field
    ctx.beginPath(); ctx.moveTo(-0.22 * k, -0.34 * k * 0.0); ctx.fillStyle = 'rgba(40,42,46,0.55)';
    ctx.fillRect(-0.04 * k, -0.3 * k, 0.08 * k, 0.6 * k);
  }
  ctx.restore();
}

function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ---------------------------------------------------------------------------------------------------------------
// Relief badge: displaced grid driven by the mask canvas, textured by the colour canvas.
// place(a, b, h) -> THREE.Vector3 (inches) for badge-plane coordinates a (reading direction), b (up), h (relief above the surface).
function reliefBadge({ wIn, hIn, ppi = 150, cell = 0.055, relief = 0.085, art, place, flipWinding = false, name, metalness = 0.9, roughness = 0.2 }) {
  const W = Math.max(8, Math.round(wIn * ppi)), Hh = Math.max(8, Math.round(hIn * ppi));
  const colorC = makeCanvas(W, Hh), maskC = makeCanvas(W, Hh);
  const cc = colorC.getContext('2d'), mc = maskC.getContext('2d');
  mc.fillStyle = '#000'; mc.fillRect(0, 0, W, Hh);
  art(cc, W, Hh, 'color', ppi); art(mc, W, Hh, 'mask', ppi);
  // alpha for the colour map comes from the mask (anything above level 8 is badge)
  const md = mc.getImageData(0, 0, W, Hh).data;
  const cd = cc.getImageData(0, 0, W, Hh);
  const hgt = new Float32Array(W * Hh);
  for (let i = 0; i < W * Hh; i++) { const m = md[i * 4]; hgt[i] = m / 255; cd.data[i * 4 + 3] = m > 10 ? 255 : 0; }
  cc.putImageData(cd, 0, 0);
  // two box blur passes soften the stair-steps into a bevel
  const blur = (src) => { const o = new Float32Array(src.length); for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < Hh) { s += src[yy * W + xx]; n++; } } o[y * W + x] = s / n; } return o; };
  const hb = blur(blur(hgt));
  const sample = (u, v) => { const fx = clamp(u * (W - 1), 0, W - 1), fy = clamp((1 - v) * (Hh - 1), 0, Hh - 1); const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(Hh - 1, y0 + 1); const tx = fx - x0, ty = fy - y0; return lerp(lerp(hb[y0 * W + x0], hb[y0 * W + x1], tx), lerp(hb[y1 * W + x0], hb[y1 * W + x1], tx), ty); };
  const nx = Math.max(2, Math.round(wIn / cell)), ny = Math.max(2, Math.round(hIn / cell));
  const pos = new Float32Array((nx + 1) * (ny + 1) * 3), uv = new Float32Array((nx + 1) * (ny + 1) * 2);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny; // v = 0 bottom
    const h = sample(u, v) * relief;
    const p = place((u - 0.5) * wIn, (v - 0.5) * hIn, h);
    const k = j * (nx + 1) + i;
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; uv[k * 2] = u; uv[k * 2 + 1] = v;
  }
  const idx = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1;
    if (flipWinding) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const map = new THREE.CanvasTexture(colorC); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.needsUpdate = true;
  const m = new THREE.MeshPhysicalMaterial({ map, metalness, roughness, envMapIntensity: 2.4, alphaTest: 0.5, side: THREE.DoubleSide, clearcoat: 0.3 });
  const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.castShadow = false; mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------------------------------------------
// artwork
function art2500HD(ctx, W, Hh, mode) {
  ctx.clearRect(0, 0, W, Hh);
  const bw = Hh * 1.2;                      // bowtie width
  const x0 = bw * 1.28, gap = 2.2, xs = 1.0, lw = 1.5;
  const k = Math.min((Hh * 0.8) / 8, (W * 0.985 - x0 - lw * 0.5 * 20) / wordUnits('2500HD', xs, gap));
  drawBowtie(ctx, bw * 0.55, Hh / 2, bw, mode, 255);
  const gradient = mode === 'color' ? chromeGradient(ctx, Hh * 0.1, Hh * 0.9) : null;
  drawWord(ctx, '2500HD', { x: x0, y: Hh / 2, k, xs, gap, lw, skew: 0.08, mode, gradient });
}
function artDuramax(ctx, W, Hh, mode) {
  ctx.clearRect(0, 0, W, Hh);
  const r = Hh * 0.18;
  // plate: chrome rim, black field, red block at the right end
  rrPath(ctx, 1, 1, W - 2, Hh - 2, r);
  if (mode === 'mask') { ctx.fillStyle = 'rgb(150,150,150)'; ctx.fill(); }
  else {
    ctx.fillStyle = chromeGradient(ctx, 0, Hh); ctx.fill();
    const inset = Hh * 0.1;
    rrPath(ctx, inset, inset, W - 2 * inset, Hh - 2 * inset, r * 0.6); ctx.fillStyle = '#0d0e10'; ctx.fill();
    ctx.save(); rrPath(ctx, inset, inset, W - 2 * inset, Hh - 2 * inset, r * 0.6); ctx.clip();
    const rx = W * 0.74; const gr = ctx.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#d0302a'); gr.addColorStop(1, '#8e1612');
    ctx.fillStyle = gr; ctx.fillRect(rx, 0, W - rx, Hh); ctx.restore();
  }
  const x0 = W * 0.06, gap = 1.8, xs = 0.94, lw = 1.35;
  const k = Math.min((Hh * 0.46) / 8, (W * 0.67 - x0) / wordUnits('DURAMAX', xs, gap));
  drawWord(ctx, 'DURAMAX', { x: x0, y: Hh / 2, k, xs, gap, lw, mode, gradient: '#d6d9dc', inlay: '#d6d9dc', level: 255 });
}
function artSilverado(ctx, W, Hh, mode) {
  ctx.clearRect(0, 0, W, Hh);
  const bw = Hh * 1.45, x0 = bw * 1.2, gap = 2.2, xs = 1.24, lw = 1.95;
  const k = Math.min((Hh * 0.78) / 8, (W * 0.985 - x0 - Hh * 0.25) / wordUnits('SILVERADO', xs, gap));
  drawBowtie(ctx, bw * 0.52, Hh / 2, bw, mode, 255);
  const gradient = mode === 'color' ? chromeGradient(ctx, Hh * 0.1, Hh * 0.9) : null;
  drawWord(ctx, 'SILVERADO', { x: x0, y: Hh / 2, k, xs, gap, lw, skew: 0.1, mode, gradient });
}

function drawFour(ctx, ox, oy, sx, sy, skew) {
  // italic 4 as in the decal: a bar rising to the upper right, crossbar and stem; coordinates in a 10 x 12 box
  const P = [[6.2, 0], [8.4, 0], [8.4, 6.5], [10, 6.5], [10, 8.7], [8.4, 8.7], [8.4, 12], [5.9, 12], [5.9, 8.7], [0, 8.7], [0, 7.1]];
  ctx.save(); ctx.translate(ox, oy); ctx.transform(1, 0, -skew, 1, 0, 0); ctx.scale(sx, sy);
  ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.moveTo(5.9, 2.9); ctx.lineTo(5.9, 6.5); ctx.lineTo(2.9, 6.5); ctx.closePath();
  ctx.fill('evenodd');
  ctx.restore();
}
function art4x4(ctx, W, Hh) {
  ctx.clearRect(0, 0, W, Hh);
  const sx = (W * 0.9) / 21.5, sy = (Hh * 0.74) / 12;   // two 4s side by side, squeezed to the real decal proportions
  const x0 = W * 0.045, y0 = Hh * 0.22, adv = 10.7 * sx, skew = 0.2;
  const off = Hh * 0.035;
  ctx.fillStyle = 'rgba(52,54,58,0.95)';
  drawFour(ctx, x0 - off, y0 + off, sx, sy, skew); drawFour(ctx, x0 + adv - off, y0 + off, sx, sy, skew);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 12 * sy); g.addColorStop(0, '#d5d7da'); g.addColorStop(0.5, '#a9acb0'); g.addColorStop(1, '#8c8f94');
  ctx.fillStyle = g;
  drawFour(ctx, x0, y0, sx, sy, skew); drawFour(ctx, x0 + adv, y0, sx, sy, skew);
  // red X between the 4s, standing above the crossbars
  const cx = x0 + adv * 1.0 + 0.5 * sx * 3, cy = Hh * 0.2, r = Hh * 0.15;
  ctx.lineCap = 'butt';
  for (const [c, o, w] of [['rgba(60,12,12,0.9)', Hh * 0.025, Hh * 0.09], ['#e3261f', 0, Hh * 0.078]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(cx - r - o, cy - r + o); ctx.lineTo(cx + r - o, cy + r + o); ctx.moveTo(cx + r - o, cy - r + o); ctx.lineTo(cx - r - o, cy + r + o); ctx.stroke();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// surface-conforming placement on the side skin: badge plane (a along reading direction, b up) onto x = halfWidth(s, y)
function sideSpot(side, s0, y0, offset = 0.03) {
  const sgn = side > 0 ? -1 : 1;   // the passenger side is read toward the front (-s), the driver side toward the rear (+s)
  return (a, b, h) => {
    const s = s0 + sgn * a, y = y0 + b;
    return new THREE.Vector3(side * (halfWidth(s, y) + offset + h), y, s);
  };
}

export function buildDoorBadges({ side }) {
  const g = new THREE.Group(); g.name = `door_badges_${side > 0 ? 'R' : 'L'}`;
  const B = BADGE_PLACEMENT;
  const sgn = side > 0 ? -1 : 1;
  const bowW = B.door2500.h * 1.2, total = B.door2500.w;
  const lettersCenter = 0.5 * ((-total / 2 + bowW * 1.28) + total / 2); // center of the letter run relative to the badge center
  const hd = reliefBadge({ wIn: B.door2500.w, hIn: B.door2500.h, ppi: 190, cell: 0.05, relief: 0.07, art: art2500HD, place: sideSpot(side, B.door2500.s, B.door2500.y), flipWinding: side > 0, name: 'badge_2500hd' });
  hd.userData.labelId = 'truck.badge_2500hd';
  const dm = reliefBadge({ wIn: B.doorDuramax.w, hIn: B.doorDuramax.h, ppi: 260, cell: 0.04, relief: 0.06, art: artDuramax, metalness: 0.55, roughness: 0.3, place: sideSpot(side, B.door2500.s + sgn * lettersCenter, B.doorDuramax.y), flipWinding: side > 0, name: 'badge_duramax' });
  dm.userData.labelId = 'truck.badge_duramax';
  g.add(hd, dm);
  return g;
}

export function buildDecal4x4({ side }) {
  const B = BADGE_PLACEMENT.decal4x4;
  const ppi = 120, W = Math.round(B.w * ppi), Hh = Math.round(B.h * ppi);
  const c = makeCanvas(W, Hh); art4x4(c.getContext('2d'), W, Hh);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const place = sideSpot(side, B.s, B.y, 0.025);
  const nx = 36, ny = 14, pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const u = i / nx, v = j / ny; const p = place((u - 0.5) * B.w, (v - 0.5) * B.h, 0); pos.push(p.x, p.y, p.z); uv.push(u, v); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 2, d = a + nx + 1; if (side > 0) idx.push(a, d, b, b, d, cc); else idx.push(a, b, d, b, cc, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0.45, alphaTest: 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, envMapIntensity: 1.1 });
  const mesh = new THREE.Mesh(geo, m); mesh.name = `decal_4x4_${side > 0 ? 'R' : 'L'}`; mesh.receiveShadow = true;
  mesh.userData.labelId = 'truck.decal_4x4';
  return mesh;
}

// chrome SILVERADO badge with its bowtie in tailgate-local coordinates (x lateral, y = v above the hinge, z = w rearward).
// The caller passes the surface depth w of the outer skin there.
export function buildSilveradoBadge({ wSkin }) {
  if (!hasDom()) return null;
  const B = BADGE_PLACEMENT.silverado;
  const mesh = reliefBadge({
    wIn: B.w, hIn: B.h, ppi: 150, cell: 0.07, relief: 0.1, art: artSilverado, name: 'badge_silverado',
    place: (a, b, h) => new THREE.Vector3(B.x + a, B.v + b, wSkin + 0.03 + h),
  });
  mesh.userData.labelId = 'truck.badge_silverado';
  return mesh;
}

export function buildBadges({ quality } = {}) {
  const root = new THREE.Group(); root.name = 'badges'; root.scale.setScalar(IN);
  if (!hasDom()) return root;
  for (const side of [1, -1]) { root.add(buildDoorBadges({ side })); root.add(buildDecal4x4({ side })); }
  return root;
}

// ---------------------------------------------------------------------------------------------------------------
// Fuel filler door. The door is a round panel following the bedside skin, hinged at its forward edge on a vertical axis.
// The bedside skin is one continuous grid (no opening), so the pocket is built as a dark disc with a short filler collar standing on it;
// a 4.5 mm dark ring marks the gap around the door.
export const FUEL_DOOR_OPEN_ANGLE = (110 * Math.PI) / 180;
export const fuelDoorAngle = (open01) => clamp(open01, 0, 1) * FUEL_DOOR_OPEN_ANGLE;

export function buildFuelDoor({ side = 'L' } = {}) {
  const sd = (side === 'R' || side === 1 || side === '+x') ? 1 : -1;
  const F = BADGE_PLACEMENT.fuelDoor;
  const GAP = 4.5 / 25.4;
  const root = new THREE.Group(); root.name = `fuel_door_${sd > 0 ? 'R' : 'L'}`; root.scale.setScalar(IN);
  const yc = F.y, sHinge = F.s - F.r, sCenter = F.s;
  const surf = (s, y, off = 0) => halfWidth(s, y) + off;
  const dark = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const paintM = (() => { const p = new THREE.MeshPhysicalMaterial({ color: 0xf3f3ef, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.035, side: THREE.DoubleSide, envMapIntensity: 1 }); return p; })();
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3d41, roughness: 0.5, metalness: 0.85 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.9 });

  // polar patch conforming to the skin: radius r0..r1, offsets (outer surface) in inches
  const polar = (r0, r1, off, nr, nt, { t0 = 0, t1 = Math.PI * 2, rel = null } = {}) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= nr; j++) for (let i = 0; i <= nt; i++) {
      const r = lerp(r0, r1, j / nr), t = lerp(t0, t1, i / nt);
      const s = sCenter + r * Math.cos(t), y = yc + r * Math.sin(t);
      const x = sd * surf(s, y, typeof off === 'function' ? off(r, t) : off);
      pos.push(x - (rel ? rel.x : 0), y - (rel ? rel.y : 0), s - (rel ? rel.z : 0)); uv.push(r * Math.cos(t), r * Math.sin(t));
    }
    for (let j = 0; j < nr; j++) for (let i = 0; i < nt; i++) { const a = j * (nt + 1) + i, b = a + 1, c = a + nt + 2, d = a + nt + 1; idx.push(a, b, d, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };

  // dark ring of the panel gap + the dark pocket disc behind the door
  const ring = new THREE.Mesh(polar(F.r - 0.02, F.r + GAP, 0.025, 1, 40), dark); ring.name = 'fuel_gap_ring'; ring.receiveShadow = true; root.add(ring);
  const pocket = new THREE.Mesh(polar(0, F.r - 0.02, 0.03, 4, 40), new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide })); pocket.name = 'fuel_pocket'; root.add(pocket);
  // filler neck: black collar and the DIESEL cap
  const neck = new THREE.Group(); neck.name = 'fuel_filler';
  const sN = sCenter + 0.2, yN = yc, xN = sd * surf(sN, yN, 0.03);
  neck.position.set(xN, yN, sN);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 2.0, 0.7, 28), rubber); collar.rotation.z = Math.PI / 2; collar.position.x = sd * 0.35; neck.add(collar);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.0, 24), steel); tube.rotation.z = Math.PI / 2; tube.position.x = sd * 0.85; neck.add(tube);
  const capGeo = new THREE.CylinderGeometry(1.45, 1.5, 0.7, 28);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.55 });
  const cap = new THREE.Mesh(capGeo, capMat); cap.rotation.z = Math.PI / 2; cap.position.x = sd * 1.25; neck.add(cap);
  // yellow band and lettering on the cap top
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.1, 8, 36), new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.5 })); band.rotation.y = Math.PI / 2; band.position.x = sd * 1.55; neck.add(band);
  const capTop = new THREE.Mesh(new THREE.CircleGeometry(1.3, 28), (() => {
    let map = null;
    if (hasDom()) { const c = makeCanvas(256, 256), x = c.getContext('2d'); x.fillStyle = '#16171a'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#e6b422'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('DIESEL', 128, 118); x.font = 'bold 22px sans-serif'; x.fillText('FUEL ONLY', 128, 154); x.strokeStyle = '#e6b422'; x.lineWidth = 6; for (let a = 0; a < 6; a++) { x.beginPath(); x.moveTo(128 + 98 * Math.cos(a * 1.0472 + 0.2), 128 + 98 * Math.sin(a * 1.0472 + 0.2)); x.lineTo(128 + 110 * Math.cos(a * 1.0472 + 0.2), 128 + 110 * Math.sin(a * 1.0472 + 0.2)); x.stroke(); } map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; }
    return new THREE.MeshStandardMaterial({ color: map ? 0xffffff : 0x16171a, map, roughness: 0.6 });
  })());
  capTop.rotation.y = sd * Math.PI / 2; capTop.position.x = sd * 1.61; neck.add(capTop);
  neck.userData.labelId = 'truck.fuel_cap';
  root.add(neck);

  // the door: pivot group at the forward edge
  const pivotPos = new THREE.Vector3(sd * surf(sHinge, yc, 0), yc, sHinge);
  const door = new THREE.Group(); door.name = 'fuel_door'; door.position.copy(pivotPos);
  const rel = { x: pivotPos.x, y: pivotPos.y, z: pivotPos.z };
  const Rd = F.r - 0.03;
  const lift = 0.14;
  const outer = polar(0, Rd, (r) => lift - 0.05 * Math.pow(r / Rd, 6), 6, 48, { rel });
  const doorOuter = new THREE.Mesh(outer, paintM); doorOuter.castShadow = true; doorOuter.receiveShadow = true; doorOuter.name = 'fuel_door_outer'; door.add(doorOuter);
  // rim wall: from the outer rim down to the skin
  {
    const pos = [], idx = [], n = 48;
    for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2; const s = sCenter + Rd * Math.cos(t), y = yc + Rd * Math.sin(t); const x0 = sd * surf(s, y, lift - 0.05), x1 = sd * surf(s, y, 0.0); pos.push(x0 - rel.x, y - rel.y, s - rel.z, x1 - rel.x, y - rel.y, s - rel.z); }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const w = new THREE.Mesh(g, paintM); w.name = 'fuel_door_rim'; door.add(w);
  }
  // inner side: dark gray panel with the DIESEL FUEL ONLY label (visible when open)
  const innerMat = (() => {
    let map = null;
    if (hasDom()) { const c = makeCanvas(256, 256), x = c.getContext('2d'); x.fillStyle = '#2c2e32'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#e8c52a'; x.fillRect(48, 82, 160, 92); x.fillStyle = '#111'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText('DIESEL', 128, 126); x.font = 'bold 20px sans-serif'; x.fillText('FUEL ONLY', 128, 158); map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; }
    return new THREE.MeshStandardMaterial({ color: map ? 0xffffff : 0x2c2e32, map, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
  })();
  const inner = new THREE.Mesh(polar(0, Rd - 0.12, 0.02, 3, 40, { rel }), innerMat); inner.name = 'fuel_door_inner'; door.add(inner);
  // hinge pin barrel at the forward edge
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 12), steel); pin.position.set(sd * 0.1, 0, 0.0); pin.name = 'fuel_hinge_pin'; door.add(pin);
  root.add(door);

  const state = { open: false, anim: false };
  const set = (open01) => {
    door.rotation.y = sd * fuelDoorAngle(open01); api.open01 = clamp(open01, 0, 1);
    // the skin has no opening, so the filler neck rises out of the body as the door clears it (hidden under the door when closed)
    const k = sstep(0.12, 0.45, api.open01); neck.visible = k > 0.001; neck.scale.set(Math.max(k, 0.001), 1, 1);
  };
  const api = { group: root, door, openAngle: FUEL_DOOR_OPEN_ANGLE, open01: 0, set, hingePosition: pivotPos.clone().multiplyScalar(IN) };
  door.userData.labelId = 'truck.fuel_door';
  door.userData.interact = {
    get prompt() { return state.open ? 'Close fuel door' : 'Open fuel door'; },
    run(ctx) {
      if (state.anim) return; state.anim = true;
      const to = state.open ? 0 : 1, from = api.open01; let t = 0; const dur = 0.45;
      ctx.animate?.((dt) => {
        t += dt; const k = Math.min(1, t / dur); const e = k * k * (3 - 2 * k); set(lerp(from, to, e));
        if (k >= 1) { state.open = to === 1; state.anim = false; ctx.say?.(state.open ? 'Fuel door open: DIESEL FUEL ONLY' : 'Fuel door closed'); return true; }
        return false;
      });
    },
  };
  set(0);
  return api;
}
