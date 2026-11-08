// The dyno pit: concrete walls, rolled steel curb with hazard paint, sump, LED strips, ladder, safety rails and the
// diamond-plate bridge plates at the approach. The floor (src/shop/shell.js) already has the rectangular hole.
import * as THREE from 'three';
import { aabb, metricPlane } from '../../core/geom.js';
import { Batch, mx, cyl, mbox, plain, instanced } from './util.js';
import { PIT, rollerLayout, ROLLER_R } from './logic.js';

const { hw, hl, depth, cz } = PIT;
export const PIT_BOX = { x: -1.25, y: -0.5, z: cz - hl + 0.15 }; // electrical enclosure on the north wall (cables end here)
export const LADDER_Z = cz + 0.55;                                // ladder on the west wall, south half
export const RAIL_OFFSET = 0.26;                                  // rail posts stand this far outside the pit edge

function wedgeBox(w, h, d) {
  // plate with its -z end sloping down to the floor (approach ramp)
  const g = plain(mbox(w, h, d));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getZ(i) < 0) p.setY(i, -h / 2);
  g.computeVertexNormals();
  return g;
}

export function buildPit(M, quality) {
  const group = new THREE.Group(); group.name = 'dyno_pit';
  group.userData.labelId = 'dyno.pit';
  const colliders = [];
  const B = new Batch();
  const L = rollerLayout();
  const zN = cz - hl, zS = cz + hl;

  // ---------------- concrete walls (inner faces) and floor ----------------
  const wall = (w, x, z, ry) => {
    const g = metricPlane(w, depth); g.translate(0, -depth / 2, 0); g.rotateY(ry); g.translate(x, 0, z);
    const m = new THREE.Mesh(g, M.wallConcrete); m.receiveShadow = true; group.add(m);
  };
  wall(2 * hw, 0, zN, 0);              // north wall faces +z (into the pit)
  wall(2 * hw, 0, zS, Math.PI);        // south wall faces -z
  wall(2 * hl, -hw, cz, Math.PI / 2);  // west wall faces +x
  wall(2 * hl, hw, cz, -Math.PI / 2);  // east wall faces -x
  // floor with a sump hole
  const sump = { x: 0.0, z: cz + 0.86, s: 0.34, d: 0.26 };
  {
    const sh = new THREE.Shape();
    sh.moveTo(-hw, -zN); sh.lineTo(hw, -zN); sh.lineTo(hw, -zS); sh.lineTo(-hw, -zS); sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(sump.x - sump.s / 2, -(sump.z - sump.s / 2)); hole.lineTo(sump.x - sump.s / 2, -(sump.z + sump.s / 2));
    hole.lineTo(sump.x + sump.s / 2, -(sump.z + sump.s / 2)); hole.lineTo(sump.x + sump.s / 2, -(sump.z - sump.s / 2)); hole.closePath();
    sh.holes.push(hole);
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, -depth, 0);
    const m = new THREE.Mesh(g, M.pitFloor); m.receiveShadow = true; group.add(m);
    // sump walls and bottom
    const sw = (x, z, ry) => { const p = metricPlane(sump.s, sump.d); p.translate(0, -sump.d / 2, 0); p.rotateY(ry); p.translate(x, -depth, z); const mm = new THREE.Mesh(p, M.wallConcrete); group.add(mm); };
    sw(sump.x, sump.z - sump.s / 2, 0); sw(sump.x, sump.z + sump.s / 2, Math.PI); sw(sump.x - sump.s / 2, sump.z, Math.PI / 2); sw(sump.x + sump.s / 2, sump.z, -Math.PI / 2);
    const bt = metricPlane(sump.s, sump.s); bt.rotateX(-Math.PI / 2); bt.translate(sump.x, -depth - sump.d, sump.z);
    group.add(new THREE.Mesh(bt, M.pitFloor));
    // drain: round cast-iron grate in the sump with slots (the visible sump drain), plus a frame
    B.add(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 28), M.steelDark, mx(sump.x, -depth - 0.06, sump.z));
    const slotM = [];
    for (let i = -4; i <= 4; i++) slotM.push(mx(sump.x + i * 0.028, -depth - 0.052, sump.z));
    group.add(instanced(new THREE.BoxGeometry(0.012, 0.012, 0.25), M.steelRaw, slotM));
    // a stain of oil film around the drain is already in the floor texture; pipe stub going down
    B.add(cyl(0.025, 0.2, 'y', 12), M.steelRaw, mx(sump.x + 0.12, -depth - 0.14, sump.z + 0.12));
    // frame around the sump top (angle iron)
    const fr = sump.s + 0.05;
    for (const [dx, dz, w, d] of [[0, -fr / 2, fr, 0.025], [0, fr / 2, fr, 0.025], [-fr / 2, 0, 0.025, fr], [fr / 2, 0, 0.025, fr]])
      B.add(mbox(w, 0.01, d), M.steelRaw, mx(sump.x + dx, -depth + 0.005, sump.z + dz));
  }

  // ---------------- rolled steel curb (angle iron 75 x 75 x 9) with the hazard band ----------------
  const leg = 0.075, t = 0.009;
  const edges = [
    { cx: 0, cz: zN, ax: 'x', len: 2 * hw, nx: 0, nz: -1 }, { cx: 0, cz: zS, ax: 'x', len: 2 * hw, nx: 0, nz: 1 },
    { cx: -hw, cz: cz, ax: 'z', len: 2 * hl, nx: -1, nz: 0 }, { cx: hw, cz: cz, ax: 'z', len: 2 * hl, nx: 1, nz: 0 },
  ];
  for (const e of edges) {
    const extra = e.ax === 'x' ? 2 * (leg + t) : 0; // mitered corners: the long edges run over the corners
    const L1 = e.len + extra;
    // horizontal leg lies on the floor, outward of the edge
    const hx = e.ax === 'x' ? 0 : e.nx * (leg / 2 - t / 2), hzz = e.ax === 'x' ? e.nz * (leg / 2 - t / 2) : 0;
    B.add(e.ax === 'x' ? mbox(L1, t, leg + t) : mbox(leg + t, t, L1), M.steelRaw, mx(e.cx + hx, t / 2, e.cz + hzz));
    // vertical leg hangs down the wall (embedded, 9 mm proud of the wall plane)
    const vx = e.ax === 'x' ? 0 : -e.nx * t / 2, vz = e.ax === 'x' ? -e.nz * t / 2 : 0;
    B.add(e.ax === 'x' ? mbox(e.len, leg, t) : mbox(t, leg, e.len), M.steelRaw, mx(e.cx + vx, -leg / 2 + t, e.cz + vz));
    // anchor bolts along the curb (flush heads)
    const n = Math.floor(e.len / 0.45);
    for (let i = 0; i < n; i++) {
      const s = -e.len / 2 + (i + 0.5) * (e.len / n);
      const px = e.ax === 'x' ? s : e.cx + e.nx * (leg / 2), pz = e.ax === 'x' ? e.cz + e.nz * (leg / 2) : s + cz;
      B.add(cyl(0.011, 0.004, 'y', 8), M.steelDark, mx(px, t + 0.002, pz));
    }
  }
  // hazard band painted on the floor around the curb
  {
    const o = leg + 0.005, w = 0.12;
    const sh = new THREE.Shape();
    const ox = hw + o + w, oz = hl + o + w;
    sh.moveTo(-ox, -oz); sh.lineTo(ox, -oz); sh.lineTo(ox, oz); sh.lineTo(-ox, oz); sh.closePath();
    const ix = hw + o, iz = hl + o;
    const hole = new THREE.Path(); hole.moveTo(-ix, -iz); hole.lineTo(-ix, iz); hole.lineTo(ix, iz); hole.lineTo(ix, -iz); hole.closePath();
    sh.holes.push(hole);
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, 0.0025, cz);
    const m = new THREE.Mesh(g, M.hazard); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  }

  // ---------------- diamond-plate bridge plates and approach ramps (tire tracks) ----------------
  const plateT = 0.012, plateW = 0.56, rampL = 0.16;
  const zIn = L.zRear + ROLLER_R + 0.012; // just clear of the drum
  const plateLen = (hl + 0.21) - (zIn - cz);
  for (const sx of L.setX) for (const dir of [1, -1]) {
    const zc = cz + dir * ((zIn - cz) + plateLen / 2);
    B.add(mbox(plateW, plateT, plateLen), M.diamondPlate, mx(sx, plateT / 2, zc));
    const zr = cz + dir * ((zIn - cz) + plateLen + rampL / 2);
    B.add(wedgeBox(plateW, plateT, rampL), M.diamondPlate, mx(sx, plateT / 2, zr, 0, dir > 0 ? Math.PI : 0, 0));
    // stiffening angle under the plate edge, visible from inside the pit, and the countersunk bolts
    for (const k of [-1, 1]) {
      B.add(mbox(0.04, 0.04, plateLen), M.steelRaw, mx(sx + k * (plateW / 2 - 0.02), -0.028, zc));
      for (const j of [0.2, 0.5, 0.8]) B.add(cyl(0.008, 0.003, 'y', 8), M.zinc, mx(sx + k * (plateW / 2 - 0.035), plateT + 0.001, cz + dir * ((zIn - cz) + plateLen * j)));
    }
  }

  // ---------------- LED strip lights ----------------
  const strip = (len, x, y, z, ax) => {
    B.add(ax === 'x' ? mbox(len, 0.03, 0.022) : mbox(0.022, 0.03, len), M.steelDark, mx(x, y, z));
    const g = new THREE.Mesh(ax === 'x' ? new THREE.BoxGeometry(len - 0.04, 0.012, 0.004) : new THREE.BoxGeometry(0.004, 0.012, len - 0.04), M.ledStrip);
    return g;
  };
  const stripY = -0.3;
  for (const [len, x, z, ax, nx, nz] of [[2 * hw - 0.1, 0, zN + 0.011, 'x', 0, 1], [2 * hw - 0.1, 0, zS - 0.011, 'x', 0, -1], [2 * hl - 0.1, -hw + 0.011, cz, 'z', 1, 0], [2 * hl - 0.1, hw - 0.011, cz, 'z', -1, 0]]) {
    const body = strip(len, x, stripY, z, ax);
    const g = body; g.position.set(x + nx * 0.011, stripY, z + nz * 0.011); group.add(g);
  }
  const lights = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.PointLight(0xeaf2ff, 0.55, 4.0, 1.8); p.position.set(sx * 1.45, -0.25, cz); group.add(p); lights.push(p);
  }

  // ---------------- ladder (west wall) ----------------
  {
    const x = -hw + 0.19, top = 0.92, bot = -depth + 0.02;
    const zA = LADDER_Z - 0.2, zB = LADDER_Z + 0.2;
    for (const z of [zA, zB]) {
      B.add(mbox(0.035, top - bot, 0.035), M.steelRaw, mx(x, (top + bot) / 2, z));
      // standoff brackets to the wall
      for (const y of [-0.95, -0.4, 0.05]) { B.add(mbox(0.16, 0.03, 0.03), M.steelRaw, mx(-hw + 0.1, y, z)); B.add(mbox(0.01, 0.07, 0.07), M.steelDark, mx(-hw + 0.005, y, z)); }
    }
    const rungs = [];
    for (let y = bot + 0.2; y < top - 0.05; y += 0.28) rungs.push(mx(x, y, LADDER_Z, Math.PI / 2, 0, 0));
    group.add(instanced(new THREE.CylinderGeometry(0.0125, 0.0125, 0.4, 10), M.steelRaw, rungs));
    // grab handle across the top
    B.add(cyl(0.0175, 0.44, 'z', 10), M.steelRaw, mx(x, top, LADDER_Z));
    // wear: feet on the pit floor
    for (const z of [zA, zB]) B.add(mbox(0.09, 0.012, 0.09), M.steelDark, mx(x, -depth + 0.006, z));
  }

  // ---------------- electrical enclosure (cables from the control stand end here) ----------------
  {
    const bx = PIT_BOX;
    B.add(mbox(0.42, 0.52, 0.2), M.plasticGrey, mx(bx.x, bx.y, zN + 0.1));
    B.add(mbox(0.40, 0.50, 0.012), M.paintWhite, mx(bx.x, bx.y, zN + 0.206));
    B.add(cyl(0.012, 0.03, 'z', 8), M.zinc, mx(bx.x - 0.12, bx.y + 0.24, zN + 0.228));
    for (const gx of [-0.12, 0, 0.12]) B.add(cyl(0.011, 0.04, 'y', 8), M.plasticBlack, mx(bx.x + gx, bx.y - 0.28, zN + 0.1));
    const lamps = [mx(bx.x - 0.1, bx.y + 0.15, zN + 0.215), mx(bx.x + 0.1, bx.y + 0.15, zN + 0.215)];
    group.add(instanced(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12).rotateX(Math.PI / 2), M.ledGreen, lamps));
  }

  // ---------------- safety posts and rails (yellow), open for the ladder and for the approach ----------------
  {
    const BR = new Batch();
    const R = RAIL_OFFSET, postH = 1.05;
    const post = (x, z) => {
      BR.add(cyl(0.025, postH, 'y', 12), M.safetyYellow, mx(x, postH / 2, z));
      BR.add(cyl(0.03, 0.05, 'y', 12), M.plasticBlack, mx(x, postH - 0.2, z));
      BR.add(new THREE.SphereGeometry(0.03, 12, 8), M.safetyYellow, mx(x, postH + 0.005, z));
      BR.add(mbox(0.15, 0.008, 0.15), M.steelDark, mx(x, 0.004, z));
      for (const [bx, bz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) BR.add(cyl(0.008, 0.008, 'y', 6), M.zinc, mx(x + bx * 0.055, 0.012, z + bz * 0.055));
    };
    const rail = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
      for (const y of [postH - 0.04, 0.55]) {
        const g = cyl(0.02, l, 'z', 10);
        BR.add(g, M.safetyYellow, mx((x0 + x1) / 2, y, (z0 + z1) / 2, 0, ang, 0));
      }
    };
    // east and west ends (x = +-(hw + R)), west one has a gap for the ladder
    const zs = [-1.28, -0.45, 0.2, 0.9, 1.28];
    for (const sx of [-1, 1]) {
      const x = sx * (hw + R);
      zs.forEach((z) => post(x, cz + z));
      for (let i = 0; i < zs.length - 1; i++) {
        if (sx < 0 && i === 2) continue; // ladder gap between z = 0.2 and 0.9
        rail(x, cz + zs[i], x, cz + zs[i + 1]);
      }
    }
    // north and south corners: short returns up to x = +-1.15 (the middle stays open for the truck and the bridge plates)
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      const z = cz + sz * (hl + R), x0 = sx * (hw + R), x1 = sx * 1.2;
      post(x1, z);
      post(x0, z);
      rail(x0, z, x1, z);
    }
    const railGroup = new THREE.Group(); railGroup.name = 'pit_rails'; group.add(railGroup);
    BR.build(railGroup, { cast: false, name: 'pit_rails' });
    // collider boxes: pit edge walls, 0.12 m thick centered on the edge, from the pit floor to rail height
    const th = 0.06;
    colliders.push(aabb(0, (postH - depth) / 2, zN, hw + th, (postH + depth) / 2, th));
    colliders.push(aabb(0, (postH - depth) / 2, zS, hw + th, (postH + depth) / 2, th));
    colliders.push(aabb(-hw, (postH - depth) / 2, cz, th, (postH + depth) / 2, hl + th));
    colliders.push(aabb(hw, (postH - depth) / 2, cz, th, (postH + depth) / 2, hl + th));
  }

  B.build(group, { cast: false, name: 'pit' });
  group.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return { group, colliders, lights, sump };
}
