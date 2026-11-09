// Named camera bookmarks (PROMPT.md section 10): used by `npm run shots`. Positions are in the SHOP frame (meters).
// The truck's front axle is at (0, 0, -0.8); the rear axle at z = 3.086. `setup(game)` prepares the scene state for the shot.
export const BOOKMARKS = {
  hero: { pos: [3.55, 0.62, -3.85], tgt: [-0.1, 0.95, 0.9], fov: 40, file: '01-hero', setup: (g) => g.prepare({ rollup: true }) },
  side: { pos: [8.1, 1.15, 1.7], tgt: [0, 1.02, 1.7], fov: 27, file: '02-side-profile', setup: (g) => g.prepare({}) },
  rear: { pos: [4.75, 2.35, 8.45], tgt: [0.0, 0.95, 4.7], fov: 40, file: '03-rear-tailgate-down', setup: (g) => g.prepare({ tailgate: true, straps: true }) },
  engine: { pos: [0.1, 2.75, -2.25], tgt: [0, 0.95, -0.7], fov: 56, file: '04-engine-bay', setup: (g) => g.prepare({ hood: true }) },
  driver: { pos: [-0.406, 1.40, 0.876], tgt: [-0.41, 1.12, -0.2], fov: 64, file: '05-driver-dash', setup: (g) => g.prepare({ engine: true, seat: true }) },
  door: { pos: [-2.85, 1.5, 2.55], tgt: [-0.95, 1.05, 0.45], fov: 55, file: '06-open-door', setup: (g) => g.prepare({ door: 'fL' }) },
  dynoScreen: { dom: 'dyno', file: '07-dyno-run', setup: (g) => g.prepare({ run: 'stock' }) },
  pit: { pos: [0.0, -0.5, 5.95], tgt: [0.0, 0.8, 2.2], fov: 78, file: '08-pit-underside', setup: (g) => g.prepare({ straps: true }) },
  shopWide: { pos: [-11.2, 3.4, 8.3], tgt: [2.0, 1.3, -1.8], fov: 60, file: '09-shop-wide', setup: (g) => g.prepare({ rollup: true }) },
  wheel: { pos: [1.95, 0.55, -1.15], tgt: [0.86, 0.45, -0.8], fov: 38, file: '10-wheel-badge', setup: (g) => g.prepare({}) },
  ailive: { pos: [-4.55, 1.30, 0.35], tgt: [-3.62, 1.02, 1.05], fov: 42, file: '11-ailive-write', setup: (g) => g.prepare({ flash: 'writing' }) },
  compare: { dom: 'ailive-compare', file: '12-compare-baseline-vs-tune', setup: (g) => g.prepare({ compare: 'race' }) },
};
export const BOOKMARK_ORDER = ['hero', 'side', 'rear', 'engine', 'driver', 'door', 'dynoScreen', 'pit', 'shopWide', 'wheel', 'ailive', 'compare'];



