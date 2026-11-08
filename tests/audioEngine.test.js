import { describe, it, expect } from 'vitest';
import { AudioEngine, ONE_SHOT_NAMES, ONE_SHOT_ALIASES } from '../src/audio/index.js';

// A recording stand-in for the Web Audio API: enough surface for AudioEngine to build and run in Node. It validates what the
// real API would reject (negative times, non-finite values, exponential ramps to <= 0, bad connections) and counts nodes.
class Param {
  constructor(owner, value = 0) { this.owner = owner; this._v = value; this.calls = 0; }
  get value() { return this._v; } set value(v) { chk(v, 'value'); this._v = v; }
  _ev(name, v, t) { chk(v, name + ' value'); chk(t, name + ' time'); if (t < 0) throw new Error(name + ' negative time'); this.calls++; this.owner.ctx.paramCalls++; return this; }
  setValueAtTime(v, t) { return this._ev('setValueAtTime', v, t); }
  linearRampToValueAtTime(v, t) { return this._ev('linearRamp', v, t); }
  exponentialRampToValueAtTime(v, t) { if (!(v > 0)) throw new Error('exponentialRamp to <= 0'); return this._ev('expRamp', v, t); }
  setTargetAtTime(v, t, tc) { chk(tc, 'timeConstant'); if (tc < 0) throw new Error('negative timeConstant'); return this._ev('setTarget', v, t); }
  connect() { return this; }
}
function chk(v, what) { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`non-finite ${what}: ${v}`); }

class Node {
  constructor(ctx, kind, params = {}) {
    this.ctx = ctx; this.kind = kind; this.out = []; ctx.created++; ctx.byKind[kind] = (ctx.byKind[kind] || 0) + 1;
    for (const [k, v] of Object.entries(params)) this[k] = new Param(this, v);
  }
  connect(dest) { if (!dest || (!dest.kind && !(dest instanceof Param))) throw new Error('bad connect target'); this.out.push(dest); return dest; }
  disconnect() { this.out = []; }
  start(t = 0) { chk(t, 'start'); if (t < 0) throw new Error('start < 0'); this.started = t; }
  stop(t = 0) { chk(t, 'stop'); }
}
class MockContext {
  constructor(sr = 44100) { this.sampleRate = sr; this.currentTime = 0; this.created = 0; this.byKind = {}; this.paramCalls = 0; this.destination = new Node(this, 'destination'); this.state = 'suspended'; this.closed = false; }
  createGain() { return new Node(this, 'gain', { gain: 1 }); }
  createBufferSource() { const n = new Node(this, 'source', { playbackRate: 1 }); n.loop = false; return n; }
  createOscillator() { const n = new Node(this, 'osc', { frequency: 440, detune: 0 }); n.type = 'sine'; return n; }
  createBiquadFilter() { const n = new Node(this, 'biquad', { frequency: 350, Q: 1, gain: 0 }); n.type = 'lowpass'; return n; }
  createStereoPanner() { return new Node(this, 'panner', { pan: 0 }); }
  createConvolver() { return new Node(this, 'convolver'); }
  createDynamicsCompressor() { return new Node(this, 'compressor', { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 }); }
  createWaveShaper() { return new Node(this, 'shaper'); }
  createBuffer(ch, len, sr) { const d = Array.from({ length: ch }, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: (i) => d[i] }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
}

const IDLE = { running: true, rpm: 680, load: 0.16, qty: 8, turboRpm: 17700, vane: 0.4, boostPsi: -0.5, mAir: 0.04, driveKpa: 106, coolantF: 195 };
const WOT = { running: true, rpm: 3200, load: 1, qty: 70, turboRpm: 120000, vane: 0.64, boostPsi: 25, mAir: 0.33, driveKpa: 330, coolantF: 205, fanDuty: 1, rollerRad: 110, shopFan: true, exhaustHose: true };
const LIS = { distanceToTruck: 5, distanceToDyno: 6 };

async function make(opts = {}) {
  const ctx = new MockContext(), eng = new AudioEngine({ context: ctx, volume: 1, ...opts });
  await eng.start();
  return { ctx, eng };
}
function run(eng, ctx, st, secs, listener = LIS, fps = 60) {
  const dt = 1 / fps; const before = ctx.created;
  for (let t = 0; t < secs; t += dt) { ctx.currentTime = eng._t0 + t; eng.update(dt, typeof st === 'function' ? st(t) : st, listener); }
  eng._t0 += secs;
  return ctx.created - before;
}

describe('AudioEngine (mock Web Audio)', () => {
  it('does nothing before start() and never throws', () => {
    const eng = new AudioEngine();
    expect(() => eng.update(0.016, IDLE, LIS)).not.toThrow();
    expect(eng.trigger('doorClose')).toBe(false);
    expect(() => eng.setMuted(true)).not.toThrow(); expect(() => eng.setVolume(0.5)).not.toThrow(); expect(() => eng.dispose()).not.toThrow();
  });

  it('start() builds a graph that stays silent until started: master gain is 0 at construction and a fixed node count is created once', async () => {
    const { ctx, eng } = await make();
    expect(ctx.created).toBeGreaterThan(60); expect(ctx.created).toBeLessThan(300);
    expect(eng.master.gain.value).toBe(0);
    expect(ctx.state === 'running' || ctx.state === 'suspended').toBe(true);
    expect(eng.started).toBe(true);
    await eng.start(); // second call just resumes
    expect(ctx.byKind.convolver).toBe(1); expect(ctx.byKind.compressor).toBe(1);
  });

  it('idle: schedules combustion grains at the firing rate and creates well under 120 nodes per second', async () => {
    const { ctx, eng } = await make(); eng._t0 = 0.5;
    run(eng, ctx, IDLE, 1); // warm up the scheduler
    const g0 = eng.stats.grains, made = run(eng, ctx, IDLE, 2);
    const grains = eng.stats.grains - g0;
    expect(grains / 2).toBeGreaterThan(42); expect(grains / 2).toBeLessThan(49); // 45.33 Hz
    expect(made / 2).toBeLessThanOrEqual(120);
    expect(eng.stats.dropped).toBe(0);
  });

  it('wide open throttle at 3,200 rpm: grains are thinned to the cap and the node rate stays within budget', async () => {
    const { ctx, eng } = await make(); eng._t0 = 0.5;
    run(eng, ctx, WOT, 1);
    const g0 = eng.stats.grains, made = run(eng, ctx, WOT, 3);
    expect((eng.stats.grains - g0) / 3).toBeLessThanOrEqual(63);
    expect((eng.stats.grains - g0) / 3).toBeGreaterThan(40);
    expect(made / 3).toBeLessThanOrEqual(120);
  });

  it('the worst case (piston slap + cranking-style events on top of full engine) never exceeds the steady budget in any 1 s window', async () => {
    const { ctx, eng } = await make(); eng._t0 = 0.5;
    const st = { ...WOT, fail: { piston: true } };
    let worst = 0;
    for (let s = 0; s < 4; s++) worst = Math.max(worst, run(eng, ctx, st, 1));
    expect(worst).toBeLessThanOrEqual(120);
  });

  it('cranking schedules compression pulses at the firing rate (about 12.7 Hz at 190 rpm) and the key plays a relay clunk', async () => {
    const { ctx, eng } = await make(); eng._t0 = 0.5;
    const crank = { cranking: true, running: false, rpm: 190, coolantF: 40, wtsOn: false };
    run(eng, ctx, { running: false }, 0.1); const n0 = eng.stats.oneShots;
    run(eng, ctx, { ...crank }, 0.1);
    const g0 = eng.stats.grains; run(eng, ctx, crank, 2);
    expect((eng.stats.grains - g0) / 2).toBeGreaterThan(11); expect((eng.stats.grains - g0) / 2).toBeLessThan(15);
    expect(eng.stats.oneShots).toBe(n0 + 1); // exactly one relay clunk on the rising edge of cranking
  });

  it('cold coolant picks the harsher cold grains more often (state is used by the scheduler)', async () => {
    const { ctx, eng } = await make(); eng._t0 = 0.5;
    const used = new Map(); const orig = eng._grain.bind(eng);
    eng._grain = (buf, t, rate, dest) => { used.set(buf, (used.get(buf) || 0) + 1); orig(buf, t, rate, dest); };
    run(eng, ctx, { ...IDLE, coolantF: 30 }, 2);
    const coldBufs = new Set(Object.values(eng.grains.cold).flat()), warmBufs = new Set(Object.values(eng.grains.warm).flat());
    let c = 0, w = 0; for (const [b, n] of used) { if (coldBufs.has(b)) c += n; if (warmBufs.has(b)) w += n; }
    expect(c).toBeGreaterThan(w * 3);
    used.clear(); run(eng, ctx, { ...IDLE, coolantF: 195 }, 2);
    c = 0; w = 0; for (const [b, n] of used) { if (coldBufs.has(b)) c += n; if (warmBufs.has(b)) w += n; }
    expect(w).toBeGreaterThan(c * 3);
  });

  it('every documented one-shot plays, creates a bounded number of nodes, and only issues valid automation', async () => {
    const names = ['doorOpen', 'doorClose', 'hoodRelease', 'hoodOpen', 'hoodClose', 'tailgateOpen', 'tailgateClose', 'fuelDoor', 'strapRatchet', 'strapRelease',
      'drawerOpen', 'drawerClose', 'rollupUp', 'rollupDown', 'keyTurn', 'relay', 'buttonClick', 'chime', 'wrench', 'plugIn', 'chargerClamp', 'flashDone', 'flashFail', 'failBang', 'waitTick'];
    for (const n of names) expect(ONE_SHOT_NAMES, n).toContain(n);
    const { ctx, eng } = await make(); eng._t0 = 0;
    for (const n of names) {
      ctx.currentTime += 1.5; eng.setTime(ctx.currentTime);
      const c0 = ctx.created;
      expect(eng.trigger(n, { distance: 4, pan: 0.3 }), n).toBe(true);
      const made = ctx.created - c0;
      expect(made, n).toBeGreaterThan(2); expect(made, n).toBeLessThan(140);
    }
    for (const part of ['turbo', 'transmission', 'piston', 'headGasket']) { ctx.currentTime += 1.5; eng.setTime(ctx.currentTime); expect(eng.trigger('failBang', { part })).toBe(true); }
    for (const alias of Object.keys(ONE_SHOT_ALIASES)) expect(eng.trigger(alias), alias).toBe(true);
    expect(eng.trigger('noSuchSound')).toBe(false);
    expect(eng.trigger('rollupDown', { duration: 3, force: 0.5, distance: 12 })).toBe(true);
  });

  it('randomises repeats: two door slams use different partial frequencies', async () => {
    const { ctx, eng } = await make(); const freqs = [];
    const orig = ctx.createOscillator.bind(ctx); ctx.createOscillator = () => { const o = orig(); freqs.push(o); return o; };
    eng.setTime(1); eng.trigger('doorClose'); const a = freqs.map((o) => o.frequency.value); freqs.length = 0;
    eng.setTime(2); eng.trigger('doorClose'); const b = freqs.map((o) => o.frequency.value);
    expect(a.length).toBe(b.length); expect(a.some((v, i) => v !== b[i])).toBe(true);
  });

  it('a flood of triggers is dropped by the one-shot node budget instead of exhausting the audio thread', async () => {
    const { ctx, eng } = await make(); eng.setTime(1); let ok = 0;
    for (let i = 0; i < 100; i++) if (eng.trigger('doorClose', { delay: i * 0.001 })) ok++;
    expect(ok).toBeLessThan(100); expect(eng.stats.dropped).toBeGreaterThan(0);
    expect(ctx.created).toBeLessThan(2500);
  });

  it('edge events: wait-to-start tick, engine catch, failure bang happen once per transition', async () => {
    const { ctx, eng } = await make(); eng._t0 = 0.5;
    run(eng, ctx, { wtsOn: false }, 0.1);
    run(eng, ctx, { wtsOn: true }, 0.2); expect(eng.stats.lastTrigger.name).toBe('waitTick'); const n1 = eng.stats.oneShots;
    run(eng, ctx, { wtsOn: true }, 0.5); expect(eng.stats.oneShots).toBe(n1);
    run(eng, ctx, { ...IDLE }, 0.1); expect(eng.catchEnv).toBeGreaterThan(0.5);
    run(eng, ctx, { ...IDLE }, 2); expect(eng.catchEnv).toBe(0);
    const n2 = eng.stats.oneShots; run(eng, ctx, { ...IDLE, fail: { turbo: true } }, 0.2); expect(eng.stats.lastTrigger.name).toBe('failBang'); expect(eng.stats.oneShots).toBe(n2 + 1);
    run(eng, ctx, { ...IDLE, fail: { turbo: true } }, 0.5); expect(eng.stats.oneShots).toBe(n2 + 1);
  });

  it('push parameters at a throttled rate and always finite; mute and volume reach the master gain', async () => {
    const { ctx, eng } = await make(); eng._t0 = 0.5;
    run(eng, ctx, WOT, 1);
    const calls0 = ctx.paramCalls; run(eng, ctx, WOT, 1);
    expect(ctx.paramCalls - calls0).toBeLessThan(40 * 120); // a few automation events per parameter, 40 times a second
    eng.setMuted(true); expect(eng.master.gain.calls).toBeGreaterThan(0);
    eng.setVolume(7); expect(eng.volume).toBe(1); eng.setVolume(-1); expect(eng.volume).toBe(0);
    expect(() => run(eng, ctx, { ...WOT, rpm: NaN, coolantF: undefined, fail: undefined }, 0.2, { inCab: true, distanceToTruck: undefined })).not.toThrow();
  });

  it('the listener inside the cab pulls the lowpass near 1.2 kHz and the whistle down', async () => {
    const { ctx, eng } = await make(); eng._t0 = 0.5;
    const seen = {}; const sp = eng._sp.bind(eng);
    eng._sp = (param, v, tc, now) => { if (param === eng.truck.lp.frequency) seen.lp = v; if (param === eng.t.bus.gain) seen.turbo = v; sp(param, v, tc, now); };
    run(eng, ctx, WOT, 0.3, { distanceToTruck: 3 }); const outLp = seen.lp, outTurbo = seen.turbo;
    run(eng, ctx, WOT, 0.3, { inCab: true, distanceToTruck: 2 });
    expect(seen.lp).toBeLessThan(1500); expect(outLp).toBeGreaterThan(5000); expect(seen.turbo).toBeLessThan(outTurbo);
  });

  it('dispose() stops sources and closes an owned context only', async () => {
    const { ctx, eng } = await make(); eng.dispose(); expect(eng.started).toBe(false); expect(ctx.closed).toBe(false); // injected contexts are the caller's
    expect(() => eng.update(0.016, IDLE, LIS)).not.toThrow();
  });
});
