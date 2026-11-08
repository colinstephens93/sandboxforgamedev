// Dyno hardware (increments 1.4 and 2.6): pit, rollers and absorber, wheel chocks, tie-down straps, cooling fan,
// exhaust extraction hose, weather station and the control stand. Everything is in the shop frame (meters, floor y = 0).
//
//   const hw = buildDynoHardware({ quality, shop });
//   scene.add(hw.group);
//   hw.update(dt, { rollerRad, straps: [b,b,b,b], fan, chocks, hose, air: {tempC, pressureKpa, humidityPct}, run });
//
// Integration notes are in the final report of the builder; anchors.* is documented at the bottom of this file.
import * as THREE from 'three';
import { makeMats } from './mats.js';
import { buildPit } from './pit.js';
import { buildRollers } from './rollers.js';
import { buildStraps } from './straps.js';
import { buildFan, FAN_POS } from './fan.js';
import { buildHose } from './hose.js';
import { buildChocks } from './chocks.js';
import { buildStand, buildWeather, drawPlaceholder, STAND_POS, WEATHER_POS } from './stand.js';
import { rollerLayout, HOSE, PIT } from './logic.js';

export { DYNO_LABELS } from './labels.js';

export function buildDynoHardware({ quality, shop } = {}) {
  quality = quality || { tex: 512, aniso: 2, shadowMap: 1024 };
  const M = makeMats(quality);
  const group = new THREE.Group(); group.name = 'dyno_hardware';
  const colliders = [];
  const interactables = [];

  const pit = buildPit(M, quality);
  const mech = buildRollers(M, quality);
  const straps = buildStraps(M);
  const fan = buildFan(M);
  const hose = buildHose(M);
  const chocks = buildChocks(M);
  const stand = buildStand(M, quality);
  const weather = buildWeather(M);
  group.add(pit.group, mech.group, straps.group, fan.group, hose.group, chocks.group, stand.group, weather.group);
  colliders.push(...pit.colliders, ...fan.colliders, ...stand.colliders, ...weather.colliders);
  interactables.push(...straps.interactables, fan.group, hose.group, ...chocks.interactables);

  const L = rollerLayout();
  const anchors = {
    strapTruckPoints: straps.anchors.strapTruckPoints,   // 4 x [x, y, z] shop frame: FL, FR (tow hooks), RL, RR (rear frame)
    strapFloorPoints: straps.anchors.strapFloorPoints,   // 4 x [x, 0, z] D-ring floor anchors
    screen: stand.screen,                                 // { canvas 1280x720, ctx, texture, autoDraw }: set autoDraw = false to own it
    tailpipe: HOSE.tailpipe.slice(),                      // where the hose cone slips on
    fan: { x: FAN_POS.x, y: FAN_POS.y, z: FAN_POS.z },
    controlStand: { x: STAND_POS.x, z: STAND_POS.z }, weatherStation: { x: WEATHER_POS.x, z: WEATHER_POS.z },
    pit: { halfW: PIT.hw, halfLen: PIT.hl, depth: PIT.depth, centerZ: PIT.cz },
    rollers: { radius: 0.3048, setX: L.setX, zFront: L.zFront, zRear: L.zRear, axisY: L.cy, tireCenterY: L.tireY },
    rearAxleDropM: L.rearAxleDrop,                        // seat the truck's rear axle this much lower on the rollers (pivot about the front axle)
  };

  // live placeholder for the screen until the integrator takes over (screen.autoDraw = false)
  const scr = stand.screen; let scrTimer = 0, scrKey = '';
  const lastSt = { v: null };

  function update(dt, st = {}) {
    lastSt.v = st;
    mech.update(dt, st.rollerRad || 0);
    straps.update(dt, st);
    fan.update(dt, !!st.fan);
    hose.update(dt, !!st.hose);
    chocks.update(st.chocks === undefined ? true : !!st.chocks);
    weather.draw(st.air);
    if (scr.autoDraw) {
      scrTimer += dt;
      if (scrTimer > 0.2) {
        scrTimer = 0;
        const r = st.run || {};
        const key = `${r.phase}|${Math.round(r.rpm || 0)}|${Math.round(r.hp || 0)}|${Math.round(r.tq || 0)}`;
        if (key !== scrKey) { scrKey = key; drawPlaceholder(scr, st); }
      }
    }
  }

  group.userData.hardware = { pit, mech, straps, fan, hose, chocks, stand, weather };
  return { group, colliders, anchors, interactables, update, parts: { pit, mech, straps, fan, hose, chocks, stand, weather } };
}
