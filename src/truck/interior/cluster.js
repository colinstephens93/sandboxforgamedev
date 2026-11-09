// The 2005 US heavy-duty automatic diesel instrument cluster with working needles.
// Layout from reference/01-dash-cluster-lit.jpg, IMG_2867 and the Duramax supplement page 3-2:
//   tach 0-5 x1000 (dashed red from 3,200, solid red from 3,600) at left; speedometer 0-120 mph with the km/h ring and the
//   PRND321 display in the middle; oil pressure 0-120, fuel E-1/2-F, voltmeter 9-19, coolant 160-260 F at right; transmission
//   temperature 100-300 F at lower left; the driver information center (DIC) line under the speedometer; warning lamps in the lobes.
// Units: authored in INCHES, +Z toward the driver, face centered at the origin, +Y up. buildCluster returns { mesh, update(state, dt) }.
import * as THREE from 'three';
import { makeCanvas } from '../../core/proc.js';
import { spec } from '../../data/truckSpec.js';
import { GAUGES, makeNeedle, stepNeedle, needleAngle, REST, sweepFraction, SWEEP_SECONDS, effectiveLights, dicLine } from './logic.js';
import { surfaceG } from './kit.js';

export const FACE = { w: 12.4, h: 4.96 };            // inches
const DW = 1000, DH = 400;                           // design units
const U = FACE.w / DW;                               // inches per design unit
const dx = (x) => (x - 500) * U, dy = (y) => (200 - y) * U;

// gauge pivots and sizes in design units (read from IMG_2867 / 01-dash-cluster-lit)
export const PIV = {
  speed:   { x: 493, y: 148, R: 150, needle: 126 },
  tach:    { x: 268, y: 235, R: 134, needle: 114 },
  trans:   { x: 71,  y: 322, R: 56,  needle: 46 },
  oil:     { x: 740, y: 160, R: 58,  needle: 47 },
  fuel:    { x: 740, y: 272, R: 58,  needle: 44 },
  volts:   { x: 888, y: 203, R: 58,  needle: 46 },
  coolant: { x: 888, y: 315, R: 58,  needle: 48 },
};

const FONT = '"Inter", "Liberation Sans", "Helvetica Neue", Arial, sans-serif';
const rad = (deg) => (deg * Math.PI) / 180;
// point at angle (deg clockwise from 12) and radius r around (cx, cy), canvas y-down
const pt = (cx, cy, a, r) => [cx + Math.sin(rad(a)) * r, cy - Math.cos(rad(a)) * r];

// ---------------- face drawing ----------------
// mode 'base': the unlit face as seen in daylight; mode 'glow': only the backlit parts (amber), on black
function drawFace(c, S, mode) {
  const g = c.getContext('2d'); const W = c.width, H = c.height; const k = W / DW; // px per design unit
  g.save(); g.scale(k, k);
  const glow = mode === 'glow';
  g.fillStyle = glow ? '#000' : '#0b0b0c'; g.fillRect(0, 0, DW, DH);
  const INK = glow ? '#ffa24a' : '#c9c6bd';       // numerals and ticks
  const DIM = glow ? '#ff7a2a' : '#9c9a92';
  const RED = glow ? '#ff3a1a' : '#8a2a22';
  const ring = (cx, cy, r0, r1, col) => { g.beginPath(); g.arc(cx, cy, r1, 0, Math.PI * 2); if (r0 > 0) g.arc(cx, cy, r0, 0, Math.PI * 2, true); g.fillStyle = col; g.fill('evenodd'); };

  // recessed wells of the small gauges and the pods
  if (!glow) {
    for (const key of ['trans', 'oil', 'fuel', 'volts', 'coolant']) { const p = PIV[key]; ring(p.x, p.y, 0, p.R + 6, '#171718'); ring(p.x, p.y, p.R + 3, p.R + 6, '#222224'); }
    g.fillStyle = '#131314'; roundRect(g, 8, 150, 108, 100, 22); g.fill(); // left indicator pod
    g.fillStyle = '#161617'; roundRect(g, 340, 257, 304, 50, 14); g.fill();  // DIC well
    g.fillStyle = '#121213'; roundRect(g, 430, 198, 126, 30, 6); g.fill();   // gear display well
    ring(PIV.speed.x, PIV.speed.y, 0, PIV.speed.R + 8, '#141415');
    ring(PIV.tach.x, PIV.tach.y, 0, PIV.tach.R + 8, '#141415');
  }

  const tickRing = (key, { ticks, major, minor, r0 = 0, r1 = 0, wMaj = 2.2, wMin = 1.2, col = INK }) => {
    const p = PIV[key], G = GAUGES[key];
    g.strokeStyle = col; g.lineCap = 'butt';
    for (let i = 0; i <= ticks; i++) {
      const isMaj = i % (major || 1) === 0;
      const a = G.a0 + ((G.a1 - G.a0) * i) / ticks;
      const [x0, y0] = pt(p.x, p.y, a, isMaj ? r1 : r1 + (r0 - r1) * 0); const [x1, y1] = pt(p.x, p.y, a, isMaj ? r0 : (r0 + (r1 - r0) * 0.55));
      g.lineWidth = isMaj ? wMaj : wMin; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
  };
  const label = (txt, x, y, size, col = INK, weight = 700, align = 'center') => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(txt, x, y); };

  // ---- speedometer: 0-120 mph, big numerals each 10; inner small km/h ring 20..180 ----
  {
    const p = PIV.speed, G = GAUGES.speed;
    for (let i = 0; i <= 120; i += 2) {
      const a = G.a0 + ((G.a1 - G.a0) * i) / 120; const maj = i % 10 === 0, mid = i % 5 === 0;
      const [x0, y0] = pt(p.x, p.y, a, p.R); const [x1, y1] = pt(p.x, p.y, a, p.R - (maj ? 17 : mid ? 12 : 8));
      g.strokeStyle = INK; g.lineWidth = maj ? 2.6 : 1.3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    for (let v = 0; v <= 120; v += 10) { const a = G.a0 + ((G.a1 - G.a0) * v) / 120; const [x, y] = pt(p.x, p.y, a, p.R - 38); label(String(v), x, y, 19, INK, 700); }
    // km/h ring: 20..180 km/h mapped on the same sweep (1 mph = 1.609 km/h)
    for (let kmh = 20; kmh <= 180; kmh += 20) {
      const mph = kmh / 1.609344; const a = G.a0 + ((G.a1 - G.a0) * mph) / 120; const [x, y] = pt(p.x, p.y, a, p.R - 66); label(String(kmh), x, y, 10, DIM, 600);
      const [x0, y0] = pt(p.x, p.y, a, p.R - 54), [x1, y1] = pt(p.x, p.y, a, p.R - 59); g.strokeStyle = DIM; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    label('MPH', p.x, p.y - 38, 15, INK, 700); label('km/h', p.x - 74, p.y + 26, 10, DIM, 600);
  }

  // ---- tachometer 0-5 x1000 ----
  {
    const p = PIV.tach, G = GAUGES.tach;
    for (let rpm = 0; rpm <= 5000; rpm += 250) {
      const a = G.a0 + ((G.a1 - G.a0) * rpm) / 5000; const maj = rpm % 1000 === 0;
      const [x0, y0] = pt(p.x, p.y, a, p.R); const [x1, y1] = pt(p.x, p.y, a, p.R - (maj ? 16 : 9));
      g.strokeStyle = INK; g.lineWidth = maj ? 2.6 : 1.3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    for (let r = 0; r <= 5; r++) { const a = G.a0 + ((G.a1 - G.a0) * r) / 5; const [x, y] = pt(p.x, p.y, a, p.R - 32); label(String(r), x, y, 20, INK, 700); }
    // red zone: dashed from 3,200 to 3,600 rpm, solid from 3,600 to 5,000 rpm (spec.cluster)
    const aRed = (rpm) => G.a0 + ((G.a1 - G.a0) * rpm) / 5000;
    const dashStart = S.tachDashedRedStartRpm, solidStart = S.tachSolidRedStartRpm;
    g.strokeStyle = RED; g.lineWidth = 7;
    g.beginPath(); g.arc(p.x, p.y, p.R + 8, rad(aRed(solidStart) - 90), rad(aRed(5000) - 90)); g.stroke();
    g.lineWidth = 2;
    for (let rpm = dashStart; rpm < solidStart; rpm += 40) { const a = aRed(rpm); const [x0, y0] = pt(p.x, p.y, a, p.R + 5), [x1, y1] = pt(p.x, p.y, a, p.R + 11); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    label('RPM', p.x - 58, p.y - 40, 15, INK, 700); label('X 1000', p.x - 41, p.y - 22, 15, INK, 700);
  }

  // ---- small gauges ----
  const small = (key, ticks, major, labels, labelR, size = 13) => {
    const p = PIV[key], G = GAUGES[key];
    for (let i = 0; i <= ticks; i++) {
      const maj = i % major === 0, a = G.a0 + ((G.a1 - G.a0) * i) / ticks;
      const [x0, y0] = pt(p.x, p.y, a, p.R); const [x1, y1] = pt(p.x, p.y, a, p.R - (maj ? 10 : 6));
      g.strokeStyle = INK; g.lineWidth = maj ? 2.2 : 1.1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    for (const [v, txt] of labels) { const a = needleAngle(key, v); const [x, y] = pt(p.x, p.y, a, labelR); label(txt, x, y, size, INK, 700); }
  };
  small('oil', 24, 4, [[0, '0'], [60, '60'], [120, '120']], 38, 15);
  small('volts', 20, 5, [[9, '9'], [14, '14'], [19, '19']], 38, 15);
  small('coolant', 20, 5, [[160, '160'], [210, '210'], [260, '260']], 38, 14);
  small('fuel', 12, 6, [[0, 'E'], [0.5, '1/2'], [1, 'F']], 40, 15);
  small('trans', 20, 5, [[100, '100'], [200, '200'], [300, '300']], 33, 14);
  label('°F', PIV.trans.x - 34, PIV.trans.y + 32, 13, INK, 700);
  // red tick groups at the ends of the coolant and voltmeter dials (hot zone / low-high charge)
  for (const [key, from, to] of [['coolant', 235, 260], ['volts', 17, 19], ['volts', 9, 11], ['trans', 265, 300], ['oil', 0, 5]]) {
    const p = PIV[key]; g.strokeStyle = RED; g.lineWidth = 2.4;
    g.beginPath(); g.arc(p.x, p.y, p.R - 3, rad(needleAngle(key, from) - 90), rad(needleAngle(key, to) - 90)); g.stroke();
  }
  // gauge icons (oil can, battery, thermometer, fuel pump, trans temp)
  const icon = (fn, x, y, s, col = INK) => { g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6 / s; fn(g); g.restore(); };
  icon(drawOilCan, PIV.oil.x + 40, PIV.oil.y + 32, 1.0); icon(drawBattery, PIV.volts.x + 36, PIV.volts.y + 26, 1.0);
  icon(drawThermo, PIV.coolant.x + 34, PIV.coolant.y + 26, 1.0); icon(drawPump, PIV.fuel.x + 42, PIV.fuel.y + 24, 1.0);
  icon(drawTransTemp, PIV.trans.x + 40, PIV.trans.y + 26, 0.95);
  g.restore();
}

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---- icons (about 24 units square, centered) ----
function drawOilCan(g) { g.beginPath(); g.moveTo(-9, 2); g.lineTo(-9, -4); g.lineTo(5, -4); g.lineTo(8, 2); g.lineTo(11, -2); g.lineTo(11, 3); g.lineTo(8, 6); g.lineTo(-9, 6); g.closePath(); g.stroke(); g.beginPath(); g.arc(-12, 8, 1.6, 0, 7); g.fill(); }
function drawBattery(g) { g.strokeRect(-9, -5, 18, 11); g.fillRect(-6, -8, 3, 3); g.fillRect(3, -8, 3, 3); g.beginPath(); g.moveTo(-5, 1); g.lineTo(-1, 1); g.moveTo(3, -1); g.lineTo(3, 3); g.moveTo(1, 1); g.lineTo(5, 1); g.stroke(); }
function drawThermo(g) { g.beginPath(); g.moveTo(-3, 6); g.lineTo(-3, -8); g.lineTo(0, -8); g.lineTo(0, 6); g.stroke(); g.beginPath(); g.arc(-1.5, 8, 4, 0, 7); g.stroke(); g.beginPath(); g.moveTo(1, 2); g.bezierCurveTo(5, 0, 6, 4, 10, 2); g.moveTo(1, -3); g.bezierCurveTo(5, -5, 6, -1, 10, -3); g.stroke(); }
function drawPump(g) { g.strokeRect(-7, -9, 10, 17); g.fillRect(-5, -7, 6, 5); g.beginPath(); g.moveTo(3, -4); g.lineTo(8, -1); g.lineTo(8, 6); g.stroke(); g.beginPath(); g.moveTo(-9, 9); g.lineTo(5, 9); g.stroke(); }
function drawTransTemp(g) { g.beginPath(); g.arc(-2, 0, 7, 0, 7); g.stroke(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(-2 + Math.cos(a) * 7, Math.sin(a) * 7); g.lineTo(-2 + Math.cos(a) * 10, Math.sin(a) * 10); g.stroke(); } g.beginPath(); g.moveTo(10, -9); g.lineTo(10, 5); g.stroke(); g.beginPath(); g.arc(10, 7, 2.5, 0, 7); g.fill(); }
function drawGlow(g) { g.beginPath(); g.moveTo(-9, 0); for (let i = 0; i < 4; i++) { g.arc(-6 + i * 4, 0, 2, Math.PI, 0, false); g.arc(-4 + i * 4, 0, 2, Math.PI, 0, true); } g.stroke(); g.beginPath(); g.moveTo(-9, 5); g.lineTo(9, 5); g.stroke(); }
function drawEngine(g) { g.beginPath(); g.moveTo(-10, -3); g.lineTo(-6, -3); g.lineTo(-6, -7); g.lineTo(2, -7); g.lineTo(2, -4); g.lineTo(7, -4); g.lineTo(7, -1); g.lineTo(10, -1); g.lineTo(10, 5); g.lineTo(7, 5); g.lineTo(5, 8); g.lineTo(-6, 8); g.lineTo(-8, 5); g.lineTo(-10, 5); g.closePath(); g.stroke(); }
function drawBelt(g) { g.beginPath(); g.arc(0, -6, 2.6, 0, 7); g.fill(); g.beginPath(); g.moveTo(-5, -2); g.lineTo(5, -2); g.lineTo(2, 8); g.lineTo(-2, 8); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-6, -2); g.lineTo(7, 9); g.stroke(); }
function drawAirbag(g) { g.beginPath(); g.arc(-3, -6, 2.6, 0, 7); g.fill(); g.beginPath(); g.moveTo(-6, -2); g.lineTo(0, -2); g.lineTo(1, 7); g.lineTo(-5, 7); g.closePath(); g.stroke(); g.beginPath(); g.arc(5, 1, 5, 0, 7); g.stroke(); }
function drawArrow(g, dir) { g.save(); g.scale(dir, 1); g.beginPath(); g.moveTo(10, 0); g.lineTo(0, -8); g.lineTo(0, -3); g.lineTo(-10, -3); g.lineTo(-10, 3); g.lineTo(0, 3); g.lineTo(0, 8); g.closePath(); g.fill(); g.restore(); }
function drawHighBeam(g) { g.beginPath(); g.ellipse(2, 0, 5, 7, 0, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill(); for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-3, i * 3.2); g.lineTo(-11, i * 3.2); g.stroke(); } }
function drawBrake(g) { g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 11.5, rad(130), rad(230)); g.stroke(); g.beginPath(); g.arc(0, 0, 11.5, rad(-50), rad(50)); g.stroke(); g.font = `800 12px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 1); }
function drawAbs(g) { g.beginPath(); g.arc(0, 0, 10, 0, 7); g.stroke(); g.font = `800 8px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABS', 0, 1); }
function drawWater(g) { g.beginPath(); g.moveTo(-9, -7); g.lineTo(9, -7); g.lineTo(6, 5); g.lineTo(-6, 5); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(5, 11, 4, 14, 0, 14); g.bezierCurveTo(-4, 14, -5, 11, 0, 6); g.fill(); }
function drawTrans(g) { g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke(); g.font = `800 10px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 1); }
function drawText(g, t, size = 9) { g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 0); }
function drawTow(g) { g.font = `800 8.5px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TOW', 0, -5); g.fillText('HAUL', 0, 5); }
function drawOdOff(g) { g.font = `800 8.5px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('O/D', 0, -5); g.fillText('OFF', 0, 5); }

// lamp table: key -> [designX, designY, color, drawFn, scale]
const AMBER = '#ffb030', REDL = '#ff2a1a', GREEN = '#35ff6a', BLUE = '#4a9bff';
export const LAMPS = {
  waitToStart: [118, 62, AMBER, drawGlow, 1.25, 'Wait to Start'],
  checkEngine: [172, 62, AMBER, drawEngine, 1.25, 'Check engine'],
  turnL: [300, 58, GREEN, (g) => drawArrow(g, -1), 1.2, 'Left turn'],
  turnR: [640, 58, GREEN, (g) => drawArrow(g, 1), 1.2, 'Right turn'],
  highBeam: [696, 58, BLUE, drawHighBeam, 1.2, 'High beam'],
  fourWd: [752, 58, AMBER, (g) => drawText(g, '4WD', 10), 1.3, 'Four-wheel drive'],
  tow: [806, 58, AMBER, drawTow, 1.2, 'Tow/Haul'],
  odOff: [858, 58, AMBER, drawOdOff, 1.2, 'O/D off'],
  waterInFuel: [908, 58, AMBER, drawWater, 1.05, 'Water in fuel'],
  seatBelt: [38, 178, REDL, drawBelt, 1.2, 'Seat belt'],
  airbag: [38, 226, REDL, drawAirbag, 1.1, 'Airbag'],
  oil: [776, 188, REDL, drawOilCan, 0.0, 'Oil'],
  charge: [920, 232, REDL, drawBattery, 0.0, 'Charge'],
  brake: [300, 366, REDL, drawBrake, 1.0, 'Brake'],
  abs: [236, 366, AMBER, drawAbs, 1.0, 'ABS'],
  transHot: [117, 350, AMBER, drawTrans, 1.0, 'Transmission'],
};
// the oil-pressure and charge lamps are drawn over the gauge icons (they replace the icon color when lit)
LAMPS.oil[0] = PIV.oil.x + 40; LAMPS.oil[1] = PIV.oil.y + 32; LAMPS.oil[4] = 1.0;
LAMPS.charge[0] = PIV.volts.x + 36; LAMPS.charge[1] = PIV.volts.y + 26; LAMPS.charge[4] = 1.0;
LAMPS.transHot[0] = PIV.trans.x + 40; LAMPS.transHot[1] = PIV.trans.y + 26;

function drawLamps(c, lit) {
  const g = c.getContext('2d', { willReadFrequently: true }); const k = c.width / DW;
  c.width = c.width; // resetting the size clears the bitmap and every piece of context state
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.save(); g.scale(k, k);
  for (const [key, [x, y, col, fn, s]] of Object.entries(LAMPS)) {
    if (!lit[key]) continue;
    g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.7 / s; g.shadowColor = col; g.shadowBlur = 6; fn(g); g.restore();
  }
  g.restore();
}

// ---------------- DIC (pixelated vacuum-fluorescent look: drawn small and magnified with nearest filtering) ----------------
const DIC_W = 210, DIC_H = 22, GEAR_W = 62, GEAR_H = 12;
function drawDic(c, text, on) {
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  if (!on || !text) return;
  g.font = '700 11px "DejaVu Sans Mono", "Liberation Mono", monospace'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#4dffe0';
  let size = 11; while (g.measureText(text).width > c.width - 10 && size > 6) { size--; g.font = `700 ${size}px "DejaVu Sans Mono", monospace`; }
  g.fillText(text, c.width / 2, c.height / 2 + 1);
  const img = g.getImageData(0, 0, c.width, c.height); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = d[i + 1] > 90 ? 1 : 0; d[i] = 70 * v; d[i + 1] = 255 * v; d[i + 2] = 225 * v; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
}
function drawGear(c, gear, on) {
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  if (!on) return;
  const letters = 'PRND321'; g.font = '700 9px "DejaVu Sans Mono", monospace'; g.textBaseline = 'middle'; g.textAlign = 'center';
  const step = c.width / letters.length;
  for (let i = 0; i < letters.length; i++) {
    const act = letters[i] === gear;
    if (act) { g.fillStyle = '#4dffe0'; g.fillRect(i * step + 0.5, 1, step - 1, c.height - 2); }
    g.fillStyle = act ? '#000' : '#4dffe0'; g.fillText(letters[i], i * step + step / 2, c.height / 2 + 0.5);
  }
  const img = g.getImageData(0, 0, c.width, c.height); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = d[i + 1] > 90 ? 1 : 0; d[i] = 70 * v; d[i + 1] = 255 * v; d[i + 2] = 225 * v; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
}

function needleShape(L, wBase, tail) {
  const s = new THREE.Shape(); s.moveTo(-wBase, -tail); s.lineTo(wBase, -tail); s.lineTo(wBase * 0.7, 0); s.lineTo(wBase * 0.18, L); s.lineTo(-wBase * 0.18, L); s.lineTo(-wBase * 0.7, 0); s.closePath(); return s;
}

// ---------------- builder ----------------
export function buildCluster({ quality, spec: specIn } = {}) {
  const S = (specIn || spec).cluster; // red zone starts etc. come from the single source of truth
  const q = quality || { tex: 1024, aniso: 4 };
  const CW = Math.min(2048, Math.max(1024, q.tex * 2)), CH = Math.round(CW * (DH / DW));
  const root = new THREE.Group(); root.name = 'cluster';
  root.userData.units = 'in';

  const baseC = makeCanvas(CW, CH), glowC = makeCanvas(CW, CH);
  drawFace(baseC, S, 'base'); drawFace(glowC, S, 'glow');
  const mk = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = q.aniso || 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const baseT = mk(baseC), glowT = mk(glowC);
  const faceMat = new THREE.MeshStandardMaterial({ map: baseT, emissiveMap: glowT, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0, roughness: 0.92, metalness: 0, envMapIntensity: 0.12 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(FACE.w, FACE.h), faceMat); face.name = 'cluster_face'; root.add(face);

  // warning lamps (additive overlay)
  const lampC = makeCanvas(Math.round(CW / 2), Math.round(CH / 2)); drawLamps(lampC, {});
  const lampT = mk(lampC);
  const lampMat = new THREE.MeshBasicMaterial({ map: lampT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  const lamps = new THREE.Mesh(new THREE.PlaneGeometry(FACE.w, FACE.h), lampMat); lamps.position.z = 0.02; lamps.renderOrder = 2; root.add(lamps);

  // DIC panels
  const dicC = makeCanvas(DIC_W, DIC_H), gearC = makeCanvas(GEAR_W, GEAR_H);
  drawDic(dicC, '', false); drawGear(gearC, 'P', false);
  const pixT = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const dicT = pixT(dicC), gearT = pixT(gearC);
  const dicMat = new THREE.MeshBasicMaterial({ map: dicT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: new THREE.Color(1.5, 1.5, 1.5) });
  const gearMat = new THREE.MeshBasicMaterial({ map: gearT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: new THREE.Color(1.5, 1.5, 1.5) });
  const dic = new THREE.Mesh(new THREE.PlaneGeometry(292 * U, 40 * U), dicMat); dic.position.set(dx(492), dy(282), 0.03); dic.renderOrder = 3; root.add(dic);
  const gearM = new THREE.Mesh(new THREE.PlaneGeometry(118 * U, 24 * U), gearMat); gearM.position.set(dx(492), dy(213), 0.03); gearM.renderOrder = 3; root.add(gearM);

  // needles and hubs
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xe5561c, roughness: 0.5, metalness: 0, emissive: new THREE.Color(0xff4a14), emissiveIntensity: 0, side: THREE.DoubleSide });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.4, metalness: 0.2 });
  const hubRingMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3d, roughness: 0.35, metalness: 0.8 });
  const needles = {};
  for (const key of Object.keys(PIV)) {
    const p = PIV[key]; const grp = new THREE.Group(); grp.userData.dynamic = true; grp.position.set(dx(p.x), dy(p.y), 0.16);
    const big = key === 'speed' || key === 'tach';
    const shape = needleShape(p.needle * U, (big ? 6.4 : 4.6) * U, (big ? 18 : 10) * U);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), needleMat); m.position.z = 0; grp.add(m);
    root.add(grp);
    const hubR = (big ? 20 : 11) * U;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR * 1.05, 0.3, 28), hubMat); hub.rotation.x = Math.PI / 2; hub.position.set(dx(p.x), dy(p.y), 0.3); root.add(hub);
    if (big) { const ring = new THREE.Mesh(new THREE.TorusGeometry(hubR * 0.92, 0.025, 8, 40), hubRingMat); ring.position.set(dx(p.x), dy(p.y), 0.46); root.add(ring); }
    needles[key] = { grp, state: makeNeedle(key) };
  }

  // lens: slightly bowed clear cover with faint reflections
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.1, roughness: 0.03, metalness: 0, specularIntensity: 0.08, envMapIntensity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const lens = new THREE.Mesh(surfaceG(24, 8, (u, v) => [u * FACE.w / 2, v * FACE.h / 2, 0.85 + 0.12 * (1 - u * u) * (1 - 0.3 * v * v), 0, 0]), lensMat);
  lens.renderOrder = 4; lens.name = 'cluster_lens'; root.add(lens);

  // state ------------------------------------------------------------
  const st = { glow: 0, sweepT: -1, prevKey: 0, runClock: 0, lampSig: '', dicSig: '', gearSig: '', page: 0, last: performance.now(), blink: 0 };
  const lampState = {};
  function update(state, dt) {
    const now = performance.now(); if (dt == null) dt = Math.min(0.1, (now - st.last) / 1000); st.last = now;
    const on = state.keyPos >= 2;
    if (on && st.prevKey < 2) { st.sweepT = 0; st.runClock = 0; }
    if (!on) { st.sweepT = -1; st.runClock = 0; }
    if (on !== st.wasOn) { st.wasOn = on; st.lampSig = '?'; st.dicSig = '?'; st.gearSig = '?'; }
    st.prevKey = state.keyPos;
    if (on) st.runClock += dt;
    if (st.sweepT >= 0) { st.sweepT += dt; if (st.sweepT >= SWEEP_SECONDS) st.sweepT = -1; }
    // backlight fades in with the key
    const target = on ? 1 : 0; st.glow += (target - st.glow) * (1 - Math.exp(-dt / (on ? 0.25 : 0.12)));
    faceMat.emissiveIntensity = 1.6 * st.glow; faceMat.color.setScalar(1 - 0.6 * st.glow); needleMat.emissiveIntensity = 0.9 * st.glow;
    const sweep = sweepFraction(st.sweepT);
    const vals = {
      speed: state.mph, tach: state.rpm, volts: state.volts, coolant: state.coolantF, trans: state.transF, oil: state.oilPsi, fuel: state.fuel,
    };
    for (const key of Object.keys(needles)) {
      const G = GAUGES[key]; const n = needles[key];
      let tgt = on ? vals[key] : REST[key];
      if (on && sweep != null) tgt = G.v0 + (G.v1 - G.v0) * sweep;
      if (on && key === 'volts' && state.keyPos >= 2 && (state.rpm || 0) < 400 && sweep == null) tgt = vals[key];
      const pos = stepNeedle(n.state, tgt, dt);
      n.grp.rotation.z = -THREE.MathUtils.degToRad(needleAngle(key, pos));
    }
    // lamps (redrawn only when the lit set changes)
    const lit = on ? effectiveLights(state, st.runClock) : {};
    const sig = Object.keys(lit).filter((k) => lit[k]).join(',');
    if (sig !== st.lampSig) { st.lampSig = sig; drawLamps(lampC, lit); lampT.needsUpdate = true; }
    // DIC text
    const msg = on ? (state.dicMessage || '') : '';
    let text = '';
    if (on && st.runClock > 0.6) text = msg || (state.dicText != null ? state.dicText : dicTextFor(state, st.page));
    const dsig = text + '|' + on;
    if (dsig !== st.dicSig) { st.dicSig = dsig; drawDic(dicC, text, on && !!text); dicT.needsUpdate = true; }
    const gsig = (on && st.runClock > 0.4 ? state.gear : '-') + '|' + on;
    if (gsig !== st.gearSig) { st.gearSig = gsig; drawGear(gearC, state.gear || 'P', on && st.runClock > 0.4); gearT.needsUpdate = true; }
  }
  function dicTextFor(state, page) { return dicLine(state, page); }
  const api = { mesh: root, update, needles: Object.fromEntries(Object.keys(needles).map((k) => [k, needles[k].state])), faceMaterial: faceMat, setPage(p) { st.page = p; st.dicSig = ''; }, _st: st };
  update({ keyPos: 0, rpm: 0, mph: 0, volts: 12, coolantF: 70, transF: 70, oilPsi: 0, fuel: 0.5, lights: {}, gear: 'P' }, 0.016);
  return api;
}
