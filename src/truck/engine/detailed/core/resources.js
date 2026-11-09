// Resource identity, rather than names, separates shared assets from build ownership.
function textures(value, result, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (value.isTexture) { result.add(value); return; }
  if (Array.isArray(value)) { for (const item of value) textures(item, result, seen); }
  else for (const item of Object.values(value)) textures(item, result, seen);
}

export function sharedResources(materials) {
  const shared = new Set();
  for (const material of Object.values(materials)) {
    if (!material || typeof material !== 'object') continue;
    shared.add(material);
    textures(material, shared);
  }
  return shared;
}

export function createResourceDisposer(roots, materials) {
  const shared = sharedResources(materials);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    const geometries = new Set(), ownedMaterials = new Set(), ownedTextures = new Set(), instances = new Set();
    for (const root of roots) root.traverse(object => {
      // Three.Sprite uses one module-owned geometry across every scene/build.
      if (object.geometry && !object.isSprite) geometries.add(object.geometry);
      if (object.isInstancedMesh) instances.add(object);
      for (const material of [object.material].flat()) {
        if (!material || shared.has(material)) continue;
        ownedMaterials.add(material);
        textures(material, ownedTextures);
      }
    });
    for (const resources of [instances, geometries, ownedTextures, ownedMaterials]) {
      for (const resource of resources) if (!shared.has(resource)) resource.dispose();
    }
    for (const root of roots) root.removeFromParent();
  };
}
