// The wiring between the simulation and a truck on screen, shared by the shop game (src/game/game.js) and the
// bench page (src/bench/bench.js). Each function takes a host object and reads only these fields:
//   truck, truckCtl, plant, dyno, ign, ai, state, audio, camera, pedal, brakeIn, time
// (plus mode and truckZ for the walking listener of the shop game). Nothing here knows about the shop.
import { Plant } from '../sim/plant.js';
import { Dyno } from '../sim/dyno.js';
import { Ignition } from '../sim/startSequence.js';
import { AILive } from '../sim/flash.js';
import { loadCal } from '../sim/calibrations.js';
import { degCtoF } from '../data/truckSpec.js';
import { TIRE_R } from '../sim/driveline.js';

export const SIM_DT = 1 / 120; // fixed simulation step

// creates the plant, the dyno, the ignition and AI Live on the host
export function initSim(host) {
  const cal = loadCal('stock');
  if (!cal) throw new Error('Stock calibration failed to load');
  host.plant = new Plant({ cal, regulator: 'LLY', weather: { tempC: 24, pressureKpa: 101.0, humidityPct: 45 } });
  host.plant.setCalibration(cal);
  host.dyno = new Dyno(host.plant);
  host.ign = new Ignition(); host.ai = new AILive();
  host.simAcc = 0; host.shopTempF = 75;
}

// advance the fixed-step simulation by one frame of dt seconds (at most 8 steps, as the game always did)
export function runSim(host, dt) {
  host.simAcc += dt; let n = 0;
  while (host.simAcc >= SIM_DT && n < 8) { stepSim(host, SIM_DT); host.simAcc -= SIM_DT; n++; }
  if (host.simAcc > 0.1) host.simAcc = 0;
}

export function stepSim(host, dt) {
  // ignition/start logic drives the plant
  const p = host.plant;
  const o = host.ign.update(dt, { coolantF: p.coolantF, airF: p.air.tempC * 1.8 + 32, range: host.state.range || 'P', brake: host.brakeIn || 0, pedal: host.pedal || 0, speedMph: p.dl.wheelSpeed() * TIRE_R * 2.23694 });
  if (o.startEngine) p.startEngine();
  if (o.stopEngine) p.stopEngine();
  p.idleTargetRpm = o.idleTargetRpm;
  p.hoodClosed = !(host.truckCtl && host.truckCtl.hood && host.truckCtl.hood.open);
  if (host.dyno.phase === 'idle' || host.dyno.phase === 'done' || host.dyno.phase === 'refused') p.step(dt, { pedal: host.pedal || 0, range: host.state.range || 'P', brake: host.brakeIn || 0 });
  else host.dyno.update(dt);
  host.ai.update(dt, { keyPos: host.ign.key, engineRunning: host.ign.engineRunning });
  // rear lamps follow the real state: tail lamps with the key on, brake lamps on the pedal, reverse lamps
  // in R (PROMPT.md section 4 lists the lamp set; this wires rear.js lamps.set to the simulation)
  if (host.truck.parts.lamps) {
    host.truck.parts.lamps.set({
      tail: host.ign.key >= 1 ? 0.7 : 0,
      brake: (host.brakeIn || 0) > 0.12 ? 1 : 0,
      turn: 0,
      reverse: (host.state.range === 'R' && host.ign.key >= 2) ? 1 : 0,
    });
  }
}

// what the engine bay animation is given each frame (fan, shake, turbo shimmer)
export function truckVisualState(host) {
  const p = host.plant, o = p.out || {};
  return { rpm: p.rpm, running: p.running, fanDuty: p.fanDuty, turboRpm: o.turboRpm || 0, shimmer: Math.min(1, Math.max(0, ((o.egtPreK || 300) - 700) / 600)) };
}

export function updateCab(host, dt) {
  const p = host.plant, ig = host.ign, I = host.truck.interior;
  host.state.coolantF = p.coolantF; host.state.dt = dt;
  let keyPos = ig.key;
  if (ig.clusterFault && keyPos >= 2) keyPos = Math.sin(host.time * 23) + Math.sin(host.time * 7.3) > 0.2 ? 2 : 0; // failed write: cluster dark or flickering
  const oilF = degCtoF(p.oilC);
  const oilPsi = p.running ? Math.min(120, 22 + p.rpm * 0.02 + Math.max(0, 190 - oilF) * 0.33) : 0;
  const msg = ig.dicNote || (p.dl.transF > 265 ? 'TRANSMISSION HOT' : p.reducedPower ? 'REDUCED ENGINE POWER' : '');
  I.update(dt, {
    keyPos, rpm: p.running ? p.rpm : 0, mph: p.dl.wheelSpeed() * TIRE_R * 2.23694, coolantF: p.coolantF, transF: p.dl.transF, oilPsi,
    volts: p.running ? 14.1 : (host.ai.charger ? 13.4 : host.ai.volts), fuel: p.fuelLevel, lights: { waitToStart: ig.wtsOn, waterInFuel: false }, dicMessage: msg,
    odometerMi: p.odometerKm / 1.609344, engineHours: p.engineSeconds / 3600,
  });
  const open = Object.values(host.truckCtl.doors).some((d) => d.state > 0.03);
  if (I.interiorLight) I.interiorLight.setOn(open);
}

// The listener of the shop game: the camera, walking around a truck whose front axle is at z = host.truckZ.
export function cameraListener(host) {
  const cam = host.camera.position, truckZ = host.truckZ || 0;
  const tz = truckZ + 1.0;
  const open = Object.values(host.truckCtl.doors).filter((d) => d.state > 0.05).length;
  const dx = cam.x - 0, dz = cam.z - tz;
  return { x: cam.x, y: cam.y, z: cam.z, inCab: host.mode === 'driver', doorOpen: open > 0, distanceToTruck: Math.hypot(dx, dz), distanceToDyno: Math.hypot(dx, cam.z - (truckZ + 3.9)), pan: Math.max(-1, Math.min(1, -dx / 6)) };
}

// listener: where the sound is heard from (default: the host's camera; the bench passes a fixed point)
export function updateAudio(host, dt, listener = cameraListener(host)) {
  const p = host.plant, o = p.out || {};
  const open = Object.values(host.truckCtl.doors).filter((d) => d.state > 0.05).length;
  const st = {
    running: p.running, cranking: host.ign.cranking, rpm: p.rpm, load: o.load || 0, qty: o.qty || 0, turboRpm: o.turboRpm, vane: o.vane,
    boostPsi: o.boostPsi, mAir: o.mAir, driveKpa: o.driveKpa, smoke: o.smoke, coolantF: p.coolantF, fanDuty: p.fanDuty,
    rollerRad: p.dl.wr, tccLocked: p.dl.tccLocked, cpSlipRpm: p.dl.cpSlip * 30 / Math.PI, fail: p.fail.state, doorsOpenCount: open,
    wtsOn: host.ign.wtsOn, shopFan: host.dyno.fan, exhaustHose: host.dyno.hoseOn, hoodOpen: host.truckCtl.hood ? host.truckCtl.hood.open : false,
  };
  try { host.audio.update(dt, st, listener); } catch (e) { /* audio must never break the frame */ }
}
