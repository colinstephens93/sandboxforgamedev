// Cooling stack behind the grille (intercooler, A/C condenser, radiator, fan shroud) and the coolant hoses with clamps.
// Truck-frame inches, fixed to the body (the engine shakes relative to this).
import * as THREE from 'three';
import { Batch, T, V, tube, cylAxis, rbox, boxAt, polyExtrude, circlePts } from './geo.js';

const part = (parent, name, labelId) => { const g = new THREE.Group(); g.name = name; if (labelId) g.userData.labelId = labelId; parent.add(g); return g; };

export const STACK = {
  intercooler: { s0: -27.6, s1: -25.8, hw: 13.4, y0: 27.8, y1: 40.8 },
  condenser: { s0: -25.8, s1: -24.6, hw: 14.0, y0: 24.8, y1: 40.4 },
  radiator: { s0: -24.6, s1: -21.8, hw: 14.0, y0: 21.4, y1: 40.9 },
  shroud: { s0: -21.8, ringS1: -16.2, hw: 14.6, y0: 21.4, y1: 40.9, cx: 0, cy: 31.2, r: 9.5 },
};

// boxed finned core with a texture scaled so the fins keep a real pitch
function core(mats, b, c) {
  const w = c.hw * 2, h = c.y1 - c.y0, d = c.s1 - c.s0;
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 12, uv.getY(i) * h / 12);
  return T(g, [0, (c.y0 + c.y1) / 2, (c.s0 + c.s1) / 2]);
}

export function buildCooling({ mats, d, fast }) {
  const root = new THREE.Group(); root.name = 'cooling';
  const A = {};
  const rad = Math.max(10, Math.round(24 * d));

  // ---------- intercooler (charge air cooler): finned core, cast aluminum end tanks, two pipe stubs ----------
  {
    const c = STACK.intercooler, g = part(root, 'intercooler', 'engine.intercooler'); const b = new Batch();
    b.add('fins', core(mats, b, c));
    const ym = (c.y0 + c.y1) / 2, sm = (c.s0 + c.s1) / 2;
    for (const sgn of [-1, 1]) {
      const tank = polyExtrude([[0, -6.0], [2.8, -5.2], [2.8, 5.2], [0, 6.0]].map(([x, y]) => [sgn * (x - 1.4), y]), 1.7, 0.3); // end tank profile (taper)
      b.add('alum', T(tank, [sgn * (c.hw + 1.4), ym, sm]));
      b.add('alumDark', rbox([sgn * (c.hw + 1.4), ym - 0.4, sm], 1.4, 12, 1.9, 0.5));
      b.add('alumMach', cylAxis('x', [sgn * (c.hw + 3.6), c.y0 + 3.4, sm], 1.9, 1.5, rad)); // pipe stub
    }
    b.add('alumDark', rbox([0, c.y1 + 0.2, sm], c.hw * 2, 0.7, 1.7, 0.2));
    b.add('alumDark', rbox([0, c.y0 - 0.2, sm], c.hw * 2, 0.7, 1.7, 0.2));
    b.flush(g, mats, { cast: false, name: 'ic' });
    for (const sgn of [-1, 1]) fast.clamp([sgn * (c.hw + 4.1), c.y0 + 3.4, sm], [sgn, 0, 0], 1.9);
    A.intercooler = g; A.icStub = { drv: V(-(c.hw + 4.3), c.y0 + 3.4, sm), pas: V(c.hw + 4.3, c.y0 + 3.4, sm) };
  }
  // ---------- A/C condenser ----------
  {
    const c = STACK.condenser, g = part(root, 'condenser', 'engine.radiator'); const b = new Batch();
    b.add('fins', core(mats, b, c));
    const sm = (c.s0 + c.s1) / 2;
    b.add('alumDark', rbox([c.hw + 0.5, (c.y0 + c.y1) / 2, sm], 0.9, c.y1 - c.y0, 1.3, 0.3)); b.add('alumDark', rbox([-c.hw - 0.5, (c.y0 + c.y1) / 2, sm], 0.9, c.y1 - c.y0, 1.3, 0.3));
    b.add('alumMach', cylAxis('y', [c.hw + 0.8, c.y0 + 4.5, sm], 1.1, 8.5, 14)); // receiver / drier
    b.add('alumMach', cylAxis('z', [-c.hw + 1.0, c.y1 - 1.6, c.s1 + 0.6], 0.5, 1.4, 10));
    b.flush(g, mats, { name: 'cond' });
  }
  // ---------- radiator: finned core with black plastic tanks, necks and a pressure-less top ----------
  {
    const c = STACK.radiator, g = part(root, 'radiator', 'engine.radiator'); const b = new Batch();
    b.add('fins', core(mats, b, c));
    const ym = (c.y0 + c.y1) / 2, sm = (c.s0 + c.s1) / 2;
    for (const sgn of [-1, 1]) {
      b.add('plastic', rbox([sgn * (c.hw + 0.7), ym, sm], 1.5, c.y1 - c.y0 + 0.4, 3.0, 0.5));
      for (let i = 0; i < 6; i++) b.add('plastic', boxAt([sgn * (c.hw + 1.5), c.y0 + 2.2 + i * 2.9, sm], 0.35, 0.45, 2.7));
    }
    b.add('steelBlack', rbox([0, c.y1 + 0.3, sm], c.hw * 2, 0.6, 3.0, 0.2)); b.add('steelBlack', rbox([0, c.y0 - 0.3, sm], c.hw * 2, 0.6, 3.0, 0.2));
    // upper (driver side) and lower (passenger side) hose necks
    b.add('plastic', cylAxis('x', [-c.hw - 2.0, c.y1 - 2.2, sm], 1.05, 2.2, 14)); b.add('plastic', cylAxis('x', [c.hw + 2.0, c.y0 + 2.5, sm], 1.05, 2.2, 14));
    // drain petcock and a small overflow fitting
    b.add('plastic', cylAxis('y', [c.hw + 0.8, c.y0 - 1.0, sm + 0.3], 0.4, 0.9, 8));
    b.add('plastic', cylAxis('x', [c.hw + 1.9, c.y1 - 3.8, sm - 0.2], 0.4, 1.0, 8));
    b.flush(g, mats, { name: 'rad' });
    A.radiator = g; A.radNeck = { upper: V(-c.hw - 3.1, c.y1 - 2.2, sm), lower: V(c.hw + 3.1, c.y0 + 2.5, sm) };
  }
  // ---------- fan shroud: front plate with the fan opening, funnel ring and side flanges ----------
  {
    const c = STACK.shroud, g = part(root, 'fan_shroud', 'engine.fan_shroud'); const b = new Batch();
    const outline = [[-c.hw, c.y0], [c.hw, c.y0], [c.hw, c.y1], [-c.hw, c.y1]];
    const plate = polyExtrude(outline, 0.7, 0.2, [circlePts(c.cx, c.cy, c.r + 0.2, 48)]);
    b.add('plastic', T(plate, [0, 0, c.s0 + 0.35]));
    const ring = new THREE.CylinderGeometry(c.r + 0.2, c.r + 0.2, c.ringS1 - c.s0 + 0.0, 48, 1, true); ring.rotateX(Math.PI / 2); // axis along z (the rim end faces the fan)
    b.add('plastic', T(ring, [c.cx, c.cy, (c.s0 + c.ringS1) / 2 - 0.2]));
    const lip = new THREE.TorusGeometry(c.r + 0.3, 0.4, 8, 48); b.add('plastic', T(lip, [c.cx, c.cy, c.ringS1 - 0.1]));
    // sloped corner pieces between the round ring and the square plate, and flanges around the perimeter
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.add('plastic', rbox([x * (c.hw - 1.6), c.cy + y * (c.r * 0.74 + 3.0), c.s0 + 1.8], 3.2, 3.8, 3.2, 0.5));
    }
    b.add('plastic', rbox([0, c.y1 + 0.2, c.s0 + 1.2], c.hw * 2, 0.6, 2.8, 0.2)); b.add('plastic', rbox([0, c.y0 - 0.2, c.s0 + 1.2], c.hw * 2, 0.6, 2.8, 0.2));
    for (const sgn of [-1, 1]) b.add('plastic', rbox([sgn * (c.hw + 0.2), (c.y0 + c.y1) / 2, c.s0 + 1.2], 0.6, c.y1 - c.y0, 2.8, 0.2));
    b.flush(g, mats, { cast: true, name: 'sh' });
    for (const [x, y] of [[-12.4, 40.5], [12.4, 40.5], [-12.4, 26.5], [12.4, 26.5]]) fast.bolt([x, y, c.s0 - 0.05], [0, 0, -1], 0.3);
    A.shroud = g;
  }

  // ---------- coolant hoses with clamps ----------
  {
    const up = part(root, 'upper_hose', 'engine.upper_hose'); const ub = new Batch();
    const N = A.radNeck, rr = 1.0;
    const path = [[-3.0, 37.0, -10.4], [-5.6, 39.2, -12.6], [-9.6, 40.0, -15.6], [-12.4, 40.0, -17.8], [-14.8, 39.8, -21.0], [N.upper.x + 0.8, N.upper.y, N.upper.z]];
    ub.add('rubber', tube(path, rr, { radial: 14, tension: 0.5 }));
    ub.flush(up, mats, { cast: true, name: 'uh' });
    fast.clamp([-3.0, 37.0, -10.4], [0.2, 0.3, 1], rr); fast.clamp(V(N.upper.x + 0.6, N.upper.y, N.upper.z), [1, 0, 0], rr);
    const lo = part(root, 'lower_hose', 'engine.lower_hose'); const lb = new Batch();
    const lp = [[N.lower.x - 0.6, N.lower.y, N.lower.z], [15.6, 24.6, -19.0], [12.4, 24.0, -14.2], [6.0, 24.6, -12.2], [1.0, 25.9, -11.2]];
    lb.add('rubber', tube(lp, 1.05, { radial: 14, ridges: 0 }));
    lb.add('steelRaw', tube([[1.0, 25.9, -11.2], [-0.4, 26.6, -10.3]], 1.15, { radial: 12 }));
    lb.flush(lo, mats, { cast: true, name: 'lh' });
    fast.clamp(V(N.lower.x - 0.6, N.lower.y, N.lower.z), [1, 0, 0], 1.05); fast.clamp([1.0, 25.9, -11.2], [-1, 0.3, 0.3], 1.1);
    // heater hoses from the firewall pipes down to the rear of the passenger head
    const hh = part(root, 'heater_hoses', 'engine.heater_hoses'); const hb = new Batch();
    hb.add('rubber', tube([[4.6, 39.5, 22.6], [5.2, 40.3, 21.4], [8.0, 40.6, 19.8], [10.6, 39.6, 17.9], [12.6, 37.0, 16.8], [13.4, 34.8, 13.8]], 0.78, { radial: 10 }));
    hb.add('rubber', tube([[7.4, 39.5, 22.6], [7.8, 40.8, 21.2], [10.2, 41.0, 19.6], [12.6, 39.8, 17.6], [14.4, 37.2, 16.2], [14.6, 34.4, 12.6]], 0.78, { radial: 10 }));
    hb.flush(hh, mats, { cast: true, name: 'hh' });
    for (const [x, y, s] of [[4.6, 39.5, 22.2], [7.4, 39.5, 22.2], [13.4, 34.8, 13.8], [14.6, 34.4, 12.6]]) fast.clamp([x, y, s], [0, 0, 1], 0.78);
    // radiator overflow hose to the surge tank along the airbox side
    const ov = part(root, 'overflow_hose', 'engine.upper_hose'); const ob = new Batch();
    ob.add('rubber', tube([[A.radNeck.lower.x - 0.8, 38.2, -23.0], [15.5, 38.6, -17], [15.7, 38.4, -9], [16.6, 38.6, -6]], 0.42, { radial: 8 }));
    ob.flush(ov, mats, { name: 'ov' });
  }
  return { group: root, anchors: A };
}
