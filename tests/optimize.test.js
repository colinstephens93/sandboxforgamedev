import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { QUALITY } from '../src/core/quality.js';
import { installFakeDom, exerciseTruck } from './helpers/truckHarness.js';
installFakeDom();

// The merged truck must behave exactly like the unmerged one: a part that was baked into a merged mesh may never move,
// hide, change material or change shape relative to the node it was merged under. This drives every moving part of the
// truck (and samples mid-animation) and checks that for every merged source.
describe('truck draw-call merging (src/truck/optimize.js)', () => {
  it('merges only parts that stay fixed relative to their anchor, and cuts drawn meshes substantially', async () => {
    const { buildTruck } = await import('../src/truck/index.js');
    const { setupTruckOpenings } = await import('../src/game/truckControl.js');
    const { optimizeTruck, PICK_LAYER } = await import('../src/truck/optimize.js');
    const truck = buildTruck({ quality: QUALITY.medium });
    const ctl = setupTruckOpenings(truck, { say() {}, onLights() {} });
    const tris = (o) => (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    let trisBefore = 0; truck.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) trisBefore += tris(o); });
    const res = optimizeTruck(truck);
    console.log('drawn meshes', res.before, '->', res.after, `(${res.merged} merged meshes)`);
    expect(res.after).toBeLessThan(res.before * 0.6);

    // triangles are conserved, and the originals are still there for picking
    let trisDrawn = 0, pick = 0; const sources = [];
    truck.group.traverse((o) => { if (!o.isMesh || o.isInstancedMesh) return; if (o.userData.pickOnly) { pick++; sources.push(o); expect(o.layers.mask).toBe(1 << PICK_LAYER); } else trisDrawn += tris(o); });
    expect(Math.round(trisDrawn)).toBe(Math.round(trisBefore));
    expect(pick).toBeGreaterThan(300);

    const anchorOf = (o) => { let p = o.parent; while (p && !p.children.some((c) => c.userData.merged && c.material === o.material)) p = p.parent; return p; };
    const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
    const state = (o, a) => {
      rel.multiplyMatrices(inv.copy(a.matrixWorld).invert(), o.matrixWorld);
      let vis = true; for (let p = o; p !== a; p = p.parent) if (!p.visible) vis = false;
      return `${rel.elements.map((v) => Math.round(v * 1e4)).join(',')}|${vis}|${o.material.uuid}|${o.geometry.uuid}|${o.geometry.attributes.position.version}`;
    };
    truck.group.updateMatrixWorld(true);
    const base = sources.map((o) => { const a = anchorOf(o); expect(a, `anchor of ${o.name}`).toBeTruthy(); return [o, a, state(o, a)]; });
    const path = (o) => { const a = []; for (let p = o; p && p !== truck.group; p = p.parent) a.unshift(p.name || p.type); return a.join('/'); };
    const changed = new Set();
    const out = exerciseTruck(truck, ctl, () => { for (const [o, a, s] of base) if (state(o, a) !== s) changed.add(path(o)); });
    expect(out.errors).toEqual([]);
    expect([...changed]).toEqual([]);
  }, 120000);
});
