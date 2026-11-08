// Shop equipment builder (owned by the equipment agent). Stub: returns an empty group until implemented.
import * as THREE from 'three';
export function buildEquipment({ quality, shop }) {
  const group = new THREE.Group(); group.name = 'equipment';
  return { group, colliders: [], anchors: {}, update() {} };
}
