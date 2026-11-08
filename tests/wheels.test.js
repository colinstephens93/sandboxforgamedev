// Wheel and tire: pure helpers and DOM-free geometry only (buildWheel needs canvases for its textures and is checked visually).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { spec, IN } from '../src/data/truckSpec.js';
import {
  boltCircle, pitchSequence, tireProfile, tireDimensions, treadRows, lateralDepth, sidewallRows, lathe, barrelProfile,
  buildTreadGeometry, buildSidewallGeometry, WHEEL_DIM, WHEEL_LABELS, HUB_HEIGHT_IN, DEFLECTION_IN,
} from '../src/truck/wheels.js';

describe('bolt circle', () => {
  it('has 8 lugs equally spaced on 165.1 mm (6.5 in)', () => {
    const b = boltCircle();
    expect(b.length).toBe(8);
    expect(spec.tires.lugs).toBe(8);
    for (const p of b) expect(Math.hypot(p.y, p.z)).toBeCloseTo(0.08255, 6);
    for (let i = 0; i < 8; i++) {
      const a = b[i], c = b[(i + 1) % 8];
      const dot = (a.y * c.y + a.z * c.z) / (a.r * c.r);
      expect(Math.acos(dot)).toBeCloseTo(Math.PI / 4, 6);
    }
    // adjacent lug spacing on a 6.5 in circle: 2 R sin(22.5 deg)
    const d = Math.hypot(b[0].y - b[1].y, b[0].z - b[1].z);
    expect(d).toBeCloseTo(2 * 0.08255 * Math.sin(Math.PI / 8), 6);
    expect(WHEEL_DIM.boltRadius * 2).toBeCloseTo(6.5 * IN, 4);
  });
  it('first lug is at the top (phase 0) and phase rotates all of them', () => {
    expect(boltCircle()[0].y).toBeCloseTo(0.08255, 6);
    const r = boltCircle(8, 0.08255, Math.PI / 8);
    expect(r[0].angle).toBeCloseTo(Math.PI / 8, 9);
  });
});

describe('tire profile (LT245/75R16)', () => {
  it('overall diameter is 30.5 in and width is 9.8 in', () => {
    const d = tireDimensions();
    expect(d.diameter / IN).toBeGreaterThan(30.3);
    expect(d.diameter / IN).toBeLessThan(30.7);
    expect(d.width / IN).toBeGreaterThan(9.6);
    expect(d.width / IN).toBeLessThan(10.0);
    expect(d.diameter / IN).toBeCloseTo(spec.tires.overallDiameterIn, 1);
  });
  it('sidewall height matches 75 percent of 245 mm and the bead sits on the 16 in rim', () => {
    const p = tireProfile();
    const crown = p.r[0], bead = p.r[p.N];
    expect((crown - 8 * IN) * 1000).toBeGreaterThan(0.75 * 245 - 6);
    expect((crown - 8 * IN) * 1000).toBeLessThan(0.75 * 245 + 6);
    expect(bead / IN).toBeGreaterThan(8.2);
    expect(bead / IN).toBeLessThan(9.0);
  });
  it('profile is continuous: arc-length samples are evenly spaced, crown is flat', () => {
    const p = tireProfile();
    const a = p.at(0), b = p.at(0.001);
    expect(Math.abs(a.tr)).toBeLessThan(0.05);
    expect(a.nr).toBeGreaterThan(0.95);
    expect(p.L / IN).toBeGreaterThan(11);
    expect(b.r).toBeLessThanOrEqual(a.r + 1e-6);
  });
  it('rolling geometry: 14.5 in center height, 0.75 in deflection, loaded radius near the spec rolling radius', () => {
    expect(HUB_HEIGHT_IN).toBe(14.5);
    expect(WHEEL_DIM.tireRadius / IN - DEFLECTION_IN).toBeCloseTo(HUB_HEIGHT_IN, 6);
    expect(Math.abs(HUB_HEIGHT_IN - spec.tires.rollingRadiusIn)).toBeLessThan(0.5);
  });
});

describe('tread', () => {
  it('pitch sequence: n pitches summing to 360 deg with three lengths and no long runs', () => {
    const s = pitchSequence(54);
    expect(s.length).toBe(54);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(2 * Math.PI, 9);
    const uniq = new Set(s.map((v) => v.toFixed(6)));
    expect(uniq.size).toBe(3);
    expect(Math.max(...s) / Math.min(...s)).toBeLessThan(1.5);
    let run = 1, maxRun = 1;
    for (let i = 1; i < s.length; i++) { run = Math.abs(s[i] - s[i - 1]) < 1e-9 ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
    expect(maxRun).toBeLessThanOrEqual(3);
    expect(pitchSequence(54)).toEqual(s); // deterministic
  });
  it('has 4 circumferential grooves in symmetric rows', () => {
    const rows = treadRows();
    const sig = (r) => rows.filter((x) => x.kind === 'floor' && r(x.S));
    const floorsPos = rows.filter((x) => x.kind === 'floor' && x.S > 0);
    const floorsNeg = rows.filter((x) => x.kind === 'floor' && x.S < 0);
    expect(floorsPos.length).toBe(4); // two floor rows per groove, two grooves per half
    expect(floorsNeg.length).toBe(4);
    expect(sig(() => true).length).toBe(8);
    for (let i = 0; i < rows.length; i++) expect(rows[i].S).toBeCloseTo(-rows[rows.length - 1 - i].S, 9);
    for (let i = 1; i < rows.length; i++) expect(rows[i].S).toBeGreaterThan(rows[i - 1].S);
  });
  it('lateral grooves: none in the center rib, tapering out at the tread end', () => {
    expect(lateralDepth(0.4, 'c')).toBe(0);
    expect(lateralDepth(2, 'i')).toBeGreaterThan(0.5);
    expect(lateralDepth(3.5, 's')).toBe(1);
    expect(lateralDepth(5.3, 's')).toBeCloseTo(0, 6);
  });
  it('tread geometry is a closed grid with 11 mm of depth and no triangle faces inward', () => {
    const g = buildTreadGeometry({ pitches: 36 });
    const pos = g.getAttribute('position');
    const R = WHEEL_DIM.tireRadius;
    let rmax = 0, rmin = 1;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getY(i), pos.getZ(i));
      if (Math.abs(pos.getX(i)) < 0.05) { rmax = Math.max(rmax, r); rmin = Math.min(rmin, r); }
    }
    expect(rmax / IN).toBeCloseTo(15.25, 1);
    expect((rmax - rmin) * 1000).toBeCloseTo(spec.tires.treadDepthMm, 0);
    expect(rmax).toBeLessThanOrEqual(R + 1e-4);
    // outward-facing: the geometric normal of crown triangles points away from the axle
    const idx = g.index.array;
    let outward = 0, total = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      a.fromBufferAttribute(pos, idx[t]); b.fromBufferAttribute(pos, idx[t + 1]); c.fromBufferAttribute(pos, idx[t + 2]);
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      if (n.lengthSq() < 1e-14 || Math.abs(a.x) > 0.04) continue; // crown only
      const centroid = a.clone().add(b).add(c).divideScalar(3); centroid.x = 0;
      total++; if (n.dot(centroid) > 0) outward++;
    }
    expect(total).toBeGreaterThan(100);
    expect(outward / total).toBeGreaterThan(0.99);
  });
  it('triangle budget: tread plus both sidewalls stay under 35k triangles at high quality', () => {
    const t = buildTreadGeometry({ pitches: 66 }).index.count / 3;
    const o = buildSidewallGeometry({ seg: 144 }).index.count / 3;
    const i = buildSidewallGeometry({ seg: 72, stepA: 0.72, stepB: 0.24, inner: true }).index.count / 3;
    expect(t + o + i).toBeLessThan(35000);
  });
});

describe('sidewall and barrel geometry', () => {
  it('sidewall rows run from the tread end to the bead with the ridge zone refined', () => {
    const rows = sidewallRows();
    expect(rows[0]).toBeCloseTo(5.3 * IN, 9);
    expect(rows[rows.length - 1]).toBeCloseTo(tireProfile().L, 9);
    for (let i = 1; i < rows.length; i++) expect(rows[i]).toBeGreaterThan(rows[i - 1]);
  });
  it('sidewall faces outward on the outer side and the vertex normal agrees with the face', () => {
    const g = buildSidewallGeometry({ seg: 48 });
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), idx = g.index.array;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
    let agree = 0, total = 0;
    for (let t = 0; t < idx.length; t += 3) {
      a.fromBufferAttribute(pos, idx[t]); b.fromBufferAttribute(pos, idx[t + 1]); c.fromBufferAttribute(pos, idx[t + 2]);
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      if (n.lengthSq() < 1e-14) continue;
      nn.fromBufferAttribute(nor, idx[t]);
      total++; if (n.dot(nn) > 0) agree++;
    }
    expect(agree / total).toBeGreaterThan(0.99);
    const inner = buildSidewallGeometry({ seg: 48, inner: true });
    expect(inner.getAttribute('position').getX(0)).toBeLessThan(0);
  });
  it('lathe: the barrel is a closed loop whose rim lip normal points outward and which sits on the 16 in bead seat', () => {
    const prof = barrelProfile();
    const g = lathe(prof, 24, { flip: true, crease: 0.55 });
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
    let rmax = 0, rmin = 99, ok = true;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getY(i), pos.getZ(i));
      rmax = Math.max(rmax, r); rmin = Math.min(rmin, r);
    }
    expect(rmax).toBeCloseTo(8.69, 2);          // flange tip: 17.4 in diameter
    expect(rmin).toBeCloseTo(6.92, 2);          // well bottom
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getY(i), pos.getZ(i));
      if (r > 8.685) { const radial = (pos.getY(i) * nor.getY(i) + pos.getZ(i) * nor.getZ(i)) / r; if (radial < 0.5) ok = false; }
    }
    expect(ok).toBe(true);
    // the bead seat radius (16 in rim) is present in the profile
    expect(prof.some(([x, r]) => Math.abs(r - spec.tires.rimDiameterIn / 2) < 1e-9)).toBe(true);
    // rim width between the flange inner faces is 6.5 in
    const flangeInner = prof.filter(([x, r]) => Math.abs(r - 8.30) < 1e-9).map(([x]) => Math.abs(x));
    expect(Math.max(...flangeInner) * 2).toBeCloseTo(spec.tires.rimWidthIn, 1);
  });
});

describe('labels', () => {
  it('every label has a name and a description', () => {
    for (const [id, l] of Object.entries(WHEEL_LABELS)) {
      expect(id.startsWith('truck.')).toBe(true);
      expect(l.name.length).toBeGreaterThan(3);
      expect(l.desc.length).toBeGreaterThan(10);
    }
  });
});
