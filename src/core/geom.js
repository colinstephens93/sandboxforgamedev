import * as THREE from 'three';

// Box whose UVs are in meters (so a texture with repeat = 1/tileSize tiles at a real-world scale).
export function metricBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order in BoxGeometry: +x, -x, +y, -y, +z, -z; 4 vertices each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  uv.needsUpdate = true;
  return g;
}

export function metricPlane(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}

export function box(w, h, d, material, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

export function aabb(cx, cy, cz, hx, hy, hz) {
  return new THREE.Box3(new THREE.Vector3(cx - hx, cy - hy, cz - hz), new THREE.Vector3(cx + hx, cy + hy, cz + hz));
}

// Extruded rounded rectangle (rounded edges and real thickness, PROMPT.md section 8)
export function roundedBoxGeometry(w, h, d, r = 0.01, seg = 3) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: r > 0, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: seg * 2 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}
