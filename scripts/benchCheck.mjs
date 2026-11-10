// Scripted check of the bench page (index.html) in headless Chromium, driven through its own controls and panels.
//   node scripts/benchCheck.mjs          (GPU=1 uses the real graphics card; software rendering works but is slow)
// Buttons, sliders and panel controls are clicked in the page; time is advanced with bench.advance() so the run does
// not depend on how fast frames are drawn.
import { startApp, openPage } from './lib/browser.mjs';

const app = await startApp();
const logs = [];
const { browser, page } = await openPage({ url: app.url, quality: 'bench', logs, width: 1366, height: 768 });
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const adv = (sec, dt) => ev(([s, d]) => window.__bench.advance(s, d), [sec, dt || 1 / 30]);
const loaded = await page.waitForFunction(() => window.__bench && window.__bench.controlsUi && window.__bench.frames > 2, null, { timeout: 600000 }).then(() => true).catch(() => false);
ok('index.html is the bench and it loads', loaded && await ev(() => document.body.classList.contains('bench') && !!document.querySelector('#controls button') && !window.__game), await page.title());
if (!loaded) { console.log(logs.join('\n')); await browser.close(); await app.close(); process.exit(1); }

// ---- the host the panels see ----
const fields = await ev(() => import('/src/bench/bench.js').then((m) => m.PANEL_FIELDS.filter((k) => window.__bench[k] == null)));
ok('the bench exposes every field the panels read', fields.length === 0, `missing: ${fields.join(',') || 'none'}`);
ok('default quality is the bench preset, default view is the engine with the hood up', await ev(() => { const b = window.__bench; return b.qname === 'bench' && b.R.qualityName === 'bench' && b.view === 'engine' && b.ctl.hood.open; }));
const trans = await ev(() => window.__bench.materials().filter((m) => m.transmission > 0).length);
const matCount = await ev(() => window.__bench.materials().length);
ok('no material in the bench scene is transmissive', trans === 0 && matCount > 20, `${matCount} materials, ${trans} transmissive`);
ok('nothing of the shop is in the scene', await ev(() => { let n = 0; window.__bench.scene.traverse((o) => { if (/^(shop|dyno_|pit_|equipment)/.test(o.name)) n++; }); return n === 0 && window.__bench.scene.children.length < 8; }));

// ---- idle skip: engine off, nothing moving: frames stop being drawn while the loop keeps running ----
const idle = await page.waitForFunction(() => window.__bench.idle === true, null, { timeout: 600000 }).then(() => true).catch(() => false);
const before = await ev(() => ({ r: window.__bench.rendered, f: window.__bench.frames }));
await page.waitForFunction((f) => window.__bench.frames > f + 20, before.f, { timeout: 120000 }).catch(() => {});
const after = await ev(() => ({ r: window.__bench.rendered, f: window.__bench.frames, sh: window.__bench.R.renderer.shadowMap.needsUpdate }));
ok('idle: with the engine off and nothing moving no frame is drawn', idle && after.r === before.r && after.f > before.f + 20, `loop ran ${after.f - before.f} times, drew ${after.r - before.r}`);
ok('idle: the shadow map is not being refreshed', after.sh === false);
// an orbit drag wakes it
await page.mouse.move(500, 300); await page.mouse.down(); await page.mouse.move(540, 310, { steps: 4 }); await page.mouse.up();
ok('moving the camera draws again', await page.waitForFunction((r) => window.__bench.rendered > r, after.r, { timeout: 120000 }).then(() => true).catch(() => false));
await ev(() => { const b = window.__bench; b.paused = true; b.setView('engine', true); }); // from here the script owns the clock

// ---- key control: Off -> Run -> hold Start ----
await page.click('#controls button:has-text("Run")'); await adv(0.5);
ok('key Run: gauges on and the Wait to Start lamp lit (also in the control bar)', await ev(() => { const b = window.__bench; return b.ign.key === 2 && b.ign.gaugesOn && b.ign.wtsOn && document.querySelector('.bc-lamp').classList.contains('lit') && !b.plant.running; }));
await adv(4);
ok('Wait to Start goes out', await ev(() => !window.__bench.ign.wtsOn && !document.querySelector('.bc-lamp').classList.contains('lit')));
await page.dispatchEvent('.bc-start', 'pointerdown'); await adv(0.3);
ok('holding Start cranks the engine', await ev(() => window.__bench.ign.cranking && window.__bench.ign.key === 3));
await adv(4); await page.dispatchEvent('.bc-start', 'pointerup'); await adv(12);
const idleRpm = await ev(() => ({ run: window.__bench.plant.running, rpm: window.__bench.plant.rpm, key: window.__bench.ign.key, shown: document.querySelector('.bc-rpm').textContent }));
ok('the engine starts with the key control and idles near 680 rpm', idleRpm.run && Math.abs(idleRpm.rpm - 680) < 40 && idleRpm.key === 2, `rpm ${idleRpm.rpm.toFixed(0)}, bar shows ${idleRpm.shown}`);
ok('a running engine is drawn every frame and refreshes the shadows', await ev(() => { const b = window.__bench; b.dirty = false; b.cameraMoved(); b.R.renderer.shadowMap.needsUpdate = false; b.tick(1 / 60); return b.needsRender() && b.R.renderer.shadowMap.needsUpdate === true; }));
ok('the engine bay is animated from the plant (fan turning)', await ev(() => { const b = window.__bench, f = b.truck.parts.engineBay.parts.fanSpin; const a = f.rotation.z; b.advance(0.5); return f.rotation.z !== a; }));

// ---- throttle slider and gear selector ----
await page.locator('#controls input[type=range]').fill('45'); await adv(3);
const rev = await ev(() => ({ pedal: window.__bench.pedal, rpm: window.__bench.plant.rpm }));
ok('the throttle slider is the pedal: the engine revs', Math.abs(rev.pedal - 0.45) < 1e-6 && rev.rpm > 1200, `pedal ${rev.pedal}, rpm ${rev.rpm.toFixed(0)}`);
await page.locator('#controls input[type=range]').fill('0'); await adv(3);
await page.click('.bc-group button:text-is("D")'); await adv(3);
const drive = await ev(() => { const b = window.__bench; return { range: b.state.range, ws: b.plant.dl.wheelSpeed(), angle: b.wheelAngle }; });
ok('gear selector D: the rear wheels turn from the driveline', drive.range === 'D' && drive.ws > 0.5 && drive.angle < -0.5, JSON.stringify(drive));
await page.click('.bc-group button:text-is("P")'); await adv(1);
ok('gear selector back to P', await ev(() => window.__bench.state.range === 'P'));

// ---- dyno panel (key T): refusal, straps, fan, a stock pull ----
await page.keyboard.press('KeyT'); await adv(0.3);
const dock = await ev(() => { const b = window.__bench, p = document.querySelector('.panel.dx').getBoundingClientRect(), c = b.canvas.getBoundingClientRect(); return { open: b.panelOpen, panelLeft: p.left, canvasRight: c.right, w: innerWidth, bufW: b.canvas.width }; });
ok('T opens the dyno panel docked beside the truck (the view keeps its own area)', dock.open === 'dyno' && dock.canvasRight <= dock.panelLeft + 1 && dock.canvasRight > 380 && Math.abs(dock.bufW - dock.canvasRight) < 2, JSON.stringify(dock));
await ev(() => { window.__bench.plant.warm(198, 188); }); // a warm truck, as scripts/check.mjs does before a pull
await page.click('.dx-start'); await adv(0.3);
ok('dyno run refused without straps', await ev(() => window.__bench.dyno.phase === 'refused' && /strap/i.test(document.querySelector('.dx-status').textContent)), await ev(() => document.querySelector('.dx-status').textContent));
await page.click('.dx-strapall'); await page.click('.dx-fan'); await adv(0.3);
ok('strap all and fan on from the panel', await ev(() => window.__bench.dyno.straps.every(Boolean) && window.__bench.dyno.fan));
const pull = async () => {
  await page.click('.dx-start'); await adv(0.5);
  const started = await ev(() => ({ on: window.__bench.dynoRunning, pedalOff: document.querySelector('#controls input[type=range]').disabled }));
  await ev(() => { const b = window.__bench; let n = 0; while (b.dynoRunning && n++ < 4000) b.advance(0.25, 0.01); b.advance(0.5); });
  const r = await ev(() => { const r = window.__bench.dyno.last; return r ? { hp: r.peakHp, tq: r.peakTq, id: r.id, points: r.points.length, invalid: !!r.invalid, tune: r.tuneId, reg: r.regulator } : null; });
  return { started, r };
};
const stock = await pull();
ok('the throttle slider is disabled during a dyno run', stock.started.on && stock.started.pedalOff);
ok('stock pull completes near 252 whp', stock.r && !stock.r.invalid && stock.r.hp > 230 && stock.r.hp < 265 && stock.r.points > 40, JSON.stringify(stock.r));
const graph = await ev(() => {
  const c = document.querySelector('.dx-graph'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 90 && d[i + 1] < 190 && d[i + 2] < 120) lit++; // the run's orange curve
  return { w: c.width, h: c.height, lit, peaks: document.querySelector('.dx-peaks').textContent, hist: document.querySelectorAll('.dx-run').length };
});
ok('the dyno panel shows a graph and the peaks', graph.w > 300 && graph.lit > 200 && /whp/i.test(graph.peaks) && graph.hist === 1, `${graph.w}x${graph.h}, ${graph.lit} curve pixels, "${graph.peaks.replace(/\s+/g, ' ').slice(0, 90)}"`);

// ---- shop menu (key M): fit the LBZ regulator the tunes were written for (engine off) ----
await page.click('#controls button:has-text("Off")'); await adv(2);
ok('key Off stops the engine', await ev(() => !window.__bench.plant.running && window.__bench.ign.key === 0));
await page.keyboard.press('KeyM'); await adv(0.3);
await page.click('.sm-tabs button[data-tab="parts"]'); await page.click('.sm .inst'); await adv(10);
ok('M opens the shop menu and the LBZ regulator is installed there', await ev(() => window.__bench.panelOpen === 'shop' && window.__bench.plant.pp.regulator === 'LBZ'));

// ---- AI Live (key L): plug, charger, read, backup, write Street, cycle the key ----
await page.keyboard.press('KeyL'); await adv(0.3);
ok('L opens AI Live docked and closes the other panel', await ev(() => { const b = window.__bench; const r = document.querySelector('.panel.al').getBoundingClientRect(); return b.panelOpen === 'ailive' && document.querySelector('.panel.sm').style.display === 'none' && b.canvas.getBoundingClientRect().right <= r.left + 1; }));
await page.click('#controls button:has-text("Run")'); await adv(1);
await page.click('.al .plug'); await page.click('.al .chg'); await adv(0.5);
ok('interface plugged in and charger connected from the app', await ev(() => window.__bench.ai.cable && window.__bench.ai.charger));
await page.click('.al-navbtn:has-text("TRUCK")'); await adv(0.3);
ok('a write is not offered before the read and the backup', await ev(() => document.querySelector('.al-act[data-a="write"] .go').disabled));
await page.click('.al-act[data-a="read"] .go'); await adv(14);
ok('read completes', await ev(() => window.__bench.ai.stage === 'readDone' && window.__bench.ai.readTune === 'stock'), await ev(() => window.__bench.ai.message));
await page.click('.al-act[data-a="backup"] .go'); await adv(8);
ok('backup saved', await ev(() => window.__bench.ai.backup === true));
await page.selectOption('.al-act[data-a="write"] select', 'street'); await adv(0.3);
await page.click('.al-act[data-a="write"] .go'); await adv(5);
ok('the write runs with the engine off and no frame is drawn for it once the gauges settle', await ev(() => { const b = window.__bench; b.advance(6); b.dirty = false; b.cameraMoved(); b.tick(1 / 60); return b.ai.stage === 'writing' && !b.needsRender(); }));
await adv(62);
ok('write of the street tune completes', await ev(() => window.__bench.ai.stage === 'writeDone' && window.__bench.ai.needsKeyCycle), await ev(() => window.__bench.ai.message));
await page.click('#controls button:has-text("Off")'); await adv(1.5);
ok('cycling the key loads the Street calibration', await ev(() => window.__bench.plant.cal.id === 'street' && window.__bench.ai.installed === 'street' && !window.__bench.ai.bricked));
await page.click('#controls button:has-text("Run")'); await adv(4);
await page.dispatchEvent('.bc-start', 'pointerdown'); await adv(4); await page.dispatchEvent('.bc-start', 'pointerup'); await adv(10);
ok('the truck starts again on the new tune', await ev(() => window.__bench.plant.running));
await ev(() => window.__bench.plant.warm(198, 188));
await page.keyboard.press('KeyT'); await adv(0.3);
const street = await pull();
const gain = street.r && stock.r ? street.r.hp - stock.r.hp : NaN;
ok('the second pull shows the Street gain (stock + 175 whp with the LBZ regulator)', street.r && street.r.tune === 'street' && street.r.reg === 'LBZ' && Math.abs(gain - 175) < 6, `stock ${stock.r.hp.toFixed(1)}, street ${street.r ? street.r.hp.toFixed(1) : '-'}, gain ${gain.toFixed(1)} whp`);
ok('both runs are in the history', await ev(() => document.querySelectorAll('.dx-run').length === 2));
await page.keyboard.press('Escape'); await adv(0.3);
ok('Esc closes the panel and the view takes the whole window again', await ev(() => { const b = window.__bench; return !b.panelOpen && Math.abs(b.canvas.getBoundingClientRect().right - innerWidth) < 1 && b.canvas.width === innerWidth; }));

// ---- views and the parts each one shows ----
const viewState = async (label, key) => {
  if (label) await page.click(`#controls button:has-text("${label}")`); else await page.keyboard.press(key);
  await adv(3);
  return ev(() => { const b = window.__bench; const p = {}; for (const [k, v] of Object.entries(b.parts)) p[k] = v.visible; return { view: b.view, p, hood: b.ctl.hood.open, cut: b.core.cutaway, inCab: b.listener().inCab, floor: b.floor.visible, running: b.plant.running }; });
};
let v = await viewState('Gauges');
ok('gauges view: driver eye point, engine, bay, hood underside, underside and wheels hidden', v.view === 'gauges' && !v.p.engine && !v.p.bay && !v.p.hoodUnder && !v.p.underside && !v.p.wheels && v.p.interior && v.p.exterior && v.inCab, JSON.stringify(v.p));
const eye = await ev(() => { const b = window.__bench, e = b.truck.anchors.interior.eye.getWorldPosition(b.camera.position.clone()); return b.camera.position.distanceTo(e); });
ok('gauges view sits at the driver eye point', eye < 0.02, `${eye.toFixed(3)} m`);
v = await viewState('Engine alone');
ok('engine alone: only the engine, no floor', v.view === 'engineAlone' && v.p.engine && Object.entries(v.p).every(([k, on]) => on === (k === 'engine')) && !v.floor);
v = await viewState('Cutaway');
ok('cutaway: castings faded, interior and underside hidden, engine running', v.view === 'cutaway' && v.cut && v.p.engine && !v.p.interior && !v.p.underside && v.running);
v = await viewState('Truck');
ok('truck view: everything shown, hood down, cutaway off', v.view === 'truck' && Object.values(v.p).every(Boolean) && !v.hood && !v.cut && !v.inCab && v.floor);
v = await viewState('Rear wheels');
ok('rear wheels view', v.view === 'rearWheels' && v.p.wheels && v.p.exterior);
v = await viewState(null, 'Digit1');
ok('engine view (key 1): hood open, interior and underside hidden', v.view === 'engine' && v.hood && v.p.engine && v.p.bay && !v.p.interior && !v.p.underside, JSON.stringify(v.p));

// ---- quality select, sound, listener ----
await page.selectOption('#controls select', 'low'); await adv(0.2);
ok('quality select: low', await ev(() => { const b = window.__bench; return b.qname === 'low' && b.R.qualityName === 'low' && b.key.shadow.mapSize.x === 1024 && b.autoQuality === false; }));
await page.selectOption('#controls select', 'high'); await adv(0.2);
ok('quality select: high (shadow map follows)', await ev(() => { const b = window.__bench; return b.R.qualityName === 'high' && b.key.shadow.mapSize.x === 2048 && !!b.R.aoEffect; }));
await page.selectOption('#controls select', 'bench'); await adv(0.2);
ok('quality select: back to bench (no ambient occlusion, no bloom)', await ev(() => { const b = window.__bench; return b.R.qualityName === 'bench' && !b.R.aoEffect && b.R.q.bloom === false && b.key.shadow.mapSize.x === 1024; }));
await page.click('#controls button:has-text("Sound on")'); await adv(0.2);
const muted = await ev(() => window.__bench.audio.muted);
await page.click('#controls button:has-text("Sound off")'); await adv(0.2);
ok('sound on/off', muted === true && await ev(() => window.__bench.audio.muted === false && window.__bench.audio.started));
const lis = await ev(() => import('/src/data/truckSpec.js').then((m) => { const b = window.__bench, l = b.listener(); return { z: l.z, want: -m.spec.dims.frontOverhangIn * m.IN - 1.5, inCab: l.inCab, hood: b.ctl.hood.open }; }));
ok('listener: fixed 1.5 m in front of the grille', Math.abs(lis.z - lis.want) < 1e-9 && !lis.inCab && lis.hood);

const errs = logs.filter((l) => /error/i.test(l) && !/WebGLShadowMap|GPU stall|ReadPixels/.test(l));
ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
await browser.close(); await app.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
