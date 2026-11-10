// Dyno panel (key T): live graph, readouts, controls, run history, failure announcements.
// Reads the simulation (game.dyno, game.plant); never changes physics, only the operator controls a real dyno has.
import { spec } from '../data/truckSpec.js';
import { TIRE_R } from '../sim/driveline.js';
import { drawDynoGraph, fitCanvas, findBaseline, runColor, thousands, signed, THEME } from './dynoGraph.js';
import { h, txt, show, esc, fmtInt, kToF, MPH_PER_MS, level } from './uiKit.js';

const GRAPH_H = 292;

// what the status line says before and between runs (pure, tested)
export function dynoStatus(dyno) {
  const running = ['spinup', 'pull', 'coast'].includes(dyno.phase);
  if (running) return { kind: 'run', text: dyno.message || 'Run in progress' };
  // Strap setup is handled outside this panel; do not show its removed warning.
  if (!dyno.straps.every(Boolean)) return { kind: 'hidden', text: '' };
  const c = dyno.canStart();
  if (dyno.phase === 'refused' && !c.ok) return { kind: 'refused', text: dyno.message || c.reason };
  if (!c.ok) return { kind: 'hint', text: c.reason };
  if (dyno.phase === 'done' && dyno.message) return { kind: 'done', text: `${dyno.message}. Ready for another pull.` };
  return { kind: 'ready', text: 'Ready: the truck is strapped down and running. Press START RUN, then the operator holds full throttle.' };
}

export function vehicleMph(plant) { return Math.max(0, plant.dl.wheelSpeed() * TIRE_R * MPH_PER_MS); }

export function createDynoPanel(game) {
  const dyno = game.dyno, plant = game.plant;
  const st = { selected: new Set(), compare: false, collapsed: false, knownRuns: 0, lastSig: '', acc: 0, graphAcc: 0, open: false };

  const el = h('div', 'panel dx');
  el.innerHTML = `
    <div class="dx-head"><div class="dx-title"><b>CHASSIS DYNO</b><span>inertia rollers &middot; eddy-current absorber</span></div>
      <div class="dx-headbtns"><button class="dx-collapse" title="Collapse or expand">&#9662;</button><button class="dx-close" title="Close (T)">&times;</button></div></div>
    <div class="dx-body">
      <div class="dx-banners"></div>
      <div class="dx-status"></div>
      <canvas class="dx-graph"></canvas>
      <div class="dx-readouts"></div>
      <div class="dx-ctl">
        <div class="dx-row"><span class="dx-lab">FAN</span><label class="dx-chk"><input type="checkbox" class="dx-fan"><span>High-velocity cooling fan</span></label>
          <span class="dx-spacer"></span><button class="primary dx-start">START RUN</button><button class="dx-abort">Abort</button></div>
      </div>
      <div class="dx-wx"></div>
      <div class="dx-histhead"><h3>Run history</h3><label class="dx-chk"><input type="checkbox" class="dx-compare"><span>Compare to stock baseline</span></label><button class="dx-clear">Clear history</button></div>
      <div class="dx-hist"></div>
      <div class="dx-peaks"></div>
    </div>`;
  const q = (s) => el.querySelector(s);
  const canvas = q('.dx-graph');
  const status = q('.dx-status'), banners = q('.dx-banners'), readouts = q('.dx-readouts'), wx = q('.dx-wx'), peaks = q('.dx-peaks'), hist = q('.dx-hist');
  const fanEl = q('.dx-fan'), startBtn = q('.dx-start'), abortBtn = q('.dx-abort'), compareEl = q('.dx-compare');

  fanEl.addEventListener('change', () => { dyno.setFan(fanEl.checked); sync(true); });
  startBtn.addEventListener('click', () => { const r = dyno.startRun(); if (r.ok) { st.liveSeen = true; } sync(true); });
  abortBtn.addEventListener('click', () => { dyno.abort('Run aborted by the operator'); sync(true); });
  compareEl.addEventListener('change', () => { st.compare = compareEl.checked; sync(true); });
  q('.dx-clear').addEventListener('click', () => { dyno.runs.length = 0; dyno.last = null; st.selected.clear(); st.knownRuns = 0; sync(true); });
  q('.dx-collapse').addEventListener('click', () => { st.collapsed = !st.collapsed; sync(true); });
  q('.dx-close').addEventListener('click', () => game.openPanel('dyno'));

  // readouts
  const RO = [
    ['rpm', 'ENGINE RPM'], ['mph', 'SPEED mph'], ['boost', 'BOOST psi'], ['egt', 'EGT °F'], ['cool', 'COOLANT °F'], ['trans', 'TRANS °F'], ['turbo', 'TURBO krpm'],
  ];
  const roEls = {};
  for (const [k, lab] of RO) { const c = h('div', 'dx-ro', `<small>${lab}</small><b>--</b>`); readouts.appendChild(c); roEls[k] = { c, v: c.querySelector('b') }; }

  function banner(kind, text) { const b = h('div', `dx-banner ${kind}`, text); return b; }

  function history() {
    const runs = dyno.runs; const base = findBaseline(runs);
    hist.innerHTML = '';
    if (!runs.length) { hist.appendChild(h('div', 'dx-empty', 'No runs yet.')); return; }
    for (const r of [...runs].reverse()) {
      const row = h('label', 'dx-run' + (r.invalid ? ' invalid' : ''));
      if (r.invalid) {
        row.innerHTML = `<span class="sw" style="background:#555"></span><span class="rn">#${r.id}</span><span class="nm">${esc(r.tuneName)}</span><span class="inv">INVALID: ${esc((r.reason || '').replace(/^Run invalid: /, ''))}</span>`;
      } else {
        const on = st.selected.has(r.id);
        const fl = Object.entries(r.failures || {}).filter(([, v]) => v).map(([k]) => k);
        row.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''}><span class="sw" style="background:${st.compare && base && base.id === r.id ? THEME.baseline : runColor(r)}"></span><span class="rn">#${r.id}</span>
          <span class="nm">${esc(r.tuneName)} <em>${esc(r.regulator || '')} reg</em>${base && base.id === r.id ? '<i class="tag">BASELINE</i>' : ''}${fl.length ? `<i class="tag bad">${esc(fl.join(', '))} failed</i>` : ''}</span>
          <span class="pk"><b>${r.peakHp.toFixed(1)}</b> whp</span><span class="pk"><b>${Math.round(r.peakTq)}</b> lb-ft</span>`;
        row.querySelector('input').addEventListener('change', (e) => { if (e.target.checked) st.selected.add(r.id); else st.selected.delete(r.id); sync(true); });
      }
      hist.appendChild(row);
    }
  }

  function peakBlock() {
    const runs = dyno.runs; const base = findBaseline(runs);
    const sel = runs.filter((r) => st.selected.has(r.id) && !r.invalid);
    const r = sel.length ? sel[sel.length - 1] : [...runs].reverse().find((x) => !x.invalid);
    if (!r) { peaks.innerHTML = ''; return; }
    const cmp = st.compare && base && base.id !== r.id ? ` <em class="gain">${signed(r.peakHp - base.peakHp, 1)} whp vs stock</em>` : '';
    const cmpT = st.compare && base && base.id !== r.id ? ` <em class="gain">${signed(r.peakTq - base.peakTq, 0)} lb-ft vs stock</em>` : '';
    peaks.innerHTML = `<div class="pkc"><small>PEAK WHEEL HORSEPOWER &middot; RUN ${r.id}</small><b>${r.peakHp.toFixed(1)}<u>whp</u></b><span>at ${thousands(r.peakHpRpm)} rpm${cmp}</span></div>
      <div class="pkc"><small>PEAK WHEEL TORQUE</small><b>${Math.round(r.peakTq)}<u>lb-ft</u></b><span>at ${thousands(r.peakTqRpm)} rpm${cmpT}</span></div>
      <div class="pkc small"><small>SAE J1349 CORRECTION</small><b>${r.cf.toFixed(3)}</b><span>${r.air ? `${r.air.tempC.toFixed(1)} °C, ${r.air.pressureKpa.toFixed(1)} kPa, ${Math.round(r.air.humidityPct)} % RH` : ''}</span></div>
      <div class="pkc small"><small>THIS RUN</small><b>${thousands(r.maxEgtF)}<u>°F max EGT</u></b><span>${r.maxBoostPsi.toFixed(1)} psi boost &middot; ${r.maxTurboKrpm.toFixed(0)}k turbo &middot; rail err ${Math.round(r.railErrPsi)} psi</span></div>`;
  }

  // keep controls and lists in step with the simulation; force = rebuild lists now
  function sync(force = false) {
    // new runs are selected automatically
    if (dyno.runs.length !== st.knownRuns) {
      for (const r of dyno.runs.slice(st.knownRuns)) if (!r.invalid) st.selected.add(r.id);
      if (dyno.runs.length < st.knownRuns) { const ids = new Set(dyno.runs.map((r) => r.id)); for (const id of [...st.selected]) if (!ids.has(id)) st.selected.delete(id); }
      st.knownRuns = dyno.runs.length; force = true;
    }
    const running = ['spinup', 'pull', 'coast'].includes(dyno.phase);
    if (fanEl.checked !== dyno.fan) fanEl.checked = dyno.fan;
    startBtn.disabled = running; abortBtn.disabled = !running;
    const base = findBaseline(dyno.runs);
    compareEl.disabled = !base; if (!base && st.compare) { st.compare = false; } compareEl.checked = st.compare;
    compareEl.parentElement.title = base ? `Overlay on the stock baseline (run ${base.id})` : 'Make a pull with the stock tune first: it becomes the baseline';
    el.classList.toggle('collapsed', st.collapsed);
    q('.dx-collapse').innerHTML = st.collapsed ? '&#9652;' : '&#9662;';
    const s = dynoStatus(dyno); status.className = `dx-status ${s.kind}`; txt(status, s.text); show(status, !!s.text);
    if (force) { history(); peakBlock(); }
    banners.innerHTML = '';
    if (plant.reducedPower) banners.appendChild(banner('bad', '<b>REDUCED ENGINE POWER</b> The engine computer is limiting power to protect the engine. Let it cool.'));
    if (plant.dl.transF >= spec.drivetrain.trans.hotWarningF) banners.appendChild(banner('bad', '<b>TRANSMISSION HOT</b> Fluid is above ' + spec.drivetrain.trans.hotWarningF + ' °F; the Allison is in protection. Let it cool before another pull.'));
    for (const [part, bad] of Object.entries(plant.fail.state)) if (bad) { const ev = [...plant.fail.events].reverse().find((e) => e.part === part); banners.appendChild(banner('bad', `<b>${esc(ev ? ev.title : part.toUpperCase() + ' FAILED')}</b> Repair it from the shop menu (M).`)); }
  }

  function readoutsNow() {
    const o = plant.out || {};
    const rpm = plant.rpm;
    txt(roEls.rpm.v, fmtInt(rpm)); txt(roEls.mph.v, vehicleMph(plant).toFixed(1));
    txt(roEls.boost.v, Math.max(0, o.boostPsi || 0).toFixed(1)); // vacuum at idle reads zero on the boost gauge
    const egt = o.egtPreK ? kToF(o.egtPreK) : 0; txt(roEls.egt.v, fmtInt(egt));
    txt(roEls.cool.v, fmtInt(plant.coolantF)); txt(roEls.trans.v, fmtInt(plant.dl.transF));
    const tk = (o.turboRpm || 0) / 1000; txt(roEls.turbo.v, tk.toFixed(1));
    roEls.egt.c.dataset.lv = level(egt, 1500, 1650) || '';
    roEls.cool.c.dataset.lv = level(plant.coolantF, spec.limits.coolantHotF, spec.limits.coolantOverheatF) || '';
    roEls.trans.c.dataset.lv = level(plant.dl.transF, 250, spec.drivetrain.trans.hotWarningF) || '';
    roEls.turbo.c.dataset.lv = level(tk * 1000, spec.turbo.overspeedRpm * 0.92, spec.turbo.overspeedRpm) || '';
    const a = plant.air; txt(wx, `Weather: ${a.tempC.toFixed(1)} C  ${a.pressureKpa.toFixed(1)} kPa  ${Math.round(a.humidityPct)} % RH  (shop ${Math.round(game.shopTempF != null ? game.shopTempF : a.tempC * 1.8 + 32)} °F)`);
  }

  function graph(force = false) {
    if (st.collapsed) return;
    const bodyW = q('.dx-body').clientWidth; // padding 12 px each side
    const width = Math.max(320, bodyW ? bodyW - 24 : 536);
    const running = ['spinup', 'pull', 'coast'].includes(dyno.phase);
    const base = st.compare ? findBaseline(dyno.runs) : null;
    const sig = [width, dyno.runs.length, [...st.selected].join(','), st.compare, running ? dyno.rec?.t.length || 0 : 0, dyno.runCounter, running, base ? base.id : 0, dyno.phase === 'refused', plant.air.tempC, plant.air.pressureKpa, plant.air.humidityPct, window.devicePixelRatio].join('|');
    if (!force && sig === st.lastSig) return;
    st.lastSig = sig;
    const live = running ? dyno.liveAnalysis() : null;
    const ctx = fitCanvas(canvas, width, GRAPH_H);
    drawDynoGraph(ctx, width, GRAPH_H, { runs: dyno.runs, baseline: base, current: live, selectedIds: st.selected, showTorque: true, weather: plant.air });
  }

  const api = {
    el, state: st,
    open() { st.open = true; el.style.display = 'block'; sync(true); readoutsNow(); graph(true); },
    close() { st.open = false; el.style.display = 'none'; },
    // called by the game loop every frame while the panel is open
    update(dt) {
      st.acc += dt;
      if (st.acc < 0.125) return;
      st.acc = 0;
      sync(); readoutsNow(); graph();
    },
    redraw() { sync(true); readoutsNow(); graph(true); },
  };
  el.style.display = 'none';
  return api;
}

// ---- global alerts: the failure announcement and the protection chips, visible even when the panel is closed ----
export function createDynoAlerts(game) {
  const plant = game.plant;
  const root = h('div', 'dx-alerts');
  const strip = h('div', 'dx-strip'); const modal = h('div', 'dx-modal'); modal.style.display = 'none';
  root.append(strip, modal);
  let seen = plant.fail.events.length; const queue = [];
  const chips = { rpw: h('span', 'dx-chip bad', 'REDUCED ENGINE POWER'), hot: h('span', 'dx-chip bad', 'TRANSMISSION HOT') };
  strip.append(chips.rpw, chips.hot);
  function showNext() {
    const ev = queue.shift();
    if (!ev) { modal.style.display = 'none'; return; }
    const more = queue.length ? ` &middot; ${queue.length} more` : '';
    modal.innerHTML = `<div class="dx-card"><div class="dx-ktag">PART FAILURE${more}</div><h2>${esc(ev.title)}</h2><p>${esc(ev.why)}</p>
      <p class="dx-fix">The truck can be repaired from the shop menu (key M): REPAIRS. Play continues after the repair.</p>
      <div class="dx-cardbtns"><button class="primary go">Open the shop menu</button><button class="ok">Dismiss</button></div></div>`;
    modal.querySelector('.ok').addEventListener('click', showNext);
    modal.querySelector('.go').addEventListener('click', () => { queue.length = 0; modal.style.display = 'none'; game.openPanel('shop'); if (game.uiPanels && game.uiPanels.shop) game.uiPanels.shop.setTab('repairs'); });
    modal.style.display = 'flex';
  }
  return {
    el: root,
    pendingCount: () => queue.length + (modal.style.display === 'none' ? 0 : 1),
    tick() {
      const ev = plant.fail.events;
      if (ev.length < seen) seen = ev.length; // truck was reset
      while (seen < ev.length) { queue.push(ev[seen]); seen++; }
      if (queue.length && modal.style.display === 'none') showNext();
      show(chips.rpw, !!plant.reducedPower, 'inline-block');
      show(chips.hot, plant.dl.transF >= spec.drivetrain.trans.hotWarningF, 'inline-block');
      show(strip, plant.reducedPower || plant.dl.transF >= spec.drivetrain.trans.hotWarningF, 'flex');
    },
  };
}
