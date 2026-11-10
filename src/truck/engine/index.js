// Engine bay of the 2005 Silverado 2500HD Duramax LLY: assembles the fixed structure, cooling stack, labeled parts and the engine itself.
// buildEngineBay({ quality }) -> { group, anchors, update(dt, st), labels, stats }. group is in the truck frame (meters).
// update(dt, st) with st = { rpm, running, fanDuty, turboRpm, shimmer 0..1 }: engine shakes on its mounts, the fan spins, heat shimmer near the turbo.
import * as THREE from 'three';
import { IN_TO_M } from '../skin.js';
import { makeMats } from './mats.js';
import { Fasteners, engineShake, fanOmega, clamp } from './geo.js';
import { ENGINE, HINGE, POS } from './layout.js';
import { buildPowertrain } from './powertrain.js';
import { buildTurbo } from './turbo.js';
import { buildBay } from './bay.js';
import { buildCooling } from './cooling.js';
import { buildBits, buildEngineWiring } from './bits.js';
import { ENGINE_LABELS } from './labels.js';
import { buildDetailedEngine } from './detailedEngine.js';

export { ENGINE_LABELS };
export { hoodPose, buildHoodUnder } from '../hoodUnder.js';

// The parts of the simple engine that the detailed long block replaces (it has its own block, heads, covers, manifolds,
// front drive with alternator and water pump, turbo, up-pipes, fuel system and harness).
const SUPERSEDED = ['block', 'bank_driver', 'bank_passenger', 'intake_manifold', 'cp3', 'belt', 'pulleys', 'water_pump', 'tensioner', 'alternator', 'turbo', 'downpipe', 'crossovers', 'vgt_actuator', 'engine_wiring', 'fasteners_engine'];
// mid-length of the detailed engine along the truck, in bay inches (the heads then sit where the simple engine's banks were)
const CORE_S = 2.4;

// detailed: false builds the earlier simple engine only (no internals)
export function buildEngineBay({ quality, detailed = true } = {}) {
  quality = quality || { tex: 512 };
  const d = quality.tex >= 2048 ? 1 : quality.tex >= 1024 ? 0.75 : 0.5;
  const mats = makeMats(quality);
  const root = new THREE.Group(); root.name = 'engine_bay';
  const inch = new THREE.Group(); inch.name = 'engine_bay_inches'; inch.scale.setScalar(IN_TO_M); root.add(inch);

  // fixed (body mounted) assemblies
  const sfast = new Fasteners(mats);
  const bay = buildBay({ mats, d, fast: sfast }); inch.add(bay.group);
  const cooling = buildCooling({ mats, d, fast: sfast }); inch.add(cooling.group);
  const bits = buildBits({ mats, d, fast: sfast }); inch.add(bits.group);
  { const fg = new THREE.Group(); fg.name = 'fasteners_static'; fg.userData.labelId = 'engine.fasteners'; inch.add(fg); sfast.flush(fg); }

  // the engine, free to move on its mounts: pivot at the crankshaft centerline
  const c = ENGINE.crank;
  const mount = new THREE.Group(); mount.name = 'engine_mount'; mount.userData.dynamic = true; mount.position.set(c.x, c.y, c.s); inch.add(mount);
  const body = new THREE.Group(); body.name = 'engine_body'; body.position.set(-c.x, -c.y, -c.s); mount.add(body);
  const efast = new Fasteners(mats);
  const pt = buildPowertrain({ mats, d, fast: efast, coverDepth: detailed ? 2.6 : 6.4 }); body.add(pt.group);
  const turbo = buildTurbo({ mats, d, fast: efast }, pt.group);
  buildEngineWiring({ mats, d, fast: efast }, pt.group);
  { const fg = new THREE.Group(); fg.name = 'fasteners_engine'; fg.userData.labelId = 'engine.fasteners'; pt.group.add(fg); efast.flush(fg); }

  // ---- the detailed long block (src/truck/engine/detailedEngine.js) takes the place of the simple block and its dress ----
  let core = null;
  if (detailed) {
    for (const name of SUPERSEDED) { const o = pt.group.getObjectByName(name); if (o) o.parent.remove(o); }
    core = buildDetailedEngine({ crank: { x: c.x, y: c.y, s: CORE_S } });
    pt.group.add(core.group);
  }

  // ---- anchors (Object3Ds) for labels and interaction; letters follow the supplement diagram ----
  const A = {
    hoodHinge: { pivotS: HINGE.pivotS * IN_TO_M, pivotY: HINGE.pivotY * IN_TO_M, pivotSIn: HINGE.pivotS, pivotYIn: HINGE.pivotY, openAngleMax: HINGE.openAngleMaxDeg * Math.PI / 180, openAngleMaxDeg: HINGE.openAngleMaxDeg },
    primaryLatch: bay.anchors.latch,
    secondaryRelease: bay.anchors.secondary,
    dipstickEngine: pt.anchors.dipstickOil,
    dipstickTrans: bits.anchors.dipstickTrans,
    oilCap: pt.anchors.oilCap,
    surgeTankCap: bits.anchors.surgeTankCap,
    surgeTank: bits.anchors.surgeTank,
    airFilter: bits.anchors.airbox,
    restrictionIndicator: bits.anchors.restriction,
    batteryPass: bits.anchors.batteryPass,
    batteryDriver: bits.anchors.batteryDriver,
    fuseBlock: bits.anchors.fuseBlock,
    washerReservoir: bits.anchors.washerCap,
    brakeReservoir: bits.anchors.brakeReservoir,
    psReservoir: pt.anchors.psReservoir,
    remoteNeg: pt.anchors.remoteNeg,
    remotePos: pt.anchors.remotePos,
    fan: pt.anchors.fan,
    engineCover: pt.anchors.engineCover,
    turbo: core ? core.model.assemblies.get('turbo') : turbo.turbo,
    intercooler: cooling.anchors.intercooler,
    radiator: cooling.anchors.radiator,
    alternator: core ? core.model.assemblies.get('front-drive') : pt.anchors.alternator,
    acCompressor: pt.anchors.acCompressor,
    positions: POS,
  };
  A.letters = { A: A.airFilter, B: A.surgeTank, C: [A.batteryPass, A.batteryDriver], D: A.restrictionIndicator, E: A.dipstickEngine, F: A.dipstickTrans, G: A.oilCap, H: A.fan, I: A.psReservoir, J: A.remoteNeg, K: A.remotePos, L: A.brakeReservoir, N: A.fuseBlock, O: A.washerReservoir };

  // ---- optional soft fill light for the dark bay (the integrator can switch it with group.userData.setBayLight) ----
  const light = new THREE.PointLight(0xfff1dd, 0, 2.2, 1.6); light.name = 'bay_light'; light.position.set(0, 52 * IN_TO_M, -2 * IN_TO_M); root.add(light);
  light.visible = false; // off by default (a light changes every material's shader); switch on with root.userData.setBayLight(intensity)
  root.userData.setBayLight = (v) => { light.intensity = v; light.visible = v > 0; };

  // ---- animation ----
  let t = 0, shimmer = 0;
  const spin = pt.anchors.fanSpin, shm = turbo.shimmerMat;
  const state = { rpm: 0, omega: 0 };
  function update(dt, st = {}) {
    t += dt;
    const rpm = st.rpm || 0, running = !!st.running;
    const k = engineShake(t, rpm, running);
    mount.position.set(c.x + k.dx, c.y + k.dy, c.s); mount.rotation.z = k.roll;
    // the fan clutch locks up with fanDuty; it also coasts down when the engine stops
    const target = running ? fanOmega(rpm, st.fanDuty ?? 0.3) : 0;
    state.omega += (target - state.omega) * clamp(dt * (running ? 3 : 0.8), 0, 1);
    if (spin) spin.rotation.z -= state.omega * dt;
    const sh = st.shimmer != null ? st.shimmer : clamp(((st.turboRpm || 0) - 60000) / 90000, 0, 1);
    shimmer += (clamp(sh, 0, 1) - shimmer) * clamp(dt * 2.5, 0, 1);
    shm.uniforms.uTime.value = t; shm.uniforms.uAmt.value = shimmer;
    turbo.shimmer.visible = shimmer > 0.01;
    if (core) { core.update(dt, st); const open = core.cutaway || core.exploded; if (A.engineCover.visible === open) A.engineCover.visible = !open; } // the plastic cover lifts away for the cutaway and exploded views
  }
  // count triangles / draw calls for the budget check
  const stats = () => { let tris = 0, meshes = 0; root.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; tris += o.isInstancedMesh ? n * o.count : n; } }); return { tris: Math.round(tris), meshes }; };
  return { group: root, anchors: A, update, labels: ENGINE_LABELS, stats, mats, core, parts: { engine: mount, fanSpin: spin } };
}
