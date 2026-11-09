import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { QUALITY } from '../src/core/quality.js';

// minimal canvas stub so the builders (textures, badge artwork) run under node: every 2D call is a no-op, pixel buffers are zeros
function installFakeDom() {
  if (globalThis.document) return;
  const mkCtx = (w, h) => new Proxy({}, {
    get(t, k) {
      if (k === 'createImageData' || k === 'getImageData') return (a, b, c, d) => { const W = k === 'createImageData' ? a : c, Hh = k === 'createImageData' ? b : d; return { width: W, height: Hh, data: new Uint8ClampedArray(W * Hh * 4) }; };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  globalThis.document = { createElement: () => { const c = { width: 0, height: 0, _ctx: null, getContext() { return (this._ctx ||= mkCtx(this.width, this.height)); } }; return c; } };
}
installFakeDom();

// Regression: a Batch that names a material which does not exist throws 'no material <key>' while the truck is being built,
// which froze the loading screen in production (the engine bay charge pipe used 'aluminum' instead of 'alumPipe').
describe('whole-truck build (stub canvas)', () => {
  for (const name of ['low', 'medium', 'high']) {
    it(`builds at ${name} quality without a missing-material error`, async () => {
      const { buildTruck } = await import('../src/truck/index.js');
      const truck = buildTruck({ quality: QUALITY[name] });
      expect(truck.group).toBeInstanceOf(THREE.Group);
      let meshes = 0; truck.group.traverse((o) => { if (o.isMesh) meshes++; });
      expect(meshes).toBeGreaterThan(500);
      expect(truck.parts.engineBay).toBeTruthy();
    }, 60000);
  }
});
