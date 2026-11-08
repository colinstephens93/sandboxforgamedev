import { describe, it, expect } from 'vitest';
import { Ignition, KEY } from '../src/sim/startSequence.js';

const step = (ig, secs, inp = {}, dt = 0.05) => { let o; for (let t = 0; t < secs; t += dt) o = ig.update(dt, { coolantF: 60, airF: 70, range: 'P', brake: 0, pedal: 0, speedMph: 0, ...inp }); return o; };
const ctx = (o = {}) => ({ coolantF: 60, range: 'P', ...o });

describe('diesel start sequence (2005 Duramax diesel supplement)', () => {
  it('will not crank unless the shifter is in PARK or NEUTRAL', () => {
    const ig = new Ignition(); ig.setKey(KEY.RUN, ctx({ range: 'D' })); step(ig, 3);
    ig.setKey(KEY.START, ctx({ range: 'D' })); expect(ig.cranking).toBe(false); expect(ig.message).toMatch(/PARK or NEUTRAL/);
    ig.setKey(KEY.START, ctx({ range: 'N' })); expect(ig.cranking).toBe(true);
  });
  it('key to RUN lights the gauges and the Wait to Start light, which goes off after a short time', () => {
    const ig = new Ignition(); ig.setKey(KEY.RUN, ctx());
    expect(ig.gaugesOn).toBe(true); expect(ig.dicPowered).toBe(true); expect(ig.wtsOn).toBe(true);
    step(ig, 1.0); expect(ig.wtsOn).toBe(true);
    step(ig, 2.0); expect(ig.wtsOn).toBe(false);
  });
  it('the Wait to Start light may not come on at all with a hot engine', () => {
    const ig = new Ignition(); ig.setKey(KEY.RUN, ctx({ coolantF: 190 })); expect(ig.wtsOn).toBe(false);
  });
  it('the engine catches after the light goes off and the key returns to RUN', () => {
    const ig = new Ignition(); ig.setKey(KEY.RUN, ctx()); step(ig, 3);
    ig.setKey(KEY.START, ctx()); let started = false;
    for (let t = 0; t < 4 && !started; t += 0.05) { const o = ig.update(0.05, { coolantF: 60, airF: 70, range: 'P', brake: 0, pedal: 0 }); if (o.startEngine) started = true; }
    expect(started).toBe(true); ig.releaseStart(); expect(ig.key).toBe(KEY.RUN); expect(ig.engineRunning).toBe(true);
  });
  it('cranking while the light is still on does not start the engine until the light goes off', () => {
    const ig = new Ignition(); ig.setKey(KEY.RUN, ctx()); ig.setKey(KEY.START, ctx());
    step(ig, 1.0); expect(ig.engineRunning).toBe(false);
    step(ig, 4.0); expect(ig.engineRunning).toBe(true);
  });
  it('holding START past 15 seconds without a start stops cranking and requires a one-minute cool-down', () => {
    const ig = new Ignition(); ig.setKey(KEY.RUN, ctx({ coolantF: 20 })); ig.wtsRemaining = 1e6; // light never goes off: engine cannot fire
    ig.setKey(KEY.START, ctx({ coolantF: 20 }));
    step(ig, 14.5); expect(ig.cranking).toBe(true);
    step(ig, 1.0); expect(ig.cranking).toBe(false); expect(ig.cooldown).toBeGreaterThan(55);
    ig.wtsRemaining = 0; ig.setKey(KEY.RUN, ctx()); ig.setKey(KEY.START, ctx()); expect(ig.cranking).toBe(false);
    expect(ig.message).toMatch(/cooling/i);
    step(ig, 61); ig.setKey(KEY.RUN, ctx()); step(ig, 3); ig.setKey(KEY.START, ctx()); expect(ig.cranking).toBe(true);
  });
  it('the engine shuts off with the key', () => {
    const ig = new Ignition(); ig.setKey(KEY.RUN, ctx()); step(ig, 3); ig.setKey(KEY.START, ctx()); step(ig, 3); ig.releaseStart();
    expect(ig.engineRunning).toBe(true); ig.setKey(KEY.LOCK, ctx()); const o = ig.update(0.05, { coolantF: 60, airF: 70, range: 'P', brake: 0, pedal: 0 });
    expect(o.stopEngine).toBe(true); expect(ig.engineRunning).toBe(false);
  });
});

describe('elevated idle and exhaust restrictor', () => {
  const run = (cfg, secs) => { const ig = new Ignition(); ig.setKey(KEY.RUN, ctx()); step(ig, 3); ig.setKey(KEY.START, ctx()); step(ig, 3); ig.releaseStart(); if (cfg.enable) ig.toggleElevatedIdle(); const o = step(ig, secs, cfg.inp || {}); return { ig, o }; };
  it('idle stays at 680 rpm when the feature is disabled', () => { expect(run({ inp: { airF: 20, coolantF: 100 } }, 120).o.idleTargetRpm).toBe(680); });
  it('ramps from 680 to 1,200 rpm after a delay when below 32 F air and 150 F coolant', () => {
    expect(run({ enable: true, inp: { airF: 20, coolantF: 100 } }, 5).o.idleTargetRpm).toBe(680);
    expect(run({ enable: true, inp: { airF: 20, coolantF: 100 } }, 120).o.idleTargetRpm).toBeCloseTo(1200, 0);
  });
  it('does not ramp when the air is warm or the coolant is already at 150 F', () => {
    expect(run({ enable: true, inp: { airF: 40, coolantF: 100 } }, 120).o.idleTargetRpm).toBe(680);
    expect(run({ enable: true, inp: { airF: 20, coolantF: 150 } }, 120).o.idleTargetRpm).toBe(680);
  });
  it('drops back to normal on the brake, the accelerator or leaving PARK/NEUTRAL', () => {
    for (const inp of [{ brake: 1 }, { pedal: 0.2 }, { range: 'D' }]) {
      const { ig } = run({ enable: true, inp: { airF: 20, coolantF: 100 } }, 120);
      expect(ig.idleTargetRpm).toBeCloseTo(1200, 0);
      const o = step(ig, 10, { airF: 20, coolantF: 100, ...inp }); expect(o.idleTargetRpm).toBe(680);
    }
  });
  it('shows ELEVATED IDLE ENABLED / DISABLED on the driver information center', () => {
    const ig = new Ignition(); ig.toggleElevatedIdle(); expect(ig.dicNote).toBe('ELEVATED IDLE ENABLED'); ig.toggleElevatedIdle(); expect(ig.dicNote).toBe('ELEVATED IDLE DISABLED');
  });
});
