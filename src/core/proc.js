// Procedural texture helpers: everything is generated in code (PROMPT.md section 8: no downloaded assets).
import * as THREE from 'three';

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Tileable value noise on a grid, returns Float32Array w*h in [0,1]
export function noiseField(w, h, cells, seed = 1, octaves = 4, persistence = 0.5) {
  const out = new Float32Array(w * h);
  let amp = 1, total = 0, freq = cells;
  for (let o = 0; o < octaves; o++) {
    const r = rng(seed * 131 + o * 17);
    const gw = Math.max(2, Math.round(freq)), gh = Math.max(2, Math.round(freq));
    const grid = new Float32Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * gh, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * gw, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const a = grid[(y0 % gh) * gw + (x0 % gw)], b = grid[(y0 % gh) * gw + ((x0 + 1) % gw)];
        const c = grid[((y0 + 1) % gh) * gw + (x0 % gw)], d = grid[((y0 + 1) % gh) * gw + ((x0 + 1) % gw)];
        out[y * w + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    total += amp; amp *= persistence; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

export function canvasFromField(field, w, h, fn) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const [r, gg, b, a = 255] = fn(field[i], i);
    img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Height field (Float32Array, 0..1) to tangent-space normal map canvas
export function heightToNormal(height, w, h, strength = 2) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const nx = -dx, ny = dy, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const i = (y * w + x) * 4;
    img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
    img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
    img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function tex(canvas, { repeat = [1, 1], srgb = true, aniso = 8, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

export function hex(c) { return new THREE.Color(c); }
