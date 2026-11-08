// Floor plan of the shop equipment: footprints (shop frame, meters) used for placement and for the colliders.
// Pure data (no DOM): unit-tested for overlaps, the truck/dyno keep-out and the shop bounds.
import { ZONES, SHOP } from '../layout.js';

// Truck and dyno keep-out (see the task brief): x in [-2.5, 2.5], z in [-6, 7].
export const KEEP_OUT = { x0: -2.5, x1: 2.5, z0: -6, z1: 7 };

// id, zone, center (x, z), half extents, height. `solid: false` = low items the player may step over (no collider).
export const FOOT = [
  { id: 'lift.colW', zone: 'lift', x: -9.7, z: 2.6, hx: 0.17, hz: 0.23, h: 3.4 },
  { id: 'lift.colE', zone: 'lift', x: -6.7, z: 2.6, hx: 0.17, hz: 0.23, h: 3.4 },
  { id: 'lift.power', zone: 'lift', x: -10.12, z: 2.6, hx: 0.12, hz: 0.27, h: 1.0 },
  { id: 'drainPan', zone: 'lift', x: -7.2, z: 4.45, hx: 0.3, hz: 0.3, h: 0.6 },
  { id: 'toolbox.A', zone: 'toolboxes', x: 4.7, z: 8.64, hx: 0.71, hz: 0.31, h: 1.5 },
  { id: 'toolbox.B', zone: 'toolboxes', x: 3.2, z: 8.65, hx: 0.5, hz: 0.3, h: 1.34 },
  { id: 'toolbox.C', zone: 'bench', x: -11.62, z: -2.5, hx: 0.3, hz: 0.4, h: 1.0 },
  { id: 'bench', zone: 'bench', x: -11.575, z: -4.6, hx: 0.375, hz: 1.6, h: 0.95 },
  { id: 'partsWasher', zone: 'misc', x: -11.62, z: -0.9, hx: 0.32, hz: 0.45, h: 1.0 },
  { id: 'tireChanger', zone: 'tireArea', x: -10.7, z: 7.55, hx: 0.55, hz: 0.55, h: 1.6 },
  { id: 'balancer', zone: 'tireArea', x: -8.3, z: 8.2, hx: 0.42, hz: 0.75, h: 1.4 },
  { id: 'tireRack', zone: 'tireArea', x: -6.95, z: 8.5, hx: 0.75, hz: 0.4, h: 1.9 },
  { id: 'tireStack', zone: 'tireArea', x: -11.0, z: 5.7, hx: 0.4, hz: 0.4, h: 1.08 },
  { id: 'compressor', zone: 'compressor', x: 11.25, z: -7.6, hx: 0.45, hz: 0.45, h: 2.15 },
  { id: 'shelving', zone: 'shelving', x: 11.65, z: -1.5, hx: 0.3, hz: 3.0, h: 2.1 },
  { id: 'drum', zone: 'misc', x: -11.5, z: 4.3, hx: 0.29, hz: 0.29, h: 0.9 },
  { id: 'trash', zone: 'misc', x: -11.6, z: -6.75, hx: 0.25, hz: 0.25, h: 0.8 },
  { id: 'jackStands', zone: 'misc', x: -7.6, z: -0.9, hx: 0.3, hz: 0.3, h: 0.5, solid: false },
  { id: 'floorJack', zone: 'misc', x: -8.8, z: -0.9, hx: 0.3, hz: 0.55, h: 0.3, solid: false },
  // office interior (inside the walls built by shell.js: x 6.46..12, z 3.46..9)
  { id: 'office.desk', zone: 'office', x: 11.55, z: 5.45, hx: 0.4, hz: 0.9, h: 0.76 },
  { id: 'office.cabinet', zone: 'office', x: 11.67, z: 8.62, hx: 0.31, hz: 0.23, h: 1.33 },
  { id: 'office.printer', zone: 'office', x: 11.65, z: 3.95, hx: 0.3, hz: 0.32, h: 0.95 },
  { id: 'office.chair', zone: 'office', x: 10.5, z: 5.45, hx: 0.3, hz: 0.3, h: 0.95, solid: false },
];

export const foot = (id) => FOOT.find((f) => f.id === id);

export function overlap2D(a, b, margin = 0) {
  return Math.abs(a.x - b.x) < a.hx + b.hx + margin && Math.abs(a.z - b.z) < a.hz + b.hz + margin;
}
export function inKeepOut(f) {
  return f.x + f.hx > KEEP_OUT.x0 && f.x - f.hx < KEEP_OUT.x1 && f.z + f.hz > KEEP_OUT.z0 && f.z - f.hz < KEEP_OUT.z1;
}
export function inShop(f, wallClear = 0) {
  return f.x - f.hx >= -SHOP.halfX + wallClear && f.x + f.hx <= SHOP.halfX - wallClear && f.z - f.hz >= -SHOP.halfZ + wallClear && f.z + f.hz <= SHOP.halfZ - wallClear;
}
export function inZone(f, zoneName, slack = 0) {
  const z = ZONES[zoneName];
  return f.x - f.hx >= z.x - z.hx - slack && f.x + f.hx <= z.x + z.hx + slack && f.z - f.hz >= z.z - z.hz - slack && f.z + f.hz <= z.z + z.hz + slack;
}
