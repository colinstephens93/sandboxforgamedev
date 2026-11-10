// Shop menu (key M): repairs, parts (LBZ fuel pressure regulator), and shop settings.
import { spec } from '../data/truckSpec.js';
import { REGULATORS } from '../sim/engine.js';
import { AILive } from '../sim/flash.js';
import { loadCal } from '../sim/calibrations.js';
import { KEY } from '../sim/startSequence.js';
import { h, txt, show, toggleClass, esc, makeBar } from './uiKit.js';

const L = spec.limits;

// what each part is, what failure feels like, and the stress meter that leads to it (pure data, tested)
export const REPAIR_PARTS = {
  transmission: { name: 'Allison 1000 transmission', ok: 'Clutch packs hold the load. Slip and fluid heat are the things that burn them.', down: 'The clutch packs burned: the truck cannot hold the load on the dyno.', job: 'Rebuild: new clutch packs, filter and fluid', seconds: 5,
    stress: (p) => p.fail.acc.slipKj / L.clutchBurnSlipEnergyKj, stressLabel: 'Clutch slip energy' },
  headGasket: { name: 'Head gaskets', ok: 'Sealing. Cylinder pressure above ' + L.cylPressureSoftPsi + ' psi stresses them; held above ' + L.cylPressureLiftPsi + ' psi they lift.', down: 'Lifted: white smoke, coolant loss and climbing temperature.', job: 'Replace both head gaskets and the head bolts', seconds: 6,
    stress: (p) => p.fail.acc.cylLift / L.cylPressureHoldS, stressLabel: 'Cylinder pressure over the lift limit' },
  turbo: { name: 'Turbocharger', ok: spec.turbo.model + ' variable-geometry unit. Overspeed above ' + Math.round(spec.turbo.overspeedRpm / 1000) + ',000 rpm or extreme exhaust temperature damages it.', down: 'Damaged: boost drops and the whistle turns rough.', job: 'Replace the turbocharger', seconds: 4,
    stress: (p) => Math.max(p.fail.acc.overspeed / spec.turbo.overspeedHoldS, p.fail.acc.turboEgt / 4), stressLabel: 'Overspeed / exhaust heat' },
  piston: { name: 'Pistons', ok: 'Sound. Pre-turbo exhaust above ' + L.egtPistonDamageF + ' °F held for a while erodes the aluminum crowns.', down: 'Crowns eroded: the engine loses power and blows smoke.', job: 'Replace the pistons and rings', seconds: 8,
    stress: (p) => p.fail.acc.pistonEgt / L.egtPistonDamageHoldS, stressLabel: 'Exhaust heat on the crowns' },
};

export const REGULATOR_STEPS = [
  'Remove the fuel rail supply line',
  'Swap the regulator on the CP3 pump',
  'Torque the regulator to spec',
  'Bleed the fuel system',
];

// repair side effects, separated so the tests can run them without any DOM
export function applyRepair(plant, part) {
  plant.fail.repair(part);
  if (part === 'transmission') {
    plant.dl.slipEnergyKj = 0; plant.dl.health = 1;
    plant.dl.transF = Math.min(plant.dl.transF, plant.air.tempC * 1.8 + 32 + 60); // fresh fluid, shop-cool
  }
}

// back to the delivered truck: stock tune, LLY regulator, repaired, cold, nothing flashed
export function resetTruck(game) {
  const p = game.plant;
  p.fail.repair('all');
  p.setCalibration(loadCal('stock')); p.setRegulator('LLY'); p.pp.sound = { close: 0, hold: 0 };
  p.stopEngine(); p.we = 0; p.starter = false; p.reducedPower = false;
  p.pp.omega = 3500; p.pp.railAct = 5000; p.pp.vaneTrim = 0; p.pp.icSoakK = 0; p.pp.damage.boostLoss = 0; p.pp.damage.piston = 0;
  const airF = p.air.tempC * 1.8 + 32;
  p.coolantC = p.air.tempC; p.oilC = p.air.tempC;
  Object.assign(p.dl, { transF: airF, slipEnergyKj: 0, health: 1, wr: 0, wt: 0, range: 'N', cpSlip: 0 });
  game.ign.setKey(KEY.LOCK); game.ign.cooldown = 0; game.ign.blocked = null;
  const d = game.dyno; d.runs.length = 0; d.last = null; d.current = null; d.phase = 'idle'; d.message = '';
  Object.assign(game.ai, new AILive({ directTuning: game.ai.directTuning }));
  if (game.uiPanels && game.uiPanels.ailive) game.uiPanels.ailive.setApplied({ close: 0, hold: 0 });
  game.ui.say('Truck reset: stock tune, LLY regulator, repaired and cold.', 4);
}

export function createShopMenu(game) {
  const plant = game.plant;
  const st = { jobs: [], reg: null, open: false, acc: 0, confirm: 0, tab: 'repairs' };
  const el = h('div', 'panel sm');
  el.innerHTML = `
    <div class="sm-head"><div><b>SHOP MENU</b><span>repairs, parts and shop settings</span></div><button class="sm-close" title="Close (M)">&times;</button></div>
    <div class="sm-tabs"><button data-tab="repairs" class="on">REPAIRS</button><button data-tab="parts">PARTS</button><button data-tab="shop">SHOP</button></div>
    <div class="sm-body">
      <section data-tab="repairs"><h3>Repairs</h3><p class="sm-sub">Parts break only past believable limits. Each failure is announced; repair it here and play on.</p><div class="sm-parts"></div></section>
      <section data-tab="parts"><h3>Parts</h3><div class="sm-reg"></div></section>
      <section data-tab="shop"><h3>Shop</h3><div class="sm-shop"></div></section>
    </div>`;
  el.querySelector('.sm-close').addEventListener('click', () => game.openPanel('shop'));
  const tabBtns = [...el.querySelectorAll('.sm-tabs button')], tabSecs = [...el.querySelectorAll('.sm-body section')];
  const setTab = (t) => { st.tab = t; tabBtns.forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); tabSecs.forEach((x) => { x.style.display = x.dataset.tab === t ? '' : 'none'; }); };
  tabBtns.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  // ---------------- repairs
  const partsEl = el.querySelector('.sm-parts'); const rows = {};
  for (const [key, info] of Object.entries(REPAIR_PARTS)) {
    const row = h('div', 'sm-part');
    row.innerHTML = `<div class="pn"><b>${esc(info.name)}</b><span class="stt"></span></div><p class="px"></p><div class="stress"><small>${esc(info.stressLabel)}</small></div><div class="act"><button class="primary rep">Repair</button><small class="jobt"></small></div>`;
    const bar = makeBar('sm-bar'); row.querySelector('.stress').appendChild(bar.root);
    const jbar = makeBar('sm-bar job'); row.querySelector('.act').insertBefore(jbar.root, row.querySelector('.jobt'));
    row.querySelector('.rep').addEventListener('click', () => startJob({ kind: 'repair', part: key, dur: info.seconds, t: 0 }));
    partsEl.appendChild(row); rows[key] = { row, bar, jbar, stt: row.querySelector('.stt'), px: row.querySelector('.px'), rep: row.querySelector('.rep'), jobt: row.querySelector('.jobt') };
  }
  function startJob(job) {
    if (st.jobs.find((j) => j.kind === job.kind && j.part === job.part)) return;
    st.jobs.push(job); refresh();
  }

  // ---------------- regulator
  const regEl = el.querySelector('.sm-reg');
  regEl.innerHTML = `<div class="regrow"><div><b>Fuel pressure regulator on the CP3 pump</b><p class="sm-sub">The owner's five tunes were written for the <b>LBZ</b> regulator. It flows more fuel than the stock LLY one, so the rail holds its pressure at high fuel demand. Without it, the Street and Race tunes fall short on rail pressure and lose power.</p></div><div class="now"></div></div>
    <ol class="regsteps">${REGULATOR_STEPS.map((s) => `<li>${s}</li>`).join('')}</ol><div class="regbar"></div><div class="regbtns"><button class="primary inst">Install LBZ regulator</button><button class="rem">Remove (return to stock LLY regulator)</button><small class="regmsg"></small></div>`;
  const regBar = makeBar('sm-bar job'); regEl.querySelector('.regbar').appendChild(regBar.root);
  const regInst = regEl.querySelector('.inst'), regRem = regEl.querySelector('.rem'), regMsg = regEl.querySelector('.regmsg'), regNow = regEl.querySelector('.now'), regSteps = [...regEl.querySelectorAll('.regsteps li')];
  const REG_SECONDS = 8;
  function regStart(to) {
    if (game.ign.engineRunning) { regMsg.textContent = 'Shut the engine off first: the fuel system is opened for this job.'; regMsg.className = 'regmsg bad'; return; }
    if (st.reg) return;
    st.reg = { to, t: 0 }; regMsg.textContent = ''; refresh();
  }
  regInst.addEventListener('click', () => regStart('LBZ'));
  regRem.addEventListener('click', () => regStart('LLY'));

  // ---------------- shop
  const shopEl = el.querySelector('.sm-shop');
  shopEl.innerHTML = `
    <div class="sr"><label>Shop air temperature</label><input type="range" min="-10" max="100" step="1" class="temp"><output class="tempv"></output></div>
    <p class="sm-sub">Below 32 °F air and 150 °F coolant the elevated idle (exhaust restrictor) can run. It is switched on and off from the driver information center in the cab; the button here does the same thing.</p>
    <div class="sr"><label>Elevated idle</label><button class="elev"></button><span class="elevs"></span></div>
    <div class="sr"><label>Dyno cooling fan</label><label class="chk"><input type="checkbox" class="fan"><span>High-velocity fan in front of the grille</span></label></div>
    <div class="sr"><label>Graphics quality</label><select class="qual"><option>low</option><option>medium</option><option>high</option></select></div>
    <div class="sr"><label>Truck</label><button class="reset danger">Reset truck</button><span class="resets">Stock tune, LLY regulator, all repairs, cold start, run history cleared.</span></div>`;
  const tempIn = shopEl.querySelector('.temp'), tempV = shopEl.querySelector('.tempv'), elev = shopEl.querySelector('.elev'), elevS = shopEl.querySelector('.elevs');
  const fan = shopEl.querySelector('.fan'), qual = shopEl.querySelector('.qual'), resetB = shopEl.querySelector('.reset');
  tempIn.addEventListener('input', () => { game.setShopTemp(+tempIn.value); refresh(); });
  elev.addEventListener('click', () => { game.ign.toggleElevatedIdle(); refresh(); });
  fan.addEventListener('change', () => { game.dyno.setFan(fan.checked); });
  qual.addEventListener('change', () => { game.qname = qual.value; if (game.R && game.R.setQuality) game.R.setQuality(qual.value); if (game.ui.setQuality) game.ui.setQuality(qual.value); });
  resetB.addEventListener('click', () => {
    if (!st.confirm) { st.confirm = 4; resetB.textContent = 'Confirm: reset the truck'; resetB.classList.add('armed'); return; }
    st.confirm = 0; resetB.textContent = 'Reset truck'; resetB.classList.remove('armed'); resetTruck(game); refresh();
  });
  resetB.textContent = 'Reset truck';

  function refresh() {
    for (const [key, info] of Object.entries(REPAIR_PARTS)) {
      const r = rows[key]; const bad = plant.fail.state[key];
      const job = st.jobs.find((j) => j.kind === 'repair' && j.part === key);
      const ev = [...plant.fail.events].reverse().find((e) => e.part === key);
      toggleClass(r.row, 'failed', bad);
      r.stt.className = `stt ${bad ? 'bad' : 'ok'}`; txt(r.stt, bad ? 'FAILED' : 'OK');
      r.px.innerHTML = bad ? `<b>${esc(ev ? ev.title : info.name)}</b> ${esc(ev ? ev.why : info.down)}` : esc(info.ok);
      const stress = Math.max(0, Math.min(1, info.stress(plant)));
      r.bar.set(bad ? 1 : stress, bad ? 'bad' : stress > 0.7 ? 'bad' : stress > 0.35 ? 'warn' : 'ok');
      r.rep.disabled = !bad || !!job; r.rep.textContent = job ? 'Repairing...' : bad ? 'Repair' : 'No repair needed';
      show(r.jbar.root, !!job, 'block'); if (job) r.jbar.set(job.t / job.dur, 'run');
      txt(r.jobt, job ? `${info.job}: ${Math.ceil(job.dur - job.t)} s` : bad ? info.job : '');
    }
    const reg = plant.pp.regulator;
    regNow.innerHTML = `<small>FITTED</small><b class="${reg === 'LBZ' ? 'ok' : 'warn'}">${esc(REGULATORS[reg] ? REGULATORS[reg].name : reg)}</b>`;
    regInst.disabled = reg === 'LBZ' || !!st.reg; regRem.disabled = reg === 'LLY' || !!st.reg;
    const f = st.reg ? st.reg.t / REG_SECONDS : 0; regBar.set(f, st.reg ? 'run' : ''); show(regBar.root, !!st.reg, 'block');
    const cur = st.reg ? Math.min(REGULATOR_STEPS.length - 1, Math.floor(f * REGULATOR_STEPS.length)) : -1;
    regSteps.forEach((li, i) => { li.className = st.reg ? (i < cur ? 'done' : i === cur ? 'now' : '') : ''; });
    // shop
    const tf = game.shopTempF != null ? game.shopTempF : plant.air.tempC * 1.8 + 32;
    if (document.activeElement !== tempIn) tempIn.value = Math.round(tf);
    txt(tempV, `${Math.round(tf)} °F  (${((tf - 32) / 1.8).toFixed(1)} °C)`);
    const on = game.ign.elevatedEnabled; txt(elev, on ? 'Disable elevated idle' : 'Enable elevated idle');
    const air = plant.air.tempC * 1.8 + 32;
    txt(elevS, `${on ? 'ENABLED' : 'DISABLED'}${on ? (air < spec.start.elevatedIdleBelowAirF && plant.coolantF < spec.start.elevatedIdleBelowCoolantF ? ': conditions met, idle will ramp to 1,200 rpm' : ': waits for air below 32 °F and coolant below 150 °F') : ''}`);
    if (fan.checked !== game.dyno.fan) fan.checked = game.dyno.fan;
    if (qual.value !== game.qname && document.activeElement !== qual && game.qname) qual.value = game.qname;
    if (st.confirm <= 0 && resetB.classList.contains('armed')) { resetB.textContent = 'Reset truck'; resetB.classList.remove('armed'); }
  }

  const api = {
    el, state: st,
    open() { st.open = true; el.style.display = 'flex'; refresh(); },
    close() { st.open = false; el.style.display = 'none'; },
    // always called (open or not) so jobs progress with game time
    tick(dt) {
      let changed = false;
      for (const j of [...st.jobs]) {
        j.t += dt; changed = true;
        if (j.t >= j.dur) { applyRepair(plant, j.part); st.jobs.splice(st.jobs.indexOf(j), 1); game.ui.say(`${REPAIR_PARTS[j.part].name}: repaired.`, 4); }
      }
      if (st.reg) {
        st.reg.t += dt; changed = true;
        if (st.reg.t >= REG_SECONDS) { plant.setRegulator(st.reg.to); game.ui.say(st.reg.to === 'LBZ' ? 'LBZ fuel pressure regulator installed and the system bled.' : 'Stock LLY regulator back on the pump.', 5); st.reg = null; regMsg.textContent = ''; }
      }
      if (st.confirm > 0) st.confirm -= dt;
      if (changed && st.open) refresh();
    },
    update(dt) { st.acc += dt; if (st.acc < 0.15) return; st.acc = 0; refresh(); },
  };
  setTab('repairs');
  el.style.display = 'none';
  api.setTab = setTab;
  return api;
}
