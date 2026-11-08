import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import {
  REAR_LABELS, GATE, BED, RIBS, CABLE_LENGTH, tailgateAngle, gatePointAt, cableDistance, cablePoints, polylineLength,
  tailgateTimeline, ribFraction, buildRear,
} from '../src/truck/rear.js';
import { buildFuelDoor, buildBadges, fuelDoorAngle, FUEL_DOOR_OPEN_ANGLE, BADGE_PLACEMENT } from '../src/truck/badges.js';

// minimal canvas stub so the builders (textures, badge artwork) run under node: every 2D call is a no-op, pixel buffers are zeros
function installFakeDom() {
  if (globalThis.document) return;
  const mkCtx = (w, h) => new Proxy({}, {
    get(t, k) {
      if (k === 'createImageData' || k === 'getImageData') return (a, b, c, d) => { const W = k === 'createImageData' ? a : c, Hh = k === 'createImageData' ? b : d; return { width: W, height: Hh, data: new Uint8ClampedArray(W * Hh * 4) }; };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  globalThis.document = { createElement: () => { const c = { width: 0, height: 0, _ctx: null, getContext() { return (this._ctx ||= mkCtx(this.width, this.height)); } }; return c; } };
}
installFakeDom();

describe('tailgate geometry', () => {
  it('set(open01) maps linearly to a 90 degree hinge angle and clamps', () => {
    expect(tailgateAngle(0)).toBe(0);
    expect(tailgateAngle(1)).toBeCloseTo(Math.PI / 2, 9);
    expect(tailgateAngle(0.5)).toBeCloseTo(Math.PI / 4, 9);
    expect(tailgateAngle(-1)).toBe(0);
    expect(tailgateAngle(3)).toBeCloseTo(Math.PI / 2, 9);
  });
  it('the top of the gate swings from vertical to horizontal about the hinge pin', () => {
    const top = [0, GATE.vTop, GATE.wOuter];
    const closed = gatePointAt(0, top), open = gatePointAt(GATE.openAngle, top);
    expect(closed[1]).toBeCloseTo(GATE.pivotY + GATE.vTop, 6);          // 56.0 in: bed rail height
    expect(closed[1]).toBeCloseTo(BED.railY, 1);
    expect(open[1]).toBeCloseTo(GATE.pivotY - GATE.wOuter, 6);         // lying down, outer skin underneath
    expect(open[2]).toBeCloseTo(GATE.pivotS + GATE.vTop, 6);           // reaching rearward by the gate height
  });
  it('the open gate inner face is flush with the floor', () => {
    const inner = gatePointAt(GATE.openAngle, [0, 5, GATE.wInner]);
    expect(inner[1]).toBeCloseTo(BED.floorY, 6);
  });
  it('cable: slack when closed, exactly taut at horizontal, distance grows monotonically with the opening', () => {
    expect(cableDistance(0)).toBeLessThan(CABLE_LENGTH * 0.5);
    expect(cableDistance(GATE.openAngle)).toBeCloseTo(CABLE_LENGTH, 9);
    let prev = -1;
    for (let a = 0; a <= GATE.openAngle + 1e-9; a += GATE.openAngle / 30) { const d = cableDistance(a); expect(d).toBeGreaterThan(prev - 1e-9); prev = d; }
    expect(CABLE_LENGTH).toBeGreaterThan(10); expect(CABLE_LENGTH).toBeLessThan(20);
  });
  it('cable curve: length matches the cable when slack, straight when taut', () => {
    const A = [34, 45.5, 191], B = gatePointAt(0.6, [35.25, 12, 0.9]);
    const L = CABLE_LENGTH, pts = cablePoints(A, B, L, 40);
    expect(polylineLength(pts)).toBeGreaterThan(cableDistance(0.6));
    expect(Math.abs(polylineLength(pts) - L) / L).toBeLessThan(0.03);
    const taut = cablePoints([34, 45.5, 191], gatePointAt(GATE.openAngle, [35.25, 12, 0.9]), L, 10);
    taut.forEach((p, i) => { const t = i / 10; const B2 = gatePointAt(GATE.openAngle, [35.25, 12, 0.9]); expect(p[1]).toBeCloseTo(45.5 + (B2[1] - 45.5) * t, 6); });
    pts.slice(1, -1).forEach((p, i) => expect(p[1]).toBeLessThan(A[1] + (B[1] - A[1]) * ((i + 1) / 40) + 1e-9)); // sags below the chord
  });
  it('timeline: opening drops the gate from 0 to 1 and releases the handle; closing returns to 0', () => {
    expect(tailgateTimeline('open', 0).open01).toBe(0);
    expect(tailgateTimeline('open', 0.1).open01).toBe(0);            // handle goes up first
    expect(tailgateTimeline('open', 0.1).handle01).toBeGreaterThan(0.2);
    const end = tailgateTimeline('open', 2.0); expect(end.done).toBe(true); expect(end.open01).toBe(1);
    let max = 0; for (let t = 0; t < 2; t += 0.01) max = Math.max(max, tailgateTimeline('open', t).open01); expect(max).toBeLessThanOrEqual(1);
    expect(tailgateTimeline('close', 0).open01).toBe(1);
    const c = tailgateTimeline('close', 1.5); expect(c.done).toBe(true); expect(c.open01).toBe(0);
  });
});

describe('bed floor ribs', () => {
  it('13 lengthwise ribs, symmetric, centered on the truck and inside the 66 in box', () => {
    expect(RIBS.count).toBe(13);
    expect(RIBS.period * RIBS.count).toBeLessThanOrEqual(2 * BED.inHalf + 0.6);
    expect(ribFraction(0)).toBe(1);                                  // a rib on the centerline
    expect(ribFraction(RIBS.period / 2)).toBeLessThan(0.05);         // valley between ribs
    for (const x of [1, 3.3, 7.7, 20, 31]) expect(ribFraction(x)).toBeCloseTo(ribFraction(-x), 9);
    let n = 0, prev = 0; for (let x = -34; x <= 34; x += 0.05) { const f = ribFraction(x) > 0.5 ? 1 : 0; if (f && !prev) n++; prev = f; }
    expect(n).toBe(13);
  });
  it('box dimensions come from the spec', () => {
    expect(BED.inHalf * 2).toBe(66);
    expect(BED.tubHalf * 2).toBe(50);
    expect(BED.axleS).toBe(153);
  });
});

describe('labels', () => {
  const used = new Set();
  for (const f of ['rear.js', 'badges.js']) {
    const src = fs.readFileSync(new URL(`../src/truck/${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/'(truck\.[a-z0-9_]+)'/g)) used.add(m[1]);
  }
  it('every label id used by rear.js and badges.js exists in REAR_LABELS', () => {
    const missing = [...used].filter((id) => !REAR_LABELS[id]);
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(20);
  });
  it('every REAR_LABELS entry has a name and a one-line description and is used by the builders', () => {
    for (const [id, v] of Object.entries(REAR_LABELS)) { expect(id.startsWith('truck.')).toBe(true); expect(v.name.length).toBeGreaterThan(2); expect(v.desc.length).toBeGreaterThan(10); expect(used.has(id)).toBe(true); }
  });
  it('required ids are present', () => {
    for (const id of ['truck.tailgate', 'truck.bed', 'truck.taillamp', 'truck.rear_bumper', 'truck.fuel_door', 'truck.badge_duramax', 'truck.badge_2500hd', 'truck.badge_silverado', 'truck.decal_4x4', 'truck.chmsl']) expect(REAR_LABELS[id]).toBeTruthy();
  });
});

describe('fuel door', () => {
  it('opens about the forward-edge hinge to 110 degrees on the driver side', () => {
    expect(fuelDoorAngle(1)).toBeCloseTo(FUEL_DOOR_OPEN_ANGLE, 9);
    expect(FUEL_DOOR_OPEN_ANGLE).toBeCloseTo((110 * Math.PI) / 180, 9);
    expect(fuelDoorAngle(0)).toBe(0);
    expect(BADGE_PLACEMENT.fuelDoor.s).toBeGreaterThan(110.8); expect(BADGE_PLACEMENT.fuelDoor.s).toBeLessThan(133);
  });
  it('builds, rotates the door and exposes an interaction', () => {
    const f = buildFuelDoor({ side: 'L' });
    expect(f.group.userData.labelId === undefined).toBe(true);
    expect(f.door.userData.labelId).toBe('truck.fuel_door');
    expect(f.door.userData.interact.prompt).toBe('Open fuel door');
    f.set(1); expect(Math.abs(f.door.rotation.y)).toBeCloseTo(FUEL_DOOR_OPEN_ANGLE, 9);
    f.set(0); expect(f.door.rotation.y).toBeCloseTo(0, 9);
    // the pivot sits on the driver side (negative x)
    expect(f.door.position.x).toBeLessThan(0);
  });
});

describe('builder smoke test (stub canvas)', () => {
  it('builds the rear, opens the gate and keeps the cables attached', () => {
    const r = buildRear({ quality: { tex: 256 } });
    const g = r.parts.tailgate;
    expect(g.group.userData.labelId).toBe('truck.tailgate');
    expect(g.group.userData.interact.prompt).toBe('Open tailgate');
    g.set(1, 1);
    expect(g.group.rotation.x).toBeCloseTo(Math.PI / 2, 9);
    g.set(0, 0);
    expect(g.group.rotation.x).toBe(0);
    // cable anchors are exported (inches)
    expect(g.anchors.box.L[0]).toBeLessThan(0); expect(g.anchors.box.R[0]).toBeGreaterThan(0);
    let tris = 0; r.group.traverse((o) => { if (o.isMesh) { const gg = o.geometry; tris += ((gg.index ? gg.index.count : gg.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1); } });
    expect(tris).toBeLessThan(150000);
    const b = buildBadges({}); expect(b).toBeInstanceOf(THREE.Group);
  });
  it('E interaction opens then closes the tailgate and the fuel door through ctx.animate', () => {
    const run = (obj) => {
      const anims = []; const said = [];
      obj.userData.interact.run({ animate: (f) => anims.push(f), say: (t) => said.push(t) });
      let n = 0; while (anims.length && n++ < 1000) { const f = anims[0]; if (f(0.016)) anims.shift(); }
      return said;
    };
    const r = buildRear({ quality: { tex: 256 } }); const g = r.parts.tailgate;
    expect(run(g.group).length).toBeGreaterThan(0);
    expect(g.group.rotation.x).toBeCloseTo(Math.PI / 2, 6); expect(g.group.userData.interact.prompt).toBe('Close tailgate');
    run(g.group);
    expect(g.group.rotation.x).toBeCloseTo(0, 6); expect(g.group.userData.interact.prompt).toBe('Open tailgate');
    const f = buildFuelDoor({ side: 'L' });
    run(f.door); expect(f.open01).toBe(1); expect(f.door.userData.interact.prompt).toBe('Close fuel door');
    run(f.door); expect(f.open01).toBe(0);
  });
  it('every mesh with a label id uses a registered label', () => {
    const r = buildRear({ quality: { tex: 256 } });
    r.group.traverse((o) => { if (o.userData.labelId) expect(REAR_LABELS[o.userData.labelId]).toBeTruthy(); });
  });
});
