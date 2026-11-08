// Named camera bookmarks (PROMPT.md section 10): used by `npm run shots`. Positions are in the SHOP frame (meters).
// The truck's front axle is at (0, 0, -0.8); the rear axle at z = 3.086. `setup(game)` prepares the scene state for the shot.
export const BOOKMARKS = {
  hero: { pos: [-3.7, 0.72, -4.2], tgt: [0.35, 0.95, -0.9], fov: 38, file: '01-hero', setup: (g) => g.prepare({ rollup: true }) },
  side: { pos: [8.4, 1.05, 1.15], tgt: [0, 1.0, 1.15], fov: 30, file: '02-side-profile', setup: (g) => g.prepare({}) },
  rear: { pos: [3.4, 1.35, 8.6], tgt: [0, 0.85, 4.1], fov: 46, file: '03-rear-tailgate-down', setup: (g) => g.prepare({ tailgate: true, straps: true }) },
  engine: { pos: [0.1, 2.75, -2.25], tgt: [0, 0.95, -0.7], fov: 56, file: '04-engine-bay', setup: (g) => g.prepare({ hood: true }) },
  driver: { pos: [-0.41, 1.36, 0.86], tgt: [-0.41, 1.12, -0.2], fov: 64, file: '05-driver-dash', setup: (g) => g.prepare({ engine: true, seat: true }) },
  door: { pos: [-2.5, 1.25, 1.9], tgt: [-1.0, 1.0, 0.55], fov: 52, file: '06-open-door', setup: (g) => g.prepare({ door: 'fL' }) },
  dynoScreen: { dom: 'dyno', file: '07-dyno-run', setup: (g) => g.prepare({ run: 'stock' }) },
  pit: { pos: [0.0, -0.42, 4.45], tgt: [0.0, 0.2, 2.4], fov: 74, file: '08-pit-underside', setup: (g) => g.prepare({ straps: true }) },
  shopWide: { pos: [-11.2, 3.4, 8.3], tgt: [2.0, 1.3, -1.8], fov: 60, file: '09-shop-wide', setup: (g) => g.prepare({ rollup: true }) },
  wheel: { pos: [1.95, 0.55, -1.15], tgt: [0.86, 0.45, -0.8], fov: 38, file: '10-wheel-badge', setup: (g) => g.prepare({}) },
  ailive: { pos: [-2.9, 1.5, 2.6], tgt: [-3.5, 0.95, 1.0], fov: 52, file: '11-ailive-write', setup: (g) => g.prepare({ flash: 'writing' }) },
  compare: { dom: 'ailive-compare', file: '12-compare-baseline-vs-tune', setup: (g) => g.prepare({ compare: 'race' }) },
};
export const BOOKMARK_ORDER = ['hero', 'side', 'rear', 'engine', 'driver', 'door', 'dynoScreen', 'pit', 'shopWide', 'wheel', 'ailive', 'compare'];
