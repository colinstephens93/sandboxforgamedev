// The bench: the truck alone on a plain backdrop with the whole simulation attached. The default page (index.html).
// It is the truck studio's stage (src/studio/studio.js: scene, views, part show/hide, culling, draw-call merging, cutaway)
// plus what the shop game wires to the truck (src/game/simLoop.js: start sequence, plant, dyno, AI Live, cab gauges,
// audio) and the same three panels (src/ui). Nothing of the shop is loaded: no walls, equipment, dyno hardware,
// player or environment bake. It draws a frame only when something on screen can have changed.
import * as THREE from 'three';
import { Studio } from '../studio/studio.js';
import { QUALITY, QUALITY_ORDER } from '../core/quality.js';
import { UI } from '../ui/ui.js';
import { registerUi } from '../ui/index.js';
import { AudioEngine } from '../audio/index.js';
import { KEY } from '../sim/startSequence.js';
import { spec, IN, degFtoC } from '../data/truckSpec.js';
import { initSim, runSim, updateCab, updateAudio, truckVisualState, TRUCK_SOUND_Z, DYNO_SOUND_Z } from '../game/simLoop.js';
import { createKeyControl, buildControls } from './controls.js';

const ENGINE_VIEW = { hide: ['interior', 'underside'] }; // the engine views never show the cab or the underbody

// Fixed views in the truck frame (front axle at the origin, truck faces -Z, +X is the passenger side, rear axle at z = 3.886 m).
// state: hood (open), only (parts shown, everything else off and no floor), hide (parts switched off), cutaway,
// engineRunning (the view starts the engine through the normal start sequence if it is not running).
export const BENCH_VIEWS = {
  engine:      { label: 'Engine',       pos: [0.95, 2.2, -2.1],  tgt: [0, 1.08, 0.2],    fov: 46, state: { hood: true, ...ENGINE_VIEW } },
  engineAlone: { label: 'Engine alone', pos: [1.25, 1.2, -1.35], tgt: [0, 0.62, 0.05],  fov: 40, state: { only: ['engine'] } },
  cutaway:     { label: 'Cutaway',      pos: [1.25, 1.2, -1.35], tgt: [0, 0.62, 0.05],  fov: 40, state: { only: ['engine'], cutaway: true, engineRunning: true } },
  gauges:      { label: 'Gauges',       eye: true, fov: 46, state: { hide: ['engine', 'bay', 'hoodUnder', 'underside', 'wheels'] } },
  truck:       { label: 'Truck',        pos: [3.7, 1.25, -4.3],  tgt: [0, 0.95, 1.4],   fov: 40 },
  rearWheels:  { label: 'Rear wheels',  pos: [2.75, 0.8, 6.3],   tgt: [0.75, 0.45, 3.75], fov: 40, state: { hide: ['engine', 'bay', 'hoodUnder'] } },
};
export const BENCH_VIEW_ORDER = ['engine', 'engineAlone', 'cutaway', 'gauges', 'truck', 'rearWheels'];

// every field of the host that the panels in src/ui read (tests/bench.test.js checks the list against their source)
export const PANEL_FIELDS = ['ign', 'dyno', 'plant', 'ai', 'ui', 'state', 'hooks', 'time', 'R', 'qname', 'shopTempF', 'setShopTemp', 'openPanel', 'closePanels', 'registerPanel', 'uiPanels'];

// The listener stands still: LISTEN_AHEAD_M in front of the grille at standing ear height (design numbers, not truck data).
const LISTEN_AHEAD_M = 1.5, LISTEN_EAR_M = 1.65;
const GRILLE_Z = -spec.dims.frontOverhangIn * IN; // front face of the truck, ahead of the front axle
// Between runs the dyno's absorber stops and holds the rollers whenever the engine cannot be driving them (shifter in P
// or N, or engine off). Same torque as the absorber's brake at the end of a run in src/sim/dyno.js. Without it the
// rollers coast for more than five minutes after a pull and the page would have to keep drawing turning wheels.
const ROLLER_HOLD_NM = 2200;
const WHEEL_STILL_RAD_S = 0.02; // below about one degree a second the wheels are drawn as standing
const MIN_VIEW_PX = 380; // a docked panel never squeezes the 3D view below this width; on a narrower window it overlaps instead

const hasDom = () => typeof document !== 'undefined' && !!document.body && typeof document.body.appendChild === 'function';

export class Bench extends Studio {
  // opts.ui, opts.audio: stand-ins for tests that run without a browser
  constructor(canvas, progress, opts = {}) {
    super(canvas, progress);
    this.views = BENCH_VIEWS; this.defaultView = 'engine'; this.defaultQuality = 'bench';
    this.rendererOpts = { persist: false, shadowTimer: false }; // shadow maps are redrawn only while something moves (tick)
    this.qname = this.defaultQuality; this.R = null; this.uiPanels = null;
    this.hooks = []; this.simState = { range: 'P' };
    this.pedal = 0; this.brakeIn = 0; this.wheelAngle = 0;
    initSim(this); // plant, dyno, ign, ai, simAcc, shopTempF
    // The bench has no strap setup controls; its truck is already secured.
    this.dyno.strapAll(true);
    Object.assign(this.simState, { dyno: this.dyno, ignition: this.ign, ailive: this.ai, plant: this.plant });
    this.ui = opts.ui || null;
    this.audio = opts.audio || new AudioEngine();
    this.keyCtl = createKeyControl(this); // (`key` is the studio's key light)
    // what hinges and the cab's own interactions are given (the studio replaces it with a silent one during its init)
    this.benchCtx = { animate: (fn) => this.animations.push(fn), say: (t, s) => this.ui && this.ui.say(t, s), state: this.simState, sfx: (name, o) => { try { this.audio.trigger(name, o); } catch {} } };
    this.ctx = this.benchCtx;
    this.wakeUntil = 0; this.dirty = true; this.rendered = 0; this.idle = false; this.sig = ''; this.wasRunning = false;
    this.camSig = new Float64Array(18); this.fps = 60;
  }

  // The panels and the cab read a plain object of flags here (range, coolantF, ailivePage); the studio's own
  // openings summary is under `openings`.
  get state() { return this.simState; }
  get openings() { return { hood: !!(this.ctl.hood && this.ctl.hood.open), doors: Object.values(this.ctl.doors).some((d) => d.open), tailgate: !!this.tailgateOpen }; }
  get truckCtl() { return this.ctl; } // the name the shared sim loop uses
  animate(fn) { this.animations.push(fn); }

  async init() {
    await super.init(); // renderer, truck, hinges, merging, culling, stage, orbit controls, first view
    this.ctx = this.benchCtx;
    this.controls.maxDistance = 14; this.controls.maxPolarAngle = Math.PI * 0.62;
    this.ui = this.ui || new UI(document.getElementById('ui'), { bench: true });
    this.ui.setQuality(this.qname);
    this.R.onQuality = () => this.afterQuality();
    registerUi(this);
    this.controlsUi = buildControls(this, document.getElementById('controls'));
    this.bindKeys();
    this.layoutDock();
    this.onChange = () => { this.dirty = true; if (this.controlsUi) this.controlsUi.sync(); };
    this.onChange();
  }

  // Lights the bench has no use for are switched off once, before anything is drawn: the five underbody fill spots (they
  // light the frame for the shop's pit), the two dome lamps (no door opens here) and the spare bay light. Every lit pixel
  // evaluates every light in the scene, so this takes the truck from ten lights to three (key, sky, cab fill). It has to
  // happen before the first frame: changing the number of lights later recompiles every material.
  groupParts() {
    super.groupParts();
    this.lightsOff = 0;
    this.truck.group.traverse((o) => { if (o.isLight && o.visible && (o.name === 'underFill' || o.name === 'bay_light' || o.userData.maxI != null)) { o.visible = false; this.lightsOff++; } });
  }

  // the plain floor is matte: a diffuse-only material (no reflection of the surroundings to compute for a third of the screen)
  buildStage() {
    super.buildStage();
    const old = this.floor.material;
    this.floor.material = new THREE.MeshLambertMaterial({ color: old.color.clone() }); old.dispose();
  }

  // ---- what the panels call ----
  registerPanel(name, panel) { (this.panelsReg ||= {})[name] = panel; }
  openPanel(name) {
    const reg = this.panelsReg || {};
    for (const [k, p] of Object.entries(reg)) if (k !== name && p.isOpen) { p.close(); p.isOpen = false; }
    const p = reg[name]; if (!p) return;
    if (p.isOpen) { p.close(); p.isOpen = false; } else { p.open(); p.isOpen = true; }
    this.panelOpen = p.isOpen ? name : null;
    this.layoutDock();
  }
  closePanels() { for (const p of Object.values(this.panelsReg || {})) { if (p.isOpen) { p.close(); p.isOpen = false; } } this.panelOpen = null; this.layoutDock(); }
  // shop air temperature drives the elevated-idle demonstration (PROMPT.md section 4)
  setShopTemp(f) {
    this.shopTempF = f;
    this.plant.setWeather({ tempC: degFtoC(f), pressureKpa: this.plant.air.pressureKpa, humidityPct: this.plant.air.humidityPct });
  }

  // ---- controls (src/bench/controls.js) ----
  setPedal(v) { this.pedal = this.dynoRunning ? 0 : Math.min(1, Math.max(0, +v || 0)); }
  setRange(r) { if (!['P', 'R', 'N', 'D'].includes(r)) return; this.simState.range = r; if (this.truck && this.truck.interior.shift) this.truck.interior.shift(r); }
  get dynoRunning() { return ['spinup', 'pull', 'coast'].includes(this.dyno.phase); }
  get rollerBrakeNm() { const r = this.simState.range; return r === 'P' || r === 'N' || !this.plant.running ? ROLLER_HOLD_NM : 0; }
  setSound(on) { this.audio.setMuted(!on); if (on) this.audio.start(); this.soundOn = !!on; }
  setQuality(name) { if (!QUALITY[name]) return; this.qname = name; this.autoQuality = false; this.setRender({}); }
  // after any quality change (ours, the automatic step-down, or the shop menu calling R.setQuality itself)
  afterQuality() {
    const q = this.R.q, key = this.key;
    if (key && key.shadow.mapSize.x !== q.shadowMap) { key.shadow.mapSize.set(q.shadowMap, q.shadowMap); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    this.R.renderer.shadowMap.needsUpdate = true;
    this.fitViewport(); this.dirty = true;
    if (this.ui && this.ui.setQuality) this.ui.setQuality(this.qname);
    if (this.controlsUi) this.controlsUi.sync();
  }

  // Start the engine the way the driver does: key to RUN, wait for the Wait to Start light, hold START until it fires.
  // Used by the views that show a running engine. Refused while AI Live is talking to the ECM (starting then ruins a write).
  autoStart() {
    const ig = this.ign;
    if (this.plant.running || ig.engineRunning || this.starting) return true;
    if (['reading', 'backing', 'writing'].includes(this.ai.stage)) { this.ui.say('AI Live is working on the ECM: the engine stays off. Start it with the key when it has finished.', 5); return false; }
    this.starting = true;
    if (ig.key < KEY.RUN) this.keyCtl.run();
    let pressed = false, t = 0;
    this.animate((dt) => {
      t += dt;
      if (ig.key < KEY.RUN || t > 30) { this.starting = false; return true; } // the key was turned off meanwhile
      if (!pressed) { if (ig.wtsOn) return false; pressed = true; if (!this.keyCtl.startPress()) { this.starting = false; return true; } return false; }
      if (ig.cranking && !ig.engineRunning) return false;
      this.keyCtl.startRelease(); this.starting = false; return true;
    });
    return true;
  }

  // ---- views ----
  setView(name, instant = false) {
    const v = this.views[name]; if (!v) return;
    super.setView(name, instant);
    const s = v.state || {};
    if (!s.only && s.hide) for (const k of s.hide) this.setPart(k, false);
    if (s.engineRunning) this.autoStart();
    this.dirty = true;
  }
  // finish hinge and cutaway animations at once without advancing the simulation (scripts, first frame)
  settle() {
    const hinges = [this.ctl.hood, ...Object.values(this.ctl.doors)].filter(Boolean);
    for (let i = 0; i < 200 && (hinges.some((h) => h.state !== h.target) || (this.core && this.core.busy)); i++) {
      for (const h of hinges) if (h.state !== h.target) h.step(0.05);
      this.truck.update(0.05, truckVisualState(this));
    }
    this.R.renderer.shadowMap.needsUpdate = true; this.dirty = true;
  }
  stepAnimations(dt) { for (let i = this.animations.length - 1; i >= 0; i--) if (this.animations[i](dt)) this.animations.splice(i, 1); }

  // ---- layout: an open panel docks on the right and the 3D view takes the rest of the window ----
  layoutDock() {
    if (!hasDom() || !this.R) return;
    const open = Object.values(this.panelsReg || {}).find((p) => p.isOpen);
    let dock = 0;
    if (open) { const w = open.el.offsetWidth + 24; if (window.innerWidth - w >= MIN_VIEW_PX) dock = w; }
    document.documentElement.style.setProperty('--dock', `${dock}px`);
    document.body.dataset.panel = this.panelOpen || '';
    this.fitViewport();
    if (this.controlsUi) this.controlsUi.sync();
  }
  fitViewport() {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth), h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.R.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.R.composer) this.R.composer.setSize(w, h, false);
    this.dirty = true;
  }
  resize() { this.layoutDock(); }

  bindKeys() {
    const start = () => { if (this.soundOn !== false) this.setSound(true); window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', start); };
    window.addEventListener('pointerdown', start); window.addEventListener('keydown', start);
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return; // the panels handle their own form controls
      const n = /^Digit([1-6])$/.exec(e.code);
      if (n) { this.setView(BENCH_VIEW_ORDER[+n[1] - 1]); return; }
      switch (e.code) {
        case 'Escape': this.closePanels(); break;
        case 'KeyT': this.openPanel('dyno'); break;
        case 'KeyL': this.openPanel('ailive'); break;
        case 'KeyM': this.openPanel('shop'); break;
        case 'F1': e.preventDefault(); this.ui.toggleHelp(); break;
        default: break;
      }
    });
  }

  // where the sound is heard from: a fixed point in front of the grille, or the driver's seat in the gauges view
  listener() {
    const z = GRILLE_Z - LISTEN_AHEAD_M;
    const doorOpen = Object.values(this.ctl.doors).some((d) => d.state > 0.05);
    return { x: 0, y: LISTEN_EAR_M, z, inCab: this.view === 'gauges', doorOpen, distanceToTruck: Math.abs(z - TRUCK_SOUND_Z), distanceToDyno: Math.abs(z - DYNO_SOUND_Z), pan: 0 };
  }

  // ---- per frame ----
  // Everything except drawing: hooks, the fixed 120 Hz simulation, hinge animations, wheels, engine bay, cab, audio.
  // Runs under node too (tests): the renderer, the culling and the DOM are only touched when they exist.
  tick(dt) {
    this.time += dt;
    for (const h of this.hooks) h(dt); // the panels' hook first, as in the game (key-cycle apply, no-start state, repair jobs)
    if (this.dynoRunning) this.pedal = 0; // the dyno operator has the throttle during a run
    runSim(this, dt);
    this.stepAnimations(dt);
    const p = this.plant, ig = this.ign, W = this.truck.parts.wheels;
    // rear wheels turn with the driveline (the fronts stand still, as on the dyno); forward is toward -Z
    const ws = p.dl.wheelSpeed();
    if (W && ws) { this.wheelAngle -= ws * dt; W.RL.spin(this.wheelAngle); W.RR.spin(this.wheelAngle); }
    this.truck.update(dt, truckVisualState(this));
    updateCab(this, dt);
    updateAudio(this, dt, this.listener());
    if (this.ui && this.ui.update) this.ui.update(dt);
    if (ig.message && ig.message !== this.lastIgnMsg && this.ui) this.ui.say(ig.message, 5);
    this.lastIgnMsg = ig.message;

    // what is on screen and moving
    const view = this.views[this.view], isolated = !!(view && view.state && view.state.only);
    if (this.cull) { if (isolated) this.cull.showAll(); else this.cull.update(this.camera.position, this.ctl.hood, (this.ticks = (this.ticks || 0) + 1) < 4); }
    if (this.floor) this.floor.visible = !isolated && this.camera.position.y > 0;
    const engineTurning = p.running || ig.cranking || p.rpm > 1;
    const engineShown = !!this.parts && this.parts.engine.visible && (!this.cull || this.cull.state.shown.engine);
    const wheelsTurning = Math.abs(ws) > WHEEL_STILL_RAD_S;
    const animating = this.animations.length > 0 || !!(this.core && this.core.busy);
    const flicker = !!ig.clusterFault && ig.key >= KEY.RUN; // failed write: the cluster flickers
    this.moving = engineTurning || wheelsTurning || animating || flicker;
    // Hinges and cutaway refresh immediately. Routine engine/wheel motion is capped
    // at 30 shadow updates per second in draw(), independently of the simulation rate.
    if (this.R && animating) this.R.renderer.shadowMap.needsUpdate = true;
    if (wheelsTurning || (engineTurning && engineShown)) this.shadowMotionPending = true;
    // Things that change the picture in one step (key, lamps, gauges, shifter, warnings) keep drawing for a moment so
    // needles and lamps settle; the fan coasts down for a few seconds after the engine stops.
    const sig = `${ig.key}|${ig.wtsOn}|${ig.gaugesOn}|${ig.dicPowered}|${this.simState.range}|${ig.dicNote}|${p.reducedPower}|${this.simState.doorOpen}|${this.ai.charger}`;
    if (sig !== this.sig) { this.sig = sig; this.wake(2.5); }
    // slow gauges with the key on and the engine off (coolant and transmission cooling, battery sagging): a short redraw per visible step
    const gauges = ig.key >= KEY.RUN ? `${Math.round(p.coolantF / 3)}|${Math.round(this.ai.volts * 5)}|${Math.round(p.dl.transF / 5)}` : '';
    if (gauges !== this.gaugeSig) { this.gaugeSig = gauges; this.wake(1); }
    if (this.wasRunning && !engineTurning) this.wake(8);
    this.wasRunning = engineTurning;
    if (this.controlsUi && (this.uiAcc = (this.uiAcc || 0) + dt) >= 0.1) { this.uiAcc = 0; this.controlsUi.update(); }
  }
  wake(sec) { this.wakeUntil = Math.max(this.wakeUntil, this.time + sec); }

  cameraMoved() {
    const c = this.camera, e = c.matrixWorld.elements, s = this.camSig;
    c.updateMatrixWorld();
    let moved = false;
    for (let i = 0; i < 16; i++) if (s[i] !== e[i]) { s[i] = e[i]; moved = true; }
    if (s[16] !== c.fov || s[17] !== c.aspect) { s[16] = c.fov; s[17] = c.aspect; moved = true; }
    return moved;
  }
  // Idle skip: with the engine off, the camera still, no hinge or cutaway animation and no panel being opened or closed
  // (that resizes the view), the picture cannot have changed, so the frame is not drawn.
  needsRender() {
    const cam = this.cameraMoved();
    return this.frames < 8 || this.dirty || cam || this.moving || this.time < this.wakeUntil;
  }
  draw(dt, forceShadows = false) {
    const shadows = this.R.renderer.shadowMap;
    if (this.shadowMotionPending && (this.time - (this.lastShadowTime ?? -Infinity) >= 1 / 30 - 1e-9 || !this.moving)) shadows.needsUpdate = true;
    const refreshed = forceShadows || shadows.needsUpdate;
    super.draw(dt, forceShadows);
    if (refreshed) { this.lastShadowTime = this.time; this.shadowMotionPending = false; }
    this.dirty = false; this.rendered++;
  }

  loop(t) {
    const raw = (t - this.last) / 1000; this.last = t;
    if (!this.busy && !this.paused) {
      const dt = Math.min(0.05, Math.max(0, raw)); this.frames++;
      this.controls.update(); this.tick(dt);
      this.idle = !this.needsRender();
      if (!this.idle) {
        this.draw(dt);
        if (raw > 0 && raw < 0.5) this.fps = this.fps * 0.92 + (1 / raw) * 0.08;
        this.governQuality(raw || dt);
      } else this.slow = 0;
      if (this.frames % 20 === 0 && this.ui && this.ui.fps) this.ui.fps.textContent = this.idle ? 'idle: nothing moving, not drawing' : `${this.fps.toFixed(0)} fps · ${this.qname}`;
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }

  // Automatic quality (the rule of Game.governQuality): if drawn frames cannot hold about 40 fps for three seconds, step the
  // quality down one level (never up, so it cannot flip back and forth). Choosing a quality by hand switches this off.
  governQuality(rawDt) {
    if (this.autoQuality === false) return;
    this.autoSet ??= this.qname;
    if (this.autoSet && this.qname !== this.autoSet) { this.autoQuality = false; return; } // the user chose a level
    if (rawDt > 0.25 || document.hidden) { this.slow = 0; return; } // tab switch / stall, not sustained load
    if (this.rendered < 240) return; // let shaders compile and textures upload first
    this.ft = (this.ft ?? rawDt) * 0.95 + rawDt * 0.05;
    this.slow = this.ft > 1 / 40 ? (this.slow || 0) + rawDt : 0;
    if (this.slow > 3) {
      const i = QUALITY_ORDER.indexOf(this.qname);
      this.slow = 0; this.ft = 1 / 60;
      if (i > 0) {
        this.qname = this.autoSet = QUALITY_ORDER[i - 1];
        this.setRender({});
        this.ui.say(`Running slowly: quality set to ${this.qname} (change it in the bar below)`, 4);
      } else this.autoQuality = false;
    }
  }

  // ---- script hooks (scripts/benchCheck.mjs, scripts/benchPerf.mjs, tests) ----
  // advance everything by `sec` seconds without drawing
  advance(sec, dt = 1 / 30) { const n = Math.ceil(sec / dt); for (let i = 0; i < n; i++) this.tick(dt); }
  shot() { this.controls.update(); this.tick(0); this.draw(0.016, true); return this.canvas.toDataURL('image/png'); }
  // time n whole frames (update + every pass), each waited for on the GPU with a one-pixel read-back (as Studio.bench does)
  timeFrames(n = 45, warm = 8) {
    const gl = this.R.renderer.getContext(), px = new Uint8Array(4);
    const one = () => { const t0 = performance.now(); this.tick(0.016); this.draw(0.016); this.R.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
    this.busy = true;
    try { for (let i = 0; i < warm; i++) one(); const out = []; for (let i = 0; i < n; i++) out.push(one()); return out; } finally { this.busy = false; this.last = performance.now(); }
  }
  // every material in the scene (the bench must have none with transmission: it makes three.js draw the scene twice)
  materials() { const set = new Set(); this.scene.traverse((o) => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) set.add(m); }); return [...set]; }
}
