// Shop layout constants (meters, shop frame: X along the 24 m length, Z along the 18 m width, floor at y = 0).
// Source: PROMPT.md section 5 (about 24 x 18 m, 6 m eave height, two roll-up doors, office, equipment list).
// These are design numbers for the game's building, not real-world data about the truck.
export const SHOP = {
  halfX: 12, halfZ: 9, eave: 6.0, ridge: 7.4,
  wallT: 0.2,
  doorW: 4.2, doorH: 4.3, doorXs: [-3, 3], // roll-up doors on the north wall (z = -halfZ)
  columnXs: [-6, 0, 6],
};

// Truck placement on the dyno: the truck faces -Z (toward the open roll-up doors).
// The truck origin is the front axle centerline on the floor; the rear axle sits on the dyno rollers.
export const DYNO = {
  truckOrigin: { x: 0, z: -0.8 },
  pit: { halfW: 1.75, len: 2.1, depth: 1.15 }, // pit under the rear axle
};

// Named zones for equipment placement (center x, z, half extents) so that no two items overlap.
export const ZONES = {
  office: { x: 9.2, z: 6.2, hx: 2.8, hz: 2.8 }, // south-east corner
  lift: { x: -8.2, z: 2.6, hx: 2.4, hz: 2.2 },
  bench: { x: -10.2, z: -4.4, hx: 1.2, hz: 2.2 }, // west wall
  tireArea: { x: -8.4, z: 7.0, hx: 3.2, hz: 1.7 },
  compressor: { x: 10.8, z: -7.6, hx: 1.1, hz: 1.1 },
  shelving: { x: 11.0, z: -1.2, hx: 0.6, hz: 3.4 }, // east wall
  toolboxes: { x: 5.5, z: 8.2, hx: 3.0, hz: 0.5 },
};
