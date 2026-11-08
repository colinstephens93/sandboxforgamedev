import { describe, it, expect } from 'vitest';
import { ENGINE_LABELS, REQUIRED_LETTERS, LETTER_OF } from '../src/truck/engine/labels.js';
import { POS, BAY, HINGE, ENGINE, leftToRightOrder } from '../src/truck/engine/layout.js';
import { beltHull, polyLength, engineShake, fanOmega, ridge, tube, smoothstep } from '../src/truck/engine/geo.js';
import { hoodPose, padOutline, padEmboss, PAD_CLIPS, PAD_TABS, PAD_NOTCH_S } from '../src/truck/hoodUnder.js';
import { hoodHalfWidth } from '../src/truck/skin.js';

describe('engine labels (supplement page 5-14)', () => {
  it('has every required letter A,B,C,D,E,F,G,H,I,J,K,L,N,O and no M', () => {
    expect(REQUIRED_LETTERS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'N', 'O']);
    for (const L of REQUIRED_LETTERS) {
      expect(LETTER_OF[L], L).toBeTruthy();
      for (const id of LETTER_OF[L]) expect(ENGINE_LABELS[id], `${L} -> ${id}`).toBeTruthy();
    }
    expect(LETTER_OF.M).toBeUndefined();
    // no label may be the clutch fluid reservoir (automatic transmission)
    for (const [id, l] of Object.entries(ENGINE_LABELS)) expect(/clutch fluid|\(M\)/i.test(l.name + l.desc), id).toBe(false);
  });
  it('every label has a name and a one-line description, ids use the engine. prefix', () => {
    for (const [id, l] of Object.entries(ENGINE_LABELS)) {
      expect(id.startsWith('engine.')).toBe(true);
      expect(l.name.length).toBeGreaterThan(3);
      expect(l.desc.length).toBeGreaterThan(10);
      expect(l.desc.includes('\n')).toBe(false);
    }
    for (const id of ['engine.dipstick_oil', 'engine.dipstick_trans', 'engine.turbo', 'engine.intercooler', 'engine.radiator', 'engine.fan', 'engine.engine_cover', 'engine.alternator', 'engine.ac_compressor', 'engine.belt', 'engine.fuse_block']) expect(ENGINE_LABELS[id], id).toBeTruthy();
    expect(ENGINE_LABELS['engine.dipstick_oil'].name).toMatch(/yellow loop/i);
    expect(ENGINE_LABELS['engine.dipstick_trans'].name).toMatch(/Allison/);
  });
  it('the fuel filter is not on the engine (driver frame rail), the CP3 label says so', () => {
    expect(ENGINE_LABELS['engine.cp3'].desc).toMatch(/frame rail/);
    expect(Object.keys(ENGINE_LABELS).some((k) => /fuel_filter/.test(k))).toBe(false);
  });
});

describe('layout follows the supplement diagram (drawn from the front: left is the passenger side)', () => {
  // left to right in the drawing: A B C(pass) D E F G H I J K L N C(driver) O  (x decreasing)
  it('passenger side stack: air cleaner, surge tank, battery, all on the passenger side and ordered front to rear', () => {
    for (const k of ['airbox', 'surgeTank', 'batteryPass']) expect(POS[k].x, k).toBeGreaterThan(14);
    expect(POS.airbox.s).toBeLessThan(POS.surgeTank.s);
    expect(POS.surgeTank.s).toBeLessThan(POS.batteryPass.s);
  });
  it('driver side: fuse block behind the battery, washer filler at the front corner, brake reservoir at the firewall', () => {
    for (const k of ['batteryDriver', 'fuseBlock', 'washerCap', 'brakeReservoir']) expect(POS[k].x, k).toBeLessThan(-12);
    expect(POS.batteryDriver.s).toBeLessThan(POS.fuseBlock.s);
    expect(POS.washerCap.s).toBeLessThan(POS.batteryDriver.s);
    expect(POS.brakeReservoir.s).toBeGreaterThan(10);
  });
  it('left to right order of the diagram labels I, J, K, L (passenger to driver)', () => {
    expect(leftToRightOrder(['remotePos', 'psReservoir', 'brakeReservoir', 'remoteNeg'])).toEqual(['psReservoir', 'remoteNeg', 'remotePos', 'brakeReservoir']);
  });
  it('D, E, G are on the passenger side of the engine, G sits driver side of the alternator pulley column, F is passenger of center at the rear', () => {
    expect(POS.restriction.x).toBeGreaterThan(POS.dipstickOil.x);
    expect(POS.dipstickOil.x).toBeGreaterThan(POS.oilCap.x);
    expect(POS.dipstickTrans.x).toBeGreaterThan(0);
    expect(POS.dipstickTrans.s).toBeGreaterThan(15); // rear of the bay, near the firewall
    expect(POS.oilCap.s).toBeLessThan(0); // front of the engine
  });
  it('everything fits between the apron walls, radiator support and firewall', () => {
    for (const [k, p] of Object.entries(POS)) {
      expect(Math.abs(p.x), k).toBeLessThan(BAY.apronHalf(p.s) + 0.5);
      expect(p.s, k).toBeGreaterThan(-30);
      expect(p.s, k).toBeLessThan(BAY.firewallS(p.y));
    }
    // the box-shaped parts also clear the apron wall with their full width
    for (const k of ['airbox', 'surgeTank', 'batteryPass', 'batteryDriver', 'fuseBlock']) {
      const p = POS[k];
      expect(Math.abs(p.x) + p.w / 2, k).toBeLessThanOrEqual(BAY.apronHalf(p.s - p.l / 2) + 0.2);
      expect(p.s + p.l / 2, k).toBeLessThan(BAY.firewallS(p.y + p.h / 2));
    }
  });
  it('parts stay under the hood pad (hood underside about 4.6 in below the skin)', () => {
    // engine cover top at its rear edge and the tallest labeled caps
    expect(ENGINE.coverRearS).toBeLessThan(ENGINE.turbo.s - 3);
    expect(POS.brakeReservoir.y).toBeLessThan(50.5);
    expect(POS.surgeCap.y).toBeLessThan(47);
  });
  it('hood hinge axis from the brief', () => {
    expect(HINGE.pivotS).toBe(19.5);
    expect(HINGE.pivotY).toBe(54.0);
    expect(HINGE.openAngleMaxDeg).toBeGreaterThanOrEqual(65);
    expect(HINGE.openAngleMaxDeg).toBeLessThanOrEqual(75);
  });
});

describe('pure helpers', () => {
  it('belt hull encloses all pulleys and is longer than the polygon of centers', () => {
    const pul = [{ x: 0, y: 21.5, r: 3.4 }, { x: 0, y: 32, r: 2.8 }, { x: 9, y: 29.4, r: 1.8 }, { x: -8, y: 27, r: 2.6 }, { x: -10.5, y: 31.8, r: 1.9 }, { x: 7, y: 22.6, r: 1.6 }];
    const hull = beltHull(pul);
    expect(hull.length).toBeGreaterThan(20);
    const len = polyLength(hull);
    let centers = 0; const order = [pul[0], pul[5], pul[2], pul[1], pul[4], pul[3]];
    for (let i = 0; i < order.length; i++) centers += Math.hypot(order[(i + 1) % 6].x - order[i].x, order[(i + 1) % 6].y - order[i].y);
    expect(len).toBeGreaterThan(centers * 0.95);
    for (const p of pul) { // every pulley circle lies inside or on the hull (check the extreme point of each)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = [p.x + dx * p.r, p.y + dy * p.r];
        // point-in-convex-polygon test with a small tolerance
        let inside = true; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) < -0.2) inside = false; }
        expect(inside).toBe(true);
      }
    }
  });
  it('engine shake follows rpm, vanishes when not running and stays tiny', () => {
    let maxIdle = 0, maxOff = 0, maxHigh = 0;
    for (let i = 0; i < 400; i++) {
      const t = i / 100; const a = engineShake(t, 680, true), b = engineShake(t, 680, false), c = engineShake(t, 3000, true);
      maxIdle = Math.max(maxIdle, Math.abs(a.dx), Math.abs(a.dy)); maxOff = Math.max(maxOff, Math.abs(b.dx), Math.abs(b.dy), Math.abs(b.roll)); maxHigh = Math.max(maxHigh, Math.abs(c.dx));
    }
    expect(maxOff).toBe(0);
    expect(maxIdle).toBeGreaterThan(0.002);
    expect(maxIdle).toBeLessThan(0.05); // inches
    expect(maxHigh).toBeGreaterThan(maxIdle * 0.9);
  });
  it('fan speed rises with rpm and duty, caps at a visual maximum, is zero at rest', () => {
    expect(fanOmega(0, 1)).toBe(0);
    expect(fanOmega(680, 0.3)).toBeGreaterThan(0);
    expect(fanOmega(1500, 1)).toBeGreaterThan(fanOmega(1500, 0.3));
    expect(fanOmega(3000, 1)).toBeLessThanOrEqual(24);
    expect(fanOmega(3000, 1)).toBeGreaterThan(fanOmega(800, 1));
  });
  it('ridge and smoothstep behave', () => {
    expect(ridge(0, 10, 0.1)).toBeCloseTo(1, 6);
    expect(ridge(0.025, 10, 0.1)).toBeCloseTo(1.1, 6);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });
  it('tube sweep returns a closed mesh with the path length recorded', () => {
    const g = tube([[0, 0, 0], [10, 0, 0], [20, 5, 0]], 0.5, { radial: 8 });
    expect(g.userData.length).toBeGreaterThan(20);
    expect(g.attributes.position.count).toBeGreaterThan(50);
    g.computeBoundingBox();
    expect(g.boundingBox.max.x).toBeGreaterThan(19.9);
    expect(Math.abs(g.boundingBox.max.y - g.boundingBox.min.y)).toBeGreaterThan(5);
  });
});

describe('hood underside helpers', () => {
  it('hoodPose keeps the hinge axis fixed and lifts the front edge', () => {
    const IN = 0.0254, py = HINGE.pivotY * IN, ps = HINGE.pivotS * IN;
    const apply = (pose, y, z) => { const c = Math.cos(pose.rotationX), s = Math.sin(pose.rotationX); return [y * c - z * s + pose.y, y * s + z * c + pose.z]; };
    const p0 = hoodPose(0); expect(p0.y).toBeCloseTo(0, 9); expect(p0.z).toBeCloseTo(0, 9);
    for (const ang of [0.3, 1.0, 70 * Math.PI / 180]) {
      const pose = hoodPose(ang);
      const [y, z] = apply(pose, py, ps); expect(y).toBeCloseTo(py, 9); expect(z).toBeCloseTo(ps, 9);
      const [fy, fz] = apply(pose, 50 * IN, -30 * IN); // a point at the front edge of the hood
      expect(fy).toBeGreaterThan(50 * IN + 0.2); // rises
      expect(fz).toBeGreaterThan(-30 * IN); // swings back toward the cab
    }
  });
  it('the insulation pad outline sits inside the hood outline, has the front recess and the rear notches', () => {
    const o = padOutline();
    expect(o.length).toBeGreaterThan(60);
    for (const [x, s] of o) { expect(Math.abs(x)).toBeLessThan(hoodHalfWidth(s) - 2.5); expect(s).toBeGreaterThan(-29); expect(s).toBeLessThan(18.5); }
    const front = o.filter(([x]) => Math.abs(x) < 4).map(([, s]) => s);
    expect(Math.min(...front)).toBeGreaterThan(-24); // recess around the latch box
    // rear notches: five tabs of the inner panel, each inside the pad width, none overlapping
    expect(PAD_TABS.length).toBe(5);
    const sorted = [...PAD_TABS].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < sorted.length; i++) { expect(Math.abs(sorted[i][0]) + sorted[i][1] / 2).toBeLessThan(22); if (i) expect(sorted[i][0] - sorted[i][1] / 2).toBeGreaterThan(sorted[i - 1][0] + sorted[i - 1][1] / 2); }
    expect(PAD_NOTCH_S).toBeLessThan(Math.max(...o.map(([, s]) => s)));
    // star-shaped about the pad center (0, -4): the angle changes monotonically around the outline, which the ring mesh needs
    const ang = o.map(([x, s]) => Math.atan2(x, s + 4)); let turns = 0; for (let i = 0; i < ang.length; i++) { let dd = ang[(i + 1) % ang.length] - ang[i]; if (dd > Math.PI) dd -= 2 * Math.PI; if (dd < -Math.PI) dd += 2 * Math.PI; if (dd > 1e-9) turns++; }
    expect(turns === 0 || turns === ang.length).toBe(true);
  });
  it('emboss field is bounded and push clips stay on the pad', () => {
    for (let x = -24; x <= 24; x += 2) for (let s = -26; s <= 16; s += 2) { const e = padEmboss(x, s); expect(e).toBeLessThanOrEqual(1.0001); expect(e).toBeGreaterThanOrEqual(-1.0001); }
    for (const [x, s] of PAD_CLIPS) { expect(Math.abs(x)).toBeLessThan(23); expect(s).toBeGreaterThan(-26); expect(s).toBeLessThan(14.4); }
  });
});
