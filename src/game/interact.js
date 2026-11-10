// Pointing at things: names and descriptions (inspection mode, I), and use (E) on anything with userData.interact.
import * as THREE from 'three';
import { labelFor } from '../data/labels/index.js';
import { PICK_LAYER } from '../truck/optimize.js';

export class Interactor {
  constructor(camera, roots) {
    this.camera = camera; this.roots = roots; this.ray = new THREE.Raycaster(); this.ray.far = 6;
    this.ray.layers.enable(PICK_LAYER); // merged truck parts keep their originals on this layer for pointing
    this.target = null; this.hit = null; this.timer = 0; this.maxUse = 2.9;
    this.inspect = false; this.animations = [];
    this.center = new THREE.Vector2(0, 0);
  }
  animate(fn) { this.animations.push(fn); }

  find(obj) {
    let label = null, act = null, o = obj;
    while (o) {
      if (!label && o.userData && o.userData.labelId) label = o.userData.labelId;
      if (!act && o.userData && o.userData.interact) act = o;
      if (label && act) break;
      o = o.parent;
    }
    return { label, act };
  }

  update(dt, enabled = true) {
    for (let i = this.animations.length - 1; i >= 0; i--) { if (this.animations[i](dt)) this.animations.splice(i, 1); }
    this.timer -= dt;
    if (!enabled) { this.target = null; this.hit = null; return; }
    if (this.timer > 0) return;
    this.timer = 0.07;
    this.ray.setFromCamera(this.center, this.camera);
    let best = null;
    const hits = this.ray.intersectObjects(this.roots, true);
    for (const h of hits) {
      if (!h.object.visible || h.object.userData.noPick) continue;
      let vis = true, p = h.object; while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; }
      if (!vis) continue;
      if (h.object.material && h.object.material.transparent && h.object.material.opacity < 0.5 && !h.object.userData.labelId) { /* glass: look through for labels */ continue; }
      best = h; break;
    }
    this.hit = best;
    if (!best) { this.target = null; return; }
    const { label, act } = this.find(best.object);
    this.target = { label, act, dist: best.distance, point: best.point, labelInfo: label ? labelFor(label) : null, interactable: act && best.distance <= this.maxUse ? act : null };
  }

  use(ctx) {
    if (this.target && this.target.interactable) {
      const it = this.target.interactable.userData.interact;
      if (it.run) it.run(ctx); return true;
    }
    return false;
  }
}

// the hinge helpers live in hinge.js so the bench page can use them without loading the label data (which imports shop modules)
export { makeHinge, ease, HingeDoor } from './hinge.js';
