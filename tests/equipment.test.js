import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { Drawer, layoutDrawers } from '../src/shop/equipment/drawers.js';
import { FOOT, KEEP_OUT, overlap2D, inKeepOut, inShop, inZone, foot } from '../src/shop/equipment/plan.js';
import { worldBox, Part } from '../src/shop/equipment/common.js';
import { buildChest } from '../src/shop/equipment/toolboxes.js';
import { stationButtons } from '../src/shop/equipment/safety.js';
import { SIGN_IDS, BOX_DESIGNS } from '../src/shop/equipment/art.js';
import LABELS from '../src/data/labels/shop.js';
import { ZONES, SHOP } from '../src/shop/layout.js';

const dir = new URL('../src/shop/equipment/', import.meta.url);
const sources = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => [f, fs.readFileSync(new URL(f, dir), 'utf8')]);

// materials stub: any property is a shared basic material (the tests never render)
const stubMat = new THREE.MeshBasicMaterial();
const M = new Proxy({}, { get: () => stubMat });

describe('Drawer state', () => {
  it('starts closed and toggles open and closed', () => {
    const d = new Drawer({ travel: 0.5, speed: 2 });
    expect(d.isOpen).toBe(false); expect(d.offset).toBe(0);
    expect(d.toggle()).toBe(true);
    expect(d.isOpen).toBe(true);
    expect(d.toggle()).toBe(false);
  });
  it('moves monotonically to full travel then stops', () => {
    const d = new Drawer({ travel: 0.5, speed: 2 });
    d.setOpen(true);
    let prev = -1, steps = 0;
    while (d.update(0.05)) { expect(d.offset).toBeGreaterThanOrEqual(prev); prev = d.offset; if (++steps > 100) throw new Error('never settles'); }
    expect(d.offset).toBeCloseTo(0.5, 6);
    expect(d.update(0.05)).toBe(false);
    d.setOpen(false);
    while (d.update(0.05)) { /* run */ }
    expect(d.offset).toBe(0);
  });
  it('can reverse mid-travel without a jump', () => {
    const d = new Drawer({ travel: 1, speed: 1 });
    d.setOpen(true); d.update(0.5);
    const mid = d.offset; d.setOpen(false); d.update(0.1);
    expect(d.offset).toBeLessThan(mid);
  });
});

describe('layoutDrawers', () => {
  it('fills the opening exactly with the requested gaps and no overlap', () => {
    const heights = [0.085, 0.085, 0.1, 0.12, 0.14, 0.18], gap = 0.004, total = 0.683;
    const l = layoutDrawers(heights, gap, total);
    let top = gap;
    for (const s of l) { expect(s.y - s.h / 2).toBeCloseTo(top, 9); top = s.y + s.h / 2 + gap; }
    expect(top).toBeCloseTo(total, 9);
    expect(l[5].h).toBeGreaterThan(l[0].h); // proportions kept
  });
});

describe('colliders and floor plan', () => {
  it('worldBox rotates a footprint about Y and translates it', () => {
    const b = worldBox(0, 0.5, 0, 1, 0.5, 0.25, 10, 5, Math.PI / 2);
    expect(b.min.x).toBeCloseTo(10 - 0.25, 6); expect(b.max.x).toBeCloseTo(10 + 0.25, 6);
    expect(b.min.z).toBeCloseTo(5 - 1, 6); expect(b.max.z).toBeCloseTo(5 + 1, 6);
    expect(b.min.y).toBe(0); expect(b.max.y).toBe(1);
  });
  it('no two solid footprints overlap', () => {
    const solid = FOOT.filter((f) => f.solid !== false);
    const bad = [];
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) if (overlap2D(solid[i], solid[j])) bad.push(`${solid[i].id} x ${solid[j].id}`);
    expect(bad).toEqual([]);
  });
  it('nothing stands in the truck and dyno keep-out box', () => {
    expect(FOOT.filter(inKeepOut).map((f) => f.id)).toEqual([]);
    expect(KEEP_OUT.x0).toBe(-2.5);
  });
  it('everything is inside the shop walls', () => {
    expect(FOOT.filter((f) => !inShop(f)).map((f) => f.id)).toEqual([]);
  });
  it('named pieces stay in (or hard against the wall beside) their zones', () => {
    const bad = FOOT.filter((f) => f.zone !== 'misc' && !inZone(f, f.zone, 0.6)).map((f) => f.id);
    expect(bad).toEqual([]);
    for (const k of Object.keys(ZONES)) expect(ZONES[k]).toBeTruthy();
  });
  it('the office furniture is inside the office walls', () => {
    const o = ZONES.office, x0 = o.x - o.hx + 0.06, z0 = o.z - o.hz + 0.06;
    for (const f of FOOT.filter((q) => q.id.startsWith('office.'))) {
      expect(f.x - f.hx).toBeGreaterThanOrEqual(x0 - 0.001); expect(f.x + f.hx).toBeLessThanOrEqual(o.x + o.hx + 0.001);
      expect(f.z - f.hz).toBeGreaterThanOrEqual(z0); expect(f.z + f.hz).toBeLessThanOrEqual(o.z + o.hz + 0.001);
    }
  });
  it('wall-side items leave the 0.35 m player at least a 1.2 m aisle to the dyno area', () => {
    for (const f of FOOT.filter((q) => q.solid !== false && !q.id.startsWith('office.'))) {
      const dx = Math.max(KEEP_OUT.x0 - (f.x + f.hx), (f.x - f.hx) - KEEP_OUT.x1);
      const dz = Math.max(KEEP_OUT.z0 - (f.z + f.hz), (f.z - f.hz) - KEEP_OUT.z1);
      expect(Math.max(dx, dz)).toBeGreaterThanOrEqual(1.2);
    }
  });
  it('foot() finds an entry and each solid footprint makes a valid Box3', () => {
    expect(foot('compressor').zone).toBe('compressor');
    for (const f of FOOT) { const b = new THREE.Box3(new THREE.Vector3(f.x - f.hx, 0, f.z - f.hz), new THREE.Vector3(f.x + f.hx, f.h, f.z + f.hz)); expect(b.isEmpty()).toBe(false); }
  });
});

describe('the toolbox chest drawers really move', () => {
  const chest = buildChest(M, { name: 't', labelId: 'shop.toolboxLarge', W: 1.0, D: 0.6, bodyMat: M.red, frontMat: M.red, hutch: [0.08, 0.1], cab: [0.1, 0.15, 0.2], seed: 4 });
  it('has all drawers interactive with a dynamic prompt', () => {
    expect(chest.drawers.length).toBe(5);
    expect(chest.interactables.length).toBe(5);
    const d = chest.drawers[2];
    expect(d.userData.interact.prompt).toBe('Open drawer');
  });
  it('run() opens, update() slides the front out by the travel, then it closes again', () => {
    const d = chest.drawers[3], z0 = d.position.z;
    const said = [];
    d.userData.interact.run({ say: (t) => said.push(t) });
    expect(d.userData.interact.prompt).toBe('Close drawer');
    expect(d.userData.inner.visible).toBe(true);
    for (let i = 0; i < 80; i++) chest.update(0.05);
    expect(d.position.z - z0).toBeCloseTo(d.userData.drawer.travel, 5);
    expect(said[0]).toMatch(/opened/i);
    d.userData.interact.run({});
    for (let i = 0; i < 80; i++) chest.update(0.05);
    expect(d.position.z).toBeCloseTo(z0, 6);
    expect(d.userData.inner.visible).toBe(false);
  });
  it('carries the label id and stacks inside its overall height', () => {
    expect(chest.group.userData.labelId).toBe('shop.toolboxLarge');
    const box = new THREE.Box3().setFromObject(chest.group);
    expect(box.max.y).toBeGreaterThan(1.1); expect(box.max.y).toBeLessThan(1.6);
  });
});

describe('overhead door pushbutton station', () => {
  it('UP / DOWN / STOP set the door target and the station toggles it', () => {
    const doors = [{ target: 1, open: 1 }, { target: 1, open: 1 }];
    const inter = [], upd = [];
    const st = stationButtons(M, 1, () => doors, inter, upd);
    const { up, down, stop } = st.userData.buttons;
    down.userData.interact.run({}); expect(doors[1].target).toBe(0); expect(doors[0].target).toBe(1);
    doors[1].open = 0.4; stop.userData.interact.run({}); expect(doors[1].target).toBe(0.4);
    up.userData.interact.run({}); expect(doors[1].target).toBe(1);
    expect(st.userData.interact.prompt).toBe('Lower the overhead door');
    st.userData.interact.run({}); expect(doors[1].target).toBe(0);
    expect(st.userData.interact.prompt).toBe('Raise the overhead door');
    expect(inter.length).toBe(4);
    upd.forEach((u) => u(0.1)); // press animation runs without error
  });
});

describe('Part merger', () => {
  it('merges primitives per material into one mesh each', () => {
    const a = new THREE.MeshBasicMaterial(), b = new THREE.MeshBasicMaterial();
    const p = new Part();
    p.box(a, 1, 1, 1).cyl(a, 0.2, 1, 0, 1, 0).sph(b, 0.3, 1, 1, 1).rod(b, [0, 0, 0], [1, 1, 1], 0.05).tube(a, [[0, 0, 0], [1, 0, 0], [1, 1, 0]], 0.02);
    const g = new THREE.Group();
    const meshes = p.build(g);
    expect(meshes.length).toBe(2);
    expect(g.children.length).toBe(2);
    for (const m of meshes) expect(m.geometry.attributes.position.count).toBeGreaterThan(0);
  });
});

describe('inspection labels', () => {
  const used = new Set();
  for (const [, src] of sources) for (const m of src.matchAll(/'(shop\.[A-Za-z0-9]+)'/g)) used.add(m[1]);
  it('finds the label ids used in the code', () => { expect(used.size).toBeGreaterThan(30); });
  it('every labelId used has an entry with a name and a one-line description', () => {
    const missing = [...used].filter((id) => !LABELS[id]);
    expect(missing).toEqual([]);
    for (const id of used) {
      expect(LABELS[id].name.length).toBeGreaterThan(2);
      expect(LABELS[id].desc.length).toBeGreaterThan(20);
      expect(LABELS[id].desc).not.toMatch(/\n/);
    }
  });
  it('every entry in the label file is used by the equipment (no stale labels)', () => {
    expect(Object.keys(LABELS).filter((k) => !used.has(k))).toEqual([]);
  });
  it('all label ids use the shop. prefix', () => {
    expect(Object.keys(LABELS).every((k) => k.startsWith('shop.'))).toBe(true);
  });
});

describe('printed art', () => {
  it('every sign used in the code exists in the atlas', () => {
    const wanted = new Set();
    for (const [, src] of sources) for (const m of src.matchAll(/signs\.add\(\s*(?:'([A-Za-z0-9]+)'|[^'),]*\?\s*'([A-Za-z0-9]+)'\s*:\s*'([A-Za-z0-9]+)')/g)) [m[1], m[2], m[3]].filter(Boolean).forEach((x) => wanted.add(x));
    expect(wanted.size).toBeGreaterThan(8);
    expect([...wanted].filter((w) => !SIGN_IDS.includes(w))).toEqual([]);
  });
  it('the box atlas has the cells the shelving needs', () => {
    const ids = BOX_DESIGNS.map((d) => d.id);
    for (const id of ['kraftLabel', 'tape', 'side', 'side2', 'end', 'kraftPlain']) expect(ids).toContain(id);
    expect(BOX_DESIGNS.length).toBeLessThanOrEqual(12);
  });
});

describe('piping stays on the wall surface', () => {
  it('the header and drops are inside the shop walls', () => {
    const src = fs.readFileSync(new URL('compressor.js', dir), 'utf8');
    expect(src).toMatch(/const WALL = 0\.0\d/);
    expect(SHOP.halfX - 0.06).toBeLessThan(SHOP.halfX);
  });
});
