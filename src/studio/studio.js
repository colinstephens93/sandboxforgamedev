// Truck studio: the truck and its engine alone, on a neutral backdrop, with nothing from the shop loaded.
// Purpose: work on the truck's rendering, materials and frame cost without the shop's lights, equipment and
// scenery in the way. It uses the same Renderer, quality presets, materials and culling as the game, so what
// is measured and tuned here carries over. Open studio.html (npm run studio).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Renderer } from '../core/renderer.js';
import { QUALITY } from '../core/quality.js';
import { buildTruck } from '../truck/index.js';
import { createTruckCulling } from '../truck/culling.js';
import { optimizeTruck } from '../truck/optimize.js';
import { setupTruckOpenings } from '../game/truckControl.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const BG = 0x2c2f35;

// Camera views in the truck frame (front axle at the origin, truck faces -Z, rear axle at z = 3.886 m).
// `state` is applied first: hood/door/tailgate openings and which parts are shown.
export const VIEWS = {
  hero:      { label: 'Hero',          pos: [3.7, 1.25, -4.3],  tgt: [0, 0.95, 1.4],  fov: 40 },
  side:      { label: 'Side',          pos: [8.6, 1.2, 1.9],    tgt: [0, 1.0, 1.9],   fov: 30 },
  rear:      { label: 'Rear',          pos: [3.6, 1.9, 9.2],    tgt: [0, 0.95, 4.6],  fov: 40, state: { tailgate: true } },
  wheel:     { label: 'Wheel',         pos: [1.95, 0.55, -0.35], tgt: [0.86, 0.45, 0], fov: 38 },
  bay:       { label: 'Engine bay',    pos: [0.1, 2.75, -1.45], tgt: [0, 0.95, 0.1],  fov: 56, state: { hood: true } },
  engine:    { label: 'Bay alone',     pos: [1.7, 1.75, -1.7],  tgt: [0, 0.85, 0.15], fov: 45, state: { only: ['engine', 'bay'] } },
  bare:      { label: 'Engine alone',  pos: [1.25, 1.2, -1.35], tgt: [0, 0.62, 0.05], fov: 40, state: { only: ['engine'] } },
  cutaway:   { label: 'Cutaway',       pos: [1.25, 1.2, -1.35], tgt: [0, 0.62, 0.05], fov: 40, state: { only: ['engine'], cutaway: true, running: true } },
  exploded:  { label: 'Exploded',      pos: [2.1, 1.9, -2.3],   tgt: [0, 0.75, 0.05], fov: 45, state: { only: ['engine'], exploded: true } },
  interior:  { label: 'Interior',      eye: true, fov: 64 },
  underside: { label: 'Underside',     pos: [1.9, -1.5, 5.2],   tgt: [0, 0.45, 1.9],  fov: 60 },
};
export const VIEW_ORDER = ['hero', 'side', 'rear', 'wheel', 'bay', 'bare', 'cutaway', 'exploded', 'interior', 'underside'];
// the views the benchmark times: whole truck, engine bay open, engine alone, cab, underbody
export const BENCH_VIEWS = ['hero', 'bay', 'bare', 'interior', 'underside'];

export const PARTS = [['exterior', 'Body, glass, lamps'], ['wheels', 'Wheels and tires'], ['interior', 'Interior'], ['engine', 'Engine'], ['bay', 'Engine bay (rest)'], ['hoodUnder', 'Hood underside'], ['underside', 'Underside']];

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]; };

export class Studio {
  constructor(canvas, progress = () => {}) {
    this.canvas = canvas; this.progress = progress; this.frames = 0; this.time = 0; this.animations = [];
    this.stats = { fps: 0, cpuMs: 0, gpuMs: null, calls: 0, tris: 0 };
    this.opts = { autoCull: true, running: false, rpm: 680, spin: false, light: 'studio', floor: true };
    // what a subclass may change before init() (the bench page, src/bench/bench.js)
    this.views = VIEWS; this.defaultView = 'hero'; this.defaultQuality = 'high'; this.rendererOpts = { persist: false };
  }

  async init() {
    const p = this.progress, url = new URLSearchParams(location.search);
    this.qname = QUALITY[url.get('quality')] ? url.get('quality') : this.defaultQuality;
    p(0.05, 'Starting renderer');
    this.R = new Renderer(this.canvas, this.qname, this.rendererOpts);
    const r = this.R.renderer; r.info.autoReset = false; // one frame is several passes (shadows, color, normals): count them all
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(BG); this.scene.fog = new THREE.Fog(BG, 8, 26);
        this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.04, 200);
    await nextFrame();

    p(0.15, 'Building the truck');
    this.truck = buildTruck({ quality: this.R.q });
    this.scene.add(this.truck.group);
    this.ctx = { animate: (fn) => this.animations.push(fn), say: () => {}, state: {} };
    this.ctl = setupTruckOpenings(this.truck, { say: () => {}, onLights: () => {} });
    this.merged = url.get('merge') !== '0'; // ?merge=0: every part drawn on its own, to compare
    if (this.merged) this.mergeStats = optimizeTruck(this.truck);
    this.cull = createTruckCulling(this.truck);
    this.groupParts();
    await nextFrame();

    p(0.75, 'Lighting');
    this.buildStage();
    this.setLight('studio');
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.12; this.controls.minDistance = 0.15; this.controls.maxDistance = 30;
    this.controls.zoomSpeed = 0.8; this.controls.screenSpacePanning = true;
    this.R.setScene(this.scene, this.camera);
    this.initGpuTimer();
    window.addEventListener('resize', () => this.resize());
    this.setView(this.defaultView, true);
    p(1, 'Ready');
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() { this.R.resize(); }

  // ---- stage: floor, key light with shadows, two generated environments (no downloaded HDRI) ----
  buildStage() {
    const q = this.R.q;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 64), new THREE.MeshStandardMaterial({ color: 0x4b4e53, roughness: 0.86, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'studio_floor'; this.scene.add(floor); this.floor = floor;
    // key light: a large soft source high over the driver-side front corner; the only shadow caster
    const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-5.5, 11, -4.5); key.target.position.set(0, 0.6, 1.9);
    key.castShadow = true; key.shadow.mapSize.set(q.shadowMap, q.shadowMap); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    const c = key.shadow.camera; c.left = -4.6; c.right = 4.6; c.top = 4.6; c.bottom = -4.6; c.near = 2; c.far = 26;
    this.scene.add(key, key.target); this.key = key;
    const hemi = new THREE.HemisphereLight(0xe6ebf2, 0x55524e, 0.1); this.scene.add(hemi); this.hemi = hemi;
    // environments, prefiltered once: a softbox room (studio) and an open sky (daylight)
    const pm = new THREE.PMREMGenerator(this.R.renderer);
    const sky = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 d; void main(){ float h = normalize(d).y;
        vec3 c = mix(vec3(0.95, 0.97, 1.0), vec3(0.22, 0.42, 0.85), smoothstep(0.0, 0.75, h));
        c = mix(vec3(0.30, 0.29, 0.27), c, smoothstep(-0.08, 0.02, h));
        float s = max(dot(normalize(d), normalize(vec3(-0.42, 0.78, -0.46))), 0.0); c += vec3(1.0, 0.94, 0.82) * (pow(s, 600.0) * 60.0 + pow(s, 12.0) * 0.5);
        gl_FragColor = vec4(c * 1.15, 1.0); }`,
    }));
    sky.add(dome);
    this.envs = { studio: pm.fromScene(new RoomEnvironment(), 0.03).texture, daylight: pm.fromScene(sky, 0).texture };
    pm.dispose();
  }

  setLight(name) {
    // levels set by eye so Summit White keeps its shading instead of clipping (the generated rooms are far brighter than the shop)
    const L = { studio: { key: 2.0, color: 0xffffff, hemi: 0.1, env: 0.4 }, daylight: { key: 2.6, color: 0xfff1dc, hemi: 0.2, env: 0.5 } }[name];
    if (!L) return;
    this.opts.light = name; this.scene.environment = this.envs[name]; this.scene.environmentIntensity = L.env;
    this.key.intensity = L.key; this.key.color.set(L.color); this.hemi.intensity = L.hemi; this.R.renderer.shadowMap.needsUpdate = true;
  }

  // ---- parts: named groups that can be shown, hidden and counted on their own ----
  groupParts() {
    const P = this.truck.parts, root = this.truck.group;
    const bay = P.engineBay.group, engine = P.engineBay.parts.engine, hu = P.hoodUnder.group, under = this.truck.underside.group, inter = P.interior.group;
    const wheels = P.wheels.all.map((w) => w.group);
    const named = new Set([bay, hu, under, inter, ...wheels]);
    const exterior = root.children.filter((o) => !named.has(o)); // body, hood pivot, glass, front, rear, badges, fuel door
    this.parts = { exterior: { roots: exterior, skip: named }, wheels: { roots: wheels }, interior: { roots: [inter] }, engine: { roots: [engine] }, bay: { roots: [bay], skip: new Set([engine]) }, hoodUnder: { roots: [hu] }, underside: { roots: [under] } };
    for (const [k, part] of Object.entries(this.parts)) {
      part.visible = true; part.objects = [];
      const walk = (o) => { if (part.skip && part.skip.has(o)) return; part.objects.push(o); for (const ch of o.children) walk(ch); };
      part.roots.forEach(walk);
      part.count = this.countPart(part); part.key = k;
    }
  }
  // static content of a part: meshes (one draw call each per pass), triangles (instances included), distinct materials
  countPart(part) {
    let meshes = 0, tris = 0; const mats = new Set();
    for (const o of part.objects) {
      if (!o.isMesh || o.userData.pickOnly) continue; // originals of merged meshes are not drawn
      meshes++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
      tris += o.isInstancedMesh ? n * o.count : n;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
    }
    return { meshes, tris: Math.round(tris), materials: mats.size };
  }
  // A part is hidden by taking it off the camera layer, not by `visible`: the hood underside lives inside the hood and
  // the culling toggles `visible` on single meshes, so a separate switch keeps the two from fighting.
  setPart(name, on) {
    const part = this.parts[name]; if (!part) return;
    part.visible = on;
    // lights stay on their layer: taking one away changes the light count, which recompiles every material
    for (const o of part.objects) { if (o.isLight || o.userData.pickOnly) continue; if (on) o.layers.enable(0); else o.layers.disable(0); }
    this.R.renderer.shadowMap.needsUpdate = true;
  }
  showOnly(names) { for (const k of Object.keys(this.parts)) this.setPart(k, !names || names.includes(k)); }

  // ---- truck state ----
  setHood(open) { const c = this.ctl; if (!c.hood) return; c.hoodState.cabReleased = c.hoodState.secondaryReleased = open; c.hood.toggle(this.ctx, open); }
  setDoor(key, open) { const d = this.ctl.doors[key]; if (d) d.toggle(this.ctx, open); }
  setDoors(open) { for (const k of Object.keys(this.ctl.doors)) this.setDoor(k, open); }
  // detailed engine: fade the castings to show the moving internals, or pull the assemblies apart
  get core() { return this.truck.parts.engineBay.core; }
  setCutaway(on) { if (this.core) this.core.setCutaway(on); }
  setExploded(on) { if (this.core) this.core.setExploded(on); }
  setTailgate(open) { const tg = this.truck.parts.tailgate; if (tg && tg.set) tg.set(open ? 1 : 0); this.tailgateOpen = open; this.R.renderer.shadowMap.needsUpdate = true; }
  get state() { return { hood: !!(this.ctl.hood && this.ctl.hood.open), doors: Object.values(this.ctl.doors).some((d) => d.open), tailgate: !!this.tailgateOpen }; }
  // finish every running hinge animation at once (scripts and the benchmark do not wait for doors to swing)
  settle() { for (let i = 0; i < 200 && (this.animations.length || (this.core && this.core.busy)); i++) this.tick(0.05); this.R.renderer.shadowMap.needsUpdate = true; }

  setView(name, instant = false) {
    const v = this.views[name]; if (!v) return;
    const s = v.state || {};
    this.view = name;
    if (this.core) this.core.standalone = !!(s.only && s.only.length === 1 && s.only[0] === 'engine');
    this.setCutaway(!!s.cutaway); this.setExploded(!!s.exploded); if (s.running) this.opts.running = true;
    this.setHood(!!s.hood); this.setDoors(!!s.doors); this.setTailgate(!!s.tailgate); this.showOnly(s.only || null);
    this.floor.visible = this.opts.floor && !s.only;
    let pos = v.pos, tgt = v.tgt;
    if (v.eye) { // driver's eye point from the interior, looking at the cluster
      const e = this.truck.anchors.interior.eye.getWorldPosition(new THREE.Vector3());
      pos = [e.x, e.y, e.z]; tgt = [e.x, e.y - 0.1, e.z - 0.35];
    }
    this.camera.position.set(...pos); this.camera.fov = v.fov; this.camera.updateProjectionMatrix();
    this.controls.target.set(...tgt); this.controls.update();
    if (instant) this.settle();
    if (this.onChange) this.onChange();
  }

  // ---- render settings: single effects on top of the quality preset, so the cost of each can be read off ----
  setRender(over) {
    this.R.qOverride = { ...(this.R.qOverride || {}), ...over };
    this.R.setQuality(this.qname);
    this.key.castShadow = this.R.q.shadows !== false;
    if (this.key.shadow.mapSize.x !== this.R.q.shadowMap) { this.key.shadow.mapSize.set(this.R.q.shadowMap, this.R.q.shadowMap); if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; } }
    this.R.renderer.shadowMap.needsUpdate = true;
  }

  // ---- per-frame ----
  tick(dt) {
    this.time += dt;
    for (let i = this.animations.length - 1; i >= 0; i--) if (this.animations[i](dt)) this.animations.splice(i, 1);
    const o = this.opts, rpm = o.running ? o.rpm : 0;
    this.truck.update(dt, { rpm, running: o.running, fanDuty: 0.35, turboRpm: rpm * 30, shimmer: 0 });
    this.truck.interior.update(dt, { keyPos: o.running ? 2 : 0, rpm, mph: 0, coolantF: 190, transF: 150, oilPsi: o.running ? 42 : 0, volts: o.running ? 14.1 : 12.5, fuel: 0.7, lights: {}, dicMessage: '', odometerMi: 148230, engineHours: 4120 });
    if (o.spin) { this.wheelAngle = (this.wheelAngle || 0) - dt * 6; this.truck.parts.wheels.spin(this.wheelAngle); }
    // everything is drawn for the first few updates so all shaders compile while loading
    // a view that isolates parts (the engine alone) shows them whatever the hood is doing
    if (o.autoCull && !this.views[this.view]?.state?.only) this.cull.update(this.camera.position, this.ctl.hood, (this.ticks = (this.ticks || 0) + 1) < 4); else this.cull.showAll();
    this.floor.visible = this.opts.floor && !(this.views[this.view]?.state?.only) && this.camera.position.y > 0;
    // moving parts need fresh shadows every frame; a still truck keeps the Renderer's schedule
    if (this.animations.length || o.spin || (this.core && this.core.busy)) this.R.renderer.shadowMap.needsUpdate = true;
  }
  draw(dt, forceShadows = false) { this.R.renderer.info.reset(); this.R.render(dt, forceShadows); }

  loop(t) {
    const raw = (t - this.last) / 1000; this.last = t;
    if (!this.busy) {
      const dt = Math.min(0.05, raw); this.frames++;
      const t0 = performance.now();
      this.controls.update(); this.tick(dt);
      this.gpuBegin(); this.draw(dt); this.gpuEnd();
      const s = this.stats, info = this.R.renderer.info;
      s.cpuMs = s.cpuMs * 0.9 + (performance.now() - t0) * 0.1;
      if (raw > 0 && raw < 0.5) s.fps = s.fps * 0.92 + (1 / raw) * 0.08;
      s.calls = info.render.calls; s.tris = info.render.triangles; s.geometries = info.memory.geometries; s.textures = info.memory.textures; s.programs = info.programs ? info.programs.length : 0;
      if (this.onFrame && this.frames % 15 === 0) this.onFrame(s);
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }

  // ---- GPU time per frame (EXT_disjoint_timer_query_webgl2, where the browser offers it) ----
  initGpuTimer() { const gl = this.R.renderer.getContext(); this.gl = gl; this.tq = gl.getExtension && gl.getExtension('EXT_disjoint_timer_query_webgl2'); this.pending = []; }
  gpuBegin() {
    const gl = this.gl, ext = this.tq; if (!ext) return;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; this.stats.gpuMs = this.stats.gpuMs == null ? ms : this.stats.gpuMs * 0.9 + ms * 0.1; }
      gl.deleteQuery(q); this.pending.splice(i, 1);
    }
    if (this.pending.length > 4) { this.activeQuery = null; return; }
    this.activeQuery = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, this.activeQuery);
  }
  gpuEnd() { if (this.tq && this.activeQuery) { this.gl.endQuery(this.tq.TIME_ELAPSED_EXT); this.pending.push(this.activeQuery); this.activeQuery = null; } }

  gpuName() { const gl = this.gl, d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; }

  // ---- benchmark: full cost of one frame (update + every pass, finished on the GPU) for each benchmark view ----
  // Each frame is timed on its own and waited for, so the figure does not depend on the display's refresh rate.
  async bench({ frames = 60, views = BENCH_VIEWS, onProgress } = {}) {
    const keep = { view: this.view, pos: this.camera.position.clone(), tgt: this.controls.target.clone(), fov: this.camera.fov };
    this.busy = true;
    const gl = this.gl, rows = [];
    // Reading one pixel back is what makes the browser wait for the GPU: gl.finish() alone returns early in Chrome,
    // where drawing happens in another process, and the queued work then shows up as one huge frame later.
    const px = new Uint8Array(4);
    // cpu: the script's own share (update + issuing every draw call), which is what fewer draw calls reduce
    let cpu = 0;
    const one = () => {
      const t0 = performance.now(); this.tick(0.016); this.draw(0.016); cpu += performance.now() - t0;
      this.R.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return performance.now() - t0;
    };
    try {
      for (const name of views) {
        if (onProgress) onProgress(name);
        this.setView(name, true);
        await nextFrame();
        for (let i = 0; i < 8; i++) one(); // warm up: shader compiles, texture uploads
        cpu = 0; const ms = []; for (let i = 0; i < frames; i++) ms.push(one());
        const cpuMs = cpu / frames;
        this.draw(0.016, true); // a frame with every pass, for the counts
        const info = this.R.renderer.info.render, avg = ms.reduce((a, b) => a + b, 0) / ms.length;
        rows.push({ view: name, cpuMs, avgMs: avg, p50Ms: pct(ms, 50), p95Ms: pct(ms, 95), maxMs: Math.max(...ms), fps: 1000 / avg, calls: info.calls, tris: info.triangles });
      }
    } finally {
      this.setView(keep.view, true); this.camera.position.copy(keep.pos); this.controls.target.copy(keep.tgt); this.camera.fov = keep.fov; this.camera.updateProjectionMatrix(); this.controls.update();
      this.busy = false; this.last = performance.now();
    }
    const size = this.R.renderer.getDrawingBufferSize(new THREE.Vector2());
    return { quality: this.qname, merged: this.merged, overrides: this.R.qOverride || {}, resolution: [size.x, size.y], gpu: this.gpuName(), autoCull: this.opts.autoCull, frames, rows };
  }

  // ---- script hooks (scripts/studio.mjs) ----
  ready() { return this.frames > 2; }
  shot() { this.controls.update(); this.tick(0); this.draw(0.016, true); return this.canvas.toDataURL('image/png'); }
  savePNG() { this.draw(0.016, true); this.canvas.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `truck-studio-${this.view}-${Date.now()}.png`; a.click(); }, 'image/png'); }
}
