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
import { degFtoC, degCtoF } from '../data/truckSpec.js';
import { TIRE_R } from '../sim/driveline.js';
import { AudioEngine } from '../audio/index.js';
import { buildDynoHardware } from '../shop/dyno/index.js';
import { buildAILiveRig } from '../shop/ailiveRig.js';
import { registerUi } from '../ui/index.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const TRUCK_Z = DYNO.truckOrigin.z;

export class Game {
  constructor(canvas, progress) {
    this.canvas = canvas; this.progress = progress; this.mode = 'boot'; this.time = 0; this.frames = 0; this.fps = 60; this.state = {}; this.hooks = [];
    // driver view state (the seat look direction and the seat eye point in the world)
    this.drv = { yaw: 0, pitch: 0 };
    this.eyeWorld = new THREE.Vector3();
  }

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
    this.scene.add(this.shop.group); this.scene.environmentIntensity = 0.7; // the paint, chrome and glass should show the real room (PROMPT.md section 8)
    await nextFrame();
    p(0.28, 'Stocking the shop');
    this.equipment = buildEquipment({ quality: this.R.q, shop: this.shop });
    this.scene.add(this.equipment.group);
    await nextFrame();
    p(0.34, 'Building the dyno');
    this.dynoHw = buildDynoHardware({ quality: this.R.q, shop: this.shop });
    this.scene.add(this.dynoHw.group);
    await nextFrame();
    p(0.4, 'Building the truck');
    this.truck = buildTruck({ quality: this.R.q });
    this.truck.group.position.set(DYNO.truckOrigin.x, 0, TRUCK_Z);
    this.truck.group.rotation.x = (this.dynoHw.anchors.rearAxleDropM || 0.065) / 3.886; // rear axle seats in the roller cradle
    this.scene.add(this.truck.group);
    await nextFrame();
    p(0.7, 'Simulating the engine');
    this.initSim();
    this.rig = buildAILiveRig({ quality: this.R.q, shop: this.shop, game: this });
    this.scene.add(this.rig.group);
    // battery terminals come from the engine bay anchors (truck frame -> world)
    try {
      const A = this.truck.anchors || {};
      if (A.batteryDriver && A.batteryPass && this.rig.setBatteryPorts) {
        this.truck.group.updateMatrixWorld(true);
        const w = (o, dx = 0) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(dx, 0.12, 0));
        this.rig.setBatteryPorts(w(A.batteryPass, -0.06), w(A.batteryDriver, 0.06));
      }
    } catch (e) { console.warn('battery ports', e); }
    this.R.onQuality = (q) => this.shop.lights.setFill(q.fillLights);
    p(0.78, 'Baking shop reflections');
    this.truck.group.visible = false;
    bakeEnvironment(this.R.renderer, this.scene, new THREE.Vector3(0, 1.4, 0), this.R.q.envSize);
    this.truck.group.visible = true;
    p(0.9, 'Preparing post-processing');
    this.R.setScene(this.scene, this.camera);
    await nextFrame();

    // colliders
    this.colliders = [...this.shop.colliders, ...this.equipment.colliders, ...this.dynoHw.colliders, ...(this.rig.colliders || []), ...(this.truck.colliders || [])];
    this.colliders.push(aabb(0, 1.0, TRUCK_Z + 2.55, 1.0, 1.0, 3.55)); // the truck body footprint (doors/hood handled by use, not walking through)
    this.input = new Input(this.canvas);
    this.player = new Player(this.camera, this.colliders);
    this.ui = new UI(document.getElementById('ui')); this.ui.setQuality(this.qname);
    this.roots = [this.truck.group, this.equipment.group, this.dynoHw.group, this.rig.group, this.shop.group];
    this.interactor = new Interactor(this.camera, this.roots);
    this.ctx = { shop: this.shop, say: (t, s) => this.ui.say(t, s), animate: (fn) => this.interactor.animate(fn), state: this.state, game: this };
    this.state.dyno = this.dyno; this.state.ignition = this.ign; this.state.ailive = this.ai; this.state.plant = this.plant;
    this.truckCtl = setupTruckOpenings(this.truck, { say: (t) => this.ui.say(t, 5), onLights: (on) => this.onDoorLights(on) });
    this.audio = new AudioEngine();
    this.ctx.sfx = (name, opts) => { try { this.audio.trigger(name, opts); } catch {} };
    this._abort = new AbortController();
    const sig = { signal: this._abort.signal };
    const startAudio = () => { this.audio.start(); window.removeEventListener('pointerdown', startAudio); window.removeEventListener('keydown', startAudio); };
    window.addEventListener('pointerdown', startAudio, sig); window.addEventListener('keydown', startAudio, sig);
    this.bindKeys();
    registerUi(this);
    this.last = performance.now(); this.setMode('intro'); this.introT = 0;
    p(1, 'Ready');
    document.getElementById('loading').style.opacity = '0'; setTimeout(() => document.getElementById('loading').remove(), 700);
    requestAnimationFrame((t) => this.loop(t));
  }

  initSim() {
    const cal = loadCal('stock');
    if (!cal) throw new Error('Stock calibration failed to load');
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
    this.shopTempF = f;
    this.plant.setWeather({ tempC: degFtoC(f), pressureKpa: this.plant.air.pressureKpa, humidityPct: this.plant.air.humidityPct });
  }

  dispose() {
    this._abort?.abort();
    this.R?.composer?.dispose?.();
    this.R?.renderer?.dispose?.();
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
        case 'KeyV': this.toggleDriver(); break;
        case 'KeyC': if (['spinup', 'pull', 'coast'].includes(this.dyno.phase)) this.setMode(this.mode === 'dynocam' ? 'walk' : 'dynocam'); else if (this.mode === 'dynocam') this.setMode('walk'); break;
        case 'KeyO': this.setMode(this.mode === 'orbit' ? 'walk' : 'orbit'); if (this.mode === 'orbit') { this.orbit = { pos: this.camera.position.clone(), yaw: this.player.yaw, pitch: this.player.pitch }; } else this.player.applyCamera(); break;
        case 'ControlLeft': case 'ControlRight': if (this.mode === 'walk') this.player.crouch = true; break;
        default: break;
      }
    });
    const sig = { signal: (this._abort ||= new AbortController()).signal };
    window.addEventListener('keyup', (e) => { if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && this.mode === 'walk') this.player.crouch = false; }, sig);
    window.addEventListener('resize', () => this.R.resize(), sig);
  }

  savePNG() {
    this.R.render(0.016, true);
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

  toggleDriver() {
    if (this.mode === 'driver') { this.player.setPose(-1.7, TRUCK_Z + 1.2, Math.PI / 2, -0.1); this.setMode('walk'); this.pedal = 0; this.brakeIn = 0; this.ui.say('Left the truck', 1.5); return; }
    if (this.mode !== 'walk') return;
    const d = this.truckCtl.doors.fL;
    if (!d || d.state < 0.5) { this.ui.say('Open the driver door first (E at the door), then press V to sit in the truck.', 4); return; }
    const near = Math.hypot(this.player.pos.x + 1.0, this.player.pos.z - (TRUCK_Z + 1.0)) < 3.2;
    if (!near) { this.ui.say('Walk up to the open driver door, then press V.', 3); return; }
    this.setMode('driver'); this.drv.yaw = 0; this.drv.pitch = -0.12; this.ui.say('Driver seat: E on the key (hold for START), shifter 1 P 2 R 3 N 4 D, W throttle, S brake, V to get out', 6);
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
    } else if (this.mode === 'driver') {
      if (this.input.locked) { this.drv.yaw = Math.max(-1.9, Math.min(1.9, this.drv.yaw - this.input.mouseDX * 0.0022)); this.drv.pitch = Math.max(-1.0, Math.min(0.9, this.drv.pitch - this.input.mouseDY * 0.0022)); }
      // seat eye point from the interior (truck frame), transformed by the truck's placement on the dyno;
      // this.eyeWorld used to be undefined, which made driver mode throw on the first frame
      const eye = this.truck.anchors && this.truck.anchors.interior && this.truck.anchors.interior.eye;
      if (eye) { this.truck.group.updateMatrixWorld(true); eye.getWorldPosition(this.eyeWorld); }
      this.camera.position.copy(this.eyeWorld); this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(this.drv.pitch, this.drv.yaw, 0);
      this.pedal += (((this.input.down('KeyW') ? 0.6 : 0) - this.pedal) * Math.min(1, dt * 6)); this.brakeIn = this.input.down('KeyS') ? 1 : 0;
      if (this.input.tap('Digit1')) this.state.range = 'P'; if (this.input.tap('Digit2')) this.state.range = 'R'; if (this.input.tap('Digit3')) this.state.range = 'N'; if (this.input.tap('Digit4')) this.state.range = 'D';
    } else if (this.mode === 'dynocam') {
      this.camera.position.set(3.6, 0.85, TRUCK_Z + 6.2); this.camera.lookAt(0.8, 0.5, TRUCK_Z + 3.2);
    } else if (this.mode === 'orbit') {
      const o = this.orbit; if (this.input.locked) { o.yaw -= this.input.mouseDX * 0.0022; o.pitch = Math.max(-1.5, Math.min(1.5, o.pitch - this.input.mouseDY * 0.0022)); }
      const sp = (this.input.down('ShiftLeft') ? 6 : 2) * dt; const sin = Math.sin(o.yaw), cos = Math.cos(o.yaw);
      const f = (this.input.down('KeyW') ? 1 : 0) - (this.input.down('KeyS') ? 1 : 0), s = (this.input.down('KeyD') ? 1 : 0) - (this.input.down('KeyA') ? 1 : 0);
      o.pos.x += (-sin * f + cos * s) * sp; o.pos.z += (-cos * f - sin * s) * sp; o.pos.y += ((this.input.down('Space') ? 1 : 0) - (this.input.down('ControlLeft') ? 1 : 0)) * sp;
      this.camera.position.copy(o.pos); this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(o.pitch, o.yaw, 0);
    }
    // interaction
    this.interactor.update(dt, this.mode === 'walk' || this.mode === 'driver');
    if (this.mode !== 'driver') { this.pedal = 0; this.brakeIn = 0; }
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
    const o = this.ign.update(dt, { coolantF: p.coolantF, airF: p.air.tempC * 1.8 + 32, range: this.state.range || 'P', brake: this.brakeIn || 0, pedal: this.pedal || 0, speedMph: p.dl.wheelSpeed() * TIRE_R * 2.23694 });
    if (o.startEngine) p.startEngine();
    if (o.stopEngine) p.stopEngine();
    p.idleTargetRpm = o.idleTargetRpm;
    p.hoodClosed = !(this.truckCtl && this.truckCtl.hood && this.truckCtl.hood.open);
    if (this.dyno.phase === 'idle' || this.dyno.phase === 'done' || this.dyno.phase === 'refused') p.step(dt, { pedal: this.pedal || 0, range: this.state.range || 'P', brake: this.brakeIn || 0 });
    else this.dyno.update(dt);
    this.ai.update(dt, { keyPos: this.ign.key, engineRunning: this.ign.engineRunning });
    // rear lamps follow the real state: tail lamps with the key on, brake lamps on the pedal, reverse lamps
    // in R (PROMPT.md section 4 lists the lamp set; this wires rear.js lamps.set to the simulation)
    if (this.truck.parts.lamps) {
      this.truck.parts.lamps.set({
        tail: this.ign.key >= 1 ? 0.7 : 0,
        brake: (this.brakeIn || 0) > 0.12 ? 1 : 0,
        turn: 0,
        reverse: (this.state.range === 'R' && this.ign.key >= 2) ? 1 : 0,
      });
    }
  }

  visuals(dt) {
    this.shop.updateDoors(dt);
    if (this.equipment.update) this.equipment.update(dt, this.state);
    if (this.rig.update) this.rig.update(dt);
    const d = this.dyno, p = this.plant;
    this.dynoHw.update(dt, { rollerRad: p.dl.wr, straps: d.straps, fan: d.fan, chocks: d.chocks !== false, hose: d.hoseOn, air: p.air,
      run: { phase: d.phase, rpm: p.rpm, hp: d.last ? d.last.peakHp : 0, tq: d.last ? d.last.peakTq : 0 } });
    // rear wheels turn with the rollers (front wheels are chocked); forward is toward -Z
    const W = this.truck.parts.wheels;
    if (W) { this.wheelAngle = (this.wheelAngle || 0) - p.dl.wheelSpeed() * dt; W.RL.spin(this.wheelAngle); W.RR.spin(this.wheelAngle); }
    const o = p.out || {};
    if (this.truck.update) this.truck.update(dt, { rpm: p.rpm, running: p.running, fanDuty: p.fanDuty, turboRpm: o.turboRpm || 0, shimmer: Math.min(1, Math.max(0, ((o.egtPreK || 300) - 700) / 600)) });
    for (const h of this.hooks) h(dt);
    this.updateCab(dt);
    this.updateAudio(dt);
  }

  updateCab(dt) {
    const p = this.plant, ig = this.ign, I = this.truck.interior;
    this.state.coolantF = p.coolantF; this.state.dt = dt;
    const o = p.out || {};
    let keyPos = ig.key;
    if (ig.clusterFault && keyPos >= 2) keyPos = Math.sin(this.time * 23) + Math.sin(this.time * 7.3) > 0.2 ? 2 : 0; // failed write: cluster dark or flickering
    const oilF = degCtoF(p.oilC);
    const oilPsi = p.running ? Math.min(120, 22 + p.rpm * 0.02 + Math.max(0, 190 - oilF) * 0.33) : 0;
    const msg = ig.dicNote || (p.dl.transF > 265 ? 'TRANSMISSION HOT' : p.reducedPower ? 'REDUCED ENGINE POWER' : '');
    I.update(dt, {
      keyPos, rpm: p.running ? p.rpm : 0, mph: p.dl.wheelSpeed() * TIRE_R * 2.23694, coolantF: p.coolantF, transF: p.dl.transF, oilPsi,
      volts: p.running ? 14.1 : (this.ai.charger ? 13.4 : this.ai.volts), fuel: p.fuelLevel, lights: { waitToStart: ig.wtsOn, waterInFuel: false }, dicMessage: msg,
      odometerMi: p.odometerKm / 1.609344, engineHours: p.engineSeconds / 3600,
    });
    const open = Object.values(this.truckCtl.doors).some((d) => d.state > 0.03);
    if (I.interiorLight) I.interiorLight.setOn(open);
  }

  updateAudio(dt) {
    const p = this.plant, o = p.out || {}, cam = this.camera.position;
    const tz = TRUCK_Z + 1.0;
    const open = Object.values(this.truckCtl.doors).filter((d) => d.state > 0.05).length;
    const st = {
      running: p.running, cranking: this.ign.cranking, rpm: p.rpm, load: o.load || 0, qty: o.qty || 0, turboRpm: o.turboRpm, vane: o.vane,
      boostPsi: o.boostPsi, mAir: o.mAir, driveKpa: o.driveKpa, smoke: o.smoke, coolantF: p.coolantF, fanDuty: p.fanDuty,
      rollerRad: p.dl.wr, tccLocked: p.dl.tccLocked, cpSlipRpm: p.dl.cpSlip * 30 / Math.PI, fail: p.fail.state, doorsOpenCount: open,
      wtsOn: this.ign.wtsOn, shopFan: this.dyno.fan, exhaustHose: this.dyno.hoseOn, hoodOpen: this.truckCtl.hood ? this.truckCtl.hood.open : false,
    };
    const dx = cam.x - 0, dz = cam.z - tz;
    const listener = { x: cam.x, y: cam.y, z: cam.z, inCab: this.mode === 'driver', doorOpen: open > 0, distanceToTruck: Math.hypot(dx, dz), distanceToDyno: Math.hypot(dx, cam.z - (TRUCK_Z + 3.9)), pan: Math.max(-1, Math.min(1, -dx / 6)) };
    try { this.audio.update(dt, st, listener); } catch (e) { /* audio must never break the frame */ }
  }

  loop(t) {
    if (this.paused) { this.last = t; requestAnimationFrame((tt) => this.loop(tt)); return; }
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t; this.frames++;
    this.update(dt);
    this.R.render(dt);
    this.governQuality((t - this._prevT) / 1000 || dt); this._prevT = t;
    requestAnimationFrame((tt) => this.loop(tt));
  }

  // Automatic quality: if the game cannot hold about 40 fps, step the quality down one level (never up, so it cannot
  // flip back and forth). Pressing Q or using the menu takes over and switches this off.
  governQuality(rawDt) {
    if (this.autoQuality === false || this.mode === 'boot') return;
    this._autoSet ??= this.qname;
    if (this._autoSet && this.qname !== this._autoSet) { this.autoQuality = false; return; } // the player chose a level
    if (rawDt > 0.25 || document.hidden) { this._slow = 0; return; } // tab switch / stall, not sustained load
    if (this.frames < 240) return; // let shaders compile and textures upload first
    this._ft = (this._ft ?? rawDt) * 0.95 + rawDt * 0.05;
    this._slow = this._ft > 1 / 40 ? (this._slow || 0) + rawDt : 0;
    if (this._slow > 3) {
      const order = ['low', 'medium', 'high']; const i = order.indexOf(this.qname);
      this._slow = 0; this._ft = 1 / 60;
      if (i > 0) {
        this.qname = this._autoSet = order[i - 1];
        this.R.setQuality(this.qname); this.ui.setQuality(this.qname);
        this.ui.say(`Running slowly: quality set to ${this.qname} (press Q to change)`, 4);
      } else this.autoQuality = false;
    }
  }
}

// ---- test and screenshot hooks (also used by npm run shots) ----
Game.prototype.cam = function (pos, tgt, fov = 60) {
  this.mode = this.mode === 'boot' ? 'boot' : 'fixed';
  this.camera.position.set(...pos); this.camera.fov = fov; this.camera.updateProjectionMatrix(); this.camera.lookAt(...tgt);
};
Game.prototype.shot = function () { this.R.render(0.016, true); return this.canvas.toDataURL('image/png'); };
Game.prototype.ready = function () { return this.frames > 2; };
// advance the simulation by `sec` seconds without rendering (deterministic checks)
Game.prototype.advance = function (sec, dt = 1 / 30) { const n = Math.ceil(sec / dt); for (let i = 0; i < n; i++) this.update(dt); };

// ---- scene presets for the showcase screenshots (npm run shots) ----
Game.prototype.pullNow = function () {
  const d = this.dyno; d.strapAll(true); d.setFan(true);
  d.startRun(); let n = 0; while (!['done', 'idle', 'refused'].includes(d.phase) && n++ < 8000) this.advance(0.25, 0.01);
  return d.last;
};
Game.prototype.startEngineNow = function () {
  const ig = this.ign; ig.setKey(0, {}); this.advance(0.3);
  ig.setKey(2, { coolantF: this.plant.coolantF, range: 'P' }); this.advance(3);
  ig.setKey(3, { coolantF: this.plant.coolantF, range: 'P' }); this.advance(4); ig.releaseStart(); this.advance(6);
};
Game.prototype.prepare = function (o = {}) {
  const ctl = this.truckCtl, ctx = this.ctx;
  this.closePanels();
  // doors and hood animate through HingeDoor.toggle (which registers the per-frame step), not by setting
  // `target` alone; the earlier preset code set the target and nothing moved
  for (const [k, d] of Object.entries(ctl.doors)) d.toggle(ctx, o.door === k);
  if (ctl.hood) {
    if (o.hood) { ctl.hoodState.cabReleased = true; ctl.hoodState.secondaryReleased = true; ctl.hood.toggle(ctx, true); }
    else ctl.hood.toggle(ctx, false);
  }
  const tg = this.truck.parts.tailgate; if (tg && tg.set) tg.set(o.tailgate ? 1 : 0);
  const fd = this.truck.parts.fuelDoor; if (fd && fd.set) fd.set(0);
  this.dyno.strapAll(!!(o.straps || o.run || o.compare));
  this.shop.setDoor(0, true); this.shop.setDoor(1, true);
  // photo presets may lift the removable pit guard rails so they do not hide the wheels (they are chained rails in a real shop)
  const fanG = this.dynoHw.group.getObjectByName('dyno_fan');
  if (fanG) {
    fanG.userData.baseX ??= fanG.position.x; fanG.userData.baseZ ??= fanG.position.z;
    // a wheeled fan: roll it clear of the camera for the wide shots (6.2 m aside, 0.8 m further forward)
    fanG.position.x = fanG.userData.baseX + (o.fanAside ? 6.2 : 0);
    fanG.position.z = fanG.userData.baseZ + (o.fanAside ? 0.8 : 0);
  }
  const rails = this.dynoHw.group.getObjectByName('pit_rails'); if (rails) rails.visible = !o.hideRails;
  this.advance(3, 0.05);
  if (o.engine && !this.plant.running) this.startEngineNow();
  if (o.run) { this.plant.warm(198, 188); if (!this.plant.running) this.startEngineNow(); this.plant.warm(198, 188); this.dyno.runs.length = 0; this.pullNow(); this.openPanel('dyno'); }
  if (o.compare) {
    // clear any half-finished flash left by an earlier preset, or the comparison shot shows the no-start state
    this.ai.bricked = false; this.ai.stage = 'idle'; this.ai.needsKeyCycle = false; this.ai.pendingApply = null;
    this.ai.progress = 0; this.ai.writing = null; this.ai.message = '';
    this.plant.pp.sound = { close: 0, hold: 0 };
    if (!this.plant.running) this.startEngineNow();
    this.plant.setRegulator('LBZ'); this.plant.warm(198, 188);
    this.plant.setCalibration(loadCal('stock')); this.dyno.runs.length = 0; this.pullNow();
    this.plant.setCalibration(loadCal(o.compare)); this.plant.warm(198, 188); this.pullNow();
    this.openPanel('ailive');
    const p = (this.uiPanels && this.uiPanels.ailive) || this.panelsReg.ailive;
    if (p && p.go) p.go('compare');
  }
  if (o.flash) {
    const ig = this.ign, ai = this.ai; this.plant.stopEngine(); ig.setKey(0, {}); this.advance(0.3); ig.setKey(2, { coolantF: 190, range: 'P' }); this.advance(0.5);
    const env = () => ({ keyPos: ig.key, engineRunning: ig.engineRunning });
    ai.plug(true); ai.setCharger(true); ai.read(env()); this.advance(14); ai.saveBackup(env()); this.advance(7); ai.write(env(), 'street'); this.advance(28);
  }
  this.advance(1, 0.05);
};


