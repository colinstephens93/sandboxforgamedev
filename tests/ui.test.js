import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Plant } from '../src/sim/plant.js';
import { Dyno } from '../src/sim/dyno.js';
import { Ignition, KEY } from '../src/sim/startSequence.js';
import { AILive, FLASH } from '../src/sim/flash.js';
import { loadCal } from '../src/sim/calibrations.js';
import { TUNE_ORDER, GAIN_WHP, TEMPLATES } from '../src/sim/calTemplates.js';
import {
  computeAxes, curvePoints, peakHpText, peakTqText, diffText, signed, thousands, findBaseline, drawDynoGraph, drawMultiChannel, runColor, RPM_MIN, RPM_MAX,
} from '../src/ui/dynoGraph.js';
import {
  tuneCard, allCards, regulatorNote, REG_LINE, gainText, procedureSteps, nextStep, writtenSound, soundDirty, logToCsv, LOG_CHANNELS, compareRows, TUNE_RISKS, PAGES, csvName,
} from '../src/ui/ailive.js';
import { dynoStatus, vehicleMph } from '../src/ui/dynoPanel.js';
import { applyRepair, resetTruck, REPAIR_PARTS, REGULATOR_STEPS } from '../src/ui/shopMenu.js';
import { AILIVE_LABELS, buildAILiveRig, cableRoute, leadRoute, RIG, screenModel, drawScreen } from '../src/shop/ailiveRig.js';

// a no-op 2D context that records nothing: lets the drawing code run end to end under node
function fakeCtx() {
  const store = {};
  return new Proxy(store, {
    get: (t, k) => {
      if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      return k in t ? t[k] : () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

function pull(tune = 'stock', regulator = 'LLY') {
  const plant = new Plant({ cal: loadCal(tune), regulator }); plant.setCalibration(loadCal(tune)); plant.startEngine(); plant.warm(198, 188);
  const dyno = new Dyno(plant); dyno.strapAll(true); dyno.setFan(true);
  return { plant, dyno, go() { dyno.startRun(); let n = 0; while (!['done', 'refused', 'idle'].includes(dyno.phase) && n++ < 100000) dyno.update(0.005); return dyno.last; } };
}
let STOCK, STREET;
const stockRun = () => (STOCK ||= pull('stock').go());
const streetRun = () => (STREET ||= pull('street', 'LBZ').go());

describe('dyno graph: axis scaling and data prep', () => {
  it('both axes share the grid and cover the peaks with headroom', () => {
    const ax = computeAxes([curvePoints(stockRun())]);
    expect(ax.hpMax).toBeGreaterThanOrEqual(stockRun().peakHp * 1.05);
    expect(ax.tqMax).toBeGreaterThanOrEqual(stockRun().peakTq * 1.05);
    expect(ax.hpMax).toBe(ax.hpStep * ax.divisions); expect(ax.tqMax).toBe(ax.tqStep * ax.divisions);
    expect(ax.divisions).toBeGreaterThanOrEqual(4); expect(ax.divisions).toBeLessThanOrEqual(8);
    expect(ax.rpmMin).toBe(1000); expect(ax.rpmMax).toBe(3500);
    // a big tune rescales both
    const big = computeAxes([curvePoints(stockRun()), curvePoints(streetRun())]);
    expect(big.hpMax).toBeGreaterThan(ax.hpMax); expect(big.hpMax).toBeGreaterThanOrEqual(streetRun().peakHp * 1.05);
    expect(big.tqMax).toBeGreaterThanOrEqual(streetRun().peakTq * 1.05);
  });
  it('nice step sizes, an empty graph still has a sensible default scale, and a live run keeps a floor', () => {
    const e = computeAxes([]); expect(e.hpMax).toBeGreaterThanOrEqual(250); expect([5, 10, 20, 25, 50, 100, 200, 250, 500]).toContain(e.hpStep);
    const f = computeAxes([[{ rpm: 1500, hp: 80, tq: 300 }]], { floorHp: 240, floorTq: 480 }); expect(f.hpMax).toBeGreaterThanOrEqual(240); expect(f.tqMax).toBeGreaterThanOrEqual(480);
  });
  it('turns a run into drawable curve points inside the rpm axis', () => {
    const pts = curvePoints(stockRun());
    expect(pts.length).toBeGreaterThan(30);
    expect(pts.every((p) => p.rpm >= RPM_MIN && p.rpm <= RPM_MAX && Number.isFinite(p.hp) && Number.isFinite(p.tq))).toBe(true);
    expect(pts.every((p, i) => i === 0 || p.rpm > pts[i - 1].rpm)).toBe(true);
    expect(curvePoints({ invalid: true, points: [] })).toEqual([]); expect(curvePoints(null)).toEqual([]);
    expect(curvePoints({ points: [{ rpm: 900, hp: 1, tq: 1 }, { rpm: 2000, hp: NaN, tq: 1 }, { rpm: 3600, hp: 1, tq: 1 }, { rpm: 2500, hp: 5, tq: 6 }] }).map((p) => p.rpm)).toEqual([2500]);
  });
  it('prints the peak labels and the difference line the way a dyno sheet does', () => {
    expect(peakHpText({ peakHp: 252.83, peakHpRpm: 3000 })).toBe('PEAK 252.8 whp @ 3,000 rpm');
    expect(peakTqText({ peakTq: 485.4, peakTqRpm: 1650 })).toBe('PEAK 485 lb-ft @ 1,650 rpm');
    expect(diffText({ peakHp: 428.2, peakTq: 831 }, { peakHp: 252.8, peakTq: 491 })).toBe('+175.4 whp, +340 lb-ft vs stock');
    expect(diffText({ peakHp: 200, peakTq: 400 }, { peakHp: 252.8, peakTq: 491 })).toBe('-52.8 whp, -91 lb-ft vs stock');
    expect(signed(0.04)).toBe('+0.0'); expect(thousands(1234567)).toBe('1,234,567');
  });
  it('the first valid stock run is the baseline', () => {
    const runs = [{ id: 1, tuneId: 'stock', invalid: true, points: [{}] }, { id: 2, tuneId: 'street', points: [{}] }, { id: 3, tuneId: 'stock', points: [{}] }, { id: 4, tuneId: 'stock', points: [{}] }];
    expect(findBaseline(runs).id).toBe(3); expect(findBaseline([runs[1]])).toBe(null);
    expect(runColor({ id: 1 })).not.toBe(runColor({ id: 2 }));
  });
  it('draws every state without throwing: empty, one run, comparison, live, no torque, tiny and large canvases', () => {
    const a = stockRun(), b = streetRun();
    for (const [W, H] of [[536, 292], [1024, 576], [320, 200], [1920, 1080]]) {
      drawDynoGraph(fakeCtx(), W, H, {});
      drawDynoGraph(fakeCtx(), W, H, { runs: [a] });
      drawDynoGraph(fakeCtx(), W, H, { runs: [a, b], baseline: a, selectedIds: [a.id, b.id] });
      drawDynoGraph(fakeCtx(), W, H, { runs: [a, b], selectedIds: new Set([b.id]), showTorque: false, current: { id: 3, tuneName: 'Race', points: curvePoints(b).slice(0, 20), peakHp: 100, peakHpRpm: 2000, peakTq: 300, peakTqRpm: 1800 } });
      drawDynoGraph(fakeCtx(), W, H, { runs: [{ id: 5, invalid: true, points: [] }], title: 'AI LIVE', status: 'x' });
    }
  });
  it('multi-channel chart returns the plot box and handles empty logs', () => {
    const rows = stockRun().log; const ch = LOG_CHANNELS.filter((c) => c.on);
    const dims = drawMultiChannel(fakeCtx(), 640, 360, { rows, channels: ch, cursor: 10 });
    expect(dims.pr).toBeGreaterThan(dims.pl); expect(dims.t1).toBeGreaterThan(dims.t0);
    expect(drawMultiChannel(fakeCtx(), 640, 360, { rows: [], channels: ch })).toBe(null);
  });
});

describe('AI Live: quick tune cards', () => {
  it('has six cards in the spec order with the owner\'s gains in rear-wheel horsepower', () => {
    expect(allCards('LLY').map((c) => c.id)).toEqual(['stock', 'heavytow', 'lighttow', 'economy', 'street', 'race']);
    expect(GAIN_WHP).toEqual({ heavytow: 30, lighttow: 60, economy: 120, street: 175, race: 230 });
    expect(['heavytow', 'lighttow', 'economy', 'street', 'race'].map(gainText)).toEqual(['+30 whp', '+60 whp', '+120 whp', '+175 whp', '+230 whp']);
    for (const id of TUNE_ORDER) {
      const c = tuneCard(id, 'LLY');
      expect(c.name).toBe(TEMPLATES[id].name); expect(c.desc).toBe(TEMPLATES[id].desc); expect(c.position).toBe(TEMPLATES[id].position || 0);
      expect(c.risks.length).toBeGreaterThan(0); expect(c.risks.every(([k, t]) => k && t.length > 20)).toBe(true);
    }
    expect(tuneCard('stock').gainWhp).toBe(0); expect(tuneCard('race').gainWhp).toBe(230);
    expect(tuneCard('street').gainSub).toMatch(/rear-wheel/);
  });
  it('risks mention what a diesel tuner worries about on the high tunes', () => {
    const cats = (id) => TUNE_RISKS[id].map((r) => r[0]);
    for (const id of ['street', 'race']) { for (const k of ['EGT', 'Smoke', 'Allison', 'Rail', 'Head gaskets']) expect(cats(id)).toContain(k); }
    expect(cats('economy')).toContain('Rail');
  });
  it('warns that Street and Race are written for the LBZ regulator while the LLY regulator is fitted', () => {
    for (const id of ['street', 'race']) { const n = regulatorNote(id, 'LLY'); expect(n.level).toBe('warn'); expect(n.text).toBe(REG_LINE); expect(REG_LINE).toMatch(/LBZ fuel pressure regulator.*LLY regulator/); }
    expect(regulatorNote('economy', 'LLY').level).toBe('soft');
    for (const id of ['stock', 'heavytow', 'lighttow']) expect(regulatorNote(id, 'LLY')).toBe(null);
    for (const id of ['heavytow', 'economy', 'street', 'race']) expect(regulatorNote(id, 'LBZ').level).toBe('ok');
    expect(regulatorNote('stock', 'LBZ')).toBe(null);
  });
  it('has the six pages from the spec', () => { expect(PAGES.map((p) => p[1])).toEqual(['CONNECT', 'TRUCK', 'QUICK TUNES', 'TURBO SOUND', 'DATALOG', 'COMPARE']); });
});

describe('AI Live: procedure checklist and guidance', () => {
  const RUN = { keyPos: 2, engineRunning: false };
  it('lists the steps in the order a shop does them and marks the current one', () => {
    const ai = new AILive();
    let s = procedureSteps(ai, { keyPos: 0, engineRunning: false });
    expect(s.map((x) => x.id)).toEqual(['charger', 'cable', 'key', 'read', 'backup', 'choose', 'write', 'cycle']);
    expect(s.find((x) => x.state === 'now').id).toBe('cable'); expect(s[0].state).toBe('advice');
    ai.plug(true); ai.setCharger(true); s = procedureSteps(ai, { keyPos: 0, engineRunning: false });
    expect(s[0].state).toBe('done'); expect(s.find((x) => x.state === 'now').id).toBe('key');
    s = procedureSteps(ai, RUN); expect(s.find((x) => x.state === 'now').id).toBe('read');
    ai.read(RUN); for (let t = 0; t < FLASH.readSeconds + 1; t += 0.1) ai.update(0.1, RUN);
    s = procedureSteps(ai, RUN); expect(s.find((x) => x.state === 'now').id).toBe('backup');
    ai.saveBackup(RUN); for (let t = 0; t < FLASH.backupSeconds + 1; t += 0.1) ai.update(0.1, RUN);
    expect(procedureSteps(ai, RUN).find((x) => x.state === 'now').id).toBe('choose');
    ai.write(RUN, 'street'); for (let t = 0; t < FLASH.writeSeconds + 1; t += 0.1) ai.update(0.1, RUN);
    s = procedureSteps(ai, RUN); expect(s.find((x) => x.state === 'now').id).toBe('cycle');
    expect(nextStep(ai, RUN).text).toMatch(/Turn the key off/);
  });
  it('says what to do about a failed write', () => {
    const ai = new AILive(); ai.plug(true); ai.fail('the key was turned off during the write.');
    expect(nextStep(ai, RUN).text).toMatch(/Recovery/); expect(nextStep(ai, { keyPos: 0, engineRunning: false }).text).toMatch(/key to RUN/i);
    expect(nextStep(new AILive(), RUN).text).toMatch(/Plug/);
  });
  it('tracks unwritten Turbo Sound changes against what was written', () => {
    const ai = new AILive(); expect(soundDirty(ai)).toBe(false);
    ai.setSound(0.5, 0.1); expect(soundDirty(ai)).toBe(true);
    ai.pendingApply = { tune: 'stock', sound: { close: 0.5, hold: 0.1 } }; expect(soundDirty(ai)).toBe(false); expect(writtenSound(ai).close).toBe(0.5);
    ai.pendingApply = null; ai.installed = 'street'; ai.soundByTune.street = { close: 0.3, hold: 0 }; expect(soundDirty(ai)).toBe(true);
    ai.resetSound('street'); expect(soundDirty(ai)).toBe(false);
  });
});

describe('AI Live: datalog CSV and comparison table', () => {
  it('exports every channel of every row', () => {
    const run = stockRun(); const csv = logToCsv(run); const lines = csv.trim().split('\n');
    expect(lines.length).toBe(run.log.length + 1);
    const cols = lines[0].split(','); expect(cols.length).toBe(LOG_CHANNELS.length + 1); expect(cols[0]).toBe('time_s');
    expect(lines.every((l) => l.split(',').length === cols.length)).toBe(true);
    for (const k of ['rpm', 'qty', 'railPsi', 'boostPsi', 'airLbMin', 'soiDeg', 'egtF', 'coolantF', 'transF', 'slipRpm', 'vanePct', 'turboKrpm', 'driveKpa', 'lambda']) expect(cols.some((c) => c.startsWith(k))).toBe(true);
    const i = cols.findIndex((c) => c.startsWith('rpm')); expect(+lines[5].split(',')[i]).toBe(run.log[4].rpm);
    expect(logToCsv({ log: [] })).toBe(cols.join(',') + '\n'); expect(csvName(run)).toBe('ai-live-run1-stock.csv');
  });
  it('compares each run against the stock baseline', () => {
    const rows = compareRows([stockRun(), { ...streetRun(), id: 2 }]);
    expect(rows[0].isBase).toBe(true); expect(rows[0].dHp).toBe(null);
    expect(rows[1].dHp).toBeCloseTo(streetRun().peakHp - stockRun().peakHp, 6); expect(rows[1].dHp).toBeGreaterThan(150);
    expect(rows[1].regulator).toBe('LBZ'); expect(rows[1].vane).toEqual({ close: 0, hold: 0 });
  });
});

describe('dyno panel logic', () => {
  it('explains refusals and readiness in plain language', () => {
    const p = new Plant({ cal: loadCal('stock') }); const d = new Dyno(p);
    expect(dynoStatus(d).text).toMatch(/straps/i);
    d.strapAll(true); d.setFan(true); expect(dynoStatus(d).text).toMatch(/not running/i);
    p.startEngine(); expect(dynoStatus(d).kind).toBe('ready');
    d.straps[2] = false; d.startRun(); expect(dynoStatus(d)).toEqual({ kind: 'refused', text: expect.stringMatching(/Tie-down straps are not attached/) });
    d.strapAll(true); expect(dynoStatus(d).kind).toBe('ready');
    d.startRun(); expect(dynoStatus(d).kind).toBe('run');
  });
  it('vehicle speed is roller speed times the rolling radius', () => {
    const p = new Plant({ cal: loadCal('stock') }); p.dl.wr = 40; // rad/s at the roller
    expect(vehicleMph(p)).toBeCloseTo(p.dl.wheelSpeed() * 0.3749 * 2.23694, 1);
    p.dl.wr = 0; expect(vehicleMph(p)).toBe(0);
  });
});

describe('shop menu logic', () => {
  it('describes the four breakable parts', () => { expect(Object.keys(REPAIR_PARTS)).toEqual(['transmission', 'headGasket', 'turbo', 'piston']); expect(REGULATOR_STEPS.length).toBe(4); });
  it('repairing the transmission clears the failure, slip energy, health and fluid temperature', () => {
    const p = new Plant({ cal: loadCal('stock') });
    p.fail.state.transmission = true; p.fail.acc.slipKj = 400; p.dl.slipEnergyKj = 400; p.dl.health = 0; p.dl.transF = 300;
    applyRepair(p, 'transmission');
    expect(p.fail.state.transmission).toBe(false); expect(p.fail.acc.slipKj).toBe(0); expect(p.dl.slipEnergyKj).toBe(0); expect(p.dl.health).toBe(1); expect(p.dl.transF).toBeLessThan(200);
    p.fail.state.turbo = true; p.fail.acc.overspeed = 5; applyRepair(p, 'turbo'); expect(p.fail.state.turbo).toBe(false); expect(p.fail.acc.overspeed).toBe(0);
  });
  it('Reset truck returns the delivered truck: stock tune, LLY regulator, repaired, cold, nothing flashed', () => {
    const plant = new Plant({ cal: loadCal('street'), regulator: 'LBZ' }); plant.setCalibration(loadCal('street')); plant.startEngine(); plant.warm(220, 240);
    plant.fail.state.piston = true; plant.fail.events.push({ part: 'piston', title: 'x', why: 'y' }); plant.pp.sound = { close: 0.7, hold: 0.2 };
    const game = { plant, dyno: new Dyno(plant), ign: new Ignition(), ai: new AILive(), ui: { say() {} }, uiPanels: null };
    game.ign.setKey(KEY.RUN); game.ai.installed = 'street'; game.ai.backup = true; game.dyno.runs.push({ id: 1 });
    resetTruck(game);
    expect(plant.cal.id).toBe('stock'); expect(plant.pp.regulator).toBe('LLY'); expect(plant.fail.state.piston).toBe(false); expect(plant.fail.events.length).toBe(0);
    expect(plant.running).toBe(false); expect(plant.coolantF).toBeCloseTo(75.2, 0); expect(plant.pp.sound).toEqual({ close: 0, hold: 0 });
    expect(game.ai.installed).toBe('stock'); expect(game.ai.backup).toBe(false); expect(game.dyno.runs.length).toBe(0); expect(game.ign.key).toBe(KEY.LOCK);
  });
  it('a blocked ignition (failed write) refuses to crank', () => {
    const ig = new Ignition(); ig.setKey(KEY.RUN); ig.blocked = 'The ECM is not responding'; ig.setKey(KEY.START);
    expect(ig.cranking).toBe(false); expect(ig.key).toBe(KEY.RUN); expect(ig.message).toMatch(/ECM/);
    ig.blocked = null; ig.setKey(KEY.START); expect(ig.cranking).toBe(true);
  });
});

describe('AI Live rig (cart, laptop, cable, charger)', () => {
  const fakeGame = (over = {}) => {
    const ai = new AILive(); const calls = [];
    return { ai, ign: { key: 0, engineRunning: false }, state: {}, openPanel: (n) => calls.push(n), calls, ...over };
  };
  it('defines labels for every inspectable part', () => {
    for (const id of ['shop.ailive_laptop', 'shop.ailive_cable', 'shop.battery_charger', 'shop.laptop_cart']) { expect(AILIVE_LABELS[id].name.length).toBeGreaterThan(5); expect(AILIVE_LABELS[id].desc.length).toBeGreaterThan(30); }
    expect(Object.keys(AILIVE_LABELS).length).toBe(4);
  });
  it('builds in node and every labelled object has a label entry; the three usable parts have an interaction', () => {
    const game = fakeGame(); const rig = buildAILiveRig({ quality: { tex: 512, aniso: 2 }, game });
    const ids = new Set(); rig.group.traverse((o) => { if (o.userData.labelId) ids.add(o.userData.labelId); });
    expect([...ids].sort()).toEqual(Object.keys(AILIVE_LABELS).sort());
    for (const id of ids) expect(AILIVE_LABELS[id]).toBeTruthy();
    expect(rig.interactables.length).toBeGreaterThanOrEqual(3);
    for (const o of rig.interactables) { expect(typeof o.userData.interact.run).toBe('function'); const pr = o.userData.interact.prompt; expect(typeof (typeof pr === 'function' ? pr() : pr)).toBe('string'); }
    expect(rig.colliders.length).toBeGreaterThanOrEqual(2); expect(rig.colliders.every((b) => b.isBox3)).toBe(true);
  });
  it('the interactions drive AI Live: open the panel, plug and unplug the cable, connect and remove the charger', () => {
    const game = fakeGame(); const rig = buildAILiveRig({ quality: { tex: 512 }, game }); const say = []; const ctx = { game, say: (t) => say.push(t) };
    const by = (label, n = 0) => rig.interactables.filter((o) => o.userData.labelId === label)[n];
    by('shop.ailive_laptop').userData.interact.run(ctx); expect(game.calls).toEqual(['ailive']);
    const cab = rig.interactables.find((o) => o.userData.labelId === 'shop.ailive_cable');
    cab.userData.interact.run(ctx); expect(game.ai.cable).toBe(true); expect(cab.userData.interact.prompt()).toMatch(/Unplug/);
    cab.userData.interact.run(ctx); expect(game.ai.cable).toBe(false);
    const chg = rig.interactables.find((o) => o.userData.labelId === 'shop.battery_charger');
    chg.userData.interact.run(ctx); expect(game.ai.charger).toBe(true); chg.userData.interact.run(ctx); expect(game.ai.charger).toBe(false); expect(say.length).toBe(4);
  });
  it('the dongle plugs into the OBD-II port when the cable is connected and rests on the cart otherwise', () => {
    const game = fakeGame(); const rig = buildAILiveRig({ quality: { tex: 512 }, game });
    expect(rig.anchors.obdPort.toArray()).toEqual([-0.46, 0.86, 0.37]);
    const dongle = rig.anchors.dongle; const cartTop = RIG.cart.topY;
    const rest = dongle.position.clone(); expect(Math.abs(rest.x - RIG.cart.x)).toBeLessThan(0.6); expect(rest.y).toBeGreaterThan(cartTop); expect(rest.y).toBeLessThan(cartTop + 0.1);
    game.ai.plug(true); rig.update(0.016);
    const near = dongle.position.distanceTo(rig.anchors.obdPort); expect(near).toBeLessThan(0.08);
    rig.setObdPort(new THREE.Vector3(-0.5, 0.9, 0.5)); expect(dongle.position.distanceTo(new THREE.Vector3(-0.5, 0.9, 0.5))).toBeLessThan(0.08);
    game.ai.plug(false); rig.update(0.016); expect(dongle.position.distanceTo(rest)).toBeLessThan(1e-6);
  });
  it('the charger leads run to the battery terminals when connected and rest on the charger otherwise', () => {
    const game = fakeGame(); const rig = buildAILiveRig({ quality: { tex: 512 }, game });
    expect(rig.anchors.batteryPlus.toArray()).toEqual([-0.61, 1.168, -1.105]); expect(rig.anchors.batteryMinus.x).toBeCloseTo(0.61);
    const lead = rig.group.children.find((c) => c.isMesh && c.userData.labelId === 'shop.battery_charger' && c.material.color && c.material.color.r > 0.5);
    expect(lead).toBeTruthy();
    const far = (g) => { g.computeBoundingBox(); return g.boundingBox.clone(); };
    const bbRest = far(lead.geometry); expect(bbRest.min.x).toBeGreaterThan(-2.4); expect(bbRest.max.x).toBeLessThan(-1.2);
    game.ai.setCharger(true); rig.update(0.016);
    const bbOn = far(lead.geometry); expect(bbOn.max.x).toBeGreaterThan(-0.75); // reaches the driver-side battery post
    rig.setBatteryPorts([-0.7, 1.2, -1.0], [0.7, 1.2, -1.0]); expect(far(lead.geometry).max.y).toBeGreaterThan(1.1);
  });
  it('the cable route is continuous, stays off the floor, and hangs below the port', () => {
    const start = new THREE.Vector3(-3.4, 0.88, 1.0); const port = new THREE.Vector3(...RIG.obdPort);
    const pts = cableRoute({ start, port, plugged: true });
    expect(pts[0].distanceTo(start)).toBe(0); expect(pts.at(-1).y).toBeLessThan(port.y); expect(pts.at(-1).distanceTo(port)).toBeLessThan(0.2);
    expect(pts.every((p) => p.y >= 0.005)).toBe(true); expect(pts.some((p) => p.y < 0.03)).toBe(true); // it lies on the floor in between
    for (let i = 1; i < pts.length; i++) expect(pts[i].distanceTo(pts[i - 1])).toBeLessThan(0.9);
    const loop = cableRoute({ start, plugged: false, rest: new THREE.Vector3(-3.3, 0.88, 1.15) }); expect(loop.length).toBeGreaterThanOrEqual(4);
    const lead = leadRoute({ from: new THREE.Vector3(-1.9, 0.8, -1.1), to: new THREE.Vector3(-0.6, 1.17, -1.1), clamped: true, rest: new THREE.Vector3(-2, 0.6, -1) });
    expect(lead.at(-1).x).toBeCloseTo(-0.6);
  });
  it('the laptop screen shows the write progress, countdown and warning, and draws without a DOM', () => {
    const ai = new AILive(); ai.plug(true); ai.stage = 'writing'; ai.writing = 'street'; ai.progress = 0.5;
    const m = screenModel(ai, { keyPos: 2, engineRunning: false }, 'truck');
    expect(m.page).toBe('TRUCK'); expect(m.stage).toBe('writing'); expect(m.remaining).toBeCloseTo(FLASH.writeSeconds * 0.5);
    drawScreen(fakeCtx(), 1024, 640, m);
    for (const stage of ['idle', 'reading', 'backing', 'writeDone', 'failed']) { const a = new AILive(); a.stage = stage; a.bricked = stage === 'failed'; a.needsKeyCycle = stage === 'writeDone'; drawScreen(fakeCtx(), 512, 320, screenModel(a, { keyPos: 0, engineRunning: false }, 'connect')); }
  });
});
