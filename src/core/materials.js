// Shared physically based materials. All textures are generated in code.
import * as THREE from 'three';
import { makeCanvas, noiseField, canvasFromField, heightToNormal, tex, rng } from './proc.js';

const cache = {};
const once = (k, f) => (cache[k] ||= f());

// Fine orange-peel normal map for clearcoat paint
function orangePeel() {
  return once('peel', () => {
    const n = 256, f = noiseField(n, n, 48, 7, 3, 0.55);
    return tex(heightToNormal(f, n, n, 0.9), { repeat: [6, 6], srgb: false });
  });
}

export const mat = {
  paint(color = 0xf3f3ef) {
    // Summit White: gloss with clearcoat
    return new THREE.MeshPhysicalMaterial({
      color, roughness: 0.22, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.02,
      clearcoatNormalMap: orangePeel(), clearcoatNormalScale: new THREE.Vector2(0.08, 0.08), envMapIntensity: 1.4,
    });
  },
  chrome() { return new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, metalness: 1.0, roughness: 0.04, envMapIntensity: 2.0 }); },
  polishedAluminum() { return new THREE.MeshPhysicalMaterial({ color: 0xdde1e4, metalness: 1.0, roughness: 0.14, envMapIntensity: 1.4 }); },
  castMetal(color = 0x8b8e91) { return new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.5, envMapIntensity: 0.9 }); },
  steelPainted(color = 0x2a2d31, roughness = 0.45) { return new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness, envMapIntensity: 0.8 }); },
  blackPlastic(rough = 0.55) { return new THREE.MeshStandardMaterial({ color: 0x141517, roughness: rough, metalness: 0.0, envMapIntensity: 0.7 }); },
  rubber(color = 0x0e0e0f) { return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.4 }); },
  // No `transmission` on any truck glass or lens: a single transmissive material makes three.js draw every opaque object in
  // the scene a second time into a separate target each frame. Plain transparency looks the same here at a fraction of the cost.
  glassTinted() {
    return new THREE.MeshPhysicalMaterial({ color: 0x0a1513, metalness: 0.08, roughness: 0.02, transparent: true, opacity: 0.68, envMapIntensity: 2.2, ior: 1.52, side: THREE.DoubleSide });
  },
  // Rear doors and back window: the factory deep-tint privacy glass. Two faces, because it reads differently from each side:
  // nearly black from outside (the cab behind it is dim), still see-through from the seats.
  glassPrivacy(inside = false) {
    return new THREE.MeshPhysicalMaterial({ color: 0x050807, metalness: 0.08, roughness: 0.02, transparent: true, opacity: inside ? 0.55 : 0.96, envMapIntensity: inside ? 0.6 : 2.2, ior: 1.52, side: inside ? THREE.BackSide : THREE.FrontSide });
  },
  glassClear() {
    return new THREE.MeshPhysicalMaterial({ color: 0xcfe0e0, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.25, envMapIntensity: 1.4, ior: 1.5, side: THREE.DoubleSide });
  },
};

export function clearCache() { for (const k in cache) delete cache[k]; }

