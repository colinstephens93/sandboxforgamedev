export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 1-D linear table lookup. table = { x: [...], y: [...] } (x ascending); clamps at the ends.
export function interp(table, x) {
  const xs = table.x, ys = table.y, n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + (ys[hi] - ys[lo]) * t;
}

// first-order lag, exact for any dt
export const lag = (cur, target, tau, dt) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

// deterministic PRNG for repeatable run-to-run jitter
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
