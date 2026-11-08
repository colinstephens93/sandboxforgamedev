// One-shot sound events built from envelope-shaped noise bursts and modal synthesis (a bank of decaying sine partials
// per struck object, the way a metal panel, latch or bell actually rings). Every call randomises pitch, decay and timing a
// little so repeats do not sound identical. Short clicks are packed into ONE noise source whose gain is automated into
// a pulse train (pulses()), which keeps ratchets, slat clacks and rattles to three audio nodes.
//
// A recipe is fn(s, out, t, o): s = Synth (node factory + randomisation), out = destination GainNode, t = start time on the
// AudioContext timeline, o = options (force 0..1.5, duration for long events, part for failBang, ...).

const LN1000 = 6.907755; // ln(1000): converts a time-to-minus-60-dB into an exponential time constant

export class Synth {
  constructor(ctx, bufs, rnd) { this.ctx = ctx; this.bufs = bufs; this.rnd = rnd; this.nodes = 0; }
  r() { return this.rnd(); }
  j(v, pct) { return v * (1 + pct * (2 * this.rnd() - 1)); } // +-pct random spread
  bus(out, gain = 1) { const g = this.ctx.createGain(); g.gain.value = gain; g.connect(out); this.nodes++; return g; }

  _noiseSrc(buf, t, dur) {
    const src = this.ctx.createBufferSource(); const b = this.bufs[buf] || this.bufs.white;
    src.buffer = b; src.loop = true; this.nodes++;
    src.start(t, this.rnd() * Math.max(0, b.duration - 0.1)); src.stop(t + dur + 0.05);
    return src;
  }

  // noise burst: BufferSource -> biquad -> gain envelope (attack a, exponential decay tau) -> out.
  // f2 sweeps the filter frequency to f2 over the duration; am adds amplitude modulation { hz, depth }.
  noise(out, t, o) {
    const { dur = 0.2, type = 'bandpass', f = 1000, f2 = null, q = 1, gain = 1, a = 0.002, tau = 0.03, buf = 'white', am = null, hold = false } = o;
    const src = this._noiseSrc(buf, t, dur), flt = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); this.nodes += 2;
    flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, t);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a);
    if (hold) g.gain.setValueAtTime(gain, t + dur - 0.05); else g.gain.setTargetAtTime(0, t + a, tau);
    if (hold) g.gain.linearRampToValueAtTime(0, t + dur);
    if (am) { // amplitude modulation in series: (1 - depth/2) + depth/2 * sin, so it never inverts and dies with the envelope
      const amN = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); this.nodes += 3;
      amN.gain.value = 1 - am.depth * 0.5; lfo.frequency.value = am.hz; lg.gain.value = am.depth * 0.5;
      lfo.connect(lg); lg.connect(amN.gain); lfo.start(t); lfo.stop(t + dur + 0.05);
      src.connect(flt); flt.connect(amN); amN.connect(g);
    } else src.connect(flt), flt.connect(g);
    g.connect(out);
    return g;
  }

  // pulse train from one noise source: events [{dt, g}] relative to t, each a click with decay tau
  pulses(out, t, events, o = {}) {
    const { type = 'bandpass', f = 2500, q = 3, tau = 0.006, gain = 1, buf = 'white', a = 0.0006 } = o;
    const end = events.length ? events[events.length - 1].dt + tau * 8 : 0.1;
    const src = this._noiseSrc(buf, t, end), flt = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); this.nodes += 2;
    flt.type = type; flt.Q.value = q; flt.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    for (const e of events) { const te = t + e.dt; g.gain.setValueAtTime(0, te); g.gain.linearRampToValueAtTime(gain * e.g, te + a); g.gain.setTargetAtTime(0, te + a, tau); }
    src.connect(flt); flt.connect(g); g.connect(out);
    return g;
  }

  // pitched tone with optional pitch glide (f -> f2 exponentially over dur) and optional lowpass
  tone(out, t, o) {
    const { f = 440, f2 = null, type = 'sine', gain = 1, a = 0.003, tau = 0.05, dur = 0.3, lp = 0, hold = false } = o;
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain(); this.nodes += 2;
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(5, f2), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a);
    if (hold) { g.gain.setValueAtTime(gain, t + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + dur); } else g.gain.setTargetAtTime(0, t + a, tau);
    let last = osc;
    if (lp) { const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = lp; osc.connect(flt); last = flt; this.nodes++; }
    last.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + 0.05);
    return g;
  }

  // modal synthesis: struck object = sum of exponentially decaying sine partials { f, g, t60 }
  modal(out, t, modes, o = {}) {
    const { gain = 1, spread = 0.02, tmul = 1 } = o;
    for (const m of modes) {
      const osc = this.ctx.createOscillator(), g = this.ctx.createGain(); this.nodes += 2;
      const t60 = m.t60 * tmul * (0.88 + 0.24 * this.rnd());
      osc.type = 'sine'; osc.frequency.value = m.f * (1 + spread * (2 * this.rnd() - 1));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(m.g * gain * (0.85 + 0.3 * this.rnd()), t + 0.0005);
      g.gain.setTargetAtTime(0, t + 0.0005, t60 / LN1000);
      osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + t60 * 1.15 + 0.05);
    }
  }
}

// ---------------------------------------------------------------- recipes
const click = (s, out, t, k, f = 3000) => s.noise(out, t, { type: 'highpass', f, q: 0.7, gain: 0.4 * k, a: 0.0004, tau: 0.004, dur: 0.05 });

export const RECIPES = {
  doorClose: { bus: 'world', dur: 0.9, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.tone(out, t, { f: s.j(82, 0.1), f2: 48, gain: 0.95 * k, a: 0.002, tau: 0.05, dur: 0.35 }); // cab air pressure thud
    s.modal(out, t, [{ f: s.j(145, 0.06), g: 0.5, t60: 0.35 }, { f: s.j(238, 0.06), g: 0.4, t60: 0.28 }, { f: s.j(402, 0.06), g: 0.28, t60: 0.22 }, { f: s.j(680, 0.06), g: 0.16, t60: 0.16 }], { gain: 0.9 * k }); // door skin
    const tl = t + s.j(0.007, 0.3); // latch fork reaches the striker as the door stops
    s.modal(out, tl, [{ f: s.j(1480, 0.04), g: 0.18, t60: 0.14 }, { f: s.j(2290, 0.04), g: 0.12, t60: 0.1 }, { f: s.j(3380, 0.04), g: 0.08, t60: 0.07 }], { gain: k });
    click(s, out, tl, k);
    s.noise(out, t + 0.003, { f: 900, f2: 260, q: 0.8, gain: 0.4 * k, a: 0.004, tau: 0.05, dur: 0.2 }); // weatherstrip air
    s.noise(out, t + 0.02, { f: s.j(1700, 0.1), q: 3, gain: 0.06 * k, a: 0.002, tau: 0.12, dur: 0.5 }); // loose trim / glass
  } },
  doorOpen: { bus: 'world', dur: 0.7, fn(s, out, t, o) {
    const k = o.force ?? 1;
    click(s, out, t, k, 2200);
    s.modal(out, t, [{ f: s.j(1100, 0.05), g: 0.2, t60: 0.08 }, { f: s.j(1850, 0.05), g: 0.14, t60: 0.06 }], { gain: k });
    s.modal(out, t + 0.05, [{ f: s.j(95, 0.1), g: 0.55, t60: 0.14 }, { f: s.j(210, 0.1), g: 0.25, t60: 0.1 }], { gain: k }); // latch lets go, door swings off the seal
    s.noise(out, t + 0.06, { f: 1200, f2: 500, q: 0.9, gain: 0.22 * k, a: 0.01, tau: 0.08, dur: 0.3 }); // seal peel
    s.tone(out, t + 0.12, { f: s.j(210, 0.1), f2: 262, type: 'triangle', gain: 0.02 * k, a: 0.05, tau: 0.12, dur: 0.3 }); // hinge
  } },
  hoodRelease: { bus: 'local', dur: 0.6, fn(s, out, t, o) {
    const k = o.force ?? 1;
    click(s, out, t, k * 0.8, 2500); // handle
    s.modal(out, t + 0.03, [{ f: s.j(520, 0.06), g: 0.35, t60: 0.09 }, { f: s.j(1100, 0.06), g: 0.2, t60: 0.07 }, { f: s.j(110, 0.08), g: 0.5, t60: 0.12 }], { gain: k }); // primary latch releases under the cowl
    s.tone(out, t + 0.04, { f: s.j(380, 0.1), f2: 300, gain: 0.07 * k, a: 0.003, tau: 0.05, dur: 0.25 }); // spring
  } },
  hoodOpen: { bus: 'world', dur: 1.1, fn(s, out, t, o) {
    const k = o.force ?? 1;
    click(s, out, t, k * 0.7, 2000); // safety catch
    s.pulses(out, t + 0.05, [{ dt: 0, g: 0.5 }, { dt: 0.06, g: 0.3 }, { dt: 0.14, g: 0.4 }], { f: 1400, q: 2, tau: 0.01, gain: k * 0.6 });
    const ts = t + s.j(0.55, 0.2); // hood reaches its stop on the hinges
    s.tone(out, ts, { f: s.j(72, 0.08), f2: 48, gain: 0.7 * k, a: 0.003, tau: 0.07, dur: 0.3 });
    s.modal(out, ts, [{ f: s.j(112, 0.05), g: 0.45, t60: 0.5 }, { f: s.j(190, 0.05), g: 0.35, t60: 0.4 }, { f: s.j(310, 0.05), g: 0.25, t60: 0.35 }, { f: s.j(520, 0.05), g: 0.14, t60: 0.28 }, { f: s.j(1120, 0.05), g: 0.07, t60: 0.2 }], { gain: 0.8 * k });
    s.tone(out, t + 0.1, { f: s.j(300, 0.1), f2: 420, type: 'triangle', gain: 0.025 * k, a: 0.08, tau: 0.2, dur: 0.45 }); // hinge squeak
  } },
  hoodClose: { bus: 'world', dur: 1.0, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.tone(out, t, { f: s.j(62, 0.08), f2: 40, gain: 1.0 * k, a: 0.002, tau: 0.08, dur: 0.4 });
    s.modal(out, t, [{ f: s.j(105, 0.05), g: 0.55, t60: 0.55 }, { f: s.j(185, 0.05), g: 0.4, t60: 0.45 }, { f: s.j(300, 0.05), g: 0.3, t60: 0.38 }, { f: s.j(540, 0.05), g: 0.16, t60: 0.28 }], { gain: 0.9 * k });
    const tl = t + 0.012; // primary latch crunches over the striker
    s.modal(out, tl, [{ f: s.j(1350, 0.05), g: 0.2, t60: 0.1 }, { f: s.j(2300, 0.05), g: 0.12, t60: 0.08 }], { gain: k }); click(s, out, tl, k * 1.2, 2800);
    s.noise(out, t, { f: 700, f2: 220, q: 0.7, gain: 0.45 * k, a: 0.004, tau: 0.06, dur: 0.25 });
  } },
  tailgateOpen: { bus: 'world', dur: 1.3, fn(s, out, t, o) {
    const k = o.force ?? 1;
    click(s, out, t, k, 2000); s.modal(out, t, [{ f: s.j(900, 0.05), g: 0.25, t60: 0.07 }], { gain: k });
    const ts = t + s.j(0.45, 0.15); // gate drops onto its cables
    s.tone(out, ts, { f: s.j(58, 0.08), f2: 40, gain: 0.8 * k, a: 0.002, tau: 0.07, dur: 0.35 });
    s.modal(out, ts, [{ f: s.j(180, 0.05), g: 0.5, t60: 0.5 }, { f: s.j(310, 0.05), g: 0.36, t60: 0.38 }, { f: s.j(520, 0.05), g: 0.26, t60: 0.3 }, { f: s.j(870, 0.05), g: 0.14, t60: 0.22 }], { gain: 0.85 * k });
    const rat = []; for (let i = 0; i < 7; i++) rat.push({ dt: i * 0.045 + s.r() * 0.02, g: Math.pow(0.78, i) });
    s.pulses(out, ts + 0.01, rat, { f: 3200, q: 2, tau: 0.01, gain: 0.5 * k }); // cable and chain rattle
  } },
  tailgateClose: { bus: 'world', dur: 1.0, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.tone(out, t, { f: s.j(66, 0.08), f2: 42, gain: 0.85 * k, a: 0.002, tau: 0.06, dur: 0.3 });
    s.modal(out, t, [{ f: s.j(170, 0.05), g: 0.5, t60: 0.42 }, { f: s.j(300, 0.05), g: 0.35, t60: 0.32 }, { f: s.j(510, 0.05), g: 0.24, t60: 0.26 }], { gain: 0.9 * k });
    const tl = t + 0.01; click(s, out, tl, k * 1.1, 2500); s.modal(out, tl, [{ f: s.j(1250, 0.05), g: 0.22, t60: 0.1 }, { f: s.j(2100, 0.05), g: 0.12, t60: 0.08 }], { gain: k });
    s.pulses(out, t + 0.03, [{ dt: 0, g: 0.5 }, { dt: 0.05, g: 0.35 }, { dt: 0.11, g: 0.2 }], { f: 1800, q: 1.5, tau: 0.015, gain: 0.5 * k }); // bed rattle
  } },
  fuelDoor: { bus: 'world', dur: 0.4, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.pulses(out, t, [{ dt: 0, g: 0.8 }, { dt: s.j(0.09, 0.2), g: 0.55 }], { f: 2600, q: 2, tau: 0.006, gain: 0.7 * k });
    s.modal(out, t, [{ f: s.j(900, 0.08), g: 0.1, t60: 0.05 }], { gain: k });
    s.tone(out, t + 0.01, { f: s.j(700, 0.1), f2: 520, gain: 0.04 * k, a: 0.002, tau: 0.03, dur: 0.1 });
  } },
  strapRatchet: { bus: 'world', dur: 1.4, fn(s, out, t, o) {
    const k = o.force ?? 1, n = o.clicks ?? 9 + Math.floor(s.r() * 4), ev = []; let dt = 0;
    for (let i = 0; i < n; i++) { ev.push({ dt, g: 0.55 + 0.45 * s.r() }); dt += s.j(0.1, 0.25) * (1 - 0.35 * i / n); }
    s.pulses(out, t, ev, { f: s.j(3000, 0.05), q: 3.5, tau: 0.0045, gain: 0.9 * k }); // pawl on the ratchet wheel
    s.pulses(out, t, ev, { f: 1100, q: 2, tau: 0.01, gain: 0.35 * k }); // handle body
    s.noise(out, t, { f: 2200, q: 0.6, gain: 0.05 * k, a: 0.02, tau: 0.5, dur: dt, buf: 'white' }); // webbing sliding
  } },
  strapRelease: { bus: 'world', dur: 0.8, fn(s, out, t, o) {
    const k = o.force ?? 1;
    click(s, out, t, k, 1800); s.modal(out, t, [{ f: s.j(1400, 0.05), g: 0.3, t60: 0.08 }, { f: s.j(2500, 0.05), g: 0.15, t60: 0.06 }, { f: s.j(230, 0.1), g: 0.3, t60: 0.1 }], { gain: k }); // lever clack
    s.noise(out, t + 0.03, { f: 2800, f2: 1000, q: 0.9, gain: 0.18 * k, a: 0.01, tau: 0.15, dur: 0.5 }); // webbing runs free
  } },
  drawerOpen: { bus: 'world', dur: 1.0, fn(s, out, t, o) {
    const k = o.force ?? 1;
    click(s, out, t, k * 0.5, 2500);
    s.noise(out, t + 0.02, { f: 250, f2: s.j(480, 0.15), q: 0.9, gain: 0.3 * k, a: 0.05, tau: 0.22, dur: 0.6, buf: 'brown', am: { hz: s.j(23, 0.2), depth: 0.35 } }); // ball-bearing slide
    const ts = t + s.j(0.5, 0.15);
    s.modal(out, ts, [{ f: s.j(210, 0.05), g: 0.45, t60: 0.14 }, { f: s.j(520, 0.05), g: 0.22, t60: 0.1 }, { f: s.j(1500, 0.05), g: 0.1, t60: 0.07 }], { gain: k }); // stop
    s.pulses(out, ts, [{ dt: 0.01, g: 0.5 }, { dt: 0.07, g: 0.25 }], { f: 4000, q: 2, tau: 0.01, gain: 0.5 * k }); // tools shift
  } },
  drawerClose: { bus: 'world', dur: 1.0, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.noise(out, t, { f: 520, f2: 240, q: 0.9, gain: 0.3 * k, a: 0.03, tau: 0.16, dur: 0.4, buf: 'brown', am: { hz: s.j(25, 0.2), depth: 0.35 } });
    const ts = t + s.j(0.32, 0.15);
    s.tone(out, ts, { f: s.j(95, 0.1), f2: 60, gain: 0.5 * k, a: 0.002, tau: 0.05, dur: 0.25 });
    s.modal(out, ts, [{ f: s.j(230, 0.05), g: 0.55, t60: 0.2 }, { f: s.j(460, 0.05), g: 0.3, t60: 0.15 }, { f: s.j(1300, 0.05), g: 0.14, t60: 0.1 }], { gain: k });
    const ev = []; for (let i = 0; i < 6; i++) ev.push({ dt: i * 0.04 + s.r() * 0.02, g: Math.pow(0.7, i) });
    s.pulses(out, ts + 0.01, ev, { f: s.j(3800, 0.1), q: 2.5, tau: 0.012, gain: 0.55 * k }); // tools clink
  } },
  rollupUp: { bus: 'world', dur: 5.5, fn: (s, out, t, o) => rollup(s, out, t, o, true) },
  rollupDown: { bus: 'world', dur: 5.5, fn: (s, out, t, o) => rollup(s, out, t, o, false) },
  keyTurn: { bus: 'local', dur: 0.4, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.pulses(out, t, [{ dt: 0, g: 0.8 }, { dt: s.j(0.05, 0.2), g: 0.6 }], { f: 3300, q: 4, tau: 0.004, gain: 0.5 * k }); // wafer tumblers and detent
    s.modal(out, t, [{ f: s.j(380, 0.06), g: 0.25, t60: 0.05 }, { f: s.j(1700, 0.06), g: 0.08, t60: 0.04 }], { gain: k });
    if (o.to === 'START') s.tone(out, t + 0.08, { f: 240, f2: 200, gain: 0.05 * k, a: 0.004, tau: 0.04, dur: 0.15 }); // spring loaded
  } },
  relay: { bus: 'local', dur: 0.4, fn(s, out, t, o) {
    const k = (o.force ?? 1) * 0.7;
    s.modal(out, t, [{ f: s.j(1650, 0.05), g: 0.4, t60: 0.03 }, { f: s.j(380, 0.08), g: 0.35, t60: 0.05 }, { f: s.j(150, 0.08), g: 0.5, t60: 0.07 }], { gain: k });
    click(s, out, t, k * 0.8, 2600);
    if (o.heavy !== false) { // starter solenoid slams the pinion into the ring gear
      s.modal(out, t + 0.012, [{ f: s.j(110, 0.06), g: 0.7, t60: 0.14 }, { f: s.j(880, 0.06), g: 0.18, t60: 0.09 }, { f: s.j(2100, 0.06), g: 0.07, t60: 0.05 }], { gain: k });
      s.noise(out, t + 0.015, { f: 1500, q: 1, gain: 0.25 * k, a: 0.002, tau: 0.02, dur: 0.1 });
    }
  } },
  waitTick: { bus: 'local', dur: 0.2, fn(s, out, t, o) {
    const k = (o.force ?? 1) * 0.5; // the glow plug relay clicking behind the dash
    s.modal(out, t, [{ f: s.j(1900, 0.05), g: 0.3, t60: 0.02 }, { f: s.j(420, 0.08), g: 0.25, t60: 0.03 }], { gain: k }); click(s, out, t, k, 3000);
  } },
  buttonClick: { bus: 'local', dur: 0.15, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.tone(out, t, { f: s.j(2400, 0.04), f2: 1800, gain: 0.22 * k, a: 0.0008, tau: 0.004, dur: 0.03 });
    click(s, out, t, k * 0.3, 4000);
  } },
  chime: { bus: 'local', dur: 2.2, fn(s, out, t, o) {
    // GM style door-ajar bell: repeated struck bell with slightly inharmonic partials
    const k = o.force ?? 1, f0 = o.f ?? 784, n = o.count ?? 3;
    for (let i = 0; i < n; i++) {
      const ti = t + i * 0.42;
      s.modal(out, ti, [{ f: f0, g: 0.5, t60: 0.7 }, { f: f0 * 2.01, g: 0.22, t60: 0.5 }, { f: f0 * 3.02, g: 0.1, t60: 0.3 }, { f: f0 * 4.18, g: 0.05, t60: 0.2 }], { gain: 0.55 * k, spread: 0.002 });
    }
  } },
  wrench: { bus: 'world', dur: 1.0, fn(s, out, t, o) {
    const k = o.force ?? 1, ev = []; let dt = 0, n = 5 + Math.floor(s.r() * 3);
    for (let i = 0; i < n; i++) { ev.push({ dt, g: 0.6 + 0.4 * s.r() }); dt += s.j(0.055, 0.3); }
    s.pulses(out, t, ev, { f: s.j(3600, 0.05), q: 3.5, tau: 0.004, gain: 0.8 * k }); // ratchet pawl
    s.modal(out, t, [{ f: s.j(4200, 0.04), g: 0.07, t60: 0.2 }, { f: s.j(1650, 0.04), g: 0.1, t60: 0.15 }], { gain: k }); // steel rings
    s.modal(out, t + dt, [{ f: s.j(2300, 0.04), g: 0.16, t60: 0.1 }, { f: s.j(320, 0.06), g: 0.3, t60: 0.1 }], { gain: k }); // set down
  } },
  plugIn: { bus: 'world', dur: 0.4, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.noise(out, t, { f: s.j(1400, 0.08), q: 2, gain: 0.45 * k, a: 0.001, tau: 0.008, dur: 0.06 }); // plastic snap
    s.modal(out, t, [{ f: s.j(2400, 0.05), g: 0.12, t60: 0.05 }, { f: s.j(180, 0.08), g: 0.4, t60: 0.08 }], { gain: k });
    click(s, out, t + 0.04, k * 0.4, 2800);
  } },
  chargerClamp: { bus: 'world', dur: 0.6, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.modal(out, t, [{ f: s.j(1900, 0.05), g: 0.3, t60: 0.08 }, { f: s.j(3100, 0.05), g: 0.2, t60: 0.06 }, { f: s.j(540, 0.06), g: 0.25, t60: 0.1 }], { gain: k });
    click(s, out, t, k * 1.0, 4000); click(s, out, t + 0.09, k * 0.5, 3500); // jaws snap, teeth bite the terminal
  } },
  flashDone: { bus: 'local', dur: 0.7, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.tone(out, t, { f: 988, type: 'triangle', gain: 0.22 * k, a: 0.005, tau: 0.04, dur: 0.12, lp: 5000 });
    s.tone(out, t + 0.14, { f: 1318, type: 'triangle', gain: 0.22 * k, a: 0.005, tau: 0.09, dur: 0.3, lp: 5000 });
  } },
  flashFail: { bus: 'local', dur: 0.8, fn(s, out, t, o) {
    const k = o.force ?? 1;
    s.tone(out, t, { f: 196, type: 'sawtooth', gain: 0.18 * k, a: 0.005, tau: 0.12, dur: 0.24, lp: 1500 });
    s.tone(out, t + 0.3, { f: 165, type: 'sawtooth', gain: 0.18 * k, a: 0.005, tau: 0.18, dur: 0.36, lp: 1500 });
  } },
  failBang: { bus: 'world', dur: 2.0, fn(s, out, t, o) {
    const k = o.force ?? 1, part = o.part || 'generic';
    s.tone(out, t, { f: s.j(72, 0.1), f2: 30, gain: 1.0 * k, a: 0.002, tau: 0.13, dur: 0.6 }); // the thud
    s.noise(out, t, { f: 1600, q: 0.5, gain: 0.9 * k, a: 0.0008, tau: 0.03, dur: 0.25 }); // the crack
    s.modal(out, t, [{ f: s.j(540, 0.08), g: 0.3, t60: 0.8 }, { f: s.j(1230, 0.08), g: 0.2, t60: 0.6 }, { f: s.j(2400, 0.08), g: 0.1, t60: 0.4 }], { gain: k });
    const ev = []; let dt = 0.08; for (let i = 0; i < 14; i++) { ev.push({ dt, g: Math.pow(0.82, i) * (0.6 + 0.4 * s.r()) }); dt += 0.03 + 0.012 * i + s.r() * 0.02; }
    s.pulses(out, t, ev, { f: s.j(2300, 0.1), q: 3, tau: 0.012, gain: 0.7 * k }); // debris rattling
    if (part === 'turbo') s.tone(out, t + 0.04, { f: 1500, f2: 260, type: 'sawtooth', gain: 0.2 * k, a: 0.02, tau: 0.5, dur: 1.2, lp: 3500 }); // wheel spins down screaming
    else if (part === 'transmission') { s.noise(out, t + 0.05, { f: 800, f2: 300, q: 0.8, gain: 0.5 * k, a: 0.02, tau: 0.3, dur: 0.9 }); s.modal(out, t + 0.1, [{ f: s.j(130, 0.1), g: 0.6, t60: 0.3 }], { gain: k }); }
    else if (part === 'piston') s.pulses(out, t + 0.2, [{ dt: 0, g: 1 }, { dt: 0.13, g: 0.8 }, { dt: 0.27, g: 0.6 }], { f: 700, q: 1.5, tau: 0.02, gain: 0.8 * k });
    else if (part === 'headGasket') s.noise(out, t + 0.04, { type: 'highpass', f: 3500, q: 0.7, gain: 0.3 * k, a: 0.01, tau: 0.5, dur: 1.5 });
  } },
};

// aliases accepted by trigger()
export const ALIASES = { 'wait to start': 'waitTick', 'wait to start tick': 'waitTick', waitToStartTick: 'waitTick', wts: 'waitTick', wait: 'waitTick' };

// Roll-up shop door: a chain hoist and motor hum, slats rattling in the tracks, one clack per slat leaf, and the bottom bar
// meeting the floor (down) or the header stop (up).
function rollup(s, out, t, o, up) {
  const k = o.force ?? 1, dur = o.duration ?? 4.5, bus = s.bus(out);
  bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + 0.25); bus.gain.setValueAtTime(1, t + dur - 0.3); bus.gain.linearRampToValueAtTime(0.5, t + dur);
  s.tone(bus, t, { f: s.j(61, 0.05), f2: up ? 66 : 57, type: 'sawtooth', gain: 0.1 * k, a: 0.3, hold: true, dur, lp: 520 }); // hoist motor, 60 Hz mains plus gear
  s.noise(bus, t, { f: 420, q: 1.1, gain: 0.2 * k, a: 0.3, hold: true, dur, buf: 'brown', am: { hz: 9, depth: 0.5 } }); // tracks
  s.noise(bus, t, { f: 1300, q: 0.7, gain: 0.07 * k, a: 0.3, hold: true, dur, am: { hz: 14, depth: 0.7 } }); // slat rattle
  const ev = []; const rate = 6; for (let x = 0.2; x < dur - 0.2; x += 1 / rate) ev.push({ dt: x + s.r() * 0.04, g: 0.5 + 0.5 * s.r() });
  s.pulses(bus, t, ev, { f: 1900, q: 2, tau: 0.012, gain: 0.35 * k }); // each slat leaf clacks over the drum
  const te = t + dur; // end of travel
  if (up) {
    s.modal(out, te, [{ f: s.j(150, 0.1), g: 0.4, t60: 0.2 }, { f: s.j(420, 0.1), g: 0.2, t60: 0.2 }, { f: s.j(1200, 0.1), g: 0.1, t60: 0.1 }], { gain: 0.7 * k });
  } else {
    s.tone(out, te, { f: s.j(70, 0.1), f2: 42, gain: 0.8 * k, a: 0.002, tau: 0.08, dur: 0.4 });
    s.modal(out, te, [{ f: s.j(160, 0.06), g: 0.5, t60: 0.7 }, { f: s.j(275, 0.06), g: 0.35, t60: 0.55 }, { f: s.j(440, 0.06), g: 0.25, t60: 0.4 }, { f: s.j(960, 0.06), g: 0.12, t60: 0.3 }], { gain: 0.9 * k });
    const rat = []; for (let i = 0; i < 8; i++) rat.push({ dt: i * 0.05 + s.r() * 0.02, g: Math.pow(0.75, i) });
    s.pulses(out, te, rat, { f: 2200, q: 1.5, tau: 0.015, gain: 0.6 * k });
  }
}
