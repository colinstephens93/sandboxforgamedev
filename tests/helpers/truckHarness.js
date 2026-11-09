// Shared by the truck tests: a canvas stub so the builders run under node, and an "exercise" that drives every moving
// part of the truck (engine, gauges, doors, hood, tailgate, fuel door, wheels, lamps and every use-with-E action).
import * as THREE from 'three';

// minimal canvas stub: every 2D call is a no-op, pixel buffers are zeros
export function installFakeDom() {
  if (globalThis.document) return;
  const mkCtx = () => new Proxy({}, {
    get(t, k) {
      if (k === 'createImageData' || k === 'getImageData') return (a, b, c, d) => { const W = k === 'createImageData' ? a : c, H = k === 'createImageData' ? b : d; return { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) }; };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, _ctx: null, getContext() { return (this._ctx ||= mkCtx()); } }) };
}

// Drives the truck through its states. `probe()` is called during and after every stage (parts are then away from their rest pose).
export function exerciseTruck(truck, ctl, probe) {
  const anims = [], errors = [];
  const ctx = { animate: (fn) => anims.push(fn), say() {}, sfx() {}, state: {}, shop: null, game: null };
  const I = truck.interior, P = truck.parts;
  let cabState = {};
  const cab = (o) => I.update(0.05, { keyPos: 2, rpm: 0, mph: 0, coolantF: 190, transF: 150, oilPsi: 40, volts: 14, fuel: 0.5, lights: {}, dicMessage: '', odometerMi: 1, engineHours: 1, ...(cabState = o || cabState) });
  // time passes: hinge animations, plus the cab's own animations (key, glove box, stalks), which advance in interior.update
  let step = 0;
  const run = (sec = 4) => { for (let t = 0; t < sec; t += 0.05) { for (let i = anims.length - 1; i >= 0; i--) if (anims[i](0.05)) anims.splice(i, 1); cab(); if (++step % 4 === 0) { truck.group.updateMatrixWorld(true); probe(); } } };
  const stage = (fn) => { try { fn(); } catch (e) { errors.push(e.message); } run(); truck.group.updateMatrixWorld(true); probe(); };

  stage(() => { for (let i = 0; i < 20; i++) truck.update(0.05, { rpm: 2600, running: true, fanDuty: 1, turboRpm: 140000, shimmer: 1 }); });
  stage(() => { for (let i = 0; i < 20; i++) cab({ rpm: 2600, mph: 62, gear: 'D', transfer: '4HI', lights: { waitToStart: true, waterInFuel: true }, dicMessage: 'TRANSMISSION HOT' }); if (I.interiorLight) I.interiorLight.setOn(true); });
  stage(() => { for (let i = 0; i < 20; i++) cab({ keyPos: 3, gear: 'R', transfer: '4LO' }); });
  stage(() => { for (const d of Object.values(ctl.doors)) d.toggle(ctx, true); ctl.hoodState.cabReleased = ctl.hoodState.secondaryReleased = true; ctl.hood.toggle(ctx, true); });
  stage(() => { P.tailgate.set(1); P.fuelDoor.set(1); P.wheels.spin(1.3); for (const w of P.wheels.all) w.setLoadFlat(0.4); P.lamps.set({ tail: 1, brake: 1, turn: 1, reverse: 1 }); });
  const core = P.engineBay.core;
  if (core) { stage(() => { core.setCutaway(true); for (let i = 0; i < 40; i++) truck.update(0.05, { rpm: 900, running: true }); }); stage(() => { core.setCutaway(false); core.setExploded(true); for (let i = 0; i < 60; i++) truck.update(0.05, { rpm: 900, running: true }); }); stage(() => { core.setExploded(false); for (let i = 0; i < 80; i++) truck.update(0.05, {}); }); }
  // every use-with-E action on the truck, twice (there and back), probing in between
  const acts = []; truck.group.traverse((o) => { if (o.userData.interact && o.userData.interact.run) acts.push(o); });
  for (let pass = 0; pass < 2; pass++) stage(() => { for (const o of acts) { try { o.userData.interact.run(ctx); } catch (e) { errors.push(`${o.name}: ${e.message}`); } run(1.5); } });
  return { errors, actions: acts.length };
}

// Everything about a mesh that a baked copy could not follow: where it is, whether it is shown, its material and its vertices.
export function meshState(o, root) {
  let vis = true; for (let p = o; p && p !== root.parent; p = p.parent) if (!p.visible) vis = false;
  const pos = o.geometry.attributes.position;
  return { m: o.matrixWorld.elements.map((v) => Math.round(v * 1e5)).join(','), vis, mat: Array.isArray(o.material) ? '' : o.material.uuid, ver: pos.version, geo: o.geometry.uuid };
}
