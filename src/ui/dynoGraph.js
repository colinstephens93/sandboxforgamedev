// Dyno-sheet graph drawn with plain canvas 2D. Pure and dependency-free: the same function draws the DOM dyno panel, the
// AI Live compare page and the 3D control-stand screen texture. Everything is sized from (W, H) in CSS pixels; the caller
// owns the device pixel ratio (see fitCanvas).
//
//   drawDynoGraph(ctx, W, H, { runs, baseline, current, selectedIds, showTorque, palette, title, weather })
//     runs         completed run objects from Dyno.runs ({ id, tuneName, regulator, points [{rpm,hp,tq}], peakHp, peakHpRpm, peakTq, peakTqRpm, cf, air })
//     baseline     a run drawn as the gray dashed stock baseline; when given, the difference table is printed
//     current      the run in progress (Dyno.liveAnalysis()), drawn live
//     selectedIds  ids (Set or array) of the runs to draw; omitted means all
//     showTorque   draw the torque curves and the right axis (default true)

export const RPM_MIN = 1000;
export const RPM_MAX = 3500;

export const THEME = {
  bg: '#0a0c0f', plot: '#0e1115', grid: '#1b2027', gridMajor: '#2a313b', axis: '#566170', text: '#c4cbd5', dim: '#7c8794',
  accent: '#d9a441', baseline: '#8d96a3', bad: '#ff5d52', good: '#74d68a', panelBg: 'rgba(10,12,15,0.88)',
};
export const RUN_COLORS = ['#ff8a3d', '#38bdf8', '#7ddc5a', '#f062c8', '#ffd23f', '#a78bfa', '#2dd4bf', '#f87171'];
export const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

// ---------- number formatting ----------
export const thousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const signed = (v, digits = 1) => { const r = +v.toFixed(digits); return (r >= 0 ? '+' : '-') + Math.abs(r).toFixed(digits); };
export const peakHpText = (run) => `PEAK ${run.peakHp.toFixed(1)} whp @ ${thousands(run.peakHpRpm)} rpm`;
export const peakTqText = (run) => `PEAK ${Math.round(run.peakTq)} lb-ft @ ${thousands(run.peakTqRpm)} rpm`;
export function diffText(run, base) {
  return `${signed(run.peakHp - base.peakHp, 1)} whp, ${signed(run.peakTq - base.peakTq, 0)} lb-ft vs stock`;
}
export const weatherText = (air) => (air ? `${air.tempC.toFixed(1)} °C  ${air.pressureKpa.toFixed(1)} kPa  ${Math.round(air.humidityPct)} % RH` : '');

// ---------- axis scaling ----------
const HP_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];
const niceCeilStep = (raw) => { for (const s of HP_STEPS) if (s >= raw - 1e-9) return s; return Math.ceil(raw / 100) * 100; };

// Left (hp) and right (torque) axes share the same number of divisions so the grid lines up on both sides.
export function computeAxes(curves, { showTorque = true, floorHp = 0, floorTq = 0 } = {}) {
  let hpPeak = 0, tqPeak = 0;
  for (const c of curves) for (const p of c) { if (p.hp > hpPeak) hpPeak = p.hp; if (p.tq > tqPeak) tqPeak = p.tq; }
  if (hpPeak <= 0) { hpPeak = 250; tqPeak = 500; }
  hpPeak = Math.max(hpPeak, floorHp); tqPeak = Math.max(tqPeak, floorTq);
  const hpTop = hpPeak * 1.08, tqTop = Math.max(tqPeak, 1) * 1.08;
  let best = null;
  for (let n = 4; n <= 8; n++) {
    const hpStep = niceCeilStep(hpTop / n), tqStep = niceCeilStep(tqTop / n);
    const waste = (hpStep * n - hpTop) / (hpStep * n) + (showTorque ? (tqStep * n - tqTop) / (tqStep * n) : 0);
    if (!best || waste < best.waste - 1e-9) best = { n, hpStep, tqStep, waste };
  }
  return { rpmMin: RPM_MIN, rpmMax: RPM_MAX, divisions: best.n, hpStep: best.hpStep, tqStep: best.tqStep, hpMax: best.hpStep * best.n, tqMax: best.tqStep * best.n };
}

// A run's drawable curve: finite points clipped to the rpm axis, ascending in rpm.
export function curvePoints(run) {
  if (!run || run.invalid || !run.points) return [];
  return run.points.filter((p) => Number.isFinite(p.rpm) && Number.isFinite(p.hp) && Number.isFinite(p.tq) && p.rpm >= RPM_MIN && p.rpm <= RPM_MAX).sort((a, b) => a.rpm - b.rpm);
}

export const runColor = (run) => RUN_COLORS[((run.id || 1) - 1 + RUN_COLORS.length * 100) % RUN_COLORS.length];
export const runTitle = (run) => `RUN ${run.id}  ${run.tuneName || run.tuneId}${run.regulator ? ` · ${run.regulator} reg` : ''}`;

// the first valid stock run is the baseline (PROMPT.md section 5A)
export const findBaseline = (runs) => runs.find((r) => !r.invalid && r.tuneId === 'stock' && r.points && r.points.length) || null;

// ---------- canvas helpers ----------
export function fitCanvas(canvas, cssW, cssH, dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1) {
  const r = Math.max(1, dpr);
  const bw = Math.round(cssW * r), bh = Math.round(cssH * r);
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  if (canvas.style) { canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(r, 0, 0, r, 0, 0);
  return ctx;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
const setFont = (ctx, px, weight = 400, family = FONT) => { ctx.font = `${weight} ${px}px ${family}`; };
const crisp = (v) => Math.round(v) + 0.5;
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- the dyno graph ----------
export function drawDynoGraph(ctx, W, H, opts = {}) {
  const { runs = [], baseline = null, current = null, selectedIds = null, showTorque = true, title = null, status = null } = opts;
  const T = { ...THEME, ...(opts.palette || {}) };
  const sel = selectedIds ? new Set(selectedIds) : null;
  const shown = runs.filter((r) => !r.invalid && (!sel || sel.has(r.id)) && (!baseline || r.id !== baseline.id));
  const live = current && current.points && current.points.length ? current : null;
  const s = clampN(Math.min(W / 700, H / 400), 0.95, 2.4);
  const fs = (px) => Math.round(px * s * 10) / 10;

  ctx.save();
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // curves that determine the scale
  const scaleCurves = shown.map(curvePoints);
  if (baseline) scaleCurves.push(curvePoints(baseline));
  if (live) scaleCurves.push(curvePoints(live));
  const hasData = scaleCurves.some((c) => c.length);
  const ax = computeAxes(scaleCurves, { showTorque, floorHp: live ? 240 : 0, floorTq: live ? 480 : 0 }); // a live run keeps a steady scale while it grows

  // ---- legend entries (laid out first: they set the top margin) ----
  const entries = [];
  if (baseline) entries.push({ text: `STOCK BASELINE  RUN ${baseline.id}${baseline.regulator ? ` · ${baseline.regulator} reg` : ''}`, color: T.baseline, dashed: true });
  for (const r of shown) entries.push({ text: runTitle(r), color: runColor(r) });
  if (live) entries.push({ text: `LIVE  RUN ${live.id || ''}  ${live.tuneName || ''}`.trim(), color: T.good, live: true });
  const padX = Math.round(10 * s);
  const titleH = title ? Math.round(24 * s) : 0;
  setFont(ctx, fs(10.5), 600);
  const rows = []; let rowW = 0, row = [];
  const chipW = (e) => Math.round(ctx.measureText(e.text).width + 34 * s);
  for (const e of entries) {
    const w = chipW(e);
    if (row.length && rowW + w > W - 2 * padX) { rows.push(row); row = []; rowW = 0; }
    row.push({ e, w }); rowW += w;
  }
  if (row.length) rows.push(row);
  const rowH = Math.round(17 * s);
  const legendH = rows.length ? rows.length * rowH + Math.round(6 * s) : Math.round(8 * s);

  const mL = Math.round(50 * s), mR = Math.round((showTorque ? 52 : 18) * s);
  const top = titleH + legendH, bottom = Math.round(48 * s);
  const pl = mL, pr = W - mR, pt = top, pb = H - bottom;
  const pw = pr - pl, ph = pb - pt;
  const xOf = (rpm) => pl + ((rpm - ax.rpmMin) / (ax.rpmMax - ax.rpmMin)) * pw;
  const yHp = (v) => pb - (v / ax.hpMax) * ph;
  const yTq = (v) => pb - (v / ax.tqMax) * ph;

  // ---- title bar ----
  if (title) {
    setFont(ctx, fs(11.5), 700); ctx.fillStyle = T.accent; ctx.textAlign = 'left';
    ctx.fillText(title, padX, Math.round(titleH * 0.72));
    if (status) { ctx.textAlign = 'right'; setFont(ctx, fs(10.5), 600, MONO); ctx.fillStyle = T.text; ctx.fillText(status, W - padX, Math.round(titleH * 0.72)); }
  }

  // ---- legend ----
  ctx.textAlign = 'left';
  rows.forEach((r, ri) => {
    let x = padX; const y = titleH + ri * rowH + Math.round(rowH * 0.5);
    for (const { e, w } of r) {
      ctx.strokeStyle = e.color; ctx.lineWidth = Math.max(2, 2.6 * s * 0.8); ctx.lineCap = 'round';
      ctx.setLineDash(e.dashed ? [5 * s, 3.5 * s] : []);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18 * s, y); ctx.stroke(); ctx.setLineDash([]);
      if (e.live) { ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(x + 9 * s, y, 3 * s, 0, 6.283); ctx.fill(); }
      setFont(ctx, fs(10.5), 600); ctx.fillStyle = T.text; ctx.textBaseline = 'middle';
      ctx.fillText(e.text, x + 24 * s, y + 0.5);
      x += w;
    }
  });
  ctx.textBaseline = 'alphabetic';

  // ---- plot background and grid ----
  ctx.fillStyle = T.plot; ctx.fillRect(pl, pt, pw, ph);
  ctx.lineWidth = 1;
  // vertical: minor every 250 rpm, major every 500
  for (let rpm = ax.rpmMin; rpm <= ax.rpmMax; rpm += 250) {
    const major = rpm % 500 === 0; const x = crisp(xOf(rpm));
    ctx.strokeStyle = major ? T.gridMajor : T.grid; ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pb); ctx.stroke();
  }
  for (let i = 0; i <= ax.divisions; i++) {
    const y = crisp(pb - (i / ax.divisions) * ph);
    ctx.strokeStyle = i === 0 ? T.axis : T.gridMajor; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pr, y); ctx.stroke();
    // minor half step
    if (i < ax.divisions) { const y2 = crisp(pb - ((i + 0.5) / ax.divisions) * ph); ctx.strokeStyle = T.grid; ctx.beginPath(); ctx.moveTo(pl, y2); ctx.lineTo(pr, y2); ctx.stroke(); }
  }
  ctx.strokeStyle = T.axis; ctx.strokeRect(crisp(pl), crisp(pt), Math.round(pw), Math.round(ph));

  // ---- axis labels ----
  setFont(ctx, fs(10), 500, MONO); ctx.fillStyle = T.dim;
  ctx.textAlign = 'center';
  for (let rpm = ax.rpmMin; rpm <= ax.rpmMax; rpm += 500) ctx.fillText(thousands(rpm), xOf(rpm), pb + fs(14));
  ctx.textAlign = 'right';
  for (let i = 0; i <= ax.divisions; i++) {
    const y = pb - (i / ax.divisions) * ph + fs(3.5);
    ctx.fillStyle = T.text; ctx.fillText(String(Math.round(i * ax.hpStep)), pl - fs(6), y);
  }
  if (showTorque) {
    ctx.textAlign = 'left';
    for (let i = 0; i <= ax.divisions; i++) {
      const y = pb - (i / ax.divisions) * ph + fs(3.5);
      ctx.fillStyle = T.dim; ctx.fillText(String(Math.round(i * ax.tqStep)), pr + fs(6), y);
    }
  }
  setFont(ctx, fs(10), 700); ctx.textAlign = 'center'; ctx.fillStyle = T.dim;
  ctx.fillText('ENGINE RPM', pl + pw / 2, pb + fs(28));
  ctx.save(); ctx.translate(fs(11), pt + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = T.text; ctx.fillText('WHEEL HORSEPOWER (whp)', 0, 0); ctx.restore();
  if (showTorque) { ctx.save(); ctx.translate(W - fs(10), pt + ph / 2); ctx.rotate(Math.PI / 2); ctx.fillStyle = T.dim; ctx.fillText('WHEEL TORQUE (lb-ft)', 0, 0); ctx.restore(); }

  // ---- curves ----
  ctx.save(); ctx.beginPath(); ctx.rect(pl, pt, pw, ph); ctx.clip();
  const trace = (pts, y, color, width, dash, alpha = 1) => {
    if (pts.length < 2) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash(dash || []);
    ctx.beginPath(); pts.forEach((p, i) => { const px = xOf(p.rpm), py = y(p); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  const wHp = 2.8 * Math.min(s, 1.6), wTq = 1.7 * Math.min(s, 1.6);
  const drawRun = (run, color, dash, hpAlpha = 1) => {
    const pts = curvePoints(run); if (!pts.length) return;
    if (showTorque) trace(pts, (p) => yTq(p.tq), color, wTq, dash, 0.85 * hpAlpha);
    trace(pts, (p) => yHp(p.hp), color, wHp, dash, hpAlpha);
  };
  if (baseline) drawRun(baseline, T.baseline, [7 * s, 5 * s], 0.9);
  for (const r of shown) drawRun(r, runColor(r), null);
  if (live) {
    const pts = curvePoints(live);
    if (showTorque) trace(pts, (p) => yTq(p.tq), T.good, wTq, null, 0.85);
    trace(pts, (p) => yHp(p.hp), T.good, wHp, null, 1);
    if (pts.length) { const q = pts[pts.length - 1]; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(xOf(q.rpm), yHp(q.hp), 3.6 * s, 0, 6.283); ctx.fill(); ctx.strokeStyle = T.good; ctx.lineWidth = 2; ctx.stroke(); }
  }
  ctx.restore();

  // ---- peak markers and labels ----
  const placed = [];
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const labelRuns = [];
  if (baseline) labelRuns.push({ run: baseline, color: T.baseline, base: true });
  for (const r of shown) labelRuns.push({ run: r, color: runColor(r) });
  if (live && !labelRuns.length) labelRuns.push({ run: live, color: T.good });
  const fullLabels = labelRuns.length <= 2;
  const labelFont = fs(10.5);
  const place = (px, py, text, color, prefer) => {
    setFont(ctx, labelFont, 700);
    const tw = ctx.measureText(text).width, bw = tw + fs(12), bh = fs(17);
    const cands = prefer === 'below'
      ? [[-bw / 2, fs(10)], [-bw - fs(4), fs(8)], [fs(6), fs(8)], [-bw / 2, -bh - fs(10)]]
      : [[-bw / 2, -bh - fs(9)], [-bw - fs(4), -bh - fs(6)], [fs(6), -bh - fs(6)], [-bw / 2, fs(10)], [-bw - fs(6), fs(6)]];
    let pick = null;
    for (const c of cands) {
      const r = { x: clampN(px + c[0], pl + 3, pr - bw - 3), y: clampN(py + c[1], pt + 3, pb - bh - 3), w: bw, h: bh };
      if (!placed.some((q) => hit(q, r))) { pick = r; break; }
    }
    if (!pick) pick = { x: clampN(px - bw / 2, pl + 3, pr - bw - 3), y: clampN(py - bh - fs(9) - placed.length * (bh + 3), pt + 3, pb - bh - 3), w: bw, h: bh };
    placed.push(pick);
    ctx.fillStyle = T.panelBg; roundRect(ctx, pick.x, pick.y, pick.w, pick.h, fs(3)); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1; roundRect(ctx, pick.x + 0.5, pick.y + 0.5, pick.w - 1, pick.h - 1, fs(3)); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, pick.x + fs(6), pick.y + pick.h / 2 + 0.5); ctx.textBaseline = 'alphabetic';
  };
  const marker = (px, py, color, ring) => {
    ctx.fillStyle = T.bg; ctx.beginPath(); ctx.arc(px, py, 4.6 * s, 0, 6.283); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, 3.3 * s, 0, 6.283); ctx.fill();
    if (ring) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, 7 * s, 0, 6.283); ctx.stroke(); }
  };
  labelRuns.forEach((lr, idx) => {
    const r = lr.run; if (!(r.peakHp > 0)) return;
    const hpX = xOf(r.peakHpRpm), hpY = yHp(r.peakHp), tqX = xOf(r.peakTqRpm), tqY = yTq(r.peakTq);
    const isLast = idx === labelRuns.length - 1;
    marker(hpX, hpY, lr.color, isLast);
    if (showTorque) marker(tqX, tqY, lr.color, false);
    if (fullLabels || isLast) {
      place(hpX, hpY, peakHpText(r), lr.color, 'above');
      if (showTorque) place(tqX, tqY, peakTqText(r), lr.color, 'above');
    }
  });

  // ---- difference table ----
  if (baseline && shown.length) {
    const lines = shown.map((r) => ({ color: runColor(r), name: `RUN ${r.id} ${r.tuneName || ''}`, d1: `${signed(r.peakHp - baseline.peakHp, 1)} whp`, d2: `${signed(r.peakTq - baseline.peakTq, 0)} lb-ft` }));
    setFont(ctx, fs(10.5), 700, MONO);
    let nw = 0, w1 = 0, w2 = 0;
    for (const l of lines) { nw = Math.max(nw, ctx.measureText(l.name).width); w1 = Math.max(w1, ctx.measureText(l.d1).width); w2 = Math.max(w2, ctx.measureText(l.d2).width); }
    const head = `VS STOCK BASELINE (RUN ${baseline.id})`;
    const bw = Math.max(nw + w1 + w2 + fs(46), ctx.measureText(head).width + fs(16)), lh = fs(15);
    const bh = lh * (lines.length + 1) + fs(10);
    const bx = pr - bw - fs(6), by = pb - bh - fs(6);
    ctx.fillStyle = T.panelBg; roundRect(ctx, bx, by, bw, bh, fs(4)); ctx.fill();
    ctx.strokeStyle = T.gridMajor; ctx.lineWidth = 1; roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, fs(4)); ctx.stroke();
    ctx.textAlign = 'left'; setFont(ctx, fs(9.5), 700); ctx.fillStyle = T.dim; ctx.fillText(head, bx + fs(8), by + fs(14));
    setFont(ctx, fs(10.5), 700, MONO);
    lines.forEach((l, i) => {
      const y = by + fs(14) + lh * (i + 1);
      ctx.fillStyle = l.color; ctx.fillRect(bx + fs(8), y - fs(8), fs(5), fs(9));
      ctx.fillStyle = T.text; ctx.textAlign = 'left'; ctx.fillText(l.name, bx + fs(18), y);
      const good = (r) => r >= 0; const dh = shown[i].peakHp - baseline.peakHp, dt = shown[i].peakTq - baseline.peakTq;
      ctx.textAlign = 'right';
      ctx.fillStyle = good(dh) ? T.good : T.bad; ctx.fillText(l.d1, bx + fs(18) + nw + fs(12) + w1, y);
      ctx.fillStyle = good(dt) ? T.good : T.bad; ctx.fillText(l.d2, bx + bw - fs(8), y);
    });
  }

  // ---- empty state ----
  if (!hasData) {
    ctx.fillStyle = T.dim; ctx.textAlign = 'center'; setFont(ctx, fs(12.5), 700);
    ctx.fillText(status && /refus|not|strap/i.test(status) ? 'RUN NOT STARTED' : 'NO RUN YET', pl + pw / 2, pt + ph / 2 - fs(4));
    setFont(ctx, fs(10.5), 500); ctx.fillText('Start the engine, then press START RUN', pl + pw / 2, pt + ph / 2 + fs(14));
  }

  // ---- footer: SAE correction and weather ----
  const ref = live || (shown.length ? shown[shown.length - 1] : baseline);
  setFont(ctx, fs(10), 500, MONO); ctx.textBaseline = 'alphabetic';
  const fy = H - fs(5);
  ctx.textAlign = 'left'; ctx.fillStyle = T.dim;
  const cfText = ref && ref.cf ? `SAE J1349 CF ${ref.cf.toFixed(3)}` : 'SAE J1349 CF 1.000';
  ctx.fillText(cfText, padX, fy);
  const wtxt = weatherText((ref && ref.air) || opts.weather);
  ctx.textAlign = 'center'; ctx.fillText(wtxt, W / 2 + fs(30), fy);
  ctx.textAlign = 'right'; ctx.fillText(ref && ref.gear ? `GEAR ${ref.gear}` : '', W - padX, fy);

  ctx.restore();
}

// ---------- multi-channel datalog chart ----------
// channels: [{ key, label, unit, color, decimals }]; rows: log rows with `t`. Each channel is scaled to its own range.
export function channelRange(rows, key) {
  let lo = Infinity, hi = -Infinity;
  for (const r of rows) { const v = r[key]; if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
  if (!Number.isFinite(lo)) return { lo: 0, hi: 1 };
  if (hi - lo < 1e-9) { hi = lo + 1; }
  const pad = (hi - lo) * 0.06;
  return { lo: lo - pad, hi: hi + pad };
}

export function drawMultiChannel(ctx, W, H, { rows = [], channels = [], cursor = null, palette = {}, title = '' } = {}) {
  const T = { ...THEME, ...palette };
  const s = clampN(Math.min(W / 700, H / 360), 0.95, 2.4); const fs = (px) => Math.round(px * s * 10) / 10;
  ctx.save(); ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
  const mL = Math.round(40 * s), mR = Math.round(14 * s), mT = Math.round(title ? 28 : 12) * 1, mB = Math.round(34 * s);
  const pl = mL, pr = W - mR, pt = mT, pb = H - mB, pw = pr - pl, ph = pb - pt;
  ctx.fillStyle = T.plot; ctx.fillRect(pl, pt, pw, ph);
  if (title) { setFont(ctx, fs(11.5), 700); ctx.fillStyle = T.accent; ctx.textAlign = 'left'; ctx.fillText(title, pl, pt - fs(9)); }
  if (!rows.length || !channels.length) {
    ctx.fillStyle = T.dim; ctx.textAlign = 'center'; setFont(ctx, fs(12), 600);
    ctx.fillText(rows.length ? 'Select at least one channel' : 'No datalog yet: run the truck on the dyno', pl + pw / 2, pt + ph / 2);
    ctx.restore(); return null;
  }
  const t0 = rows[0].t, t1 = rows[rows.length - 1].t, span = Math.max(t1 - t0, 0.5);
  const xOf = (t) => pl + ((t - t0) / span) * pw;
  // grid
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) { const y = crisp(pb - (i / 10) * ph); ctx.strokeStyle = i % 5 === 0 ? T.gridMajor : T.grid; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pr, y); ctx.stroke(); }
  const stepT = span > 40 ? 5 : span > 20 ? 2 : span > 8 ? 1 : 0.5;
  setFont(ctx, fs(10), 500, MONO); ctx.fillStyle = T.dim; ctx.textAlign = 'center';
  for (let t = Math.ceil(t0 / stepT) * stepT; t <= t1 + 1e-6; t += stepT) { const x = crisp(xOf(t)); ctx.strokeStyle = T.grid; ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pb); ctx.stroke(); ctx.fillText(`${(+t.toFixed(1))}`, x, pb + fs(14)); }
  ctx.fillText('TIME (s)', pl + pw / 2, pb + fs(28));
  ctx.textAlign = 'right';
  for (const f of [0, 0.5, 1]) ctx.fillText(`${Math.round(f * 100)}%`, pl - fs(5), pb - f * ph + fs(3.5));
  ctx.strokeStyle = T.axis; ctx.strokeRect(crisp(pl), crisp(pt), Math.round(pw), Math.round(ph));
  // channels
  ctx.save(); ctx.beginPath(); ctx.rect(pl, pt, pw, ph); ctx.clip();
  const ranges = {};
  for (const ch of channels) {
    const rg = ch.min != null && ch.max != null ? { lo: ch.min, hi: ch.max } : channelRange(rows, ch.key); ranges[ch.key] = rg;
    ctx.strokeStyle = ch.color; ctx.lineWidth = 1.9 * Math.min(s, 1.5); ctx.lineJoin = 'round'; ctx.beginPath();
    rows.forEach((r, i) => { const x = xOf(r.t), y = pb - clampN((r[ch.key] - rg.lo) / (rg.hi - rg.lo), 0, 1) * ph; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  }
  ctx.restore();
  // cursor
  if (cursor != null && cursor >= 0 && cursor < rows.length) {
    const r = rows[cursor], x = crisp(xOf(r.t));
    ctx.strokeStyle = '#e8ecf1'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pb); ctx.stroke(); ctx.setLineDash([]);
    for (const ch of channels) {
      const rg = ranges[ch.key]; const y = pb - clampN((r[ch.key] - rg.lo) / (rg.hi - rg.lo), 0, 1) * ph;
      ctx.fillStyle = ch.color; ctx.beginPath(); ctx.arc(x, y, 3.2 * s, 0, 6.283); ctx.fill();
    }
    // readout box
    setFont(ctx, fs(10), 600, MONO);
    const lines = [`t ${r.t.toFixed(2)} s`, ...channels.map((ch) => ({ ch, text: `${ch.label} ${Number(r[ch.key]).toFixed(ch.decimals ?? 1)} ${ch.unit}` }))];
    let bw = 0; for (const l of lines) bw = Math.max(bw, ctx.measureText(typeof l === 'string' ? l : l.text).width);
    bw += fs(24); const lh = fs(14), bh = lh * lines.length + fs(8);
    let bx = x + fs(10); if (bx + bw > pr - 4) bx = x - bw - fs(10);
    const by = pt + fs(6);
    ctx.fillStyle = 'rgba(8,10,13,0.9)'; roundRect(ctx, bx, by, bw, bh, fs(4)); ctx.fill(); ctx.strokeStyle = T.gridMajor; ctx.stroke();
    ctx.textAlign = 'left';
    lines.forEach((l, i) => {
      const y = by + fs(14) + i * lh - fs(2);
      if (typeof l === 'string') { ctx.fillStyle = T.text; ctx.fillText(l, bx + fs(8), y); } else { ctx.fillStyle = l.ch.color; ctx.fillRect(bx + fs(8), y - fs(7), fs(4), fs(8)); ctx.fillStyle = T.text; ctx.fillText(l.text, bx + fs(16), y); }
    });
  }
  ctx.restore();
  return { pl, pr, pt, pb, t0, t1, ranges };
}
