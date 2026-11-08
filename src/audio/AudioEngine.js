// AudioEngine: the procedural sound of the Duramax Dyno Shop. Pure Web Audio, no files.
//
// Structure (all persistent nodes are created once in start(); only short-lived BufferSource grains and one-shot voices are
// created afterwards, throttled by a node budget):
//   truck sources (engine, exhaust, turbo, starter, fan)  -> truck chain  --\
//   dyno sources (rollers, tires, shop fan)               -> dyno chain   ---+--> dry --\
//   one-shot world events (doors, hood, tools)            -> world chain  --/            +--> mix -> compressor -> soft clip -> master -> out
//   one-shot local events (switches, chimes, beeps)       -> local bus  ----------------/
//   every chain also feeds a send -> shop reverb (ConvolverNode with a generated impulse response) -> mix
// Each chain is: gain -> lowpass (distance air absorption, or the cab shell) -> low shelf (cab boom) -> stereo pan.
import { clamp } from './dsp.js';
import * as D from './dsp.js';
import {
  computeMix, normalizeState, normalizeListener, distanceGain, FIRING_ORDER,
} from './mapping.js';
import { FiringScheduler, PulseScheduler, NodeBudget, LOOKAHEAD, MAX_GRAIN_HZ, NODE_BUDGET_PER_SEC } from './scheduler.js';
import { Synth, RECIPES, ALIASES } from './oneshots.js';

const PARAM_PERIOD = 0.025; // seconds between parameter pushes (40 Hz)
const ONE_SHOT_BUDGET = 600; // nodes per second allowed for event sounds (they are finite and short)

// per-cylinder knock timbre: band centre (Hz) of the knock and block thump (Hz). Firing order 1-2-7-8-4-5-6-3; the 4 rear
// cylinders (nearer the firewall, farther from the microphone) are duller.
const CYL = {
  1: { fc: 2300, th: 112 }, 2: { fc: 2650, th: 124 }, 7: { fc: 2100, th: 135 }, 8: { fc: 3000, th: 150 },
  4: { fc: 2450, th: 118 }, 5: { fc: 2800, th: 142 }, 6: { fc: 2200, th: 128 }, 3: { fc: 3300, th: 160 },
};

export class AudioEngine {
  // opts.context: inject an AudioContext / OfflineAudioContext (offline checks and tests). Otherwise created in start().
  constructor(opts = {}) {
    this.opts = opts; this.ctx = null; this.started = false; this.ownsContext = false;
    this.muted = false; this.volume = opts.volume ?? 0.8;
    this.rnd = D.mulberry32(opts.seed ?? 20050);
    this.fire = new FiringScheduler({ maxHz: MAX_GRAIN_HZ });
    this.crank = new FiringScheduler({ maxHz: MAX_GRAIN_HZ, seed: 31 });
    this.slap = new PulseScheduler({ seed: 17 });
    this.budget = new NodeBudget(NODE_BUDGET_PER_SEC, 1);
    this.oneShotBudget = new NodeBudget(ONE_SHOT_BUDGET, 1);
    this.prev = { running: false, cranking: false, wtsOn: false, fail: {} };
    this.catchEnv = 0; this.lastApply = -1; this.chimeT = 0; this._timeOverride = null;
    this.st = normalizeState({}); this.listener = normalizeListener({});
    this.stats = { grains: 0, oneShots: 0, nodesCreated: 0, dropped: 0, lastTrigger: null };
    this._onVis = null; this._srcs = [];
  }

  // ------------------------------------------------------------------ public API
  // Create / resume the AudioContext. Call on the first user click.
  start() {
    if (this.started) return this._resume();
    let ctx = this.opts.context;
    if (!ctx) {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return Promise.resolve(false);
      ctx = new AC({ latencyHint: 'interactive' }); this.ownsContext = true;
    }
    this.ctx = ctx; this._build(); this.started = true;
    if (typeof document !== 'undefined' && document.addEventListener && this.ownsContext) {
      this._onVis = () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend?.(); else if (!this.muted) this._resume(); };
      document.addEventListener('visibilitychange', this._onVis);
    }
    this._applyMaster(true);
    return this._resume();
  }

  _resume() {
    const c = this.ctx;
    if (!c || typeof c.startRendering === 'function') return Promise.resolve(true); // offline contexts render on demand
    try { return Promise.resolve(c.resume ? c.resume() : true).then(() => true, () => false); } catch { return Promise.resolve(false); }
  }

  setMuted(m) { this.muted = !!m; if (this.started) this._applyMaster(); }
  setVolume(v) { this.volume = clamp(+v || 0, 0, 1); if (this.started) this._applyMaster(); }
  // Offline rendering only: drive the engine's clock by hand instead of ctx.currentTime.
  setTime(t) { this._timeOverride = t; }
  now() { return this._timeOverride != null ? this._timeOverride : this.ctx.currentTime; }

  _applyMaster(immediate = false) {
    if (!this.master) return;
    const g = this.muted ? 0 : this.volume * this.volume; // audio taper
    const t = this.now();
    if (immediate) { this.master.gain.setValueAtTime(0, t); this.master.gain.setTargetAtTime(g, t + 0.02, 0.06); }
    else this.master.gain.setTargetAtTime(g, t, 0.04);
  }

  // Call every frame. st: simulation state (see mapping.DEFAULT_STATE); listener: where the player is.
  update(dt, st, listener) {
    this.st = normalizeState(st); this.listener = normalizeListener(listener);
    if (!this.started) return;
    const now = this.now(), s = this.st;
    // ---- edge events
    // the first frame after start() only records the state, so a game that is already running does not fire a spurious relay or failure bang
    const pv = this._seen ? this.prev : { running: s.running, cranking: s.cranking, wtsOn: s.wtsOn, fail: { ...s.fail } };
    this._seen = true;
    if (s.cranking && !pv.cranking) this.trigger('relay', { heavy: true, _auto: true });
    if (s.running && !pv.running) this.catchEnv = 1; // the engine catches: a short burst of extra clatter
    if (s.wtsOn && !pv.wtsOn) this.trigger('waitTick', { _auto: true });
    for (const part of ['turbo', 'headGasket', 'piston', 'transmission']) if (s.fail[part] && !pv.fail[part]) this.trigger('failBang', { part, _auto: true });
    this.prev = { running: s.running, cranking: s.cranking, wtsOn: s.wtsOn, fail: { ...s.fail } };
    this.catchEnv = Math.max(0, this.catchEnv - (dt > 0 ? dt : 0) / 1.2);
    // ---- repeating door-ajar chime
    if (s.keyChime) { if (now >= this.chimeT) { this.trigger('chime', { count: 2, _auto: true }); this.chimeT = now + 1.6; } } else this.chimeT = 0;
    // ---- continuous layers
    const mix = this.mix = computeMix(s, this.listener, { catchEnv: this.catchEnv * this.catchEnv, maxGrainHz: MAX_GRAIN_HZ });
    if (now - this.lastApply >= PARAM_PERIOD || this.lastApply < 0) { this.lastApply = now; this._apply(mix, now); }
    // ---- look-ahead grains
    this._scheduleGrains(mix, now);
  }

  // Event sound. Names: doorOpen doorClose hoodRelease hoodOpen hoodClose tailgateOpen tailgateClose fuelDoor strapRatchet
  // strapRelease drawerOpen drawerClose rollupUp rollupDown keyTurn relay buttonClick chime wrench plugIn chargerClamp
  // flashDone flashFail failBang waitTick. opts: { gain, force, distance (m, world sounds), pan (-1..1), delay (s),
  // inside (true: heard in the cab at full level), duration (rollup), part (failBang), to ('START'), count (chime) }.
  trigger(name, opts = {}) {
    if (!this.started) return false;
    const key = ALIASES[name] || name, rec = RECIPES[key];
    if (!rec) return false;
    const ctx = this.ctx, now = this.now(), o = opts || {};
    if (!o._auto && this.oneShotBudget.used(now) > ONE_SHOT_BUDGET) { this.stats.dropped++; return false; }
    const t = now + 0.012 + (o.delay || 0), s = new Synth(ctx, this.bufs, this.rnd);
    const local = rec.bus === 'local' || o.inside, voice = ctx.createGain(); s.nodes++;
    let dist = 1;
    if (!local) dist = distanceGain(o.distance ?? 3);
    voice.gain.value = (o.gain ?? 1) * (local ? 0.45 : 0.42) * dist;
    let tail = voice;
    if (!local && (o.distance ?? 3) > 8) { // far away: air absorption
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 / (1 + (o.distance - 8) / 6); tail.connect(lp); tail = lp; s.nodes++;
    }
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); tail.connect(p); tail = p; s.nodes++; }
    tail.connect(local ? this.local.in : this.world.in);
    rec.fn(s, voice, t, o);
    this.oneShotBudget.take(s.nodes, now);
    this.stats.oneShots++; this.stats.nodesCreated += s.nodes; this.stats.lastTrigger = { name: key, nodes: s.nodes };
    return true;
  }

  dispose() {
    if (this._onVis && typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVis);
    for (const n of this._srcs) { try { n.stop(); } catch { /* already stopped */ } }
    this._srcs = [];
    if (this.ctx && this.ownsContext) { try { this.ctx.close(); } catch { /* ignore */ } }
    this.started = false; this.ctx = null; this._seen = false;
  }

  // ------------------------------------------------------------------ graph construction
  _buf(arr, sr) { const b = this.ctx.createBuffer(1, arr.length, sr || this.ctx.sampleRate); b.getChannelData(0).set(arr); return b; }
  _gain(v = 0, dest = null) { const g = this.ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
  _filter(type, f, q, dest = null) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (dest) b.connect(dest); return b; }
  _osc(type, f, dest = null) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; if (dest) o.connect(dest); o.start(); this._srcs.push(o); return o; }
  _noise(buf, dest = null) {
    const s = this.ctx.createBufferSource(); s.buffer = this.bufs[buf]; s.loop = true; if (dest) s.connect(dest);
    s.start(0, this.rnd() * (s.buffer.duration - 0.5)); this._srcs.push(s); return s;
  }
  // noise -> filter -> gain, returns { f: filter, g: gain }
  _noiseLane(buf, type, f, q, dest) { const g = this._gain(0, dest), fl = this._filter(type, f, q, g); this._noise(buf, fl); return { f: fl, g }; }

  _chain() {
    const c = this.ctx, inp = this._gain(1), hp = this._filter('highpass', 25, 0.7), lp = this._filter('lowpass', 18000, 0.5), sh = c.createBiquadFilter();
    sh.type = 'lowshelf'; sh.frequency.value = 200; sh.gain.value = 0;
    const pan = c.createStereoPanner(), dry = this._gain(1, this.mixBus), send = this._gain(0.2, this.reverbIn);
    inp.connect(hp); hp.connect(lp); lp.connect(sh); // the 25 Hz high-pass keeps subsonic rumble from eating headroom and pumping the compressor
    sh.connect(pan); pan.connect(dry); sh.connect(send);
    return { in: inp, lp, shelf: sh, pan, dry, send };
  }

  _build() {
    const c = this.ctx, sr = c.sampleRate;
    // ---- shared buffers
    this.bufs = { white: this._buf(D.whiteNoise(Math.floor(sr * 3), 101)), brown: this._buf(D.brownNoise(Math.floor(sr * 3), 102)) };
    this._buildGrains(sr);
    // ---- master chain: mix -> compressor -> soft clip -> master gain -> destination (starts silent)
    this.mixBus = this._gain(1.7);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    const shaper = c.createWaveShaper(), N = 2048, curve = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1, a = Math.abs(x); curve[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3)); }
    shaper.curve = curve; shaper.oversample = '2x';
    this.master = this._gain(0);
    this.mixBus.connect(comp); comp.connect(shaper); shaper.connect(this.master); this.master.connect(c.destination);
    // ---- shop reverb
    this.reverbIn = this._gain(1);
    const hp = this._filter('highpass', 140, 0.7, null), conv = c.createConvolver();
    const ir = D.renderImpulseResponse(sr), irBuf = c.createBuffer(2, ir.length, sr);
    irBuf.getChannelData(0).set(ir.channels[0]); irBuf.getChannelData(1).set(ir.channels[1]);
    conv.buffer = irBuf; this.reverbIn.connect(hp); hp.connect(conv); this.wet = this._gain(0.9, this.mixBus); conv.connect(this.wet);
    // ---- spatial chains
    this.truck = this._chain(); this.dyno = this._chain(); this.world = this._chain();
    this.local = { in: this._gain(0.9, this.mixBus) }; this.local.send = this._gain(0.06, this.reverbIn); this.local.in.connect(this.local.send);
    this._buildEngine(); this._buildTurbo(); this._buildDyno();
  }

  _buildGrains(sr) {
    const mk = (cold, cyl, v) => {
      const p = CYL[cyl], seed = cyl * 17 + v * 5 + (cold ? 100 : 0), r = D.mulberry32(seed + 3);
      const amp = 0.85 + 0.3 * r(); // per-cylinder / per-variant level spread
      return this._buf(D.renderKnock(sr, cold
        ? { seed, fc: p.fc * 0.82, q: 1.4, thumpHz: p.th, thumpAmp: 0.3, noiseAmp: 1.15, tau: 0.011, tickAmp: 0.3, secondary: 0.5, amp }
        : { seed, fc: p.fc, q: 2.0, thumpHz: p.th, thumpAmp: 0.3, noiseAmp: 1.0, tau: 0.0055, tickAmp: 0.22, secondary: 0, amp }), sr);
    };
    this.grains = { warm: {}, cold: {} };
    for (const cyl of FIRING_ORDER) {
      this.grains.warm[cyl] = [mk(false, cyl, 0), mk(false, cyl, 1)];
      this.grains.cold[cyl] = [mk(true, cyl, 0), mk(true, cyl, 1)];
    }
    this.grains.compress = [0, 1, 2].map((i) => this._buf(D.renderCompression(sr, { seed: 40 + i, f: 60 + i * 5, amp: 0.85 + 0.15 * i / 2 }), sr));
    this.grains.slap = [0, 1].map((i) => this._buf(D.renderSlap(sr, { seed: 60 + i, amp: 1 }), sr));
  }

  _buildEngine() {
    const c = this.ctx, T = this.truck.in;
    this.e = {};
    const e = this.e;
    e.bus = this._gain(1, T);
    e.comb = this._gain(0, e.bus); // combustion grains
    e.slapBus = this._gain(0, e.bus);
    e.compBus = this._gain(0, T); // cranking compression grains
    e.growl = this._noiseLane('brown', 'bandpass', 180, 0.8, e.bus);
    e.roar = this._noiseLane('white', 'bandpass', 700, 0.6, e.bus);
    e.rumble = this._noiseLane('brown', 'lowpass', 110, 0.7, e.bus);
    // mechanical whine: timing gear train
    e.whineG = this._gain(0, e.bus); const wl = this._filter('lowpass', 3500, 0.7, e.whineG); e.whineO = this._osc('sawtooth', 300, wl);
    // exhaust note: orders 4 (firing), 2, 1 and 0.5 of crank speed through the pipe low-pass
    e.exhG = this._gain(0, e.bus); e.exhLp = this._filter('lowpass', 300, 0.9, e.exhG);
    e.exhO = [['sawtooth', 1.0], ['triangle', 0.55], ['triangle', 0.3], ['triangle', 0.22]].map(([ty, g]) => { const og = this._gain(g, e.exhLp); return this._osc(ty, 45, og); });
    // transmission whine / slip groan
    e.transG = this._gain(0, e.bus); const tb = this._filter('bandpass', 500, 4, e.transG); e.transO = this._osc('sawtooth', 300, tb);
    // head gasket: coolant bubbling in the combustion chamber / steam hiss
    e.bubble = this._noiseLane('white', 'bandpass', 240, 3, e.bus);
    e.bubble.am = this._gain(0.6); e.bubble.f.disconnect(); e.bubble.f.connect(e.bubble.am); e.bubble.am.connect(e.bubble.g); // gurgle: series AM, never inverts
    this._osc('sine', 9, this._gain(0.4, e.bubble.am.gain));
    e.steam = this._noiseLane('white', 'highpass', 5000, 0.7, e.bus);
    // starter motor
    e.starter = this._gain(0, T); e.starterLug = this._gain(1, e.starter);
    const sl = this._filter('bandpass', 400, 3, e.starterLug); e.meshO = this._osc('sawtooth', 400, sl);
    const al = this._filter('lowpass', 1400, 0.7, e.starterLug); e.armO = this._osc('square', 160, this._gain(0.5, al));
    e.lugLfo = this._osc('sine', 12, e.lugG = this._gain(0, e.starterLug.gain));
    // cooling fan
    e.fanBus = this._gain(1, T);
    e.fanNoise = this._noiseLane('white', 'bandpass', 500, 0.8, e.fanBus);
    e.fanToneG = this._gain(0, e.fanBus); e.fanToneO = this._osc('triangle', 300, e.fanToneG);
  }

  _buildTurbo() {
    const T = this.truck.in, t = this.t = {};
    t.bus = this._gain(1, T);
    // whistle: fundamental + 2nd + 3rd harmonic with a little detune, vibrato and (damaged turbo) flutter
    t.flut = this._gain(1, t.bus);
    t.wo = []; t.wg = [];
    const detune = [0, 2.5, -3.5], mult = [1, 2, 3];
    t.vib = this._osc('sine', 5.3); t.vibG = this._gain(3); t.vib.connect(t.vibG);
    t.flutLfo = this._osc('sine', 21); t.flutCents = this._gain(0); t.flutLfo.connect(t.flutCents);
    t.flutAmpG = this._gain(0); t.flutLfo.connect(t.flutAmpG); t.flutAmpG.connect(t.flut.gain); t.flut.gain.value = 1;
    for (let i = 0; i < 3; i++) {
      const g = this._gain(0, t.flut), o = this._osc('sine', 500 * mult[i], g);
      o.detune.value = detune[i]; t.vibG.connect(o.detune); t.flutCents.connect(o.detune);
      t.wo.push(o); t.wg.push(g);
    }
    t.siren = this._noiseLane('white', 'bandpass', 600, 12, t.bus);
    t.intake = this._noiseLane('white', 'bandpass', 5000, 0.8, t.bus);
    t.exh = this._noiseLane('white', 'bandpass', 2000, 0.6, t.bus);
  }

  _buildDyno() {
    const D_ = this.dyno.in, r = this.r = {};
    r.bus = this._gain(1, D_);
    r.rumbleO = [2, 3, 4].map((m) => ({ m, g: this._gain(0, r.bus) })).map((x) => { x.o = this._osc('sine', 30 * x.m, x.g); return x; });
    r.bearG = this._gain(0, r.bus); const bl = this._filter('lowpass', 1500, 0.7, r.bearG); r.bearO = this._osc('sawtooth', 100, bl);
    r.bearN = this._noiseLane('white', 'bandpass', 2400, 2.5, r.bus);
    r.tireToneG = this._gain(0, r.bus); r.tireToneO = this._osc('sine', 600, r.tireToneG);
    r.tireNoise = this._noiseLane('white', 'bandpass', 700, 1.6, r.bus);
    // the high-velocity shop fan: roaring broadband air, a low rumble and the blade-pass tone (5 blades at about 1,750 rpm)
    r.fanG = this._gain(0, r.bus);
    const fb = this._noiseLane('white', 'bandpass', 900, 0.5, r.fanG), fl = this._noiseLane('brown', 'lowpass', 220, 0.7, r.fanG), fh = this._noiseLane('white', 'highpass', 3000, 0.6, r.fanG);
    fb.g.gain.value = 1; fl.g.gain.value = 1.4; fh.g.gain.value = 0.25;
    const fto = [146, 292].map((f, i) => this._osc('sine', f, this._gain(i ? 0.18 : 0.35, r.fanG)));
    void fto;
  }

  // ------------------------------------------------------------------ per-frame parameter pushes
  _sp(param, v, tc = 0.05, now = this.now()) {
    if (!Number.isFinite(v)) return;
    param.setTargetAtTime(v, now, tc);
  }

  _apply(m, now) {
    const sp = (p, v, tc) => this._sp(p, v, tc ?? 0.05, now), e = this.e, sp_ = m.space;
    // ---- spatial chains
    const chain = (ch, s, send) => {
      sp(ch.in.gain, s.gain, 0.08); sp(ch.lp.frequency, clamp(s.lp, 200, 20000), 0.08);
      sp(ch.shelf.gain, sp_.bassDb, 0.1); sp(ch.pan.pan, sp_.pan, 0.1); sp(ch.send.gain, send, 0.1);
    };
    chain(this.truck, sp_.truck, sp_.send); chain(this.dyno, sp_.dyno, sp_.send); chain(this.world, sp_.world, sp_.send);
    // ---- engine
    const E = m.engine;
    sp(e.comb.gain, E.combGain * Math.pow(E.thin, 0.3), 0.03); // thinned grains are made a little louder; the roar lane carries the rest
    sp(e.growl.g.gain, E.growlGain, 0.08); sp(e.growl.f.frequency, E.growlHz, 0.1);
    sp(e.roar.g.gain, E.roarGain, 0.08); sp(e.roar.f.frequency, E.roarHz, 0.1);
    sp(e.rumble.g.gain, E.rumbleGain, 0.1);
    sp(e.whineG.gain, E.whineGain, 0.1); sp(e.whineO.frequency, Math.max(20, E.whineHz), 0.05);
    sp(e.exhG.gain, E.exhGain, 0.06); sp(e.exhLp.frequency, clamp(E.exhLpHz, 60, 6000), 0.1);
    E.exhOrders.forEach((f, i) => sp(e.exhO[i].frequency, Math.max(2, f), 0.04));
    const Tm = m.trans, G = m.gasket;
    sp(e.transG.gain, Tm.whineGain, 0.1); sp(e.transO.frequency, Math.max(40, Tm.whineHz), 0.05);
    sp(e.bubble.g.gain, G.bubbleGain, 0.1); sp(e.steam.g.gain, G.hissGain, 0.15);
    sp(e.slapBus.gain, m.piston.slapGain * 0.6, 0.05);
    sp(e.compBus.gain, m.starter.thumpGain, 0.03);
    // ---- starter and fan
    const S = m.starter;
    sp(e.starter.gain, S.gain, 0.04); sp(e.meshO.frequency, Math.max(50, S.meshHz), 0.04); sp(e.armO.frequency, Math.max(30, S.armHz), 0.04);
    sp(e.lugLfo.frequency, Math.max(1, S.lugHz), 0.05); sp(e.lugG.gain, S.lugDepth * 0.5, 0.05); sp(e.starterLug.gain, 1 - S.lugDepth * 0.5, 0.05);
    const F = m.fan;
    sp(e.fanNoise.g.gain, F.noiseGain, 0.12); sp(e.fanNoise.f.frequency, F.noiseHz, 0.15);
    sp(e.fanToneG.gain, F.toneGain, 0.12); sp(e.fanToneO.frequency, Math.max(20, F.toneHz), 0.1);
    // ---- turbo
    const U = m.turbo, t = this.t;
    sp(t.bus.gain, U.cab, 0.1);
    for (let i = 0; i < 3; i++) { sp(t.wg[i].gain, U.gains[i], 0.03); sp(t.wo[i].frequency, U.whistleHz * (i + 1), 0.03); }
    sp(t.vibG.gain, U.vibratoCents, 0.2); sp(t.vib.frequency, U.vibratoHz, 0.2);
    sp(t.flutCents.gain, U.flutterCents, 0.1); sp(t.flutLfo.frequency, U.flutterHz, 0.1); sp(t.flutAmpG.gain, U.flutterAmp > 0 ? 0.35 : 0, 0.1);
    sp(t.siren.g.gain, U.sirenGain, 0.04); sp(t.siren.f.frequency, U.sirenHz, 0.03); sp(t.siren.f.Q, U.sirenQ, 0.1);
    sp(t.intake.g.gain, U.intakeGain, 0.05); sp(t.intake.f.frequency, U.intakeHz, 0.1);
    sp(t.exh.g.gain, U.exhaustHissGain, 0.06); sp(t.exh.f.frequency, U.exhaustHissHz, 0.1);
    // ---- dyno
    const R = m.roller, r = this.r;
    r.rumbleO.forEach((x, i) => { sp(x.o.frequency, Math.max(1, R.rumbleHz * x.m), 0.05); sp(x.g.gain, R.rumbleGain * [0.5, 0.35, 0.2][i], 0.08); });
    sp(r.bearG.gain, R.bearingGain, 0.08); sp(r.bearO.frequency, R.bearingHz, 0.05); sp(r.bearN.g.gain, R.bearingGain * 0.6, 0.08);
    sp(r.tireToneG.gain, R.tireGain, 0.08); sp(r.tireToneO.frequency, R.tireHz, 0.05);
    sp(r.tireNoise.g.gain, R.tireNoiseGain, 0.08); sp(r.tireNoise.f.frequency, R.tireHz, 0.08);
    sp(r.fanG.gain, m.shopFan.gain, 0.3);
  }

  // ------------------------------------------------------------------ look-ahead grain scheduling
  _scheduleGrains(m, now) {
    const s = m.st, horizon = now + LOOKAHEAD;
    if (s.running) {
      const cold = m.cold, set = (c) => (this.rnd() < cold ? this.grains.cold[c] : this.grains.warm[c]);
      for (const ev of this.fire.plan(now, horizon, s.rpm)) {
        if (!this.budget.tryTake(1, now)) { this.stats.dropped++; continue; }
        const buf = set(ev.cyl)[ev.variant];
        this._grain(buf, ev.t, ev.rate * (1 + 0.12 * clamp(s.rpm / 3200, 0, 1)), this.e.comb);
      }
      this.crank.reset();
      if (m.piston.slap) {
        for (const ev of this.slap.plan(now, horizon, s.rpm / 120)) {
          if (!this.budget.tryTake(1, now)) { this.stats.dropped++; continue; }
          this._grain(this.grains.slap[this.rnd() < 0.5 ? 0 : 1], ev.t, 1, this.e.slapBus);
        }
      } else this.slap.reset();
    } else {
      this.fire.reset(); this.slap.reset();
      if (s.cranking || s.rpm > 15) {
        for (const ev of this.crank.plan(now, horizon, Math.max(s.rpm, s.cranking ? 60 : 0))) {
          if (!this.budget.tryTake(1, now)) { this.stats.dropped++; continue; }
          this._grain(this.grains.compress[ev.variant + (ev.cyl % 2)], ev.t, ev.rate, this.e.compBus);
        }
      } else this.crank.reset();
    }
  }

  _grain(buf, t, rate, dest) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    src.connect(dest); // per-cylinder level spread is baked into each pre-rendered grain, so one node per firing
    src.start(t); this.stats.grains++; this.stats.nodesCreated++;
  }
}
