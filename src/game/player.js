// First-person walk controller with capsule-vs-AABB collision (circle in plan view plus height checks).
import * as THREE from 'three';

export const PLAYER = { radius: 0.34, eye: 1.65, crouchEye: 0.95, walk: 2.4, run: 4.6, crouchSpeed: 1.2, height: 1.78 };

export class Player {
  constructor(camera, colliders) {
    this.camera = camera; this.colliders = colliders;
    this.pos = new THREE.Vector3(-3, 0, 7.6); this.yaw = Math.PI; this.pitch = -0.05; this.eye = PLAYER.eye; this.crouch = false;
    this.vel = new THREE.Vector3(); this.bounds = { x0: -11.6, x1: 11.6, z0: -8.6, z1: 8.6 };
    this.bobT = 0;
  }
  setPose(x, z, yaw, pitch = 0) { this.pos.set(x, 0, z); this.yaw = yaw; this.pitch = pitch; }

  look(dx, dy, sens = 0.0022) {
    this.yaw -= dx * sens; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * sens));
  }

  // collide the circle at (x, z) against all boxes; returns corrected position
  resolve(x, z, y0, y1) {
    const r = PLAYER.radius;
    for (let pass = 0; pass < 3; pass++) {
      for (const b of this.colliders) {
        if (b.userData && b.userData.enabled === false) continue;
        if (b.max.y < y0 + 0.25 || b.min.y > y1) continue; // above or below the capsule
        const cx = Math.max(b.min.x, Math.min(x, b.max.x)), cz = Math.max(b.min.z, Math.min(z, b.max.z));
        let dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; x += (dx / d) * push; z += (dz / d) * push; }
          else { // center inside the box: push out along the shallowest axis
            const l = x - b.min.x, rr = b.max.x - x, t = z - b.min.z, bt = b.max.z - z;
            const m = Math.min(l, rr, t, bt);
            if (m === l) x = b.min.x - r; else if (m === rr) x = b.max.x + r; else if (m === t) z = b.min.z - r; else z = b.max.z + r;
          }
        }
      }
    }
    return [x, z];
  }

  update(dt, input) {
    const targetEye = this.crouch ? PLAYER.crouchEye : PLAYER.eye;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 10);
    const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const speed = this.crouch ? PLAYER.crouchSpeed : (input.down('ShiftLeft') || input.down('ShiftRight')) ? PLAYER.run : PLAYER.walk;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let vx = (-sin * f + cos * s), vz = (-cos * f - sin * s);
    const len = Math.hypot(vx, vz); if (len > 0) { vx = (vx / len) * speed; vz = (vz / len) * speed; }
    // smooth acceleration
    this.vel.x += (vx - this.vel.x) * Math.min(1, dt * 12); this.vel.z += (vz - this.vel.z) * Math.min(1, dt * 12);
    let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    // sub-step to avoid tunnelling
    const steps = Math.ceil(Math.hypot(this.vel.x, this.vel.z) * dt / 0.1) || 1;
    nx = this.pos.x; nz = this.pos.z;
    for (let i = 0; i < steps; i++) {
      nx += (this.vel.x * dt) / steps; nz += (this.vel.z * dt) / steps;
      [nx, nz] = this.resolve(nx, nz, 0, this.eye + 0.12);
    }
    nx = Math.max(this.bounds.x0, Math.min(this.bounds.x1, nx)); nz = Math.max(this.bounds.z0, Math.min(this.bounds.z1, nz));
    this.pos.x = nx; this.pos.z = nz;
    this.bobT += Math.hypot(this.vel.x, this.vel.z) * dt * 1.9;
    this.applyCamera();
  }

  applyCamera() {
    const bob = Math.sin(this.bobT * 2) * 0.012 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 2);
    this.camera.position.set(this.pos.x, this.eye + bob, this.pos.z);
    this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
