// DOM overlay: crosshair, use prompt, inspection label, message line, help panel (F1), settings, FPS.
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const HELP = [
  ['Move', 'W A S D, Shift run, Ctrl crouch'], ['Look', 'Mouse (click the view to capture it, Esc releases it)'],
  ['Use', 'E: open doors, hood, tailgate; use equipment; sit in the truck'], ['Inspect', 'I: toggle part names and descriptions while pointing'],
  ['Hood', 'Pull the release handle inside the cab (lower left of the wheel), then the secondary release at the grille, then lift. X: engine cutaway'],
  ['Truck', 'Sit in the driver seat (E at an open door). Key: E on the ignition. Hold E for START. Shifter: 1 P, 2 R, 3 N, 4 D'],
  ['Dyno', 'T: dyno panel. Strap the truck, fan on, then Start Run. C: dyno camera while running'],
  ['AI Live', 'L: open the laptop when standing at the cart'], ['Shop menu', 'M: repairs, shop temperature, LBZ regulator'],
  ['Cameras', 'V: driver / walk, O: orbit and photo mode, H hide UI, P save PNG'], ['Help', 'F1: this panel, quality: Q cycles low / medium / high'],
];

// the bench page (src/bench): no walking, so no crosshair, use prompt or part label; its own help text
const BENCH_HELP = [
  ['Engine', 'Select Cutaway to start the engine through its normal glow-plug and cranking sequence'],
  ['Throttle', 'The slider is the accelerator pedal. The dyno takes it over during a run'],
  ['Views', '1 engine, 2 engine alone, 3 cutaway, 4 rear wheels. Drag to look around, wheel to zoom'],
  ['Dyno', 'T: fan on, Start Run. The bench truck is already secured'], ['AI Live', 'L: choose a Quick Tune and Apply tune. No connection setup or key cycle is needed'],
  ['Shop menu', 'M: repairs, LBZ regulator, shop temperature'], ['Help', 'F1: this panel. Esc closes a panel'],
];

export class UI {
  // opts.bench: the bench page's overlay (message line, frame rate and help only)
  constructor(root, opts = {}) {
    this.root = root; this.bench = !!opts.bench;
    this.cross = h('div', 'ui-cross'); this.prompt = h('div', 'ui-prompt'); this.label = h('div', 'ui-label'); this.msg = h('div', 'ui-msg'); this.fps = h('div', 'ui-fps');
    this.help = h('div', 'ui-help'); this.hudWrap = h('div', 'ui-hud');
    this.help.innerHTML = `<h2>Duramax Dyno Shop</h2><p class="sub">2005 Silverado 2500HD, 6.6L Duramax LLY, Allison 1000</p><table>${(this.bench ? BENCH_HELP : HELP).map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table><div class="q">Quality: <b id="qlabel"></b>${this.bench ? '' : ' (Q)'}</div><p class="hint">F1 closes this panel</p>`;
    this.help.style.display = 'none';
    (this.bench ? [this.msg, this.fps, this.help] : [this.cross, this.prompt, this.label, this.msg, this.fps, this.help]).forEach((e) => this.hudWrap.appendChild(e));
    root.appendChild(this.hudWrap);
    this.msgT = 0; this.hidden = false; this.panels = {};
  }
  setQuality(q) { const e = this.help.querySelector('#qlabel'); if (e) e.textContent = q; }
  setPrompt(t) { this.prompt.textContent = t || ''; this.prompt.style.opacity = t ? 1 : 0; }
  setLabel(info) {
    if (!info) { this.label.style.opacity = 0; return; }
    this.label.innerHTML = `<b>${info.name}</b><br>${info.desc || ''}`; this.label.style.opacity = 1;
  }
  say(text, secs = 4.5) { this.msg.textContent = text; this.msg.style.opacity = 1; this.msgT = secs; }
  update(dt) { if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg.style.opacity = 0; } }
  toggleHelp() { this.help.style.display = this.help.style.display === 'none' ? 'block' : 'none'; }
  hideAll(on) { this.hidden = on; this.hudWrap.style.display = on ? 'none' : 'block'; for (const p of Object.values(this.panels)) p.style.visibility = on ? 'hidden' : 'visible'; }
  addPanel(name, el) { this.panels[name] = el; this.root.appendChild(el); return el; }
}
