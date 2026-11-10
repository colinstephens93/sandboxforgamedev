// AI Live: the original laptop tuning app's procedure, modelled like real Duramax flashing (PROMPT.md section 5A).
//   plug in the cable (OBD-II port under the left of the dash) -> key to RUN with the engine off -> READ the current tune
//   -> save a BACKUP of the stock tune (required before the first write) -> choose a tune -> WRITE (progress bar, realistic time)
//   -> cycle the key and start the engine.
// A write fails if it is interrupted: key turned off, cable unplugged, engine started, or battery voltage too low (no charger).
// A failed write leaves the truck in a no-start state with the cluster dark or flickering until another write succeeds.
import { clamp } from './util.js';

export const FLASH = {
  readSeconds: 12,
  backupSeconds: 6,
  writeSeconds: 60,          // real flashes take several minutes; compressed for play, still long enough to be a commitment
  batteryStartV: 12.5,       // a shop truck that has been sitting
  batteryDrainVPerS: 0.02,   // key-on load with the ECM, fuel pump and the flash running
  batteryFailV: 11.8,        // below this the write fails
  chargerV: 13.4,
};

export class AILive {
  constructor({ directTuning = false } = {}) {
    this.directTuning = directTuning;
    this.cable = false; this.charger = false;
    this.stage = 'idle';             // idle | reading | readDone | backing | backupDone | writing | writeDone | failed
    this.progress = 0; this.timer = 0;
    this.readTune = null;            // tune id read from the truck
    this.backup = false;             // stock tune backup saved to the laptop
    this.installed = 'stock';        // what the truck currently carries
    this.selected = 'stock';
    this.writing = null;             // tune id being written
    this.volts = FLASH.batteryStartV;
    this.bricked = false;            // no-start state after a failed write
    this.needsKeyCycle = false;
    this.log = [];                   // text log lines for the UI
    this.sound = { close: 0, hold: 0 };           // staged Turbo Sound settings (apply on write)
    this.soundByTune = {};           // tuneId -> {close, hold} stored with each tune
    this.pendingApply = null;        // {tune, sound} applied when the key is cycled after a successful write
    this.message = '';
  }

  say(t) { this.message = t; this.log.push(t); if (this.log.length > 60) this.log.shift(); }

  plug(on) { this.cable = on; if (!on) this.say('Cable unplugged.'); else this.say('Interface connected to the OBD-II port.'); }
  setCharger(on) { this.charger = on; this.say(on ? 'Battery charger clipped to the batteries.' : 'Battery charger removed.'); }
  select(id) { this.selected = id; }
  setSound(close, hold) { this.sound = { close: clamp(close, 0, 1), hold: clamp(hold, 0, 1) }; }
  resetSound(tuneId) { this.sound = { ...(this.soundByTune[tuneId] || { close: 0, hold: 0 }) }; this.say('Turbo Sound reset to the tune\'s own vane settings.'); }

  // Can the laptop talk to the truck?
  linkOk(env) { return this.cable && env.keyPos === 2 && !env.engineRunning; }

  canRead(env) { return this.linkOk(env) && (this.stage === 'idle' || this.stage === 'readDone' || this.stage === 'backupDone' || this.stage === 'writeDone' || this.stage === 'failed'); }

  read(env) {
    if (!this.cable) { this.say('No interface: plug the cable into the OBD-II port.'); return false; }
    if (env.keyPos !== 2 || env.engineRunning) { this.say('Turn the key to RUN with the engine off before reading.'); return false; }
    if (this.stage === 'reading' || this.stage === 'writing' || this.stage === 'backing') return false;
    this.stage = 'reading'; this.progress = 0; this.timer = 0; this.say('Reading the truck\'s current tune...');
    return true;
  }

  saveBackup(env) {
    if (this.readTune == null) { this.say('Read the truck first: a backup is made from the tune that was read.'); return false; }
    if (!this.linkOk(env)) { this.say('Connection lost: plug in, key to RUN, engine off.'); return false; }
    if (this.stage === 'reading' || this.stage === 'writing' || this.stage === 'backing') return false;
    this.stage = 'backing'; this.progress = 0; this.timer = 0; this.say('Saving a backup of the tune that was read...');
    return true;
  }

  canWrite(env) {
    if (this.directTuning) return env.dynoRunning
      ? { ok: false, why: 'Finish or abort the dyno run before changing tunes.' }
      : { ok: true, why: '' };
    if (!this.linkOk(env)) return { ok: false, why: 'Plug in the cable and turn the key to RUN with the engine off.' };
    if (this.stage === 'writing' || this.stage === 'reading' || this.stage === 'backing') return { ok: false, why: 'Busy.' };
    if (!this.bricked && this.readTune == null) return { ok: false, why: 'Read the truck first.' };
    if (!this.bricked && !this.backup) return { ok: false, why: 'Save a backup of the stock tune before the first write.' };
    return { ok: true, why: '' };
  }

  write(env, tuneId = this.selected) {
    const c = this.canWrite(env);
    if (!c.ok) { this.say(c.why); return false; }
    if (this.directTuning) {
      this.pendingApply = { tune: tuneId, sound: { ...this.sound } };
      this.soundByTune[tuneId] = { ...this.sound };
      this.needsKeyCycle = true; // consumed automatically by the bench's apply hook
      this.stage = 'writeDone'; this.progress = 1; this.bricked = false;
      this.readTune = tuneId;
      this.say(`Applying ${tuneId}.`);
      return true;
    }
    this.stage = 'writing'; this.writing = tuneId; this.progress = 0; this.timer = 0;
    this.volts = this.charger ? FLASH.chargerV : Math.min(this.volts, FLASH.batteryStartV);
    this.writeStartSound = { ...this.sound };
    this.say(`Writing ${tuneId}... do not turn the key off or unplug the cable.`);
    return true;
  }

  fail(why) {
    this.stage = 'failed'; this.bricked = true; this.writing = null; this.progress = 0;
    this.say(`WRITE FAILED: ${why} The ECM is in an incomplete state: no start. Write a tune again to recover.`);
  }

  // dt seconds; env = { keyPos, engineRunning }
  update(dt, env) {
    if (this.stage === 'idle' && this.cable && env.keyPos === 2) { /* link up, nothing to do */ }
    // idle battery sag with key on and no charger
    if (env.keyPos >= 2 && !this.charger && this.stage !== 'writing') this.volts = Math.max(11.9, this.volts - 0.0015 * dt);
    if (this.charger) this.volts = Math.min(FLASH.chargerV, this.volts + 0.05 * dt);
    if (this.stage === 'reading') {
      if (!this.linkOk(env)) { this.stage = 'idle'; this.say('Read interrupted.'); return; }
      this.timer += dt; this.progress = clamp(this.timer / FLASH.readSeconds, 0, 1);
      if (this.progress >= 1) { this.stage = 'readDone'; this.readTune = this.bricked ? null : this.installed; if (this.bricked) { this.readTune = null; this.say('The ECM does not respond normally. Recovery mode: write a tune.'); } else this.say(`Read complete: the truck carries "${this.installed}".`); }
    } else if (this.stage === 'backing') {
      if (!this.linkOk(env)) { this.stage = 'readDone'; this.say('Backup interrupted.'); return; }
      this.timer += dt; this.progress = clamp(this.timer / FLASH.backupSeconds, 0, 1);
      if (this.progress >= 1) { this.stage = 'backupDone'; this.backup = true; this.say('Backup saved on the laptop.'); }
    } else if (this.stage === 'writing') {
      if (env.keyPos !== 2) return this.fail('the key was turned off during the write.');
      if (env.engineRunning) return this.fail('the engine was started during the write.');
      if (!this.cable) return this.fail('the cable was unplugged during the write.');
      this.timer += dt; this.progress = clamp(this.timer / FLASH.writeSeconds, 0, 1);
      if (!this.charger) this.volts -= FLASH.batteryDrainVPerS * dt; else this.volts = FLASH.chargerV;
      if (this.volts < FLASH.batteryFailV) return this.fail(`battery voltage fell to ${this.volts.toFixed(1)} V (no charger connected).`);
      if (this.progress >= 1) {
        this.stage = 'writeDone';
        this.installedPending = this.writing; this.pendingApply = { tune: this.writing, sound: { ...this.writeStartSound } };
        this.soundByTune[this.writing] = { ...this.writeStartSound };
        this.bricked = false; this.needsKeyCycle = true; this.readTune = this.writing; this.writing = null;
        this.say('Write complete. Turn the key off, then back on, and start the engine.');
      }
    }
  }

  // called when the key goes to LOCK/ACC after a successful write: the new calibration takes effect on the next RUN
  keyCycled() {
    if (this.needsKeyCycle && this.pendingApply) {
      this.installed = this.pendingApply.tune; this.needsKeyCycle = false;
      const applied = this.pendingApply; this.pendingApply = null;
      if (this.directTuning) this.say(`Applied ${this.installed}.`);
      return applied;
    }
    return null;
  }

  // can the truck start? (no-start state after a failed write, or before the key cycle after a write)
  noStartReason() {
    if (this.bricked) return 'The ECM is not responding after a failed write. Reconnect AI Live and write a tune.';
    return null;
  }
}
