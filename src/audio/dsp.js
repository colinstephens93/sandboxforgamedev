// Pure DSP helpers for the audio module: no Web Audio, no DOM, so everything here runs in Node (unit tests, offline checks).
// Seeded random numbers, RBJ biquads on Float32Array, an FFT with a Welch spectrum, procedural sound-grain renderers
// (combustion knock, compression thump, piston slap) and the shop's procedural impulse response with an RT60 estimator.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// approximately normal(0,1) from a uniform generator (sum of 4 uniforms, variance 1/3 each, rescaled)
export function gauss(rnd) { return (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508; }

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function whiteNoise(n, seed = 1) {
  const r = mulberry32(seed); const o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = r() * 2 - 1;
  return o;
}

// Brown (red) noise: leaky integration of white noise, normalised to peak 1. Used for rumble and rolling sounds.
export function brownNoise(n, seed = 2) {
  const w = whiteNoise(n, seed); const o = new Float32Array(n); let y = 0, pk = 1e-9;
  for (let i = 0; i < n; i++) { y = 0.985 * y + 0.12 * w[i]; o[i] = y; if (Math.abs(y) > pk) pk = Math.abs(y); }
  for (let i = 0; i < n; i++) o[i] /= pk;
  return o;
}

// RBJ cookbook biquad coefficients, normalised so a0 = 1
export function biquadCoefs(type, sr, f, Q = 0.7071, gainDb = 0) {
  const w0 = 2 * Math.PI * clamp(f, 1, sr * 0.49) / sr, c = Math.cos(w0), s = Math.sin(w0), al = s / (2 * Q);
  let b0, b1, b2, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  if (type === 'lowpass') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else if (type === 'bandpass') { b0 = al; b1 = 0; b2 = -al; } // constant 0 dB peak gain
  else throw new Error('biquad type ' + type);
  void gainDb;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

export function biquad(x, type, sr, f, Q) {
  const { b0, b1, b2, a1, a2 } = biquadCoefs(type, sr, f, Q);
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

// zero-phase filtering (forward then backward): magnitude |H|^2, no phase shift, so band splits made by subtraction are exact
export function biquadZeroPhase(x, type, sr, f, Q) {
  const y = biquad(x, type, sr, f, Q); y.reverse();
  const z = biquad(y, type, sr, f, Q); z.reverse();
  return z;
}

// ---------------------------------------------------------------- FFT and spectra (radix-2, in place)
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

// Welch power spectrum (Hann window, 50 percent overlap). Returns { freq, pow, df } with pow in amplitude^2 per bin.
export function powerSpectrum(x, sr, nfft = 16384) {
  const win = new Float64Array(nfft); let wsum = 0;
  for (let i = 0; i < nfft; i++) { win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (nfft - 1)); wsum += win[i] * win[i]; }
  const half = nfft / 2, pow = new Float64Array(half + 1); let segs = 0;
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  for (let s = 0; s + nfft <= x.length; s += nfft / 2) {
    for (let i = 0; i < nfft; i++) { re[i] = x[s + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k <= half; k++) pow[k] += (re[k] * re[k] + im[k] * im[k]) / wsum;
    segs++;
  }
  if (segs === 0) throw new Error('signal shorter than fft size');
  for (let k = 0; k <= half; k++) pow[k] /= segs;
  const freq = new Float64Array(half + 1); for (let k = 0; k <= half; k++) freq[k] = k * sr / nfft;
  return { freq, pow, df: sr / nfft };
}

// strongest bin between f1 and f2 and how far it stands above the median level of a wider band around it
export function peakIn(spec, f1, f2, medianBand = 400) {
  const { freq, pow, df } = spec; let best = -1, bp = 0;
  for (let k = Math.floor(f1 / df); k <= Math.ceil(f2 / df); k++) if (pow[k] > bp) { bp = pow[k]; best = k; }
  const lo = Math.max(1, Math.floor((freq[best] - medianBand) / df)), hi = Math.min(pow.length - 1, Math.ceil((freq[best] + medianBand) / df));
  const arr = Array.from(pow.subarray(lo, hi + 1)).sort((a, b) => a - b); const med = arr[arr.length >> 1] || 1e-30;
  return { hz: freq[best], pow: bp, prominenceDb: 10 * Math.log10(bp / med) };
}

export const rms = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length)); };
export const toDb = (v) => 20 * Math.log10(Math.max(v, 1e-12));
export const peakAbs = (x) => { let m = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; } return m; };
export const hasNaN = (x) => { for (let i = 0; i < x.length; i++) if (!Number.isFinite(x[i])) return true; return false; };

// ---------------------------------------------------------------- sound grains
// Diesel combustion knock. A short pressure rise (the premixed burn after the ignition delay) rings the block:
//  * injector tick: a 2 ms broadband click from the solenoid/needle just before the burn,
//  * knock: noise band-limited to 1.5-4 kHz with a fast attack and a few ms of decay,
//  * thump: the block / crankcase resonance, a decaying 60-200 Hz tone that sags slightly in pitch.
// Cold engines have a longer ignition delay: more premixed fuel burns at once, so the knock is harder and rings longer
// with a second, smaller burst (secondary > 0).
export function renderKnock(sr, o = {}) {
  const { seed = 1, fc = 2400, q = 1.3, thumpHz = 120, thumpAmp = 0.45, noiseAmp = 1.0, tau = 0.007, tickAmp = 0.3, secondary = 0, amp = 1, len = 0.09 } = o;
  const n = Math.floor(sr * len), rnd = mulberry32(seed), pad = 400;
  const w = new Float32Array(n + pad); for (let i = 0; i < w.length; i++) w[i] = rnd() * 2 - 1;
  const bp = biquad(w, 'bandpass', sr, fc, q);
  const t0 = 0.0018, t1 = t0 + 0.0065;
  const w2 = new Float32Array(n + pad); for (let i = 0; i < w2.length; i++) w2[i] = rnd() * 2 - 1;
  const tickBp = biquad(w2, 'bandpass', sr, 5500, 0.8); // the injector tick: solenoid and needle click, 3-8 kHz
  const kn = new Float32Array(n), th = new Float32Array(n), tk = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (t >= t0) { const u = t - t0; kn[i] += bp[i + pad] * (1 - Math.exp(-u / 0.0009)) * Math.exp(-u / tau); }
    if (secondary > 0 && t >= t1) { const u = t - t1; kn[i] += secondary * bp[(i + pad * 2) % w.length] * (1 - Math.exp(-u / 0.0008)) * Math.exp(-u / (tau * 0.9)); }
    if (t >= 0.0012) {
      const u = t - 0.0012, f = thumpHz * (1 - 0.12 * (1 - Math.exp(-u / 0.03)));
      phase += 2 * Math.PI * f / sr;
      th[i] = Math.sin(phase) * (1 - Math.exp(-u / 0.002)) * Math.exp(-u / 0.022);
    }
    if (t < 0.003) tk[i] = tickBp[i + pad] * Math.exp(-t / 0.0006);
  }
  // each part is scaled to its own peak (noise burst, block thump, injector tick), so the timbre balance is explicit
  normalizePeak(kn, noiseAmp * amp); normalizePeak(th, thumpAmp * amp); normalizePeak(tk, tickAmp * amp);
  const out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = kn[i] + th[i] + tk[i];
  return out;
}

// Compression stroke while cranking: air chuffing through the intake plus the dull thump as the piston climbs against
// 17.5:1 compression; the starter slows on each one.
export function renderCompression(sr, o = {}) {
  const { seed = 3, f = 66, amp = 1, len = 0.16 } = o;
  const n = Math.floor(sr * len), rnd = mulberry32(seed), out = new Float32Array(n), w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = rnd() * 2 - 1;
  const lp = biquad(w, 'lowpass', sr, 520, 0.8); let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; phase += 2 * Math.PI * f / sr;
    out[i] = lp[i] * 0.9 * (1 - Math.exp(-t / 0.012)) * Math.exp(-t / 0.035) + Math.sin(phase) * (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.045);
  }
  return normalizePeak(out, amp);
}

// Piston slap: a worn piston rocking in its bore, a hard metallic clonk with a mid ring (about 450 Hz and 1.9 kHz).
export function renderSlap(sr, o = {}) {
  const { seed = 5, amp = 1, len = 0.12 } = o;
  const n = Math.floor(sr * len), rnd = mulberry32(seed), out = new Float32Array(n), w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = rnd() * 2 - 1;
  const bp = biquad(w, 'bandpass', sr, 1900, 1.8);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    out[i] = bp[i] * 1.6 * (1 - Math.exp(-t / 0.0005)) * Math.exp(-t / 0.006) +
      Math.sin(2 * Math.PI * 455 * t) * Math.exp(-t / 0.03) * (1 - Math.exp(-t / 0.001)) * 0.7 +
      Math.sin(2 * Math.PI * 128 * t) * Math.exp(-t / 0.035) * 0.5;
  }
  return normalizePeak(out, amp);
}

function normalizePeak(x, amp) {
  let pk = 1e-9; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pk) pk = a; }
  const k = amp / pk; for (let i = 0; i < x.length; i++) x[i] *= k;
  return x;
}

// ---------------------------------------------------------------- shop reverb
// A large steel building with a concrete floor: about 24 x 18 x 6 m. Pre-delay 20 ms, a handful of early reflections
// (wall bounces at 6-10 m path differences), then a diffuse noise tail whose decay time depends on frequency: concrete and
// steel are nearly rigid, so lows ring longest, and air absorption shortens the highs.
export const IR_DEFAULTS = { preDelay: 0.02, rt60Low: 1.65, rt60Mid: 1.55, rt60High: 0.7, lowFc: 450, highFc: 2800, length: 2.4 };

export function renderImpulseResponse(sr, o = {}) {
  const P = { ...IR_DEFAULTS, ...o }, n = Math.floor(sr * P.length), pre = Math.floor(sr * P.preDelay), chans = [];
  for (let c = 0; c < 2; c++) {
    const rnd = mulberry32((o.seed || 11) + c * 101), w = new Float32Array(n - pre);
    for (let i = 0; i < w.length; i++) w[i] = rnd() * 2 - 1;
    // exact complementary band split with zero-phase filters (lo + mid + hi == w): each band keeps its own decay time
    const lo = biquadZeroPhase(w, 'lowpass', sr, P.lowFc, 0.7), lm = biquadZeroPhase(w, 'lowpass', sr, P.highFc, 0.7), ch = new Float32Array(n);
    const kLow = 6.9078 / P.rt60Low, kMid = 6.9078 / P.rt60Mid, kHigh = 6.9078 / P.rt60High;
    const dL = Math.exp(-kLow / sr), dM = Math.exp(-kMid / sr), dH = Math.exp(-kHigh / sr), dR = Math.exp(-1 / (0.003 * sr));
    let eL = 1, eM = 1, eH = 1, rise = 0, rr = 1; // exponential decays by recurrence (cheap), 3 ms rise so the tail does not click
    for (let i = 0; i < w.length; i++) {
      const mid = lm[i] - lo[i], hi = w[i] - lm[i];
      rr *= dR; rise = 1 - rr;
      ch[pre + i] = rise * (0.9 * lo[i] * eL + 1.0 * mid * eM + 0.6 * hi * eH); // band amplitudes give a gently tilted spectrum
      eL *= dL; eM *= dM; eH *= dH;
    }
    // early reflections: delays after the direct sound (ms) and relative strength, different per ear
    const taps = [[9, 0.28], [16, 0.22], [24, 0.2], [35, 0.16], [47, 0.14], [58, 0.12]];
    for (const [ms, a] of taps) {
      const idx = pre + Math.floor(sr * (ms + (c ? 2.3 : -1.1)) / 1000), sgn = rnd() < 0.5 ? -1 : 1;
      if (idx < n - 3) { ch[idx] += sgn * a * 0.5; ch[idx + 1] += sgn * a * 0.25; ch[idx + 2] -= sgn * a * 0.1; }
    }
    chans.push(ch);
  }
  // normalise the tail's level to a fixed RMS so wet gain is predictable
  let e = 0; for (const ch of chans) for (let i = 0; i < ch.length; i++) e += ch[i] * ch[i];
  const k = 0.08 / Math.sqrt(e / (2 * n)); for (const ch of chans) for (let i = 0; i < ch.length; i++) ch[i] *= k;
  return { channels: chans, length: n, sr };
}

// energy in consecutive windows of a signal
export function windowEnergies(x, sr, winSec, startSec = 0, endSec = Infinity) {
  const w = Math.floor(sr * winSec), a = Math.floor(sr * startSec), b = Math.min(x.length, Math.floor(sr * endSec)), out = [];
  for (let s = a; s + w <= b; s += w) { let e = 0; for (let i = s; i < s + w; i++) e += x[i] * x[i]; out.push(e); }
  return out;
}

// RT60 from the Schroeder backward-integrated energy decay curve: slope between -5 and -25 dB extrapolated to -60 dB (T20).
export function schroederRt60(x, sr) {
  const n = x.length, edc = new Float64Array(n); let acc = 0;
  for (let i = n - 1; i >= 0; i--) { acc += x[i] * x[i]; edc[i] = acc; }
  const db = (i) => 10 * Math.log10(edc[i] / edc[0] + 1e-30);
  let i5 = -1, i25 = -1;
  for (let i = 0; i < n; i++) { const d = db(i); if (i5 < 0 && d <= -5) i5 = i; if (d <= -25) { i25 = i; break; } }
  if (i5 < 0 || i25 < 0) return NaN;
  return ((i25 - i5) / sr) * (60 / 20);
}
