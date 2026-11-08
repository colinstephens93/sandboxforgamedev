// Steering wheel, tilt column with shrouds and stalks, column shift lever with the Tow/Haul button, ignition with the key, and
// their interactions. Layout from 01b-dash-wide-driver-pov (wheel, stalk, shape) and IMG_2866/2867/2870/2871 (lever, key, hub).
// Inches, truck frame. The wheel is 15 in in diameter (PROMPT.md section 4).
import * as THREE from 'three';
import { Batch, M, lookM, boxG, cylG, cylX, cylZ, plateG, softBox, tubeG, canvasTex, lerp, polyG } from './kit.js';
import { KEY } from '../../sim/startSequence.js';
import { nextKeyPosition, keyTwist, cycleGear, GEARS, KEY_NAMES } from './logic.js';

export const WHEEL = { hub: [-16, 43.6, 52.6], dir: [0, 0.36, 0.933], R: 6.95, tube: 0.64 }; // diameter 2 * (R + tube) = 15.2 in

function bowtieShape(w) {
  const k = w / 2;
  const pts = [[-1, 0.13], [-0.34, 0.2], [-0.22, 0.34], [0.22, 0.34], [0.34, 0.2], [1, 0.13], [1, -0.13], [0.34, -0.2], [0.22, -0.34], [-0.22, -0.34], [-0.34, -0.2], [-1, -0.13]];
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x * k, y * k) : s.moveTo(x * k, y * k))); s.closePath(); return s;
}

export function buildControls(env) {
  const { root, M: MT, anchors, quality } = env;
  const st = env.state; // shared interior state { gear, towHaul, odOff, transfer, ... }
  const col = new THREE.Group(); col.name = 'steering_column'; root.add(col);
  const dir = new THREE.Vector3(...WHEEL.dir).normalize();
  const hubP = new THREE.Vector3(...WHEEL.hub);
  const frame = lookM(WHEEL.hub, WHEEL.dir, [0, 1, 0]);   // local +Z toward the driver
  const colFrame = new THREE.Group(); colFrame.matrixAutoUpdate = false; colFrame.matrix.copy(frame); col.add(colFrame);
  const B = new Batch(MT);

  // ---------------- wheel ----------------
  const wheel = new THREE.Group(); wheel.name = 'steering_wheel'; wheel.userData.labelId = 'interior.steeringWheel'; colFrame.add(wheel);
  const R = WHEEL.R, T = WHEEL.tube;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, T, 20, 72), MT.wheelLeather); rim.scale.z = 0.88; wheel.add(rim);
  // stitching along the inside of the rim (thin thread rings)
  const thread = new THREE.Mesh(new THREE.TorusGeometry(R - T * 0.96, 0.028, 5, 96), MT.wheelThread); thread.position.z = -0.02; thread.scale.z = 1; wheel.add(thread);
  const thread2 = new THREE.Mesh(new THREE.TorusGeometry(R + T * 0.96, 0.028, 5, 96), MT.wheelThread); wheel.add(thread2);
  // hub / airbag cover
  const hubG = softBox({ w: 5.4, h: 3.9, d: 1.9, r: 0.9, step: 0.7, deform: (p, o) => { const k = Math.max(0, p[2]); p[2] += 0.18 * k * (1 - (p[0] / 3) ** 2 - (p[1] / 2.2) ** 2 > 0 ? (1 - (p[0] / 3) ** 2 - (p[1] / 2.2) ** 2) : 0); } });
  const hub = new THREE.Mesh(hubG, MT.wheelPlastic); hub.position.set(0, 0.1, 0.55); wheel.add(hub);
  const hubBack = new THREE.Mesh(cylZ(2.3, 2.6, 1.4, 28), MT.graphite); hubBack.position.z = -0.9; wheel.add(hubBack);
  // bowtie emblem (satin dark chrome) and the AIR BAG text
  const bt = new THREE.ExtrudeGeometry(bowtieShape(2.55), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  const bow = new THREE.Mesh(bt, MT.satin); bow.position.set(0, 0.35, 1.54); wheel.add(bow);
  const bowRim = new THREE.Mesh(new THREE.ExtrudeGeometry(bowtieShape(2.35), { depth: 0.05, bevelEnabled: false }), MT.black); bowRim.position.set(0, 0.35, 1.58); wheel.add(bowRim);
  const abTex = canvasTex(256, 48, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(210,210,205,0.55)'; c.font = '600 22px Inter, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('AIR BAG', w / 2, h / 2); }, { aniso: 4 });
  const ab = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), new THREE.MeshBasicMaterial({ map: abTex, transparent: true, depthWrite: false, opacity: 0.8 })); ab.position.set(0, -1.15, 1.42); ab.rotation.x = -0.12; wheel.add(ab);
  // spokes: two upper arms (3 and 9 o'clock, rising slightly) and two lower diagonals
  const spoke = (x0, y0, x1, y1, w, th) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    const m = new THREE.Mesh(softBox({ w: len, h: w, d: th, r: Math.min(0.4, w * 0.3), step: 0.8 }), MT.wheelPlastic);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.0); m.rotation.z = ang; wheel.add(m); return m;
  };
  for (const sx of [-1, 1]) {
    spoke(sx * 2.0, 0.55, sx * (R - 0.4), 0.85, 1.85, 1.0);
    spoke(sx * 1.5, -1.5, sx * (R * 0.66), -R * 0.62, 1.5, 0.95);
  }
  // switches on the upper spokes: cruise control (left), radio/volume (right)
  const swTex = (labels) => canvasTex(256, 96, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#d8d6ce'; c.font = '700 15px Inter, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; labels.forEach(([t, x, y]) => c.fillText(t, x, y)); }, { aniso: 4 });
  const cruise = ['ON/OFF', 'RES', 'SET'], radioL = ['VOL', 'SEEK', 'MODE'];
  for (const [sx, names] of [[-1, cruise], [1, radioL]]) {
    for (let i = 0; i < 3; i++) {
      const x = sx * (3.4 + i * 1.05), y = 1.1 - i * 0.08;
      const b = new THREE.Mesh(plateG(0.78, 0.5, 0.22, 0.14, 0.03), MT.black); b.position.set(x, y, 0.5); b.rotation.z = sx * 0.04; wheel.add(b);
    }
  }
  // horn symbols (embossed) skipped: the cover shows the bowtie and AIR BAG as on the truck
  // hit box and interactivity: none (scenery); label is on the group
  const wheelHit = new THREE.Mesh(new THREE.CylinderGeometry(R + T, R + T, 1.6, 20), new THREE.MeshBasicMaterial({ visible: false })); wheelHit.rotation.x = Math.PI / 2; wheelHit.userData.labelId = 'interior.steeringWheel'; wheel.add(wheelHit);

  // ---------------- column ----------------
  // upper shroud (graphite) from behind the hub to the dash, with the lower shroud and tilt lever
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.25, 8.8, 28), MT.graphite); shroud.rotation.x = Math.PI / 2; shroud.position.z = -5.5; colFrame.add(shroud);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.05, 1.6, 28), MT.graphite); nose.rotation.x = Math.PI / 2; nose.position.z = -1.5; colFrame.add(nose);
  // lower shroud cover is tan-grey; kept as a flattened box
  const lower = new THREE.Mesh(softBox({ w: 4.3, h: 1.4, d: 6.6, r: 0.45, step: 1.5 }), MT.graphite); lower.position.set(0, -1.9, -5.2); colFrame.add(lower);
  // tilt lever (left side, under the stalk)
  const tilt = new THREE.Mesh(cylG(0.2, 0.18, 3.6, 10), MT.black); tilt.rotation.z = Math.PI / 2 + 0.2; tilt.position.set(-3.4, -1.1, -4.2); colFrame.add(tilt);
  // hazard button (triangle) on the top of the column cover
  const hazardBase = new THREE.Mesh(plateG(1.3, 1.1, 0.4, 0.18, 0.04), MT.graphite); hazardBase.rotation.x = -Math.PI / 2; hazardBase.position.set(0, 2.1, -2.5); colFrame.add(hazardBase);
  const triShape = new THREE.Shape(); triShape.moveTo(0, 0.42); triShape.lineTo(0.42, -0.3); triShape.lineTo(-0.42, -0.3); triShape.closePath();
  const tri = new THREE.Mesh(new THREE.ExtrudeGeometry(triShape, { depth: 0.04, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.5 })); tri.rotation.x = -Math.PI / 2; tri.position.set(0, 2.55, -2.35); colFrame.add(tri);
  // multifunction stalk (turn signal, wipers, high beam): on the left of the column
  {
    const s = new THREE.Group(); s.name = 'turn_signal_stalk'; s.userData.labelId = 'interior.stalk';
    const arm = new THREE.Mesh(cylG(0.32, 0.34, 4.8, 14), MT.black); arm.rotation.z = Math.PI / 2; arm.position.set(-3.1, 0.2, 0); s.add(arm);
    const knob = new THREE.Mesh(cylG(0.58, 0.58, 1.1, 18), MT.blackSoft); knob.rotation.z = Math.PI / 2; knob.position.set(-5.9, 0.2, 0); s.add(knob);
    const band = new THREE.Mesh(cylG(0.6, 0.6, 0.12, 18), MT.satin); band.rotation.z = Math.PI / 2; band.position.set(-5.2, 0.2, 0); s.add(band);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), MT.blackSoft); tip.position.set(-6.45, 0.2, 0); tip.scale.set(0.8, 1, 1); s.add(tip);
    s.position.set(0, 0.0, -2.2); s.rotation.z = -0.1; colFrame.add(s);
  }

  // ---------------- column shift lever with the Tow/Haul button ----------------
  const shifter = new THREE.Group(); shifter.name = 'shift_lever'; shifter.userData.labelId = 'interior.shifter';
  const leverPivot = new THREE.Group(); shifter.add(leverPivot);
  {
    const P = [[2.0, -0.4, -3.3], [4.4, -0.3, -2.9], [6.5, 1.2, -1.8]];
    leverPivot.add(new THREE.Mesh(tubeG(P, 0.3, 12, 10), MT.black));
    // handle: tapered, rounded capsule (graphite, IMG_2866)
    const h0 = new THREE.Vector3(6.2, 1.0, -1.9), h1 = new THREE.Vector3(8.3, 3.6, -0.5);
    const handleDir = h1.clone().sub(h0); const len = handleDir.length();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.52, len, 20, 1), MT.shiftHandle);
    handle.position.copy(h0.clone().add(h1).multiplyScalar(0.5)); handle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), handleDir.normalize());
    leverPivot.add(handle);
    const capA = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), MT.shiftHandle); capA.position.copy(h0); capA.quaternion.copy(handle.quaternion); leverPivot.add(capA);
    // the Tow/Haul button on the end of the lever
    const tow = new THREE.Group(); tow.name = 'tow_haul_button'; tow.userData.labelId = 'interior.towHaulButton';
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.32, 18), MT.blackSoft); tow.add(cap);
    const icon = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), new THREE.MeshBasicMaterial({ color: 0xb9b6ac, transparent: true, opacity: 0.0 })); icon.rotation.x = -Math.PI / 2; icon.position.y = 0.17; tow.add(icon);
    tow.position.copy(h1).addScaledVector(handleDir, 0.0); tow.quaternion.copy(handle.quaternion);
    tow.position.copy(h1).add(new THREE.Vector3(0, 0, 0)); leverPivot.add(tow);
    anchors.towHaulButton = tow; tow.userData._hit = true;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0.1, 0); tow.add(hit);
    // main lever hit
    const lhit = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, len + 1.2, 10), new THREE.MeshBasicMaterial({ visible: false })); lhit.position.copy(handle.position); lhit.quaternion.copy(handle.quaternion); leverPivot.add(lhit);
    anchors.shifter = shifter;
  }
  colFrame.add(shifter);

  // ---------------- ignition: lock cylinder on the right of the column, key with a bowtie head ----------------
  const ign = new THREE.Group(); ign.name = 'ignition'; ign.userData.labelId = 'interior.ignition';
  const lockBase = new THREE.Group(); lockBase.position.set(2.15, -1.0, -3.9); lockBase.rotation.y = Math.PI / 2 - 0.4; ign.add(lockBase);
  {
    const bez = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.6, 24), MT.graphite); bez.rotation.x = Math.PI / 2; lockBase.add(bez);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.05, 8, 28), MT.chrome); ring.position.z = 0.3; lockBase.add(ring);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 24), MT.chrome); cyl.rotation.x = Math.PI / 2; cyl.position.z = 0.2; lockBase.add(cyl);
    const slot = new THREE.Mesh(boxG(0.5, 0.07, 0.06), MT.black); slot.position.z = 0.36; lockBase.add(slot);
    // position legend: LOCK, ACC, RUN, START on a tiny canvas plate around the lock
    const legend = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#d8d6ce'; c.font = '700 22px Inter, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.translate(w / 2, h / 2); KEY_NAMES.forEach((n, i) => { const a = (-60 + i * 40) * Math.PI / 180; c.save(); c.rotate(a); c.fillText(n === 'ACCESSORY' ? 'ACC' : n, 0, -100); c.restore(); }); c.restore(); }, { aniso: 4 });
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: legend, transparent: true, depthWrite: false, opacity: 0.75 })); lg.position.z = 0.0; lg.visible = false; lockBase.add(lg);
  }
  const key = new THREE.Group(); key.name = 'ignition_key'; lockBase.add(key); key.position.z = 0.3;
  {
    const blade = new THREE.Mesh(boxG(0.32, 0.07, 1.15), MT.chrome); blade.position.set(0, 0, 0.7); key.add(blade);
    for (let i = 0; i < 6; i++) { const cut = new THREE.Mesh(boxG(0.09, 0.08, 0.1), MT.black); cut.position.set(0.17, 0, 0.35 + i * 0.16); key.add(cut); }
    const head = new THREE.Mesh(softBox({ w: 1.6, h: 0.3, d: 1.2, r: 0.14, step: 0.8 }), MT.black); head.position.set(0, 0.0, 1.9); key.add(head);
    const logoTex = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#c6a24b'; c.beginPath(); c.moveTo(14, 54); c.lineTo(50, 48); c.lineTo(56, 40); c.lineTo(72, 40); c.lineTo(78, 48); c.lineTo(114, 54); c.lineTo(114, 74); c.lineTo(78, 80); c.lineTo(72, 88); c.lineTo(56, 88); c.lineTo(50, 80); c.lineTo(14, 74); c.closePath(); c.fill(); }, { aniso: 4 });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false })); logo.rotation.x = -Math.PI / 2; logo.position.set(0, 0.17, 1.9); key.add(logo);
    const ringKey = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 16), MT.chrome); ringKey.position.set(0, 0, 2.7); key.add(ringKey);
  }
  colFrame.add(ign);
  anchors.ignition = ign;
  const hitI = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); hitI.position.copy(lockBase.position); hitI.position.x += 0.4; ign.add(hitI);
  anchors.ignitionKey = key;

  // key twist animation target (deg), eased in update
  const ignAnim = { cur: 0, target: 0 };
  const setKeyVisual = (pos) => { ignAnim.target = keyTwist(pos); };

  // ---------------- interactions ----------------
  const ctxArgs = (ctx) => ({ coolantF: (ctx.state?.coolantF ?? ctx.coolantF ?? 70), range: (ctx.state?.range ?? st.gear) });
  const getIg = (ctx) => (ctx && ctx.state && ctx.state.ignition) || env.ignition;
  const pressKey = (ctx) => {
    const ig = getIg(ctx); if (!ig) { ctx?.say?.('No ignition module attached.'); return; }
    const next = nextKeyPosition(ig.key, ig.engineRunning);
    if (next === KEY.START) {
      ig.setKey(KEY.START, ctxArgs(ctx)); setKeyVisual(ig.key);
      if (ig.key !== KEY.START) { ctx.say?.(ig.message || 'The engine will not crank.'); return; }
      // hold START until the engine fires, the starter times out, or the player releases (interact.release)
      st.startHeld = true; let t = 0;
      const fn = (dt) => { t += dt; setKeyVisual(ig.key); if (!st.startHeld || ig.engineRunning || !ig.cranking || t > 16) { ig.releaseStart(); setKeyVisual(ig.key); st.startHeld = false; return true; } return false; };
      if (ctx.animate) ctx.animate(fn); else { const iv = setInterval(() => { if (fn(0.05)) clearInterval(iv); }, 50); }
      return;
    }
    ig.setKey(next, ctxArgs(ctx)); setKeyVisual(ig.key);
    ctx.say?.(`Key: ${KEY_NAMES[ig.key]}`);
  };
  ign.userData.interact = {
    prompt: 'Turn key',
    run: pressKey,
    release(ctx) { st.startHeld = false; },
    get hint() { return KEY_NAMES[env.ignition ? env.ignition.key : 0]; },
  };
  hitI.userData.labelId = 'interior.ignition';

  // gear selector: E cycles P -> R -> N -> D -> P; or call interior.shift(gear)
  const setGear = (gear, ctx) => {
    if (!GEARS.includes(gear)) return;
    st.gear = gear; if (ctx && ctx.state) ctx.state.range = gear === '3' || gear === '2' || gear === '1' ? 'D' : gear;
    const idx = GEARS.indexOf(gear); env.leverTarget = (idx - 0) * 0.055;
  };
  env.setGear = setGear;
  shifter.userData.interact = { prompt: 'Shift gear (P R N D)', run(ctx) { setGear(cycleGear(st.gear), ctx); ctx.say?.(`Shifter: ${st.gear}`); } };
  // Tow/Haul: tap toggles Tow/Haul, press and hold (0.7 s) toggles overdrive disable. interact.press/release give the exact timing;
  // run() alone behaves as a tap.
  const tow = anchors.towHaulButton;
  const toggleTow = (ctx) => { st.towHaul = !st.towHaul; if (ctx?.state) ctx.state.towHaul = st.towHaul; ctx?.say?.(`Tow/Haul ${st.towHaul ? 'ON' : 'OFF'}`); };
  const toggleOd = (ctx) => { st.odOff = !st.odOff; if (ctx?.state) ctx.state.odOff = st.odOff; ctx?.say?.(`Overdrive ${st.odOff ? 'DISABLED (O/D OFF)' : 'enabled'}`); };
  let pressT = -1;
  tow.userData.interact = {
    prompt: 'Tow/Haul (tap) / Overdrive off (hold)', holdSeconds: 0.7,
    run: toggleTow,
    press(ctx) { pressT = performance.now(); },
    release(ctx) { const dt = (performance.now() - pressT) / 1000; pressT = -1; if (dt >= 0.7) toggleOd(ctx); else toggleTow(ctx); },
    hold: toggleOd,
  };
  env.toggleTow = toggleTow; env.toggleOd = toggleOd;

  B.build(colFrame, {});
  const update = (dt) => {
    ignAnim.cur += (ignAnim.target - ignAnim.cur) * (1 - Math.exp(-dt / 0.06));
    key.rotation.z = -THREE.MathUtils.degToRad(ignAnim.cur);
    key.position.y = 0;
    const lt = env.leverTarget || 0; leverPivot.rotation.z += (lt - leverPivot.rotation.z) * (1 - Math.exp(-dt / 0.08));
  };
  return { group: col, wheel, update, setKeyVisual };
}
