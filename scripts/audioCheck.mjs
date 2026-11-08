// Offline audio check: renders scenarios through the real AudioEngine code path with an OfflineAudioContext in headless
// Chromium, then analyses the samples in Node (RMS, peaks, FFT peaks at the expected firing and whistle frequencies, clipping
// and NaN checks). Usage: node scripts/audioCheck.mjs [--save]   (--save writes WAVs to .dev/audio/)
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
import * as D from '../src/audio/dsp.js';
import { firingHz, turboWhistleHz, coldFactor } from '../src/audio/mapping.js';

const SR = 44100, SECS = 3;
const save = process.argv.includes('--save');

// ---------------------------------------------------------------- scenarios (run inside the page)
// st / listener are plain data; events = [[time, name, opts]]
const ONE = ["doorOpen", "doorClose", "hoodRelease", "hoodOpen", "hoodClose", "tailgateOpen", "tailgateClose", "fuelDoor", "strapRatchet", "strapRelease", "drawerOpen", "drawerClose", "keyTurn", "relay", "buttonClick", "chime", "wrench", "plugIn", "chargerClamp", "flashDone", "flashFail", "failBang", "waitTick"];
const SCENARIOS = {
  idleWarm: { st: { running: true, rpm: 680, load: 0.16, qty: 8, turboRpm: 17700, vane: 0.4, boostPsi: -0.5, mAir: 0.04, driveKpa: 106, coolantF: 195 }, L: { distanceToTruck: 5, distanceToDyno: 7, pan: 0 } },
  idleCold: { st: { running: true, rpm: 680, load: 0.16, qty: 8, turboRpm: 17700, vane: 0.4, boostPsi: -0.5, mAir: 0.04, driveKpa: 106, coolantF: 40 }, L: { distanceToTruck: 5, distanceToDyno: 7 } },
  idleWarmCab: { st: { running: true, rpm: 680, load: 0.16, qty: 8, turboRpm: 17700, vane: 0.4, boostPsi: -0.5, mAir: 0.04, driveKpa: 106, coolantF: 195 }, L: { inCab: true, distanceToTruck: 2, distanceToDyno: 5 } },
  idleTurboSound: { st: { running: true, rpm: 680, load: 0.16, qty: 8, turboRpm: 52000, vane: 0.85, boostPsi: 2, mAir: 0.05, driveKpa: 190, coolantF: 195 }, L: { distanceToTruck: 5, distanceToDyno: 7 } },
  wot: { st: { running: true, rpm: 3000, load: 1, qty: 70, turboRpm: 110000, vane: 0.64, boostPsi: 25, mAir: 0.33, driveKpa: 330, smoke: 0.2, coolantF: 205, fanDuty: 1, rollerRad: 110, shopFan: true, exhaustHose: true, tccLocked: true }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  wotNoTurbo: { st: { running: true, rpm: 3000, load: 1, qty: 70, turboRpm: 0, vane: 0.64, boostPsi: 0, mAir: 0, driveKpa: 101, smoke: 0.2, coolantF: 205, fanDuty: 1, rollerRad: 110, shopFan: true, exhaustHose: true }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  hissAir: { st: { running: true, rpm: 700, load: 0.1, qty: 8, turboRpm: 0, vane: 0.64, boostPsi: 25, mAir: 0.33, driveKpa: 330, coolantF: 205 }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  hissNoAir: { st: { running: true, rpm: 700, load: 0.1, qty: 8, turboRpm: 0, vane: 0.64, boostPsi: 0, mAir: 0.0, driveKpa: 101, coolantF: 205 }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  wotCab: { st: { running: true, rpm: 3000, load: 1, qty: 70, turboRpm: 110000, vane: 0.64, boostPsi: 25, mAir: 0.33, driveKpa: 330, coolantF: 205, fanDuty: 1, rollerRad: 110, shopFan: true, exhaustHose: true }, L: { inCab: true, distanceToTruck: 2, distanceToDyno: 5 } },
  wotTurboFail: { st: { running: true, rpm: 3000, load: 1, qty: 70, turboRpm: 110000, vane: 0.64, boostPsi: 25, mAir: 0.33, driveKpa: 330, coolantF: 205, fail: { turbo: true } }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  doors: { st: { running: false }, L: { distanceToTruck: 4, distanceToDyno: 6 }, events: [[0.2, 'doorClose', { distance: 3 }], [1.2, 'hoodClose', { distance: 2 }], [2.2, 'tailgateClose', { distance: 5 }]] },
  // component isolation (levels only): which layer dominates the WOT mix
  wotEngine: { st: { running: true, rpm: 3000, load: 1, qty: 70, turboRpm: 110000, vane: 0.64, boostPsi: 25, mAir: 0.33, driveKpa: 330, smoke: 0.2, coolantF: 205 }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  wotFanOnly: { st: { running: true, rpm: 3000, load: 0, qty: 0, turboRpm: 0, mAir: 0, coolantF: 205, fanDuty: 1 }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  shopFanOnly: { st: { shopFan: true }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  rollerOnly: { st: { rollerRad: 110 }, L: { distanceToTruck: 5, distanceToDyno: 5 } },
  oneshots: { secs: 80, st: { running: false }, L: { distanceToTruck: 3, distanceToDyno: 6 }, events: ONE.map((n, i) => [0.3 + i * 2.5, n, { distance: 3 }]).concat([[0.3 + ONE.length * 2.5, 'rollupDown', { distance: 5, duration: 4 }], [0.3 + ONE.length * 2.5 + 7, 'rollupUp', { distance: 5, duration: 4 }]]) },
  start: { secs: 5, seq: 'start', L: { distanceToTruck: 5, distanceToDyno: 7 } },
};

async function renderAll(page) {
  return page.evaluate(async ({ SCENARIOS, SR, SECS }) => {
    const m = await import('/src/audio/index.js');
    SCENARIOS.oneshots.events = SCENARIOS.oneshots.events; // plain data survives serialisation
    const toB64 = (f32) => { const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
    const out = {};
    for (const [name, sc] of Object.entries(SCENARIOS)) {
      const secs = sc.secs || SECS, ctx = new OfflineAudioContext(2, SR * secs, SR), eng = new m.AudioEngine({ context: ctx, volume: 1, seed: 7 });
      await eng.start();
      const events = (sc.events || []).slice().sort((a, b) => a[0] - b[0]); let ei = 0;
      const dt = 1 / 60; let maxNodesPerSec = 0, t0 = performance.now();
      for (let t = 0; t < secs; t += dt) {
        eng.setTime(t);
        let st = sc.st;
        if (sc.seq === 'start') { // key to START at 0.5 s, cranks at ~190 rpm, the engine catches at 2.0 s and runs up to 680 rpm
          const cr = t >= 0.5 && t < 2.0, run = t >= 2.0;
          st = { cranking: cr, running: run, wtsOn: t < 0.5, rpm: cr ? 190 + 8 * Math.sin(t * 25) : run ? Math.min(680, 190 + (t - 2.0) * 900) : 0, load: run ? 0.2 : 0, qty: run ? 20 : 0, turboRpm: run ? 17000 : 0, coolantF: 40, mAir: run ? 0.04 : 0 };
        }
        while (ei < events.length && events[ei][0] <= t) { eng.trigger(events[ei][1], events[ei][2]); ei++; }
        eng.update(dt, st, sc.L);
      }
      const build = performance.now() - t0, buf = await ctx.startRendering();
      const l = buf.getChannelData(0), r = buf.getChannelData(1);
      let peak = 0, nan = 0;
      for (let i = 0; i < l.length; i++) { const a = Math.abs(l[i]), b = Math.abs(r[i]); if (!(a <= 1e9) || !(b <= 1e9)) nan++; if (a > peak) peak = a; if (b > peak) peak = b; }
      out[name] = { l: toB64(l), r: toB64(r), peak, nan, secs, stats: eng.stats, buildMs: build, nodesPerSec: eng.stats.nodesCreated / secs };
    }
    return out;
  }, { SCENARIOS, SR, SECS });
}

// ---------------------------------------------------------------- analysis
const f32 = (b64) => { const b = Buffer.from(b64, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4).slice(); };
const db = (v) => D.toDb(v).toFixed(1);
const bandRms = (x, type, f, q = 0.7) => D.rms(D.biquad(x, type, SR, f, q));
const bandDb = (x, lo, hi) => db(D.rms(D.biquad(D.biquad(x, 'highpass', SR, lo, 0.7), 'lowpass', SR, hi, 0.7)));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };

function writeWav(path, x) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(path, b);
}

const app = await startApp(5198);
const logs = [];
const { browser, page } = await openPage({ url: app.url + 'vite.config.js', logs });
let raw;
try { raw = await renderAll(page); } finally { await browser.close(); await app.close(); }
if (logs.length) console.log('browser console:', logs.slice(0, 5).join(' | '));

const S = {};
for (const [name, r] of Object.entries(raw)) {
  const l = f32(r.l); S[name] = { l, r: f32(r.r), peak: r.peak, nan: r.nan, stats: r.stats, nps: r.nodesPerSec, secs: r.secs };
  if (save) { fs.mkdirSync('.dev/audio', { recursive: true }); writeWav(`.dev/audio/${name}.wav`, l); }
}
console.log('\nscenario            RMS dBFS   peak     NaN  grains  nodes/s  dropped');
for (const [name, s] of Object.entries(S)) console.log(`${name.padEnd(18)}  ${db(D.rms(s.l)).padStart(7)}  ${s.peak.toFixed(3).padStart(6)}  ${String(s.nan).padStart(4)}  ${String(s.stats.grains).padStart(6)}  ${s.nps.toFixed(0).padStart(7)}  ${s.stats.dropped}`);
console.log('\nband levels dBFS      <150   150-600  0.6-2k   2-5k   >5k');
for (const [name, s] of Object.entries(S)) console.log(`${name.padEnd(18)}  ${[[20, 150], [150, 600], [600, 2000], [2000, 5000], [5000, 15000]].map(([a, b]) => bandDb(s.l, a, b).padStart(7)).join(' ')}`);
console.log('');

// all scenarios: no NaN, no clipping, not silent unless expected
for (const [name, s] of Object.entries(S)) {
  const sub = D.rms(D.biquad(D.biquad(s.l, 'lowpass', SR, 18, 0.7), 'lowpass', SR, 18, 0.7)), mean = s.l.reduce((a, v) => a + v, 0) / s.l.length;
  check(`${name}: no DC or subsonic rumble (< 18 Hz at least 20 dB under the total)`, D.toDb(sub) < D.toDb(D.rms(s.l)) - 20 && Math.abs(mean) < 0.005, `sub ${db(sub)} dBFS, mean ${mean.toExponential(1)}`);
  check(`${name}: finite samples, max|x| <= 1`, s.nan === 0 && s.peak <= 1, `peak ${s.peak.toFixed(3)} nan ${s.nan}`);
  check(`${name}: node creation <= ~120/s steady layers`, name === 'doors' || name === 'start' || s.nps <= 135, `${s.nps.toFixed(0)} nodes/s`);
}

// idle: combustion knock rate = firing frequency. Envelope of the 1.5-4 kHz band, then its spectrum.
{
  const x = S.idleWarm.l, fire = firingHz(680);
  const band = D.biquad(D.biquad(x, 'highpass', SR, 1500, 0.7), 'lowpass', SR, 4000, 0.7);
  const env = new Float32Array(band.length); for (let i = 0; i < env.length; i++) env[i] = Math.abs(band[i]);
  const envLp = D.biquad(env, 'lowpass', SR, 400, 0.7);
  const dec = new Float32Array(Math.floor(envLp.length / 4)); for (let i = 0; i < dec.length; i++) dec[i] = envLp[i * 4];
  const ac = D.powerSpectrum(dec.map((v, i, a) => v - 0), SR / 4, 8192);
  const pk = D.peakIn(ac, 30, 70, 40);
  check('idle: knock envelope periodicity at the firing frequency', Math.abs(pk.hz - fire) < 1.6 && pk.prominenceDb > 8, `expected ${fire.toFixed(2)} Hz, found ${pk.hz.toFixed(2)} Hz, +${pk.prominenceDb.toFixed(1)} dB over median`);
  const lf = D.powerSpectrum(x, SR, 32768), lpk = D.peakIn(lf, 38, 56, 60);
  console.log(`      low-frequency exhaust/thump peak: ${lpk.hz.toFixed(1)} Hz (+${lpk.prominenceDb.toFixed(1)} dB)`);
  check('idle: low-frequency spectrum has a peak at 1x/2x firing', lpk.hz > 38 && lpk.hz < 56, `${lpk.hz.toFixed(1)} Hz`);
  // count discrete knock events by peak-picking the smoothed envelope
  const sm = D.biquad(env, 'lowpass', SR, 600, 0.7); let cnt = 0, last = -1e9; const thr = D.rms(sm) * 1.4;
  for (let i = 1; i < sm.length - 1; i++) if (sm[i] > thr && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1] && i - last > SR / (fire * 2.2)) { cnt++; last = i; }
  check('idle: about 45 knock events per second', Math.abs(cnt / SECS - fire) < 8, `${(cnt / SECS).toFixed(1)}/s counted vs ${fire.toFixed(1)}`);
}

// cold engine louder, with more clatter
{
  const w = S.idleWarm.l, c = S.idleCold.l, wb = D.rms(D.biquad(D.biquad(w, 'highpass', SR, 1500, 0.7), 'lowpass', SR, 4500, 0.7)), cb = D.rms(D.biquad(D.biquad(c, 'highpass', SR, 1500, 0.7), 'lowpass', SR, 4500, 0.7));
  check('cold idle is louder than warm idle (overall and in the clatter band)', D.rms(c) > D.rms(w) * 1.15 && cb > wb * 1.3, `overall +${(D.toDb(D.rms(c)) - D.toDb(D.rms(w))).toFixed(1)} dB, clatter band +${(D.toDb(cb) - D.toDb(wb)).toFixed(1)} dB (cold factor ${coldFactor(40).toFixed(2)} vs ${coldFactor(195).toFixed(2)})`);
}

// cab: muffled (less energy above 2 kHz relative to total), more bass-heavy
{
  const o = S.idleWarm.l, c = S.idleWarmCab.l;
  const hiO = D.rms(D.biquad(o, 'highpass', SR, 2500, 0.7)) / D.rms(o), hiC = D.rms(D.biquad(c, 'highpass', SR, 2500, 0.7)) / D.rms(c);
  check('cab muffles the highs (HF share drops by more than 6 dB)', hiC < hiO * 0.5, `HF share outside ${db(hiO)} dB, in cab ${db(hiC)} dB`);
}

// WOT: the turbo whistle at the modeled blade-pass frequency, its harmonic, and the engine at high rpm
{
  const f0 = turboWhistleHz(110000), sp = D.powerSpectrum(S.wot.l, SR, 32768);
  const p1 = D.peakIn(sp, f0 * 0.9, f0 * 1.1, 300), p2 = D.peakIn(sp, f0 * 1.9, f0 * 2.1, 500);
  check('wot: whistle fundamental at turboRpm/60*11/16', Math.abs(p1.hz - f0) / f0 < 0.02 && p1.prominenceDb > 10, `expected ${f0.toFixed(0)} Hz, found ${p1.hz.toFixed(0)} Hz, +${p1.prominenceDb.toFixed(1)} dB`);
  check('wot: whistle 2nd harmonic present', Math.abs(p2.hz - 2 * f0) / (2 * f0) < 0.02 && p2.prominenceDb > 5, `expected ${(2 * f0).toFixed(0)} Hz, found ${p2.hz.toFixed(0)} Hz, +${p2.prominenceDb.toFixed(1)} dB`);
  const spN = D.powerSpectrum(S.wotNoTurbo.l, SR, 32768), n1 = D.peakIn(spN, f0 * 0.9, f0 * 1.1, 300);
  check('wot: whistle peak disappears when the shaft is stopped (physics-driven)', n1.prominenceDb < p1.prominenceDb - 8, `with turbo +${p1.prominenceDb.toFixed(1)} dB, without +${n1.prominenceDb.toFixed(1)} dB`);
  const hissW = D.rms(D.biquad(D.biquad(S.hissAir.l, 'highpass', SR, 4500, 0.7), 'lowpass', SR, 9000, 0.7)), hissN = D.rms(D.biquad(D.biquad(S.hissNoAir.l, 'highpass', SR, 4500, 0.7), 'lowpass', SR, 9000, 0.7));
  check('wot: intake + drive-pressure hiss (airflow, no shaft whistle) adds energy at 4.5-9 kHz', hissW > hissN * 1.25, `${db(hissW)} dB with airflow vs ${db(hissN)} dB without`);
  const fire3000 = firingHz(3000), env = D.biquad(D.biquad(S.wot.l, 'highpass', SR, 20, 0.7), 'lowpass', SR, 400, 0.7), sp2 = D.powerSpectrum(env, SR, 32768), e1 = D.peakIn(sp2, 160, 260, 60);
  check('wot: engine pulse content near the 3,000 rpm firing frequency (200 Hz)', Math.abs(e1.hz - fire3000) < 0.1 * fire3000 || Math.abs(e1.hz - fire3000 / 2) < 0.06 * fire3000, `expected ${fire3000.toFixed(0)} Hz (or its half), found ${e1.hz.toFixed(0)} Hz`);
  console.log(`      WOT level ${db(D.rms(S.wot.l))} dBFS vs idle ${db(D.rms(S.idleWarm.l))} dBFS`);
  check('wot is louder than idle', D.rms(S.wot.l) > D.rms(S.idleWarm.l) * 1.5, `+${(D.toDb(D.rms(S.wot.l)) - D.toDb(D.rms(S.idleWarm.l))).toFixed(1)} dB`);
}

// turbo sound page: closing the vanes at idle raises the shaft speed -> whistle appears and rises in pitch/level
{
  const f0 = turboWhistleHz(52000), a = D.peakIn(D.powerSpectrum(S.idleTurboSound.l, SR, 32768), f0 * 0.9, f0 * 1.1, 300), b = D.peakIn(D.powerSpectrum(S.idleWarm.l, SR, 32768), f0 * 0.9, f0 * 1.1, 300);
  check('idle with Turbo Sound vanes closed: whistle audible at the modeled pitch', Math.abs(a.hz - f0) / f0 < 0.03 && a.prominenceDb > b.prominenceDb + 6, `expected ${f0.toFixed(0)} Hz, found ${a.hz.toFixed(0)} Hz (+${a.prominenceDb.toFixed(1)} dB, stock idle +${b.prominenceDb.toFixed(1)} dB)`);
}

// damaged turbo: lower, gain drops, rough
{
  const f0 = turboWhistleHz(110000), sp = D.powerSpectrum(S.wotTurboFail.l, SR, 32768), ok = D.peakIn(D.powerSpectrum(S.wot.l, SR, 32768), f0 * 0.9, f0 * 1.1, 300), fl = D.peakIn(sp, f0 * 0.9, f0 * 1.1, 300);
  check('damaged turbo: clean whistle line at the healthy pitch is gone', fl.prominenceDb < ok.prominenceDb - 6, `healthy +${ok.prominenceDb.toFixed(1)} dB, damaged +${fl.prominenceDb.toFixed(1)} dB at ${f0.toFixed(0)} Hz`);
}

// door / hood / tailgate: transient with low thud and metallic ring, decays
{
  const x = S.doors.l, ev = [0.2, 1.2, 2.2];
  for (const [i, t0] of ev.entries()) {
    const seg = x.subarray(Math.floor(t0 * SR), Math.floor((t0 + 0.8) * SR)), pk = D.peakAbs(seg), early = D.rms(seg.subarray(0, Math.floor(0.15 * SR))), late = D.rms(seg.subarray(Math.floor(0.6 * SR)));
    const sp = D.powerSpectrum(seg, SR, 16384 / 2 > seg.length ? 8192 : 8192), low = D.peakIn(sp, 40, 220, 200), lowE = D.rms(D.biquad(seg, 'lowpass', SR, 250, 0.7)), hiE = D.rms(D.biquad(seg, 'highpass', SR, 1000, 0.7));
    check(`${['doorClose', 'hoodClose', 'tailgateClose'][i]}: impact then decay, low thud + metallic content`, pk > 0.05 && early > late * 4 && lowE > 0.01 && hiE > 0.002, `peak ${pk.toFixed(2)}, early/late ${(early / Math.max(late, 1e-9)).toFixed(0)}x, thud peak ${low.hz.toFixed(0)} Hz, LF ${db(lowE)} dB, HF ${db(hiE)} dB`);
  }
}

// shop reverb: after the door slam's direct sound has died away, a decaying tail remains (RT60 about 1.4 s)
{
  const x = S.doors.l, r = (a, b) => D.rms(x.subarray(Math.floor(a * SR), Math.floor(b * SR))), pk = r(0.2, 0.3);
  const t1 = r(0.55, 0.65), t2 = r(0.85, 0.95), decayDbPerS = (D.toDb(t2) - D.toDb(t1)) / 0.3;
  console.log(`      door slam tail: ${db(pk)} dB (direct 0.1 s), ${db(t1)} dB at +0.4 s, ${db(t2)} dB at +0.7 s, slope ${decayDbPerS.toFixed(0)} dB/s (RT60 60/${(-decayDbPerS).toFixed(0)} = ${(60 / -decayDbPerS).toFixed(2)} s)`);
  check('shop reverb: audible tail that decays on a ~1 s scale', t1 > pk * 0.003 && t2 < t1 && 60 / -decayDbPerS > 0.5 && 60 / -decayDbPerS < 3, '');
}

// every one-shot: audible, finite, decaying, no clipping, sensible level range
{
  const x = S.oneshots.l, ev = [...ONE.map((n, i) => [n, 0.3 + i * 2.5, 2.4]), ['rollupDown', 0.3 + ONE.length * 2.5, 6.5], ['rollupUp', 0.3 + ONE.length * 2.5 + 7, 6.5]];
  console.log('      one-shot levels (peak / RMS of the first 0.5 s, dBFS):');
  const rows = [];
  for (const [n, t0, len] of ev) {
    const seg = x.subarray(Math.floor(t0 * SR), Math.floor((t0 + len) * SR)), first = x.subarray(Math.floor(t0 * SR), Math.floor((t0 + 0.5) * SR)), tail = x.subarray(Math.floor((t0 + len - 0.3) * SR), Math.floor((t0 + len) * SR));
    const pk = D.peakAbs(seg), r1 = D.rms(first), rt = D.rms(tail); rows.push(`${n} ${db(pk)}/${db(r1)}`);
    check(`one-shot ${n}: audible, finite, decays`, pk > 0.01 && pk < 1 && !D.hasNaN(seg) && rt < r1 * 0.6 + 1e-6, `peak ${db(pk)} dBFS, first-0.5s RMS ${db(r1)}, tail RMS ${db(rt)}`);
  }
}

// start sequence: starter whine around gear-mesh frequency, compression pulses, then engine catches
{
  const x = S.start.l, seg = (a, b) => x.subarray(Math.floor(a * SR), Math.floor(b * SR));
  const crank = seg(0.7, 1.9), sp = D.powerSpectrum(crank, SR, 32768), mesh = 130 * 190 / 60, p = D.peakIn(sp, mesh * 0.8, mesh * 1.2, 300);
  check('cranking: starter gear-mesh whine near ring teeth x rpm / 60 (412 Hz)', Math.abs(p.hz - mesh) / mesh < 0.1 && p.prominenceDb > 8, `expected ${mesh.toFixed(0)} Hz, found ${p.hz.toFixed(0)} Hz (+${p.prominenceDb.toFixed(1)} dB)`);
  const pre = D.rms(seg(0, 0.45)), cr = D.rms(crank), caught = D.rms(seg(2.1, 2.9)), run = D.rms(seg(4, 5));
  console.log(`      start sequence RMS: key-on ${db(pre)} dBFS, cranking ${db(cr)}, engine catching ${db(caught)}, settled idle ${db(run)}`);
  check('start: cranking audible, catching louder than settled idle (cold clatter burst)', cr > pre * 3 && caught > run * 1.1, '');
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
