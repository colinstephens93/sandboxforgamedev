// Pointing at things: names and descriptions (inspection mode, I), and use (E) on anything with userData.interact.
import * as THREE from 'three';
import { labelFor } from '../data/labels/index.js';

export class Interactor {
  constructor(camera, roots) {
    this.camera = camera; this.roots = roots; this.ray = new THREE.Raycaster(); this.ray.far = 6;
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

// Hinged panel: wraps `group` (geometry in the truck frame) in a pivot Group so it can swing about a vertical or horizontal axis.
export function makeHinge(parent, group, pivot /* THREE.Vector3 in the parent's frame (meters) */) {
  const piv = new THREE.Group(); piv.position.copy(pivot);
  parent.add(piv);
  parent.remove(group); piv.add(group); group.position.sub(pivot);
  return piv;
}

export const ease = (t) => t * t * (3 - 2 * t);

// Animated hinge with limits: state in [0,1]
export class HingeDoor {
  constructor({ pivot, axis = 'y', maxAngle, speed = 1.6, onChange }) {
    this.pivot = pivot; this.axis = axis; this.maxAngle = maxAngle; this.state = 0; this.target = 0; this.speed = speed; this.onChange = onChange;
  }
  get angle() { return this.maxAngle * ease(this.state); }
  toggle(ctx, open = this.target < 0.5) { this.target = open ? 1 : 0; ctx.animate((dt) => this.step(dt)); }
  step(dt) {
    const d = Math.sign(this.target - this.state) * dt * this.speed;
    if (Math.abs(this.target - this.state) <= Math.abs(d)) this.state = this.target; else this.state += d;
    this.pivot.rotation[this.axis] = this.angle; if (this.onChange) this.onChange(this);
    return this.state === this.target;
  }
  get open() { return this.target > 0.5; }
}
