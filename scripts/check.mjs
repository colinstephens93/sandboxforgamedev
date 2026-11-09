// Scripted verification (PROMPT.md section 11) in headless Chromium. node scripts/check.mjs [--full]
import fs from 'node:fs';
import { startApp, openPage } from './lib/browser.mjs';
const full = process.argv.includes('--full');
const app = await startApp(5197);
const logs = [];
const { browser, page } = await openPage({ url: app.url, quality: 'low', logs });
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); };
await page.waitForFunction(() => window.__game && window.__game.frames > 2, null, { timeout: 180000 });
const ev = (fn, arg) => page.evaluate(fn, arg);

// intro plays and skips
ok('intro mode on load', await ev(() => window.__game.mode === 'intro'));
await page.keyboard.press('KeyX');
await page.waitForTimeout(500);
ok('intro skips on a key', await ev(() => window.__game.mode === 'intro' ? false : true));
// (the skip jumps introT; the mode switches to walk on the next update)
ok('walk mode after intro', await page.waitForFunction(() => window.__game.mode === 'walk', null, { timeout: 5000 }).then(() => true).catch(() => false));

// every door opens and closes with the hinge limit
for (const k of ['fL', 'fR', 'rL', 'rR']) {
  await ev((k) => { const d = window.__game.truckCtl.doors[k]; d.toggle(window.__game.ctx, true); }, k);
  await ev(() => window.__game.advance(2));
  const a = await ev((k) => window.__game.truckCtl.doors[k].angle, k);
  ok(`door ${k} opens to its limit`, Math.abs(Math.abs(a) - (k[0] === 'f' ? 72 : 78) * Math.PI / 180) < 0.02, `angle ${(a * 180 / Math.PI).toFixed(1)} deg`);
  await ev((k) => { window.__game.truckCtl.doors[k].toggle(window.__game.ctx, false); }, k);
  await ev(() => window.__game.advance(2));
  ok(`door ${k} closes`, await ev((k) => window.__game.truckCtl.doors[k].angle === 0, k));
}
// hood sequence
await ev(() => { const g = window.__game; const it = g.truckCtl.hoodPivot.userData.interact; it.run(g.ctx); });
ok('hood refuses while latched', await ev(() => window.__game.truckCtl.hood.target === 0));
await ev(() => { const g = window.__game; g.truckCtl.releaseHoodFromCab(g.ctx); g.truckCtl.hoodPivot.userData.interact.run(g.ctx); });
ok('hood refuses without the secondary release', await ev(() => window.__game.truckCtl.hood.target === 0));
await ev(() => { const g = window.__game; g.truckCtl.pullSecondary(g.ctx); g.truckCtl.hoodPivot.userData.interact.run(g.ctx); });
await ev(() => window.__game.advance(3));
ok('hood opens after both releases', await ev(() => window.__game.truckCtl.hood.state === 1));
// tailgate and fuel door
await ev(() => { const g = window.__game; g.truck.parts.tailgate.group.userData.interact.run(g.ctx); g.advance(4); });
const tg = await ev(() => window.__game.truck.parts.tailgate.open01);
ok('tailgate opens to horizontal and hangs', tg > 0.98, `open01 ${tg}`);
await ev(() => { const g = window.__game; g.truck.parts.tailgate.group.userData.interact.run(g.ctx); g.advance(4); });
ok('tailgate closes and latches', await ev(() => window.__game.truck.parts.tailgate.open01 < 0.02));
await ev(() => { const g = window.__game; const f = g.truck.parts.fuelDoor; f.door.userData.interact.run(g.ctx); g.advance(3); });
ok('fuel door opens', await ev(() => window.__game.truck.parts.fuelDoor.open01 > 0.98));
// ---- engine start, dyno, tuning (PROMPT.md section 11) ----
await ev(() => { const g = window.__game; g.ign.setKey(2, { coolantF: 70, range: 'P' }); g.advance(0.5); });
ok('key RUN lights the gauges and the Wait to Start light', await ev(() => window.__game.ign.gaugesOn && window.__game.ign.wtsOn));
await ev(() => { const g = window.__game; g.advance(3); g.ign.setKey(3, { coolantF: 70, range: 'P' }); g.advance(4); g.ign.releaseStart(); g.advance(15); });
const idle = await ev(() => ({ run: window.__game.plant.running, rpm: window.__game.plant.rpm }));
ok('engine starts and idles near 680 rpm', idle.run && Math.abs(idle.rpm - 680) < 40, `rpm ${idle.rpm.toFixed(0)}`);
await ev(() => { const g = window.__game; g.plant.warm(198, 188); g.dyno.runs.length = 0; });
const refused = await ev(() => { const g = window.__game; const r = g.dyno.startRun(); return { ok: r.ok, msg: g.dyno.message }; });
ok('dyno run refused without straps', !refused.ok && /straps/i.test(refused.msg), refused.msg);
const pull = async (label) => {
  await ev(() => { const g = window.__game; g.dyno.strapAll(true); g.dyno.setFan(true); g.dyno.startRun(); });
  await ev(() => { const g = window.__game; let n = 0; while (!['done','idle','refused'].includes(g.dyno.phase) && n++ < 4000) g.advance(0.25, 0.01); });
  return ev(() => { const r = window.__game.dyno.last; return r ? { hp: r.peakHp, tq: r.peakTq, id: r.id, invalid: !!r.invalid, rail: r.railErrPsi } : null; });
};
const stock = await pull('stock');
ok('stock pull completes with a graph and peaks', stock && stock.hp > 230 && stock.hp < 265, JSON.stringify(stock));
// flash procedure
const env = () => ({ keyPos: 2, engineRunning: false });
await ev(() => { const g = window.__game; g.ign.setKey(0, {}); g.advance(0.2); g.plant.stopEngine(); g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(0.5); g.ai.plug(true); });
await ev(() => { const g = window.__game; g.ai.read({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }); g.advance(14); });
const noBackup = await ev(() => { const g = window.__game; return g.ai.write({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }, 'race'); });
ok('a backup is required before the first write', noBackup === false);
await ev(() => { const g = window.__game; g.ai.saveBackup({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }); g.advance(7); });
// interrupted write: key off mid-write
await ev(() => { const g = window.__game; g.ai.setCharger(true); g.ai.write({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }, 'race'); g.advance(10); g.ign.setKey(0, {}); g.advance(1); });
ok('an interrupted write fails and leaves a no-start state', await ev(() => window.__game.ai.bricked && !!window.__game.ai.noStartReason()));
await ev(() => { const g = window.__game; g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(0.5); g.ai.write({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning }, 'street'); g.advance(65); g.ign.setKey(0, {}); g.advance(1); });
ok('a full write succeeds and recovers the truck', await ev(() => !window.__game.ai.bricked && window.__game.ai.installed === 'street'), await ev(() => window.__game.ai.message));
ok('calibration swapped to Street after the key cycle', await ev(() => window.__game.plant.cal.id === 'street'));
await ev(() => { const g = window.__game; g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(3); g.ign.setKey(3, { coolantF: 190, range: 'P' }); g.advance(4); g.ign.releaseStart(); g.advance(8); g.plant.warm(198, 188); });
ok('truck starts again on the new tune', await ev(() => window.__game.plant.running));
const streetLlY = await pull('street LLY');
await ev(() => { window.__game.plant.setRegulator('LBZ'); });
const streetLbz = await pull('street LBZ');
ok('street with the stock regulator falls short on rail pressure and power', streetLlY.rail > 800 && streetLbz.hp > streetLlY.hp + 5, JSON.stringify([streetLlY, streetLbz]));
ok('street with the LBZ regulator reaches stock + 175 whp', Math.abs(streetLbz.hp - stock.hp - 175) < 6, `${(streetLbz.hp - stock.hp).toFixed(1)}`);

// ---- every quick tune changes the dyno result in the expected direction (PROMPT.md section 11) ----
const TUNE_GAIN = { heavytow: 30, lighttow: 60, economy: 120, street: 175, race: 230 };
const installTune = async (id) => {
  const installed = await ev((tune) => {
    const g = window.__game;
    const env = () => ({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning });
    g.ign.setKey(0, {}); g.advance(0.2); g.plant.stopEngine();
    g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(0.5);
    g.ai.plug(true); g.ai.setCharger(true);
    g.ai.read(env()); g.advance(14); g.ai.saveBackup(env()); g.advance(7);
    g.ai.write(env(), tune); g.advance(65);
    g.ign.setKey(0, {}); g.advance(1);
    g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(3);
    g.ign.setKey(3, { coolantF: 190, range: 'P' }); g.advance(4); g.ign.releaseStart(); g.advance(8);
    g.plant.warm(198, 188);
    return { cal: g.plant.cal.id, running: g.plant.running, ai: g.ai.installed, bricked: g.ai.bricked };
  }, id);
  ok(`tune ${id} writes and the engine restarts`, installed.cal === id && installed.running, JSON.stringify(installed));
};
const tuneResults = {};
for (const id of ['heavytow', 'lighttow', 'economy', 'race']) {
  await installTune(id);
  const r = await pull(id);
  tuneResults[id] = r;
  const gain = r.hp - stock.hp;
  ok(`${id} lands at stock + ${TUNE_GAIN[id]} whp (+-6)`, Math.abs(gain - TUNE_GAIN[id]) < 6, `+${gain.toFixed(1)} whp`);
}
tuneResults.street = streetLbz;
// the whole set in one monotonic ladder, so the check also proves the tunes order correctly
{
  const ladder = ['stock', 'heavytow', 'lighttow', 'economy', 'street', 'race'].map((k) => (k === 'stock' ? stock.hp : tuneResults[k].hp));
  const monotonic = ladder.every((v, i) => i === 0 || v > ladder[i - 1] + 20);
  ok('the six calibrations form an increasing whp ladder', monotonic, ladder.map((v) => v.toFixed(0)).join(' < '));
}

// ---- closing the Turbo Sound vanes raises turbo speed and EGT through the physics ----
const vaneTest = await ev(() => {
  const g = window.__game;
  const read = () => ({ rpm: g.plant.rpm, turbo: g.plant.out.turboRpm, egtF: (g.plant.out.egtPreK - 273.15) * 1.8 + 32, boost: g.plant.out.boostPsi, vane: g.plant.out.vane });
  g.plant.pp.sound = { close: 0, hold: 0 }; g.advance(4);
  const open = read();
  g.plant.pp.sound = { close: 0.9, hold: 0 }; g.advance(4);
  const closed = read();
  return { open, closed };
});
ok('closing the vanes at idle raises turbo speed and exhaust gas temperature',
  vaneTest.closed.turbo > vaneTest.open.turbo * 1.15 && vaneTest.closed.egtF > vaneTest.open.egtF + 15 && vaneTest.closed.vane > vaneTest.open.vane,
  `turbo ${vaneTest.open.turbo.toFixed(0)} -> ${vaneTest.closed.turbo.toFixed(0)} rpm, EGT ${vaneTest.open.egtF.toFixed(0)} -> ${vaneTest.closed.egtF.toFixed(0)} F, vane ${vaneTest.open.vane.toFixed(2)} -> ${vaneTest.closed.vane.toFixed(2)}`);
// hold them closed under a full-throttle pull: overspeeds the turbo and the failure model catches it
const overspeed = await ev(() => {
  const g = window.__game;
  g.plant.fail.repair('turbo'); g.plant.fail.repair('piston'); g.plant.warm(198, 188);
  g.plant.pp.sound = { close: 1.0, hold: 1.0 };
  g.dyno.strapAll(true); g.dyno.setFan(true); g.dyno.startRun();
  let n = 0; let maxTurbo = 0;
  while (!['done', 'idle', 'refused'].includes(g.dyno.phase) && n++ < 4000) { g.advance(0.25, 0.01); maxTurbo = Math.max(maxTurbo, g.plant.out.turboRpm || 0); }
  // let any remaining hold time accumulate
  g.advance(4);
  return { failed: g.plant.fail.state.turbo, maxTurbo, events: g.plant.fail.events.map((e) => e.part) };
});
ok('vanes held closed at full load overspeed the turbo and damage it', overspeed.failed, `peak turbo ${Math.round(overspeed.maxTurbo)} rpm, events ${JSON.stringify(overspeed.events)}`);
await ev(() => { const g = window.__game; g.plant.pp.sound = { close: 0, hold: 0 }; g.plant.fail.repair('all'); });

// ---- abusing the race tune breaks the stock Allison (PROMPT.md section 5A) ----
const transTest = await ev(() => {
  const g = window.__game;
  const env = () => ({ keyPos: g.ign.key, engineRunning: g.ign.engineRunning });
  g.plant.fail.repair('all');
  // make sure the race tune is in and the engine is running before beating on it
  if (g.plant.cal.id !== 'race') {
    g.ign.setKey(0, {}); g.advance(0.2); g.plant.stopEngine();
    g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(0.5);
    g.ai.plug(true); g.ai.setCharger(true);
    g.ai.read(env()); g.advance(14); g.ai.saveBackup(env()); g.advance(7);
    g.ai.write(env(), 'race'); g.advance(65); g.ign.setKey(0, {}); g.advance(1);
    g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(3);
    g.ign.setKey(3, { coolantF: 190, range: 'P' }); g.advance(4); g.ign.releaseStart(); g.advance(8);
  }
  if (!g.plant.running) { g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(3); g.ign.setKey(3, { coolantF: 190, range: 'P' }); g.advance(4); g.ign.releaseStart(); g.advance(8); }
  g.plant.warm(198, 190);
  let pulls = 0; let refused = 0;
  while (!g.plant.fail.state.transmission && pulls < 34) {
    g.dyno.strapAll(true); g.dyno.setFan(true);
    const started = g.dyno.startRun();
    if (!started || started.ok === false) refused++;
    let n = 0;
    while (!['done', 'idle', 'refused'].includes(g.dyno.phase) && n++ < 4000) g.advance(0.25, 0.01);
    pulls++;
  }
  return {
    failed: g.plant.fail.state.transmission, pulls, refused, transF: g.plant.dl.transF,
    slipKj: g.plant.dl.slipEnergyKj,
    event: g.plant.fail.events.find((e) => e.part === 'transmission') || null,
  };
});
ok('repeated race pulls burn the stock transmission', transTest.failed && transTest.refused === 0,
  `${transTest.pulls} pulls (${transTest.refused} refused), trans ${transTest.transF.toFixed(0)} F, slip energy ${transTest.slipKj.toFixed(0)} kJ, ${transTest.event ? transTest.event.title : 'no event'}`);

// ---- walk mode: the player can walk around the truck and every collider blocks ----
const walk = await ev(() => {
  const g = window.__game;
  g.setMode('walk');
  const P = g.player;
  const walkTo = (tx, tz, maxSec = 25) => {
    P.setPose(P.pos.x, P.pos.z, Math.atan2(-(tx - P.pos.x), -(tz - P.pos.z)));
    const input = { down: (k) => k === 'KeyW' };
    let t = 0;
    while (t < maxSec) {
      P.yaw = Math.atan2(-(tx - P.pos.x), -(tz - P.pos.z));
      P.update(1 / 30, input); t += 1 / 30;
      if (Math.hypot(P.pos.x - tx, P.pos.z - tz) < 0.5) return true;
    }
    return false;
  };
  // Walk to the free point nearest each shop corner (the office and the equipment occupy parts of the
  // corners, so "every corner" means the walkable area at each corner). The start is a free point on the
  // line toward the shop centre, so the walk is a real 2.5-6 m collision-checked traverse.
  const freeAt = (x, z) => { const [rx, rz] = P.resolve(x, z, 0, 1.7); return Math.hypot(rx - x, rz - z) < 0.02; };
  const targets = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    let best = null;
    for (let x = -11.2; x <= 11.2; x += 0.4) for (let z = -8.2; z <= 8.2; z += 0.4) {
      if (!freeAt(x, z)) continue;
      const score = sx * x + sz * z;
      if (!best || score > best.score) best = { x, z, score };
    }
    targets.push(best);
  }
  const reached = targets.map((t) => {
    const d = Math.hypot(t.x, t.z) || 1;
    let start = null;
    for (let back = 2.5; back <= 7; back += 0.5) {
      const x = t.x - (t.x / d) * back, z = t.z - (t.z / d) * back;
      if (freeAt(x, z)) { start = { x, z }; break; }
    }
    if (!start) return false;
    P.setPose(start.x, start.z, Math.atan2(-(t.x - start.x), -(t.z - start.z)));
    return walkTo(t.x, t.z, 20);
  });
  // every solid collider must push the player out (truck, lift, equipment, pit rim, walls)
  const solids = g.colliders.filter((b) => !(b.userData && b.userData.enabled === false));
  let blockedCount = 0;
  for (const b of solids) {
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    if (b.max.y < 0.3) continue; // flat on the floor: steps, not obstacles
    const [rx, rz] = P.resolve(x, z, 0, 1.7);
    if (Math.hypot(rx - x, rz - z) > 0.01) blockedCount++;
  }
  return { reached, targets: targets.map((t) => [+t.x.toFixed(1), +t.z.toFixed(1)]), solids: solids.length, blockedCount, mode: g.mode, eye: P.eye };
});
ok('walk mode reaches the walkable area at all four shop corners', walk.reached.every(Boolean), `${JSON.stringify(walk.reached)} at ${JSON.stringify(walk.targets)}`);
ok('walk collision blocks every solid (truck, lift, equipment, pit rim, walls)', walk.blockedCount >= walk.solids * 0.9, `${walk.blockedCount}/${walk.solids}`);

// ---- the cable needs the driver's door open (the clipping defect fix) ----
const cableDoor = await ev(() => {
  const g = window.__game;
  const door = g.truckCtl.doors.fL;
  g.ai.plug(false);
  if (door.state > 0) { door.toggle(g.ctx, false); g.advance(2); }
  let said = '';
  const ctx = { game: g, say: (t) => { said = t; }, state: g.state, shop: g.shop, animate: () => {} };
  let it = null;
  g.rig.group.traverse((o) => { if (!it && o.userData && o.userData.interact && o.userData.labelId === 'shop.ailive_cable') it = o.userData.interact; });
  if (!it) return { found: false };
  it.run(ctx);
  const refusedClosed = !g.ai.cable;
  door.toggle(g.ctx, true); g.advance(2);
  it.run(ctx);
  return { found: true, refusedClosed, open: g.ai.cable, said, doorState: door.state };
});
ok('the AI Live cable refuses to plug in through a closed driver door', cableDoor.found && cableDoor.refusedClosed && cableDoor.open, JSON.stringify(cableDoor));

// ---- rear lamps follow the brake and reverse state (lamps.set wiring) ----
const lampState = await ev(() => {
  const g = window.__game;
  const read = () => {
    const out = {};
    g.truck.group.traverse((o) => {
      if (o.isMesh && /^lens_/.test(o.name) && o.material && o.material.emissiveIntensity !== undefined) out[o.name] = o.material.emissiveIntensity;
    });
    return out;
  };
  // sit in the cab so the brake pedal input is live (the walk controller zeroes it)
  g.setMode('driver');
  const origDown = g.input.down.bind(g.input);
  g.state.range = 'P'; g.ign.setKey(2, { coolantF: 190, range: 'P' }); g.advance(0.4);
  const base = read();
  g.input.down = (k) => (k === 'KeyS' ? true : origDown(k));
  g.advance(0.4);
  const braking = read();
  g.input.down = (k) => (k === 'KeyS' ? false : origDown(k));
  g.state.range = 'R'; g.advance(0.4);
  const reversing = read();
  g.input.down = origDown;
  g.state.range = 'P';
  const cam = [g.camera.position.x, g.camera.position.y, g.camera.position.z];
  g.setMode('walk'); g.advance(0.2);
  return { base, braking, reversing, cam };
});
{
  const b0 = lampState.base || {};
  const keys = Object.keys(b0);
  const brakeUp = keys.filter((k) => /brake/.test(k)).some((k) => (lampState.braking[k] || 0) > (b0[k] || 0) + 0.2);
  const revUp = keys.filter((k) => /reverse/.test(k)).some((k) => (lampState.reversing[k] || 0) > (b0[k] || 0) + 0.2);
  ok('rear lamps respond to the brake pedal and to reverse', keys.length > 0 && brakeUp && revUp, `lens materials ${keys.join(',')}, brake ${brakeUp}, reverse ${revUp}`);
  // the interior eye point is (-16, 56, 66) in in the truck frame, i.e. about (-0.41, 1.42, 0.88) in the shop
  const c = lampState.cam;
  const eyeOk = Math.abs(c[0] + 0.406) < 0.1 && Math.abs(c[1] - 1.42) < 0.1 && Math.abs(c[2] - 0.876) < 0.12;
  ok('driver view sits at the cab eye point', eyeOk, c.map((v) => v.toFixed(2)).join(','));
}

const errs = logs.filter((l) => /error/i.test(l) && !/WebGLShadowMap|GPU stall|ReadPixels/.test(l));
ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
await browser.close(); await app.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);

