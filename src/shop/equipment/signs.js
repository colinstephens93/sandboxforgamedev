// All printed signs of the shop share one atlas texture and are merged into a single mesh (one draw call).
import { THREE, Part, atlasPlane, tex } from './common.js';
import { signAtlas } from './art.js';

export function createSigns(quality) {
  const atlas = signAtlas(quality.tex);
  const material = new THREE.MeshStandardMaterial({ map: tex(atlas.canvas, { wrap: false, aniso: quality.aniso }), roughness: 0.38, metalness: 0.0, envMapIntensity: 0.6 });
  const part = new Part();
  return {
    material,
    // width in meters; height follows the design's aspect. The plane faces +Z rotated by ry about Y, centered at (x, y, z).
    add(id, width, x, y, z, ry = 0) {
      const a = atlas.aspect[id];
      if (!a) throw new Error('unknown sign ' + id);
      const g = atlasPlane(width, width / a, atlas.uv[id]);
      part.push(material, g, x, y, z, 0, ry, 0);
      return { w: width, h: width / a };
    },
    build(parent) { return part.build(parent, { cast: false, receive: true, name: 'signs' }); },
  };
}
