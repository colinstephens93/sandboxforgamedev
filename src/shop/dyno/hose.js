// Exhaust extraction: overhead spring-return hose reel hung from the roof frame, 4 in corrugated hose and a rubber
// adapter cone that slips over the tailpipe. Connect/disconnect animates the hose between the tailpipe and the reel.
import * as THREE from 'three';
import { Batch, mx, cyl, mbox, instanced, mesh, CorrugatedTube } from './util.js';
import { HOSE, hoseControls, smoothstep, V } from './logic.js';
import { SHOP } from '../layout.js';

const CONNECT_SECONDS = 1.5;
// rafter underside height at a given z (portal frame rafters in src/shop/shell.js slope down toward the eave)
function rafterUnder(z) {
  const hz = SHOP.halfZ, slope = Math.atan2(SHOP.ridge - SHOP.eave, hz);
  return (SHOP.eave + SHOP.ridge) / 2 - 0.2 - (Math.abs(z) - hz / 2) * Math.tan(slope) - 0.17;
}

export function buildHose(M) {
  const root = new THREE.Group(); root.name = 'dyno_hose';
  root.userData.labelId = 'dyno.hose';
  const live = { on: false };
  const reel = HOSE.reel;
  const B = new Batch();

  // ---------------- hanger rods, frame, reel ----------------
  const zs = [reel[2] - 0.34, reel[2] + 0.34];
  const frameY = reel[1] + 0.58;
  for (const z of zs) {
    const yTop = rafterUnder(z);
    B.add(cyl(0.011, yTop - frameY, 'y', 8), M.zinc, mx(reel[0], (yTop + frameY) / 2, z));
    B.add(mbox(0.14, 0.012, 0.1), M.steelDark, mx(reel[0], yTop - 0.006, z));                    // plate against the rafter flange
    B.add(cyl(0.02, 0.02, 'y', 8), M.zinc, mx(reel[0], frameY + 0.03, z));                       // nut
  }
  B.add(mbox(0.09, 0.07, 0.86), M.safetyYellow, mx(reel[0], frameY, reel[2]));                   // beam the reel hangs from
  for (const sx of [-1, 1]) {
    B.add(mbox(0.012, frameY - reel[1] + 0.02, 0.14), M.steelDark, mx(reel[0] + sx * 0.235, (frameY + reel[1]) / 2, reel[2]));  // side plates
    B.add(cyl(0.38, 0.012, 'x', 36), M.safetyYellow, mx(reel[0] + sx * 0.2, reel[1], reel[2]));  // reel flanges
    B.add(cyl(0.05, 0.05, 'x', 16), M.castGrey, mx(reel[0] + sx * 0.255, reel[1], reel[2]));     // bearings
  }
  B.add(cyl(0.2, 0.4, 'x', 28), M.steelDark, mx(reel[0], reel[1], reel[2]));                      // drum core
  B.add(cyl(0.17, 0.12, 'x', 24), M.castBlue, mx(reel[0] + 0.32, reel[1], reel[2]));              // spring motor housing
  B.add(cyl(0.028, 0.18, 'x', 12), M.zinc, mx(reel[0], reel[1], reel[2]));                         // axle
  // hose wound on the drum: rings around the X axis, two layers
  const c1 = [], c2 = [];
  for (let k = 0; k < 3; k++) c1.push(mx(reel[0] + (k - 1) * 0.1, reel[1], reel[2], 0, Math.PI / 2, 0));
  for (let k = 0; k < 2; k++) c2.push(mx(reel[0] + (k - 0.5) * 0.1, reel[1], reel[2], 0, Math.PI / 2, 0));
  root.add(instanced(new THREE.TorusGeometry(0.25, 0.05, 10, 40), M.hoseMat, c1, { cast: true }));
  root.add(instanced(new THREE.TorusGeometry(0.3, 0.05, 10, 44), M.hoseMat, c2, { cast: true }));
  // hose guide ring at the bottom of the frame
  const P0 = [reel[0], reel[1] - 0.4, reel[2]];
  B.add(new THREE.TorusGeometry(0.075, 0.012, 8, 28).rotateX(Math.PI / 2), M.steelDark, mx(P0[0], P0[1] - 0.04, P0[2]));
  B.add(mbox(0.02, 0.06, 0.18), M.steelDark, mx(P0[0], P0[1] - 0.01, P0[2]));
  B.build(root, { cast: true, name: 'reel' });

  // ---------------- hose ----------------
  const tube = new CorrugatedTube(720, 14, HOSE.radius, 190, 0.075);
  const hose = new THREE.Mesh(tube.geometry, M.hoseMat);
  hose.castShadow = true; hose.receiveShadow = true; hose.frustumCulled = false; root.add(hose);

  // ---------------- adapter cone ----------------
  const cone = new THREE.Group(); cone.name = 'exhaust_cone'; root.add(cone);
  {
    const prof = [[0.083, 0.0], [0.08, 0.012], [0.07, 0.05], [0.056, 0.12], [0.0535, 0.2], [0.0535, HOSE.coneLen - 0.01], [0.0505, HOSE.coneLen]].map(([r, z]) => new THREE.Vector2(r, z));
    const g = new THREE.LatheGeometry(prof, 36); g.rotateX(Math.PI / 2);
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.8, side: THREE.DoubleSide, envMapIntensity: 0.5 });
    const shell = new THREE.Mesh(g, rubber); shell.castShadow = true; cone.add(shell);
    cone.add(mesh(new THREE.TorusGeometry(0.0835, 0.006, 8, 36), M.rubber, 0, 0, 0.0));                         // rolled lip
    cone.add(mesh(new THREE.TorusGeometry(0.0575, 0.006, 8, 28), M.zinc, 0, 0, HOSE.coneLen - 0.035));           // hose clamp
    cone.add(mesh(new THREE.BoxGeometry(0.025, 0.014, 0.014), M.zinc, 0, 0.065, HOSE.coneLen - 0.035));          // clamp screw housing
  }

  // ---------------- animation ----------------
  const mouthC = [HOSE.tailpipe[0], HOSE.tailpipe[1], HOSE.tailpipe[2] - 0.03], arriveC = [0, 0, 1];
  const mouthD = [reel[0] + 0.12, reel[1] - 1.7, reel[2] - 0.15], arriveD = [0, 1, 0];
  const state = { p: 0, lastE: -1 };
  const zAxis = new THREE.Vector3(0, 0, 1);
  function pose(e) {
    const mouth = V.lerp3(mouthD, mouthC, e);
    const arrive = V.nrm(V.lerp3(arriveD, arriveC, e));
    const drop = 1.1 + 0.5 * e, reach = 0.5 + 0.5 * e;
    const [a, b, c, d] = hoseControls(P0, mouth, arrive, HOSE.coneLen, drop, reach).map((p) => new THREE.Vector3(...p));
    tube.fit(new THREE.CubicBezierCurve3(a, b, c, d));
    cone.position.set(...mouth);
    cone.quaternion.setFromUnitVectors(zAxis, new THREE.Vector3(...arrive));
  }
  pose(0); state.lastE = 0;

  root.userData.interact = {
    get prompt() { return live.on ? 'Disconnect exhaust hose' : 'Connect exhaust hose'; },
    run(ctx) {
      const dy = ctx && ctx.state && ctx.state.dyno;
      if (!dy) return;
      dy.hoseOn = !dy.hoseOn;
      if (ctx.say) ctx.say(dy.hoseOn ? 'Exhaust hose connected to the tailpipe.' : 'Exhaust hose released and retracted.');
    },
  };

  function update(dt, on) {
    live.on = !!on;
    const target = on ? 1 : 0;
    if (state.p !== target) state.p += Math.sign(target - state.p) * Math.min(Math.abs(target - state.p), dt / CONNECT_SECONDS);
    const e = smoothstep(state.p);
    if (Math.abs(e - state.lastE) > 1e-4) { state.lastE = e; pose(e); }
  }
  return { group: root, update, state };
}
