import { describe, it, expect } from 'vitest';
import { cullDecision } from '../src/truck/culling.js';

// The rule the game and the truck studio share for skipping parts nobody can see (src/truck/culling.js).
describe('truck hidden-part culling', () => {
  const base = { camY: 1.7, camZ: 3, bayFrontZ: -1, hoodMoved: false };
  it('hides the engine bay and the underbody for a standing viewer beside a closed hood', () => {
    expect(cullDecision(base)).toEqual({ showBay: false, showEngine: false, showUnder: false });
  });
  it('shows the engine bay when the hood is open or moving', () => {
    expect(cullDecision({ ...base, hoodMoved: true }).showBay).toBe(true);
  });
  it('shows the engine bay from in front of the grille and from a low camera', () => {
    expect(cullDecision({ ...base, camZ: -2 }).showBay).toBe(true);
    expect(cullDecision({ ...base, camY: 0.9 }).showBay).toBe(true);
  });
  it('draws the radiator side of the bay but not the engine itself from in front of a closed hood', () => {
    expect(cullDecision({ ...base, camZ: -2 })).toMatchObject({ showBay: true, showEngine: false });
    expect(cullDecision({ ...base, camY: 0.9 }).showEngine).toBe(true);
    expect(cullDecision({ ...base, hoodMoved: true }).showEngine).toBe(true);
  });
  it('shows the underbody only from a low camera', () => {
    expect(cullDecision({ ...base, camY: 1.2 }).showUnder).toBe(true);
    expect(cullDecision({ ...base, camY: 1.31 }).showUnder).toBe(false);
  });
  it('draws everything while warming up so every shader compiles during loading', () => {
    expect(cullDecision({ ...base, warm: true })).toEqual({ showBay: true, showEngine: true, showUnder: true });
  });
});

describe('truck culling keeps parts that were hidden for their own reasons hidden', () => {
  it('restores only what it hid', async () => {
    const THREE = await import('three');
    const { createTruckCulling } = await import('../src/truck/culling.js');
    const mk = () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const bay = new THREE.Group(), a = mk(), b = mk(); b.visible = false; bay.add(a, b);
    const under = new THREE.Group(), u = mk(); under.add(u);
    const group = new THREE.Group(); group.add(bay, under);
    const cull = createTruckCulling({ group, parts: { engineBay: { group: bay } }, underside: { group: under } });
    const hood = { target: 0, state: 0 };
    cull.update(new THREE.Vector3(3, 1.7, 5), hood);
    expect([a.visible, b.visible, u.visible]).toEqual([false, false, false]);
    cull.update(new THREE.Vector3(3, 0.5, 5), hood);
    expect([a.visible, b.visible, u.visible]).toEqual([true, false, true]);
  });
});
