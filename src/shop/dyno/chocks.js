// Rubber wheel chocks in front of the front tires (placed), or lying beside them (stowed) when removed.
import * as THREE from 'three';
import { Batch, mx, cyl, mbox, composite } from './util.js';
import { FRONT_TRACK_WHEELS_X, FRONT_AXLE_Z } from './logic.js';

const W = 0.2; // chock width
// profile (distance ahead of the axle, height): sloped face tangent to the tire, tall flat top, steep back
const PROFILE = [[0.14, 0], [0.33, 0.16], [0.375, 0.16], [0.425, 0]];

function chockGeometry(M) {
  const s = new THREE.Shape();
  s.moveTo(PROFILE[0][0], PROFILE[0][1]);
  for (let i = 1; i < PROFILE.length; i++) s.lineTo(PROFILE[i][0], PROFILE[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: W - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(W - 0.02) / 2);
  g.rotateY(Math.PI / 2); // shape x -> -Z (forward), extrusion -> X
  const parts = [[g, 0, null]];
  // raised ribs on the sloped face
  const a = Math.atan2(0.16, 0.19), nz = Math.cos(a) * 0, ny = Math.cos(a), nzz = Math.sin(a);
  for (const f of [0.18, 0.34, 0.5, 0.66, 0.82]) {
    const d = 0.14 + 0.19 * f, h = 0.16 * f;
    parts.push([new THREE.BoxGeometry(W - 0.035, 0.005, 0.012), 0, mx(0, h + ny * 0.003, -d + nzz * 0.003, a, 0, 0)]);
  }
  // steel eye bolted to the back face as a handle
  parts.push([new THREE.TorusGeometry(0.03, 0.005, 6, 18).rotateY(Math.PI / 2), 1, mx(0, 0.105, -0.402, 0, 0, 0)]);
  parts.push([cyl(0.012, 0.012, 'z', 8), 1, mx(0, 0.105, -0.395)]);
  return composite(parts, [M.chockUrethane, M.zinc], { cast: true });
}

export function buildChocks(M) {
  const root = new THREE.Group(); root.name = 'dyno_chocks'; root.userData.labelId = 'dyno.chocks';
  const live = { chocks: true };
  const placed = new THREE.Group(), stowed = new THREE.Group();
  placed.name = 'chocks_placed'; stowed.name = 'chocks_stowed';
  const x = FRONT_TRACK_WHEELS_X;
  for (const sx of [-1, 1]) {
    const a = chockGeometry(M); a.position.set(sx * x, 0, FRONT_AXLE_Z); placed.add(a);
    // stowed: on the floor beside the fan cart, turned around
    const b = chockGeometry(M); b.position.set(sx * 1.55, 0, FRONT_AXLE_Z - 0.9); b.rotation.y = sx * 0.5 + Math.PI / 2; stowed.add(b);
  }
  const mkInteract = (word) => ({
    get prompt() { return live.chocks ? 'Remove wheel chocks' : 'Place wheel chocks'; },
    run(ctx) {
      const dy = ctx && ctx.state && ctx.state.dyno;
      if (!dy) return;
      dy.chocks = !dy.chocks;
      if (ctx.say) ctx.say(dy.chocks ? 'Front wheels chocked.' : 'Wheel chocks removed.');
    },
  });
  for (const o of [placed, stowed]) { o.userData.labelId = 'dyno.chocks'; o.userData.interact = mkInteract(); }
  root.add(placed, stowed);
  function update(on) {
    live.chocks = on !== false;
    placed.visible = live.chocks;
    stowed.visible = !live.chocks;
  }
  update(true);
  return { group: root, update, placed, stowed, interactables: [placed, stowed] };
}
