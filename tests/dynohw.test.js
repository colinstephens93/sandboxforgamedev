import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  advanceAngle, rollerLayout, rollerSurfaceSpeed, ROLLER_R, TIRE_R, strapPoints, strapCurve, sagFor, ribbonData, ribbonFrame,
  coilCurve, pointAt, polylineLength, smoothstep, formatAir, hoseControls, bezier, approach, PIT, REAR_AXLE_Z, V,
} from '../src/shop/dyno/logic.js';
import { DYNO_LABELS } from '../src/shop/dyno/labels.js';
import { DYNO } from '../src/shop/layout.js';

describe('roller angle integration', () => {
  it('integrates omega * dt and wraps into [0, 2pi)', () => {
    let a = 0;
    for (let i = 0; i < 100; i++) a = advanceAngle(a, 10, 0.01); // 10 rad/s for 1 s
    expect(a).toBeCloseTo(10 % (2 * Math.PI), 6);
    expect(advanceAngle(0, -1, 1)).toBeCloseTo(2 * Math.PI - 1, 9);
    expect(advanceAngle(6, 1, 1)).toBeLessThan(2 * Math.PI);
  });
  it('surface speed matches a 24 in drum: 1 rad/s is 0.3048 m/s', () => {
    expect(ROLLER_R).toBeCloseTo(0.3048, 4);
    expect(rollerSurfaceSpeed(1)).toBeCloseTo(0.3048, 4);
    // 60 mph at the drum: omega = 26.82 / 0.3048
    expect(rollerSurfaceSpeed(26.8224 / 0.3048)).toBeCloseTo(26.8224, 4);
  });
  it('is frame-rate independent', () => {
    let a = 0, b = 0;
    for (let i = 0; i < 600; i++) a = advanceAngle(a, 33, 1 / 60);
    for (let i = 0; i < 100; i++) b = advanceAngle(b, 33, 0.1);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('roller cradle geometry', () => {
  const L = rollerLayout();
  it('puts the loaded tire in contact with both drums of a set', () => {
    for (const z of [L.zFront, L.zRear]) {
      const d = Math.hypot(REAR_AXLE_Z - z, L.tireY - L.cy);
      expect(d).toBeCloseTo(TIRE_R + ROLLER_R, 9);
    }
  });
  it('sets rear wheels at the 66 in track and keeps everything inside the pit', () => {
    expect(L.setX[1] - L.setX[0]).toBeCloseTo(66 * 0.0254, 6);
    const half = 36 * 0.0254 / 2;
    expect(L.setX[1] + half).toBeLessThan(PIT.hw);
    expect(L.zRear + ROLLER_R).toBeLessThan(PIT.cz + PIT.hl);
    expect(L.zFront - ROLLER_R).toBeGreaterThan(PIT.cz - PIT.hl);
    expect(L.cy - ROLLER_R).toBeGreaterThan(-PIT.depth);
    expect(L.rearAxleDrop).toBeGreaterThan(0);
    expect(L.rearAxleDrop).toBeLessThan(0.1);
  });
});

describe('strap anchors and ribbon geometry', () => {
  const { truck, floor } = strapPoints();
  it('has four straps with the specified truck attach points', () => {
    expect(truck).toHaveLength(4);
    expect(truck[0][0]).toBeCloseTo(-17 * 0.0254, 6);
    expect(truck[1][0]).toBeCloseTo(17 * 0.0254, 6);
    expect(truck[0][1]).toBeCloseTo(17 * 0.0254, 6);
    expect(truck[0][2]).toBeCloseTo(DYNO.truckOrigin.z - 32 * 0.0254, 6);
    expect(truck[2][2]).toBeCloseTo(DYNO.truckOrigin.z + 196 * 0.0254, 6);
    expect(truck[3][1]).toBeCloseTo(20 * 0.0254, 6);
  });
  it('puts floor anchors ahead of / behind the truck and outboard', () => {
    floor.forEach((f, i) => {
      expect(f[1]).toBe(0);
      expect(Math.abs(f[0])).toBeGreaterThan(Math.abs(truck[i][0]));
      if (i < 2) expect(f[2]).toBeLessThan(truck[i][2] - 1.1); else expect(f[2]).toBeGreaterThan(truck[i][2] + 0.5);
    });
    expect(Math.abs(floor[0][0]) - Math.abs(truck[0][0])).toBeCloseTo(1.2, 6);
  });
  it('sag follows the parabola arc-length relation and a taut strap is straight', () => {
    const d = 1.5, slack = 0.03, s = sagFor(d, slack);
    const pts = strapCurve([0, 1, 0], [0, 1, d], 200, s, -10);
    expect(polylineLength(pts)).toBeCloseTo(d + slack, 2);
    const taut = strapCurve([0, 1, 0], [1, 0.5, 2], 10, 0);
    taut.forEach((p, i) => { expect(p[0]).toBeCloseTo(i / 10, 9); expect(p[1]).toBeCloseTo(1 - 0.05 * i, 9); });
    expect(sagFor(2, 0)).toBe(0);
  });
  it('never dips below the floor', () => {
    const pts = strapCurve([0, 0.02, 0], [0, 0.02, 1], 20, 0.3, 0.004);
    expect(Math.min(...pts.map((p) => p[1]))).toBeGreaterThanOrEqual(0.004);
  });
  it('builds a flat ribbon of the right width with consistent topology', () => {
    const pts = strapCurve([0, 1, 0], [0.9, 0, -1.2], 20, 0.02);
    const r = ribbonData(pts, 0.05, 0.1);
    expect(r.positions.length).toBe(21 * 2 * 3);
    expect(r.indices.length).toBe(20 * 6);
    expect(Math.max(...r.indices)).toBe(41);
    for (let i = 0; i <= 20; i++) {
      const L = [r.positions[i * 6], r.positions[i * 6 + 1], r.positions[i * 6 + 2]], R = [r.positions[i * 6 + 3], r.positions[i * 6 + 4], r.positions[i * 6 + 5]];
      expect(V.len(V.sub(R, L))).toBeCloseTo(0.05, 6);
      expect(R[1]).toBeCloseTo(L[1], 6); // width axis is horizontal
      const n = [r.normals[i * 6], r.normals[i * 6 + 1], r.normals[i * 6 + 2]];
      expect(V.len(n)).toBeCloseTo(1, 5);
      const mid = V.mul(V.add(L, R), 0.5);
      expect(V.len(V.sub(mid, pts[i]))).toBeLessThan(1e-6);
    }
    expect(r.length).toBeCloseTo(polylineLength(pts), 6);
    expect(r.uvs[r.uvs.length - 1]).toBeCloseTo(r.length / 0.1, 5);
  });
  it('handles a vertical strap without NaN', () => {
    const r = ribbonData([[0, 1, 0], [0, 0.5, 0], [0, 0, 0]], 0.05);
    expect([...r.positions].every(Number.isFinite)).toBe(true);
    const f = ribbonFrame([0, -1, 0]);
    expect(V.len(f.w)).toBeCloseTo(1, 6);
  });
  it('lays a coil on the floor from the outer to the inner radius', () => {
    const c = coilCurve([1, 0, 1], 40, 0.25, 0.12, 2, 0, 0.005);
    expect(Math.hypot(c[0][0] - 1, c[0][2] - 1)).toBeCloseTo(0.25, 6);
    expect(Math.hypot(c[40][0] - 1, c[40][2] - 1)).toBeCloseTo(0.12, 6);
    expect(c.every((p) => p[1] === 0.005)).toBe(true);
    const len = polylineLength(c);
    expect(len).toBeGreaterThan(1.3); expect(len).toBeLessThan(3.2);
  });
  it('finds a point and tangent along a polyline', () => {
    const pts = [[0, 0, 0], [0, 0, 1], [1, 0, 1]];
    const m = pointAt(pts, 0.5);
    expect(m.p[2]).toBeCloseTo(1, 6); expect(m.p[0]).toBeCloseTo(0, 6);
    const e = pointAt(pts, 0.75);
    expect(e.p[0]).toBeCloseTo(0.5, 6); expect(e.tangent).toEqual([1, 0, 0]);
  });
});

describe('small helpers', () => {
  it('smoothstep and approach', () => {
    expect(smoothstep(-1)).toBe(0); expect(smoothstep(2)).toBe(1); expect(smoothstep(0.5)).toBeCloseTo(0.5, 9);
    expect(approach(0, 1, 5, 100)).toBeCloseTo(1, 6);
    expect(approach(0, 1, 5, 0)).toBe(0);
  });
  it('formats the weather display', () => {
    expect(formatAir({ tempC: 24, pressureKpa: 101, humidityPct: 45 })).toBe('24.0 C  101.0 kPa  45 % RH');
    expect(formatAir(undefined)).toContain('--');
  });
  it('hose bezier ends at the cone throat and arrives along the tailpipe axis', () => {
    const ctl = hoseControls([0, 4, 6], [-0.6, 0.45, 4.22], [0, 0, 1], 0.24, 1.4, 1);
    expect(ctl[3]).toEqual([-0.6, 0.45, 4.46]);
    expect(bezier(...ctl, 1)).toEqual(ctl[3]);
    expect(bezier(...ctl, 0)).toEqual([0, 4, 6]);
    // last control point is behind the throat on the arrival axis
    expect(ctl[2][2]).toBeGreaterThan(ctl[3][2]);
  });
});

describe('inspection labels', () => {
  it('defines every id requested by the brief, with name and a one-line description', () => {
    for (const id of ['dyno.pit', 'dyno.rollers', 'dyno.absorber', 'dyno.chocks', 'dyno.strap', 'dyno.fan', 'dyno.hose', 'dyno.weather', 'dyno.stand']) {
      expect(DYNO_LABELS[id], id).toBeTruthy();
      expect(DYNO_LABELS[id].name.length).toBeGreaterThan(3);
      expect(DYNO_LABELS[id].desc.length).toBeGreaterThan(20);
      expect(DYNO_LABELS[id].desc).not.toMatch(/\n/);
    }
  });
  it('covers every labelId used in the dyno hardware sources', () => {
    const dir = path.resolve(__dirname, '../src/shop/dyno');
    const used = new Set();
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.js') || f === 'labels.js') continue;
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/labelId\s*=\s*'([^']+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThanOrEqual(9);
    for (const id of used) expect(DYNO_LABELS[id], id).toBeTruthy();
  });
});
