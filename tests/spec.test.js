import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { spec, IN, LB, HP, LBFT, HP_CONST } from '../src/data/truckSpec.js';

describe('truckSpec', () => {
  it('every numeric/array leaf carries a confirmed|estimated tag comment', () => {
    const lines = fs.readFileSync(new URL('../src/data/truckSpec.js', import.meta.url), 'utf8').split('\n');
    const bad = [];
    let inSpec = false;
    lines.forEach((l, i) => {
      if (l.startsWith('export const spec')) inSpec = true;
      if (!inSpec) return;
      // a leaf: key: number | key: [numbers] | key: 'string',  followed by a comment
      if (/^\s+\w+:\s*(-?[\d.]+|\[[^\]]*\]|'[^']*'),/.test(l) && !/\/\/\s*(confirmed|estimated)/.test(l)) bad.push(`${i + 1}: ${l.trim()}`);
    });
    expect(bad).toEqual([]);
  });
  it('wheelbase and rated figures are the confirmed values', () => {
    expect(spec.dims.wheelbaseIn).toBe(153.0);
    expect(spec.engine.ratedHp).toBe(310);
    expect(spec.engine.ratedTorqueLbFt).toBe(605);
    expect(spec.drivetrain.axleRatio).toBe(3.73);
    expect(spec.drivetrain.trans.gears).toEqual([3.1, 1.81, 1.41, 1.0, 0.71]);
  });
  it('unit helpers', () => {
    expect(153 * IN).toBeCloseTo(3.8862, 4);
    expect(1 * LB).toBeCloseTo(0.4536, 4);
    // 1 hp = 550 ft-lb/s ; hp = T*rpm/5252
    expect((605 * 1600) / HP_CONST).toBeCloseTo(184.3, 0);
    expect(605 * LBFT).toBeCloseTo(820.3, 0);
    expect(HP).toBeGreaterThan(745);
  });
});

describe('truckSpec immutability', () => {
  it('throws a TypeError when mutated (module code is strict)', () => {
    expect(() => { spec.engine.idleRpm = 1; }).toThrow(TypeError);
    expect(() => { spec.newKey = 1; }).toThrow(TypeError);
  });
});
