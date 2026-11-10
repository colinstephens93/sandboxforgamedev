import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { installFakeDom } from './helpers/truckHarness.js';
import { QUALITY, QUALITY_ORDER } from '../src/core/quality.js';
import { KEY } from '../src/sim/startSequence.js';
import { Plant } from '../src/sim/plant.js';
import { Dyno } from '../src/sim/dyno.js';
import { loadCal } from '../src/sim/calibrations.js';
import { spec } from '../src/data/truckSpec.js';

// The bench host under node: no renderer and no DOM. The truck is built on the canvas stub and the per-frame
// work (hooks, the 120 Hz sim, wheels, engine bay, cab, audio state) runs exactly as on the page, minus drawing.
let Bench, PANEL_FIELDS, BENCH_VIEWS, createKeyControl, buildTruck, setupTruckOpenings;
const said = [];
const stubUi = () => ({ say: (t) => said.push(t), update() {}, addPanel() {}, setQuality() {}, toggleHelp() {} });
const stubAudio = () => ({ calls: [], update(dt, st, l) { this.calls.push({ st, l }); }, trigger() {}, start() {}, setMuted() {} });
let truckParts;
function makeBench() {
  const b = new Bench(null, undefined, { ui: stubUi(), audio: stubAudio() });
  b.truck = truckParts.truck; b.ctl = truckParts.ctl; b.view = 'engine';
  return b;
}
const startWithKey = (b) => { // Off -> Run -> wait for the glow plugs -> hold Start until it fires
  b.keyCtl.off(); b.advance(0.3);
  b.keyCtl.run(); b.advance(4);
  const pressed = b.keyCtl.startPress(); b.advance(4); b.keyCtl.startRelease(); b.advance(10);
  return pressed;
};

beforeAll(async () => {
  installFakeDom();
  ({ Bench, PANEL_FIELDS, BENCH_VIEWS } = await import('../src/bench/bench.js'));
  ({ createKeyControl } = await import('../src/bench/controls.js'));
  ({ buildTruck } = await import('../src/truck/index.js'));
  ({ setupTruckOpenings } = await import('../src/game/truckControl.js'));
  const truck = buildTruck({ quality: QUALITY.bench });
  truckParts = { truck, ctl: setupTruckOpenings(truck, { say() {}, onLights() {} }) };
}, 120000);

describe('bench host: what the panels read', () => {
  it('PANEL_FIELDS is exactly the set of game fields used by src/ui', () => {
    const used = new Set();
    for (const f of fs.readdirSync('src/ui').filter((n) => n.endsWith('.js'))) {
      for (const m of fs.readFileSync(path.join('src/ui', f), 'utf8').matchAll(/\bgame\.([A-Za-z_]\w*)/g)) used.add(m[1]);
    }
    used.delete('uiAlerts'); // written by registerUi, never read from the host
    expect([...used].sort()).toEqual([...PANEL_FIELDS].sort());
  });
  it('exposes every one of them', () => {
    const b = makeBench();
    for (const k of PANEL_FIELDS) expect(k in b, k).toBe(true);
    // R (the renderer) and uiPanels arrive in the browser (init and registerUi); the panels guard both
    for (const k of PANEL_FIELDS.filter((k) => k !== 'R' && k !== 'uiPanels')) expect(b[k], k).not.toBeNull();
    for (const k of ['setShopTemp', 'openPanel', 'closePanels', 'registerPanel']) expect(typeof b[k]).toBe('function');
    expect(b.qname).toBe('bench'); expect(b.shopTempF).toBe(75); expect(Array.isArray(b.hooks)).toBe(true);
    expect(b.state).toBe(b.simState); expect(b.state.range).toBe('P');
  });
  it('panels open one at a time and the shop temperature reaches the plant', () => {
    const b = makeBench(); const log = [];
    for (const n of ['dyno', 'ailive']) b.registerPanel(n, { el: {}, open: () => log.push(`open ${n}`), close: () => log.push(`close ${n}`) });
    b.openPanel('dyno'); b.openPanel('ailive'); b.openPanel('ailive'); b.closePanels();
    expect(log).toEqual(['open dyno', 'close dyno', 'open ailive', 'close ailive']);
    b.setShopTemp(20); expect(b.plant.air.tempC).toBeCloseTo((20 - 32) / 1.8, 5);
  });
  it('runs the hooks once per frame, before the simulation step', () => {
    const b = makeBench(); const seen = [];
    b.hooks.push((dt) => seen.push([dt, b.plant.t]));
    b.tick(1 / 30); b.tick(1 / 30);
    expect(seen.length).toBe(2); expect(seen[0][1]).toBe(0); expect(seen[1][1]).toBeCloseTo(4 / 120, 6);
  });
});

describe('bench key control', () => {
  it('passes the cab ignition arguments: coolant temperature and shifter position', () => {
    const calls = [];
    const host = { state: { range: 'N', coolantF: 123 }, ign: { key: 0, setKey: (k, a) => calls.push([k, a]), releaseStart: () => calls.push(['release']) }, animate() {}, ui: stubUi() };
    const key = createKeyControl(host);
    key.run(); key.off();
    expect(calls).toEqual([[KEY.RUN, { coolantF: 123, range: 'N' }], [KEY.LOCK, { coolantF: 123, range: 'N' }]]);
    expect(createKeyControl({ state: {}, ign: host.ign }).args()).toEqual({ coolantF: 70, range: 'P' }); // the cab's defaults
  });
  it('Off -> Run -> Start starts the engine near 680 rpm through the real start sequence', () => {
    const b = makeBench();
    b.keyCtl.off(); b.advance(0.3);
    expect(b.ign.key).toBe(KEY.LOCK); expect(b.plant.running).toBe(false);
    b.keyCtl.run(); b.advance(0.5);
    expect(b.ign.key).toBe(KEY.RUN); expect(b.ign.gaugesOn).toBe(true); expect(b.ign.wtsOn).toBe(true); // cold engine: Wait to Start
    expect(b.plant.running).toBe(false);
    b.advance(3.5); expect(b.ign.wtsOn).toBe(false);
    expect(b.keyCtl.startPress()).toBe(true);
    expect(b.ign.key).toBe(KEY.START); expect(b.ign.cranking).toBe(true);
    b.advance(4);
    expect(b.plant.running).toBe(true);
    expect(b.ign.key).toBe(KEY.RUN); // the hold let go when the engine fired, as the cab key does
    b.keyCtl.startRelease(); b.advance(12);
    expect(Math.abs(b.plant.rpm - spec.engine.idleRpm)).toBeLessThan(40);
    b.keyCtl.off(); b.advance(1);
    expect(b.plant.running).toBe(false);
  });
  it('Start refuses out of PARK or NEUTRAL, and from OFF only goes to RUN', () => {
    const b = makeBench();
    b.keyCtl.run(); b.advance(4); b.setRange('D');
    expect(b.keyCtl.startPress()).toBe(false); expect(b.ign.cranking).toBe(false);
    b.setRange('P'); b.keyCtl.off(); b.advance(0.2);
    expect(b.keyCtl.startPress()).toBe(false); expect(b.ign.key).toBe(KEY.RUN);
  });
  it('the automatic start used by the running-engine views goes through the same sequence, and stays out of a write', () => {
    const b = makeBench();
    expect(b.autoStart()).toBe(true); b.advance(1);
    expect(b.ign.wtsOn).toBe(true); expect(b.plant.running).toBe(false); // it waits for the glow plugs like a driver
    b.advance(12);
    expect(b.plant.running).toBe(true); expect(b.ign.key).toBe(KEY.RUN);
    const c = makeBench(); c.ai.stage = 'writing';
    expect(c.autoStart()).toBe(false); c.advance(5); expect(c.plant.running).toBe(false);
  });
});

describe('bench: the shared sim loop', () => {
  it('a stock pull gives the same peak as the simulation tests expect (about 252 whp)', () => {
    const b = makeBench();
    expect(startWithKey(b)).toBe(true); expect(b.plant.running).toBe(true);
    b.plant.warm(198, 188);
    expect(b.dyno.startRun().ok).toBe(false); // no straps
    b.dyno.strapAll(true); b.dyno.setFan(true);
    b.setPedal(0.4);
    expect(b.dyno.startRun().ok).toBe(true);
    let n = 0; while (b.dynoRunning && n++ < 4000) b.advance(0.25, 0.01);
    expect(b.pedal).toBe(0); // the dyno has the throttle during a run
    const run = b.dyno.last;
    expect(run && !run.invalid).toBe(true);
    expect(run.points.length).toBeGreaterThan(40);
    expect(run.peakHp).toBeGreaterThan(230); expect(run.peakHp).toBeLessThan(265); // the band tests/sim.test.js uses
    expect(Math.abs(run.peakHp - 252)).toBeLessThan(5);
    // and it is the same physics as the plain Dyno stepped on its own
    const plant = new Plant({ cal: loadCal('stock'), regulator: 'LLY' }); plant.setCalibration(loadCal('stock')); plant.startEngine(); plant.warm(198, 188);
    const d = new Dyno(plant); d.strapAll(true); d.setFan(true); d.startRun();
    let m = 0; while (!['done', 'idle', 'refused'].includes(d.phase) && m++ < 100000) d.update(1 / 120);
    expect(Math.abs(run.peakHp - d.last.peakHp)).toBeLessThan(3);
  });
  it('between runs the absorber stops the rollers, so the page can go idle after a pull', () => {
    const b = makeBench(); startWithKey(b); b.plant.warm(198, 188);
    b.dyno.strapAll(true); b.dyno.setFan(true); b.dyno.startRun();
    let n = 0; while (b.dynoRunning && n++ < 4000) b.advance(0.25, 0.01);
    expect(b.plant.dl.wheelSpeed()).toBeGreaterThan(20); // still rolling when the run ends
    expect(b.rollerBrakeNm).toBeGreaterThan(0);
    b.advance(20); expect(b.plant.dl.wheelSpeed()).toBe(0);
    expect(b.plant.running).toBe(true); expect(Math.abs(b.plant.rpm - 680)).toBeLessThan(40); // the idling engine is not loaded by it
    b.setRange('D'); expect(b.rollerBrakeNm).toBe(0); b.setRange('P');
    b.keyCtl.off(); b.advance(30);
    b.frames = 100; b.dirty = false; b.camera = { matrixWorld: { elements: new Array(16).fill(0) }, fov: 40, aspect: 1, updateMatrixWorld() {} }; b.cameraMoved();
    b.tick(1 / 60); expect(b.moving).toBe(false); expect(b.needsRender()).toBe(false);
  });
  it('spins the rear wheels from the driveline and leaves the fronts still', () => {
    const b = makeBench(); const W = b.truck.parts.wheels;
    const seen = []; for (const k of ['FL', 'RL', 'RR']) { const w = W[k], spin = w.spin.bind(w); w.spin = (a) => { seen.push(k); spin(a); }; }
    startWithKey(b); b.setRange('D'); b.setPedal(0.3); b.advance(4);
    expect(b.plant.dl.wheelSpeed()).toBeGreaterThan(1);
    expect(b.wheelAngle).toBeLessThan(-1); // forward is toward -Z
    expect(seen.includes('RL') && seen.includes('RR')).toBe(true); expect(seen.includes('FL')).toBe(false);
    expect(b.moving).toBe(true);
  });
  it('drives the cab and the audio from the plant, with the fixed listener in front of the grille', () => {
    const b = makeBench();
    startWithKey(b);
    expect(b.state.coolantF).toBeCloseTo(b.plant.coolantF, 6); // updateCab ran
    const last = b.audio.calls.at(-1);
    expect(last.st.running).toBe(true); expect(Math.abs(last.st.rpm - b.plant.rpm)).toBeLessThan(1e-6);
    const grilleZ = -spec.dims.frontOverhangIn * 0.0254;
    expect(last.l.z).toBeCloseTo(grilleZ - 1.5, 6); expect(last.l.x).toBe(0); expect(last.l.inCab).toBe(false);
    expect(last.st.hoodOpen).toBe(b.ctl.hood.open);
    b.view = 'gauges'; b.tick(1 / 30);
    expect(b.audio.calls.at(-1).l.inCab).toBe(true);
    b.view = 'engine'; b.ctl.hoodState.cabReleased = b.ctl.hoodState.secondaryReleased = true; b.ctl.hood.toggle(b.ctx, true); b.advance(3);
    expect(b.audio.calls.at(-1).st.hoodOpen).toBe(true);
    b.ctl.hood.toggle(b.ctx, false); b.advance(3);
    expect(b.audio.calls.at(-1).st.hoodOpen).toBe(false);
  });
});

describe('bench: drawing only when something changed', () => {
  const still = (b) => { b.frames = 100; b.dirty = false; b.camera = b.camera || { matrixWorld: { elements: new Array(16).fill(0) }, fov: 40, aspect: 1, updateMatrixWorld() {} }; b.cameraMoved(); };
  it('a stopped truck with a still camera is not drawn; the key, a hinge or the camera wakes it', () => {
    const b = makeBench(); b.advance(5); still(b);
    b.tick(1 / 60); expect(b.moving).toBe(false); expect(b.needsRender()).toBe(false);
    b.camera.fov = 41; expect(b.needsRender()).toBe(true); expect(b.needsRender()).toBe(false);
    b.keyCtl.run(); b.tick(1 / 60); expect(b.needsRender()).toBe(true); // gauges come alive
    b.advance(12); expect(b.needsRender()).toBe(false); // settled: key in RUN, engine off (an AI Live write sits here)
    b.ctl.doors.fL.toggle(b.ctx, true); b.tick(1 / 60); expect(b.moving).toBe(true); expect(b.needsRender()).toBe(true);
    b.advance(8); b.ctl.doors.fL.toggle(b.ctx, false); b.advance(8); expect(b.needsRender()).toBe(false);
  });
  it('a running engine is always drawn, and drawing stops again after it has coasted down', () => {
    const b = makeBench(); startWithKey(b); still(b);
    b.tick(1 / 60); expect(b.moving).toBe(true); expect(b.needsRender()).toBe(true);
    b.keyCtl.off(); b.advance(3); expect(b.needsRender()).toBe(true); // the fan is still coasting
    b.advance(20); expect(b.needsRender()).toBe(false);
  });
});

describe('bench: quality preset, views and materials', () => {
  it('has the bench preset between low and medium', () => {
    expect(QUALITY.bench).toMatchObject({ pixelRatio: 1, shadowMap: 1024, shadowCasters: 1, ao: false, bloom: false, smaa: true, envSize: 128, aniso: 4, tex: 1024 });
    expect(QUALITY_ORDER).toEqual(['low', 'bench', 'medium', 'high']);
    for (const k of ['low', 'medium', 'high']) expect(QUALITY[k]).toBeTruthy();
  });
  it('has the six views with the parts each one hides', () => {
    expect(Object.keys(BENCH_VIEWS)).toEqual(['engine', 'engineAlone', 'cutaway', 'gauges', 'truck', 'rearWheels']);
    expect(BENCH_VIEWS.engine.state.hood).toBe(true);
    expect(BENCH_VIEWS.gauges.state.hide.sort()).toEqual(['bay', 'engine', 'hoodUnder', 'underside', 'wheels']);
    expect(BENCH_VIEWS.gauges.eye).toBe(true);
    for (const k of ['engine', 'engineAlone', 'cutaway']) {
      const s = BENCH_VIEWS[k].state, shown = (p) => (s.only ? s.only.includes(p) : !(s.hide || []).includes(p));
      expect(shown('engine')).toBe(true); expect(shown('interior')).toBe(false); expect(shown('underside')).toBe(false);
    }
    expect(BENCH_VIEWS.cutaway.state).toMatchObject({ cutaway: true, engineRunning: true });
  });
  it('no truck material is transmissive', () => {
    const bad = [];
    truckParts.truck.group.traverse((o) => { for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) if (m.transmission > 0) bad.push(o.name); });
    expect(bad).toEqual([]);
  });
  it('does not load the shop, the player, the interactor module directly or the environment bake', () => {
    const seen = new Set(), bad = [];
    const walk = (file) => {
      if (seen.has(file)) return; seen.add(file);
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
        const rel = (m[1] || m[2] || m[3]).replace(/\?.*$/, '');
        const next = path.normalize(path.join(path.dirname(file), rel)).replace(/\\/g, '/');
        if (!next.endsWith('.js')) continue;
        if (/^src\/shop\//.test(next) || next === 'src/game/player.js' || next === 'src/core/env.js') bad.push(`${file} -> ${next}`);
        // HingeDoor and makeHinge come from src/game/hinge.js, so interact.js (and the label data behind it) is not loaded at all
        if (next === 'src/game/interact.js') bad.push(`${file} -> ${next}`);
        walk(next);
      }
    };
    walk('src/bench/main.js');
    expect(seen.has('src/bench/bench.js') && seen.has('src/studio/studio.js') && seen.has('src/game/simLoop.js') && seen.has('src/ui/index.js')).toBe(true);
    expect(bad).toEqual([]);
  });
});
