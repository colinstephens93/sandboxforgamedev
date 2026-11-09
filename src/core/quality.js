// Quality presets (PROMPT.md section 7: low, medium, high; high by default).
export const QUALITY = {
  // shadowCasters: how many of the three ceiling spotlights cast shadows (the one over the truck is kept longest)
  // pixelRatio below 1 renders at a lower resolution and scales up (low only)
  // fillLights: shop ceiling point lights kept (every light is evaluated for every lit pixel, so fewer is much cheaper)
  // shadowEvery: re-render the shadow maps every Nth frame (shadows only change when something moves)
  low:    { pixelRatio: 0.75, shadowMap: 1024, shadowCasters: 1, ao: false, bloom: false, smaa: false, envSize: 128, aniso: 2,  tex: 512,  fillLights: 2, shadowEvery: 4 },
  medium: { pixelRatio: 1,   shadowMap: 2048, shadowCasters: 3, ao: false, bloom: true,  smaa: true,  envSize: 256, aniso: 4,  tex: 1024, fillLights: 4, shadowEvery: 3 },
  high:   { pixelRatio: 1.25, shadowMap: 2048, shadowCasters: 4, ao: true,  bloom: true,  smaa: true,  envSize: 512, aniso: 8,  tex: 2048, fillLights: 4, shadowEvery: 2 },
};
export const DEFAULT_QUALITY = 'medium';
export function qualityFromUrl() {
  const q = new URLSearchParams(location.search).get('quality');
  return QUALITY[q] ? q : (localStorage.getItem('dds.quality') && QUALITY[localStorage.getItem('dds.quality')] ? localStorage.getItem('dds.quality') : DEFAULT_QUALITY);
}
