// Hidden-detail culling for the truck: skip the engine bay, hood underside and underbody while nothing can see them.
// Only meshes are toggled (never lights: changing the light count recompiles every material).
// Shared by the game and the truck studio so both measure the same thing.
import * as THREE from 'three';

const drawables = (root) => { const a = []; if (root) root.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) a.push(o); }); return a; };

// The decision on its own (no scene needed), so it can be unit-tested.
//   camY, camZ: camera position in the frame the bay box was measured in; bayFrontZ: front face of the engine bay box
//   hoodMoved: the hood is open, opening or closing; warm: first frames, draw everything so every shader compiles
export function cullDecision({ camY, camZ, bayFrontZ, hoodMoved, warm = false }) {
  const lowCam = camY < 1.1; // looking under the grille, through wheel wells, along the side
  const inFront = camZ < bayFrontZ + 0.6; // in front of the grille: radiator and fan are visible through it
  // the engine itself sits behind the radiator and fan: through the grille it cannot be seen, only from below or with the hood up
  return { showBay: warm || hoodMoved || lowCam || inFront, showEngine: warm || hoodMoved || lowCam, showUnder: warm || camY < 1.3 };
}

export function createTruckCulling(truck) {
  const bay = truck.parts.engineBay && truck.parts.engineBay.group;
  const hu = truck.parts.hoodUnder && truck.parts.hoodUnder.group;
  truck.group.updateMatrixWorld(true);
  const core = truck.parts.engineBay && truck.parts.engineBay.core && truck.parts.engineBay.core.group; // the detailed engine
  const engine = drawables(core), inEngine = new Set(engine);
  const c = {
    bay: drawables(bay).filter((m) => !inEngine.has(m)), engine, hood: drawables(hu), under: drawables(truck.underside && truck.underside.group),
    box: bay ? new THREE.Box3().setFromObject(bay) : null, shown: { bay: true, engine: true, under: true },
  };
  // Hiding remembers which meshes were showing, and showing restores only those: a part that was already hidden for its
  // own reasons (hit shapes, the engine's internals and effects) is not switched on by the culling.
  const hidden = { bay: [], engine: [], under: [] };
  const set = (key, lists, show) => {
    if (show === c.shown[key]) return;
    if (show) { for (const m of hidden[key]) m.visible = true; hidden[key] = []; }
    else for (const list of lists) for (const m of list) if (m.visible) { m.visible = false; hidden[key].push(m); }
    c.shown[key] = show;
  };
  const apply = (showBay, showEngine, showUnder) => { set('bay', [c.bay, c.hood], showBay); set('engine', [c.engine], showEngine); set('under', [c.under], showUnder); };
  return {
    state: c,
    // camPos: camera position in world space; hood: the HingeDoor of the hood (or null)
    update(camPos, hood, warm = false) {
      if (!c.box) return;
      const hoodMoved = !hood || hood.target > 0.5 || hood.state > 0.001;
      const d = cullDecision({ camY: camPos.y, camZ: camPos.z, bayFrontZ: c.box.min.z, hoodMoved, warm });
      apply(d.showBay, d.showEngine, d.showUnder);
    },
    showAll() { apply(true, true, true); },
  };
}
