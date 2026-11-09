// Quality presets (PROMPT.md section 7: low, medium, high; high by default).
export const QUALITY = {
  low:    { pixelRatio: 1,   shadowMap: 1024, shadowCasters: 2, ao: false, bloom: false, smaa: false, envSize: 128, aniso: 2,  tex: 512 },
  medium: { pixelRatio: 1,   shadowMap: 2048, shadowCasters: 3, ao: true,  bloom: true,  smaa: true,  envSize: 256, aniso: 4,  tex: 1024 },
  high:   { pixelRatio: 1.25, shadowMap: 3072, shadowCasters: 4, ao: true,  bloom: true,  smaa: true,  envSize: 512, aniso: 8,  tex: 2048 },
};
export const DEFAULT_QUALITY = 'high';
export function qualityFromUrl() {
  const q = new URLSearchParams(location.search).get('quality');
  return QUALITY[q] ? q : (localStorage.getItem('dds.quality') && QUALITY[localStorage.getItem('dds.quality')] ? localStorage.getItem('dds.quality') : DEFAULT_QUALITY);
}
