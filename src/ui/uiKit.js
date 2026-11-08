// Tiny DOM and formatting helpers shared by the three panels. No game imports.
export const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const txt = (el, t) => { if (el.textContent !== t) el.textContent = t; };
export const show = (el, on, display = '') => { const d = on ? display : 'none'; if (el.style.display !== d) el.style.display = d; };
export const toggleClass = (el, cls, on) => { if (el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const fmtInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const fmtClock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const kToF = (k) => (k - 273.15) * 1.8 + 32;
export const MPH_PER_MS = 2.2369363;

// progress bar element with an update function
export function makeBar(cls = '') {
  const root = h('div', `ui-bar ${cls}`); const fill = h('i'); root.appendChild(fill);
  return { root, set(f, state) { fill.style.width = `${Math.round(Math.min(1, Math.max(0, f)) * 1000) / 10}%`; if (state !== undefined) root.dataset.state = state; } };
}

// level class from thresholds: [warn, bad]
export const level = (v, warn, bad) => (v >= bad ? 'bad' : v >= warn ? 'warn' : '');
