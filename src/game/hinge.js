// Hinges for doors, hood and other swinging panels. No dependencies beyond three, so the truck studio and the bench
// page can open the truck without loading anything else of the game.
import * as THREE from 'three';

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
