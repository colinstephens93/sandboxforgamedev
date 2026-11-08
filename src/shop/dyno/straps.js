// Four 2 in ratchet tie-down straps: flat webbing ribbons from a hook point on the truck to a floor D-ring.
// Attached: taut (draws a straight line between the points). Detached: lying on the floor as a flat coil beside the ring.
import * as THREE from 'three';
import { Batch, mx, cyl, mbox, composite, mesh, tubeThrough } from './util.js';
import { strapPoints, strapCurve, coilCurve, ribbonData, ribbonFrame, pointAt, sagFor, smoothstep, polylineLength, V } from './logic.js';

export const STRAP_WIDTH = 0.05;
export const STRAP_SEGMENTS = 40;
const BUCKLE_T = 0.8;           // buckle position along the strap, measured from the floor end
const ATTACH_SECONDS = 0.9;
const NAMES = ['Front driver', 'Front passenger', 'Rear driver', 'Rear passenger'];

function hookGeometry() {
  // flat-hook style: shank along +Z with a curl upward (+Y), eye block at the origin where the webbing loops through
  const pts = [[0, 0, 0.01], [0, 0, 0.045], [0, 0.002, 0.08], [0, 0.016, 0.106], [0, 0.04, 0.112], [0, 0.06, 0.098], [0, 0.064, 0.074], [0, 0.05, 0.058]];
  return tubeThrough(pts, 0.0055, { seg: 32, radial: 6, tension: 0.5 });
}

function dRingGeometry() {
  const pts = [];
  const r = 0.04;
  for (let i = 0; i <= 20; i++) { const a = Math.PI * (i / 20); pts.push([0, 0.0 + Math.sin(a) * r * 1.15, Math.cos(a) * r]); }
  for (let i = 1; i < 6; i++) pts.push([0, 0, r - (2 * r * i) / 6]);
  return tubeThrough(pts, 0.0065, { seg: 70, radial: 8, closed: true, tension: 0.5 });
}

function buckleMesh(M) {
  const parts = [];
  for (const ex of [-1, 1]) parts.push([mbox(0.003, 0.04, 0.115), 0, mx(ex * 0.0295, 0.016, 0)]);
  parts.push([mbox(0.062, 0.003, 0.115), 0, mx(0, -0.004, 0)]);
  parts.push([cyl(0.011, 0.058, 'x', 12), 0, mx(0, 0.012, 0.025)]);
  parts.push([cyl(0.011, 0.058, 'x', 12), 0, mx(0, 0.012, -0.03)]);
  for (const ex of [-1, 1]) parts.push([cyl(0.019, 0.005, 'x', 14), 1, mx(ex * 0.0345, 0.012, 0.025)]);
  parts.push([mbox(0.052, 0.006, 0.21), 0, mx(0, 0.037, -0.07)]);                     // handle (folded closed along the strap)
  parts.push([mbox(0.056, 0.018, 0.105), 2, mx(0, 0.043, -0.125)]);                   // rubber grip
  parts.push([mbox(0.05, 0.01, 0.025), 0, mx(0, 0.032, 0.055)]);                      // pawl
  return composite(parts, [M.zinc, M.steelDark, M.rubber], { cast: false });
}

function makeRibbon(n) {
  const g = new THREE.BufferGeometry();
  const vc = (n + 1) * 2;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vc * 2), 2));
  const pts = Array.from({ length: n + 1 }, (_, i) => [0, 0, i]);
  g.setIndex(ribbonData(pts, 1).indices);
  return g;
}
function fillRibbon(g, pts) {
  const d = ribbonData(pts, STRAP_WIDTH, 0.1);
  g.attributes.position.array.set(d.positions); g.attributes.normal.array.set(d.normals); g.attributes.uv.array.set(d.uvs);
  g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = true;
  g.computeBoundingSphere();
}

export function buildStraps(M) {
  const root = new THREE.Group(); root.name = 'dyno_straps';
  const { truck, floor } = strapPoints();
  const hookGeo = hookGeometry();
  const ringGeo = dRingGeometry();
  const items = [];
  const interactables = [];
  const live = { straps: [false, false, false, false] };

  for (let i = 0; i < 4; i++) {
    const A = truck[i];                                // truck-side hook point
    const F = floor[i];                                // floor anchor (y = 0)
    const dirH = V.nrm([A[0] - F[0], 0, A[2] - F[2]]);
    const yaw = Math.atan2(dirH[0], dirH[2]);
    const B = [F[0], 0.05, F[2]];                      // where the floor hook sits in the D-ring

    const g = new THREE.Group(); g.name = `strap_${i}`;
    g.userData.labelId = 'dyno.strap';
    g.userData.strapIndex = i;

    // floor anchor: recessed plate with a hinged D-ring
    const plate = new Batch();
    plate.add(mbox(0.15, 0.012, 0.15), M.steelRaw, mx(F[0], 0.0, F[2], 0, yaw, 0));
    for (const [bx, bz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) plate.add(cyl(0.009, 0.006, 'y', 6), M.zinc, mx(F[0] + (bx * Math.cos(yaw) + bz * Math.sin(yaw)) * 0.055, 0.008, F[2] + (-bx * Math.sin(yaw) + bz * Math.cos(yaw)) * 0.055));
    plate.add(mbox(0.05, 0.022, 0.04), M.steelDark, mx(F[0] - dirH[0] * 0.035, 0.015, F[2] - dirH[2] * 0.035, 0, yaw, 0));
    plate.build(g, { cast: false, name: 'anchor' });
    const ring = new THREE.Mesh(ringGeo, M.zinc);
    ring.position.set(F[0] + dirH[0] * 0.012, 0.03, F[2] + dirH[2] * 0.012); ring.rotation.set(0, yaw, 0);
    ring.rotateX(-0.55); ring.castShadow = true; g.add(ring);

    // webbing ribbon (index 0 at the floor, last at the truck)
    const ribbon = makeRibbon(STRAP_SEGMENTS);
    const web = new THREE.Mesh(ribbon, M.webbing); web.castShadow = true; web.receiveShadow = true; web.frustumCulled = false; g.add(web);
    const buckle = buckleMesh(M); buckle.frustumCulled = false; g.add(buckle);
    const hookFloor = new THREE.Mesh(hookGeo, M.zinc), hookTruck = new THREE.Mesh(hookGeo, M.zinc);
    hookFloor.castShadow = hookTruck.castShadow = true; g.add(hookFloor, hookTruck);
    // eye blocks where the webbing loops through each hook
    const eyeF = mesh(new THREE.BoxGeometry(0.052, 0.006, 0.018), M.zinc), eyeT = eyeF.clone();
    g.add(eyeF, eyeT);

    // the lying coil: near the ring, toward the truck
    const rOut = 0.25, center = [F[0] + dirH[0] * (rOut + 0.07), 0, F[2] + dirH[2] * (rOut + 0.07)];
    const coil = coilCurve(center, STRAP_SEGMENTS, rOut, 0.12, 2.1, Math.atan2(F[2] - center[2], F[0] - center[0]), 0.006);

    const item = { g, ribbon, web, buckle, hookFloor, hookTruck, eyeF, eyeT, A, B, F, coil, p: 0, lastE: -1, d: V.len(V.sub(A, B)), pts: null };
    items.push(item);

    // interaction
    g.userData.interact = {
      get prompt() { return live.straps[i] ? `Release strap (${NAMES[i]})` : `Attach strap (${NAMES[i]})`; },
      run(ctx) {
        const dy = ctx && ctx.state && ctx.state.dyno;
        if (!dy) return;
        dy.straps[i] = !dy.straps[i];
        if (ctx.say) ctx.say(dy.straps[i] ? `${NAMES[i]} strap hooked and ratcheted tight.` : `${NAMES[i]} strap released.`);
      },
    };
    interactables.push(g);
    root.add(g);
  }

  const q = new THREE.Quaternion(), mat4 = new THREE.Matrix4(), vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3();
  function place(obj, pos, frame, flip = 1, lift = 0) {
    // local axes: x = width, y = normal, z = tangent (flip reverses z and x so the part points the other way)
    // (-w, n, t) is right-handed because w x n = -t
    vx.set(...frame.w).multiplyScalar(-flip); vy.set(...frame.n); vz.set(...frame.t).multiplyScalar(flip);
    mat4.makeBasis(vx, vy, vz); q.setFromRotationMatrix(mat4);
    obj.quaternion.copy(q);
    obj.position.set(pos[0] + frame.n[0] * lift, pos[1] + frame.n[1] * lift, pos[2] + frame.n[2] * lift);
  }

  function pose(it, e) {
    const N = STRAP_SEGMENTS;
    const sag = e >= 1 ? 0.004 : 0.004 + (1 - e) * 0.06;
    const taut = strapCurve(it.B, it.A, N, sag, 0.006);
    const lift = Math.sin(Math.PI * e) * 0.3;
    const pts = taut.map((p, k) => {
      const c = it.coil[k];
      const u = Math.min(1, e * 1.0);
      const out = V.lerp3(c, p, u);
      // the strap is lifted as it is carried to the truck
      out[1] += lift * Math.sin(Math.PI * k / N) * 0.8;
      if (out[1] < 0.006) out[1] = 0.006;
      return out;
    });
    fillRibbon(it.ribbon, pts);
    it.pts = pts;
    // buckle
    const bp = pointAt(pts, BUCKLE_T);
    const fb = ribbonFrame(bp.tangent);
    it.buckle.visible = true;
    place(it.buckle, bp.p, fb, 1, 0.004);
    // hooks at both ends, pointing outward along the webbing
    const p0 = pts[0], p1 = pts[N];
    const f0 = ribbonFrame(V.sub(pts[0], pts[1])), f1 = ribbonFrame(V.sub(pts[N], pts[N - 1]));
    place(it.hookFloor, p0, f0, 1, 0.002); place(it.hookTruck, p1, f1, 1, 0.002);
    place(it.eyeF, V.add(p0, V.mul(f0.t, 0.004)), f0, 1, 0.003); place(it.eyeT, V.add(p1, V.mul(f1.t, 0.004)), f1, 1, 0.003);
  }

  function update(dt, st) {
    const want = (st && st.straps) || [false, false, false, false];
    for (let i = 0; i < 4; i++) {
      const it = items[i];
      live.straps[i] = !!want[i];
      const target = want[i] ? 1 : 0;
      if (it.p !== target) it.p += Math.sign(target - it.p) * Math.min(Math.abs(target - it.p), dt / ATTACH_SECONDS);
      const e = smoothstep(it.p);
      if (Math.abs(e - it.lastE) > 1e-4) { it.lastE = e; pose(it, e); }
    }
  }
  // initial pose (lying)
  items.forEach((it) => { pose(it, 0); it.lastE = 0; });

  // expose for tests/integration
  return { group: root, update, interactables, anchors: { strapTruckPoints: truck, strapFloorPoints: floor }, items };
}
