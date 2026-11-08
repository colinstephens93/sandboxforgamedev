// In-ground chassis dyno mechanics: four knurled 24 in drums (two per rear tire), pillow-block bearings and frame,
// the eddy-current absorber with torque arm and load cell, the inertia flywheel, couplings, chain guard and air duct.
import * as THREE from 'three';
import { Batch, mx, cyl, mbox, instanced, mesh, CorrugatedTube } from './util.js';
import { PIT, rollerLayout, ROLLER_R, ROLLER_LEN, advanceAngle } from './logic.js';

const { depth, cz, hl } = PIT;

export function buildRollers(M, quality) {
  const L = rollerLayout();
  const { cy, zFront: zF, zRear: zR } = L;
  const root = new THREE.Group(); root.name = 'dyno_mechanics';
  const assembly = new THREE.Group(); assembly.name = 'rollers'; assembly.userData.labelId = 'dyno.rollers'; root.add(assembly);
  const absorber = new THREE.Group(); absorber.name = 'absorber'; absorber.userData.labelId = 'dyno.absorber'; root.add(absorber);
  const B = new Batch(), BA = new Batch();
  const floorY = -depth;
  const drums = []; // rotating groups
  const spinners = []; // other parts that turn with the rollers

  // ---------------- frame: beams on the pit floor, cross members ----------------
  const beamTop = floorY + 0.14;
  for (const z of [zF, zR]) {
    B.add(mbox(3.06, 0.14, 0.2), M.steelDark, mx(0, floorY + 0.07, z));
    B.add(mbox(3.0, 0.014, 0.24), M.steelRaw, mx(0, floorY + 0.007, z));
  }
  for (const x of [-1.38, -0.345, 0.345, 1.38]) B.add(mbox(0.14, 0.12, zR - zF + 0.24), M.steelDark, mx(x, floorY + 0.06, cz));

  // ---------------- shafts, pillow blocks, pedestals ----------------
  const blockXs = [-1.38, -0.345, 0.345, 1.38];
  for (const z of [zF, zR]) {
    B.add(cyl(0.045, 3.12, 'x', 20), M.steelMachined, mx(0, cy, z));
    for (const x of blockXs) {
      const topY = cy - 0.082; // underside of the pillow block base
      const h = topY - beamTop;
      B.add(mbox(0.12, h, 0.16), M.steelDark, mx(x, beamTop + h / 2, z));
      B.add(mbox(0.2, 0.012, 0.2), M.steelRaw, mx(x, beamTop + 0.006, z));              // base plate
      for (const gx of [-1, 1]) for (const gz of [-1, 1]) B.add(cyl(0.009, 0.014, 'y', 6), M.zinc, mx(x + gx * 0.08, beamTop + 0.019, z + gz * 0.08));
      // UCP style pillow block
      B.add(mbox(0.065, 0.026, 0.2), M.castGrey, mx(x, topY + 0.013, z));                // foot
      B.add(mbox(0.065, 0.1, 0.1), M.castGrey, mx(x, topY + 0.07, z));                   // body
      B.add(cyl(0.062, 0.065, 'x', 20), M.castGrey, mx(x, cy, z));                       // bearing housing
      B.add(cyl(0.05, 0.08, 'x', 16), M.steelMachined, mx(x + Math.sign(x) * 0.002, cy, z)); // inner ring / locking collar
      B.add(cyl(0.007, 0.03, 'y', 6), M.zinc, mx(x, cy + 0.075, z));                      // grease nipple
      for (const gz of [-1, 1]) B.add(cyl(0.011, 0.02, 'y', 6), M.zinc, mx(x, topY + 0.036, z + gz * 0.085)); // foot bolts
    }
  }

  // ---------------- roller drums ----------------
  const shellGeo = cyl(ROLLER_R, ROLLER_LEN - 0.01, 'x', 96);
  const boltGeo = cyl(0.012, 0.012, 'x', 8);
  for (const sx of L.setX) for (const z of [zF, zR]) {
    const g = new THREE.Group(); g.position.set(sx, cy, z); g.name = 'roller_drum';
    const shell = new THREE.Mesh(shellGeo, M.roller); shell.castShadow = true; shell.receiveShadow = true; g.add(shell);
    // end plates, hubs and bolt circles
    for (const e of [-1, 1]) {
      g.add(mesh(cyl(0.292, 0.012, 'x', 48), M.steelMachined, e * (ROLLER_LEN / 2 - 0.004), 0, 0, { cast: false }));
      g.add(mesh(cyl(0.085, 0.03, 'x', 24), M.steelDark, e * (ROLLER_LEN / 2 + 0.006), 0, 0));
      const bm = [];
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; bm.push(mx(e * (ROLLER_LEN / 2 + 0.004), Math.cos(a) * 0.2, Math.sin(a) * 0.2)); }
      g.add(instanced(boltGeo, M.zinc, bm));
      // end plate dust ring
    }
    // paint stripes (white) across the drum, two sides
    for (const s of [1, -1]) g.add(mesh(new THREE.BoxGeometry(ROLLER_LEN - 0.06, 0.003, 0.034), M.paintWhite, 0, s * (ROLLER_R + 0.0006), 0));
    assembly.add(g); drums.push(g);
  }

  // ---------------- coupling hubs and guards (shaft line between the sets) ----------------
  for (const z of [zF, zR]) for (const s of [-1, 1]) {
    B.add(cyl(0.085, 0.04, 'x', 20), M.safetyYellow, mx(s * 0.296, cy, z));
    B.add(cyl(0.087, 0.006, 'x', 20), M.plasticBlack, mx(s * 0.296, cy, z));
  }

  // ---------------- eddy-current absorber on the front line ----------------
  {
    const x0 = 0, z = zF;
    BA.add(cyl(0.225, 0.4, 'x', 56), M.castBlue, mx(x0, cy, z));
    BA.add(cyl(0.238, 0.03, 'x', 56), M.castBlue, mx(x0 - 0.2, cy, z));
    BA.add(cyl(0.238, 0.03, 'x', 56), M.castBlue, mx(x0 + 0.2, cy, z));
    for (const e of [-1, 1]) {
      BA.add(cyl(0.075, 0.05, 'x', 20), M.castGrey, mx(e * 0.24, cy, z));
      BA.add(cyl(0.05, 0.02, 'x', 16), M.steelMachined, mx(e * 0.268, cy, z));
    }
    const ringM = [];
    for (let i = -5; i <= 5; i++) ringM.push(mx(i * 0.032, cy, z));
    const fins = instanced(cyl(0.256, 0.007, 'x', 56), M.castBlue, ringM, { cast: true });
    absorber.add(fins);
    const bm = [];
    for (const e of [-1, 1]) for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; bm.push(mx(e * 0.2, cy + Math.cos(a) * 0.215, z + Math.sin(a) * 0.215, 0, 0, 0)); }
    absorber.add(instanced(cyl(0.0095, 0.045, 'x', 6), M.zinc, bm));
    // terminal box and nameplate on top, trunnion cradle feet
    BA.add(mbox(0.15, 0.09, 0.12), M.plasticGrey, mx(0.06, cy + 0.27, z));
    BA.add(mbox(0.13, 0.008, 0.1), M.paintWhite, mx(0.06, cy + 0.318, z));
    BA.add(cyl(0.011, 0.04, 'x', 8), M.plasticBlack, mx(0.16, cy + 0.27, z));
    BA.add(mbox(0.2, 0.004, 0.012), M.steelMachined, mx(-0.06, cy + 0.222, z - 0.0));
    for (const e of [-1, 1]) { BA.add(mbox(0.02, 0.08, 0.3), M.castGrey, mx(e * 0.265, cy - 0.2, z)); BA.add(mbox(0.02, 0.012, 0.36), M.steelDark, mx(e * 0.265, cy - 0.3, z)); }
    // torque arm and load cell
    const armY = cy - 0.17;
    BA.add(mbox(0.06, 0.028, 0.46), M.steelRaw, mx(0, armY, z - 0.32));
    BA.add(mbox(0.09, 0.07, 0.07), M.steelDark, mx(0, armY, z - 0.14));
    const cellTop = armY - 0.014;
    BA.add(cyl(0.008, 0.04, 'y', 8), M.zinc, mx(0, cellTop - 0.02, z - 0.5));
    BA.add(cyl(0.02, 0.1, 'y', 14), M.loadCell, mx(0, cellTop - 0.09, z - 0.5));
    BA.add(cyl(0.008, 0.04, 'y', 8), M.zinc, mx(0, cellTop - 0.16, z - 0.5));
    const postTop = cellTop - 0.2;
    BA.add(mbox(0.08, postTop - floorY, 0.08), M.steelDark, mx(0, floorY + (postTop - floorY) / 2, z - 0.5));
    BA.add(mbox(0.2, 0.014, 0.2), M.steelRaw, mx(0, floorY + 0.007, z - 0.5));
    // load cell cable to the junction box
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02, cellTop - 0.1, z - 0.5), new THREE.Vector3(0.12, cellTop - 0.16, z - 0.62), new THREE.Vector3(0.2, floorY + 0.5, z - 0.6),
      new THREE.Vector3(0.12, floorY + 0.25, cz - hl + 0.13), new THREE.Vector3(-0.7, floorY + 0.25, cz - hl + 0.02), new THREE.Vector3(-1.1, -0.74, cz - hl + 0.02), new THREE.Vector3(-1.25, -0.74, cz - hl + 0.04),
    ]), 40, 0.006, 6);
    absorber.add(new THREE.Mesh(cable, M.cable));
    // air duct: flexible corrugated duct from a collar on the housing to the blower on the north wall
    const ductCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.1, cy + 0.2, z - 0.02), new THREE.Vector3(-0.1, cy + 0.33, z - 0.1), new THREE.Vector3(-0.1, cy + 0.33, z - 0.27),
      new THREE.Vector3(-0.1, cy + 0.2, z - 0.4), new THREE.Vector3(-0.1, -0.5, cz - hl + 0.3),
    ], false, 'catmullrom', 0.5);
    const duct = new CorrugatedTube(120, 12, 0.07, 18, 0.08);
    duct.fit(ductCurve);
    absorber.add(mesh(duct.geometry, M.hoseMat, 0, 0, 0, { cast: false }));
    BA.add(cyl(0.085, 0.04, 'y', 20), M.plasticGrey, mx(-0.1, cy + 0.215, z - 0.02));
    // blower on the north wall: volute and motor
    const bz = cz - hl + 0.17;
    BA.add(cyl(0.14, 0.14, 'x', 24), M.castGrey, mx(-0.1, -0.52, bz));
    BA.add(mbox(0.16, 0.2, 0.2), M.castGrey, mx(-0.1, -0.44, cz - hl + 0.1));
    BA.add(cyl(0.085, 0.2, 'x', 20), M.castBlue, mx(0.06, -0.52, bz));
    BA.add(cyl(0.07, 0.04, 'y', 16), M.plasticGrey, mx(-0.1, -0.39, bz));
  }

  // ---------------- inertia flywheel on the rear line ----------------
  {
    const R = 0.26, shape = new THREE.Shape();
    shape.absarc(0, 0, R, 0, Math.PI * 2, false);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, h = new THREE.Path(); h.absarc(Math.cos(a) * 0.155, Math.sin(a) * 0.155, 0.05, 0, Math.PI * 2, true); shape.holes.push(h); }
    const hub = new THREE.Path(); hub.absarc(0, 0, 0.045, 0, Math.PI * 2, true); shape.holes.push(hub);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 32 });
    g.translate(0, 0, -0.04); g.rotateY(Math.PI / 2);
    const fw = new THREE.Group(); fw.position.set(0, cy, zR);
    const disc = new THREE.Mesh(g, M.castGrey); disc.castShadow = true; disc.receiveShadow = true; fw.add(disc);
    fw.add(mesh(cyl(0.085, 0.12, 'x', 24), M.steelMachined, 0, 0, 0));
    absorber.add(fw); spinners.push(fw);
    for (const e of [-1, 1]) BA.add(cyl(0.05, 0.12, 'x', 16), M.castGrey, mx(e * 0.0, cy, zR));
  }

  // ---------------- chain guard at the +x outboard end tying both roller lines together, encoder on -x ----------------
  {
    const x = 1.5;
    B.add(mbox(0.1, 0.26, zR - zF + 0.34), M.safetyYellow, mx(x, cy, cz));
    B.add(mbox(0.103, 0.1, zR - zF + 0.2), M.plasticBlack, mx(x, cy, cz));
    for (const z of [zF, zR]) B.add(cyl(0.07, 0.108, 'x', 20), M.safetyYellow, mx(x, cy, z));
    B.add(mbox(0.01, 0.2, 0.2), M.paintWhite, mx(x + 0.055, cy, cz)); // warning decal
    B.add(cyl(0.06, 0.14, 'x', 20), M.castBlue, mx(-1.5, cy, zR));       // shaft encoder
    B.add(cyl(0.012, 0.1, 'y', 8), M.cable, mx(-1.5, cy + 0.09, zR));
  }

  B.build(assembly, { cast: true, name: 'mech' });
  BA.build(absorber, { cast: true, name: 'abs' });
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  // ---------------- animation ----------------
  const state = { angle: 0 };
  function update(dt, rollerRad) {
    state.angle = advanceAngle(state.angle, rollerRad || 0, dt);
    for (const d of drums) d.rotation.x = state.angle;
    for (const s of spinners) s.rotation.x = state.angle;
  }
  return { group: root, update, state, layout: L, drums };
}
