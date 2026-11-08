// Pure look-ahead schedulers for combustion grains, plus the node budget. No Web Audio here: the engine asks
// "which grains fall inside [now, horizon)" and then creates the short-lived BufferSource nodes itself.
import { mulberry32, gauss, clamp } from './dsp.js';
import { FIRING_ORDER, CYLINDERS, firingHz, thinFactor } from './mapping.js';

export const LOOKAHEAD = 0.1; // seconds scheduled ahead on the AudioContext timeline
export const NODE_BUDGET_PER_SEC = 120; // created nodes per second for the steady engine layers
export const MAX_GRAIN_HZ = 60; // at most this many combustion grains per second (one BufferSource each)

// Combustion grain scheduler. A V8 four-stroke fires CYLINDERS/2 times per crank revolution in the order 1-2-7-8-4-5-6-3.
// Each cylinder has a fixed little timing offset and amplitude (injector-to-injector spread, cylinder-to-microphone
// distance, wear), plus random jitter per firing, so the clatter is irregular like a real diesel and never a drum machine.
export class FiringScheduler {
  constructor({ order = FIRING_ORDER, cylinders = CYLINDERS, seed = 7, maxHz = MAX_GRAIN_HZ } = {}) {
    this.order = order; this.cylinders = cylinders; this.maxHz = maxHz; this.rnd = mulberry32(seed);
    const r = mulberry32(seed + 1);
    this.cylOffset = {}; this.cylAmp = {};
    for (const c of order) { this.cylOffset[c] = (r() * 2 - 1) * 0.035; this.cylAmp[c] = 0.82 + 0.33 * r(); }
    this.reset();
  }
  reset() { this.nextT = null; this.idx = 0; this.slot = 0; this.lastT = -Infinity; }

  // events for firings whose slot time falls in [now, horizon). rpm below minRpm stops the train.
  plan(now, horizon, rpm, minRpm = 20) {
    const out = [];
    if (!(rpm > minRpm)) { this.nextT = null; return out; }
    const hz = firingHz(rpm, this.cylinders), T = 1 / hz, n = thinFactor(hz, this.maxHz);
    if (this.nextT == null || this.nextT < now - 0.05) this.nextT = now + 0.002;
    while (this.nextT < horizon) {
      const cyl = this.order[this.idx % this.order.length];
      const slotT = this.nextT;
      this.idx++; this.slot++; this.nextT += T;
      if ((this.slot - 1) % n !== 0) continue; // thinned: this firing is carried by the continuous layer
      const r = this.rnd;
      const t = Math.max(now, slotT + (this.cylOffset[cyl] + 0.012 * gauss(r)) * T, this.lastT + 0.0005);
      this.lastT = t;
      out.push({
        t, cyl, thin: n,
        amp: clamp(this.cylAmp[cyl] * (1 + 0.10 * gauss(r)), 0.5, 1.4),
        variant: r() < 0.5 ? 0 : 1,
        rate: clamp(1 + 0.03 * gauss(r), 0.93, 1.07),
      });
    }
    return out;
  }
}

// Simple periodic pulse train with random jitter (piston slap once per cycle, key chime repeats, ...)
export class PulseScheduler {
  constructor({ seed = 9, jitter = 0.04 } = {}) { this.rnd = mulberry32(seed); this.jitter = jitter; this.nextT = null; }
  reset() { this.nextT = null; }
  plan(now, horizon, hz) {
    const out = [];
    if (!(hz > 0.01)) { this.nextT = null; return out; }
    const T = 1 / hz;
    if (this.nextT == null || this.nextT < now - 0.05) this.nextT = now + 0.002;
    while (this.nextT < horizon) {
      out.push({ t: Math.max(now, this.nextT + this.jitter * T * gauss(this.rnd)), amp: clamp(1 + 0.15 * gauss(this.rnd), 0.6, 1.4) });
      this.nextT += T;
    }
    return out;
  }
}

// Sliding-window limiter on created audio nodes (counts nodes in the last `window` seconds).
export class NodeBudget {
  constructor(perSecond = NODE_BUDGET_PER_SEC, window = 1) { this.limit = perSecond * window; this.window = window; this.log = []; }
  used(t) {
    while (this.log.length && this.log[0][0] <= t - this.window) this.log.shift();
    let s = 0; for (const e of this.log) s += e[1];
    return s;
  }
  canAfford(n, t) { return this.used(t) + n <= this.limit; }
  take(n, t) { this.log.push([t, n]); }
  // take only if affordable
  tryTake(n, t) { if (!this.canAfford(n, t)) return false; this.take(n, t); return true; }
}
