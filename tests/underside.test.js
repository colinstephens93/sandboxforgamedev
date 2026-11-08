import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildUnderside, UNDERSIDE_LABELS, UNDER, frameBottomY, leafCurve, curveLength, leafPackSpec, leafPackThickness, uBoltPath,
} from '../src/truck/underside.js';
import { QUALITY } from '../src/core/quality.js';

describe('underside pure helpers', () => {
  it('frame rail bottom is 16 in at the front and 21 in at the rear, monotonic', () => {
    expect(frameBottomY(-30)).toBeCloseTo(16, 6);
    expect(frameBottomY(0)).toBeCloseTo(16, 6);
    expect(frameBottomY(190)).toBeCloseTo(21, 6);
    let prev = -Infinity;
    for (let z = -33; z <= 192; z += 3) { const y = frameBottomY(z); expect(y).toBeGreaterThanOrEqual(prev - 1e-9); prev = y; }
  });
  it('leaf curve is a symmetric arch with the requested camber', () => {
    const c = leafCurve(58, 1.1, 24);
    expect(c.length).toBe(25);
    expect(c[0].y).toBeCloseTo(0, 9);
    expect(c[24].y).toBeCloseTo(0, 9);
    expect(c[12].y).toBeCloseTo(1.1, 9);
    for (let i = 0; i <= 24; i++) expect(c[i].y).toBeCloseTo(c[24 - i].y, 9);
    expect(curveLength(c)).toBeGreaterThan(58); // arc longer than the chord
    expect(curveLength(c)).toBeLessThan(58.5);
  });
  it('leaf pack: main leaf longest with eyes, lengths shrink, one overload leaf, sane thickness', () => {
    const p = leafPackSpec();
    expect(p[0].main).toBe(true);
    expect(p.filter((l) => l.overload).length).toBe(1);
    const mains = p.filter((l) => !l.overload);
    for (let i = 1; i < mains.length; i++) expect(mains[i].length).toBeLessThan(mains[i - 1].length);
    const t = leafPackThickness(p);
    expect(t).toBeGreaterThan(2.0); expect(t).toBeLessThan(4.0);
  });
  it('u-bolt path has two legs and a round bottom', () => {
    const pts = uBoltPath(4.1, 6);
    expect(pts[0][1]).toBe(6); expect(pts[pts.length - 1][1]).toBe(6);
    const minY = Math.min(...pts.map((p) => p[1]));
    expect(minY).toBeCloseTo(0, 6);
    expect(pts[0][0]).toBeCloseTo(-2.05, 6); expect(pts[pts.length - 1][0]).toBeCloseTo(2.05, 6);
  });
});

describe('underside labels', () => {
  it('every label has a name and a desc', () => {
    for (const [id, l] of Object.entries(UNDERSIDE_LABELS)) {
      expect(id.startsWith('truck.under.')).toBe(true);
      expect(typeof l.name).toBe('string'); expect(l.name.length).toBeGreaterThan(2);
      expect(typeof l.desc).toBe('string'); expect(l.desc.length).toBeGreaterThan(10);
    }
  });
});

describe('buildUnderside', () => {
  const quality = QUALITY.high;
  const u = buildUnderside({ quality });
  it('returns group, colliders and the anchors the integrator needs', () => {
    expect(u.group.isGroup).toBe(true);
    expect(u.colliders).toEqual([]);
    const a = u.anchors;
    expect(a.frameRailLeft.isBox3).toBe(true); expect(a.frameRailRight.isBox3).toBe(true);
    expect(a.fuelFilter.isObject3D).toBe(true);
    expect(a.tailpipeEnd.isObject3D).toBe(true);
    expect(a.strapPoints.length).toBe(4);
    expect(a.driveshaftRear.isObject3D).toBe(true);
    expect(a.driveshaftFront.isObject3D).toBe(true);
  });
  it('every labelId set on the group exists in UNDERSIDE_LABELS', () => {
    const seen = new Set();
    u.group.traverse((o) => { if (o.userData && o.userData.labelId) seen.add(o.userData.labelId); });
    expect(seen.size).toBeGreaterThan(30);
    for (const id of seen) { expect(UNDERSIDE_LABELS[id], id).toBeTruthy(); }
    // the fuel filter is labelled and anchored
    expect(seen.has('truck.under.fuelFilter')).toBe(true);
    expect(seen.has('truck.under.wifSensor')).toBe(true);
    expect(seen.has('truck.under.fuelCooler')).toBe(true);
  });
  it('fuel filter sits on the driver-side rail ahead of the fuel tank', () => {
    u.group.updateMatrixWorld(true);
    const f = u.anchors.fuelFilter.getWorldPosition(new THREE.Vector3());
    expect(f.x).toBeLessThan(0); // driver side (-X)
    expect(f.x).toBeGreaterThan(-0.65); expect(f.x).toBeLessThan(-0.35);
    let tank = null;
    u.group.traverse((o) => { if (o.userData && o.userData.labelId === 'truck.under.fuelTank') tank = new THREE.Box3().setFromObject(o); });
    expect(tank).toBeTruthy();
    expect(f.z).toBeLessThan(tank.min.z); // in front of the tank
  });
  it('frame rails are 34.5 in apart outside, with the right bottom heights', () => {
    const L = u.anchors.frameRailLeft, R = u.anchors.frameRailRight;
    expect(R.max.x - L.min.x).toBeCloseTo(34.5 * 0.0254, 3);
    expect(L.min.y).toBeCloseTo(16 * 0.0254, 3);
    expect(L.max.y).toBeGreaterThan(21 * 0.0254);
  });
  it('tailpipe end points rearward (+Z) behind the rear axle', () => {
    u.group.updateMatrixWorld(true);
    const p = u.anchors.tailpipeEnd.getWorldPosition(new THREE.Vector3());
    expect(p.z).toBeGreaterThan(3.886);
    const d = new THREE.Vector3(0, 0, 1).applyQuaternion(u.anchors.tailpipeEnd.getWorldQuaternion(new THREE.Quaternion()));
    expect(d.z).toBeGreaterThan(0.95);
  });
  it('driveshaft spinners have local X along the shaft and are near the centerline', () => {
    u.group.updateMatrixWorld(true);
    const rear = u.anchors.driveshaftRear;
    const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(rear.getWorldQuaternion(new THREE.Quaternion()));
    expect(Math.abs(dir.z)).toBeGreaterThan(0.99);
    const f = u.anchors.driveshaftFront;
    const dirF = new THREE.Vector3(1, 0, 0).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion()));
    expect(Math.abs(dirF.z)).toBeGreaterThan(0.95);
  });
  it('stays inside the truck envelope, above the floor, finite, and within the triangle budget', () => {
    u.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(u.group);
    expect(Number.isFinite(box.min.x) && Number.isFinite(box.max.z)).toBe(true);
    expect(box.min.y).toBeGreaterThan(0.18); // spare tire bottom / skid plates clear the floor
    expect(box.max.y).toBeLessThan(1.1);
    expect(box.min.z).toBeGreaterThan(-1.0);
    expect(box.max.z).toBeLessThan(5.2);
    expect(box.min.x).toBeGreaterThan(-1.05); expect(box.max.x).toBeLessThan(1.05);
    let tris = 0;
    u.group.traverse((o) => {
      if (!o.isMesh) return;
      const idx = o.geometry.index; const n = idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
      tris += n * (o.isInstancedMesh ? o.count : 1);
    });
    expect(tris).toBeLessThan(80000);
  });
  it('lower quality builds fewer triangles', () => {
    const count = (g) => { let t = 0; g.traverse((o) => { if (o.isMesh) { const n = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; t += n * (o.isInstancedMesh ? o.count : 1); } }); return t; };
    const lo = buildUnderside({ quality: QUALITY.low });
    expect(count(lo.group)).toBeLessThan(count(u.group));
  });
  it('exhaust side switch is honoured by the constants', () => {
    expect(Math.abs(UNDER.exhaustSide)).toBe(1);
  });
});
