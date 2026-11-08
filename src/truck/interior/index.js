// The 2005 Silverado 2500HD LT crew cab interior (tan leather): dash, cluster with working needles, steering wheel and column,
// seats, console, door cards, headliner and overhead console, carpet and trim.  See docs/CONVENTIONS.md.
//
// buildInterior({ quality, parts }) -> {
//   group,                     all interior meshes (truck frame, meters); add under the truck root
//   anchors,                   { ignition, ignitionKey, shifter, towHaulButton, hoodRelease, obdPort, obdPlug, glovebox, transferCase,
//                                parkBrake, brakePedal, accelPedal, eye, cluster, steeringWheel ... } (Object3D)
//   interiorLight,             { setOn(bool), on }  dome and map lamps (on when a door is open)
//   cluster,                   { mesh, update(state, dt) } (see cluster.js)
//   state,                     shared flags { gear, towHaul, odOff, transfer }
//   update(dt, clusterState),  drive needles, lights, key animation, glove box, radio display
//   shift(gear), setClusterState(partial)
// }
import * as THREE from 'three';
import { IN, M, hitMesh } from './kit.js';
import { makeMaterials } from './mats.js';
import { buildCluster } from './cluster.js';
import { buildDash, DASH } from './dash.js';
import { buildControls } from './controls.js';
import { defaultClusterState } from './logic.js';
import { INTERIOR_LABELS } from './labels.js';
import { buildSeats } from './seats.js';
import { buildCabShell } from './trim.js';
import { buildDoorCards } from './doors.js';

export { INTERIOR_LABELS };
export { DASH };
export const EYE = { x: -16, y: 56, s: 66 }; // driver eye point (inches, truck frame)

export function buildInterior({ quality, parts = {} } = {}) {
  const q = quality || { tex: 1024, aniso: 4 };
  const group = new THREE.Group(); group.name = 'interior';
  const root = new THREE.Group(); root.name = 'interior_in'; root.scale.setScalar(IN); group.add(root); // authored in inches
  const MT = makeMaterials(q);
  const anchors = {};
  const state = { gear: 'P', towHaul: false, odOff: false, transfer: '2WD', glovebox: 0 };
  const env = { root, M: MT, quality: q, anchors, state, parts, ignition: null };

  // eye point marker
  const eye = new THREE.Object3D(); eye.name = 'driver_eye'; eye.position.set(EYE.x, EYE.y, EYE.s); root.add(eye); anchors.eye = eye;

  // cluster
  const cluster = buildCluster({ quality: q });
  const C = DASH.cluster; cluster.mesh.position.set(C.x, C.y, C.s); cluster.mesh.rotation.x = -C.tilt;
  cluster.mesh.userData.labelId = 'interior.cluster'; root.add(cluster.mesh); anchors.cluster = cluster.mesh;
  const cluHit = hitMesh(new THREE.BoxGeometry(13, 5.2, 1.4)); cluHit.position.z = 0.5; cluHit.userData.labelId = 'interior.cluster'; cluster.mesh.add(cluHit);

  const dash = buildDash(env);
  const controls = buildControls(env);
  anchors.steeringWheel = controls.wheel;

  // hood release and glove box interactions
  anchors.hoodRelease.userData.interact = {
    prompt: 'Pull hood release',
    run(ctx) {
      const h = anchors.hoodRelease; const z0 = h.userData.restZ; let t = 0;
      ctx.say?.('Hood released. Lift the hood from the front.');
      if (ctx.state) ctx.state.hoodReleased = true;
      env.onHoodRelease?.(ctx);
      const fn = (dt) => { t += dt; const k = t < 0.25 ? t / 0.25 : Math.max(0, 1 - (t - 0.25) / 0.45); h.position.z = z0 - 1.5 * k * (t < 0.25 ? 1 : 1); return t > 0.7; };
      if (ctx.animate) ctx.animate(fn); else h.position.z = z0;
    },
  };
  const gb = anchors.glovebox; let gbTarget = 0;
  gb.userData.interact = { prompt: 'Open glove box', run(ctx) { gbTarget = gbTarget ? 0 : 1; ctx.say?.(gbTarget ? 'Glove box open' : 'Glove box closed'); } };
  anchors.transferCase.userData.interact = {
    prompt: 'Transfer case: 2WD / 4HI / N / 4LO',
    run(ctx) { const order = ['2WD', '4HI', 'N', '4LO']; state.transfer = order[(order.indexOf(state.transfer) + 1) % 4]; if (ctx?.state) ctx.state.transfer = state.transfer; ctx?.say?.(`Transfer case: ${state.transfer}`); },
  };

  // seats, console, rear bench, floor
  const seats = buildSeats(env); Object.assign(anchors, seats.anchors || {});
  // cab shell: carpet, headliner, pillars, overhead console, visors, mirror, rear wall, sills, placard
  const shell = buildCabShell(env); Object.assign(anchors, shell.anchors || {});
  // door cards (children of the door groups)
  const doors = buildDoorCards(env);
  const doorParts = parts.doors;
  if (doorParts) for (const k of Object.keys(doors.cards)) if (doorParts[k]) doorParts[k].add(doors.cards[k]); else group.add(doors.cards[k]);

  // interior light (dome / map lamps): on when a door is open
  const interiorLight = {
    on: false,
    setOn(on) { this.on = !!on; for (const l of shell.lamps) l.intensity = this.on ? l.userData.maxI : 0; /* intensity, not visibility: toggling visibility would recompile every material */ shell.lampMat.emissiveIntensity = this.on ? 2.2 : 0; },
  };
  interiorLight.setOn(false);

  // a faint ambient fill so the cab never reads pure black (stands in for light bounced from the shop through the glass)
  const fill = new THREE.PointLight(0xfff1dc, 0.35, 3.2, 1.6); fill.position.set(0, 1.45, 1.75); group.add(fill);

  // ---------------- runtime ----------------
  const cs = defaultClusterState();
  const api = {
    group, anchors, interiorLight, cluster, state, colliders: [], labels: INTERIOR_LABELS, clusterState: cs, materials: MT,
    setClusterState(p) { Object.assign(cs, p); if (p.lights) cs.lights = { ...cs.lights, ...p.lights }; },
    shift(g) { env.setGear?.(g, null); },
    set ignition(ig) { env.ignition = ig; },
    get ignition() { return env.ignition; },
    set onHoodRelease(fn) { env.onHoodRelease = fn; },
    update(dt, s) {
      const c = s ? { ...cs, ...s, lights: { ...cs.lights, ...(s.lights || {}) } } : cs;
      if (!s || s.gear == null) c.gear = state.gear;
      // sync indicator lamps with the control state
      c.lights = { ...c.lights, tow: c.lights.tow || state.towHaul, odOff: c.lights.odOff || state.odOff, fourWd: c.lights.fourWd || (state.transfer !== '2WD') };
      if (env.ignition && (!s || s.keyPos == null)) c.keyPos = env.ignition.key;
      cluster.update(c, dt);
      controls.update(dt);
      gb.rotation.x += ((gbTarget ? 1.25 : 0) - gb.rotation.x) * (1 - Math.exp(-dt / 0.09));
      dash.tcDots.forEach((d, i) => { d.visible = ['2WD', '4HI', 'N', '4LO'][i] === state.transfer; });
      shell.update?.(dt, c); seats.update?.(dt, c); dash.update?.(dt, c, env);
      updateDisplays(env, c);
    },
  };
  return api;
}

// radio and climate displays (teal when the key is in ACC or RUN)
function updateDisplays(env, c) {
  const on = c.keyPos >= 1;
  const rd = env.radioDisplay, cd = env.climDisplay; if (!rd) return;
  const sig = on ? 'on' : 'off';
  if (rd.last !== sig) {
    rd.last = sig; const g = rd.canvas.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 128);
    if (on) { g.fillStyle = '#58f4e6'; g.font = '700 64px "DejaVu Sans Mono", monospace'; g.textBaseline = 'middle'; g.fillText('12:16', 24, 78); g.font = '700 22px "DejaVu Sans Mono", monospace'; g.fillText('FM2', 290, 36); g.fillText('INFO', 290, 70); g.font = '700 28px "DejaVu Sans Mono", monospace'; g.fillText('98.7 FM', 340, 100); }
    rd.tex.needsUpdate = true;
    const cg = cd.canvas.getContext('2d'); cg.fillStyle = '#000'; cg.fillRect(0, 0, 256, 192);
    if (on) { cg.fillStyle = '#58f4e6'; cg.font = '700 60px "DejaVu Sans Mono", monospace'; cg.textBaseline = 'middle'; cg.fillText('60', 20, 96); cg.font = '700 24px "DejaVu Sans Mono", monospace'; cg.fillText('°F', 130, 76); cg.fillRect(180, 40, 12, 112); cg.fillRect(198, 70, 12, 82); cg.fillRect(216, 100, 12, 52); }
    cd.tex.needsUpdate = true;
  }
}
