// The bench page's control bar: engine On/Off, RPM, throttle, views, quality, panel buttons and sound.
// createKeyControl has no DOM in it, so the unit tests drive the same key logic the automatic start uses.
import { KEY } from '../sim/startSequence.js';
import { QUALITY_ORDER } from '../core/quality.js';

const START_HOLD_MAX_S = 16; // the cab key lets go after this long too (the ignition itself stops cranking at 15 s)

// The ignition key. It calls ign.setKey and ign.releaseStart with the arguments the cab ignition passes
// (src/truck/interior/controls.js, ctxArgs): the coolant temperature and the shifter position.
export function createKeyControl(host) {
  const ig = host.ign;
  const args = () => ({ coolantF: host.state.coolantF ?? 70, range: host.state.range ?? 'P' });
  let held = false, attempt = 0;
  const release = () => { held = false; attempt++; ig.releaseStart(); };
  return {
    args,
    get held() { return held; },
    off() { held = false; attempt++; ig.setKey(KEY.LOCK, args()); },
    // RUN from OFF; from START it is the key springing back
    run() { if (ig.key === KEY.START) { release(); return; } if (ig.key < KEY.RUN) ig.setKey(KEY.RUN, args()); },
    // START is spring-loaded: it is held until the engine fires, the starter gives up, or startRelease()
    startPress() {
      ig.setKey(KEY.START, args());
      if (ig.key !== KEY.START) { if (host.ui) host.ui.say(ig.message || 'The engine will not crank.', 5); return false; }
      held = true; const currentAttempt = ++attempt; let t = 0;
      host.animate((dt) => { if (currentAttempt !== attempt) return true; t += dt; if (!held || ig.engineRunning || !ig.cranking || t > START_HOLD_MAX_S) { release(); return true; } return false; });
      return true;
    },
    startRelease() { if (held || ig.key === KEY.START) release(); },
  };
}

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const group = (label, ...kids) => el('div', { className: 'bc-group' }, el('span', { className: 'bc-lab', textContent: label }), ...kids);

// Builds the bar into `root` and returns { sync, update }: sync after a state change, update a few times a second.
export function buildControls(host, root) {
  const ig = host.ign, views = host.views;
  const on = (b, f) => { b.addEventListener('click', f); return b; };

  const engine = on(el('button', { className: 'bc-engine' }), () => host.toggleEngine());
  const rpm = el('b', { className: 'bc-rpm', textContent: '0' });

  // ---- throttle ----
  const pedal = el('input', { type: 'range', min: 0, max: 100, step: 1, value: 0, title: 'Accelerator pedal' });
  const pedalOut = el('output', { textContent: '0 %' });
  pedal.addEventListener('input', () => { host.setPedal(+pedal.value / 100); pedalOut.textContent = `${pedal.value} %`; });

  // ---- views ----
  const viewBtns = Object.keys(views).map((k, i) => { const b = on(el('button', { textContent: views[k].label, title: `Key ${i + 1}` }), () => host.setView(k)); b.dataset.view = k; return b; });

  // ---- panels ----
  const panelBtns = [['dyno', 'Dyno', 'T'], ['ailive', 'AI Live', 'L'], ['shop', 'Shop menu', 'M']].map(([id, label, k]) => { const b = on(el('button', { textContent: label, title: `Key ${k}` }), () => host.openPanel(id)); b.dataset.panel = id; return b; });

  // ---- quality and sound ----
  const qual = el('select', { title: 'Graphics quality' });
  for (const q of QUALITY_ORDER) qual.append(el('option', { value: q, textContent: q }));
  qual.addEventListener('change', () => host.setQuality(qual.value));
  const sound = on(el('button', { title: 'Sound on or off' }), () => { host.setSound(host.soundOn === false); sync(); });
  const help = on(el('button', { textContent: '?', title: 'Help (F1)' }), () => host.ui.toggleHelp());

  root.replaceChildren(
    group('Engine', engine, rpm, el('small', { textContent: 'rpm' })),
    group('Throttle', pedal, pedalOut),
    group('View', ...viewBtns),
    group('Panels', ...panelBtns),
    group('Quality', qual, sound, help),
  );

  function sync() {
    viewBtns.forEach((b) => b.classList.toggle('on', b.dataset.view === host.view));
    panelBtns.forEach((b) => b.classList.toggle('on', b.dataset.panel === host.panelOpen));
    if (document.activeElement !== qual) qual.value = host.qname;
    sound.textContent = host.soundOn === false ? 'Sound off' : 'Sound on';
    sound.classList.toggle('on', host.soundOn !== false);
    update();
  }
  let last = '';
  function update() {
    const dyno = host.dynoRunning;
    engine.textContent = host.starting ? 'Starting… · Turn off' : host.engineOn ? 'Turn off' : 'Turn on';
    engine.title = host.engineOn ? 'Turn the engine off' : 'Turn the engine on';
    engine.setAttribute('aria-label', engine.title);
    engine.setAttribute('aria-pressed', String(host.engineOn));
    engine.classList.toggle('on', host.engineOn);
    rpm.textContent = String(Math.round(host.plant.running || ig.cranking ? host.plant.rpm : 0));
    if (pedal.disabled !== dyno) pedal.disabled = dyno;
    if (dyno && pedal.value !== '0') { pedal.value = 0; }
    const shown = dyno ? 'dyno' : `${Math.round(host.pedal * 100)} %`;
    if (shown !== last) { last = shown; pedalOut.textContent = shown; }
    if (document.activeElement !== qual && qual.value !== host.qname) qual.value = host.qname;
  }
  sync();
  return { sync, update, el: { engine, pedal, viewBtns, panelBtns, qual, sound } };
}
