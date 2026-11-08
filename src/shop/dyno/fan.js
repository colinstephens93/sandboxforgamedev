// High-velocity cooling fan: 48 in industrial fan on a wheeled H-frame, cage guards, six twisted aluminium blades.
import * as THREE from 'three';
import { aabb } from '../../core/geom.js';
import { makeCanvas } from '../../core/proc.js';
import { Batch, mx, cyl, mbox, composite, instanced, mesh } from './util.js';
import { DYNO } from '../layout.js';

export const FAN_DIAMETER = 48 * 0.0254;   // 48 in
export const FAN_POS = { x: 0, y: 0.75, z: DYNO.truckOrigin.z - 1.6 };
const R = FAN_DIAMETER / 2;                  // 0.6096
export const FAN_FULL_SPEED = 52;           // rad/s shown (about 500 rpm; the blur disc takes over visually)

function bladeGeometry(rIn, rOut, sections = 14) {
  const pts = 9; // profile points per section (closed loop)
  const pos = [], idx = [];
  for (let s = 0; s <= sections; s++) {
    const u = s / sections, r = rIn + (rOut - rIn) * u;
    const chord = 0.13 + 0.12 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.62) - 0.03 * u * u;
    const twist = (42 - 24 * u) * Math.PI / 180;      // pitch from the plane of rotation, higher at the root
    const th = chord * 0.07 * (1 - 0.5 * u);
    for (let k = 0; k < pts; k++) {
      const a = (k / pts) * Math.PI * 2;
      // lens-shaped section: x along the chord, y thickness, slight camber
      const x = Math.cos(a) * chord / 2, y = Math.sin(a) * th * (1 - Math.abs(Math.cos(a)) * 0.0) + 0.02 * chord * (1 - (2 * x / chord) ** 2);
      const px = x * Math.cos(twist) - y * Math.sin(twist), pz = x * Math.sin(twist) + y * Math.cos(twist);
      pos.push(px, r, pz);
    }
  }
  for (let s = 0; s < sections; s++) for (let k = 0; k < pts; k++) {
    const a = s * pts + k, b = s * pts + ((k + 1) % pts), c = (s + 1) * pts + k, d = (s + 1) * pts + ((k + 1) % pts);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function blurTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  gr.addColorStop(0, 'rgba(170,175,180,0.55)'); gr.addColorStop(0.6, 'rgba(150,155,160,0.4)'); gr.addColorStop(0.93, 'rgba(140,145,150,0.25)'); gr.addColorStop(1, 'rgba(140,145,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildFan(M) {
  const root = new THREE.Group(); root.name = 'dyno_fan';
  root.userData.labelId = 'dyno.fan';
  root.position.set(FAN_POS.x, 0, FAN_POS.z);
  const live = { fan: false };
  const paint = new THREE.MeshStandardMaterial({ color: 0x1f4f86, metalness: 0.35, roughness: 0.42, envMapIntensity: 0.9, side: THREE.DoubleSide });
  const blade = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.95, roughness: 0.28, envMapIntensity: 1.3, side: THREE.DoubleSide });
  const B = new Batch();
  const cy = FAN_POS.y;

  // ---------------- wheeled H-frame stand ----------------
  const ux = R + 0.1; // uprights beside the housing
  for (const s of [-1, 1]) {
    B.add(mbox(0.08, 0.08, 1.15), M.steelDark, mx(s * ux, 0.12, 0));                      // skid
    B.add(mbox(0.07, cy - 0.08, 0.07), M.steelDark, mx(s * ux, 0.08 + (cy - 0.08) / 2, 0)); // upright
    B.add(cyl(0.06, 0.07, 'x', 12), M.safetyYellow, mx(s * (ux - 0.1), cy, 0));            // trunnion boss
    // diagonal braces
    const bl = Math.hypot(0.5, 0.55), ang = Math.atan2(0.5, 0.55);
    B.add(mbox(0.04, 0.04, bl), M.steelDark, mx(s * ux, 0.4, 0.36, ang * 0 - 0.8, 0, 0));
    B.add(mbox(0.04, 0.04, bl), M.steelDark, mx(s * ux, 0.4, -0.36, 0.8, 0, 0));
    // casters: fork + wheel
    for (const z of [-0.5, 0.5]) {
      B.add(mbox(0.1, 0.012, 0.1), M.steelRaw, mx(s * ux, 0.074, z));
      B.add(mbox(0.012, 0.09, 0.08), M.steelRaw, mx(s * ux - 0.035, 0.03, z)); B.add(mbox(0.012, 0.09, 0.08), M.steelRaw, mx(s * ux + 0.035, 0.03, z));
      B.add(cyl(0.05, 0.05, 'x', 18), M.rubber, mx(s * ux, 0.05, z));
      B.add(cyl(0.028, 0.052, 'x', 12), M.steelMachined, mx(s * ux, 0.05, z));
    }
  }
  B.add(mbox(2 * ux, 0.06, 0.06), M.steelDark, mx(0, 0.14, 0.52));                      // cross tubes
  B.add(mbox(2 * ux, 0.06, 0.06), M.steelDark, mx(0, 0.14, -0.52));
  // push handle at the back
  B.add(cyl(0.016, 2 * ux - 0.1, 'x', 10), M.zinc, mx(0, 0.82, -0.58));
  for (const s of [-1, 1]) B.add(cyl(0.016, 0.8, 'y', 10), M.zinc, mx(s * (ux - 0.05), 0.5, -0.58));
  B.add(cyl(0.016, 0.34, 'z', 10), M.zinc, mx((ux - 0.05), 0.82, -0.41));
  B.add(cyl(0.016, 0.34, 'z', 10), M.zinc, mx(-(ux - 0.05), 0.82, -0.41));

  // ---------------- housing ----------------
  const prof = [[0.63, -0.17], [0.665, -0.17], [0.665, 0.14], [0.69, 0.18], [0.63, 0.18], [0.63, -0.17]].map(([r, z]) => new THREE.Vector2(r, z));
  const housingGeo = new THREE.LatheGeometry(prof, 72); housingGeo.rotateX(Math.PI / 2);
  const housing = new THREE.Mesh(housingGeo, paint); housing.position.y = cy; housing.castShadow = true; housing.receiveShadow = true; root.add(housing);
  // motor, spider struts
  const motor = new THREE.Group(); motor.position.set(0, cy, 0); root.add(motor);
  B.add(cyl(0.15, 0.34, 'z', 28), paint, mx(0, cy, -0.19));
  B.add(cyl(0.16, 0.02, 'z', 28), M.steelDark, mx(0, cy, -0.015));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; B.add(mbox(0.03, 0.5, 0.025), M.steelDark, mx(Math.cos(a) * 0.38, cy + Math.sin(a) * 0.38, -0.15, 0, 0, a - Math.PI / 2)); }
  // terminal box on the motor
  B.add(mbox(0.14, 0.09, 0.12), M.steelDark, mx(0, cy + 0.19, -0.22));

  // ---------------- cage guards ----------------
  const zf = 0.2, dome = 0.07;
  const rings = [0.12, 0.25, 0.38, 0.5, 0.62];
  const zAt = (r, s) => s * (zf + dome * (1 - (r / 0.64) ** 2) * (s > 0 ? 1 : 0.35));
  for (const s of [1, -1]) {
    for (const r of rings) B.add(new THREE.TorusGeometry(r, 0.0045, 6, 64), M.zinc, mx(0, cy, zAt(r, s)));
    B.add(new THREE.TorusGeometry(0.645, 0.008, 8, 72), M.zinc, mx(0, cy, s * 0.2));
  }
  const spokes = [];
  const up = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion(), tmp = new THREE.Vector3();
  for (const s of [1, -1]) for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    const r0 = 0.07, r1 = 0.645, z0 = zAt(r0, s), z1 = zAt(r1, s);
    const mid = new THREE.Vector3(Math.cos(a) * (r0 + r1) / 2, Math.sin(a) * (r0 + r1) / 2, (z0 + z1) / 2);
    tmp.set(Math.cos(a) * (r1 - r0), Math.sin(a) * (r1 - r0), z1 - z0);
    const l = tmp.length(); qa.setFromUnitVectors(up, tmp.normalize());
    spokes.push(new THREE.Matrix4().compose(new THREE.Vector3(mid.x, cy + mid.y, mid.z), qa, new THREE.Vector3(1, l, 1)));
  }
  const spokeMesh = instanced(new THREE.CylinderGeometry(0.0038, 0.0038, 1, 5), M.zinc, spokes);
  root.add(spokeMesh);
  // centre badge of the front guard
  B.add(cyl(0.075, 0.012, 'z', 24), M.safetyYellow, mx(0, cy, zAt(0.0, 1) + 0.002));
  // guard mounting brackets to the housing
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; B.add(mbox(0.03, 0.04, 0.4), M.zinc, mx(Math.cos(a) * 0.645, cy + Math.sin(a) * 0.645, 0, 0, 0, a)); }

  // ---------------- control box and power cord ----------------
  const sbX = -ux, sbY = 0.5;
  B.add(mbox(0.16, 0.2, 0.09), M.plasticGrey, mx(sbX - 0.085, sbY, 0.1));
  B.add(mbox(0.06, 0.04, 0.01), M.safetyRed, mx(sbX - 0.085, sbY + 0.04, 0.152));
  B.add(mbox(0.06, 0.04, 0.01), M.plasticBlack, mx(sbX - 0.085, sbY - 0.04, 0.152));
  const cordPts = [[0, cy - 0.1, -0.35], [0, 0.35, -0.5], [0.05, 0.15, -0.8], [0.4, 0.02, -1.2], [1.1, 0.012, -1.6], [2.2, 0.012, -1.7]].map((p) => new THREE.Vector3(...p));
  const cord = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 50, 0.012, 6);
  root.add(mesh(cord, M.cable));
  // floor outlet box where the cord ends
  B.add(mbox(0.16, 0.035, 0.12), M.steelDark, mx(2.28, 0.0175, -1.72));
  B.add(mbox(0.1, 0.012, 0.07), M.zinc, mx(2.28, 0.038, -1.72));
  B.add(mbox(0.04, 0.03, 0.05), M.plasticBlack, mx(2.2, 0.025, -1.72));

  B.build(root, { cast: true, name: 'fanstatic' });

  // ---------------- rotor ----------------
  const rotor = new THREE.Group(); rotor.position.set(0, cy, 0.0); root.add(rotor);
  {
    const bg = bladeGeometry(0.085, R - 0.012);
    const parts = [];
    for (let k = 0; k < 6; k++) parts.push([bg, 0, mx(0, 0, 0, 0, 0, (k / 6) * Math.PI * 2)]);
    parts.push([cyl(0.1, 0.12, 'z', 24), 1, mx(0, 0, 0.0)]);
    parts.push([new THREE.ConeGeometry(0.1, 0.12, 24).rotateX(Math.PI / 2), 1, mx(0, 0, 0.12)]);
    const m = composite(parts, [blade, M.steelDark], { cast: true });
    rotor.add(m);
  }
  // motion-blur disc: fades in with speed
  const blurMat = new THREE.MeshBasicMaterial({ map: blurTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const blur = new THREE.Mesh(new THREE.CircleGeometry(R - 0.005, 48), blurMat); blur.position.set(0, cy, 0.03); blur.renderOrder = 2; root.add(blur);

  // ---------------- interaction ----------------
  root.userData.interact = {
    get prompt() { return live.fan ? 'Turn fan off' : 'Turn fan on'; },
    run(ctx) {
      const dy = ctx && ctx.state && ctx.state.dyno;
      if (!dy) return;
      const next = !dy.fan;
      if (typeof dy.setFan === 'function') dy.setFan(next); else dy.fan = next;
      if (ctx.say) ctx.say(next ? 'Dyno cooling fan on.' : 'Dyno cooling fan off.');
    },
  };

  const colliders = [aabb(FAN_POS.x, 0.75, FAN_POS.z, ux + 0.1, 0.75, 0.6)];
  const state = { omega: 0, angle: 0 };
  function update(dt, on) {
    live.fan = !!on;
    const target = on ? FAN_FULL_SPEED : 0;
    state.omega += (target - state.omega) * (1 - Math.exp(-dt / (on ? 1.6 : 4.5)));
    if (state.omega < 0.02 && !on) state.omega = 0;
    state.angle = (state.angle - state.omega * dt) % (Math.PI * 2); // blows toward +Z: turns clockwise seen from the front
    rotor.rotation.z = state.angle;
    blurMat.opacity = Math.min(0.85, Math.max(0, (state.omega - 12) / 36));
  }
  return { group: root, update, colliders, state };
}
