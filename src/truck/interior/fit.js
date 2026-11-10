// Keeps the cab trim inside the body. The upper cab narrows toward the roof (tumblehome), but the pillar trim, roof rails
// and headliner were laid out on near-vertical walls, so above the beltline they stood up to 3.6 in outside the door frames
// and roof and showed from outside as a tan cage around the glass. Every interior vertex above the beltline is pulled in to
// sit just inside the body surface at its own height and station.
import * as THREE from 'three';
import { halfWidth, roofHeight, H, ST, IN_TO_M } from '../skin.js';

const WALL = 1.1;  // inches inside the outer skin (door frame and glass thickness)
const ROOF = 0.9;  // inches below the roof skin

export function fitInteriorToBody(interior, root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4(), back = new THREE.Matrix4(), inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), v = new THREE.Vector3();
  const seen = new Set(); let moved = 0;
  interior.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry.attributes.position) return;
    if (seen.has(o.geometry)) o.geometry = o.geometry.clone(); // a shared shape is fitted once per place it is used
    seen.add(o.geometry);
    toRoot.multiplyMatrices(inv, o.matrixWorld); back.copy(toRoot).invert();
    const p = o.geometry.attributes.position; let touched = false;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(toRoot);
      const x = v.x / IN_TO_M, y = v.y / IN_TO_M, s = v.z / IN_TO_M;
      if (y <= H.beltline || s < 40 || s > ST.cabBack) continue;
      let nx = x, ny = y;
      const top = roofHeight(s, x) - ROOF; if (y > top) ny = top;
      const w = Math.max(0, halfWidth(s, ny) - WALL); if (Math.abs(x) > w) nx = Math.sign(x) * w;
      if (nx === x && ny === y) continue;
      v.set(nx * IN_TO_M, ny * IN_TO_M, v.z).applyMatrix4(back); p.setXYZ(i, v.x, v.y, v.z); touched = true; moved++;
    }
    if (touched) { p.needsUpdate = true; o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox(); }
  });
  return moved;
}
