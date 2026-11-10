// AI Live: the shop's laptop tuning application (an original tool for this game; the name, logo and screens are invented).
// Pages: CONNECT, TRUCK, QUICK TUNES, TURBO SOUND, DATALOG, COMPARE. Talks to game.ai (the AILive state machine) with
// env { keyPos, engineRunning } and shows what the simulation really did: nothing here fakes a number.
import { spec } from '../data/truckSpec.js';
import { TEMPLATES, TUNE_ORDER, GAIN_WHP } from '../sim/calTemplates.js';
import { FLASH } from '../sim/flash.js';
import { drawDynoGraph, drawMultiChannel, fitCanvas, findBaseline, runColor, signed, thousands } from './dynoGraph.js';
import { h, txt, show, toggleClass, esc, fmtClock, kToF, makeBar } from './uiKit.js';

// =============================== pure data and logic (unit tested) ===============================

export const PAGES = [['connect', 'CONNECT'], ['truck', 'TRUCK'], ['tunes', 'QUICK TUNES'], ['sound', 'TURBO SOUND'], ['datalog', 'DATALOG'], ['compare', 'COMPARE']];

export const gainText = (id) => (id === 'stock' ? 'Baseline' : `+${GAIN_WHP[id]} whp`);
export const GAIN_SUB = 'rear-wheel horsepower on a chassis dyno, over the stock truck';

// Risks written for a diesel tuner. Numbers are what this game's physics gives on a 4th-gear pull; they are estimates (ACCURACY.md).
export const TUNE_RISKS = {
  stock: [
    ['Overall', 'Factory limits, no added risk. Pre-turbo EGT peaks near 1,350 F on a pull and the Allison is well inside its clutch capacity.'],
  ],
  heavytow: [
    ['EGT', 'Stays moderate, about 1,375 F pre-turbo on a full pull; a safe tow tune on long grades.'],
    ['Allison', 'Firmer line pressure and early converter lockup keep the fluid cooler under load.'],
    ['Smoke', 'Light haze at the top of the pull; the smoke limiter holds lambda around 1.36.'],
    ['Rail', 'The LLY regulator holds rail pressure at this fuel quantity.'],
  ],
  lighttow: [
    ['EGT', 'About 1,415 F pre-turbo on a pull with boost near 30 psi. Keep it under 1,300 F post-turbo for sustained towing.'],
    ['Allison', 'Still the conservative tow shift schedule, with firm lockup for towing.'],
    ['Smoke', 'Noticeable puff of smoke at tip-in as the turbo spools.'],
    ['Rail', 'The LLY regulator still holds rail pressure.'],
  ],
  economy: [
    ['EGT', 'About 1,500 F pre-turbo at full throttle: at the limit to hold for long. Part-throttle timing is advanced, so cruise EGT stays low.'],
    ['Turbo', 'Boost near 34 psi pushes the turbo toward 118,000 rpm of its roughly 135,000 rpm limit.'],
    ['Allison', 'Clutch packs are loaded harder than stock; watch the slip channel and fluid temperature after repeated pulls.'],
    ['Rail', 'Written for the LBZ regulator. The LLY regulator still holds almost full rail pressure here, but there is no margin left above this tune.'],
  ],
  street: [
    ['EGT', 'About 1,610 F pre-turbo on a pull: close to the 1,650 F line where aluminum piston crowns start to erode. Keep pulls short.'],
    ['Smoke', 'Visible black smoke at the top of the pull: the smoke limiter allows lambda 1.21, fuel beyond what the air can burn.'],
    ['Allison', 'Torque approaches the stock clutch capacity (about 840 lb-ft). Slip and fluid heat climb on repeated pulls.'],
    ['Rail', 'With the stock LLY regulator the rail falls about 800 psi short of target at high fuel demand and roughly 14 whp is lost.'],
    ['Head gaskets', 'Cylinder pressure near 2,800 psi: approaching the 2,900 psi where head gaskets start to see distress.'],
  ],
  race: [
    ['EGT', 'About 1,670 F pre-turbo: over the piston line within seconds of a full pull. Not for repeated pulls.'],
    ['Turbo', 'Turbo shaft near 126,000 rpm of its roughly 135,000 rpm limit; closing the vanes further risks an overspeed.'],
    ['Allison', 'Slip and heat can burn the stock clutch packs when abused. This is how real stock transmissions fail.'],
    ['Rail', 'With the stock LLY regulator the rail falls about 2,000 psi short of target and roughly 32 whp is lost.'],
    ['Head gaskets', 'Cylinder pressure near 3,000 psi against a 3,300 psi lift limit: the gaskets are next after repeated pulls.'],
    ['Smoke', 'Heavy black smoke at the top; lambda is held at 1.15.'],
  ],
};

export const REG_LINE = 'Written for the LBZ fuel pressure regulator: the truck currently has the LLY regulator';

// level: 'warn' (street, race on the LLY regulator), 'soft' (economy), 'ok' (LBZ fitted), or null
export function regulatorNote(id, regulator) {
  if (id === 'stock') return null;
  if (regulator === 'LLY') {
    if (id === 'street' || id === 'race') return { level: 'warn', text: REG_LINE, detail: 'Rail pressure falls short of target at high fuel demand, so power falls short of this tune\'s numbers. Install the LBZ regulator from the shop menu (M), PARTS.' };
    if (id === 'economy') return { level: 'soft', text: 'Written for the LBZ regulator; the LLY regulator is close to its limit at this fuel quantity.', detail: '' };
    return null;
  }
  return { level: 'ok', text: 'LBZ regulator fitted: this is how the tune was written.', detail: '' };
}

export function tuneCard(id, regulator = 'LLY') {
  const t = TEMPLATES[id];
  return {
    id, position: t.position || 0, name: t.name, desc: t.desc,
    gainWhp: id === 'stock' ? 0 : GAIN_WHP[id], gainText: gainText(id), gainSub: id === 'stock' ? 'the factory calibration, always available' : GAIN_SUB,
    risks: TUNE_RISKS[id], regNote: regulatorNote(id, regulator),
  };
}
export const allCards = (regulator) => TUNE_ORDER.map((id) => tuneCard(id, regulator));

// ---- procedure checklist, in the order a shop does it ----
export function procedureSteps(ai, env) {
  const keyRun = env.keyPos === 2 && !env.engineRunning;
  const written = ai.stage === 'writeDone' || ai.needsKeyCycle;
  const steps = [
    { id: 'charger', optional: true, title: 'Connect the battery charger', done: ai.charger, detail: ai.charger ? `Charger on, battery ${ai.volts.toFixed(1)} V.` : `Recommended: a long write drains the battery and fails below ${FLASH.batteryFailV.toFixed(1)} V.` },
    { id: 'cable', title: 'Plug the interface cable into the OBD-II port', done: ai.cable, detail: ai.cable ? 'Interface connected.' : 'The OBD-II port is under the left side of the dash.' },
    { id: 'key', title: 'Key to RUN with the engine off', done: keyRun, detail: env.engineRunning ? 'The engine is running: shut it off, then turn the key to RUN.' : keyRun ? 'Key in RUN, engine off.' : 'Turn the ignition key to RUN (do not start the engine).' },
    { id: 'read', title: 'READ the truck\'s current tune', done: ai.readTune != null, detail: ai.readTune != null ? `The truck carries "${ai.readTune}".` : 'The laptop reads the tune that is in the truck.' },
    { id: 'backup', title: 'SAVE BACKUP of the stock tune', done: ai.backup, detail: ai.backup ? 'Backup saved on the laptop.' : 'Required before the first write.' },
    { id: 'choose', title: 'Choose a tune', done: written || ai.stage === 'writing', detail: `Selected: ${TEMPLATES[ai.selected] ? TEMPLATES[ai.selected].name : ai.selected}.` },
    { id: 'write', title: 'WRITE the tune', done: written, detail: ai.stage === 'writing' ? `Writing ${Math.round(ai.progress * 100)} %. Do not touch the key or the cable.` : written ? 'Write complete.' : 'Takes a while: do not interrupt it.' },
    { id: 'cycle', title: 'Cycle the key and start the engine', done: written && !ai.needsKeyCycle && !!env.engineRunning, detail: ai.needsKeyCycle ? 'Key OFF, then RUN, then start. The new tune loads on the next key cycle.' : 'The new calibration runs after the key is cycled.' },
  ];
  let found = false;
  for (const s of steps) {
    if (s.done) s.state = 'done';
    else if (s.optional) s.state = 'advice';
    else if (!found) { s.state = 'now'; found = true; } else s.state = 'todo';
  }
  return steps;
}

export function nextStep(ai, env) {
  const keyRun = env.keyPos === 2 && !env.engineRunning;
  if (ai.stage === 'writing') return { tone: 'bad', text: 'WRITING: do not turn the key off, unplug the cable or start the engine.' };
  if (['reading', 'backing'].includes(ai.stage)) return { tone: 'warn', text: 'Working: keep the key in RUN and the cable plugged in.' };
  if (!ai.cable) return { tone: 'warn', text: ai.bricked ? 'Recovery: plug the interface into the OBD-II port.' : 'Plug the interface into the OBD-II port under the dash.' };
  if (!keyRun) return { tone: 'warn', text: env.engineRunning ? 'Shut the engine off, then turn the key to RUN.' : 'Turn the key to RUN with the engine off.' };
  if (ai.bricked) return { tone: 'bad', text: 'Recovery mode: choose a tune and press WRITE. Any tune restores the ECM; no read or backup is needed.' };
  if (ai.needsKeyCycle) return { tone: 'ok', text: 'Write complete. Turn the key off, back to RUN, and start the engine.' };
  if (ai.readTune == null) return { tone: 'info', text: 'Press READ to read the truck\'s current tune.' };
  if (!ai.backup) return { tone: 'info', text: 'Press SAVE BACKUP: a backup is required before the first write.' };
  return { tone: 'info', text: 'Choose a tune on QUICK TUNES and press WRITE.' };
}

export const writeRemainingSec = (ai) => (ai.stage === 'writing' ? FLASH.writeSeconds * (1 - ai.progress) : 0);

// the Turbo Sound settings the truck really has: what was written (pending a key cycle, or applied)
export function writtenSound(ai) {
  if (ai.pendingApply) return ai.pendingApply.sound;
  return ai.soundByTune[ai.installed] || { close: 0, hold: 0 };
}
export const soundDirty = (ai) => { const w = writtenSound(ai); return Math.abs(w.close - ai.sound.close) > 1e-6 || Math.abs(w.hold - ai.sound.hold) > 1e-6; };

// ---- datalog channels and CSV ----
export const LOG_CHANNELS = [
  { key: 'rpm', label: 'Engine speed', unit: 'rpm', color: '#e8ecf1', decimals: 0, on: true },
  { key: 'qty', label: 'Fuel quantity', unit: 'mm3/stroke', color: '#ffd23f', decimals: 1 },
  { key: 'railPsi', label: 'Rail pressure', unit: 'psi', color: '#f062c8', decimals: 0, on: true },
  { key: 'railTgtPsi', label: 'Rail target', unit: 'psi', color: '#9b5de5', decimals: 0 },
  { key: 'boostPsi', label: 'Boost', unit: 'psi', color: '#38bdf8', decimals: 1, on: true },
  { key: 'airLbMin', label: 'Airflow', unit: 'lb/min', color: '#7dd3fc', decimals: 1 },
  { key: 'soiDeg', label: 'Injection timing', unit: 'deg BTDC', color: '#a3e635', decimals: 1 },
  { key: 'egtF', label: 'EGT (pre-turbo)', unit: 'F', color: '#ff8a3d', decimals: 0, on: true },
  { key: 'coolantF', label: 'Coolant', unit: 'F', color: '#2dd4bf', decimals: 0 },
  { key: 'transF', label: 'Transmission', unit: 'F', color: '#f87171', decimals: 0 },
  { key: 'slipRpm', label: 'Trans slip', unit: 'rpm', color: '#fb7185', decimals: 0 },
  { key: 'vanePct', label: 'Vane position', unit: '%', color: '#c084fc', decimals: 0 },
  { key: 'turboKrpm', label: 'Turbo speed', unit: 'krpm', color: '#fbbf24', decimals: 1 },
  { key: 'driveKpa', label: 'Drive pressure', unit: 'kPa', color: '#34d399', decimals: 0 },
  { key: 'lambda', label: 'Lambda', unit: '', color: '#94a3b8', decimals: 2 },
];

export function logToCsv(run) {
  const rows = (run && run.log) || [];
  const head = ['time_s', ...LOG_CHANNELS.map((c) => (c.unit ? `${c.key} (${c.unit})` : c.key))];
  const lines = [head.join(',')];
  for (const r of rows) lines.push([r.t, ...LOG_CHANNELS.map((c) => (r[c.key] == null ? '' : r[c.key]))].join(','));
  return lines.join('\n') + '\n';
}
export const csvName = (run) => `ai-live-run${run.id}-${String(run.tuneId || 'tune')}.csv`;

// the comparison table rows
export function compareRows(runs) {
  const base = findBaseline(runs);
  return runs.filter((r) => !r.invalid).map((r) => ({
    id: r.id, tune: r.tuneName, regulator: r.regulator, peakHp: r.peakHp, peakHpRpm: r.peakHpRpm, peakTq: r.peakTq, peakTqRpm: r.peakTqRpm,
    dHp: base && base.id !== r.id ? r.peakHp - base.peakHp : null, dTq: base && base.id !== r.id ? r.peakTq - base.peakTq : null,
    vane: r.vane || { close: 0, hold: 0 }, maxEgtF: r.maxEgtF, maxBoostPsi: r.maxBoostPsi, railErrPsi: r.railErrPsi, isBase: !!base && base.id === r.id,
    failed: Object.entries(r.failures || {}).filter(([, v]) => v).map(([k]) => k),
  }));
}

// the logo (original): an AI monogram over a waveform
export const LOGO_SVG = `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="alg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
<rect x="2" y="2" width="60" height="60" rx="15" fill="url(#alg)"/><rect x="2.75" y="2.75" width="58.5" height="58.5" rx="14.3" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="1.5"/>
<path d="M13 41 L23 13 L33 41 M17.2 31 H28.8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="40" y="13" width="6" height="28" rx="3" fill="#fff"/>
<path d="M7 51 q3.4 -9 6.8 0 t6.8 0 t6.8 0 t6.8 0 t6.8 0 t6.8 0 t6.8 0 t6.8 0" fill="none" stroke="#0b1b2b" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
<path d="M7 51 q3.4 -9 6.8 0 t6.8 0 t6.8 0 t6.8 0 t6.8 0 t6.8 0 t6.8 0 t6.8 0" fill="none" stroke="#a7f3ee" stroke-width="2.6" stroke-linecap="round"/></svg>`;

// =============================== the app ===============================

export function createAILivePanel(game) {
  const ai = game.ai, plant = game.plant, dyno = game.dyno;
  const direct = ai.directTuning;
  const pages = direct ? PAGES.filter(([id]) => !['connect', 'truck'].includes(id)) : PAGES;
  const envNow = () => ({ keyPos: game.ign.key, engineRunning: game.ign.engineRunning, dynoRunning: ['spinup', 'pull', 'coast'].includes(dyno.phase) });
  const ctl = { page: direct ? 'tunes' : 'connect', preview: false, applied: { close: 0, hold: 0 }, open: false, acc: 0, pages: {}, logRunId: null, cmpRunId: null, cursor: null, logChecked: new Set(LOG_CHANNELS.filter((c) => c.on).map((c) => c.key)), csvUrl: null, csvRun: null };

  const el = h('div', 'panel al');
  el.innerHTML = `
    <header class="al-top">
      <div class="al-brand"><div class="al-logo">${LOGO_SVG}</div><div class="al-name"><b>AI <span>LIVE</span></b><small>ENGINE TUNING SUITE</small></div></div>
      <div class="al-chips"></div>
      <button class="al-close" title="Close (L)">&times;</button>
    </header>
    <div class="al-main"><nav class="al-nav"></nav><section class="al-stage"></section></div>
    <footer class="al-foot"><span class="al-msg"></span><span class="al-inst"></span></footer>`;
  const q = (s) => el.querySelector(s);
  const chips = q('.al-chips'), nav = q('.al-nav'), stage = q('.al-stage'), msg = q('.al-msg'), inst = q('.al-inst');
  q('.al-close').addEventListener('click', () => game.openPanel('ailive'));

  const mkChip = (label) => { const c = h('span', 'al-chip', `<i></i><b>${label}</b><em></em>`); chips.appendChild(c); return { c, em: c.querySelector('em') }; };
  const chCable = mkChip('INTERFACE'), chKey = mkChip('KEY'), chEng = mkChip('ENGINE'), chBat = mkChip('BATTERY'), chChg = mkChip('CHARGER');
  if (direct) for (const ch of [chCable, chKey, chBat, chChg]) ch.c.remove();
  const setChip = (ch, text, tone) => { txt(ch.em, text); ch.c.dataset.tone = tone; };

  const navBtns = {};
  for (const [id, label] of pages) { const b = h('button', 'al-navbtn', `<span>${label}</span>`); b.addEventListener('click', () => go(id)); nav.appendChild(b); navBtns[id] = b; }
  nav.appendChild(h('div', 'al-navnote', 'Original shop software for this game. Not affiliated with any real tuning product.'));

  const pageEl = {};
  function go(id) {
    if (!pages.some(([page]) => page === id)) return;
    ctl.page = id; game.state.ailivePage = id;
    for (const [pid] of pages) { toggleClass(navBtns[pid], 'on', pid === id); if (pageEl[pid]) show(pageEl[pid].root, pid === id, 'flex'); }
    if (!pageEl[id]) { pageEl[id] = BUILD[id](); stage.appendChild(pageEl[id].root); show(pageEl[id].root, true, 'flex'); }
    pageEl[id].refresh && pageEl[id].refresh(true);
  }

  const status = (kind, text) => `<span class="al-pill ${kind}">${text}</span>`;
  const btn = (label, cls = '') => h('button', cls, label);

  // ------------------------------------------------------------------ CONNECT
  function buildConnect() {
    const root = h('div', 'al-page al-connect');
    root.innerHTML = `
      <div class="al-col main"><h2>Procedure</h2><p class="al-sub">Do these in order. AI Live checks each one against the truck as it is right now.</p><ol class="al-steps"></ol></div>
      <div class="al-col side">
        <div class="al-card"><h3>Interface cable</h3><div class="al-big" data-r="cable"></div><p class="al-note">In the shop the interface cable plugs into the <b>OBD-II port under the left side of the dash</b>. Use the laptop cart and the cable end to plug it in. The button below is for testing.</p><button class="plug"></button></div>
        <div class="al-card"><h3>Battery charger</h3><div class="al-big" data-r="charger"></div><p class="al-note">Shops clip a charger to the batteries before flashing so the voltage cannot sag. Without it the battery falls about 0.02 V every second of the write, and below ${FLASH.batteryFailV.toFixed(1)} V the write fails.</p><button class="chg"></button></div>
        <div class="al-card"><h3>Battery voltage</h3><div class="al-volts"><b data-r="volts"></b><span>V</span></div><div class="al-vbar"><i data-r="vfill"></i><u style="left:${((FLASH.batteryFailV - 11) / 3) * 100}%"></u></div><div class="al-vscale"><span>11 V</span><span>write fails below ${FLASH.batteryFailV.toFixed(1)} V</span><span>14 V</span></div></div>
      </div>`;
    const ol = root.querySelector('.al-steps'); const r = (k) => root.querySelector(`[data-r="${k}"]`);
    const plug = root.querySelector('.plug'), chg = root.querySelector('.chg');
    plug.addEventListener('click', () => { ai.plug(!ai.cable); ctl.refreshNow(); });
    chg.addEventListener('click', () => { ai.setCharger(!ai.charger); ctl.refreshNow(); });
    let sig = '';
    return {
      root,
      refresh() {
        const e = envNow(); const steps = procedureSteps(ai, e);
        const s = steps.map((x) => `${x.id}${x.state}${x.detail}`).join('|');
        if (s !== sig) {
          sig = s; ol.innerHTML = '';
          steps.forEach((x, i) => {
            const li = h('li', `st ${x.state}`);
            li.innerHTML = `<span class="n">${x.state === 'done' ? '&#10003;' : x.optional ? '+' : i}</span><div><b>${x.title}${x.optional ? ' <em>recommended</em>' : ''}</b><small>${esc(x.detail)}</small></div>`;
            ol.appendChild(li);
          });
        }
        r('cable').innerHTML = ai.cable ? status('ok', 'PLUGGED IN') : status('bad', 'NOT CONNECTED');
        r('charger').innerHTML = ai.charger ? status('ok', 'CONNECTED') : status('warn', 'NOT CONNECTED');
        plug.textContent = ai.cable ? 'Unplug the interface (test)' : 'Plug in the interface (test)';
        chg.textContent = ai.charger ? 'Remove the charger' : 'Connect the charger';
        txt(r('volts'), ai.volts.toFixed(2));
        const f = r('vfill'); f.style.width = `${Math.max(0, Math.min(1, (ai.volts - 11) / 3)) * 100}%`; f.dataset.tone = ai.volts < FLASH.batteryFailV + 0.1 ? 'bad' : ai.volts < 12.3 ? 'warn' : 'ok';
      },
    };
  }

  // ------------------------------------------------------------------ TRUCK
  function buildTruck() {
    const root = h('div', 'al-page al-truck');
    root.innerHTML = `
      <div class="al-banner" data-r="banner"></div>
      <div class="al-actions">
        <div class="al-act" data-a="read"><div class="hd"><b>1 &middot; READ</b><span data-r="readstat"></span></div><p>Reads the tune that is in the truck now.</p><div class="bar-slot"></div><button class="primary go">READ TRUCK</button></div>
        <div class="al-act" data-a="backup"><div class="hd"><b>2 &middot; SAVE BACKUP</b><span data-r="bkstat"></span></div><p>Saves a copy of what was read. Required before the first write.</p><div class="bar-slot"></div><button class="primary go">SAVE BACKUP</button></div>
        <div class="al-act" data-a="write"><div class="hd"><b>3 &middot; WRITE</b><span data-r="wrstat"></span></div><p data-r="wrdesc"></p><div class="bar-slot"></div><div class="wrrow"><select class="sel"></select><button class="primary go">WRITE TUNE</button></div></div>
      </div>
      <div class="al-split">
        <div class="al-col">
          <div class="al-card guide"><h3>What to do now</h3><div class="al-next" data-r="next"></div><div class="al-checks" data-r="checks"></div></div>
          <div class="al-card" data-r="failbox"><h3>Failed write: what it means</h3><p>If the key is turned off, the cable is unplugged, the engine is started, or the battery sags below ${FLASH.batteryFailV.toFixed(1)} V during a write, the ECM is left half-programmed. The truck then will not start: the cluster stays dark or flickers.</p><p><b>Recovery:</b> plug the interface in, key to RUN with the engine off (the charger helps), choose any tune, and press WRITE. No read or backup is needed in recovery mode. After the write, cycle the key.</p></div>
        </div>
        <div class="al-col"><div class="al-card console"><h3>Log</h3><div class="al-log" data-r="log"></div></div></div>
      </div>`;
    const r = (k) => root.querySelector(`[data-r="${k}"]`);
    const act = (a) => root.querySelector(`[data-a="${a}"]`);
    const bars = {};
    for (const a of ['read', 'backup', 'write']) { bars[a] = makeBar('al-progress'); act(a).querySelector('.bar-slot').appendChild(bars[a].root); bars[a].root.appendChild(h('span', 'pct', '0 %')); }
    const sel = root.querySelector('.sel');
    for (const id of TUNE_ORDER) sel.appendChild(h('option', null, `${TEMPLATES[id].position ? 'Pos ' + TEMPLATES[id].position + ' · ' : ''}${TEMPLATES[id].name}`)).value = id;
    sel.addEventListener('change', () => { ai.select(sel.value); ctl.refreshNow(); });
    act('read').querySelector('.go').addEventListener('click', () => { ai.read(envNow()); ctl.refreshNow(); });
    act('backup').querySelector('.go').addEventListener('click', () => { ai.saveBackup(envNow()); ctl.refreshNow(); });
    act('write').querySelector('.go').addEventListener('click', () => { ai.write(envNow(), ai.selected); ctl.refreshNow(); });
    let logN = -1, checkSig = '';
    return {
      root,
      refresh() {
        const e = envNow();
        const busy = ['reading', 'backing', 'writing'].includes(ai.stage);
        const setBar = (a, active, doneState, label) => { const b = bars[a]; const v = active ? ai.progress : doneState ? 1 : 0; b.set(v, active ? 'run' : doneState ? 'done' : ''); b.root.querySelector('.pct').textContent = active ? `${Math.round(v * 100)} %` : doneState ? 'DONE' : '0 %'; };
        setBar('read', ai.stage === 'reading', ai.readTune != null);
        setBar('backup', ai.stage === 'backing', ai.backup);
        setBar('write', ai.stage === 'writing', ai.stage === 'writeDone');
        r('readstat').innerHTML = ai.stage === 'reading' ? status('warn', 'READING') : ai.readTune != null ? status('ok', `READ: ${esc(ai.readTune)}`) : status('', 'not read');
        r('bkstat').innerHTML = ai.stage === 'backing' ? status('warn', 'SAVING') : ai.backup ? status('ok', 'BACKUP SAVED') : status('warn', 'REQUIRED');
        r('wrstat').innerHTML = ai.stage === 'writing' ? status('warn', `WRITING ${esc(ai.writing || '')}`) : ai.stage === 'writeDone' ? status('ok', 'WRITE COMPLETE') : ai.bricked ? status('bad', 'NO START') : status('', 'idle');
        const t = TEMPLATES[ai.selected];
        txt(r('wrdesc'), `Writes "${t.name}"${t.position ? ` (position ${t.position})` : ''}: fuel, timing, rail, boost and vane tables, smoke and torque limiters, Allison shift points and lockup. About ${FLASH.writeSeconds} s here; a real flash takes several minutes.`);
        if (sel.value !== ai.selected && document.activeElement !== sel) sel.value = ai.selected;
        const ck = ai.canWrite(e); const rd = ai.canRead(e);
        act('read').querySelector('.go').disabled = !rd;
        act('backup').querySelector('.go').disabled = busy || ai.readTune == null || !ai.cable || e.keyPos !== 2 || e.engineRunning;
        act('write').querySelector('.go').disabled = !ck.ok;
        act('write').querySelector('.go').title = ck.ok ? '' : ck.why; act('read').querySelector('.go').title = rd ? '' : 'Plug in the cable and turn the key to RUN with the engine off.';
        sel.disabled = busy;
        // banner
        const bn = r('banner');
        if (ai.stage === 'writing') { bn.className = 'al-banner bad big'; bn.innerHTML = `<div><b>WRITING ${esc(TEMPLATES[ai.writing] ? TEMPLATES[ai.writing].name.toUpperCase() : '')}: ${Math.round(ai.progress * 100)} %</b><span>${fmtClock(writeRemainingSec(ai))} remaining</span></div><p>Do NOT touch the key. Do NOT unplug the cable. Do NOT start the engine. Keep the charger connected (battery ${ai.volts.toFixed(1)} V).</p>`; }
        else if (ai.bricked) { bn.className = 'al-banner bad'; bn.innerHTML = `<div><b>WRITE FAILED: NO START</b></div><p>${esc(ai.message || 'The ECM is in an incomplete state.')} The cluster is dark or flickering and the engine will not start. Write a tune to recover.</p>`; }
        else if (ai.needsKeyCycle) { bn.className = 'al-banner ok'; bn.innerHTML = `<div><b>WRITE COMPLETE</b></div><p>Turn the key off, wait for the cluster to go dark, turn it back to RUN and start the engine. The new calibration loads on that key cycle.</p>`; }
        else { bn.className = 'al-banner hidden'; bn.innerHTML = ''; }
        const nx = nextStep(ai, e); const nel = r('next'); nel.className = `al-next ${nx.tone}`; txt(nel, nx.text);
        const steps = procedureSteps(ai, e); const cs = steps.map((x) => x.state).join();
        if (cs !== checkSig) { checkSig = cs; r('checks').innerHTML = steps.map((x, i) => `<span class="mini ${x.state}" title="${esc(x.title)}">${x.state === 'done' ? '&#10003;' : x.optional ? '+' : i}</span>`).join('<i></i>'); }
        r('failbox').style.display = ai.bricked ? '' : 'none';
        if (ai.log.length !== logN) { logN = ai.log.length; const lg = r('log'); lg.innerHTML = ai.log.slice(-40).map((l) => `<div>${esc(l)}</div>`).join(''); lg.scrollTop = lg.scrollHeight; }
      },
    };
  }

  // ------------------------------------------------------------------ QUICK TUNES
  function buildTunes() {
    const root = h('div', 'al-page al-tunes');
    root.innerHTML = `<div class="al-ph"><div><h2>Quick tunes</h2><p class="al-sub">The stock calibration plus the five positions of the owner's switchable LLY tune. Gains are rear-wheel horsepower on a chassis dyno.</p></div><div class="reg" data-r="reg"></div></div><div class="al-cards"></div>`;
    const wrap = root.querySelector('.al-cards'); const cards = {};
    for (const id of TUNE_ORDER) {
      const c = tuneCard(id, plant.pp.regulator);
      const d = h('div', 'al-tune');
      d.innerHTML = `<div class="th"><span class="pos">${c.position ? 'POSITION ' + c.position : 'FACTORY'}</span><span class="badges"></span></div>
        <h3>${esc(c.name)}</h3><p class="ds">${esc(c.desc)}</p>
        <div class="gain"><b>${c.gainText}</b><small>${esc(c.gainSub)}</small></div>
        <ul class="risks">${c.risks.map(([k, t]) => `<li><em>${esc(k)}</em>${esc(t)}</li>`).join('')}</ul>
        <div class="regnote"></div>
        <div class="tb"><button class="sel">Select</button><button class="primary wr">${direct ? 'APPLY TUNE' : 'WRITE THIS TUNE'}</button></div>`;
      d.querySelector('.sel').addEventListener('click', () => { ai.select(id); ctl.refreshNow(); });
      d.querySelector('.wr').addEventListener('click', () => { ai.select(id); ai.write(envNow(), id); if (ai.stage === 'writing') go('truck'); else ctl.refreshNow(); });
      wrap.appendChild(d); cards[id] = d;
    }
    const regEl = root.querySelector('[data-r="reg"]'); let regSig = '';
    return {
      root,
      refresh() {
        const e = envNow(); const reg = plant.pp.regulator;
        regEl.innerHTML = `<small>FUEL PRESSURE REGULATOR</small><b class="${reg === 'LBZ' ? 'ok' : 'warn'}">${reg === 'LBZ' ? 'LBZ' : 'LLY (stock)'}</b>`;
        const pending = ai.pendingApply ? ai.pendingApply.tune : null;
        for (const id of TUNE_ORDER) {
          const d = cards[id]; const c = tuneCard(id, reg);
          const badges = [];
          if (ai.installed === id) badges.push('<i class="bd inst">INSTALLED</i>');
          if (pending === id) badges.push(`<i class="bd pend">${direct ? 'APPLYING' : 'LOADS ON KEY CYCLE'}</i>`);
          if (ai.stage === 'writing' && ai.writing === id) badges.push('<i class="bd pend">WRITING</i>');
          const bsig = badges.join(''); const bx = d.querySelector('.badges'); if (bx.dataset.s !== bsig) { bx.dataset.s = bsig; bx.innerHTML = bsig; }
          toggleClass(d, 'selected', ai.selected === id); toggleClass(d, 'installed', ai.installed === id);
          const rn = d.querySelector('.regnote'); const rs = c.regNote ? c.regNote.level + c.regNote.text : '';
          if (rn.dataset.s !== rs) { rn.dataset.s = rs; rn.className = `regnote ${c.regNote ? c.regNote.level : ''}`; rn.innerHTML = c.regNote ? `<b>${esc(c.regNote.text)}</b>${c.regNote.detail ? `<span>${esc(c.regNote.detail)}</span>` : ''}` : ''; }
          const wr = d.querySelector('.wr'); const cw = ai.canWrite(e); wr.disabled = !cw.ok; wr.title = cw.ok ? (direct ? 'Apply this tune now' : 'Write this tune to the truck') : cw.why;
          d.querySelector('.sel').textContent = ai.selected === id ? 'Selected' : 'Select';
        }
      },
    };
  }

  // ------------------------------------------------------------------ TURBO SOUND
  function buildSound() {
    const root = h('div', 'al-page al-sound');
    const lim = spec.turbo.overspeedRpm;
    root.innerHTML = `
      <div class="al-col main">
        <div class="al-ph"><div><h2>Turbo sound</h2><p class="al-sub">Vane position at idle and light load. ${esc(spec.turbo.model)} variable-geometry turbine. Applies on top of the selected tune.</p></div><span class="al-pill warn" data-r="dirty" style="display:none">${direct ? 'UNAPPLIED CHANGES' : 'UNWRITTEN CHANGES'}</span></div>
        <div class="al-card sl"><div class="lab"><b>Idle / light-load vane closing</b><output data-r="closeV">0 %</output></div>
          <input type="range" min="0" max="100" step="1" value="0" data-r="close"><div class="ends"><span>tune's own vane setting</span><span>closed limit (${Math.round(spec.turbo.vaneMaxClosed * 100)} %)</span></div>
          <p class="al-note">0 % leaves the vanes where the tune puts them. 100 % closes them all the way to the limit of the usable travel at idle and light load. More closed means a faster turbine at the same exhaust flow: higher shaft speed, more whistle.</p></div>
        <div class="al-card sl"><div class="lab"><b>Hold closed as throttle comes in</b><output data-r="holdV">0 %</output></div>
          <input type="range" min="0" max="100" step="1" value="0" data-r="hold"><div class="ends"><span>opens as soon as you get on it</span><span>stays closed at full throttle</span></div>
          <p class="al-note">Shapes the spool-up hiss. Holding the vanes closed under load adds back pressure and exhaust temperature, and can push the turbo past its ${thousands(lim)} rpm limit.</p></div>
        <div class="al-card"><div class="al-btnrow"><button class="reset">Reset to the tune's values</button><label class="al-chk"><input type="checkbox" class="prev"><span>Preview (live) on the running truck</span></label></div>
          <p class="al-note">${direct ? 'Adjust the sliders, then use Apply tune in Quick Tunes to save them. Preview lets you hear the staged settings immediately.' : 'Changes are staged here and apply when the tune is written (then the key is cycled). <b>Preview</b> puts the staged values on the engine right now so you can hear and measure them in the shop. It is for testing: the truck keeps the written values after a key cycle.'}</p></div>
        <div class="al-card warnbox"><h3>What it costs</h3><p>Closing the vanes raises exhaust back pressure and exhaust gas temperature and costs a little efficiency. Light settings that only add whistle at idle and cruise are safe. Too much at high load overspeeds the turbo (limit ${thousands(lim)} rpm; more than ${spec.turbo.overspeedHoldS} s above it damages the wheel) or overheats it, and the turbo can fail.</p></div>
      </div>
      <div class="al-col side">
        <div class="al-card live"><h3>Live turbo <span data-r="state"></span></h3>
          <div class="gx" data-g="vane"><label>Vane position</label><div class="gb"><i></i><u style="left:${spec.turbo.vaneMaxClosed * 100}%"></u></div><b></b></div>
          <div class="gx" data-g="spd"><label>Turbo shaft speed</label><div class="gb"><i></i><u style="left:${(lim / 150000) * 100}%" class="red"></u></div><b></b></div>
          <div class="gx" data-g="boost"><label>Boost</label><div class="gb"><i></i></div><b></b></div>
          <div class="gx" data-g="drive"><label>Drive pressure</label><div class="gb"><i></i></div><b></b></div>
          <div class="gx" data-g="egt"><label>EGT (pre-turbo)</label><div class="gb"><i></i><u style="left:${(spec.limits.egtPistonDamageF / 2000) * 100}%" class="red"></u></div><b></b></div>
          <p class="al-note" data-r="livenote"></p></div>
        <div class="al-card"><h3>Installed on the truck</h3><div class="kv" data-r="kv"></div></div>
      </div>`;
    const r = (k) => root.querySelector(`[data-r="${k}"]`);
    const sC = r('close'), sH = r('hold');
    const push = () => { ai.setSound(sC.value / 100, sH.value / 100); ctl.refreshNow(); };
    sC.addEventListener('input', push); sH.addEventListener('input', push);
    root.querySelector('.reset').addEventListener('click', () => { ai.resetSound(ai.selected); ctl.refreshNow(); });
    const prev = root.querySelector('.prev');
    prev.addEventListener('change', () => { ctl.setPreview(prev.checked); ctl.refreshNow(); });
    const G = (g) => ({ fill: root.querySelector(`[data-g="${g}"] i`), val: root.querySelector(`[data-g="${g}"] b`), row: root.querySelector(`[data-g="${g}"]`) });
    const gs = { vane: G('vane'), spd: G('spd'), boost: G('boost'), drive: G('drive'), egt: G('egt') };
    const setG = (g, f, text, tone) => { g.fill.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; txt(g.val, text); g.row.dataset.tone = tone || ''; };
    return {
      root,
      refresh() {
        if (document.activeElement !== sC) sC.value = Math.round(ai.sound.close * 100);
        if (document.activeElement !== sH) sH.value = Math.round(ai.sound.hold * 100);
        txt(r('closeV'), `${Math.round(ai.sound.close * 100)} %`); txt(r('holdV'), `${Math.round(ai.sound.hold * 100)} %`);
        show(r('dirty'), soundDirty(ai), 'inline-block');
        if (prev.checked !== ctl.preview) prev.checked = ctl.preview;
        const o = plant.out || {}; const run = plant.running;
        const egt = o.egtPreK ? kToF(o.egtPreK) : 0; const tr = o.turboRpm || 0;
        setG(gs.vane, (o.vane || 0), `${Math.round((o.vane || 0) * 100)} %`, '');
        setG(gs.spd, tr / 150000, `${(tr / 1000).toFixed(1)} krpm`, tr > lim ? 'bad' : tr > lim * 0.92 ? 'warn' : '');
        setG(gs.boost, (o.boostPsi || 0) / 45, `${(o.boostPsi || 0).toFixed(1)} psi`, '');
        setG(gs.drive, (o.driveKpa || 0) / 450, `${Math.round(o.driveKpa || 0)} kPa`, '');
        setG(gs.egt, egt / 2000, `${Math.round(egt)} °F`, egt > spec.limits.egtPistonDamageF ? 'bad' : egt > 1500 ? 'warn' : '');
        txt(r('state'), run ? (ctl.preview ? 'ENGINE RUNNING · PREVIEW' : 'ENGINE RUNNING') : 'ENGINE OFF');
        r('state').className = run ? 'on' : '';
        txt(r('livenote'), run ? 'Move the sliders with Preview on and watch the shaft speed, drive pressure and EGT follow.' : 'Start the engine to see the turbo live. Without the engine the values show the resting state.');
        const w = writtenSound(ai); const applied = plant.pp.sound;
        r('kv').innerHTML = `<div><span>Tune</span><b>${esc((TEMPLATES[ai.installed] || {}).name || ai.installed)}</b></div><div><span>Written vane closing</span><b>${Math.round(w.close * 100)} % / hold ${Math.round(w.hold * 100)} %</b></div><div><span>On the engine now</span><b>${Math.round((applied.close || 0) * 100)} % / hold ${Math.round((applied.hold || 0) * 100)} %</b></div><div><span>Overspeed limit</span><b>${thousands(lim)} rpm</b></div>`;
      },
    };
  }

  // ------------------------------------------------------------------ DATALOG
  function buildDatalog() {
    const root = h('div', 'al-page al-datalog');
    root.innerHTML = `<div class="al-ph"><div><h2>Datalog</h2><p class="al-sub">Recorded during every dyno pull at 20 Hz. Each channel is scaled to its own range; move the mouse over the chart to read values.</p></div>
      <div class="dl-ctl"><select class="runsel"></select><a class="csv" href="#">Download CSV</a></div></div>
      <div class="dl-body"><div class="dl-chart"><canvas></canvas></div><div class="dl-chs"></div></div>`;
    const sel = root.querySelector('.runsel'), csv = root.querySelector('.csv'), canvas = root.querySelector('canvas'), chs = root.querySelector('.dl-chs'), box = root.querySelector('.dl-chart');
    for (const c of LOG_CHANNELS) {
      const l = h('label', 'dl-ch', `<input type="checkbox" ${ctl.logChecked.has(c.key) ? 'checked' : ''}><i style="background:${c.color}"></i><span>${esc(c.label)}<small>${esc(c.unit)}</small></span>`);
      l.querySelector('input').addEventListener('change', (e) => { if (e.target.checked) ctl.logChecked.add(c.key); else ctl.logChecked.delete(c.key); sig = ''; ctl.refreshNow(); });
      chs.appendChild(l);
    }
    sel.addEventListener('change', () => { ctl.logRunId = +sel.value; sig = ''; ctl.cursor = null; ctl.refreshNow(); });
    let sig = '', lastRows = [], lastDims = null;
    const draw = () => {
      const w = Math.max(360, box.clientWidth - 2 || 640), hgt = Math.max(240, box.clientHeight - 2 || 360);
      const ctx = fitCanvas(canvas, w, hgt);
      const run = dyno.runs.find((x) => x.id === ctl.logRunId);
      lastRows = run ? run.log : [];
      const channels = LOG_CHANNELS.filter((c) => ctl.logChecked.has(c.key));
      lastDims = drawMultiChannel(ctx, w, hgt, { rows: lastRows, channels, cursor: ctl.cursor, title: run ? `RUN ${run.id}  ${run.tuneName} · ${run.regulator} reg` : '' });
    };
    canvas.addEventListener('mousemove', (e) => {
      if (!lastDims || !lastRows.length) return;
      const rc = canvas.getBoundingClientRect(); const x = e.clientX - rc.left;
      const t = lastDims.t0 + ((x - lastDims.pl) / (lastDims.pr - lastDims.pl)) * (lastDims.t1 - lastDims.t0);
      let best = 0, bd = 1e9; lastRows.forEach((r, i) => { const d = Math.abs(r.t - t); if (d < bd) { bd = d; best = i; } });
      if (best !== ctl.cursor) { ctl.cursor = best; draw(); }
    });
    canvas.addEventListener('mouseleave', () => { ctl.cursor = null; draw(); });
    return {
      root,
      refresh(force) {
        const runs = dyno.runs.filter((r) => !r.invalid && r.log && r.log.length);
        const rs = runs.map((r) => r.id).join(',');
        if (sel.dataset.s !== rs) { sel.dataset.s = rs; sel.innerHTML = runs.map((r) => `<option value="${r.id}">Run ${r.id}: ${esc(r.tuneName)} (${esc(r.regulator)} reg, ${r.peakHp.toFixed(0)} whp)</option>`).join('') || '<option value="">No runs yet</option>'; if (!runs.find((r) => r.id === ctl.logRunId)) ctl.logRunId = runs.length ? runs[runs.length - 1].id : null; sig = ''; }
        if (ctl.logRunId != null && sel.value !== String(ctl.logRunId)) sel.value = String(ctl.logRunId);
        const run = runs.find((r) => r.id === ctl.logRunId);
        const w = box.clientWidth;
        const s = `${ctl.logRunId}|${run ? run.log.length : 0}|${[...ctl.logChecked].join()}|${w}`;
        if (force || s !== sig) { sig = s; draw(); }
        if (run && ctl.csvRun !== run.id) {
          if (ctl.csvUrl) URL.revokeObjectURL(ctl.csvUrl);
          ctl.csvUrl = URL.createObjectURL(new Blob([logToCsv(run)], { type: 'text/csv' })); ctl.csvRun = run.id;
          csv.href = ctl.csvUrl; csv.download = csvName(run);
        }
        toggleClass(csv, 'off', !run);
      },
    };
  }

  // ------------------------------------------------------------------ COMPARE
  function buildCompare() {
    const root = h('div', 'al-page al-compare');
    root.innerHTML = `<div class="al-ph"><div><h2>Compare</h2><p class="al-sub">The stock baseline against a run with a tune. Same dyno, same gear, corrected to the same conditions.</p></div><div class="dl-ctl"><select class="runsel"></select></div></div>
      <div class="cmp-top"><div class="cmp-graph"><canvas></canvas></div><div class="cmp-gain" data-r="gain"></div></div>
      <div class="cmp-table"></div>`;
    const sel = root.querySelector('.runsel'), canvas = root.querySelector('canvas'), box = root.querySelector('.cmp-graph'), table = root.querySelector('.cmp-table'), gain = root.querySelector('[data-r="gain"]');
    sel.addEventListener('change', () => { ctl.cmpRunId = +sel.value; sig = ''; ctl.refreshNow(); });
    let sig = '';
    return {
      root,
      refresh(force) {
        const runs = dyno.runs.filter((r) => !r.invalid); const base = findBaseline(runs);
        const others = runs.filter((r) => !base || r.id !== base.id);
        const os = others.map((r) => r.id).join(',');
        if (sel.dataset.s !== os) { sel.dataset.s = os; sel.innerHTML = others.map((r) => `<option value="${r.id}">Run ${r.id}: ${esc(r.tuneName)} (${esc(r.regulator)} reg)</option>`).join('') || '<option value="">No other runs</option>'; if (!others.find((r) => r.id === ctl.cmpRunId)) ctl.cmpRunId = others.length ? others[others.length - 1].id : null; sig = ''; }
        if (ctl.cmpRunId != null && sel.value !== String(ctl.cmpRunId)) sel.value = String(ctl.cmpRunId);
        const w = Math.max(360, box.clientWidth - 2 || 640), hgt = Math.max(240, box.clientHeight - 2 || 300);
        const s = `${runs.length}|${ctl.cmpRunId}|${base ? base.id : 0}|${w}`;
        if (!force && s === sig) return; sig = s;
        const run = runs.find((r) => r.id === ctl.cmpRunId);
        const ctx = fitCanvas(canvas, w, hgt);
        drawDynoGraph(ctx, w, hgt, { runs: run ? [run] : [], baseline: base, selectedIds: run ? [run.id] : [], showTorque: true, weather: plant.air });
        if (base && run) {
          const dh = run.peakHp - base.peakHp, dt = run.peakTq - base.peakTq;
          gain.innerHTML = `<small>${esc(run.tuneName)} vs STOCK BASELINE</small><b class="${dh >= 0 ? 'ok' : 'bad'}">${signed(dh, 1)} <u>whp</u></b><b class="${dt >= 0 ? 'ok' : 'bad'}">${signed(dt, 0)} <u>lb-ft</u></b><span>${(dh / base.peakHp * 100).toFixed(1)} % more wheel power &middot; vanes ${Math.round((run.vane || {}).close * 100 || 0)} % / hold ${Math.round((run.vane || {}).hold * 100 || 0)} % &middot; ${esc(run.regulator)} regulator</span>`;
        } else gain.innerHTML = `<small>NO COMPARISON YET</small><span>${base ? 'Make a pull with another tune.' : 'Make a pull with the stock tune first: it becomes the baseline.'}</span>`;
        const rows = compareRows(runs);
        table.innerHTML = rows.length ? `<table><thead><tr><th></th><th>Run</th><th>Tune</th><th>Regulator</th><th>Peak whp</th><th>Peak lb-ft</th><th>vs stock</th><th>Vane close / hold</th><th>Max EGT</th><th>Boost</th><th>Rail error</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr class="${x.isBase ? 'base' : ''}"><td><i style="background:${x.isBase ? '#8d96a3' : runColor({ id: x.id })}"></i></td><td>${x.id}</td><td>${esc(x.tune)}${x.isBase ? ' <em>baseline</em>' : ''}</td><td>${esc(x.regulator)}</td><td><b>${x.peakHp.toFixed(1)}</b> <small>@ ${thousands(x.peakHpRpm)}</small></td><td><b>${Math.round(x.peakTq)}</b> <small>@ ${thousands(x.peakTqRpm)}</small></td><td>${x.dHp == null ? '' : `<span class="${x.dHp >= 0 ? 'ok' : 'bad'}">${signed(x.dHp, 1)} whp, ${signed(x.dTq, 0)} lb-ft</span>`}</td><td>${Math.round(x.vane.close * 100)} % / ${Math.round(x.vane.hold * 100)} %</td><td>${thousands(x.maxEgtF)} °F</td><td>${x.maxBoostPsi.toFixed(1)} psi</td><td>${Math.round(x.railErrPsi)} psi</td><td>${x.failed.length ? `<span class="bad">${esc(x.failed.join(', '))} failed</span>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="al-sub">No runs yet. Use the dyno (key T).</p>';
      },
    };
  }

  const BUILD = { connect: buildConnect, truck: buildTruck, tunes: buildTunes, sound: buildSound, datalog: buildDatalog, compare: buildCompare };

  // ------------------------------------------------------------------ shell
  ctl.refreshNow = () => { shell(); const p = pageEl[ctl.page]; if (p && p.refresh) p.refresh(); };
  function shell() {
    const e = envNow();
    setChip(chCable, ai.cable ? 'PLUGGED' : 'OFF', ai.cable ? 'ok' : 'bad');
    const kn = ['LOCK', 'ACC', 'RUN', 'START'][e.keyPos] || '?';
    setChip(chKey, kn, e.keyPos === 2 && !e.engineRunning ? 'ok' : e.keyPos >= 2 ? 'warn' : 'bad');
    setChip(chEng, e.engineRunning ? 'RUNNING' : 'OFF', e.engineRunning && !direct ? 'warn' : 'ok');
    setChip(chBat, `${ai.volts.toFixed(1)} V`, ai.volts < FLASH.batteryFailV + 0.1 ? 'bad' : ai.volts < 12.3 ? 'warn' : 'ok');
    setChip(chChg, ai.charger ? 'ON' : 'OFF', ai.charger ? 'ok' : 'warn');
    txt(msg, ai.message || 'Ready.');
    const t = TEMPLATES[ai.installed];
    txt(inst, `Installed: ${t ? t.name : ai.installed}${ai.pendingApply ? (direct ? ' · applying tune' : ' · new tune loads on key cycle') : ''}  ·  Regulator: ${plant.pp.regulator}`);
    el.dataset.bricked = ai.bricked ? '1' : '';
  }

  ctl.setPreview = (on) => { ctl.preview = on; if (on) plant.pp.sound = ai.sound; else plant.pp.sound = ctl.applied; };
  // the game applied a written tune on a key cycle: this is now what the engine really has
  ctl.setApplied = (sound) => { ctl.applied = { ...sound }; ctl.preview = false; plant.pp.sound = ctl.applied; };

  const api = {
    el, state: ctl, go,
    open() { ctl.open = true; el.style.display = 'flex'; go(ctl.page); shell(); },
    close() { ctl.open = false; el.style.display = 'none'; },
    // always called, panel open or not: keeps the Preview in step with the staged values
    tick() { if (ctl.preview) plant.pp.sound = ai.sound; },
    update(dt) {
      ctl.acc += dt; if (ctl.acc < 0.1) return; ctl.acc = 0;
      shell(); const p = pageEl[ctl.page]; if (p && p.refresh) p.refresh();
    },
    setApplied: ctl.setApplied,
  };
  el.style.display = 'none';
  game.state.ailivePage = ctl.page;
  return api;
}
