// Ignition and diesel start sequence from the 2005 Duramax diesel supplement (DS, GM 15101364), section "Starting Your Diesel Engine":
//  * shifter in PARK or NEUTRAL or the engine will not crank
//  * key to RUN: gauges and DIC come on, the Wait to Start light comes on briefly (fast warm-up glow plugs), and may not come on at all with a hot engine
//  * as soon as the light goes off, key to START; the engine cranks, catches with a diesel clatter; the key springs back to RUN
//  * holding START longer than 15 seconds: stop, key to OFF, wait one minute for the starter to cool
//  * the engine shuts off with the key
// Elevated idle / exhaust restrictor: below 32 F air and below 150 F coolant, idle ramps 680 -> 1200 rpm after a delay;
// interrupted by brake, accelerator or leaving PARK/NEUTRAL; ends when coolant reaches 150 F.
import { spec } from '../data/truckSpec.js';
import { clamp } from './util.js';

const S = spec.start, E = spec.engine;

export const KEY = { LOCK: 0, ACC: 1, RUN: 2, START: 3 };

export class Ignition {
  constructor() {
    this.key = KEY.LOCK; this.startHeld = false;
    this.wtsOn = false; this.wtsRemaining = 0; this.wtsDone = false;
    this.cranking = false; this.crankTime = 0; this.crankTotal = 0; this.catchTimer = 0;
    this.cooldown = 0; // seconds until the starter has cooled
    this.engineRunning = false; this.dicPowered = false; this.gaugesOn = false;
    this.messages = []; this.message = ''; this.messageT = 0;
    this.elevatedEnabled = false; this.elevatedTimer = 0; this.elevatedRamp = 0; this.dicNote = ''; this.dicNoteT = 0;
    this.idleTargetRpm = E.idleRpm; this.brakeAccelSeen = false;
    this.cluster = { tachRpm: 0 };
  }

  say(text, t = 4) { this.message = text; this.messageT = t; }

  // Key moves; START is momentary (spring-loaded): call releaseStart() to let it spring back to RUN.
  setKey(k, { coolantF = 70, range = 'P' } = {}) {
    const prev = this.key;
    this.key = k;
    if (k === KEY.LOCK || k === KEY.ACC) {
      if (this.engineRunning) this.pendingStop = true;
      this.engineRunning = false; this.cranking = false; this.wtsOn = false; this.wtsRemaining = 0; this.wtsDone = false;
      this.gaugesOn = k === KEY.ACC ? false : false; this.dicPowered = false;
      this.crankTotal = 0; this.elevatedRamp = 0; this.elevatedTimer = 0;
      return;
    }
    if (k === KEY.RUN && prev < KEY.RUN) {
      this.gaugesOn = true; this.dicPowered = true; this.wtsDone = false;
      // glow plug wait: much shorter than other diesels; may not come on with a hot engine
      if (coolantF >= S.waitToStartMaxCoolantF) { this.wtsOn = false; this.wtsDone = true; this.wtsRemaining = 0; }
      else {
        const t = clamp((coolantF - 20) / (S.waitToStartMaxCoolantF - 20), 0, 1);
        this.wtsRemaining = S.waitToStartSecondsCold + (S.waitToStartSecondsMild - S.waitToStartSecondsCold) * t;
        this.wtsOn = true;
      }
    }
    if (k === KEY.START) {
      if (this.blocked) { this.say(this.blocked, 6); this.key = prev; return; } // ECM unusable (failed write): set by the AI Live hook
      if (range !== 'P' && range !== 'N') { this.say('Shift to PARK or NEUTRAL: the engine will not crank in any other position.'); this.key = prev; return; }
      if (this.engineRunning) { this.key = prev; return; }
      if (this.cooldown > 0) { this.say(`Starter is cooling: wait ${Math.ceil(this.cooldown)} s (the manual says one minute).`); this.key = prev; return; }
      if (prev < KEY.RUN) { this.key = KEY.RUN; this.say('Turn the key to RUN first and wait for the Wait to Start light.'); return; }
      this.cranking = true; this.crankTime = 0; this.catchTimer = 0; this.startHeld = true;
    }
  }

  releaseStart() { if (this.key === KEY.START) { this.key = KEY.RUN; this.startHeld = false; this.cranking = false; } }

  toggleElevatedIdle() {
    this.elevatedEnabled = !this.elevatedEnabled;
    this.dicNote = this.elevatedEnabled ? 'ELEVATED IDLE ENABLED' : 'ELEVATED IDLE DISABLED'; this.dicNoteT = 5;
  }

  // inputs: { coolantF, airF, range, brake, pedal, speedMph }
  update(dt, inp) {
    this.messageT = Math.max(0, this.messageT - dt); if (!this.messageT) this.message = '';
    this.dicNoteT = Math.max(0, this.dicNoteT - dt); if (!this.dicNoteT) this.dicNote = '';
    this.cooldown = Math.max(0, this.cooldown - dt);
    const out = { crank: false, running: this.engineRunning, startEngine: false, stopEngine: false, idleTargetRpm: E.idleRpm };
    if (this.wtsOn) { this.wtsRemaining -= dt; if (this.wtsRemaining <= 0) { this.wtsOn = false; this.wtsDone = true; } }
    if (this.cranking) {
      this.crankTime += dt; this.crankTotal += dt; out.crank = true;
      if (!this.wtsOn) this.catchTimer += dt; // the glow plugs must be ready before the engine can fire
      const catchDelay = inp.coolantF < 60 ? 1.2 : inp.coolantF < 120 ? 0.8 : 0.5;
      if (this.catchTimer >= catchDelay && !this.engineRunning) {
        this.engineRunning = true; out.startEngine = true; out.crank = false; this.cranking = false; this.crankTotal = 0;
        if (this.startHeld) { /* the player releases the key; it returns to RUN */ }
      }
      if (this.crankTime >= S.crankMaxSeconds && !this.engineRunning) {
        this.cranking = false; this.cooldown = S.starterCooldownSeconds; this.key = KEY.LOCK; this.startHeld = false; this.gaugesOn = false; this.dicPowered = false; this.wtsOn = false;
        this.say('The engine did not start after 15 seconds of cranking. Key OFF, wait one minute for the starter to cool, then try again.', 8);
      }
    }
    if (this.pendingStop) { out.stopEngine = true; this.pendingStop = false; }
    if (this.engineRunning && this.key < KEY.RUN) { this.engineRunning = false; out.stopEngine = true; }
    out.running = this.engineRunning;

    // ---- elevated idle (cold weather feature) ----
    const interrupt = inp.brake > 0.05 || inp.pedal > 0.03 || (inp.range !== 'P' && inp.range !== 'N') || (inp.speedMph || 0) > 0.5;
    const conditions = this.elevatedEnabled && inp.airF < S.elevatedIdleBelowAirF && inp.coolantF < S.elevatedIdleBelowCoolantF;
    if (!this.engineRunning || !conditions) { this.elevatedTimer = 0; this.elevatedRamp = Math.max(0, this.elevatedRamp - dt / 3); }
    else if (interrupt) { this.elevatedTimer = 0; this.elevatedRamp = Math.max(0, this.elevatedRamp - dt / 1.5); }
    else {
      this.elevatedTimer += dt;
      if (this.elevatedTimer > S.elevatedIdleDelaySec) this.elevatedRamp = Math.min(1, this.elevatedRamp + dt / S.elevatedIdleRampSec);
    }
    this.idleTargetRpm = E.idleRpm + (E.elevatedIdleRpm - E.idleRpm) * this.elevatedRamp;
    out.idleTargetRpm = this.idleTargetRpm;
    out.elevatedActive = this.elevatedRamp > 0.02;
    return out;
  }
}
