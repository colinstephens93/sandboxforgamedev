// Canvas-generated artwork for the shop equipment: signs, parts-box atlas, gauges, screens, calendar, tire.
// Nothing here uses real brands: part makers and product names are invented.
import { makeCanvas, noiseField, rng } from '../../core/proc.js';

const FONT = 'Arial, Helvetica, "Liberation Sans", "DejaVu Sans", sans-serif';
export const font = (px, w = 'bold') => `${w} ${px}px ${FONT}`;

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

export function barcode(g, x, y, w, h, seed = 1, color = '#111') {
  const r = rng(seed); g.fillStyle = color;
  let cx = x; const end = x + w;
  while (cx < end - 2) {
    const bw = 1 + Math.floor(r() * 3) * (w / 140);
    const gap = 1 + Math.floor(r() * 2) * (w / 140);
    g.fillRect(cx, y, Math.min(bw, end - cx), h);
    cx += bw + gap;
  }
}

function centerText(g, text, x, y, px, color = '#fff', weight = 'bold') {
  g.font = font(px, weight); g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

// ---------------- safety signs atlas ----------------
// Each sign is drawn in a design space (w x h units) and stretched into one square cell, so the plane that
// shows it must have the aspect w:h. The result is one canvas, one material, one merged mesh.
const SIGNS = {
  fireExt: { w: 300, h: 400, draw(g, w, h) {
    g.fillStyle = '#c41820'; rr(g, 0, 0, w, h, 14); g.fill();
    g.fillStyle = '#fff'; rr(g, 12, 12, w - 24, h - 24, 8); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#fff';
    // extinguisher pictogram
    rr(g, 110, 150, 80, 150, 24); g.fill(); g.fillRect(138, 115, 24, 36); g.fillRect(120, 108, 50, 14);
    g.beginPath(); g.moveTo(170, 118); g.quadraticCurveTo(225, 118, 225, 170); g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
    centerText(g, 'FIRE', w / 2, 52, 52); centerText(g, 'EXTINGUISHER', w / 2, 345, 38);
  } },
  eyewash: { w: 300, h: 400, draw(g, w, h) {
    g.fillStyle = '#1b7f43'; rr(g, 0, 0, w, h, 14); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 5; rr(g, 12, 12, w - 24, h - 24, 8); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(150, 170, 80, 46, 0, 0, 7); g.fill();
    g.fillStyle = '#1b7f43'; g.beginPath(); g.arc(150, 170, 30, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(150, 170, 14, 0, 7); g.fill();
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(150 + i * 26, 232); g.lineTo(144 + i * 30, 276); g.lineWidth = 6; g.stroke(); }
    centerText(g, 'EYEWASH', w / 2, 330, 48); centerText(g, 'STATION', w / 2, 372, 32);
  } },
  firstAid: { w: 300, h: 300, draw(g, w, h) {
    g.fillStyle = '#1b7f43'; rr(g, 0, 0, w, h, 14); g.fill();
    g.fillStyle = '#fff'; g.fillRect(115, 40, 70, 150); g.fillRect(75, 80, 150, 70);
    centerText(g, 'FIRST AID', w / 2, 245, 52);
  } },
  ppe: { w: 400, h: 300, draw(g, w, h) {
    g.fillStyle = '#fff'; rr(g, 0, 0, w, h, 14); g.fill();
    g.fillStyle = '#0a5cad'; g.beginPath(); g.arc(90, 118, 70, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.ellipse(68, 118, 24, 18, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(112, 118, 24, 18, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(92, 118); g.lineTo(88, 118); g.stroke();
    centerText(g, 'SAFETY', 280, 66, 52, '#0a5cad'); centerText(g, 'GLASSES', 280, 120, 52, '#0a5cad'); centerText(g, 'REQUIRED', 280, 174, 48, '#0a5cad');
    g.fillStyle = '#0a5cad'; g.fillRect(0, 232, w, 68); centerText(g, 'IN THE WORK AREA', w / 2, 266, 34);
  } },
  noSmoking: { w: 300, h: 400, draw(g, w, h) {
    g.fillStyle = '#fff'; rr(g, 0, 0, w, h, 14); g.fill();
    g.strokeStyle = '#c41820'; g.lineWidth = 16; g.beginPath(); g.arc(150, 140, 92, 0, 7); g.stroke();
    g.fillStyle = '#222'; g.fillRect(96, 128, 100, 16); g.fillStyle = '#ccc'; g.fillRect(150, 128, 46, 16); g.fillStyle = '#c41820'; g.fillRect(202, 128, 10, 16);
    g.beginPath(); g.moveTo(86, 206); g.lineTo(214, 74); g.lineWidth = 16; g.stroke();
    centerText(g, 'NO SMOKING', w / 2, 290, 40, '#c41820'); centerText(g, 'FLAMMABLE', w / 2, 336, 34, '#222'); centerText(g, 'FLUIDS AND FUEL', w / 2, 372, 26, '#222');
  } },
  liftWarn: { w: 450, h: 340, draw(g, w, h) {
    g.fillStyle = '#f2c500'; rr(g, 0, 0, w, h, 14); g.fill();
    g.fillStyle = '#111'; g.fillRect(0, 0, w, 64); centerText(g, 'CAUTION', w / 2, 34, 46, '#f2c500');
    g.fillStyle = '#111'; g.font = font(25); g.textAlign = 'left';
    ['LIFT OPERATION', 'Read the operator manual.', 'Set arms and pads at the frame', 'lift points. Raise 6 in, shake,', 'check, then raise. Lower only', 'with the area clear. Engage the', 'locks before working beneath.'].forEach((t, i) => { g.font = font(i ? 24 : 29, i ? 'normal' : 'bold'); g.fillText(t, 26, 106 + i * 34); });
  } },
  highVolt: { w: 300, h: 220, draw(g, w, h) {
    g.fillStyle = '#fff'; rr(g, 0, 0, w, h, 10); g.fill();
    g.fillStyle = '#c41820'; g.fillRect(0, 0, w, 78); centerText(g, 'DANGER', w / 2, 40, 54);
    g.fillStyle = '#111'; g.fillRect(0, 78, w, 6);
    centerText(g, 'HIGH VOLTAGE', w / 2, 122, 34, '#111'); centerText(g, 'Authorized personnel only', w / 2, 168, 22, '#111', 'normal');
    g.fillStyle = '#f2c500'; g.beginPath(); g.moveTo(w - 54, 128); g.lineTo(w - 28, 128); g.lineTo(w - 40, 150); g.lineTo(w - 22, 150); g.lineTo(w - 56, 194); g.lineTo(w - 46, 160); g.lineTo(w - 62, 160); g.closePath(); g.fill();
  } },
  airTank: { w: 300, h: 160, draw(g, w, h) {
    g.fillStyle = '#f2c500'; rr(g, 0, 0, w, h, 10); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 5; rr(g, 8, 8, w - 16, h - 16, 6); g.stroke();
    centerText(g, 'AIR RECEIVER', w / 2, 44, 34, '#111'); centerText(g, 'DRAIN DAILY', w / 2, 84, 34, '#111'); centerText(g, 'MAX 175 PSI', w / 2, 124, 28, '#111');
  } },
  oilOnly: { w: 300, h: 160, draw(g, w, h) {
    g.fillStyle = '#1b1b1d'; rr(g, 0, 0, w, h, 10); g.fill();
    g.strokeStyle = '#f2c500'; g.lineWidth = 6; rr(g, 8, 8, w - 16, h - 16, 6); g.stroke();
    centerText(g, 'USED OIL ONLY', w / 2, 62, 40, '#f2c500'); centerText(g, 'NO SOLVENT / NO WATER', w / 2, 112, 22, '#fff');
  } },
  solvent: { w: 300, h: 160, draw(g, w, h) {
    g.fillStyle = '#c41820'; rr(g, 0, 0, w, h, 10); g.fill();
    centerText(g, 'SOLVENT', w / 2, 52, 44); centerText(g, 'FLAMMABLE - KEEP LID CLOSED', w / 2, 100, 20); centerText(g, 'Gloves and eye protection', w / 2, 130, 19, '#fff', 'normal');
  } },
  door1: { w: 240, h: 90, draw(g, w, h) { g.fillStyle = '#1b1b1d'; rr(g, 0, 0, w, h, 8); g.fill(); centerText(g, 'OVERHEAD DOOR 1', w / 2, h / 2, 26, '#fff'); } },
  door2: { w: 240, h: 90, draw(g, w, h) { g.fillStyle = '#1b1b1d'; rr(g, 0, 0, w, h, 8); g.fill(); centerText(g, 'OVERHEAD DOOR 2', w / 2, h / 2, 26, '#fff'); } },
  switchPlate: { w: 240, h: 90, draw(g, w, h) { g.fillStyle = '#1b1b1d'; rr(g, 0, 0, w, h, 8); g.fill(); centerText(g, 'SHOP LIGHTS', w / 2, h / 2, 28, '#fff'); } },
  reserved: { w: 300, h: 130, draw(g, w, h) {
    g.fillStyle = '#f4f1e6'; rr(g, 0, 0, w, h, 6); g.fill(); g.strokeStyle = '#a02020'; g.lineWidth = 4; rr(g, 5, 5, w - 10, h - 10, 4); g.stroke();
    centerText(g, 'HOLD - FUEL SYSTEM', w / 2, 40, 28, '#a02020'); centerText(g, 'Regulator kit slot', w / 2, 80, 24, '#222', 'normal'); barcode(g, 60, 96, 180, 22, 11);
  } },
  exhaust: { w: 340, h: 200, draw(g, w, h) {
    g.fillStyle = '#0a5cad'; rr(g, 0, 0, w, h, 10); g.fill();
    centerText(g, 'ENGINE EXHAUST', w / 2, 44, 32); centerText(g, 'Connect the hose before', w / 2, 100, 26, '#fff', 'normal'); centerText(g, 'starting any engine indoors', w / 2, 134, 26, '#fff', 'normal'); centerText(g, 'CARBON MONOXIDE', w / 2, 174, 24, '#ffd400');
  } },
  hearing: { w: 300, h: 200, draw(g, w, h) {
    g.fillStyle = '#0a5cad'; rr(g, 0, 0, w, h, 10); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(80, 80, 48, 0, 7); g.fill();
    g.strokeStyle = '#0a5cad'; g.lineWidth = 12; g.beginPath(); g.arc(80, 82, 30, Math.PI, 0); g.stroke(); g.fillStyle = '#0a5cad'; g.fillRect(44, 80, 16, 36); g.fillRect(100, 80, 16, 36);
    centerText(g, 'HEARING', 215, 70, 36); centerText(g, 'PROTECTION', 215, 108, 32); centerText(g, 'DYNO AREA', w / 2, 164, 28, '#ffd400');
  } },
  jackCap: { w: 240, h: 120, draw(g, w, h) { g.fillStyle = '#f4f1e6'; rr(g, 0, 0, w, h, 8); g.fill(); centerText(g, '3 TON', w / 2, 48, 50, '#111'); centerText(g, 'CHECK STAND LOCKS', w / 2, 94, 20, '#a02020'); } },
};
export const SIGN_IDS = Object.keys(SIGNS);

export function signAtlas(T) {
  const names = SIGN_IDS;
  const cols = 4, rows = Math.ceil(names.length / cols);
  const cell = Math.max(128, Math.min(512, T / 2));
  const c = makeCanvas(cell * cols, cell * rows), g = c.getContext('2d');
  g.fillStyle = '#888'; g.fillRect(0, 0, c.width, c.height);
  const uv = {}, aspect = {};
  names.forEach((n, i) => {
    const s = SIGNS[n], cx = (i % cols) * cell, cy = Math.floor(i / cols) * cell;
    g.save(); g.translate(cx, cy); g.scale(cell / s.w, cell / s.h);
    s.draw(g, s.w, s.h); g.restore();
    // canvas y runs down; texture v runs up (flipY default true)
    uv[n] = [cx / c.width, 1 - (cy + cell) / c.height, (cx + cell) / c.width, 1 - cy / c.height];
    aspect[n] = s.w / s.h;
  });
  return { canvas: c, uv, aspect };
}

// ---------------- parts boxes atlas (cardboard with generic printed labels) ----------------
export const BOX_DESIGNS = [
  { id: 'kraftLabel', bg: [186, 146, 98], brand: 'NORTHSTAR', sub: 'FUEL INJECTOR', pn: 'NS-6618-LB' },
  { id: 'kraftGasket', bg: [178, 139, 92], brand: 'DURAPART', sub: 'GASKET KIT', pn: 'DP-1204-GK' },
  { id: 'whiteBox', bg: [232, 232, 226], brand: 'PROFLO', sub: 'FUEL FILTER', pn: 'PF-3352-FF', accent: '#d2601a' },
  { id: 'blueBox', bg: [34, 83, 150], brand: 'TRUCKLINE', sub: 'WATER PUMP', pn: 'TL-9072-WP', light: true },
  { id: 'yellowBox', bg: [232, 188, 36], brand: 'ROADMASTER', sub: 'BRAKE PADS', pn: 'RM-4410-BP' },
  { id: 'redBox', bg: [176, 30, 34], brand: 'POWERCOR', sub: 'GLOW PLUG SET', pn: 'PC-0078-GP', light: true },
  { id: 'greenBox', bg: [38, 110, 74], brand: 'CLEANFLOW', sub: 'AIR FILTER', pn: 'CF-5521-AF', light: true },
  { id: 'kraftPlain', bg: [190, 150, 104], brand: 'SHIPPING CARTON', sub: 'THIS SIDE UP', pn: 'RETURN CORE' },
  { id: 'tape', bg: [186, 146, 98], tape: true },
  { id: 'side', bg: [182, 142, 95], side: true },
  { id: 'side2', bg: [190, 150, 104], side: true, scuff: true },
  { id: 'end', bg: [180, 140, 94], brand: 'HANDLE WITH CARE', end: true },
];

function paintBoxCell(g, x, y, w, h, d, seed) {
  const r = rng(seed);
  const [br, bg, bb] = d.bg;
  g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip();
  g.fillStyle = `rgb(${br},${bg},${bb})`; g.fillRect(0, 0, w, h);
  // corrugation streaks and wear
  for (let i = 0; i < h / 2.2; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,25,10'},${0.02 + r() * 0.045})`;
    g.fillRect(0, i * 2.2, w, 1.1);
  }
  const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(255,255,255,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.10)');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const u = w / 400; // design unit
  const ink = d.light ? '#fff' : '#1a1410';
  if (d.tape) {
    g.fillStyle = 'rgba(214,190,140,0.9)'; g.fillRect(0, h * 0.42, w, h * 0.16);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, h * 0.42, w, 2 * u);
    g.fillStyle = 'rgba(60,40,10,0.35)'; g.fillRect(0, h * 0.58 - 2 * u, w, 2 * u);
  } else if (d.side || d.end) {
    if (d.end) { g.font = font(20 * u); g.fillStyle = 'rgba(60,40,20,0.8)'; g.textAlign = 'center'; g.fillText(d.brand, w / 2, h * 0.3); g.beginPath(); g.moveTo(w * 0.5, h * 0.4); g.lineTo(w * 0.5, h * 0.8); g.moveTo(w * 0.42, h * 0.5); g.lineTo(w * 0.5, h * 0.4); g.lineTo(w * 0.58, h * 0.5); g.lineWidth = 5 * u; g.strokeStyle = 'rgba(60,40,20,0.75)'; g.stroke(); }
    if (d.scuff) { g.fillStyle = 'rgba(60,40,15,0.10)'; for (let i = 0; i < 6; i++) g.fillRect(r() * w, r() * h, 40 * u, 6 * u * r()); }
  } else {
    // brand header
    const fg = d.light ? '#fff' : (d.accent ? d.accent : ink);
    let fs = 54 * u; g.font = font(fs); while (g.measureText(d.brand).width > w - 36 * u && fs > 12) { fs -= 2 * u; g.font = font(fs); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = fg;
    g.fillText(d.brand, 18 * u, 64 * u);
    g.font = font(28 * u, 'normal'); g.fillStyle = d.light ? 'rgba(255,255,255,0.9)' : 'rgba(30,20,10,0.85)'; g.fillText(d.sub, 20 * u, 100 * u);
    if (d.accent) { g.fillStyle = d.accent; g.fillRect(0, 112 * u, w, 10 * u); }
    // white shipping label
    const lx = w * 0.42, ly = h * 0.56, lw = w * 0.54, lh = h * 0.38;
    g.fillStyle = '#f6f6f1'; g.fillRect(lx, ly, lw, lh);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2 * u; g.strokeRect(lx, ly, lw, lh);
    g.fillStyle = '#111'; g.font = font(17 * u); g.textAlign = 'left';
    g.fillText('P/N ' + d.pn, lx + 8 * u, ly + 24 * u);
    g.font = font(12 * u, 'normal'); g.fillText('QTY 1   LOT ' + (1000 + Math.floor(r() * 8999)), lx + 8 * u, ly + 42 * u);
    barcode(g, lx + 8 * u, ly + 50 * u, lw - 16 * u, lh - 66 * u, seed + 3);
    g.font = font(11 * u, 'normal'); g.fillText(d.pn.replace(/-/g, '') + '00' + Math.floor(r() * 90 + 10), lx + 8 * u, ly + lh - 8 * u);
    // pictograms (fragile glass / this side up arrows)
    g.strokeStyle = ink; g.lineWidth = 4 * u;
    g.beginPath(); g.moveTo(40 * u, h * 0.66); g.lineTo(40 * u, h * 0.9); g.moveTo(28 * u, h * 0.72); g.lineTo(40 * u, h * 0.62); g.lineTo(52 * u, h * 0.72); g.stroke();
    g.beginPath(); g.moveTo(90 * u, h * 0.66); g.lineTo(90 * u, h * 0.9); g.moveTo(78 * u, h * 0.72); g.lineTo(90 * u, h * 0.62); g.lineTo(102 * u, h * 0.72); g.stroke();
    // box seams / tape edge at top
    g.fillStyle = 'rgba(214,190,140,0.55)'; g.fillRect(0, 0, w, 7 * u);
  }
  g.restore();
}

export function boxAtlas(T) {
  const cols = 3, rows = 4;
  const W = Math.max(512, Math.min(2048, T)), H = W; // cells are 4:3 (W/3 by W/4)
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const cw = W / cols, ch = H / rows;
  const uv = {};
  BOX_DESIGNS.forEach((d, i) => {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    paintBoxCell(g, cx, cy, cw, ch, d, 100 + i * 7);
    uv[d.id] = [cx / W, 1 - (cy + ch) / H, (cx + cw) / W, 1 - cy / H];
  });
  return { canvas: c, uv };
}

// ---------------- plain kraft/cardboard + jug label artwork ----------------
export function jugLabelCanvas(T) {
  const w = 256, h = 192, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, 70); // tinted by instanceColor? no: use instanceColor on the whole label
  g.fillStyle = '#d9d9d3'; g.fillRect(0, 70, w, 10);
  g.fillStyle = '#111'; g.font = font(34); g.textAlign = 'center'; g.fillText('DIESEL', w / 2, 120); g.font = font(22, 'normal'); g.fillText('HEAVY DUTY FLUID', w / 2, 150);
  g.font = font(16, 'normal'); g.fillText('1 GAL (3.78 L)', w / 2, 176);
  g.font = font(40); g.fillStyle = '#333'; g.fillText('DURA-LUBE', w / 2, 52);
  return c;
}

// ---------------- gauge dial ----------------
export function gaugeCanvas(max = 200, unit = 'PSI', size = 256) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), s = size / 256;
  g.fillStyle = '#f4f4ee'; g.beginPath(); g.arc(128 * s, 128 * s, 126 * s, 0, 7); g.fill();
  g.strokeStyle = '#111'; g.fillStyle = '#111'; g.lineWidth = 3 * s;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  for (let i = 0; i <= 20; i++) {
    const a = a0 + (a1 - a0) * (i / 20), long = i % 2 === 0;
    g.beginPath(); g.moveTo(128 * s + Math.cos(a) * 112 * s, 128 * s + Math.sin(a) * 112 * s);
    g.lineTo(128 * s + Math.cos(a) * (long ? 90 : 100) * s, 128 * s + Math.sin(a) * (long ? 90 : 100) * s); g.stroke();
    if (long && i % 4 === 0) { g.font = font(20 * s); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(Math.round(max * i / 20)), 128 * s + Math.cos(a) * 70 * s, 128 * s + Math.sin(a) * 70 * s); }
  }
  g.strokeStyle = '#c41820'; g.lineWidth = 8 * s; g.beginPath(); g.arc(128 * s, 128 * s, 106 * s, a0 + (a1 - a0) * 0.85, a1); g.stroke();
  g.fillStyle = '#111'; g.font = font(22 * s); g.textAlign = 'center'; g.fillText(unit, 128 * s, 178 * s);
  // needle (static; points at about 70 percent)
  const na = a0 + (a1 - a0) * 0.68;
  g.strokeStyle = '#c41820'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(128 * s, 128 * s); g.lineTo(128 * s + Math.cos(na) * 86 * s, 128 * s + Math.sin(na) * 86 * s); g.stroke();
  g.fillStyle = '#222'; g.beginPath(); g.arc(128 * s, 128 * s, 9 * s, 0, 7); g.fill();
  return c;
}

// ---------------- shop computer screen ----------------
export function shopScreenCanvas(T) {
  const w = 1024, h = 640, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#eef1f5'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f3a5f'; g.fillRect(0, 0, w, 62); g.fillStyle = '#fff'; g.font = font(30); g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('SHOP MANAGER  |  Work Orders', 24, 32);
  g.font = font(22, 'normal'); g.textAlign = 'right'; g.fillText('Bay 1: OPEN   Dyno: READY   Tue 08:42', w - 24, 32);
  g.fillStyle = '#d9dfe8'; g.fillRect(0, 62, 210, h - 62);
  g.textAlign = 'left'; g.font = font(22);
  ['Work Orders', 'Customers', 'Vehicles', 'Parts', 'Invoices', 'Dyno Runs', 'Schedule'].forEach((t, i) => {
    if (i === 0) { g.fillStyle = '#1f3a5f'; g.fillRect(0, 86, 210, 44); g.fillStyle = '#fff'; } else g.fillStyle = '#25303f';
    g.fillText(t, 22, 108 + i * 46);
  });
  // table
  const cols = [['WO #', 230], ['Vehicle', 330], ['Service', 600], ['Status', 850]];
  g.fillStyle = '#c3ccd9'; g.fillRect(222, 80, w - 238, 40);
  g.fillStyle = '#17202c'; g.font = font(19); cols.forEach(([t, x]) => g.fillText(t, x, 101));
  const rows = [
    ['10452', "2005 Silverado 2500HD LLY", 'Dyno baseline + tune', 'IN PROGRESS', '#1b7f43'],
    ['10451', "2011 Ram 3500 Cummins", 'EGR cooler inspection', 'WAITING PARTS', '#b8860b'],
    ['10449', "2008 F-250 6.4 Power Stroke", 'Injector balance test', 'READY', '#1f5fae'],
    ['10447', "2015 Silverado 2500 LML", 'Oil + filters, fuel filter', 'DONE', '#6b7480'],
    ['10446', "2004 Silverado 2500 LB7", 'Leaking injector return lines', 'DONE', '#6b7480'],
    ['10444', "2012 Sierra 3500 LML", 'Tire rotation + balance', 'DONE', '#6b7480'],
  ];
  rows.forEach((r, i) => {
    const y = 128 + i * 58;
    g.fillStyle = i % 2 ? '#e5e9f0' : '#f8f9fb'; g.fillRect(222, y, w - 238, 54);
    g.fillStyle = '#17202c'; g.font = font(19, 'normal'); g.fillText(r[0], 230, y + 28); g.fillText(r[1], 330, y + 28); g.fillText(r[2], 600, y + 28);
    g.fillStyle = r[4]; rr(g, 846, y + 12, 150, 30, 6); g.fill(); g.fillStyle = '#fff'; g.font = font(15); g.textAlign = 'center'; g.fillText(r[3], 921, y + 28); g.textAlign = 'left';
  });
  g.fillStyle = '#1f3a5f'; rr(g, 240, 500, 220, 52, 8); g.fill(); g.fillStyle = '#fff'; g.font = font(21); g.fillText('New Work Order', 262, 527);
  g.fillStyle = '#e0e6ee'; rr(g, 480, 500, 200, 52, 8); g.fill(); g.fillStyle = '#17202c'; g.fillText('Print Invoice', 508, 527);
  g.font = font(16, 'normal'); g.fillStyle = '#5b6573'; g.fillText('Parts on order: 3     Open invoices: 2     Today: 4 vehicles', 240, 590);
  return c;
}

export function balancerScreenCanvas() {
  const w = 512, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#071a10'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#4dff8a'; g.font = font(26); g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('WHEEL BALANCER', 18, 30); g.font = font(18, 'normal'); g.fillText('17 x 8.0   WIDTH 8.0   DIA 17', 18, 62);
  g.strokeStyle = '#4dff8a'; g.lineWidth = 2; g.strokeRect(18, 84, 220, 150); g.strokeRect(274, 84, 220, 150);
  g.font = font(56); g.textAlign = 'center'; g.fillText('0.25', 128, 150); g.fillText('0.00', 384, 150);
  g.font = font(16, 'normal'); g.fillText('INNER oz', 128, 214); g.fillText('OUTER oz', 384, 214);
  return c;
}

// ---------------- wall calendar ----------------
export function calendarCanvas() {
  const w = 512, h = 768, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, w, h);
  // photo area: simple diesel truck silhouette on a gradient
  const grd = g.createLinearGradient(0, 0, 0, 330); grd.addColorStop(0, '#6f9bc9'); grd.addColorStop(0.7, '#cfd9df'); grd.addColorStop(1, '#8a8f84');
  g.fillStyle = grd; g.fillRect(0, 0, w, 330);
  g.fillStyle = '#2b2f33'; g.fillRect(80, 220, 350, 50); g.fillRect(250, 160, 140, 60); g.fillStyle = '#9fb9cf'; g.fillRect(262, 170, 50, 40); g.fillRect(320, 170, 60, 40);
  g.fillStyle = '#111'; g.beginPath(); g.arc(150, 276, 34, 0, 7); g.fill(); g.beginPath(); g.arc(360, 276, 34, 0, 7); g.fill();
  g.fillStyle = '#c41820'; g.fillRect(0, 330, w, 56);
  g.fillStyle = '#fff'; g.font = font(40); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NOVEMBER 2026', w / 2, 360);
  g.fillStyle = '#111'; g.font = font(18); 'SMTWTFS'.split('').forEach((d, i) => g.fillText(d, 40 + i * 72, 416));
  const first = new Date(2026, 10, 1).getDay();
  g.font = font(26, 'normal');
  for (let day = 1; day <= 30; day++) {
    const idx = first + day - 1, cx = 40 + (idx % 7) * 72, cy = 462 + Math.floor(idx / 7) * 56;
    g.strokeStyle = '#c9c6bb'; g.lineWidth = 1; g.strokeRect(cx - 34, cy - 24, 68, 50);
    g.fillStyle = idx % 7 === 0 || idx % 7 === 6 ? '#b02020' : '#111'; g.textAlign = 'left'; g.fillText(String(day), cx - 28, cy - 6);
  }
  g.fillStyle = '#3d3d3d'; g.font = font(16, 'normal'); g.textAlign = 'center'; g.fillText('Dyno days: Tue / Thu     Parts orders by noon', w / 2, 742);
  return c;
}

// ---------------- extinguisher body label ----------------
export function extinguisherLabelCanvas() {
  const w = 256, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#b5161c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2f2ee'; rr(g, 28, 34, w - 56, 190, 8); g.fill();
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font(36); g.fillText('ABC', w / 2, 66); g.font = font(18); g.fillText('DRY CHEMICAL', w / 2, 98);
  g.font = font(14, 'normal'); g.fillText('10 LB   4-A : 60-B:C', w / 2, 120);
  g.fillStyle = '#e8c000'; g.fillRect(40, 138, 80, 66); g.fillStyle = '#111'; g.font = font(11); g.fillText('PULL PIN', 80, 152); g.fillText('AIM LOW', 80, 168); g.fillText('SQUEEZE', 80, 184); g.fillText('SWEEP', 80, 198);
  g.fillStyle = '#0a5cad'; g.fillRect(132, 138, 40, 28); g.fillStyle = '#1b7f43'; g.fillRect(176, 138, 40, 28); g.fillStyle = '#c41820'; g.fillRect(132, 170, 40, 28); g.fillStyle = '#111'; g.fillRect(176, 170, 40, 28);
  g.fillStyle = '#fff'; g.font = font(14); g.fillText('A', 152, 152); g.fillText('B', 196, 152); g.fillText('C', 152, 184); g.fillText('K', 196, 184);
  return c;
}

// ---------------- tire texture (u around the circumference, v across the section) ----------------
export function tireCanvas(T) {
  const w = 1024, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  const r = rng(5);
  g.fillStyle = '#1b1b1c'; g.fillRect(0, 0, w, h);
  const nf = noiseField(w, h, 64, 3, 3, 0.5);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) { const k = (nf[i] - 0.5) * 16; img.data[i * 4] += k; img.data[i * 4 + 1] += k; img.data[i * 4 + 2] += k; }
  g.putImageData(img, 0, 0);
  // tread region: v from 0.34 to 0.66 (rows 87..169 in canvas y)
  const y0 = h * 0.33, y1 = h * 0.67;
  g.fillStyle = '#242425'; g.fillRect(0, y0, w, y1 - y0);
  // circumferential grooves
  g.fillStyle = '#080808';
  [0.36, 0.43, 0.5, 0.57, 0.64].forEach((f) => g.fillRect(0, h * f - 2, w, 4));
  // lugs
  const pitch = w / 44;
  for (let i = 0; i < 44; i++) {
    const x = i * pitch;
    g.fillStyle = '#0a0a0a';
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x + pitch * 0.35, y0 + 24); g.lineTo(x + pitch * 0.1, y0 + 24); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + pitch * 0.5, y1); g.lineTo(x + pitch * 0.85, y1 - 24); g.lineTo(x + pitch * 0.6, y1 - 24); g.closePath(); g.fill();
    g.fillRect(x + pitch * 0.45, h * 0.44, pitch * 0.08, h * 0.12);
  }
  // sidewall lettering: raised, slightly lighter
  g.fillStyle = 'rgba(70,70,72,0.9)'; g.textBaseline = 'middle';
  g.font = font(22); g.textAlign = 'left';
  g.fillText('TRAILCUTTER  A/T  LT265/70R17  121/118S  LOAD RANGE E', 40, h * 0.16);
  g.font = font(14, 'normal'); g.fillText('TREADWEAR 540  TRACTION A  TEMPERATURE B  M+S  TUBELESS  RADIAL', 60, h * 0.25);
  g.font = font(22); g.fillText('TRAILCUTTER  A/T  LT265/70R17  121/118S  LOAD RANGE E', 40, h * 0.84);
  g.font = font(14, 'normal'); g.fillText('MAX LOAD 3195 LB AT 80 PSI COLD   DOT  MADE IN USA', 60, h * 0.75);
  // bead ring and rim guard ridges
  g.fillStyle = 'rgba(60,60,62,0.8)'; g.fillRect(0, h * 0.045, w, 3); g.fillRect(0, h * 0.955, w, 3);
  return c;
}
