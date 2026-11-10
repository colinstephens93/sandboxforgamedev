// Draw-call reduction for the truck: meshes that share a material and never move relative to each other are merged
// into one mesh for drawing. The originals stay in the scene graph on a layer the cameras do not draw, so pointing
// at a part (inspection labels, use with E) still finds the individual part with its own name.
//
// Adapted from mergeStaticMeshes in the duramaxsimulator repo; the differences: geometry stays indexed, mirrored
// parts keep their winding, originals are kept for picking, and merging stops at every part that can move.
//
// What may move: a node marked userData.dynamic, anything usable with E (userData.interact), every named anchor,
// and the roots passed in `boundaries`. A subtree marked userData.noMergeTree is skipped whole. Meshes merge only with meshes under the same such node, and the merged mesh
// becomes a child of it, so it moves, hides and culls with it. A mesh that changes on its own (visibility,
// vertices, material) must be marked userData.noMerge. tests/optimize.test.js drives every moving part of the truck
// and fails if a merged part would have changed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PICK_LAYER = 1; // originals of merged meshes: raycast only, never drawn

const isBoundary = (o, set) => set.has(o) || o.userData.dynamic || !!o.userData.interact;

function collectObjects(v, out, depth = 0) {
  if (!v || typeof v !== 'object' || depth > 3) return;
  if (v.isObject3D) { out.add(v); return; }
  if (Array.isArray(v)) { for (const x of v) collectObjects(x, out, depth + 1); return; }
  for (const k of Object.keys(v)) collectObjects(v[k], out, depth + 1);
}

// Which meshes would merge, and under which node: [{ anchor, material, sources: [mesh] }]. No changes are made.
export function planMerge(root, { boundaries = [], anchors = null } = {}) {
  const set = new Set(boundaries); set.add(root);
  if (anchors) collectObjects(anchors, set);
  const buckets = new Map();
  const visit = (o, anchor, hidden) => {
    if (o.userData.noMergeTree) return; // a subtree that manages itself (the detailed engine)
    if (o !== root && isBoundary(o, set)) { if (o.isMesh) return; anchor = o; hidden = false; } // a mesh that is itself a moving part stays as it is
    if (!o.visible) hidden = true; // hidden branches (hit shapes, parts switched on later) are left alone
    if (o.isMesh && !hidden && mergeable(o)) {
      const g = o.geometry, attrs = Object.keys(g.attributes).sort().map((k) => `${k}${g.attributes[k].itemSize}`).join(',');
      const key = [anchor.uuid, o.material.uuid, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.renderOrder, attrs].join('|');
      let b = buckets.get(key); if (!b) buckets.set(key, b = { anchor, material: o.material, sources: [] });
      b.sources.push(o);
    }
    for (const c of o.children) visit(c, anchor, hidden);
  };
  visit(root, root, false);
  return [...buckets.values()].filter((b) => b.sources.length > 1);
}

function mergeable(o) {
  if (o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || o.userData.noMerge || o.userData.merged) return false;
  const m = o.material, g = o.geometry;
  if (!m || Array.isArray(m) || m.transparent || !g || !g.attributes.position || !g.attributes.normal) return false;
  if (g.morphAttributes && Object.keys(g.morphAttributes).length) return false;
  if (o.customDepthMaterial || o.customDistanceMaterial || o.layers.mask !== 1) return false;
  for (const a of Object.values(g.attributes)) if (a.isInterleavedBufferAttribute) return false;
  return true;
}

// Small parts stop casting shadows: the shadow pass redraws every caster, and a clip, bolt or switch a few centimetres across
// leaves no shadow anyone could pick out. Sizes are world sizes (metres).
export const SHADOW_MIN_RADIUS = 0.035;
export function trimShadowCasters(root, minRadius = SHADOW_MIN_RADIUS) {
  const s = new THREE.Vector3(); let trimmed = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow || o.isInstancedMesh || !o.geometry.attributes.position) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    s.setFromMatrixScale(o.matrixWorld);
    if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < minRadius) { o.castShadow = false; trimmed++; }
  });
  return trimmed;
}

// Merge. Returns { before, after, merged } mesh counts (drawn meshes).
export function optimizeTruck(truck, { extraBoundaries = [] } = {}) {
  const root = truck.group, P = truck.parts;
  const boundaries = [P.engineBay && P.engineBay.group, P.hoodUnder && P.hoodUnder.group, truck.underside && truck.underside.group, P.interior && P.interior.group, ...extraBoundaries].filter(Boolean);
  root.updateMatrixWorld(true);
  trimShadowCasters(root); // before merging, so small parts group with the other non-casters
  let before = 0; root.traverse((o) => { if (o.isMesh && o.layers.mask === 1) before++; });
  const plan = planMerge(root, { boundaries, anchors: truck.anchors });
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  let made = 0, removed = 0;
  for (const b of plan) {
    inv.copy(b.anchor.matrixWorld).invert();
    const geos = b.sources.map((o) => {
      const g = o.geometry.clone();
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      rel.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(rel);
      if (rel.determinant() < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } } // mirrored part: keep the faces outward
      g.clearGroups(); g.morphTargetsRelative = false;
      return g;
    });
    let merged = null; try { merged = mergeGeometries(geos, false); } catch { merged = null; }
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.material);
    const s0 = b.sources[0];
    m.castShadow = s0.castShadow; m.receiveShadow = s0.receiveShadow; m.renderOrder = s0.renderOrder;
    m.name = `merged_${b.material.name || b.material.type}`; m.userData.merged = true; m.userData.noPick = true; m.userData.sources = b.sources.length;
    m.raycast = () => {}; // pointing goes to the originals
    b.anchor.add(m); m.updateMatrixWorld(true);
    for (const o of b.sources) { o.layers.set(PICK_LAYER); o.userData.pickOnly = true; o.castShadow = false; }
    made++; removed += b.sources.length;
  }
  return { before, after: before - removed + made, merged: made };
}
