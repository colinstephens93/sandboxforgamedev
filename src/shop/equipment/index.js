// Shop equipment (owned by the equipment agent): everything inside the shop shell, generated in code.
//   const eq = buildEquipment({ quality, shop });  scene.add(eq.group);
//   eq.colliders      THREE.Box3[] (shop frame), one per solid object
//   eq.anchors        { lbzRegulatorSlot, shopComputer } Object3Ds placed in the shop frame
//   eq.interactables  Object3D[] having userData.interact = { prompt, run(ctx) } (raycast, walk up the parents)
//   eq.update(dt, state)  animates drawers, the lift and the light switch; call every frame
import * as THREE from 'three';
import { aabb } from '../../core/geom.js';
import { makeMaterials } from './common.js';
import { createSigns } from './signs.js';
import { FOOT } from './plan.js';
import { buildToolboxes } from './toolboxes.js';
import { buildLift } from './lift.js';
import { buildTireArea } from './tires.js';
import { buildBench } from './bench.js';
import { buildShelving } from './shelving.js';
import { buildOffice } from './office.js';
import { buildSafety } from './safety.js';
import { buildExtras } from './extras.js';
import { buildCompressorArea } from './compressor.js';

export function buildEquipment({ quality, shop }) {
  const group = new THREE.Group(); group.name = 'equipment';
  const M = makeMaterials(quality);
  const signs = createSigns(quality);
  const colliders = [];
  const interactables = [];
  const updaters = [];
  const anchors = {};
  const ctx = { M, quality, shop, group, signs, colliders, interactables, updaters, anchors };

  // solid footprints from the floor plan
  for (const f of FOOT) if (f.solid !== false) colliders.push(aabb(f.x, f.h / 2, f.z, f.hx, f.h / 2, f.hz));

  // rolling toolboxes
  {
    const boxes = buildToolboxes(M, (g, x, y, z, ry) => { g.position.set(x, y, z); g.rotation.y = ry; });
    for (const b of boxes) { group.add(b.group); interactables.push(...b.interactables); updaters.push(b.update); }
  }

  buildLift(ctx);
  buildTireArea(ctx);
  buildBench(ctx);
  buildShelving(ctx);
  buildOffice(ctx);
  buildSafety(ctx);
  buildExtras(ctx);
  buildCompressorArea(ctx);

  signs.build(group);
  const update = (dt, state) => { for (const u of updaters) u(dt, state); };
  return { group, colliders, anchors, interactables, update };
}
