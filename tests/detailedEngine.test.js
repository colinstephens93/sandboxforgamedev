import { describe, it, expect } from 'vitest';
import { QUALITY } from '../src/core/quality.js';
import { installFakeDom } from './helpers/truckHarness.js';
installFakeDom();

// The detailed long block from the duramaxsimulator repo, fitted into the engine bay (src/truck/engine/detailedEngine.js).
describe('detailed engine in the bay', () => {
  it('replaces the simple block, keeps the truck dress, and every part has an inspection label', async () => {
    const { buildEngineBay } = await import('../src/truck/engine/index.js');
    const { LABELS } = await import('../src/data/labels/index.js');
    const bay = buildEngineBay({ quality: QUALITY.medium });
    expect(bay.core).toBeTruthy();
    for (const gone of ['block', 'bank_driver', 'intake_manifold', 'turbo', 'belt']) expect(bay.group.getObjectByName(gone), gone).toBeUndefined();
    for (const kept of ['engine_cover', 'fan', 'ac_compressor', 'ps_pump', 'downpipe']) expect(bay.group.getObjectByName(kept), kept).toBeTruthy();
    const ids = new Set(); bay.core.group.traverse((o) => { if (o.userData.labelId) ids.add(o.userData.labelId); });
    expect(ids.size).toBeGreaterThan(40);
    for (const id of ids) { expect(LABELS[id], id).toBeTruthy(); expect(LABELS[id].name.length).toBeGreaterThan(3); expect(LABELS[id].desc.length).toBeGreaterThan(20); }
    for (const a of [bay.anchors.turbo, bay.anchors.alternator, bay.anchors.fan]) expect(a && a.isObject3D).toBe(true);
  });

  it('sits where the simple engine was: inside the bay, heads between the aprons, crank on the mount axis', async () => {
    const THREE = await import('three');
    const { buildEngineBay } = await import('../src/truck/engine/index.js');
    const { ENGINE } = await import('../src/truck/engine/layout.js');
    const bay = buildEngineBay({ quality: QUALITY.medium }); bay.group.updateMatrixWorld(true);
    const I = 39.3701, box = new THREE.Box3();
    for (const [name, a] of bay.core.model.assemblies) { if (name === 'oil-pan') continue; box.union(new THREE.Box3().setFromObject(a)); }
    expect(box.min.x * I).toBeGreaterThan(-18); expect(box.max.x * I).toBeLessThan(18);
    expect(box.max.z * I).toBeLessThan(ENGINE.firewallClearS);   // clear of the firewall
    expect(box.min.z * I).toBeGreaterThan(-19);                  // behind the fan
    expect(box.max.y * I).toBeLessThan(45.5);                    // under the hood pad
    const crank = bay.core.group.getWorldPosition(new THREE.Vector3());
    expect(crank.y * I).toBeCloseTo(ENGINE.crank.y, 1); expect(crank.x).toBeCloseTo(0, 3);
  });

  it('hides the internals and the test-stand sump until asked, and the crank follows rpm', async () => {
    const { buildEngineBay } = await import('../src/truck/engine/index.js');
    const bay = buildEngineBay({ quality: QUALITY.medium }), core = bay.core, m = core.model;
    const run = (n, st) => { for (let i = 0; i < n; i++) bay.update(0.05, st); };
    run(2, {});
    const pan = m.assemblies.get('oil-pan');
    expect(m.internalGroups.every((g) => !g.visible)).toBe(true);
    expect(pan.visible).toBe(false);
    const a0 = m.crankSpin.rotation.z; run(10, { rpm: 700, running: true }); expect(m.crankSpin.rotation.z).not.toBe(a0);
    const a1 = m.crankSpin.rotation.z; run(10, { rpm: 700, running: false }); expect(m.crankSpin.rotation.z).toBe(a1);
    core.setCutaway(true); run(60, {});
    expect(m.internalGroups.every((g) => g.visible)).toBe(true);
    expect(bay.anchors.engineCover.visible).toBe(false);
    core.setCutaway(false); core.setExploded(true); run(5, {}); expect(pan.visible).toBe(true);
    core.setExploded(false); run(200, {});
    expect(pan.visible).toBe(false); expect(bay.anchors.engineCover.visible).toBe(true);
    core.standalone = true; run(1, {}); expect(pan.visible).toBe(true);
  });
});
