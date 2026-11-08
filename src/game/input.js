// Keyboard and mouse state, pointer lock.
export class Input {
  constructor(canvas) {
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set(); this.released = new Set();
    this.mouseDX = 0; this.mouseDY = 0; this.locked = false; this.enabled = true; this.listeners = [];
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'F1' || e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code); this.emit('keydown', e);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); this.emit('keyup', e); });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; this.emit('lock', this.locked); });
    window.addEventListener('mousemove', (e) => { if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; } });
    canvas.addEventListener('mousedown', (e) => { this.emit('mousedown', e); });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  on(fn) { this.listeners.push(fn); }
  emit(type, e) { for (const l of this.listeners) l(type, e); }
  lock() { if (!this.locked) { try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  tap(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.released.clear(); this.mouseDX = 0; this.mouseDY = 0; }
}
