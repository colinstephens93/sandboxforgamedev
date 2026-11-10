// The 6.6 L Duramax LLY itself: block, heads, valve covers, manifolds, engine cover, turbocharger, front accessory drive, fan.
// Authored in truck-frame inches. Everything built here is added to the `engine` group (it shakes on its mounts together).
import * as THREE from 'three';
import { Batch, Fasteners, T, V, tube, cylAxis, cylBetween, boxAt, rbox, polyExtrude, beltHull, beltRing, circlePts, mergeAll, lerp, D2R } from './geo.js';
import { ENGINE, POS } from './layout.js';

const part = (parent, name, labelId) => { const g = new THREE.Group(); g.name = name; if (labelId) g.userData.labelId = labelId; parent.add(g); return g; };
const SQ = Math.SQRT1_2;
// bank coordinates: u along the bank axis (up and out), w across (outward positive), s along the engine; sgn +1 passenger, -1 driver
const C = ENGINE.crank;
export const bank = (sgn, u, w, s) => V(sgn * (u + w) * SQ, C.y + (u - w) * SQ, s);
// a box in bank coordinates (center u,w,s and size du,dw,ds) -> geometry in world
function bankBox(sgn, u, w, s, du, dw, ds, r = 0.0, seg = 2) {
  const g = r > 0 ? rbox([0, 0, 0], dw, du, ds, r, seg) : new THREE.BoxGeometry(dw, du, ds);
  // local x = w direction, local y = u direction
  const p = bank(sgn, u, w, s);
  return T(g, [p.x, p.y, p.z], [0, 0, -sgn * Math.PI / 4]);
}

export function buildPowertrain({ mats, d, fast, coverDepth = 6.4 }) {
  const root = new THREE.Group(); root.name = 'engine'; root.userData.labelId = 'engine.block';
  const A = {}; // anchors
  const S0 = ENGINE.bankS0, S1 = ENGINE.bankS1, SC = (S0 + S1) / 2, SL = S1 - S0;
  const rad = Math.max(8, Math.round(16 * d));

  // ================= block, oil pan, front cover, bellhousing =================
  {
    const g = part(root, 'block', 'engine.block'); const b = new Batch();
    for (const sgn of [-1, 1]) b.add('iron', bankBox(sgn, 5.2, 0, SC, 7.5, 10.8, SL, 0.35));
    b.add('iron', boxAt([0, 20.5, SC], 15.5, 12, SL));
    // ribbed casting on the side of the block, below the manifolds
    for (const sgn of [-1, 1]) for (let i = 0; i < 6; i++) b.add('ironDark', boxAt([sgn * 10.6, 21.4, S0 + 2 + i * 3.6], 0.5, 6.0, 1.0));
    b.add('alumDark', rbox([0, 13.2, SC - 1.5], 15.5, 6.4, SL - 5, 0.6)); // oil pan (cast aluminum)
    b.add('alumDark', rbox([0, 11.6, SC - 2], 12.5, 2.4, SL - 9, 0.5));
    // timing cover (cast aluminum) with the crank snout
    b.add('alum', rbox([0, 22.0, S0 - 1.4], 15.4, 17, 2.8, 0.5));
    b.add('alumMach', cylAxis('z', [C.x, C.y, S0 - 3.2], 1.7, 1.6, 20));
    // bellhousing (cast aluminum) with the starter
    b.add('alum', cylAxis('z', [0, C.y, S1 + 5.7], 9.4, 11.4, 40, 9.9));
    b.add('alum', cylAxis('z', [0, C.y, S1 + 0.6], 9.9, 1.2, 40));
    b.add('alumDark', cylAxis('z', [-9.4, 16.8, S1 + 4.0], 2.5, 7, 16));
    b.flush(g, mats, { cast: true, name: 'block' });
    // head bolts along the deck line and bellhousing bolts
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; fast.bolt([Math.cos(a) * 9.5, C.y + Math.sin(a) * 9.5, S1 + 1.2], [0, 0, 1], 0.34); }
    for (let i = 0; i < 6; i++) fast.bolt([-7.5 + i * 3, 16.6, S0 - 2.85], [0, 0, -1], 0.3);
  }

  // ================= heads, valve covers, exhaust manifolds =================
  const coverLabel = [];
  for (const sgn of [-1, 1]) {
    const side = sgn > 0 ? 'passenger' : 'driver';
    const g = part(root, `bank_${side}`, 'engine.block');
    const b = new Batch();
    // cylinder head (cast aluminum) with intake/exhaust port bosses
    b.add('alum', bankBox(sgn, 11.2, 0, SC, 4.4, 11.8, SL - 0.4, 0.25));
    b.add('alumDark', bankBox(sgn, 9.2, 0, SC, 0.5, 12.2, SL + 0.2, 0.1)); // gasket line / deck
    b.flush(g, mats, { cast: true, name: 'head' });
    // valve cover
    const vc = part(g, `valve_cover_${side}`, 'engine.valve_cover'); const vb = new Batch();
    vb.add('alum', bankBox(sgn, 14.8, 0, SC, 2.6, 10.0, SL - 1.2, 0.5, 3));
    vb.add('alumMach', bankBox(sgn, 16.0, 0, SC, 0.12, 9.6, SL - 1.8, 0.05)); // machined sealing rail
    // raised oil-fill-style ribs along the cover
    for (let i = 0; i < 5; i++) vb.add('alumMach', bankBox(sgn, 16.05, 0.4 + (i - 2) * 1.5, SC, 0.14, 0.3, SL - 4));
    // injector harness pass-through plate and four connector bodies on the inner top edge
    vb.add('plastic', bankBox(sgn, 16.12, -3.6, SC + 2.5, 0.4, 1.3, 11.5, 0.1));
    for (let i = 0; i < 4; i++) {
      const sc = S0 + 3.2 + i * 4.8;
      vb.add('plastic', bankBox(sgn, 16.55, -3.6, sc, 1.0, 1.5, 2.1, 0.12));
      vb.add('plastic', bankBox(sgn, 16.0, -4.7, sc, 0.9, 0.9, 1.4, 0.1));
    }
    vb.flush(vc, mats, { cast: true, name: 'vc' });
    for (let i = 0; i < 6; i++) for (const w of [-3.7, 3.7]) fast.bolt(bank(sgn, 16.05, w, S0 + 1.4 + i * 3.7), [sgn * SQ, SQ, 0], 0.3);
    // exhaust manifold on the outside of the head
    const em = part(g, `exhaust_manifold_${side}`, 'engine.exhaust_manifold'); const eb = new Batch();
    eb.add('manifold', bankBox(sgn, 11.4, 8.1, SC + 0.5, 2.8, 3.3, SL - 3.5, 0.9, 3));
    for (let i = 0; i < 4; i++) eb.add('manifold', bankBox(sgn, 11.4, 6.6, S0 + 2.2 + i * 4.4 + (i > 1 ? 1.0 : 0), 3.4, 2.2, 3.0, 0.35));
    eb.add('manifold', bankBox(sgn, 11.4, 8.6, S1 - 1.2, 3.6, 3.8, 2.5, 0.8));
    eb.flush(em, mats, { cast: true, name: 'em' });
    for (let i = 0; i < 4; i++) { const p = bank(sgn, 11.4, 6.9, S0 + 2.2 + i * 4.4 + (i > 1 ? 1.0 : 0)); fast.bolt(V(p.x, p.y, p.z + 1.7), [0, 0, 1], 0.3); fast.bolt(V(p.x, p.y, p.z - 1.7), [0, 0, -1], 0.3); }
    // stamped aluminum heat shield over the top of the manifold
    const hs = part(g, `manifold_shield_${side}`, 'engine.heat_shield');
    const hb = new Batch(); hb.add('heatShield', bankBox(sgn, 13.2, 8.2, SC + 0.5, 0.12, 4.4, SL - 4.5, 0.05));
    for (let i = 0; i < 3; i++) hb.add('heatShield', bankBox(sgn, 13.4, 8.2, SC - 6 + i * 6, 0.3, 4.4, 0.4));
    hb.flush(hs, mats, { name: 'hs' });
  }

  // ================= intake manifold (valley) =================
  {
    const g = part(root, 'intake_manifold', 'engine.intake_manifold'); const b = new Batch();
    const prof = [[-2.2, 29.2], [2.2, 29.2], [6.0, 33.0], [7.3, 36.3], [6.4, 38.2], [4.2, 39.0], [-4.2, 39.0], [-6.4, 38.2], [-7.3, 36.3], [-6.0, 33.0]];
    const len = 14.5;
    b.add('alum', T(polyExtrude(prof, len, 0.4), [0, 0, S0 + 1.2 + len / 2]));
    // front air inlet elbow (rubber boot from the intercooler return pipe) and the throttle-less inlet flange
    b.add('alumMach', cylAxis('z', [3.4, 36.0, S0 + 0.4], 2.2, 1.6, 20));
    // 8 runner humps on the sides
    for (let i = 0; i < 4; i++) for (const sgn of [-1, 1]) b.add('alum', rbox([sgn * 6.9, 35.3, S0 + 3.6 + i * 3.4], 1.8, 3.4, 2.4, 0.5));
    b.flush(g, mats, { cast: true, name: 'im' });
    // EGR / pressure sensor on the top rear
    const sb = new Batch(); sb.add('plastic', rbox([4.2, 39.7, S0 + 9.5], 1.8, 1.6, 1.8, 0.3)); sb.add('plastic', cylAxis('y', [-4.4, 39.6, S0 + 5.2], 0.7, 1.4, 12)); sb.flush(g, mats, { name: 'sens' });
    A.manifoldInlet = V(3.4, 36.0, S0 - 0.4);
  }

  // ================= CP3 pump, rail lines (no fuel filter on the engine) =================
  {
    const g = part(root, 'cp3', 'engine.cp3'); const b = new Batch();
    b.add('ironDark', cylAxis('z', [-0.5, 33.2, S0 + 1.3], 2.3, 4.2, 20));
    b.add('alumMach', cylAxis('z', [-0.5, 33.2, S0 - 1.0], 1.2, 1.2, 14));
    b.add('steelBlack', rbox([-0.5, 36.1, S0 + 1.3], 2.6, 1.7, 3.6, 0.4));
    b.add('alumMach', cylAxis('x', [-0.5, 33.2, S0 + 3.6], 0.5, 6.0, 8));
    b.add('plastic', rbox([2.6, 35.2, S0 + 1.8], 1.6, 1.4, 2.2, 0.3));
    for (const sgn of [-1, 1]) b.add('alumPipe', tube([[sgn * 1.5, 34.8, S0 + 2.4], [sgn * 4.2, 36.2, S0 + 4.6], [sgn * 9.2, 35.5, S0 + 4.6]], 0.34, { radial: 8 }));
    b.add('steelRaw', tube([[-0.5, 32.6, S0 - 0.2], [-3.6, 31.4, S0 - 1.2], [-6.5, 30.8, S0 - 1.4]], 0.3, { radial: 8 }));
    b.flush(g, mats, { cast: true, name: 'cp3' });
  }

  // ================= engine cover =================
  {
    const g = part(root, 'engine_cover', 'engine.engine_cover');
    const K = 0.94; // narrower than the valley between the valve covers
    const pts = [[-2.8, 4.0], [3.4, 4.0], [7.4, 3.0], [8.4, -1.5], [8.4, -7.0], [5.0, -10.5], [-5.6, -10.5], [-8.4, -7.2], [-8.4, -1.0], [-8.0, 2.6]].map(([x, y]) => [x * K, y]); // (x, -s) outline
    const s0 = -4.0, s1 = 10.5, slope = (45.2 - 41.0) / (s1 - s0);
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    // coverDepth: how far the shell reaches down from its top (the real cover is a thin lid; the simple engine used a deep one)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: coverDepth, bevelEnabled: true, bevelThickness: 0.55, bevelSize: 0.5, bevelSegments: 4, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2); // shape y -> -z (outline holds -s), extrusion z -> +y
    geo.translate(0, 34.05 + 6.4 - coverDepth, 0);
    const pos = geo.attributes.position;
    // sloped top: shear the upper part upward with s so the cover rises toward the firewall
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), s = pos.getZ(i), k = Math.min(1, Math.max(0, (y - 36.5) / 3.0));
      pos.setY(i, y + k * (s - s0) * slope);
    }
    geo.computeVertexNormals();
    // planar UVs from the top view so the lettering reads from the front of the truck; side walls sample the plain rim
    const nrm = geo.attributes.normal, uv = [], W = 8.4 * K * 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), s = pos.getZ(i);
      if (nrm.getY(i) > 0.35) uv.push((8.4 * K - x) / W, (s - s0) / (s1 - s0)); else uv.push(0.012, 0.012);
    }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geo, mats.cover); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'cover_shell'; g.add(mesh);
    // rubber grommets at the cover posts
    const b = new Batch();
    b.add('rubber', cylAxis('y', [-5.6, 41.2, 0.2], 0.55, 0.5, 10)); b.add('rubber', cylAxis('y', [5.8, 41.0, -1.0], 0.55, 0.5, 10)); b.add('rubber', cylAxis('y', [0.5, 44.9, 9.4], 0.55, 0.5, 10));
    b.flush(g, mats, { name: 'cov' });
    A.engineCover = g;
  }

  // ================= oil fill neck and cap (G), oil dipstick (E) =================
  {
    const p = POS.oilCap, g = part(root, 'oil_fill', 'engine.oil_cap'); const b = new Batch();
    b.add('plastic', cylAxis('y', [p.x, p.y - 2.6, p.s], 1.55, 5.4, rad));
    b.add('plastic', cylAxis('y', [p.x, p.y + 0.3, p.s], 1.85, 1.3, rad)); // cap
    b.add('plastic', cylAxis('y', [p.x, p.y + 1.05, p.s], 1.55, 0.3, rad));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.add('plastic', boxAt([p.x + Math.cos(a) * 1.85, p.y + 0.3, p.s + Math.sin(a) * 1.85], 0.28, 1.1, 0.5, [0, -a, 0])); }
    b.add('alum', rbox([p.x, p.y - 6.4, p.s + 0.5], 3.8, 3.0, 3.6, 0.5)); // bracket / front cover boss
    b.flush(g, mats, { cast: true, name: 'oilcap' });
    // printed cap marking
    const dm = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), mats.decal('oilcap')); dm.rotation.x = -Math.PI / 2; dm.position.set(p.x, p.y + 1.22, p.s); g.add(dm);
    A.oilCap = g;
    // yellow-loop dipstick: tube from the timing cover up the passenger front of the block
    const e = POS.dipstickOil, d2 = part(root, 'dipstick_oil', 'engine.dipstick_oil'); const eb = new Batch();
    eb.add('steelRaw', tube([[e.x, 19.0, e.s + 0.2], [e.x, 26.5, e.s], [e.x - 0.2, e.y - 1.6, e.s - 0.1]], 0.42, { radial: 8 }));
    eb.add('yellow', tube([[e.x, e.y - 1.4, e.s - 0.1], [e.x, e.y - 0.3, e.s - 0.1], [e.x - 0.9, e.y + 0.9, e.s - 0.1], [e.x - 2.0, e.y + 0.9, e.s - 0.1], [e.x - 2.6, e.y - 0.1, e.s - 0.1], [e.x - 2.0, e.y - 1.1, e.s - 0.1], [e.x - 0.9, e.y - 1.1, e.s - 0.1]], 0.3, { radial: 8, tension: 0.5 }));
    eb.add('yellow', cylAxis('y', [e.x, e.y - 1.6, e.s - 0.1], 0.55, 0.9, 10));
    eb.flush(d2, mats, { name: 'dip' });
    A.dipstickOil = d2;
  }

  // ================= front accessory drive =================
  const BP = -13.2; // belt plane (s)
  const PUL = {
    crank: { x: 0, y: 21.5, r: 3.3 }, water: { x: 0, y: 31.2, r: 2.7 }, alt: { x: 9.0, y: 29.4, r: 1.7 },
    ac: { x: -8.0, y: 27.0, r: 2.5 }, ps: { x: -10.5, y: 31.8, r: 1.75 }, tens: { x: 7.0, y: 22.6, r: 1.45 },
  };
  A.pulleys = PUL;
  {
    const g = part(root, 'belt', 'engine.belt');
    const hull = beltHull(Object.values(PUL).map((p) => ({ x: p.x, y: p.y, r: p.r + 0.12 })));
    const b = new Batch(); b.add('rubber', T(beltRing(hull, 0.16, 1.15), [0, 0, BP]));
    b.flush(g, mats, { name: 'belt' });
    A.beltLen = hull.length;
  }
  {
    // pulleys and the crank damper
    const g = part(root, 'pulleys', 'engine.belt'); const b = new Batch();
    b.add('ironDark', cylAxis('z', [PUL.crank.x, PUL.crank.y, BP - 0.2], PUL.crank.r, 1.7, 36));
    b.add('steelBlack', cylAxis('z', [PUL.crank.x, PUL.crank.y, BP - 1.2], PUL.crank.r * 0.78, 0.5, 30));
    b.add('alumMach', cylAxis('z', [PUL.crank.x, PUL.crank.y, BP - 1.6], 1.0, 0.4, 14));
    for (const k of ['ac', 'ps', 'alt']) { const p = PUL[k]; b.add('steelRaw', cylAxis('z', [p.x, p.y, BP], p.r, 1.5, 28)); b.add('steelRaw', cylAxis('z', [p.x, p.y, BP - 0.9], p.r * 0.55, 0.4, 20)); }
    b.flush(g, mats, { name: 'pul' });
    // water pump with fan hub (H labels the fan itself; the pump has its own label)
    const wp = part(root, 'water_pump', 'engine.water_pump'); const wb = new Batch();
    wb.add('alum', cylAxis('z', [PUL.water.x, PUL.water.y, S0 - 1.6], 3.6, 2.4, 30));
    wb.add('steelRaw', cylAxis('z', [PUL.water.x, PUL.water.y, BP], PUL.water.r, 1.4, 28));
    wb.add('alumMach', cylAxis('z', [PUL.water.x, PUL.water.y, BP - 1.4], 1.3, 1.6, 14));
    wb.add('alum', rbox([-0.6, 28.6, S0 - 1.0], 7.4, 4.4, 4.0, 0.6)); // pump housing and thermostat housing top
    wb.add('alum', rbox([-2.8, 35.4, S0 - 1.2], 4.0, 3.2, 3.4, 0.6));
    wb.flush(wp, mats, { cast: true, name: 'wp' });
    // belt tensioner with its spring-loaded arm
    const tn = part(root, 'tensioner', 'engine.tensioner'); const tb = new Batch();
    tb.add('steelBlack', rbox([PUL.tens.x + 0.3, PUL.tens.y + 1.6, BP + 1.4], 2.2, 5.2, 0.8, 0.3, 2, [0, 0, -0.5]));
    tb.add('alumDark', cylAxis('z', [PUL.tens.x + 0.9, PUL.tens.y + 3.4, BP + 1.6], 1.6, 1.6, 20));
    tb.add('steelRaw', cylAxis('z', [PUL.tens.x, PUL.tens.y, BP], PUL.tens.r, 1.5, 24));
    tb.add('steelRaw', cylAxis('z', [PUL.tens.x, PUL.tens.y, BP - 0.9], 0.55, 0.4, 12));
    tb.flush(tn, mats, { name: 'tens' });
  }

  // alternator (passenger side), with a finned rear housing, regulator and battery stud
  {
    const g = part(root, 'alternator', 'engine.alternator'); const b = new Batch(); const p = PUL.alt;
    const s0 = BP + 0.9, s1 = S0 + 0.4, L = s1 - s0, mc = (s0 + s1) / 2;
    b.add('alumDark', cylAxis('z', [p.x, p.y, mc], 2.6, L, rad));
    b.add('alum', cylAxis('z', [p.x, p.y, s0 + 0.9], 2.75, 1.8, rad));
    b.add('alum', cylAxis('z', [p.x, p.y, s1 - 1.0], 2.75, 2.0, rad));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; b.add('steelBlack', boxAt([p.x + Math.cos(a) * 2.78, p.y + Math.sin(a) * 2.78, s0 + 0.9], 0.45, 0.28, 1.0, [0, 0, a])); }
    b.add('plastic', rbox([p.x - 0.5, p.y + 3.3, mc + 0.8], 2.4, 1.4, 2.2, 0.3));
    b.add('alum', rbox([p.x + 1.6, p.y - 3.1, mc], 4.2, 1.2, 3.4, 0.3));
    b.add('zincGold', cylAxis('z', [p.x + 0.6, p.y - 0.4, s1 + 0.8], 0.28, 1.4, 8));
    b.add('rubber', cylAxis('z', [p.x + 0.6, p.y - 0.4, s1 + 0.1], 0.6, 0.6, 12));
    b.flush(g, mats, { cast: true, name: 'alt' });
    A.alternator = g;
  }
  // power steering pump + reservoir (I)
  {
    const g = part(root, 'ps_pump', 'engine.ps_pump'); const b = new Batch(); const p = PUL.ps;
    b.add('alumDark', cylAxis('z', [p.x, p.y, BP + 2.9], 2.2, 4.4, rad));
    b.add('alum', rbox([p.x, p.y - 1.0, BP + 4.9], 4.6, 4.6, 2.2, 0.5));
    b.add('steelBlack', rbox([p.x + 2.3, p.y - 3.0, BP + 3.4], 1.4, 3.6, 5, 0.3));
    b.flush(g, mats, { cast: true, name: 'ps' });
    const r = POS.psReservoir, rg = part(root, 'ps_reservoir', 'engine.ps_reservoir'); const rb = new Batch();
    rb.add('plastic', cylAxis('y', [r.x, 35.9, r.s], 1.95, 3.8, rad));
    rb.add('plastic', cylAxis('y', [r.x, r.y - 0.1, r.s], 1.55, 0.7, rad));
    rb.add('plastic', cylAxis('y', [r.x, r.y + 0.4, r.s], 1.5, 0.5, rad));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; rb.add('plastic', boxAt([r.x + Math.cos(a) * 1.55, r.y + 0.2, r.s + Math.sin(a) * 1.55], 0.26, 0.9, 0.45, [0, -a, 0])); }
    rb.flush(rg, mats, { cast: true, name: 'psres' });
    A.psReservoir = rg;
  }
  // A/C compressor (driver side) with the rear head and the two line ports
  {
    const g = part(root, 'ac_compressor', 'engine.ac_compressor'); const b = new Batch(); const p = PUL.ac;
    b.add('alumDark', cylAxis('z', [p.x, p.y, BP + 2.2], 2.95, 4.4, rad));
    b.add('alum', cylAxis('z', [p.x, p.y, BP + 4.6], 3.05, 1.0, rad));
    b.add('alum', rbox([p.x + 0.3, p.y - 0.3, BP + 5.6], 5.4, 5.6, 2.0, 0.7));
    b.add('steelBlack', cylAxis('z', [p.x, p.y, BP + 0.2], 2.6, 1.0, rad)); // clutch coil
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.add('alumMach', boxAt([p.x + Math.cos(a) * 3.0, p.y + Math.sin(a) * 3.0, BP + 2.4], 0.5, 0.5, 2.6, [0, 0, a])); }
    b.add('alumMach', cylAxis('y', [p.x + 0.6, p.y + 3.4, BP + 5.6], 0.55, 1.6, 10));
    b.add('alumMach', cylAxis('y', [p.x - 1.2, p.y + 3.4, BP + 5.6], 0.75, 1.6, 10));
    b.add('alum', rbox([p.x - 3.6, p.y - 0.2, BP + 2.8], 1.0, 5.4, 4.0, 0.3)); // mounting ear
    b.flush(g, mats, { cast: true, name: 'ac' });
    A.acCompressor = g;
    // the two refrigerant lines: aluminum tube with a rubber section, up and over the front of the engine
    const lb = new Batch();
    lb.add('alumPipe', tube([[p.x - 1.2, p.y + 4.2, BP + 5.6], [p.x - 1.4, p.y + 7.6, BP + 5.2], [-3.5, 37.6, BP + 1.4], [2.8, 39.2, BP + 1.2], [8.0, 39.5, BP + 0.8], [12.0, 38.6, BP - 0.8]], 0.42, { radial: 8 }));
    lb.add('rubber', tube([[12.0, 38.6, BP - 0.8], [13.4, 37.6, BP - 3.6], [13.6, 35.6, BP - 6.0]], 0.5, { radial: 8 }));
    lb.add('alumPipe', tube([[p.x + 0.6, p.y + 4.2, BP + 5.6], [p.x + 0.8, p.y + 6.6, BP + 5.4], [-1.6, 36.0, BP + 4.6], [3.6, 37.0, BP + 3.8]], 0.3, { radial: 8 }));
    lb.add('alumMach', cylAxis('y', [-3.5, 37.6, BP + 1.4], 0.62, 0.7, 10)); lb.add('alumMach', cylAxis('y', [8.0, 39.5, BP + 0.8], 0.62, 0.7, 10));
    lb.flush(g, mats, { name: 'aclines' });
    fast.clamp([13.4, 37.6, BP - 3.6], [0.3, -0.2, -1], 0.5);
  }
  // remote jump-start posts (J negative, K positive with the red cap) on a bracket at the front of the driver head
  {
    const pj = POS.remoteNeg, pk = POS.remotePos;
    const br = part(root, 'jump_bracket', 'engine.remote_pos'); const bb = new Batch();
    bb.add('steelBlack', rbox([-12.4, 31.8, S0 - 0.45], 4.4, 6.4, 0.5, 0.15));
    bb.flush(br, mats, { name: 'jbr' });
    const gj = part(root, 'remote_neg', 'engine.remote_neg'); const jb = new Batch();
    jb.add('zincGold', cylAxis('y', [pj.x, pj.y, pj.s], 0.34, 1.5, 10)); jb.add('alumMach', cylAxis('y', [pj.x, pj.y - 0.8, pj.s], 0.7, 0.7, 8)); jb.add('steelRaw', rbox([pj.x, pj.y - 1.7, pj.s + 0.35], 1.6, 0.9, 0.6, 0.2));
    jb.add('plastic', cylAxis('y', [pj.x, pj.y + 0.85, pj.s], 0.46, 0.4, 10));
    jb.flush(gj, mats, { name: 'rn' });
    A.remoteNeg = gj;
    const gk = part(root, 'remote_pos', 'engine.remote_pos'); const kb = new Batch();
    kb.add('red', rbox([pk.x, pk.y, pk.s], 2.1, 2.0, 2.0, 0.45)); // hinged cover
    kb.add('red', rbox([pk.x, pk.y + 1.05, pk.s - 0.5], 2.1, 0.3, 1.2, 0.1));
    kb.add('steelBlack', rbox([pk.x, pk.y - 1.9, pk.s + 0.4], 2.4, 1.8, 0.6, 0.15));
    kb.add('cableRed', tube([[pk.x + 0.9, pk.y - 0.8, pk.s + 0.6], [pk.x + 2.2, pk.y - 2.5, pk.s + 2.2], [pk.x + 3.4, pk.y - 5, pk.s + 5.4]], 0.34, { radial: 8 }));
    kb.flush(gk, mats, { name: 'rp' });
    A.remotePos = gk;
  }

  // ================= fan: clutch, 8 blades, spins about the s axis =================
  {
    const fp = POS.fan, fg = part(root, 'fan', 'engine.fan'); fg.position.set(fp.x, fp.y, 0);
    const spin = new THREE.Group(); spin.name = 'fan_spin'; fg.add(spin);
    const b = new Batch();
    // thermostatic fan clutch: silver finned drum, bimetal spiral cap on the front, hub with the blade bolts
    b.add('alum', cylAxis('z', [0, 0, -15.0], 3.0, 2.3, 32));
    b.add('alumDark', cylAxis('z', [0, 0, -16.5], 3.2, 1.0, 32));
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; b.add('alumDark', boxAt([Math.cos(a) * 3.05, Math.sin(a) * 3.05, -15.0], 0.34, 0.34, 2.2, [0, 0, a])); }
    b.add('alumMach', cylAxis('z', [0, 0, -17.4], 2.0, 0.9, 24));
    b.add('steelBlack', cylAxis('z', [0, 0, -17.9], 1.4, 0.3, 24));
    b.add('steelBlack', cylAxis('z', [0, 0, -18.3], 3.2, 0.7, 24)); // blade carrier
    // blades: swept, twisted, cambered 8-blade fan, 19 in diameter
    const blade = (() => {
      const rows = 8, cols = 4, P = [], I = [];
      for (let j = 0; j <= rows; j++) {
        const t = j / rows, r = lerp(3.4, 9.2, t), chord = lerp(2.6, 3.4, Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5)) * (1 - 0.18 * t * t), pitch = lerp(0.62, 0.36, t), sweep = 0.9 * t * t;
        for (let i = 0; i <= cols; i++) {
          const u = i / cols - 0.5, camb = 0.12 * (1 - 4 * u * u) * chord;
          const x = r, y = u * chord + sweep, z = camb;
          const yy = y * Math.cos(pitch) - z * Math.sin(pitch), zz = y * Math.sin(pitch) + z * Math.cos(pitch);
          P.push(x, yy, zz);
        }
      }
      const ps = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, bb = a + 1, c = a + cols + 2, dd = a + cols + 1; I.push(a, bb, dd, bb, c, dd); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
      // second surface offset for thickness, plus root lug
      const g2 = g.clone(); g2.translate(0, 0, -0.14); g2.scale(1, 1, 1);
      const back = g2.clone(); const idx = back.index.array; for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } back.computeVertexNormals();
      return [g, back];
    })();
    const blades = [];
    for (let k = 0; k < 8; k++) for (const bg of blade) blades.push(T(bg.clone(), [0, 0, -18.7], [0, 0, (k / 8) * Math.PI * 2]));
    b.add('fan', mergeAll(blades));
    b.flush(spin, mats, { cast: true, name: 'fanbody' });
    A.fan = fg; A.fanSpin = spin;
  }

  return { group: root, anchors: A };
}
