import { describe, it, expect } from 'vitest';
import { AILive, FLASH } from '../src/sim/flash.js';

const RUN = { keyPos: 2, engineRunning: false };
const run = (ai, secs, env = RUN, dt = 0.1) => { for (let t = 0; t < secs; t += dt) ai.update(dt, env); };

function ready() { const ai = new AILive(); ai.plug(true); ai.setCharger(true); ai.read(RUN); run(ai, FLASH.readSeconds + 1); return ai; }

describe('AI Live procedure', () => {
  it('needs the cable and key RUN with the engine off to read', () => {
    const ai = new AILive();
    expect(ai.read(RUN)).toBe(false); ai.plug(true);
    expect(ai.read({ keyPos: 0, engineRunning: false })).toBe(false);
    expect(ai.read({ keyPos: 2, engineRunning: true })).toBe(false);
    expect(ai.read(RUN)).toBe(true); run(ai, FLASH.readSeconds + 1);
    expect(ai.stage).toBe('readDone'); expect(ai.readTune).toBe('stock');
  });
  it('requires a backup before the first write', () => {
    const ai = ready();
    expect(ai.canWrite(RUN).ok).toBe(false); expect(ai.canWrite(RUN).why).toMatch(/backup/i);
    expect(ai.write(RUN, 'street')).toBe(false);
    ai.saveBackup(RUN); run(ai, FLASH.backupSeconds + 1);
    expect(ai.backup).toBe(true); expect(ai.canWrite(RUN).ok).toBe(true);
  });
  it('a full write works, takes a realistic duration, and applies after a key cycle', () => {
    const ai = ready(); ai.saveBackup(RUN); run(ai, 7);
    expect(ai.write(RUN, 'street')).toBe(true);
    run(ai, FLASH.writeSeconds * 0.5); expect(ai.stage).toBe('writing'); expect(ai.progress).toBeGreaterThan(0.4); expect(ai.progress).toBeLessThan(0.6);
    run(ai, FLASH.writeSeconds * 0.6); expect(ai.stage).toBe('writeDone'); expect(ai.installed).toBe('stock'); expect(ai.needsKeyCycle).toBe(true);
    expect(ai.keyCycled()).toEqual({ tune: 'street', sound: { close: 0, hold: 0 } }); expect(ai.installed).toBe('street');
  });
  it('an interrupted write fails: key off, cable unplugged, engine started', () => {
    for (const bad of [{ keyPos: 0, engineRunning: false }, { keyPos: 2, engineRunning: true }]) {
      const ai = ready(); ai.saveBackup(RUN); run(ai, 7); ai.write(RUN, 'race'); run(ai, 10);
      run(ai, 1, bad); expect(ai.stage).toBe('failed'); expect(ai.bricked).toBe(true); expect(ai.noStartReason()).toMatch(/not responding/);
    }
    const ai = ready(); ai.saveBackup(RUN); run(ai, 7); ai.write(RUN, 'race'); run(ai, 10); ai.plug(false); run(ai, 1);
    expect(ai.bricked).toBe(true); expect(ai.installed).toBe('stock');
  });
  it('without the charger the battery sags and the write fails; with the charger it completes', () => {
    const ai = new AILive(); ai.plug(true); ai.read(RUN); run(ai, 13); ai.saveBackup(RUN); run(ai, 7);
    ai.write(RUN, 'heavytow'); run(ai, FLASH.writeSeconds + 1);
    expect(ai.stage).toBe('failed'); expect(ai.message).toMatch(/battery/i);
    const ok = ready(); ok.saveBackup(RUN); run(ok, 7); ok.write(RUN, 'heavytow'); run(ok, FLASH.writeSeconds + 1);
    expect(ok.stage).toBe('writeDone');
  });
  it('a failed write is recoverable by writing a tune again (backup or another tune)', () => {
    const ai = ready(); ai.saveBackup(RUN); run(ai, 7); ai.write(RUN, 'race'); run(ai, 5); run(ai, 1, { keyPos: 0, engineRunning: false });
    expect(ai.bricked).toBe(true);
    expect(ai.write(RUN, 'stock')).toBe(true); run(ai, FLASH.writeSeconds + 1);
    expect(ai.stage).toBe('writeDone'); expect(ai.bricked).toBe(false); ai.keyCycled(); expect(ai.installed).toBe('stock');
  });
  it('turbo sound settings are stored with the tune and Reset returns the tune values', () => {
    const ai = ready(); ai.saveBackup(RUN); run(ai, 7); ai.setSound(0.6, 0.2); ai.write(RUN, 'street'); run(ai, FLASH.writeSeconds + 1);
    expect(ai.keyCycled().sound).toEqual({ close: 0.6, hold: 0.2 }); ai.setSound(1, 1); ai.resetSound('street'); expect(ai.sound).toEqual({ close: 0.6, hold: 0.2 });
  });
});
