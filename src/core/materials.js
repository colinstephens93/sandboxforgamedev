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
      color, roughness: 0.32, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.035,
      clearcoatNormalMap: orangePeel(), clearcoatNormalScale: new THREE.Vector2(0.06, 0.06), envMapIntensity: 1.0,
    });
  },
  chrome() { return new THREE.MeshPhysicalMaterial({ color: 0xf2f4f6, metalness: 1.0, roughness: 0.06, envMapIntensity: 1.6 }); },
  polishedAluminum() { return new THREE.MeshPhysicalMaterial({ color: 0xdde1e4, metalness: 1.0, roughness: 0.14, envMapIntensity: 1.4 }); },
  castMetal(color = 0x8b8e91) { return new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.5, envMapIntensity: 0.9 }); },
  steelPainted(color = 0x2a2d31, roughness = 0.45) { return new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness, envMapIntensity: 0.8 }); },
  blackPlastic(rough = 0.55) { return new THREE.MeshStandardMaterial({ color: 0x141517, roughness: rough, metalness: 0.0, envMapIntensity: 0.7 }); },
  rubber(color = 0x0e0e0f) { return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.4 }); },
  glassTinted() {
    return new THREE.MeshPhysicalMaterial({ color: 0x0a1513, metalness: 0.05, roughness: 0.03, transmission: 0.0, transparent: true, opacity: 0.72, envMapIntensity: 1.9, ior: 1.52, side: THREE.DoubleSide });
  },
  glassClear() {
    return new THREE.MeshPhysicalMaterial({ color: 0xcfe0e0, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.25, envMapIntensity: 1.4, ior: 1.5, side: THREE.DoubleSide });
  },
};

export function clearCache() { for (const k in cache) delete cache[k]; }

