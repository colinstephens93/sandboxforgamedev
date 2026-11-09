// Truck studio page: the controls and readouts around src/studio/studio.js.
import { Studio, VIEWS, VIEW_ORDER, PARTS } from './studio.js';
import { QUALITY } from '../core/quality.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const studio = new Studio($('view'), (f, m) => { $('loadbar').style.width = `${Math.round(f * 100)}%`; $('loadmsg').textContent = m; });
window.__studio = studio;

function buildUi() {
  const side = $('side'), refresh = [];
  const section = (title) => side.append(el('h3', { textContent: title }));
  const check = (text, get, set, note) => {
    const box = el('input', { type: 'checkbox' }); box.addEventListener('change', () => { set(box.checked); sync(); });
    refresh.push(() => { box.checked = !!get(); });
    const l = el('label', {}, box, el('span', { textContent: text })); if (note) l.append(el('small', { textContent: note }));
    side.append(l); return l;
  };
  const sync = () => refresh.forEach((f) => f());
  studio.onChange = sync;

  section('View');
  const views = el('div', { className: 'row' });
  VIEW_ORDER.forEach((k, i) => {
    const b = el('button', { textContent: VIEWS[k].label, title: `Key ${i + 1}` }); b.addEventListener('click', () => studio.setView(k));
    refresh.push(() => b.classList.toggle('on', studio.view === k)); views.append(b);
  });
  side.append(views);

  section('Parts shown');
  for (const [k, label] of PARTS) {
    const c = studio.parts[k].count;
    check(label, () => studio.parts[k].visible, (on) => studio.setPart(k, on), `${fmt(c.meshes)} draws, ${fmt(c.tris / 1000)}k tris`);
  }
  check('Skip hidden parts automatically', () => studio.opts.autoCull, (on) => { studio.opts.autoCull = on; }, 'as in the game');

  section('Truck');
  check('Hood open', () => studio.state.hood, (on) => studio.setHood(on));
  check('Doors open', () => studio.state.doors, (on) => studio.setDoors(on));
  check('Tailgate down', () => studio.state.tailgate, (on) => studio.setTailgate(on));
  check('Engine running', () => studio.opts.running, (on) => { studio.opts.running = on; });
  const rpm = el('input', { type: 'range', min: 600, max: 3200, step: 20, value: studio.opts.rpm }), rpmOut = el('small', { textContent: `${studio.opts.rpm} rpm` });
  rpm.addEventListener('input', () => { studio.opts.rpm = +rpm.value; rpmOut.textContent = `${rpm.value} rpm`; });
  side.append(el('label', {}, rpm, rpmOut));
  check('Wheels turning', () => studio.opts.spin, (on) => { studio.opts.spin = on; });

  section('Render');
  const select = (text, options, value, onPick) => {
    const s = el('select'); for (const [v, t] of options) s.append(el('option', { value: v, textContent: t })); s.value = value;
    s.addEventListener('change', () => onPick(s.value)); side.append(el('label', { className: 'sel' }, el('span', { textContent: text }), s)); return s;
  };
  // texture sizes and mesh detail are fixed when the truck is built, so a new preset reloads the page
  select('Quality preset', Object.keys(QUALITY).map((k) => [k, k]), studio.qname, (v) => { const u = new URL(location.href); u.searchParams.set('quality', v); location.href = u.href; });
  select('Lighting', [['studio', 'Studio softboxes'], ['daylight', 'Daylight']], studio.opts.light, (v) => studio.setLight(v));
  const q = () => studio.R.q;
  check('Shadows', () => q().shadows !== false, (on) => studio.setRender({ shadows: on }));
  check('Ambient occlusion', () => q().ao, (on) => studio.setRender({ ao: on }));
  check('Bloom', () => q().bloom, (on) => studio.setRender({ bloom: on }));
  check('Anti-aliasing (SMAA)', () => q().smaa, (on) => studio.setRender({ smaa: on }));
  select('Render scale', [0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => [v, `${v}x`]), q().pixelRatio, (v) => studio.setRender({ pixelRatio: +v }));
  select('Shadow map', [1024, 2048, 4096].map((v) => [v, `${v} px`]), q().shadowMap, (v) => studio.setRender({ shadowMap: +v }));
  check('Floor', () => studio.opts.floor, (on) => { studio.opts.floor = on; });
  side.append(el('p', { className: 'note', textContent: 'Render scale cannot exceed the screen\'s own pixel ratio.' }));

  section('Measure');
  const run = el('button', { textContent: 'Run benchmark' }), png = el('button', { textContent: 'Save PNG' });
  side.append(el('div', { className: 'row' }, run, png));
  side.append(el('p', { className: 'note', textContent: 'Drag to orbit, right-drag to pan, wheel to zoom. Keys 1 to 8: views. H: hide panels. P: save PNG.' }));
  png.addEventListener('click', () => studio.savePNG());
  run.addEventListener('click', async () => {
    run.disabled = true;
    const res = await studio.bench({ onProgress: (v) => { run.textContent = `Timing ${VIEWS[v].label}`; } });
    run.disabled = false; run.textContent = 'Run benchmark'; showResult(res);
  });
  sync();

  // live readout
  const rows = [['Frame rate', 'fps'], ['CPU per frame', 'cpu'], ['GPU per frame', 'gpu'], ['Draw calls', 'calls'], ['Triangles', 'tris'], ['Shader programs', 'programs'], ['Textures', 'textures'], ['Geometries', 'geometries'], ['Resolution', 'res']];
  const cells = {}, tb = el('table');
  for (const [label, key] of rows) { cells[key] = el('td'); tb.append(el('tr', {}, el('td', { textContent: label }), cells[key])); }
  $('stats').append(tb, el('p', { className: 'note', textContent: 'Draw calls and triangles are for all passes of one frame (shadows, color, normals).' }));
  studio.onFrame = (s) => {
    cells.fps.textContent = s.fps.toFixed(0); cells.cpu.textContent = `${s.cpuMs.toFixed(1)} ms`;
    cells.gpu.textContent = s.gpuMs == null ? 'not available' : `${s.gpuMs.toFixed(1)} ms`;
    cells.calls.textContent = fmt(s.calls); cells.tris.textContent = fmt(s.tris);
    cells.programs.textContent = s.programs; cells.textures.textContent = s.textures; cells.geometries.textContent = s.geometries;
    cells.res.textContent = `${studio.canvas.width} x ${studio.canvas.height}`;
  };
  studio.onFrame(studio.stats);

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'checkbox') return;
    const n = /^Digit([1-8])$/.exec(e.code);
    if (n) studio.setView(VIEW_ORDER[+n[1] - 1]);
    else if (e.code === 'KeyH') document.body.classList.toggle('bare');
    else if (e.code === 'KeyP') studio.savePNG();
  });
}

function showResult(res) {
  const box = $('result'); box.replaceChildren(); box.style.display = 'block';
  const tb = el('table'); tb.append(el('tr', {}, ...['View', 'avg ms', 'p95 ms', 'fps', 'draw calls', 'triangles'].map((t) => el('th', { textContent: t }))));
  for (const r of res.rows) tb.append(el('tr', {}, ...[VIEWS[r.view].label, r.avgMs.toFixed(2), r.p95Ms.toFixed(2), r.fps.toFixed(0), fmt(r.calls), fmt(r.tris)].map((t) => el('td', { textContent: t }))));
  const copy = el('button', { textContent: 'Copy as JSON' }), close = el('button', { textContent: 'Close' });
  copy.addEventListener('click', () => navigator.clipboard?.writeText(JSON.stringify(res, null, 1)).then(() => { copy.textContent = 'Copied'; }));
  close.addEventListener('click', () => { box.style.display = 'none'; });
  box.append(el('h3', { textContent: `Benchmark: ${res.quality}, ${res.resolution[0]} x ${res.resolution[1]}` }), tb,
    el('p', { className: 'note', textContent: `${res.frames} frames per view, each finished on the GPU before the clock stops. ${res.gpu}` }), el('div', { className: 'row' }, copy, close));
}

studio.init().then(() => {
  buildUi();
  $('loading').style.opacity = '0'; setTimeout(() => $('loading').remove(), 600);
}).catch((e) => { console.error(e); $('loadmsg').textContent = 'Error: ' + e.message; });
