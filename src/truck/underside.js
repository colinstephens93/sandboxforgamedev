// Underside of the 2005 Silverado 2500HD 4WD crew cab short box (increment 2.5).
// Truck frame (docs/CONVENTIONS.md): origin on the floor at the front axle centerline, truck faces -Z, +X = passenger,
// rear axle at z = +3.886 m, units meters. All design numbers below are written in INCHES (z measured rearward from the
// front axle, y up, x + = passenger) and converted when the batches are finalised.
//
// Sources: the brief for this increment (owner/GM), reference/03-underside-rear.jpg, IMG_2856, IMG_2861, IMG_2872,
// the 2005 Duramax diesel supplement (fuel cooler under the vehicle, water-in-fuel sensor at the filter bottom).
// Anything that is not confirmed is tagged `estimated` here and listed in ACCURACY.md by the integrator.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { spec, IN as INCH } from '../data/truckSpec.js';
import { noiseField, canvasFromField, makeCanvas, tex, rng } from '../core/proc.js';

const HAS_DOM = typeof document !== 'undefined';
const V3 = THREE.Vector3;

// ---------------------------------------------------------------------------------------------------------------
// Design numbers (inches)
// ---------------------------------------------------------------------------------------------------------------
export const UNDER = {
  wheelbaseIn: spec.dims.wheelbaseIn, // confirmed: spec
  trackFrontIn: spec.dims.trackFrontIn, // estimated: spec
  trackRearIn: spec.dims.trackRearIn, // estimated: spec
  wheelCenterY: 14.5, // estimated: brief (placeholder wheels in truck/index.js use the same value)
  frameOuterWidth: 34.5, // estimated: brief (owner), outside to outside
  railWidth: 3.0, // estimated: flange width of the C-channel / box section
  railDepth: 5.6, // estimated
  railThickness: 0.24, // estimated (real 0.19 in, drawn slightly heavier so it reads)
  frameBottomFront: 16, // estimated: brief (frame rail bottom about 16 in at the front)
  frameBottomRear: 21, // estimated: brief (about 21 in at the rear)
  rampStart: 60, // estimated: where the rail bottom starts to rise (z, in)
  rampEnd: 100, // estimated
  railFront: -33.5, // estimated: frame horn end
  railRear: 191.5, // estimated: rear frame end
  fuelTankGal: spec.engine.fuelTankGal, // confirmed: OM, 26.0 gal short bed
  // Exhaust side: +1 = passenger side (reference/03-underside-rear.jpg and IMG_2872 show the pipe on the passenger side),
  // -1 = driver side (the brief says driver side). Single switch so the integrator can flip it.
  exhaustSide: 1,
};

const W2 = UNDER.frameOuterWidth / 2; // 17.25

// Rail bottom height above ground at station z (in): 16 up front rising to 21 over the cab-to-axle kick-up.
export function frameBottomY(z) {
  const { frameBottomFront: a, frameBottomRear: b, rampStart: z0, rampEnd: z1 } = UNDER;
  if (z <= z0) return a;
  if (z >= z1) return b;
  return a + ((b - a) * (z - z0)) / (z1 - z0);
}

// Semi-elliptic leaf spring: height of the top surface of the main leaf at distance s from the spring center (parabola),
// `camber` = rise of the center above the eyes. Pure helper (unit tested).
export function leafCurve(length, camber, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = -length / 2 + (length * i) / n;
    const u = (2 * s) / length;
    pts.push({ s, y: camber * (1 - u * u) });
  }
  return pts;
}

export function curveLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].s - pts[i - 1].s, pts[i].y - pts[i - 1].y);
  return L;
}

// Leaf pack: lengths and thicknesses, top (main, eyes) to bottom. The last entry is the overload leaf.
export function leafPackSpec() {
  const t = 0.4;
  const lens = [58, 52, 46, 40, 33, 26];
  const leaves = lens.map((length, i) => ({ length, thickness: t, index: i, main: i === 0, overload: false }));
  leaves.push({ length: 40, thickness: 0.42, index: leaves.length, main: false, overload: true });
  return leaves;
}

export function leafPackThickness(leaves = leafPackSpec()) {
  return leaves.reduce((a, l) => a + l.thickness, 0);
}

// U-bolt centerline: two legs joined by a round bottom. Returns [x,y,z] points in the bolt's local frame
// (legs along +Y from the bend, bottom of the bend at y = 0, leg spacing along X, bend radius = spacing / 2).
export function uBoltPath(spacing, height, n = 6) {
  const r = spacing / 2;
  const pts = [[-r, height, 0], [-r, r, 0]];
  for (let i = 1; i < n; i++) {
    const a = (Math.PI * i) / n; // sweep the bottom half circle from the left leg to the right leg
    pts.push([-r * Math.cos(a), r - r * Math.sin(a), 0]);
  }
  pts.push([r, r, 0], [r, height, 0]);
  return pts;
}

// ---------------------------------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------------------------------
const LBL = [
  ['frameRail', 'Frame rails', 'Ladder frame: fully boxed ahead of the cab, C-channel behind, black e-coat with light surface rust, riveted and bolted brackets. 34.5 in wide.'],
  ['crossmembers', 'Frame crossmembers', 'Front, engine/suspension, torsion bar, transmission, transfer case, rear-axle and hitch crossmembers.'],
  ['frameLabel', 'Frame build label', 'GM frame label with bar codes on the passenger-side rail; the large number is the axle ratio code (3.73).'],
  ['fuelFilter', 'Fuel filter', 'Fuel filter and priming housing on the driver-side frame rail ahead of the fuel tank (owner-confirmed). Water-in-fuel sensor and drain valve at the bottom.'],
  ['wifSensor', 'Water-in-fuel sensor', 'Float switch in the bowl of the fuel filter with its two-wire pigtail; raises the WATER IN FUEL message.'],
  ['fuelLines', 'Fuel lines', 'Supply and return lines in clips along the driver-side frame rail between the tank, filter and engine.'],
  ['fuelCooler', 'Fuel cooler', 'Thin finned air-to-fuel cooler on the underside near the front crossmember (the supplement says to powerwash the bottom of the vehicle to clean it).'],
  ['fuelTank', 'Fuel tank', '26.0 gal steel tank hung under the driver side ahead of the rear axle, held by two steel straps.'],
  ['tankStraps', 'Fuel tank straps', 'Two steel straps with studs and nuts that carry the tank from the frame.'],
  ['fillerNeck', 'Fuel filler neck and vent hoses', 'Rubber filler hose and vent hose from the tank up to the fuel door on the driver-side bedside.'],
  ['oilPan', 'Engine oil pan', 'Deep cast aluminum pan of the 6.6 L V8, sump behind the front axle line, with drain plug.'],
  ['engineLower', 'Engine lower block and mounts', 'Block skirt, engine mount brackets and rubber isolators on the frame rails.'],
  ['transmission', 'Allison 1000 transmission', 'Cast aluminum bell housing and main case of the 5-speed Allison automatic.'],
  ['transPan', 'Transmission fluid pan', 'Bolted fluid pan with drain plug on the underside of the Allison.'],
  ['transCooler', 'Transmission cooler lines', 'Steel cooler lines from the Allison forward to the radiator.'],
  ['transferCase', 'Transfer case', 'NV/NP 261-type two-speed electronic transfer case with front output on the driver side and its shift motor.'],
  ['tcSkid', 'Transfer case skid plate', 'Stamped steel skid plate under the transfer case, bolted to the crossmembers.'],
  ['frontDriveshaft', 'Front driveshaft', 'One-piece shaft with two U-joints from the transfer case front output to the front differential.'],
  ['rearDriveshaft', 'Rear driveshaft', 'One-piece shaft with U-joints and a slip yoke from the transfer case to the rear axle pinion (no center bearing on the short box).'],
  ['frontDiff', 'Front differential', 'AAM 9.25 in front axle housing, bolted to the frame on the driver side of the oil pan, with the right-side axle tube.'],
  ['cvAxles', 'CV half-shafts', 'Constant velocity half-shafts with rubber boots from the front differential to the hubs.'],
  ['torsionBars', 'Torsion bars', 'Longitudinal torsion bars that replace coil springs; they run rearward from the lower control arm pivots.'],
  ['torsionAdjuster', 'Torsion bar adjusters', 'Adjuster arms and bolts on the torsion bar crossmember that set ride height.'],
  ['lca', 'Lower control arms', 'Stamped steel A-arms with bushings; the torsion bar twists at the rear pivot.'],
  ['uca', 'Upper control arms', 'Upper A-arms on frame brackets.'],
  ['knuckle', 'Steering knuckles and front brakes', 'Cast knuckles, hubs, rotors and calipers (mostly behind the wheel).'],
  ['frontShocks', 'Front shock absorbers', 'Gas shocks from the lower control arm to the frame.'],
  ['swayBar', 'Front stabilizer bar', 'Spring steel anti-roll bar with rubber bushings and end links to the lower control arms.'],
  ['steering', 'Steering linkage', 'Recirculating-ball steering gear on the driver-side rail, pitman arm, relay rod, idler arm and tie rods.'],
  ['rearAxle', 'Rear axle', 'AAM 11.5 in full-floating solid rear axle housing with cast center section, axle tubes, hubs and vent.'],
  ['rearCover', 'Differential cover', 'Pressed steel rear cover with ten bolts and a fill plug.'],
  ['leafSprings', 'Rear leaf springs', 'Multi-leaf springs with an overload leaf, spring plates, U-bolts, front hangers and rear shackles.'],
  ['rearShocks', 'Rear shock absorbers', 'Gas shocks from the axle brackets to the frame.'],
  ['rearBrakes', 'Rear brakes', 'Rotors, calipers and dust shields at the axle ends (behind the wheels).'],
  ['downpipe', 'Turbo downpipe', 'Downpipe from the turbo outlet, descending on the passenger side behind the engine.'],
  ['catalytic', 'Catalytic converter', 'Oxidation catalyst canister in the exhaust beside the transmission.'],
  ['exhaustPipe', 'Exhaust pipe', '4 in exhaust pipe from the catalyst to the muffler, in rubber hangers.'],
  ['muffler', 'Muffler', 'Single large oval muffler.'],
  ['tailpipe', 'Tailpipe', '4 in tailpipe that crosses over the rear axle and exits behind it, plain steel tip (the chrome tip is not stock).'],
  ['exhaustHangers', 'Exhaust hangers', 'Rubber isolator hangers that hold the exhaust to the frame.'],
  ['spareTire', 'Spare tire', 'LT245/75R16 spare on a 16 in steel wheel hung flat under the bed.'],
  ['spareWinch', 'Spare tire winch', 'Hoist and cable that raise the spare; its drive tube reaches the rear bumper.'],
  ['hitch', 'Hitch receiver', '2 in receiver tube on the rear crossmember (no ball mount).'],
  ['towHooks', 'Front tow hooks', 'Frame-mounted recovery hooks; the dyno front straps attach here.'],
  ['rearStrap', 'Rear frame strap points', 'Tie-down tabs under the rear frame ends; the dyno rear straps attach here.'],
  ['brakeLines', 'Brake lines and hoses', 'Steel brake lines in clips along the frame, flexible hoses to the axles.'],
  ['wiring', 'Wiring harness', 'Black corrugated loom along the passenger-side rail.'],
  ['hardware', 'Fasteners', 'Frame rivets and zinc-plated bolts.'],
];
export const UNDERSIDE_LABELS = Object.fromEntries(LBL.map(([k, name, desc]) => [`truck.under.${k}`, { name, desc }]));
const ID = (k) => `truck.under.${k}`;

// ---------------------------------------------------------------------------------------------------------------
// Procedural textures (browser only; in node the materials fall back to flat colors so the builder can be unit tested)
// ---------------------------------------------------------------------------------------------------------------
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function makeTex(kind, n) {
  if (!HAS_DOM) return {};
  const seed = { frame: 11, ecoat: 12, cast: 13, alu: 14, steel: 15, galv: 16, brake: 17 }[kind] || 20;
  const lo = noiseField(n, n, 5, seed, 4, 0.55);
  const mid = noiseField(n, n, 18, seed + 1, 4, 0.55);
  const hi = noiseField(n, n, 96, seed + 2, 3, 0.5);
  const col = canvasFromField(lo, n, n, (v, i) => {
    const m = mid[i], h = hi[i];
    let r, g, b;
    if (kind === 'frame' || kind === 'ecoat') {
      r = 24; g = 25; b = 27; // black e-coat
      const dust = clamp01((v - 0.4) * 1.9) * (kind === 'frame' ? 1 : 0.8);
      r += dust * 58; g += dust * 52; b += dust * 44;
      // surface rust: soft brown patches (never rotted), strongest where the low-frequency noise is high
      const rs = clamp01((m - (kind === 'frame' ? 0.6 : 0.7)) * 3.2) * (0.25 + 0.75 * h) * (0.5 + v);
      r = r * (1 - rs) + (98 + 44 * h) * rs; g = g * (1 - rs) + (52 + 22 * h) * rs; b = b * (1 - rs) + (30 + 10 * h) * rs;
    } else if (kind === 'cast') {
      r = 66; g = 66; b = 68;
      const dust = clamp01((v - 0.4) * 1.6);
      r += dust * 46 + (h - 0.5) * 30; g += dust * 42 + (h - 0.5) * 30; b += dust * 38 + (h - 0.5) * 30;
      const rs = clamp01((m - 0.68) * 5) * 0.8;
      r = r * (1 - rs) + 110 * rs; g = g * (1 - rs) + 58 * rs; b = b * (1 - rs) + 30 * rs;
    } else if (kind === 'alu') {
      r = 150; g = 152; b = 154;
      const oil = clamp01((m - 0.55) * 2.2);
      r *= 1 - oil * 0.28; g *= 1 - oil * 0.28; b *= 1 - oil * 0.26;
      const dust = clamp01((v - 0.5) * 1.5);
      r += dust * 22 + (h - 0.5) * 28; g += dust * 18 + (h - 0.5) * 28; b += dust * 12 + (h - 0.5) * 28;
    } else if (kind === 'steel') {
      r = 104; g = 100; b = 95; // aluminized / bare steel, heat tinted and lightly rusty
      const rs = clamp01((m - 0.55) * 3.0) * (0.35 + 0.65 * h);
      r = r * (1 - rs) + (112 + 30 * h) * rs; g = g * (1 - rs) + (66 + 20 * h) * rs; b = b * (1 - rs) + (40 + 10 * h) * rs;
      const dust = clamp01((v - 0.5) * 1.2);
      r += dust * 24; g += dust * 22; b += dust * 18;
    } else if (kind === 'galv') {
      r = 128; g = 130; b = 132; // galvanized tank steel with spangle noise, dust, a little white rust and rust at the seams
      r += (h - 0.5) * 26; g += (h - 0.5) * 26; b += (h - 0.5) * 26;
      const dust = clamp01((v - 0.38) * 1.7);
      r = r * (1 - dust * 0.4) + dust * 40; g = g * (1 - dust * 0.4) + dust * 36; b = b * (1 - dust * 0.4) + dust * 30;
      const rs = clamp01((m - 0.74) * 5) * 0.5;
      r = r * (1 - rs) + 112 * rs; g = g * (1 - rs) + 66 * rs; b = b * (1 - rs) + 36 * rs;
    } else { // brake rotor / leaf steel
      r = 92; g = 82; b = 76;
      const rs = clamp01((m - 0.5) * 2.5) * 0.7;
      r = r * (1 - rs) + 112 * rs; g = g * (1 - rs) + 66 * rs; b = b * (1 - rs) + 42 * rs;
      r += (h - 0.5) * 22; g += (h - 0.5) * 22; b += (h - 0.5) * 22;
    }
    return [r, g, b];
  });
  const bump = canvasFromField(hi, n, n, (v, i) => { const x = (v * 0.35 + mid[i] * 0.65) * 255; return [x, x, x]; });
  return { map: tex(col, { aniso: 4 }), bump: tex(bump, { srgb: false, aniso: 2 }) };
}

// Spare tire sidewall: embossed lettering (bump) on black rubber; tread pattern. v runs along the profile.
function makeTireTex(n) {
  if (!HAS_DOM) return {};
  const w = n * 2, h = n;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#101010'; g.fillRect(0, 0, w, h);
  const bump = makeCanvas(w, h), b = bump.getContext('2d');
  b.fillStyle = '#808080'; b.fillRect(0, 0, w, h);
  const r = rng(5);
  // tread blocks (v from 0.40 to 0.60)
  for (let i = 0; i < 60; i++) {
    const x0 = (i / 60) * w;
    for (const [v0, v1, off] of [[0.4, 0.5, 0], [0.5, 0.6, 0.5]]) {
      b.fillStyle = '#d8d8d8';
      b.fillRect(x0 + (off + 0.08) * (w / 60), v0 * h + 3, (w / 60) * 0.7, (v1 - v0) * h - 6);
    }
  }
  // sidewall lettering at v about 0.2 (lower sidewall, the one that faces down) and 0.8
  const txt = (s, y, size) => {
    for (const ctx of [b]) {
      ctx.save(); ctx.fillStyle = '#e8e8e8'; ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`; ctx.textBaseline = 'middle';
      for (let k = 0; k < 2; k++) ctx.fillText(s, (k * 0.5) * w + w * 0.04, y);
      ctx.restore();
    }
    g.save(); g.fillStyle = 'rgba(70,70,70,0.55)'; g.font = `bold ${size}px Arial, Helvetica, sans-serif`; g.textBaseline = 'middle';
    for (let k = 0; k < 2; k++) g.fillText(s, (k * 0.5) * w + w * 0.04, y);
    g.restore();
  };
  txt('LT245/75R16  E  LOAD RANGE E', h * 0.2, Math.round(h * 0.05));
  txt('LT245/75R16  E  LOAD RANGE E', h * 0.8, Math.round(h * 0.05));
  // dust and brownish road film on the face and a gradient
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${90 + r() * 40},${80 + r() * 30},${64 + r() * 30},${r() * 0.05})`;
    g.fillRect(r() * w, r() * h, 10 + r() * 80, 4 + r() * 20);
  }
  return { map: tex(c, { aniso: 4 }), bump: tex(bump, { srgb: false, aniso: 4 }) };
}

function makeLabelTex() {
  if (!HAS_DOM) return {};
  const c = makeCanvas(512, 320), g = c.getContext('2d');
  g.fillStyle = '#e9e6dc'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#141414';
  const r = rng(77);
  // bar codes
  for (let row = 0; row < 4; row++) {
    let x = 150 + row * 6;
    for (let i = 0; i < 70; i++) { const wd = 1 + Math.floor(r() * 4); if (r() > 0.45) g.fillRect(x, 24 + row * 58, wd, 40); x += wd + 1 + Math.floor(r() * 2); if (x > 490) break; }
    g.font = '10px monospace'; g.fillText(`${(9610909 + row * 3517).toString()} 44TMYA${row}0${(r() * 9999) | 0}`, 152, 76 + row * 58);
  }
  g.font = 'bold 190px Arial, Helvetica, sans-serif'; g.save(); g.translate(46, 300); g.rotate(-Math.PI / 2); g.fillText('73', 0, 0); g.restore();
  g.fillStyle = 'rgba(120,100,70,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(r() * 512, r() * 320, 20 + r() * 80, 6 + r() * 30);
  return { map: tex(c, { wrap: false, aniso: 4 }) };
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry batching: parts are added in inches under the current label; finalised to meters, one merged mesh per
// (label, material), with metric box-projected UVs so the grime textures keep a constant scale.
// ---------------------------------------------------------------------------------------------------------------
const KEEP_UV = new Set(['tire', 'sticker']);
const ALIAS = { plug: 'zinc', bronze: 'zinc', hose: 'rubber', wire: 'rubber' };
const ONE = new V3(1, 1, 1);
const FILL_INTENSITY = 4.0; // candela of each floor-bounce spot (tuned by eye against the shop lighting)
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3();
const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'XYZ')), ONE);
const Y_AXIS = new V3(0, 1, 0);
const toV = (a) => (a.isVector3 ? a : new V3(a[0], a[1], a[2]));

function boxProject(g, tile) {
  const p = g.attributes.position, uv = g.attributes.uv;
  const a = new V3(), b = new V3(), c = new V3(), n = new V3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let j = 0; j < 3; j++) {
      const x = p.getX(i + j), y = p.getY(i + j), z = p.getZ(i + j);
      let u, v;
      if (ax >= ay && ax >= az) { u = z; v = y; } else if (ay >= az) { u = x; v = z; } else { u = x; v = y; }
      uv.setXY(i + j, u / tile, v / tile);
    }
  }
}

function makeBatch(alias) {
  const buckets = new Map();
  let cur = null;
  let tris = 0;
  return {
    label(l) { cur = l; },
    add(matKey, geom, m) {
      matKey = (alias && alias[matKey]) || ALIAS[matKey] || matKey; // fewer materials = fewer draw calls
      const g = geom.index ? geom.toNonIndexed() : geom.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (m) g.applyMatrix4(m);
      const key = `${cur}|${matKey}`;
      let b = buckets.get(key);
      if (!b) { b = { label: cur, matKey, geoms: [] }; buckets.set(key, b); }
      b.geoms.push(g);
      tris += g.attributes.position.count / 3;
      return g;
    },
    get tris() { return tris; },
    finalize(materials, parent) {
      const groups = new Map();
      for (const b of buckets.values()) {
        const merged = mergeGeometries(b.geoms, false);
        merged.scale(INCH, INCH, INCH);
        if (!KEEP_UV.has(b.matKey)) boxProject(merged, 0.5);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, materials[b.matKey]);
        mesh.name = `${b.label || 'misc'}:${b.matKey}`;
        mesh.receiveShadow = true;
        let grp = groups.get(b.label);
        if (!grp) {
          grp = new THREE.Group();
          grp.name = b.label || 'misc';
          if (b.label) grp.userData.labelId = b.label;
          groups.set(b.label, grp);
          parent.add(grp);
        }
        grp.add(mesh);
      }
      return groups;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------------------------------------------
export function buildUnderside({ quality } = {}) {
  const texSize = Math.min((quality && quality.tex) || 512, 1024);
  const lod = !quality ? 1 : quality.tex >= 2048 ? 2 : quality.tex >= 1024 ? 1 : 0;
  const S = (n) => Math.max(8, Math.round(n * (lod === 0 ? 0.7 : lod === 1 ? 0.9 : 1.15)));

  const group = new THREE.Group(); group.name = 'underside';
  const B = makeBatch(lod === 0 ? { ecoat: 'frame', paintBlk: 'frame', brakeLine: 'zinc', fuelLine: 'rubber', undercoat: 'rubber', brake: 'cast', galv: 'galv' } : null);
  const L = (k) => B.label(k ? ID(k) : null);

  // ---------------- materials ----------------
  const T = {};
  for (const k of ['frame', 'ecoat', 'cast', 'alu', 'steel', 'galv', 'brake']) T[k] = makeTex(k, texSize);
  const tireTex = makeTireTex(texSize);
  const labelTex = makeLabelTex();
  const std = (opts, t) => {
    const m = new THREE.MeshStandardMaterial({ envMapIntensity: 0.9, side: THREE.DoubleSide, ...opts });
    if (t && t.map) { m.map = t.map; m.color.set(0xffffff); }
    if (t && t.bump) { m.bumpMap = t.bump; m.bumpScale = 0.35; }
    return m;
  };
  const materials = {
    frame: std({ color: 0x2b2a29, roughness: 0.74, metalness: 0.35 }, T.frame),
    ecoat: std({ color: 0x25262a, roughness: 0.62, metalness: 0.35 }, T.ecoat),
    cast: std({ color: 0x59595b, roughness: 0.62, metalness: 0.7 }, T.cast),
    alu: std({ color: 0x86888a, roughness: 0.58, metalness: 0.7 }, T.alu),
    steel: std({ color: 0x66625e, roughness: 0.6, metalness: 0.5 }, T.steel),
    undercoat: std({ color: 0x0c0c0d, roughness: 0.3, metalness: 0.15, envMapIntensity: 1.0 }),
    galv: std({ color: 0x74777a, roughness: 0.55, metalness: 0.65 }, T.galv),
    brake: std({ color: 0x70645c, roughness: 0.5, metalness: 0.8 }, T.brake),
    zinc: std({ color: 0xa4a9ad, roughness: 0.38, metalness: 0.85 }),
    rubber: std({ color: 0x121212, roughness: 0.92, metalness: 0, envMapIntensity: 0.4 }),
    hose: std({ color: 0x17171a, roughness: 0.7, metalness: 0, envMapIntensity: 0.5 }),
    paintBlk: std({ color: 0x151618, roughness: 0.42, metalness: 0.4 }),
    chrome: std({ color: 0xd8dade, roughness: 0.14, metalness: 1, envMapIntensity: 1.4 }),
    wheel: std({ color: 0x7c7f80, roughness: 0.55, metalness: 0.5 }),
    hole: std({ color: 0x040404, roughness: 1, metalness: 0, envMapIntensity: 0.1 }),
    tire: std({ color: 0xffffff, roughness: 0.88, metalness: 0, envMapIntensity: 0.4 }, tireTex),
    sticker: std({ color: 0xe9e6dc, roughness: 0.6, metalness: 0 }, labelTex),
    fuelLine: std({ color: 0x1c1c1e, roughness: 0.55, metalness: 0.1 }),
    brakeLine: std({ color: 0x8e8c85, roughness: 0.45, metalness: 0.8 }),
    plug: std({ color: 0x9a9890, roughness: 0.4, metalness: 0.8 }),
    wire: std({ color: 0x222224, roughness: 0.8, metalness: 0 }),
    bronze: std({ color: 0xa57c3a, roughness: 0.4, metalness: 0.85 }),
  };
  if (labelTex.map) { materials.sticker.map = labelTex.map; materials.sticker.color.set(0xffffff); }
  materials.tire.bumpScale = 3.0;

  // ---------------- primitives (inches) ----------------
  const add = (mat, g, m) => B.add(mat, g, m);
  const box = (mat, x, y, z, w, h, d, rot) => add(mat, new THREE.BoxGeometry(w, h, d), M(x, y, z, ...(rot || [])));
  const quatBetween = (a, b) => new THREE.Quaternion().setFromUnitVectors(Y_AXIS, b.clone().sub(a).normalize());
  const tube = (mat, a, b, r, seg = 8, r2 = r, caps = true) => {
    a = toV(a); b = toV(b);
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r2, r, len, S(seg), 1, !caps);
    return add(mat, g, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), quatBetween(a, b), ONE));
  };
  // axis-aligned cylinder: axis 'x' | 'y' | 'z'
  const cyl = (mat, x, y, z, r, len, axis = 'y', seg = 10, r2 = r) => {
    const g = new THREE.CylinderGeometry(r2, r, len, S(seg), 1);
    const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    return add(mat, g, M(x, y, z, ...rot));
  };
  // rectangular beam between two points (w across `up`-perpendicular, h along up)
  const beam = (mat, a, b, w, h, up = [0, 1, 0]) => {
    a = toV(a); b = toV(b);
    const zax = b.clone().sub(a); const len = zax.length(); zax.normalize();
    const u = toV(up).clone();
    const xax = new V3().crossVectors(u, zax); if (xax.lengthSq() < 1e-6) xax.set(1, 0, 0); xax.normalize();
    const yax = new V3().crossVectors(zax, xax).normalize();
    const m = new THREE.Matrix4().makeBasis(xax, yax, zax).setPosition(a.clone().add(b).multiplyScalar(0.5));
    return add(mat, new THREE.BoxGeometry(w, h, len), m);
  };
  const path = (mat, pts, r, seg = 6, step = 3, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(toV), closed, 'centripetal');
    const len = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(2, Math.ceil(len / step)), r, S(seg), closed);
    add(mat, g);
    return curve;
  };
  // lathe about Z (profile [r, zRel]) placed at (x,y,z0)
  const latheZ = (mat, x, y, z0, prof, seg = 20) => {
    const g = new THREE.LatheGeometry(prof.map(([r, d]) => new THREE.Vector2(r, d)), S(seg));
    g.rotateX(Math.PI / 2);
    return add(mat, g, M(x, y, z0));
  };
  // lathe about X (profile [r, xRel])
  const latheX = (mat, x, y, z, prof, seg = 20) => {
    const g = new THREE.LatheGeometry(prof.map(([r, d]) => new THREE.Vector2(r, d)), S(seg));
    g.rotateZ(-Math.PI / 2);
    return add(mat, g, M(x, y, z));
  };
  const latheY = (mat, x, y, z, prof, seg = 20) => {
    const g = new THREE.LatheGeometry(prof.map(([r, d]) => new THREE.Vector2(r, d)), S(seg));
    return add(mat, g, M(x, y, z));
  };
  const rrect = (w, h, r) => {
    const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  // rounded block: shape in XY extruded along Z (depth d) with a bevel; centered at (x,y,z)
  const rbox = (mat, x, y, z, w, h, d, r = 0.5, bev = 0.25, rot) => {
    const g = new THREE.ExtrudeGeometry(rrect(w - 2 * bev, h - 2 * bev, r), { depth: Math.max(0.01, d - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 1, curveSegments: 3 });
    g.translate(0, 0, -(d - 2 * bev) / 2);
    return add(mat, g, M(x, y, z, ...(rot || [])));
  };
  const sphere = (mat, x, y, z, r, sx = 1, sy = 1, sz = 1) => {
    const g = new THREE.SphereGeometry(r, S(10), S(7));
    return add(mat, g, new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion(), new V3(sx, sy, sz)));
  };

  // instanced hardware: hex bolt heads and rivet domes (collected, built at the end)
  const hexList = [], rivetList = [], holeList = [];
  const dirQuat = (dx, dy, dz) => new THREE.Quaternion().setFromUnitVectors(Y_AXIS, new V3(dx, dy, dz).normalize());
  const bolt = (x, y, z, dir = [0, -1, 0], size = 1, roll = 0) => {
    const q = dirQuat(...dir).multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, roll));
    hexList.push(new THREE.Matrix4().compose(new V3(x, y, z), q, new V3(size, size, size)));
  };
  const rivet = (x, y, z, dir = [1, 0, 0], size = 1) => {
    rivetList.push(new THREE.Matrix4().compose(new V3(x, y, z), dirQuat(...dir), new V3(size, size, size)));
  };
  const darkHole = (x, y, z, dir, sx, sy) => { // flat dark ellipse (lightening hole) facing `dir`
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), new V3(...dir).normalize());
    holeList.push(new THREE.Matrix4().compose(new V3(x, y, z), q, new V3(sx, sy, 1)));
  };
  const boltRing = (x, y, z, axis, rad, n, size, phase = 0) => {
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2;
      if (axis === 'z') bolt(x + rad * Math.cos(a), y + rad * Math.sin(a), z, [0, 0, 1], size);
      else if (axis === '-z') bolt(x + rad * Math.cos(a), y + rad * Math.sin(a), z, [0, 0, -1], size);
      else if (axis === 'y') bolt(x + rad * Math.cos(a), y, z + rad * Math.sin(a), [0, -1, 0], size);
      else bolt(x, y + rad * Math.cos(a), z + rad * Math.sin(a), [axis === 'x' ? 1 : -1, 0, 0], size);
    }
  };

  const railBottom = frameBottomY;
  const railTop = (z) => frameBottomY(z) + UNDER.railDepth;
  const D = UNDER.railDepth, RW = UNDER.railWidth, RT = UNDER.railThickness;
  const EXH = UNDER.exhaustSide;

  // ================================================================================================================
  // FRAME RAILS
  // ================================================================================================================
  L('frameRail');
  const railSeg = (sx, z0, z1, boxed) => {
    const sh = new THREE.Shape();
    const X = (u) => sx * (W2 - u); // sx = -1 left rail: x = -W2 + u
    if (boxed) {
      sh.moveTo(X(0), 0); sh.lineTo(X(RW), 0); sh.lineTo(X(RW), D); sh.lineTo(X(0), D); sh.lineTo(X(0), 0);
      const h = new THREE.Path(); h.moveTo(X(RT), RT); h.lineTo(X(RT), D - RT); h.lineTo(X(RW - RT), D - RT); h.lineTo(X(RW - RT), RT); h.lineTo(X(RT), RT);
      sh.holes.push(h);
    } else {
      const pts = [[0, 0], [RW, 0], [RW, RT], [RT, RT], [RT, D - RT], [RW, D - RT], [RW, D], [0, D]];
      sh.moveTo(X(pts[0][0]), pts[0][1]);
      for (let i = 1; i < pts.length; i++) sh.lineTo(X(pts[i][0]), pts[i][1]);
      sh.lineTo(X(pts[0][0]), pts[0][1]);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false });
    g.translate(0, 0, z0);
    const k = (railBottom(z1) - railBottom(z0)) / (z1 - z0);
    const m = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, k, railBottom(z0) - k * z0, 0, 0, 1, 0, 0, 0, 0, 1);
    add('frame', g, m);
  };
  const SEGS = [[UNDER.railFront, 52, true], [52, UNDER.rampStart, false], [UNDER.rampStart, UNDER.rampEnd, false], [UNDER.rampEnd, UNDER.railRear, false]];
  for (const sx of [-1, 1]) for (const [a, b, bx] of SEGS) railSeg(sx, a, b, bx);
  // end plates (front horn and rear end), rail splice plates, cab mount brackets
  for (const sx of [-1, 1]) {
    box('frame', sx * (W2 - RW / 2), railBottom(UNDER.railFront) + D / 2, UNDER.railFront - 0.12, RW, D, 0.25);
    box('frame', sx * (W2 - RW / 2), railBottom(UNDER.railRear) + D / 2, UNDER.railRear + 0.12, RW, D, 0.25);
    // splice plate where the box becomes a C-channel (outside face)
    box('ecoat', sx * (W2 + 0.12), railBottom(52) + D / 2, 52, 0.24, D - 0.4, 7);
    // cab mount brackets (outboard tabs with the rubber puck on top)
    for (const z of [22, 61, 104]) {
      box('ecoat', sx * (W2 + 1.0), railTop(z) - 0.6, z, 2.0, 0.3, 4.2);
      box('ecoat', sx * (W2 + 0.2), railTop(z) - 1.4, z, 0.3, 2.2, 4.2);
      cyl('rubber', sx * (W2 + 1.1), railTop(z) - 0.05, z, 0.9, 0.5, 'y', 10);
    }
  }
  // lightening holes and rivets (instanced)
  const holeZ = [-14, 14, 44, 82, 114, 136, 166];
  for (const sx of [-1, 1]) {
    for (const z of holeZ) {
      const yc = railBottom(z) + D / 2;
      darkHole(sx * (W2 + 0.012), yc, z, [sx, 0, 0], 1.15, 0.8);
    }
    const nRiv = lod === 0 ? 14 : lod === 1 ? 24 : 36;
    for (let i = 0; i < nRiv; i++) {
      const z = 56 + (i / (nRiv - 1)) * 134;
      for (const f of [0.18, 0.82]) rivet(sx * (W2 + 0.01), railBottom(z) + f * D, z, [sx, 0, 0], 1);
    }
  }

  // frame label sticker (IMG_2856): passenger-side rail (free of fuel lines), outside web
  {
    const g = new THREE.PlaneGeometry(5.6, 3.9);
    const lbl = new THREE.Matrix4().compose(new V3(W2 + 0.03, railBottom(71) + D / 2, 71), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), ONE);
    L('frameLabel'); add('sticker', g, lbl);
  }

  // ================================================================================================================
  // CROSSMEMBERS
  // ================================================================================================================
  L('crossmembers');
  // U-channel crossmember (open up) spanning the rails, hung below them on end brackets. yTop is absolute (inches).
  const hangCross = (z, yTop, h, depth, xHalf = W2 - RW - 0.05) => {
    const t = 0.25, yb = yTop - h;
    box('frame', 0, yb + t / 2, z, 2 * xHalf, t, depth); // floor
    box('frame', 0, (yb + yTop) / 2, z - depth / 2 + t / 2, 2 * xHalf, h, t);
    box('frame', 0, (yb + yTop) / 2, z + depth / 2 - t / 2, 2 * xHalf, h, t);
    for (const dz of [-1, 1]) box('frame', 0, yTop - t / 2, z + dz * (depth / 2 + 0.4), 2 * xHalf, t, 0.9); // flanges
    const yr = railBottom(z);
    for (const sx of [-1, 1]) { // end brackets up to the rail bottom
      box('ecoat', sx * (xHalf + 0.12), (yb + yr) / 2, z, 0.25, yr - yb - 0.04, depth + 1.8);
      for (const dz of [-depth / 2 - 0.1, depth / 2 + 0.1]) bolt(sx * (xHalf + 0.3), (yb + yTop) / 2, z + dz, [sx, 0, 0], 1.0);
    }
  };
  // front crossmember (box tube under the radiator support)
  {
    const z = -26, yb = 15.4, h = 4.8;
    rbox('frame', 0, yb + h / 2, z, 2 * (W2 - RW) , h, 4.2, 0.5, 0.25);
    for (const sx of [-1, 1]) { box('ecoat', sx * (W2 - RW - 0.2), yb + h / 2 + 0.6, z, 0.3, h + 1.4, 5.6); }
  }
  hangCross(-10, railBottom(-10) - 0.3, 3.4, 3.8); // engine / front suspension crossmember
  hangCross(36.5, 14.2, 3.8, 4.2); // torsion bar crossmember
  hangCross(68, 14.8, 3.8, 4.2); // transmission crossmember
  hangCross(91.5, 13.4, 3.6, 4.2); // transfer case crossmember
  // rear-axle / fuel tank crossmember (box tube between the rails behind the tank)
  {
    const z = 132;
    box('undercoat', 0, railBottom(z) + 2.9, z, 2 * (W2 - RW) - 0.1, 4.8, 3.6);
    for (const dz of [-1.2, 1.2]) for (const sx of [-1, 1]) bolt(sx * (W2 - RW - 0.2), railBottom(z) + 3.6, z + dz, [sx, 0, 0], 1);
  }
  // hitch crossmember with side plates
  {
    const z = 191.5;
    box('undercoat', 0, railBottom(z) + 2.5, z, 2 * (W2 - RW) - 0.1, 5.0, 3.4);
    for (const sx of [-1, 1]) {
      box('ecoat', sx * (W2 - RW - 0.2), railBottom(z) + 2.5, z, 0.3, 5.6, 4.0);
    }
  }

  // ================================================================================================================
  // ENGINE LOWER, OIL PAN, MOUNTS
  // ================================================================================================================
  const ENG_Y = 21.3; // crank / trans axis height (estimated)
  L('oilPan');
  {
    // shallow front section (timing cover side) and deep rear sump (4WD: the front axle passes under the front part)
    rbox('alu', 0, 20.2, -7, 21.8, 2.6, 22, 0.8, 0.3); // front pan, bottom y ~ 18.9
    rbox('alu', 0, 16.0, 14.6, 13.0, 11.6, 23.2, 1.2, 0.35); // deep sump y 10.2..21.8
    // fins / ribs on the sump sides
    for (let i = 0; i < 6; i++) {
      const z = 5.5 + i * 3.6;
      box('alu', 0, 15.2, z, 13.9, 6.4, 0.45);
    }
    // flange bolts
    for (let i = 0; i < 12; i++) { const z = -17 + i * 3.4; for (const sx of [-1, 1]) bolt(sx * 10.2, 19.0, z, [0, -1, 0], 0.8); }
    // oil drain plug (rear of the sump bottom) and a little oil seep
    cyl('plug', 0, 9.95, 22.5, 0.72, 0.5, 'y', 6);
    box('hole', 0, 10.18, 22.5, 1.3, 0.05, 1.3);
  }
  L('engineLower');
  {
    // block skirt (cast iron)
    rbox('cast', 0, 23.4, 3.0, 23.2, 3.2, 44, 0.8, 0.3);
    // oil filter canister / bell flange hint kept under the block; engine mount brackets on the rails
    for (const sx of [-1, 1]) {
      box('ecoat', sx * 12.9, 21.2, 5, 2.6, 0.4, 7);
      box('ecoat', sx * 14.2, 18.9, 5, 0.4, 5.4, 7);
      cyl('rubber', sx * 12.6, 22.4, 5, 1.8, 1.8, 'y', 12);
      bolt(sx * 14.4, 21.2, 7.5, [sx, 0, 0], 1.1); bolt(sx * 14.4, 21.2, 2.5, [sx, 0, 0], 1.1);
    }
  }

  // ================================================================================================================
  // TRANSMISSION (Allison 1000), TRANSFER CASE
  // ================================================================================================================
  L('transmission');
  {
    // bell housing + main case as one lathe about the engine axis
    const prof = [];
    // [r, zRel from z=27]
    const P = [[0, 0], [7.5, 0], [7.5, 0.6], [7.0, 0.8], [7.1, 7.2], [6.4, 7.8], [6.3, 10], [6.6, 10.4], [6.6, 12.6], [6.3, 13], [6.3, 18], [6.6, 18.4], [6.6, 20.6], [6.3, 21], [6.3, 31], [5.2, 31.6], [4.0, 33], [4.0, 38.6], [4.6, 38.8], [4.6, 40], [0, 40]];
    latheZ('alu', 0, ENG_Y, 27, P, 28);
    // bell flange bolts (engine side) and a few case bolts
    boltRing(0, ENG_Y, 27, 'z', 7.25, 10, 1.0, 0.2);
    // valve body bulge and lower flatten
    rbox('alu', 0, ENG_Y - 5.2, 50, 11.6, 3.0, 24, 1.2, 0.35);
    rbox('alu', 3.2, ENG_Y + 1.5, 51, 5.8, 8, 16, 1.0, 0.3);
    // dipstick / fill tube on the driver side
    tube('steel', [-5.2, ENG_Y + 3.5, 46], [-6.8, ENG_Y + 9, 44], 0.45, 6);
  }
  L('transPan');
  {
    const z0 = 40.6, z1 = 61.4, y0 = 10.7, y1 = ENG_Y - 5.9;
    rbox('steel', 0, (y0 + y1) / 2, (z0 + z1) / 2, 12.6, y1 - y0, z1 - z0, 1.0, 0.3);
    box('steel', 0, y1 - 0.1, (z0 + z1) / 2, 14.0, 0.5, z1 - z0 + 1.4); // pan rail flange
    for (let i = 0; i < 9; i++) { const z = z0 - 0.2 + i * ((z1 - z0 + 0.4) / 8); for (const sx of [-1, 1]) bolt(sx * 6.6, y1 + 0.25, z, [0, -1, 0], 0.7); }
    for (const sx of [-1, 1]) for (const z of [z0 - 0.4, z1 + 0.4]) bolt(sx * 6.6, y1 + 0.25, z, [0, -1, 0], 0.7);
    // drain plug on the pan bottom, rear corner; oily seep ring
    cyl('plug', 3.2, y0 - 0.3, z1 - 3, 0.75, 0.6, 'y', 6);
    box('hole', 3.2, y0 - 0.64, z1 - 3, 1.6, 0.04, 1.6);
    // pan stiffener ribs
    for (const dz of [-5, 0, 5]) box('steel', 0, y0 - 0.02, (z0 + z1) / 2 + dz, 10, 0.18, 0.7);
  }
  L('transferCase');
  {
    // NP261: main housing, front output nose on the driver side, rear output, shift motor on the passenger side
    const zc = 82.5, yc = 19.4;
    rbox('alu', 0, yc, zc, 10.4, 9.6, 21, 2.2, 0.5);
    rbox('alu', 0, yc - 1.8, zc + 2, 9.2, 4, 22, 1.5, 0.35);
    // flange to the transmission tail
    latheZ('alu', 0, ENG_Y, 66, [[0, 0], [4.7, 0], [4.7, 1.2], [4.0, 1.4], [4.0, 6], [0, 6]], 16);
    // rear output housing
    latheZ('alu', 0, 18.3, 92.5, [[0, 0], [3.6, 0], [3.6, 1.0], [2.8, 1.3], [2.8, 3.6], [0, 3.6]], 16);
    // front output nose (driver side, low)
    cyl('alu', -7.0, 16.9, 73.6, 2.0, 5.5, 'z', 12);
    // shift motor (encoder motor) on the right rear
    rbox('paintBlk', 5.2, 21.6, 90, 3.4, 4.6, 5.2, 0.6, 0.25);
    box('rubber', 6.9, 22.0, 90, 0.5, 2.0, 3.0);
    // vent + bolts around the cover
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; bolt(-5.35 * 1, yc + 3.2 * Math.cos(a), zc - 8 + 2 * Math.sin(a) * 0 + (i % 4) * 3.5, [-1, 0, 0], 0.9); }
    for (let i = 0; i < 8; i++) { bolt(5.35, yc + (i % 2 ? 2.8 : -2.8), zc - 8 + Math.floor(i / 2) * 5, [1, 0, 0], 0.9); }
    // casting ribs
    for (let i = 0; i < 4; i++) box('alu', 0, yc + 4.9, zc - 7.5 + i * 5, 7.0, 0.5, 0.5);
  }
  L('tcSkid');
  {
    const z0 = 70.6, z1 = 89.2, yb = 11.4, w = 11.8;
    box('ecoat', 0, yb, (z0 + z1) / 2, w, 0.22, z1 - z0);
    for (const sx of [-1, 1]) box('ecoat', sx * (w / 2), yb + 1.4, (z0 + z1) / 2, 0.22, 2.9, z1 - z0);
    box('ecoat', 0, yb + 1.4, z0, w, 2.9, 0.22);
    for (let i = 0; i < 6; i++) bolt(-w / 2 + 1 + i * ((w - 2) / 5), yb - 0.1, z0 + 0.7, [0, -1, 0], 0.7);
    for (let i = 0; i < 6; i++) bolt(-w / 2 + 1 + i * ((w - 2) / 5), yb - 0.1, z1 - 0.7, [0, -1, 0], 0.7);
    // embossed ribs
    for (let i = 0; i < 3; i++) box('ecoat', 0, yb - 0.1, z0 + 5 + i * 4.5, w - 2, 0.2, 0.9);
  }
  L('crossmembers');
  { // trans mount pad and tcase mount block on their crossmembers
    cyl('rubber', 0, 16.0, 68, 1.8, 2.4, 'y', 12);
    cyl('rubber', 0, 14.0, 91.5, 1.8, 1.2, 'y', 12);
  }
  L('transCooler');
  {
    // two steel cooler lines from the case (driver side) forward along the inside of the driver rail to the radiator
    for (const [dz, dy] of [[0, 0], [1.1, 0.8]]) {
      path('brakeLine', [[-6.3, 22.2 + dy, 38], [-8.4, 21.6 + dy, 33], [-12.0, 21.0 + dy, 27], [-12.8, 20.6 + dy, 12], [-12.8, 20.5 + dy, -14], [-11.2, 21.8 + dy, -24], [-9.6, 24 + dy, -29]], 0.3, 6, 2.5);
    }
    for (const [dy, zz] of [[0, 38], [0.8, 38.4]]) { box('zinc', -6.2, 22.2 + dy, zz, 0.9, 0.5, 0.5); }
    for (const z of [30, 8, -10]) box('ecoat', -12.9, 21.1, z, 0.4, 1.8, 0.8);
  }

  // ================================================================================================================
  // FRONT SUSPENSION (IFS with torsion bars), FRONT DIFFERENTIAL, STEERING
  // ================================================================================================================
  const FA_Y = UNDER.wheelCenterY;
  const trackF = UNDER.trackFrontIn / 2; // 34.3
  const KX = 27.2; // knuckle x
  L('lca');
  for (const sx of [-1, 1]) {
    const pf = [sx * 15.8, 12.5, -7], pr = [sx * 15.8, 12.5, 11], bj = [sx * KX, 10.4, 1.4];
    beam('ecoat', pf, bj, 2.8, 0.9, [0, 1, 0]); beam('ecoat', pr, bj, 2.8, 0.9, [0, 1, 0]);
    box('ecoat', sx * 21.5, 11.6, 3.2, 8.5, 0.45, 5.0); // web between the legs
    // pivot bushings (rubber) and bolts
    for (const p of [pf, pr]) { cyl('rubber', p[0], p[1], p[2], 1.35, 2.6, 'x', 12); bolt(p[0] + sx * 1.7, p[1], p[2], [sx, 0, 0], 1.2); }
    // lower ball joint
    cyl('zinc', bj[0], bj[1] + 0.4, bj[2], 0.95, 1.8, 'y', 10);
    // pivot brackets hanging from the rail bottom
    for (const p of [pf, pr]) box('ecoat', p[0], (p[1] + railBottom(p[2])) / 2, p[2], 3.0, railBottom(p[2]) - p[1] - 1.2, 0.35);
    box('ecoat', sx * 15.8, 14.8, -7, 3.6, 0.35, 2.6); box('ecoat', sx * 15.8, 14.8, 11, 3.6, 0.35, 2.6);
  }
  L('uca');
  for (const sx of [-1, 1]) {
    const pf = [sx * 18.4, 26.0, -6], pr = [sx * 18.4, 26.0, 6], bj = [sx * KX, 25.4, 0];
    beam('ecoat', pf, bj, 1.8, 1.0); beam('ecoat', pr, bj, 1.8, 1.0);
    cyl('rubber', pf[0], pf[1], pf[2], 1.1, 2.0, 'x', 10); cyl('rubber', pr[0], pr[1], pr[2], 1.1, 2.0, 'x', 10);
    cyl('zinc', bj[0], bj[1] - 0.2, bj[2], 0.8, 1.4, 'y', 10);
    box('ecoat', sx * 17.85, 24.2, 0, 1.1, 5.4, 14); // frame bracket on the rail side
  }
  L('knuckle');
  for (const sx of [-1, 1]) {
    rbox('cast', sx * KX, 17.4, 1.0, 2.6, 17.0, 4.8, 0.8, 0.3); // knuckle body
    // steering arm toward the front, tie rod end
    beam('cast', [sx * KX, 11.4, 1.5], [sx * 26.4, 10.4, -7.8], 1.2, 1.2);
    // hub / rotor / caliper
    latheX('cast', sx * (KX + 1.2), FA_Y, 0, sx > 0 ? [[0, 0], [2.4, 0], [2.4, 3.2], [0, 3.2]] : [[0, 0], [2.4, 0], [2.4, -3.2], [0, -3.2]], 16);
    cyl('brake', sx * 29.1, FA_Y, 0, 6.5, 1.3, 'x', 28);
    cyl('cast', sx * 28.2, FA_Y, 0, 3.4, 1.6, 'x', 18);
    // caliper (rear-top of the rotor)
    rbox('paintBlk', sx * 29.0, FA_Y + 4.6, 4.2, 3.6, 5.4, 3.0, 0.5, 0.2);
    // brake hose from the frame
    path('hose', [[sx * 17.4, 15.2, -2], [sx * 19.5, 12.0, -3], [sx * 24, 12.6, 2.6], [sx * 28.6, 17.5, 4.6]], 0.28, 6, 2);
    bolt(sx * 17.4, 15.2, -2, [sx, 0, 0], 0.7);
    // dust shield
    cyl('ecoat', sx * 27.9, FA_Y, 0, 6.9, 0.18, 'x', 24);
  }

  L('torsionBars');
  for (const sx of [-1, 1]) {
    tube('steel', [sx * 15.8, 12.5, 11], [sx * 15.8, 12.5, 34.2], 0.72, 10);
    // hex ends
    cyl('zinc', sx * 15.8, 12.5, 11.4, 1.0, 1.2, 'z', 6);
    cyl('zinc', sx * 15.8, 12.5, 34.2, 1.0, 1.2, 'z', 6);
  }
  L('torsionAdjuster');
  for (const sx of [-1, 1]) {
    // adjuster arm from the bar end down and inboard, bolt up into the crossmember bracket
    beam('ecoat', [sx * 15.8, 12.5, 34.6], [sx * 12.3, 8.6, 36.4], 1.6, 1.0);
    cyl('ecoat', sx * 15.8, 12.5, 35.0, 1.4, 1.2, 'z', 10);
    tube('zinc', [sx * 12.3, 8.6, 36.4], [sx * 12.3, 15.2, 36.4], 0.5, 6);
    cyl('zinc', sx * 12.3, 8.3, 36.4, 0.95, 0.7, 'y', 6);
    cyl('zinc', sx * 12.3, 9.8, 36.4, 0.95, 0.5, 'y', 6);
    box('ecoat', sx * 13.5, 14.0, 36.5, 2.8, 0.35, 3.4);
  }

  // front shocks
  L('frontShocks');
  for (const sx of [-1, 1]) {
    const lo = new V3(sx * 22.8, 11.8, 2.6), up = new V3(sx * 19.6, 27.2, 2.0);
    const dir = up.clone().sub(lo).normalize(); const len = lo.distanceTo(up);
    const at = (t) => lo.clone().addScaledVector(dir, len * t);
    tube('paintBlk', at(0.0), at(0.48), 1.1, 12); // reservoir tube
    tube('chrome', at(0.46), at(0.82), 0.42, 8); // rod
    tube('paintBlk', at(0.82), at(0.95), 0.75, 8);
    tube('rubber', at(0.42), at(0.52), 1.25, 12); // dust boot
    // eyes with rubber bushings
    cyl('rubber', lo.x, lo.y, lo.z, 1.0, 1.6, 'z', 10); cyl('rubber', up.x, up.y, up.z, 0.9, 1.6, 'z', 10);
    box('ecoat', sx * 21.2, 11.8, 2.6, 3.0, 0.3, 2.2); // lower tab on the LCA
    box('ecoat', sx * 18.6, 27.0, 2.0, 2.6, 1.8, 0.3);
  }

  // stabilizer bar
  L('swayBar');
  {
    const yb = 13.4, z = -19.5;
    path('steel', [[-14.6, yb, z], [-17.5, yb, z - 0.2], [-21.8, yb, -17], [-23.0, yb, -9], [-22.8, yb - 0.2, -2.8]], 0.62, 8, 1.5);
    path('steel', [[14.6, yb, z], [17.5, yb, z - 0.2], [21.8, yb, -17], [23.0, yb, -9], [22.8, yb - 0.2, -2.8]], 0.62, 8, 1.5);
    tube('steel', [-14.6, yb, z], [14.6, yb, z], 0.62, 8);
    for (const sx of [-1, 1]) {
      // frame bushings and brackets
      cyl('rubber', sx * 12.8, yb, z, 1.05, 2.6, 'x', 10);
      box('ecoat', sx * 12.8, yb + 1.6, z, 2.8, 0.3, 2.2);
      box('ecoat', sx * 12.8, yb + 0.85, z + 1.2, 2.8, 1.8, 0.3);
      // end links
      tube('zinc', [sx * 22.8, yb - 0.2, -2.8], [sx * 22.4, 10.6, -2.8], 0.28, 6);
      cyl('rubber', sx * 22.8, yb - 0.2, -2.8, 0.6, 0.8, 'y', 8);
    }
  }

  // steering gear, pitman, relay rod, idler, tie rods (GMT800 is recirculating-ball, not rack and pinion)
  L('steering');
  {
    const zr = -14.5, yr = 12.6;
    rbox('cast', -19.6, 16.2, -12.0, 5.6, 6.4, 8.0, 0.9, 0.3); // gearbox
    cyl('cast', -19.6, 13.0, -10.8, 1.4, 3.6, 'y', 10);
    beam('cast', [-19.6, 12.6, -10.8], [-11.0, yr, zr], 1.6, 1.3); // pitman arm
    tube('steel', [-11.0, yr, zr], [12.6, yr, zr], 0.65, 8); // relay rod
    for (const sx of [-1, 1]) { // inner tie rod ends and tie rods to the knuckles
      const inner = [sx * 11.2, yr, zr]; const outer = [sx * 26.4, 10.4, -7.8];
      tube('steel', inner, outer, 0.5, 8);
      sphere('zinc', inner[0], inner[1], inner[2], 0.85); sphere('zinc', outer[0], outer[1], outer[2], 0.8);
      const mid = new V3(...inner).lerp(new V3(...outer), 0.55);
      tube('zinc', mid.clone().sub(new V3(sx * 1.6, 0.1, -0.2).multiplyScalar(0.8)), mid.clone().add(new V3(sx * 1.6, 0.1, -0.2).multiplyScalar(0.8)), 0.8, 6); // adjuster sleeve
    }
    // idler arm on the passenger rail
    box('ecoat', 16.2, 14.6, -14.0, 3.0, 2.8, 0.35);
    beam('ecoat', [16.2, 14.0, -14.2], [12.6, yr, zr], 1.6, 1.0);
    cyl('rubber', 16.2, 13.8, -14.2, 1.2, 1.5, 'y', 10);
  }

  // ---------------- front differential and axle shafts ----------------
  L('frontDiff');
  {
    const dx = -9.3, dz = 0.6;
    rbox('alu', dx, FA_Y, dz, 9.0, 10.2, 8.6, 2.2, 0.55);
    // cover facing forward, domed
    latheZ('alu', dx, FA_Y, dz - 4.0, [[0, -1.2], [2.2, -1.1], [3.6, -0.7], [4.4, 0], [4.8, 0.5], [0, 0.5]], 24);
    boltRing(dx, FA_Y, dz - 4.35, '-z', 4.4, 10, 0.75, 0.3);
    cyl('plug', dx + 0.8, FA_Y + 1.8, dz - 5.1, 0.5, 0.5, 'z', 6);
    // pinion snout toward the rear and the yoke
    cyl('alu', dx, FA_Y + 0.4, dz + 6.4, 1.9, 4.4, 'z', 12);
    // left carrier boss and right tube (long, under the front of the oil pan)
    cyl('alu', dx - 4.2, FA_Y, dz, 1.7, 3.2, 'x', 12);
    tube('cast', [dx + 4.0, FA_Y, dz], [15.9, FA_Y, dz], 1.4, 12, 1.4);
    cyl('alu', 15.7, FA_Y, dz, 1.5, 1.6, 'x', 12);
    // mounting bosses to the frame (left) and a rear stay
    box('ecoat', dx - 3.6, FA_Y + 5.6, dz + 0.5, 2.8, 2.4, 3.0);
    box('ecoat', dx, FA_Y + 5.8, dz + 3.4, 6.0, 0.4, 3.2);
    bolt(dx, FA_Y + 6.1, dz + 4.5, [0, 1, 0], 1.0); bolt(dx - 3.6, FA_Y + 6.9, dz + 0.5, [0, 1, 0], 1.0);
  }
  L('cvAxles');
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -14.0 : 16.4, x1 = sx * 26.2;
    const a = new V3(x0, FA_Y, 0.6), b = new V3(x1, FA_Y - 0.3, 0.9);
    tube('steel', a.clone().lerp(b, 0.12), a.clone().lerp(b, 0.88), 0.7, 8);
    // inner tripod housing + boot, outer CV boot
    const i1 = a.clone(), i2 = a.clone().lerp(b, 0.30);
    tube('rubber', i1, i2, 1.4, 12, 0.9);
    tube('rubber', a.clone().lerp(b, 0.66), a.clone().lerp(b, 1.0), 0.9, 12, 1.7);
    // boot clamps
    for (const t of [0.04, 0.3, 0.66, 0.96]) { const p = a.clone().lerp(b, t); cyl('zinc', p.x, p.y, p.z, 1.05 + (t > 0.5 ? 0.3 : 0.2), 0.35, 'x', 12); }
  }

  // ================================================================================================================
  // DRIVESHAFTS (rotating groups, built separately below) - only fixed yokes here
  // ================================================================================================================

  // ================================================================================================================
  // REAR AXLE (AAM 11.5 full-floating), SPRINGS, SHOCKS
  // ================================================================================================================
  const RZ = UNDER.wheelbaseIn; // 153
  const RY = UNDER.wheelCenterY;
  const trackR = UNDER.trackRearIn / 2; // 33
  L('rearAxle');
  {
    // center casting (nodular iron), rounded block
    rbox('cast', 0, RY, RZ - 1.8, 14.4, 12.8, 8.4, 3.4, 0.7);
    // pinion snout forward (slightly above center) with a nose plate
    cyl('cast', 0, RY + 0.9, RZ - 8.2, 2.9, 5.6, 'z', 14);
    cyl('cast', 0, RY + 0.9, RZ - 10.8, 2.2, 1.2, 'z', 12);
    // tapered axle tubes (round, welded into the casting) with brackets, hub, bearing seats
    for (const sx of [-1, 1]) {
      tube('ecoat', [sx * 6.8, RY, RZ], [sx * 15.5, RY, RZ], 2.05, 14, 2.45); // taper
      tube('ecoat', [sx * 15.4, RY, RZ], [sx * 26.0, RY, RZ], 1.78, 14);
      // outer bearing / hub assembly (full floating)
      latheX('cast', sx * 26.0, RY, RZ, sx > 0 ? [[0, 0], [2.4, 0], [3.6, 0.6], [3.6, 2.6], [2.2, 3.2], [2.2, 5.4], [0, 5.4]] : [[0, 0], [2.4, 0], [3.6, -0.6], [3.6, -2.6], [2.2, -3.2], [2.2, -5.4], [0, -5.4]], 20);
      // axle shaft flange with studs
      cyl('zinc', sx * 31.2, RY, RZ, 3.2, 0.7, 'x', 16);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cyl('zinc', sx * 31.9, RY + 2.5 * Math.cos(a), RZ + 2.5 * Math.sin(a), 0.32, 0.9, 'x', 5); }
      // spring perch pads (welded) under the axle
      box('ecoat', sx * 24.0, RY - 1.78 - 0.3, RZ, 3.4, 0.6, 5.4);
    }
    // vent hose: small tube from the housing top toward the passenger rail with a clamp
    path('hose', [[4.6, RY + 6.2, RZ - 1.5], [6.6, RY + 9, RZ - 3], [11.5, RY + 12.8, RZ - 6], [13.9, RY + 12.8, RZ - 7]], 0.22, 6, 2);
    cyl('zinc', 4.6, RY + 6.1, RZ - 1.5, 0.45, 0.5, 'y', 6);
    // casting ribs on the front
    for (const sx of [-1, 1]) { box('cast', sx * 3.3, RY + 1.2, RZ - 6.8, 0.7, 6.0, 0.9); }
    // brake dust shields, rotors and calipers at the ends
  }
  L('rearCover');
  {
    // pressed steel cover facing the rear, flange ring plus dome (cover plane at RZ + 2.6)
    const z0 = RZ + 2.5;
    latheZ('ecoat', 0, RY, z0, [[0, 0], [7.1, 0], [7.0, 0.4], [6.6, 0.55], [6.2, 1.2], [5.3, 2.2], [3.8, 3.0], [2.0, 3.35], [0, 3.4]], 28);
    boltRing(0, RY, z0 + 0.38, 'z', 6.6, 10, 0.95, 0.15);
    // fill plug on the cover (low, right) and a drain-weep stain plate
    cyl('plug', 2.2, RY - 2.3, z0 + 3.1, 0.62, 0.55, 'z', 6);
    box('hole', 0, RY - 5.8, z0 + 1.6, 3.6, 0.04, 1.6);
  }
  L('rearBrakes');
  for (const sx of [-1, 1]) {
    cyl('brake', sx * 29.0, RY, RZ, 6.8, 1.3, 'x', 28);
    cyl('cast', sx * 28.1, RY, RZ, 3.4, 1.6, 'x', 18);
    cyl('ecoat', sx * 27.4, RY, RZ, 7.3, 0.18, 'x', 24); // dust shield / backing plate
    rbox('paintBlk', sx * 29.0, RY + 4.6, RZ + 4.0, 3.6, 5.6, 3.0, 0.5, 0.2);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; bolt(sx * 27.3, RY + 5.5 * Math.cos(a), RZ + 5.5 * Math.sin(a), [sx, 0, 0], 0.7); }
  }

  // leaf springs ---------------------------------------------------------------
  L('leafSprings');
  const leaves = leafPackSpec();
  const SPRING_X = 24.0, SPRING_W = 3.0, PAD_Y = RY - 1.78 - 0.3, SEAT_TOP = PAD_Y - 0.3; // top of the stack at the axle seat
  const CAMBER = 0.7;
  {
    const buildLeaf = (len, t, yOff, sx) => {
      const n = Math.max(8, Math.round(len / 3));
      const pos = [];
      const top = (s) => SEAT_TOP - CAMBER * (1 - (1 - (2 * s) / 58 * (2 * s) / 58)) - yOff; // parabola of the 58 in main leaf
      const w2 = SPRING_W / 2;
      const P = (x, y, z) => [x, y, z];
      const rows = [];
      for (let i = 0; i <= n; i++) {
        const s = -len / 2 + (len * i) / n;
        const y = SEAT_TOP - CAMBER * ((2 * s) / 58) * ((2 * s) / 58) - yOff;
        rows.push({ z: RZ + s, y });
      }
      const quad = (a, b, c, d) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); };
      for (let i = 0; i < n; i++) {
        const r0 = rows[i], r1 = rows[i + 1];
        const tp = (r, x) => P(x, r.y, r.z), bt = (r, x) => P(x, r.y - t, r.z);
        quad(tp(r0, -w2), tp(r1, -w2), tp(r1, w2), tp(r0, w2)); // top
        quad(bt(r0, w2), bt(r1, w2), bt(r1, -w2), bt(r0, -w2)); // bottom
        quad(tp(r0, w2), tp(r1, w2), bt(r1, w2), bt(r0, w2));
        quad(bt(r0, -w2), bt(r1, -w2), tp(r1, -w2), tp(r0, -w2));
      }
      const quadE = (r, flip) => { const a = P(-w2, r.y, r.z), b = P(w2, r.y, r.z), c = P(w2, r.y - t, r.z), d = P(-w2, r.y - t, r.z); if (flip) pos.push(...a, ...b, ...c, ...a, ...c, ...d); else pos.push(...a, ...c, ...b, ...a, ...d, ...c); };
      quadE(rows[0], false); quadE(rows[n], true);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return g;
    };
    let yOff = 0.0;
    for (const sx of [-1, 1]) {
      yOff = 0;
      for (const lf of leaves) {
        const g = buildLeaf(lf.length, lf.thickness, yOff, sx);
        add('steel', g, M(sx * SPRING_X, 0, 0));
        yOff += lf.thickness + 0.02;
      }
      const stackBottom = SEAT_TOP - yOff;
      const xs = sx * SPRING_X;
      // eyes (rolled ends): front and rear
      for (const s of [-29, 29]) {
        const y = SEAT_TOP - CAMBER * ((2 * s) / 58) * ((2 * s) / 58) - 0.2;
        cyl('steel', xs, y, RZ + s, 0.85, SPRING_W, 'x', 10);
        cyl('rubber', xs, y, RZ + s, 0.55, SPRING_W + 0.1, 'x', 8);
      }
      // center bolt, clips (rebound clips) and spring plate
      const plateY = stackBottom - 0.3;
      box('ecoat', xs, plateY, RZ, 5.4, 0.6, 7.2);
      bolt(xs, plateY - 0.4, RZ, [0, -1, 0], 1.0);
      for (const dz of [-9, 9]) { box('zinc', xs, SEAT_TOP - 1.2 - 0.3 * Math.abs(dz) / 9, RZ + dz, SPRING_W + 0.6, 0.15, 0.7); }
      // U-bolts: two, around the axle tube
      for (const dz of [-2.9, 2.9]) {
        const top = RY + 2.15;
        const pts = [];
        const half = SPRING_W / 2 + 0.55;
        pts.push([xs - half, top, RZ + dz], [xs - half, plateY - 0.4, RZ + dz], [xs + half, plateY - 0.4, RZ + dz], [xs + half, top, RZ + dz]);
        // U-bolt as two legs + a connecting bridge across the top of the axle tube
        tube('zinc', [xs - half, plateY - 0.7, RZ + dz], [xs - half, top, RZ + dz], 0.32, 6);
        tube('zinc', [xs + half, plateY - 0.7, RZ + dz], [xs + half, top, RZ + dz], 0.32, 6);
        tube('zinc', [xs - half, top, RZ + dz], [xs + half, top, RZ + dz], 0.32, 6);
        for (const xx of [xs - half, xs + half]) { cyl('zinc', xx, plateY - 0.55, RZ + dz, 0.58, 0.5, 'y', 6); }
      }
      // overload bumper pad (rubber stop on the frame side above)
      // front hanger (bracket on the rail) and rear shackle
      const zf = RZ - 29, zr = RZ + 29;
      const yEye = SEAT_TOP - CAMBER - 0.2;
      for (const off of [-1.95, 1.95]) {
        // front hanger plates
        box('ecoat', xs + off, (yEye + 22.8) / 2, zf, 0.4, 22.8 - yEye + 1.6, 3.4);
        // rear shackle link plates
        box('ecoat', xs + off, (yEye + 18.0) / 2, zr + 1.2, 0.35, 18.0 - yEye + 1.4, 1.5, [0, 0, 0]);
      }
      cyl('zinc', xs, yEye, zf, 0.45, SPRING_W + 4.4, 'x', 8); // front eye bolt
      cyl('zinc', xs, 18.0, zr + 1.2, 0.45, SPRING_W + 4.4, 'x', 8); // hanger pin
      cyl('zinc', xs, yEye, zr, 0.45, SPRING_W + 4.4, 'x', 8); // spring eye bolt (rear)
      // arms from the rail to the hangers
      const railFace = sx * W2;
      box('ecoat', (railFace + xs + sx * 1.95) / 2, 22.2, zf, Math.abs(xs + sx * 1.95 - railFace) + 0.6, 0.4, 4.4);
      box('ecoat', (railFace + xs + sx * 1.95) / 2, 22.2, zr + 1.2, Math.abs(xs + sx * 1.95 - railFace) + 0.6, 0.4, 3.6);
      box('ecoat', railFace + sx * 0.25, 24.2, zf, 0.4, 3.2, 5.2);
      box('ecoat', railFace + sx * 0.25, 24.2, zr + 1.2, 0.4, 3.2, 4.4);
      bolt(xs + sx * 2.2, 22.2, zf, [sx, 0, 0], 1.0);
    }
  }

  L('rearShocks');
  for (const sx of [-1, 1]) {
    const lo = new V3(sx * 27.0, 13.4, RZ + 4.2), up = new V3(sx * 25.6, 28.6, RZ + 5.6);
    const dir = up.clone().sub(lo).normalize(); const len = lo.distanceTo(up);
    const at = (t) => lo.clone().addScaledVector(dir, len * t);
    tube('paintBlk', at(0.0), at(0.52), 1.1, 12);
    tube('chrome', at(0.5), at(0.86), 0.42, 8);
    tube('paintBlk', at(0.86), at(0.96), 0.75, 8);
    cyl('rubber', lo.x, lo.y, lo.z, 1.0, 1.6, 'z', 10); cyl('rubber', up.x, up.y, up.z, 0.9, 1.6, 'z', 10);
    box('ecoat', sx * 27.0, 13.3, RZ + 3.2, 1.4, 2.6, 3.2); // axle bracket
    box('ecoat', sx * 25.6, 28.8, RZ + 5.6, 2.6, 1.8, 0.3);
    box('ecoat', (sx * W2 + sx * 25.6) / 2, 27.7, RZ + 5.6, Math.abs(25.6 - W2) + 0.8, 0.4, 2.6);
  }

  // ================================================================================================================
  // EXHAUST: downpipe, catalyst, pipe, muffler, tailpipe, hangers
  // ================================================================================================================
  const PIPE_R = 2.0; // 4 in exhaust
  const ex = (x) => EXH * x;
  const PX = 11.4; // pipe x (before side mirroring), y
  const PY = 19.6;
  L('downpipe');
  {
    // v-band flange at the turbo outlet (hidden up top) and the descending pipe
    path('steel', [[ex(8.4), 31.5, 16], [ex(9.8), 28.5, 19.5], [ex(11.0), 24.0, 25.5], [ex(PX), 21.0, 31], [ex(PX), PY, 36.5]], PIPE_R, 14, 2.5);
    cyl('zinc', ex(8.4), 31.8, 15.6, 2.7, 0.7, 'z', 16);
  }
  L('catalytic');
  {
    latheZ('steel', ex(PX), PY, 37.5, [[0, 0], [2.0, 0], [2.7, 1.0], [3.1, 2.2], [3.1, 18.5], [2.7, 19.7], [2.0, 20.7], [0, 20.7]], 20);
    // weld seams
    for (const dz of [2.2, 18.5]) cyl('zinc', ex(PX), PY, 37.5 + dz, 3.2, 0.3, 'z', 20);
    // perforated heat shield strip on the underside
    box('steel', ex(PX), PY - 3.25, 47.5, 4.4, 0.18, 14);
  }
  L('exhaustPipe');
  {
    path('steel', [[ex(PX), PY, 58], [ex(PX), PY, 75], [ex(PX), PY, 88], [ex(9.3), PY, 95.6]], PIPE_R, 14, 4);
    // flange joints
    cyl('zinc', ex(PX), PY, 58.2, 2.55, 0.5, 'z', 14); cyl('zinc', ex(PX), PY, 76, 2.55, 0.4, 'z', 14);
  }
  L('muffler');
  {
    const zc = 109, len = 26.4, w = 8.0, h = 5.4;
    const sh = new THREE.Shape(); const rr = h / 2;
    sh.moveTo(-w / 2 + rr, -h / 2); sh.lineTo(w / 2 - rr, -h / 2); sh.absarc(w / 2 - rr, 0, rr, -Math.PI / 2, Math.PI / 2, false);
    sh.lineTo(-w / 2 + rr, h / 2); sh.absarc(-w / 2 + rr, 0, rr, Math.PI / 2, Math.PI * 1.5, false);
    const g = new THREE.ExtrudeGeometry(sh, { depth: len - 1.6, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.8, bevelSegments: 2, curveSegments: S(10) });
    g.translate(0, 0, -(len - 1.6) / 2);
    add('steel', g, M(ex(9.3), PY, zc));
    // rolled seams and heat dimples
    for (const dz of [-6, 6]) { const s2 = sh.clone ? null : null; }
    const rim = (dz) => { const g2 = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false, curveSegments: S(10) }); g2.scale(1.025, 1.04, 1); g2.translate(0, 0, dz); add('steel', g2, M(ex(9.3), PY, zc)); };
    rim(-len / 2 + 2.2); rim(len / 2 - 2.6); rim(-0.1);
    // inlet and outlet necks
    cyl('steel', ex(9.3), PY, zc - len / 2 - 1.2, PIPE_R, 2.6, 'z', 14);
    cyl('steel', ex(9.3), PY, zc + len / 2 + 1.2, PIPE_R, 2.6, 'z', 14);
    // brackets welded on top for the hangers
    for (const dz of [-8, 8]) box('steel', ex(9.3), PY + h / 2 + 0.2, zc + dz, 5.0, 0.3, 1.8);
  }
  L('tailpipe');
  let tailCurve;
  const TP = [[ex(9.3), PY, 123.0], [ex(9.5), PY - 0.1, 138], [ex(13.0), PY - 0.6, 145.5], [ex(18.4), PY - 1.0, 149.5], [ex(19.4), PY - 1.0, 154], [ex(19.4), PY - 1.2, 172], [ex(19.4), PY - 1.5, 185]];
  {
    tailCurve = path('steel', TP, PIPE_R, 14, 2.5);
    // plain steel tip: open end with a darker inner disc
    const end = TP[TP.length - 1];
    box('hole', end[0], end[1], end[2] + 0.02, 0.1, 0.1, 0.1);
    cyl('hole', end[0], end[1], end[2] - 0.2, PIPE_R - 0.18, 0.2, 'z', 14);
    // faint soot ring on the tip
    cyl('hole', end[0], end[1], end[2] - 1.0, PIPE_R + 0.03, 1.6, 'z', 14);
  }
  L('exhaustHangers');
  {
    const hang = (x, y, z, yUp) => { // rubber isolator between the pipe and a rail bracket
      cyl('rubber', x, y + PIPE_R + 0.45, z, 0.7, 1.3, 'y', 8);
      tube('zinc', [x, y + PIPE_R, z], [x, y + PIPE_R + 1.6, z], 0.18, 5);
      box('zinc', x, y + PIPE_R + 0.1, z, 3.4, 0.2, 1.0);
      box('ecoat', x, yUp, z, 3.0, 0.3, 2.2);
    };
    hang(ex(PX), PY, 70, railBottom(70) + 0.4);
    hang(ex(9.3), PY, 100, 22.6);
    hang(ex(9.3), PY, 118, 22.6);
    hang(ex(19.4), PY - 1.2, 165, 22.6);
  }

  // ================================================================================================================
  // FUEL: tank, straps, filler, filter, cooler, lines
  // ================================================================================================================
  const TANK = { x0: -24.2, x1: -6.2, z0: 81, z1: 121, y0: 9.6, y1: 18.4 };
  L('fuelTank');
  {
    const w = TANK.x1 - TANK.x0, d = TANK.z1 - TANK.z0, h = TANK.y1 - TANK.y0;
    // plan-view rounded shape extruded up with a bevel (so the edges are rounded and the sheet metal seam shows)
    const sh = rrect(w - 1.6, d - 1.6, 2.4);
    const g = new THREE.ExtrudeGeometry(sh, { depth: h - 1.6, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); // plan y -> -z
    g.translate((TANK.x0 + TANK.x1) / 2, TANK.y0 + 0.8, -(0) + (TANK.z0 + TANK.z1) / 2);
    add('galv', g);
    // pressed ribs on the bottom and a seam flange around the middle
    for (let i = 0; i < 4; i++) box('galv', (TANK.x0 + TANK.x1) / 2, TANK.y0 - 0.05, TANK.z0 + 5 + i * 10, w - 3, 0.2, 0.9);
    box('galv', (TANK.x0 + TANK.x1) / 2, TANK.y0 + h * 0.55, (TANK.z0 + TANK.z1) / 2, w + 0.5, 0.35, d + 0.5);
    // fuel sender / pump module plate on top and the connectors
    cyl('zinc', -14.4, TANK.y1 + 0.35, 96, 2.5, 0.4, 'y', 14);
    box('rubber', -14.4, TANK.y1 + 0.8, 96, 2.6, 0.9, 1.4);
    // tank skid guard hint: tank-bottom drain nothing
  }
  L('tankStraps');
  for (const z of [92, 110]) {
    const w = 1.9;
    box('ecoat', (TANK.x0 + TANK.x1) / 2, TANK.y0 - 0.45, z, TANK.x1 - TANK.x0 + 1.2, 0.18, w);
    box('ecoat', TANK.x0 - 0.25, (TANK.y0 + TANK.y1) / 2 - 0.2, z, 0.18, TANK.y1 - TANK.y0 + 0.6, w);
    box('ecoat', TANK.x1 + 0.25, (TANK.y0 + TANK.y1) / 2 - 0.2, z, 0.18, TANK.y1 - TANK.y0 + 0.6, w);
    // studs and nuts up to brackets on the rail (outer) and a stay (inner)
    for (const [x, yTop] of [[TANK.x0 - 0.25, 22.2], [TANK.x1 + 0.25, 21.2]]) {
      tube('zinc', [x, TANK.y1 - 0.4, z], [x, yTop, z], 0.28, 6);
      cyl('zinc', x, yTop + 0.2, z, 0.6, 0.45, 'y', 6);
    }
    // bracket from the rail
    box('ecoat', -W2 - 3.2, 22.0, z, 6.6, 0.3, 2.4);
    box('ecoat', -W2 + 3.0 + 3.8, 20.6, z, 7.6, 0.3, 2.4);
    for (const dz of [-0.6, 0.6]) bolt(-W2 - 1.0, 22.15, z + dz * 1.5, [0, 1, 0], 0.8);
  }
  L('fillerNeck');
  {
    // filler neck from the tank's driver-side rear-top corner up and out to the fuel door
    path('hose', [[-22.4, 17.4, 116.5], [-27.5, 23, 118.6], [-33.0, 31.5, 119.4], [-36.4, 40.0, 119.0]], 0.95, 10, 2);
    path('hose', [[-20.6, 18.0, 119.6], [-25.2, 25, 121.4], [-31.5, 34.5, 122.0], [-35.2, 41.0, 121.6]], 0.34, 6, 2.5);
    cyl('zinc', -22.4, 17.7, 116.5, 1.15, 0.9, 'y', 10);
    for (const [x, y, z] of [[-27.2, 22.4, 118.7], [-32.4, 30, 119.4]]) cyl('zinc', x, y, z, 1.25, 0.4, 'y', 10);
    cyl('ecoat', -36.6, 40.2, 119.0, 1.7, 0.4, 'x', 12);
  }

  // fuel filter housing (driver-side rail, in front of the tank)
  L('fuelFilter');
  const FF = { x: -21.6, z: 73.4, yBot: 14.7, yTop: 23.2 };
  {
    // bracket on the rail web
    box('ecoat', -W2 - 0.4, 21.6, FF.z, 0.3, 4.6, 5.4);
    box('ecoat', -W2 - 1.9, 21.9, FF.z, 3.2, 0.3, 3.4);
    for (const dz of [-1.8, 1.8]) bolt(-W2 - 0.55, 22.5, FF.z + dz, [-1, 0, 0], 0.9);
    // canister (black plastic/steel), head (cast aluminum), priming pump knob on top, bowl at the bottom
    latheY('paintBlk', FF.x, FF.yBot + 1.6, FF.z, [[0, 0], [1.7, 0], [1.8, 0.4], [1.9, 1.0], [1.9, 5.6], [1.7, 6.0], [0, 6.0]], 20);
    cyl('alu', FF.x, FF.yTop - 0.9, FF.z, 2.2, 1.8, 'y', 18);
    cyl('alu', FF.x, FF.yTop + 0.35, FF.z, 1.0, 0.8, 'y', 12);
    cyl('rubber', FF.x, FF.yTop + 1.0, FF.z, 0.75, 0.9, 'y', 12);
    // ports
    cyl('alu', FF.x + 2.4, FF.yTop - 0.8, FF.z - 0.9, 0.55, 1.6, 'x', 8);
    cyl('alu', FF.x + 2.4, FF.yTop - 0.8, FF.z + 0.9, 0.55, 1.6, 'x', 8);
    // bracket to the head
    box('ecoat', (FF.x - 2.0 + -W2 - 1.9) / 2 - 0.4, 21.9, FF.z, 1.2, 0.3, 3.4);
    // water separator bowl under the canister
    latheY('paintBlk', FF.x, FF.yBot + 0.4, FF.z, [[0, 0], [1.3, 0], [1.6, 0.3], [1.8, 1.0], [1.9, 1.5], [0, 1.5]], 18);
    // drain valve: petcock at the bottom of the bowl
    cyl('zinc', FF.x, FF.yBot + 0.55, FF.z, 0.5, 0.6, 'y', 6);
    cyl('bronze', FF.x + 0.5, FF.yBot + 0.5, FF.z, 0.3, 1.3, 'x', 6);
  }
  L('wifSensor');
  {
    // float switch: small black cylinder at the bowl bottom and the pigtail with its connector clipped to the rail
    latheY('paintBlk', FF.x, FF.yBot - 0.35, FF.z, [[0, 0], [1.25, 0], [1.3, 0.3], [1.3, 1.0], [0, 1.0]], 16);
    cyl('zinc', FF.x, FF.yBot - 0.45, FF.z, 0.9, 0.2, 'y', 8);
    path('wire', [[FF.x - 0.6, FF.yBot - 0.2, FF.z - 1.2], [FF.x - 1.6, FF.yBot - 1.3, FF.z - 2.6], [FF.x - 1.6, FF.yBot + 1.8, FF.z - 4.4], [-W2 - 0.9, 20.5, FF.z - 6.5], [-W2 - 0.7, 21.2, FF.z - 12]], 0.17, 5, 2.5);
    path('wire', [[FF.x + 0.2, FF.yBot - 0.2, FF.z - 1.1], [FF.x - 0.8, FF.yBot - 1.5, FF.z - 2.9], [FF.x - 1.0, FF.yBot + 1.8, FF.z - 4.6], [-W2 - 1.1, 20.2, FF.z - 6.7], [-W2 - 0.9, 21.0, FF.z - 12]], 0.17, 5, 2.5);
    box('paintBlk', -W2 - 0.7, 21.2, FF.z - 12.6, 1.0, 1.4, 1.8); // connector body
    box('ecoat', -W2 - 0.3, 20.8, FF.z - 7.4, 0.5, 0.2, 0.9);
  }
  L('fuelLines');
  {
    const yb = (z) => railBottom(z);
    const xl = -W2 - 0.9;
    // supply: tank (top, near the sender) -> forward along the rail -> filter inlet; filter outlet -> engine
    path('fuelLine', [[-14.4, TANK.y1 + 0.8, 96], [-15.2, 21.2, 92], [xl, yb(86) + 2.4, 86], [xl, yb(78) + 2.4, 78], [FF.x + 2.4, FF.yTop - 0.8, FF.z + 1.0 + 1.0]], 0.34, 6, 2.5);
    path('fuelLine', [[FF.x + 2.4, FF.yTop - 0.8, FF.z - 1.0], [xl, yb(66) + 2.4, 66], [xl, yb(30) + 2.6, 30], [xl, yb(0) + 2.6, 0], [-13.4, 22.4, -8]], 0.34, 6, 2.5);
    // return line (rail face, forward to the engine and back to the tank)
    path('fuelLine', [[-13.0, 22.8, -8], [xl, yb(0) + 3.6, 0], [xl, yb(30) + 3.6, 30], [xl, yb(70) + 3.7, 70], [xl, yb(90) + 3.8, 90], [-15.6, 21.6, 95]], 0.3, 6, 2.5);
    // steel brake/emission-style lines in clips and the line clips themselves
    for (const z of [-4, 14, 32, 48, 62, 80, 90]) { box('ecoat', xl, yb(z) + 3.0, z, 0.2, 2.8, 0.9); bolt(xl - 0.2, yb(z) + 3.0, z, [-1, 0, 0], 0.5); }
  }
  L('fuelCooler');
  {
    // thin finned unit under the front crossmember: end tanks and many fins
    const x0 = -7.4, x1 = 7.4, zc = -26, yc = 13.4;
    box('alu', 0, yc, zc, x1 - x0, 1.1, 6.0);
    const nF = lod === 0 ? 10 : 16;
    for (let i = 0; i < nF; i++) box('alu', x0 + 0.6 + (i / (nF - 1)) * (x1 - x0 - 1.2), yc - 0.7, zc, 0.12, 0.6, 5.8);
    box('alu', x0 - 0.5, yc, zc, 1.0, 1.4, 6.2); box('alu', x1 + 0.5, yc, zc, 1.0, 1.4, 6.2);
    // mounting straps to the crossmember and the fuel line stubs
    for (const sx of [-1, 1]) { box('ecoat', sx * 4.8, yc + 1.0, zc, 0.3, 2.0, 6.4); bolt(sx * 4.8, yc + 2.1, zc + 2.4, [0, 1, 0], 0.8); }
    cyl('fuelLine', x0 - 1.6, yc, zc - 1.5, 0.35, 1.2, 'x', 6);
    cyl('fuelLine', x1 + 1.6, yc, zc + 1.5, 0.35, 1.2, 'x', 6);
    path('fuelLine', [[x1 + 2.0, yc, zc + 1.5], [11.5, 14.2, zc + 3], [13.4, 19.5, zc + 6]], 0.35, 6, 2.5);
    path('fuelLine', [[x0 - 2.0, yc, zc - 1.5], [-11.5, 14.6, zc - 3], [-12.6, 19.8, zc + 6]], 0.35, 6, 2.5);
  }

  // ================================================================================================================
  // BRAKE LINES, WIRING
  // ================================================================================================================
  L('brakeLines');
  {
    const xl = -W2 - 0.9;
    // main rear brake line: driver-side rail outer face, down to the axle T-block via a flexible hose
    path('brakeLine', [[xl, railBottom(-8) + 1.3, -8], [xl, railBottom(40) + 1.3, 40], [xl, railBottom(100) + 1.3, 100], [xl, railBottom(140) + 1.3, 140], [-17.1, railBottom(146) - 0.6, 146.6]], 0.19, 6, 3);
    path('hose', [[-17.1, railBottom(146) - 0.6, 146.6], [-15.4, 19.0, 148], [-9.8, 17.6, 150.6], [-4.8, RY + 4.0, RZ - 1.5]], 0.28, 6, 2);
    box('zinc', -4.4, RY + 3.4, RZ - 1.5, 1.6, 1.0, 1.4); // T-block
    // lines along the axle to both ends (on the front of the tube), with clips
    for (const sx of [-1, 1]) {
      path('brakeLine', [[sx * 4.6, RY + 3.0, RZ - 1.5], [sx * 8, RY + 2.2, RZ - 2.3], [sx * 20, RY + 1.9, RZ - 2.3], [sx * 26.6, RY + 1.5, RZ - 2.0], [sx * 27.6, RY + 1.2, RZ + 0.8]], 0.19, 6, 3);
      for (const x of [9, 16, 22]) box('zinc', sx * x, RY + 2.0, RZ - 2.3, 0.7, 0.3, 0.6);
    }
    // lines clips on the rail
    for (const z of [0, 24, 52, 84, 110, 132]) { box('ecoat', xl, railBottom(z) + 1.3, z, 0.2, 1.8, 0.8); }
    // ABS / sensor loom to the axle (rear): black corrugated loom
  }
  L('wiring');
  {
    const x = EXH > 0 ? -1 : 1; // harness on the side opposite the exhaust? put on the passenger rail inner face like the photo notes
    const xl = W2 - RW + 0.35;
    path('wire', [[xl, railBottom(-20) + 4.0, -20], [xl, railBottom(20) + 4.3, 20], [xl, railBottom(80) + 4.4, 80], [xl, railBottom(150) + 4.4, 150], [xl - 2, 22.8, 152]], 0.42, 8, 3);
    // rear axle ABS sensor lead
    path('wire', [[xl - 2, 22.8, 152], [9, RY + 6.5, RZ - 2], [7.2, RY + 3.4, RZ - 2.4]], 0.22, 6, 3);
    for (const z of [10, 40, 70, 100, 130]) box('ecoat', xl, railBottom(z) + 4.2, z, 0.2, 0.9, 0.8);
  }

  // ================================================================================================================
  // SPARE TIRE, WINCH, HITCH, TOW HOOKS, REAR STRAP TABS
  // ================================================================================================================
  const SPARE = { z: 174.5, y: 15.5, r: 15.25, half: 4.83 };
  L('spareTire');
  {
    // tire as one lathe (profile [r, yRel]): bottom sidewall, tread, top sidewall; UV set explicitly (v by arc length)
    const prof = [
      [8.15, -3.45], [9.4, -4.25], [11.4, -4.78], [13.2, -4.83], [14.5, -4.5], [15.05, -3.7], [15.25, -2.8],
      [15.25, 2.8], [15.05, 3.7], [14.5, 4.5], [13.2, 4.83], [11.4, 4.78], [9.4, 4.25], [8.15, 3.45],
    ];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), S(72));
    // v by profile index fraction: sidewall text at v~0.2 (bottom) and 0.8 (top), tread 0.4..0.6
    const uv = g.attributes.uv; const pos = g.attributes.position;
    const segs = S(72);
    for (let i = 0; i < uv.count; i++) { uv.setXY(i, uv.getX(i) * 2, uv.getY(i)); }
    add('tire', g, M(0, SPARE.y, SPARE.z));
  }
  L('spareTire');
  {
    // steel wheel: dished face with hub bore, 8 lug holes and 4 hand holes; recessed 2 in into the tire
    const faceY = SPARE.y - 2.7;
    const sh = new THREE.Shape(); sh.absarc(0, 0, 7.1, 0, Math.PI * 2, false);
    const hole = (cx, cy, r) => { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, Math.PI * 2, true); sh.holes.push(p); };
    hole(0, 0, 3.0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; hole(3.25 * Math.cos(a), 3.25 * Math.sin(a), 0.5); }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 8 * 0; const e = new THREE.Path(); const cx = 5.2 * Math.cos(a + Math.PI / 8), cy = 5.2 * Math.sin(a + Math.PI / 8);
      const rx = 1.0, ry = 0.62, ang = a + Math.PI / 8;
      e.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, true, ang); sh.holes.push(e);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: S(24) });
    g.rotateX(Math.PI / 2); // face normal -> -y after rotation? extrude +z -> -y
    add('wheel', g, M(0, faceY + 0.15, SPARE.z));
    // raised center hub dish and barrel
    latheY('wheel', 0, faceY + 0.3, SPARE.z, [[3.0, 0], [3.3, 1.1], [7.0, 1.4], [7.4, 1.8], [7.45, 2.8], [8.0, 3.4], [8.3, 4.2], [8.3, 5.4]], 36);
    latheY('wheel', 0, faceY + 5.4, SPARE.z, [[8.3, 0], [8.0, 0.6], [7.6, 0.6]], 24);
    // rim flange lip visible at the tire bead
    latheY('wheel', 0, SPARE.y - 3.1, SPARE.z, [[7.9, 0], [8.55, -0.05], [8.6, 0.5], [8.0, 0.5]], 36);
    // lug nut seats suggestion and a cable bolt (hex nut and washer on the hub, as in 03-underside-rear)
    cyl('zinc', 0, faceY - 0.15, SPARE.z, 1.0, 0.5, 'y', 6);
  }
  L('spareWinch');
  {
    const zc = SPARE.z, yc = 23.6;
    // hoist body
    rbox('ecoat', 0, yc, zc, 7.2, 3.6, 8.0, 0.5, 0.25);
    cyl('zinc', 0, yc, zc, 1.1, 8.6, 'x', 8);
    box('ecoat', 0, yc + 1.9, zc, 8.0, 0.4, 9.0);
    for (const sx of [-1, 1]) box('ecoat', sx * 4.1, yc + 1.2, zc, 0.4, 2.4, 6.5);
    // cable from the hoist down through the wheel center, with the retainer nut under the hub
    tube('zinc', [0, yc - 1.8, zc], [0, SPARE.y - 3.7, zc], 0.32, 6);
    cyl('zinc', 0, SPARE.y - 3.4, zc, 1.0, 0.45, 'y', 8);
    // drive tube to the rear bumper hole
    tube('ecoat', [0, yc, zc + 4.2], [0, yc - 0.5, 197], 0.62, 8);
    cyl('zinc', 0, yc - 0.5, 197.3, 0.75, 0.7, 'z', 8);
    // frame brackets
    for (const sx of [-1, 1]) { box('ecoat', sx * (W2 - RW - 0.1), 23.6, zc, 0.3, 4.4, 5.0); }
  }
  L('hitch');
  {
    const yc = 18.6, z0 = 189.6, z1 = 198.0;
    rbox('ecoat', 0, yc, (z0 + z1) / 2, 2.5, 2.5, z1 - z0, 0.2, 0.1);
    box('hole', 0, yc, z1 + 0.01, 2.0, 2.0, 0.04);
    // reinforcing collar and pin holes
    box('ecoat', 0, yc, z0 + 2.0, 3.3, 3.3, 1.2);
    for (const sx of [-1, 1]) cyl('hole', sx * 1.27, yc, z1 - 3.2, 0.34, 0.06, 'x', 8);
    for (const sx of [-1, 1]) { box('ecoat', sx * 4.0, yc + 0.8, 191.2, 5.4, 0.3, 3.4); bolt(sx * 5.4, yc + 1.05, 191.2, [0, 1, 0], 1.0); }
  }
  L('towHooks');
  for (const sx of [-1, 1]) {
    // J hook bolted under the front frame horn
    const x = sx * 15.8, zb = -31.0;
    box('ecoat', x, railBottom(zb) - 0.25, zb + 1.5, 4.0, 0.5, 6.5);
    const g = new THREE.TorusGeometry(1.9, 0.6, 8, S(18), Math.PI * 1.35);
    // arc in the z-y plane, opening forward-down
    add('ecoat', g, M(x, railBottom(zb) - 2.5, zb - 1.6, 0, Math.PI / 2, 0));
    bolt(x - 1.4, railBottom(zb) - 0.55, zb + 3.2, [0, -1, 0], 1.0); bolt(x + 1.4, railBottom(zb) - 0.55, zb + 3.2, [0, -1, 0], 1.0);
    bolt(x - 1.4, railBottom(zb) - 0.55, zb + 0.2, [0, -1, 0], 1.0); bolt(x + 1.4, railBottom(zb) - 0.55, zb + 0.2, [0, -1, 0], 1.0);
  }
  L('rearStrap');
  for (const sx of [-1, 1]) {
    const x = sx * (W2 - 1.0), z = UNDER.railRear - 1.5;
    const yb = railBottom(z);
    // tab with a slotted hole welded under the frame end
    box('ecoat', x, yb - 1.7, z, 3.0, 3.4, 0.35);
    box('ecoat', x, yb - 0.1, z, 3.0, 0.35, 3.2);
    cyl('hole', x, yb - 2.1, z + 0.2, 0.9, 0.06, 'z', 12);
    bolt(x - 1.0, yb - 0.3, z + 1.0, [0, -1, 0], 0.8);
  }

  // ================================================================================================================
  // Instanced hardware
  // ================================================================================================================
  const instOf = (geom, mat, list, label, name) => {
    if (!list.length) return null;
    geom.scale(INCH, INCH, INCH);
    const im = new THREE.InstancedMesh(geom, mat, list.length);
    const tmp = new THREE.Matrix4();
    list.forEach((m, i) => { tmp.copy(m); tmp.elements[12] *= INCH; tmp.elements[13] *= INCH; tmp.elements[14] *= INCH; im.setMatrixAt(i, tmp); });
    im.instanceMatrix.needsUpdate = true;
    im.name = name; im.receiveShadow = true; im.userData.labelId = ID(label);
    im.computeBoundingSphere();
    return im;
  };

  // ---------------- finalize batches ----------------
  const groups = B.finalize(materials, group);
  const hexGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 6); hexGeom.translate(0, 0.15, 0);
  const rivGeom = new THREE.SphereGeometry(0.3, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2); rivGeom.rotateZ(-Math.PI / 2).scale(0.8, 1, 1); // dome along +x
  const holeGeom = new THREE.CircleGeometry(1, 14);
  // bolt heads: transform so the head sits on the surface pointing along `dir` (the +Y axis of the geometry is outward)
  const hexMesh = instOf(hexGeom, materials.zinc, hexList.map((m) => m.clone()), 'hardware', 'bolts');
  const rivMesh = instOf(rivGeom, materials.frame, rivetList.map((m) => m.clone()), 'hardware', 'rivets');
  const holeMesh = instOf(holeGeom, materials.hole, holeList.map((m) => m.clone()), 'frameRail', 'lightening_holes');
  for (const m of [hexMesh, rivMesh, holeMesh]) if (m) group.add(m);

  // ---------------- the rotating driveshafts (spinner Object3Ds, local X = rotation axis) ----------------
  const anchors = {};
  const shaftBatch = (name, a, b, tubeR, slipLen, label) => {
    // endpoints a (tcase side) and b (axle side) in inches; the aim group maps local +X onto a->b
    const A = toV(a), Bv = toV(b);
    const dir = Bv.clone().sub(A); const len = dir.length(); dir.normalize();
    const aim = new THREE.Group(); aim.name = `${name}_aim`;
    aim.position.copy(A.clone().add(Bv).multiplyScalar(0.5 * INCH));
    aim.quaternion.setFromUnitVectors(new V3(1, 0, 0), dir);
    const spin = new THREE.Object3D(); spin.name = name; aim.add(spin);
    const holder = new THREE.Group(); holder.userData.labelId = ID(label); holder.name = `${name}_parts`; spin.add(holder);
    const sb = makeBatch(); sb.label(ID(label));
    const gadd = (matKey, g, m) => sb.add(matKey, g, m);
    // gcyl(mat, xCenter, radius at -X end, length, seg, radius at +X end)
    const gcyl = (matKey, x, rm, l, seg = 14, rp = rm) => gadd(matKey, new THREE.CylinderGeometry(rm, rp, l, S(seg), 1), M(x, 0, 0, 0, 0, Math.PI / 2));
    const h = len / 2;
    // main tube with a swaged end at each side and balance weights
    gcyl('steel', 0, tubeR, len - 8.0, 20);
    gcyl('steel', -h + 5.2, tubeR * 0.6, 3.4, 20, tubeR * 0.98);
    gcyl('steel', h - 5.2, tubeR * 0.98, 3.4, 20, tubeR * 0.6);
    gadd('zinc', new THREE.BoxGeometry(1.6, 0.18, 1.0), M(h * 0.35, tubeR + 0.06, 0));
    gadd('zinc', new THREE.BoxGeometry(1.4, 0.18, 1.0), M(-h * 0.5, -tubeR * 0.55, tubeR * 0.82, Math.PI * 0.12, 0, 0));
    // weld seam rings
    for (const x of [-h + 7.2, h - 7.2]) gcyl('ecoat', x, tubeR + 0.06, 0.3, 20);
    // U-joints at each end: cross, yoke ears (two forks), bearing caps
    for (const sgn of [-1, 1]) {
      const xj = sgn * (h - 1.6);
      gcyl('cast', sgn * (h - 4.2), 1.5, 2.2, 12, tubeR * 0.9); // yoke body
      gadd('cast', new THREE.BoxGeometry(2.6, 0.5, 3.6), M(sgn * (h - 2.2), 0, 0));
      for (const t of [-1, 1]) gadd('cast', new THREE.BoxGeometry(2.4, 2.6, 0.5), M(sgn * (h - 1.4), 0, t * 1.6)); // yoke ears
      // cross: two caps visible on each axis
      gadd('zinc', new THREE.CylinderGeometry(0.58, 0.58, 3.6, S(10)), M(xj, 0, 0, Math.PI / 2, 0, 0)); // across Z
      gadd('zinc', new THREE.CylinderGeometry(0.58, 0.58, 3.2, S(10)), M(xj, 0, 0));
      // grease fitting
      gadd('zinc', new THREE.CylinderGeometry(0.16, 0.16, 0.5, 5), M(xj, 0, 1.95, Math.PI / 2, 0, 0));
    }
    // slip yoke sleeve + splined stub at the tcase end (the spinner includes the sleeve; the stub is shown here)
    gcyl('cast', -h + 0.6 - 3.2, 1.9, slipLen, 14);
    gcyl('zinc', -h - 0.2, 0.85, 2.4, 12);
    // flange yoke at the axle end
    gcyl('cast', h + 0.2, 2.6, 0.9, 16);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; gadd('zinc', new THREE.CylinderGeometry(0.34, 0.34, 0.6, 6), M(h + 0.7, 1.9 * Math.cos(a), 1.9 * Math.sin(a), 0, 0, Math.PI / 2)); }
    const gs = sb.finalize(materials, holder);
    // (finalize already scaled meshes to meters)
    group.add(aim);
    return { aim, spin, len };
  };
  {
    const rear = shaftBatch('driveshaftRear', [0, 18.3, 96.6], [0, RY + 0.9, RZ - 12.2], 1.75, 3.6, 'rearDriveshaft');
    anchors.driveshaftRear = rear.spin;
    const front = shaftBatch('driveshaftFront', [-7.0, 16.9, 76.4], [-9.3, FA_Y + 0.4, 0.6 + 8.8], 1.45, 3.2, 'frontDriveshaft');
    anchors.driveshaftFront = front.spin;
  }

  // ---------------- anchors ----------------
  const railBox = (sx) => new THREE.Box3(
    new V3(Math.min(sx * W2, sx * (W2 - RW)) * INCH, railBottom(UNDER.railFront) * INCH, UNDER.railFront * INCH),
    new V3(Math.max(sx * W2, sx * (W2 - RW)) * INCH, railTop(UNDER.railRear) * INCH, UNDER.railRear * INCH),
  );
  anchors.frameRailLeft = railBox(-1);
  anchors.frameRailRight = railBox(1);
  const mk = (name, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x * INCH, y * INCH, z * INCH); group.add(o); return o; };
  anchors.fuelFilter = mk('anchor_fuelFilter', FF.x, (FF.yBot + FF.yTop) / 2, FF.z);
  const tp = TP[TP.length - 1];
  anchors.tailpipeEnd = mk('anchor_tailpipeEnd', tp[0], tp[1], tp[2]);
  {
    const tan = tailCurve.getTangentAt(1).normalize();
    anchors.tailpipeEnd.quaternion.setFromUnitVectors(new V3(0, 0, 1), tan);
  }
  anchors.strapPoints = [
    mk('strap_FL', -15.8, railBottom(-31) - 2.5, -31.5),
    mk('strap_FR', 15.8, railBottom(-31) - 2.5, -31.5),
    mk('strap_RL', -(W2 - 1.0), railBottom(UNDER.railRear - 1.5) - 2.1, UNDER.railRear - 1.3),
    mk('strap_RR', W2 - 1.0, railBottom(UNDER.railRear - 1.5) - 2.1, UNDER.railRear - 1.3),
  ];
  anchors.axleFront = mk('anchor_axleFront', 0, FA_Y, 0);
  anchors.axleRear = mk('anchor_axleRear', 0, RY, RZ);
  anchors.spareTire = mk('anchor_spareTire', 0, SPARE.y, SPARE.z);

  // ---------------- floor-bounce fill ----------------
  // The body shadows everything below it and the shop's key lights barely reach the underside, so a real truck on a bright
  // concrete floor would still be lit from below. Upward-facing spot lights just above the floor (no shadows) stand in for
  // that bounce; the floor itself is outside their cones so it does not get hot spots.
  const fill = [];
  if (!quality || quality.fillLights !== false) {
    for (const z of [-0.5, 0.9, 2.2, 3.4, 4.5]) {
      const sp = new THREE.SpotLight(0xfff0dc, FILL_INTENSITY, 3.4, 1.25, 0.85, 1.4);
      sp.position.set(0, 0.06, z); sp.castShadow = false; sp.name = 'underFill';
      sp.target.position.set(0, 1.2, z); group.add(sp, sp.target);
      fill.push(sp);
    }
  }
  anchors.fillLights = fill;

  group.userData.triangles = B.tris;
  return { group, colliders: [], anchors };
}
