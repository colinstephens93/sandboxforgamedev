// Pure drawer logic (no three, no DOM): the open/close state of a toolbox drawer and the stacking layout of drawer fronts.

export class Drawer {
  constructor({ travel = 0.5, speed = 2.6 } = {}) {
    this.travel = travel; this.speed = speed; // travel in meters, speed in "fractions per second"
    this.t = 0; this.target = 0;
  }
  get isOpen() { return this.target > 0.5; }
  toggle() { this.target = this.target > 0.5 ? 0 : 1; return this.target > 0.5; }
  setOpen(open) { this.target = open ? 1 : 0; }
  // advance the animation; returns true while moving
  update(dt) {
    if (this.t === this.target) return false;
    const step = this.speed * dt;
    this.t = this.t < this.target ? Math.min(this.target, this.t + step) : Math.max(this.target, this.t - step);
    return true;
  }
  // eased extension in meters (smoothstep)
  get offset() { const t = this.t; return this.travel * t * t * (3 - 2 * t); }
}

// Stack drawer fronts from the bottom: returns [{ y (center), h }] with `gap` between them, filling `total` exactly.
export function layoutDrawers(heights, gap, total) {
  const n = heights.length;
  const sum = heights.reduce((a, b) => a + b, 0);
  const k = (total - gap * (n + 1)) / sum;
  let y = gap;
  return heights.map((h) => { const hh = h * k; const out = { y: y + hh / 2, h: hh }; y += hh + gap; return out; });
}
