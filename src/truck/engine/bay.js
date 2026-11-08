// Static structure of the engine bay: inner fender aprons (painted steel) with wheelhouse domes, firewall, HVAC plenum, cowl vent screen,
// frame rails, radiator support with the primary hood latch and the secondary release, the black radiator top cover and the body-side hood
// hinge brackets. Truck-frame inches; none of this moves with the engine.
import * as THREE from 'three';
import { Batch, T, V, tube, cylAxis, rbox, boxAt, polyExtrude, mergeAll, lerp, smoothstep } from './geo.js';
import { BAY, HINGE, POS } from './layout.js';
import { ARCH_R, AXLE_Y } from '../skin.js';

const part = (parent, name, labelId) => { const g = new THREE.Group(); g.name = name; if (labelId) g.userData.labelId = labelId; parent.add(g); return g; };

// parametric surface from a function (u, v in 0..1) -> [x, y, z]; flip reverses winding
function surf(nI, nJ, fn, flip = false, uvK = 0.08) {
  const P = [], UV = [], I = [];
  for (let j = 0; j <= nJ; j++) for (let i = 0; i <= nI; i++) { const p = fn(i / nI, j / nJ); P.push(p[0], p[1], p[2]); UV.push(p[0] * uvK + p[2] * uvK * 0.5, p[1] * uvK + p[2] * uvK * 0.5); }
  for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) {
    const a = j * (nI + 1) + i, b = a + 1, c = a + nI + 2, d = a + nI + 1;
    if (flip) I.push(a, d, b, b, d, c); else I.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals(); return g;
}

export function buildBay({ mats, d, fast }) {
  const root = new THREE.Group(); root.name = 'bay_static';
  const A = {};
  const S_A0 = -27.0, S_A1 = 22.0;

  // ================= inner fender aprons + wheelhouse domes =================
  for (const sgn of [-1, 1]) {
    const g = part(root, `apron_${sgn > 0 ? 'R' : 'L'}`, 'engine.fender_apron'); const b = new Batch();
    const wheelTop = (s) => (Math.abs(s) < 19.2 ? AXLE_Y - 1.3 + Math.sqrt(Math.max(0, 17.6 * 17.6 - s * s)) : 0);
    const yb = (s) => Math.max(23.5, wheelTop(s));
    const yt = (s) => BAY.apronTopY(s);
    const wallX = (s, y) => BAY.apronHalf(s) + (yt(s) - y) * 0.09;
    // vertical wall, inner face toward the engine
    b.add('apron', surf(48, 10, (u, v) => { const s = lerp(S_A0, S_A1, u), y = lerp(yb(s) - (Math.abs(s) < 19.2 ? 0 : 1.5), yt(s), v); return [sgn * wallX(s, y), y, s]; }, sgn > 0));
    // wheelhouse dome shelf, running outward from the wall bottom over the tire
    b.add('apron', surf(40, 4, (u, v) => { const s = lerp(-19.2, 19.2, u), w0 = wallX(s, yb(s)); return [sgn * (w0 + v * 7.5), yb(s) - v * v * 1.8, s]; }, sgn < 0));
    // front panel closing the apron toward the radiator support (below the headlamp)
    b.add('apron', surf(6, 6, (u, v) => { const s = S_A0 - 0.8 * (1 - v); return [sgn * lerp(wallX(S_A0, 30), 24.5, u), lerp(21, yt(S_A0), v), s]; }, sgn > 0));
    // top flange the fender and hood seal sit on, with a rolled bead
    b.add('apron', surf(48, 2, (u, v) => { const s = lerp(S_A0, S_A1, u); return [sgn * (BAY.apronHalf(s) + v * 2.6), yt(s) + 0.2 * v, s]; }, sgn < 0));
    // shock tower bulge and brake line / harness brackets
    b.add('apron', T(rbox([0, 0, 0], 1.0, 9, 8, 0.3), [sgn * (wallX(4, 36) - 0.5), 36, 5]));
    b.add('steelBlack', T(rbox([0, 0, 0], 0.5, 3, 2.4, 0.2), [sgn * (wallX(-3, 40) - 0.4), 41, -3]));
    b.flush(g, mats, { cast: false, name: 'apron' });
  }

  // ================= firewall, HVAC plenum, cowl screen =================
  {
    const g = part(root, 'firewall', 'engine.firewall'); const b = new Batch();
    const xr = (y) => 26.4;
    b.add('steelBlack', surf(14, 28, (u, v) => { const y = lerp(19, 50.5, v); return [lerp(-xr(y), xr(y), u), y, BAY.firewallS(y) + 0.15]; }, true));
    // sound insulation panel (dark felt look) on the engine side
    b.add('plasticGray', surf(10, 12, (u, v) => { const y = lerp(24, 44, v); return [lerp(-18, 18, u), y, BAY.firewallS(y) - 0.15]; }, true));
    // HVAC plenum box at the passenger side top of the firewall
    b.add('plasticDust', rbox([14.5, 43.8, 22.7], 17, 4.6, 3.2, 0.6));
    b.add('plastic', rbox([21.6, 41.0, 22.8], 2.4, 3.6, 3.0, 0.5));
    // heater hose pipes through the firewall (to the heater core)
    for (const x of [4.6, 7.4]) { b.add('alumMach', cylAxis('z', [x, 39.5, 23.2], 0.62, 2.5, 12)); b.add('alumMach', cylAxis('z', [x, 39.5, 22.2], 0.8, 0.5, 12)); }
    // wiring grommets / bulkhead connectors (large black connectors on the driver side)
    b.add('plastic', rbox([-6.4, 42.6, 23.4], 3.6, 2.6, 2.2, 0.35)); b.add('plastic', rbox([-3.0, 42.6, 23.4], 2.2, 2.4, 2.0, 0.35));
    b.add('rubber', T(new THREE.CylinderGeometry(1.5, 1.5, 0.4, 16), [-9, 33, BAY.firewallS(33) - 0.35], [Math.PI / 2, 0, 0]));
    b.add('rubber', T(new THREE.CylinderGeometry(1.1, 1.1, 0.4, 16), [3, 31, BAY.firewallS(31) - 0.35], [Math.PI / 2, 0, 0]));
    b.flush(g, mats, { cast: false, name: 'fw' });
    // cowl vent plenum screen: sloped louvered plastic panel at the base of the windshield, with a wiper pivot hump on each side
    const cw = part(root, 'cowl', 'engine.cowl'); const cb = new Batch();
    const cowlY = (s) => 48.4 + (s - 12.5) * 0.42;
    cb.add('plastic', surf(30, 8, (u, v) => { const s = lerp(12.5, 21.8, v); const hw = 26.6 - 1.8 * (1 - v); return [lerp(-hw, hw, u), cowlY(s), s]; }, true));
    for (let i = 0; i < 24; i++) { const s = 13.4 + i * 0.34; if (s > 21.6) break; cb.add('plastic', boxAt([0, cowlY(s) + 0.1, s], 50.4 - 2 * (1 - (s - 12.5) / 9.3) * 1.8, 0.16, 0.12)); }
    // wiper pivots and the two arms parked along the base of the windshield, blades pointing to the passenger side
    for (const [x, len] of [[-15.5, 22.0], [10.5, 17.0]]) {
      const py = cowlY(20.0) + 0.7;
      cb.add('steelBlack', cylAxis('y', [x, py - 0.1, 20.0], 0.7, 0.8, 12));
      cb.add('stainless', cylAxis('y', [x, py + 0.45, 20.0], 0.36, 0.4, 10));
      cb.add('steelBlack', tube([[x, py + 0.2, 20.0], [x + 0.6, py + 1.2, 21.6], [x + 1.4, 56.5, 22.6], [x + 4.5, 56.6, 22.9]], 0.22, { radial: 6 }));
      cb.add('rubber', rbox([x + 1.8 + len / 2, 56.55, 22.9], len, 0.5, 0.45, 0.12));
      cb.add('steelBlack', rbox([x + 1.8 + len / 2, 56.9, 22.9], len - 1.0, 0.18, 0.7, 0.08));
    }
    cb.flush(cw, mats, { name: 'cowl' });
  }

  // ================= frame rails and front crossmember (visible beside and below the engine) =================
  {
    const g = part(root, 'frame_front', 'engine.frame_rail'); const b = new Batch();
    for (const sgn of [-1, 1]) {
      b.add('steelBlack', rbox([sgn * 17.5, 20.5, 1.5], 3.2, 7.0, 73, 0.3)); // boxed rail, y 17 to 24, s -35 to +38 (ends behind the bumper)
    }
    b.add('steelBlack', rbox([0, 15.0, -22], 36, 3.4, 4.5, 0.4)); // front crossmember under the radiator
    b.flush(g, mats, { name: 'frame' });
  }

  // ================= radiator support, hood latch, secondary release =================
  {
    const g = part(root, 'radiator_support', 'engine.radiator_support'); const b = new Batch();
    b.add('steelBlack', rbox([0, 40.2, -28.9], 47.6, 4.4, 2.6, 0.4)); // upper crossbar (box section)
    b.add('steelBlack', rbox([0, 22.0, -27.6], 47.6, 4.6, 3.2, 0.4)); // lower crossmember
    for (const sgn of [-1, 1]) { // side posts carrying the headlamps and the radiator
      b.add('steelBlack', rbox([sgn * 23.6, 32.2, -28.4], 2.2, 22, 3.4, 0.35));
      b.add('steelBlack', rbox([sgn * 24.6, 39.0, -23.5], 1.0, 6.4, 12.5, 0.3)); // headlamp mounting arm toward the apron
    }
    // rubber hood bump stops on the crossbar and the hood seal bulb along the top
    for (const x of [-18, 18]) b.add('rubber', cylAxis('y', [x, 43.4, -28.4], 0.75, 0.9, 14));
    b.add('rubber', tube([[-22.5, 43.0, -29.9], [0, 43.0, -29.9], [22.5, 43.0, -29.9]], 0.45, { radial: 8, segs: 12 }));
    b.flush(g, mats, { cast: false, name: 'rs' });
    A.support = g;

    // primary latch on the center of the crossbar: housing, pawl, release cable going to the driver side apron
    const lg = part(root, 'hood_latch', 'engine.hood_latch'); const lb = new Batch();
    lb.add('steelRaw', rbox([0, 42.7, -28.6], 7.4, 0.5, 3.6, 0.2));
    lb.add('plastic', rbox([0, 43.6, -28.6], 5.0, 1.8, 2.8, 0.35));
    lb.add('steelRaw', rbox([0, 44.7, -28.6], 3.4, 0.45, 1.8, 0.15)); // latch plate under the striker
    lb.add('zincGold', tube([[-1.0, 44.5, -28.6], [-1.0, 45.3, -28.6], [0, 45.7, -28.6], [1.0, 45.3, -28.6], [1.0, 44.5, -28.6]], 0.17, { radial: 6 })); // pawl hook (the striker loop is on the hood)
    lb.add('cable', tube([[-2.8, 43.4, -28.6], [-8, 41.9, -27.6], [-16, 41.7, -27.2], [-22.8, 41.2, -25.5], [-24.2, 41.4, -20], [-24.4, 41.4, -10], [-24.6, 41.2, 6], [-24.8, 41.0, 20]], 0.2, { radial: 6 }));
    lb.add('plastic', cylAxis('y', [-2.8, 43.8, -28.6], 0.5, 0.9, 10));
    lb.flush(lg, mats, { name: 'latch' });
    for (const x of [-2.4, 2.4]) fast.bolt([x, 42.95, -27.2], [0, 1, 0], 0.3);
    A.latch = lg;

    // secondary release lever: stamped steel finger with a pull pad, pivoting at the top of the crossbar behind the grille center
    const sg = new THREE.Group(); sg.name = 'secondary_release'; sg.userData.labelId = 'engine.secondary_release';
    sg.position.set(0, 44.0, -30.2); root.add(sg);
    const sb = new Batch();
    sb.add('steelBlack', rbox([0, 0.3, 0.3], 2.4, 0.22, 2.4, 0.08));
    sb.add('steelBlack', T(rbox([0, 0, 0], 2.0, 0.22, 3.0, 0.08), [0, 0.35, -1.8], [-0.35, 0, 0]));
    sb.add('yellow', T(rbox([0, 0, 0], 2.4, 0.24, 0.9, 0.08), [0, 0.85, -3.0], [-0.55, 0, 0]));
    sb.add('zincGold', cylAxis('x', [0, 0.1, 1.2], 0.2, 3.0, 8));
    sb.flush(sg, mats, { name: 'sec' });
    sg.userData.restRotX = 0;
    sg.userData.interact = {
      prompt: 'Pull secondary release',
      run(ctx) {
        const g0 = sg; let t = 0;
        if (ctx.state) ctx.state.hoodSecondaryReleased = true;
        if (ctx.say) ctx.say('Secondary release pulled up: the hood is free to lift.');
        if (ctx.animate) ctx.animate((dt) => { t += dt; g0.rotation.x = 0.55 * Math.min(1, t / 0.35); return t >= 0.35; });
        else g0.rotation.x = 0.55;
      },
    };
    A.secondary = sg;
  }

  // ================= radiator top cover (air baffle) with the molded icons and service decals =================
  {
    const g = part(root, 'radiator_cover', 'engine.radiator_cover');
    const pts = [[-23.4, 29.6], [14.6, 29.6], [15.2, 22.0], [15.2, 16.8], [6, 16.2], [-6, 16.4], [-17, 17.0], [-23.4, 19.0]]; // (x, -s)
    const geo = polyExtrude(pts, 0.8, 0.22);
    geo.rotateX(-Math.PI / 2); // shape y -> -z, extrusion z -> +y
    geo.translate(0, 41.6, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + (pos.getZ(i) + 29.6) * 0.02);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mats.plasticGray); m.castShadow = true; m.receiveShadow = true; m.name = 'cover_plate'; g.add(m);
    const b = new Batch();
    // raised rear lip toward the engine, over the fan shroud
    for (const [x, s] of [[-20, -26], [-8, -27.4], [10, -26.5], [-1.5, -18.4], [-19, -18.4], [11, -18.2]]) b.add('plastic', cylAxis('y', [x, 42.1 + (s + 29.6) * 0.02, s], 0.5, 0.3, 12));
    b.flush(g, mats, { name: 'cov' });
    const dec = (kind, w, h, x, s, rot = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.decal(kind)); p.rotation.set(-Math.PI / 2, 0, rot + Math.PI); p.position.set(x, 42.05 + (s + 29.6) * 0.02, s); p.receiveShadow = true; g.add(p); return p; };
    dec('icons', 10.4, 2.6, -14.2, -17.6);
    dec('radiator', 5.6, 4.2, 5.2, -22.4, 0.0);
    dec('warn', 6.0, 4.5, -10.0, -26.0, 0.0);
    A.radiatorCover = g;
  }

  // ================= body-side hood hinge brackets (fixed to the cowl corners) =================
  for (const sgn of [-1, 1]) {
    const g = part(root, `hinge_body_${sgn > 0 ? 'R' : 'L'}`, 'engine.hood_hinge'); const b = new Batch();
    const x = sgn * HINGE.halfSpan;
    b.add('steelBlack', rbox([x, 51.4, 20.8], 2.2, 6.6, 3.6, 0.3));
    b.add('steelBlack', rbox([x - sgn * 1.2, 48.6, 20.0], 4.8, 1.0, 5.2, 0.25)); // foot on the apron / cowl
    b.add('stainless', cylAxis('x', [x + sgn * 0.8, HINGE.pivotY, HINGE.pivotS], 0.55, 5.0, 14)); // pivot pin
    b.add('steelRaw', cylAxis('x', [x - sgn * 1.9, HINGE.pivotY, HINGE.pivotS], 0.9, 0.35, 14)); // pin head
    b.flush(g, mats, { name: 'hb' });
    for (const [dx, dy] of [[-1.4, 0], [1.4, 0]]) fast.bolt([x - sgn * 1.2 + dx, 49.1, 20.0 + dy * 1.5], [0, 1, 0], 0.32);
  }
  return { group: root, anchors: A };
}
