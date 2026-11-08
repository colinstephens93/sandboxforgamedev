// The game: wires the scene, the simulation, the player, the cameras and the UI together.
import * as THREE from 'three';
import { Renderer } from '../core/renderer.js';
import { qualityFromUrl, QUALITY } from '../core/quality.js';
import { buildShop } from '../shop/shell.js';
import { bakeEnvironment } from '../core/env.js';
import { buildEquipment } from '../shop/equipment/index.js';
import { buildTruck } from '../truck/index.js';
import { DYNO, SHOP } from '../shop/layout.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Interactor } from './interact.js';
import { setupTruckOpenings } from './truckControl.js';
import { UI } from '../ui/ui.js';
import { aabb } from '../core/geom.js';
import { Plant } from '../sim/plant.js';
import { Dyno } from '../sim/dyno.js';
import { Ignition, KEY } from '../sim/startSequence.js';
import { AILive } from '../sim/flash.js';
import { loadCal } from '../sim/calibrations.js';
import { degFtoC } from '../data/truckSpec.js';
import { registerUi } from '../ui/index.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const TRUCK_Z = DYNO.truckOrigin.z;

export class Game {
  constructor(canvas, progress) { this.canvas = canvas; this.progress = progress; this.mode = 'boot'; this.time = 0; this.frames = 0; this.fps = 60; this.state = {}; this.hooks = []; }

  async init() {
    const p = this.progress;
    p(0.04, 'Starting renderer');
    this.qname = qualityFromUrl();
    this.R = new Renderer(this.canvas, this.qname);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x101113);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.04, 300);
    this.camera.position.set(-3, 1.7, -16);
    await nextFrame();
    p(0.12, 'Building the shop');
    this.shop = buildShop({ quality: this.R.q });
    this.scene.add(this.shop.group); this.scene.environmentIntensity = 0.28;
    await nextFrame();
    p(0.28, 'Stocking the shop');
    this.equipment = buildEquipment({ quality: this.R.q, shop: this.shop });
    this.scene.add(this.equipment.group);
    await nextFrame();
    p(0.4, 'Building the truck');
    this.truck = buildTruck({ quality: this.R.q });
    this.truck.group.position.set(DYNO.truckOrigin.x, 0, TRUCK_Z);
    this.scene.add(this.truck.group);
    await nextFrame();
    p(0.7, 'Simulating the engine');
    this.initSim();
    p(0.78, 'Baking shop reflections');
    this.truck.group.visible = false;
    bakeEnvironment(this.R.renderer, this.scene, new THREE.Vector3(0, 1.4, 0), this.R.q.envSize);
    this.truck.group.visible = true;
    p(0.9, 'Preparing post-processing');
    this.R.setScene(this.scene, this.camera);
    await nextFrame();

    // colliders
    this.colliders = [...this.shop.colliders, ...this.equipment.colliders, ...(this.truck.colliders || [])];
    this.colliders.push(aabb(0, 1.0, TRUCK_Z + 2.55, 1.0, 1.0, 3.55)); // the truck body footprint (doors/hood handled by use, not walking through)
    this.input = new Input(this.canvas);
    this.player = new Player(this.camera, this.colliders);
    this.ui = new UI(document.getElementById('ui')); this.ui.setQuality(this.qname);
    this.roots = [this.truck.group, this.equipment.group, this.shop.group];
    this.interactor = new Interactor(this.camera, this.roots);
    this.ctx = { shop: this.shop, say: (t, s) => this.ui.say(t, s), animate: (fn) => this.interactor.animate(fn), state: this.state, game: this };
    this.state.dyno = this.dyno; this.state.ignition = this.ign; this.state.ailive = this.ai; this.state.plant = this.plant;
    this.truckCtl = setupTruckOpenings(this.truck, { say: (t) => this.ui.say(t, 5), onLights: (on) => this.onDoorLights(on) });
    this.bindKeys();
    registerUi(this);
    this.last = performance.now(); this.setMode('intro'); this.introT = 0;
    p(1, 'Ready');
    document.getElementById('loading').style.opacity = '0'; setTimeout(() => document.getElementById('loading').remove(), 700);
    requestAnimationFrame((t) => this.loop(t));
  }

  initSim() {
    const cal = loadCal('stock');
    this.plant = new Plant({ cal, regulator: 'LLY', weather: { tempC: 24, pressureKpa: 101.0, humidityPct: 45 } });
    this.plant.setCalibration(cal);
    this.dyno = new Dyno(this.plant);
    this.ign = new Ignition(); this.ai = new AILive();
    this.simAcc = 0; this.shopTempF = 75;
  }

  // ---- panels (dyno, AI Live, shop menu): registered by the UI modules; only one open at a time ----
  registerPanel(name, panel) { (this.panelsReg ||= {})[name] = panel; }
  openPanel(name) {
    const reg = this.panelsReg || {};
    for (const [k, p] of Object.entries(reg)) if (k !== name && p.isOpen) { p.close(); p.isOpen = false; }
    const p = reg[name]; if (!p) return;
    if (p.isOpen) { p.close(); p.isOpen = false; this.panelOpen = false; return; }
    p.open(); p.isOpen = true; this.panelOpen = true; this.input.unlock();
  }
  closePanels() { for (const p of Object.values(this.panelsReg || {})) { if (p.isOpen) { p.close(); p.isOpen = false; } } this.panelOpen = false; }
  // shop air temperature drives the elevated-idle demonstration (PROMPT.md section 4)
  setShopTemp(f) {
    this.shopTempF = f; const c = (f - 32) / 1.8; const w = { tempC: c, pressureKpa: this.plant.air.pressureKpa, humidityPct: this.plant.air.humidityPct };
    import('../sim/atmos.js').then(({ makeAir }) => { const air = makeAir(w); this.plant.air = air; this.plant.pp.air = air; });
  }

  onDoorLights(on) { /* interior lights follow door state (interior module hooks this) */ this.state.doorOpen = on; }

  setMode(m) {
    this.mode = m;
    if (m === 'walk') this.player.applyCamera();
  }

  bindKeys() {
    this.input.on((type, e) => {
      if (type === 'mousedown' && !this.input.locked && ['walk', 'orbit', 'driver'].includes(this.mode) && !this.panelOpen) this.input.lock();
      if (type !== 'keydown') return;
      if (this.mode === 'intro' && e.code !== 'F1') { this.introT = 999; return; }
      switch (e.code) {
        case 'Escape': this.closePanels(); break;
        case 'KeyT': this.openPanel('dyno'); break;
        case 'KeyL': this.openPanel('ailive'); break;
        case 'KeyM': this.openPanel('shop'); break;
        case 'KeyE': if (this.mode === 'walk' || this.mode === 'driver') this.interactor.use(this.ctx); break;
        case 'KeyI': this.interactor.inspect = !this.interactor.inspect; this.ui.say(this.interactor.inspect ? 'Inspection mode on: point at any part' : 'Inspection mode off', 1.8); break;
        case 'F1': this.ui.toggleHelp(); break;
        case 'KeyH': this.uiHidden = !this.uiHidden; this.ui.hideAll(this.uiHidden); break;
        case 'KeyP': this.savePNG(); break;
        case 'KeyQ': { const order = ['low', 'medium', 'high']; this.qname = order[(order.indexOf(this.qname) + 1) % 3]; this.R.setQuality(this.qname); this.ui.setQuality(this.qname); this.ui.say(`Quality: ${this.qname}`, 1.5); break; }
        case 'KeyO': this.setMode(this.mode === 'orbit' ? 'walk' : 'orbit'); if (this.mode === 'orbit') { this.orbit = { pos: this.camera.position.clone(), yaw: this.player.yaw, pitch: this.player.pitch }; } else this.player.applyCamera(); break;
        case 'ControlLeft': case 'ControlRight': if (this.mode === 'walk') this.player.crouch = true; break;
        default: break;
      }
    });
    window.addEventListener('keyup', (e) => { if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && this.mode === 'walk') this.player.crouch = false; });
    window.addEventListener('resize', () => this.R.resize());
  }

  savePNG() {
    this.R.render(0.016);
    this.canvas.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `duramax-dyno-shop-${Date.now()}.png`; a.click(); }, 'image/png');
    this.ui.say('Saved PNG', 1.5);
  }

  introPose(t) {
    const K = [
      [0, [-3.0, 1.7, -17.0], [-3.0, 1.55, -8.0], 62], [6.5, [-3.0, 1.7, -8.2], [-1.0, 1.1, -1.5], 58],
      [10.5, [-3.0, 1.25, -5.0], [0.0, 0.85, -1.4], 50], [14.5, [-3.9, 0.62, -3.7], [0.2, 0.85, -1.6], 42], [18, [-3.6, 1.65, -5.5], [-1.0, 1.35, -2.0], 60],
    ];
    let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1]; let u = (t - a[0]) / (b[0] - a[0]); u = Math.min(1, Math.max(0, u)); const e = u * u * (3 - 2 * u);
    const L = (x, y) => x + (y - x) * e;
    return { pos: [0, 1, 2].map((k) => L(a[1][k], b[1][k])), tgt: [0, 1, 2].map((k) => L(a[2][k], b[2][k])), fov: L(a[3], b[3]) };
  }

  update(dt) {
    this.time += dt;
    for (const h of this.hooks) h(dt);
    // fixed-step simulation
    this.simAcc += dt; let n = 0;
    while (this.simAcc >= 1 / 120 && n < 8) { this.stepSim(1 / 120); this.simAcc -= 1 / 120; n++; }
    if (this.simAcc > 0.1) this.simAcc = 0;

    if (this.mode === 'intro') {
      this.introT += dt;
      const p = this.introPose(Math.min(this.introT, 18));
      this.camera.position.set(...p.pos); this.camera.lookAt(...p.tgt); this.camera.fov = p.fov; this.camera.updateProjectionMatrix();
      if (this.introT >= 18) {
        this.camera.fov = 60; this.camera.updateProjectionMatrix();
        const dx = -1.0 - this.camera.position.x, dz = -2.0 - this.camera.position.z;
        this.player.setPose(this.camera.position.x, this.camera.position.z, Math.atan2(-dx, -dz), -0.1); this.setMode('walk'); this.ui.say('Walk mode: WASD to move, E to use, F1 for help', 5);
      }
    } else if (this.mode === 'walk') {
      if (this.input.locked) this.player.look(this.input.mouseDX, this.input.mouseDY);
      this.player.update(dt, this.input);
    } else if (this.mode === 'orbit') {
      const o = this.orbit; if (this.input.locked) { o.yaw -= this.input.mouseDX * 0.0022; o.pitch = Math.max(-1.5, Math.min(1.5, o.pitch - this.input.mouseDY * 0.0022)); }
      const sp = (this.input.down('ShiftLeft') ? 6 : 2) * dt; const sin = Math.sin(o.yaw), cos = Math.cos(o.yaw);
      const f = (this.input.down('KeyW') ? 1 : 0) - (this.input.down('KeyS') ? 1 : 0), s = (this.input.down('KeyD') ? 1 : 0) - (this.input.down('KeyA') ? 1 : 0);
      o.pos.x += (-sin * f + cos * s) * sp; o.pos.z += (-cos * f - sin * s) * sp; o.pos.y += ((this.input.down('Space') ? 1 : 0) - (this.input.down('ControlLeft') ? 1 : 0)) * sp;
      this.camera.position.copy(o.pos); this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(o.pitch, o.yaw, 0);
    }
    // interaction
    this.interactor.update(dt, this.mode === 'walk' || this.mode === 'driver');
    const t = this.interactor.target;
    this.ui.setPrompt(t && t.interactable ? `E  ${typeof t.interactable.userData.interact.prompt === 'function' ? t.interactable.userData.interact.prompt() : t.interactable.userData.interact.prompt}` : '');
    this.ui.setLabel(this.interactor.inspect && t && t.labelInfo ? t.labelInfo : null);
    this.ui.update(dt);
    this.visuals(dt);
    this.fps = this.fps * 0.92 + (1 / Math.max(dt, 1e-3)) * 0.08;
    if (this.frames % 20 === 0) this.ui.fps.textContent = `${this.fps.toFixed(0)} fps`;
    this.input.endFrame();
  }

  stepSim(dt) {
    // ignition/start logic drives the plant
    const p = this.plant;
    const o = this.ign.update(dt, { coolantF: p.coolantF, airF: p.air.tempC * 1.8 + 32, range: p.dl.range === 'D' ? 'D' : (p.dl.range || 'P'), brake: 0, pedal: 0, speedMph: 0 });
    if (o.startEngine) p.startEngine();
    if (o.stopEngine) p.stopEngine();
    p.idleTargetRpm = o.idleTargetRpm;
    p.hoodClosed = !(this.truckCtl && this.truckCtl.hood && this.truckCtl.hood.open);
    if (this.dyno.phase === 'idle' || this.dyno.phase === 'done' || this.dyno.phase === 'refused') p.step(dt, { pedal: this.pedal || 0, range: this.range });
    else this.dyno.update(dt);
    this.ai.update(dt, { keyPos: this.ign.key, engineRunning: this.ign.engineRunning });
  }

  visuals(dt) {
    this.shop.updateDoors(dt);
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; this.frames++;
    this.update(dt);
    this.R.render(dt);
    requestAnimationFrame((tt) => this.loop(tt));
  }
}

// ---- test and screenshot hooks (also used by npm run shots) ----
Game.prototype.cam = function (pos, tgt, fov = 60) {
  this.mode = this.mode === 'boot' ? 'boot' : 'fixed';
  this.camera.position.set(...pos); this.camera.fov = fov; this.camera.updateProjectionMatrix(); this.camera.lookAt(...tgt);
};
Game.prototype.shot = function () { this.R.render(0.016); return this.canvas.toDataURL('image/png'); };
Game.prototype.ready = function () { return this.frames > 2; };
// advance the simulation by `sec` seconds without rendering (deterministic checks)
Game.prototype.advance = function (sec, dt = 1 / 30) { const n = Math.ceil(sec / dt); for (let i = 0; i < n; i++) this.update(dt); };
