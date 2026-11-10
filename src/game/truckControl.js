// Opening logic for the truck: four doors on real hinge axes with swing limits, the hood (release handle, secondary latch, spring hinges),
// interior lights that come on when a door opens. Panels are geometry in the truck frame; each is wrapped in a pivot at its hinge line.
import * as THREE from 'three';
import { IN_TO_M as IN } from '../truck/skin.js';
import { ST } from '../truck/skin.js';
import { makeHinge, HingeDoor } from './hinge.js';

const DEG = Math.PI / 180;

export function setupTruckOpenings(truck, { say, onLights }) {
  const parts = truck.parts;
  const ctl = { doors: {}, hood: null, hoodState: { cabReleased: false, secondaryReleased: false }, anyDoorOpen: false };
  const labels = { f: 'Front', r: 'Rear' };
  const sideName = { L: 'driver side', R: 'passenger side' };
  // door pivots (inches): hinge at the front edge of each door, slightly outboard of the body line
  const hinge = { f: { s: ST.doorF0 + 0.3, x: 38.9 }, r: { s: ST.doorF1 + 0.4, x: 38.9 } };
  const maxAngle = { f: 72 * DEG, r: 78 * DEG }; // door check straps stop the swing at these angles
  for (const key of ['f', 'r']) for (const side of ['L', 'R']) {
    const g = parts.doors[`${key}${side}`]; if (!g) continue;
    const sg = side === 'R' ? 1 : -1;
    const parent = g.parent;
    const pivot = new THREE.Vector3(sg * hinge[key].x * IN, 0, hinge[key].s * IN);
    const piv = makeHinge(parent, g, pivot);
    const door = new HingeDoor({ pivot: piv, axis: 'y', maxAngle: sg * maxAngle[key], onChange: () => { ctl.anyDoorOpen = Object.values(ctl.doors).some((d) => d.state > 0.02); onLights(ctl.anyDoorOpen); } });
    ctl.doors[`${key}${side}`] = door;
    piv.userData.labelId = `truck.door_${key}`;
    piv.userData.interact = { prompt: () => (door.open ? 'Close door' : 'Open door'), run: (ctx) => { door.toggle(ctx); if (ctx.sfx) ctx.sfx(door.open ? 'doorOpen' : 'doorClose', { distance: 1.5 }); } };
    piv.name = `door_pivot_${key}${side}`;
  }

  // hood: pivots at the rear edge on the cowl (spring-loaded hinge arms hold it, no prop rod)
  if (parts.hood) {
    const hood = parts.hood;
    const pivot = new THREE.Vector3(0, 54.0 * IN, 19.5 * IN);
    const piv = makeHinge(hood.parent, hood, pivot);
    const hinged = new HingeDoor({ pivot: piv, axis: 'x', maxAngle: 70 * DEG, speed: 0.9 });
    ctl.hood = hinged;
    hood.userData.labelId = 'truck.hood';
    piv.userData.interact = {
      prompt: () => (hinged.open ? 'Close hood' : (ctl.hoodState.cabReleased && ctl.hoodState.secondaryReleased ? 'Lift hood' : 'Hood is latched')),
      run: (ctx) => {
        if (hinged.open) { hinged.toggle(ctx, false); ctl.hoodState.cabReleased = false; ctl.hoodState.secondaryReleased = false; if (ctx.sfx) ctx.sfx('hoodClose', { distance: 2 }); return; }
        if (!ctl.hoodState.cabReleased) { say('The hood is latched. Pull the hood release handle inside the cab, to the lower left of the steering wheel.'); return; }
        if (!ctl.hoodState.secondaryReleased) { say('The primary latch is released. Now pull up the secondary release near the center of the grille.'); return; }
        hinged.toggle(ctx, true); if (ctx.sfx) ctx.sfx('hoodOpen', { distance: 2 });
      },
    };
    ctl.hoodPivot = piv;
  }
  ctl.releaseHoodFromCab = (ctx) => { ctl.hoodState.cabReleased = true; say('Hood release pulled: the hood pops up slightly.'); if (ctx && ctx.sfx) ctx.sfx('hoodRelease', { inside: true }); };
  ctl.pullSecondary = (ctx) => {
    if (!ctl.hoodState.cabReleased) { say('The hood is still held by the primary latch: pull the release handle inside the cab first.'); return; }
    ctl.hoodState.secondaryReleased = true; say('Secondary release pulled: lift the hood.');
  };
  // the secondary release lever sits just behind the grille: pointing at the grille/bumper bar uses it
  if (parts.front) parts.front.traverse((m) => {
    if (m.isMesh && /^(grille|chrome_bar|bowtie)/.test(m.name)) m.userData.interact = { prompt: () => (ctl.hoodState.secondaryReleased ? 'Secondary release (already pulled)' : 'Pull secondary hood release'), run: (ctx) => { ctl.pullSecondary(ctx); if (ctx.sfx) ctx.sfx('hoodRelease', { distance: 1.5 }); } };
  });
  ctl.update = (dt) => {};
  return ctl;
}
