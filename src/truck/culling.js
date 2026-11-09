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
  return { showBay: warm || hoodMoved || lowCam || inFront, showUnder: warm || camY < 1.3 };
}

export function createTruckCulling(truck) {
  const bay = truck.parts.engineBay && truck.parts.engineBay.group;
  const hu = truck.parts.hoodUnder && truck.parts.hoodUnder.group;
  truck.group.updateMatrixWorld(true);
  const c = {
    bay: drawables(bay), hood: drawables(hu), under: drawables(truck.underside && truck.underside.group),
    box: bay ? new THREE.Box3().setFromObject(bay) : null, shown: { bay: true, under: true },
  };
  const apply = (showBay, showUnder) => {
    if (showBay !== c.shown.bay) { for (const m of c.bay) m.visible = showBay; for (const m of c.hood) m.visible = showBay; c.shown.bay = showBay; }
    if (showUnder !== c.shown.under) { for (const m of c.under) m.visible = showUnder; c.shown.under = showUnder; }
  };
  return {
    state: c,
    // camPos: camera position in world space; hood: the HingeDoor of the hood (or null)
    update(camPos, hood, warm = false) {
      if (!c.box) return;
      const hoodMoved = !hood || hood.target > 0.5 || hood.state > 0.001;
      const d = cullDecision({ camY: camPos.y, camZ: camPos.z, bayFrontZ: c.box.min.z, hoodMoved, warm });
      apply(d.showBay, d.showUnder);
    },
    showAll() { apply(true, true); },
  };
}
