// Environment map of the shop itself: render the real room (lights, doors, daylight) from the dyno area into a
// cube map, then PMREM it so the paint, chrome and glass reflect the actual room (PROMPT.md section 8).
import * as THREE from 'three';

export function bakeEnvironment(renderer, scene, position, size = 256) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.1, 200, rt);
  cam.position.copy(position);
  const prevEnv = scene.environment;
  scene.environment = null;
  const shadowOn = renderer.shadowMap.autoUpdate;
  cam.update(renderer, scene);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(rt.texture);
  pmrem.dispose(); rt.dispose();
  scene.environment = env.texture;
  return env;
}
