// WebGL renderer and the post-processing chain: ACES filmic tone mapping, subtle bloom, ambient occlusion, SMAA.
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, NormalPass, SSAOEffect, BloomEffect, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, BlendFunction } from 'postprocessing';
import { QUALITY } from './quality.js';

export class Renderer {
  constructor(canvas, qualityName) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, stencil: false, depth: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false; // shadows are refreshed on a schedule (see render)
    this.renderer.shadowMap.needsUpdate = true;
    this.shadowFrame = 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping; // tone mapping is done in the composer (ACES filmic)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.exposure = 1.0;
    this.scene = null; this.camera = null; this.composer = null;
    this.setQuality(qualityName);
  }

  get q() { return QUALITY[this.qualityName]; }

  setQuality(name) {
    this.qualityName = QUALITY[name] ? name : 'high';
    try { localStorage.setItem('dds.quality', this.qualityName); } catch {}
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio));
    this.renderer.shadowMap.needsUpdate = true;
    if (this.scene) this.build(this.scene, this.camera);
    this.resize();
    if (this.onQuality) this.onQuality(this.q);
  }

  build(scene, camera) {
    this.scene = scene; this.camera = camera;
    if (this.composer) this.composer.dispose();
    const q = this.q;
    const composer = new EffectComposer(this.renderer, { multisampling: 0, frameBufferType: THREE.HalfFloatType });
    composer.addPass(new RenderPass(scene, camera));
    const effects = [];
    this.aoEffect = null;
    if (q.ao) {
      const normalPass = new NormalPass(scene, camera);
      composer.addPass(normalPass);
      this.aoEffect = new SSAOEffect(camera, normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY, distanceScaling: true, depthAwareUpsampling: true,
        samples: this.qualityName === 'high' ? 12 : 9, rings: 7, distanceThreshold: 0.35, distanceFalloff: 0.12,
        rangeThreshold: 0.0006, rangeFalloff: 0.0003, luminanceInfluence: 0.6, minRadiusScale: 0.33, radius: 0.07,
        intensity: 1.6, bias: 0.03, fade: 0.01, resolutionScale: this.qualityName === 'high' ? 0.75 : 0.5,
      });
      effects.push(this.aoEffect);
    }
    if (q.bloom) {
      this.bloom = new BloomEffect({ intensity: 0.45, luminanceThreshold: 1.0, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.7 });
      effects.push(this.bloom);
    }
    this.toneMap = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    effects.push(this.toneMap);
    composer.addPass(new EffectPass(camera, ...effects));
    if (q.smaa) composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: this.qualityName === 'high' ? SMAAPreset.MEDIUM : SMAAPreset.LOW })));
    this.composer = composer;
  }

  setScene(scene, camera) { this.build(scene, camera); this.resize(); }

  setCamera(camera) {
    this.camera = camera;
    if (this.scene) this.build(this.scene, camera);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera && this.camera.isPerspectiveCamera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.composer) this.composer.setSize(w, h, false);
  }

  render(dt, forceShadows = false) {
    if (forceShadows || this.shadowFrame++ % (this.q.shadowEvery || 1) === 0) this.renderer.shadowMap.needsUpdate = true;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
