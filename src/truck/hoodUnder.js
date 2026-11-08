// Hood underside and hinges (PROMPT.md section 2): white painted inner stamping with the rim, slots, latch reinforcement and hinge plates;
// the molded black insulation pad with contour embossing, rear notches and push-clip retainers; two spring-loaded hinge arms (arm, flat coil
// spring, bracket) at the rear corners (GMT800 hoods have no prop rod and no gas struts); striker loop; washer jets and hose.
// buildHoodUnder({ quality }) returns { group, anchors }: the group is in TRUCK coordinates (its origin is the truck origin), so the integrator
// adds it to parts.hood. The hood pivots about the hinge axis (s = 19.5 in, y = 54.0 in, parallel to X): see hoodPose().
import * as THREE from 'three';
import { makeMats } from './engine/mats.js';
import { Batch, Fasteners, tube, cylAxis, rbox, lerp, smoothstep, clamp } from './engine/geo.js';
import { HINGE } from './engine/layout.js';
import { hoodHalfWidth, hoodHeight, IN_TO_M } from './skin.js';

const IN = IN_TO_M;
const part = (parent, name, labelId) => { const g = new THREE.Group(); g.name = name; if (labelId) g.userData.labelId = labelId; parent.add(g); return g; };

// ---------- pure helpers ----------
// Pose for a group whose origin is the truck origin so that it rotates by `angle` (radians, positive opens) about the hinge axis.
export function hoodPose(angle) {
  const py = HINGE.pivotY * IN, ps = HINGE.pivotS * IN, c = Math.cos(angle), s = Math.sin(angle);
  // rotation about +X: (y, z) -> (y c - z s, y s + z c); position = pivot - R * pivot
  return { rotationX: angle, y: py - (py * c - ps * s), z: ps - (py * s + ps * c) };
}
// pad outline (x, s) in inches: front edge with the latch recess, straight sides, rear edge with the notches for the inner panel tabs
export function padOutline() {
  const P = [
    [-22.4, -27.2], [-9.6, -27.4], [-8.0, -24.4], [-5.2, -23.2], [5.2, -23.2], [8.0, -24.4], [9.6, -27.4], [22.4, -27.2],
    [24.2, -18.0], [24.9, -6.0], [25.0, 6.0], [24.6, 13.0], [23.6, 16.0], [20.0, 16.3],
    [-20.0, 16.3], [-23.6, 16.0], [-24.6, 13.0], [-25.0, 6.0], [-24.9, -6.0], [-24.2, -18.0],
  ];
  // subdivide long edges so the embossing has vertices to bend
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.0));
    for (let k = 0; k < n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return out;
}
// the inner panel tabs that stand through the notches at the rear edge of the pad: [x center, width]; the notches run from s = 14.4 to the edge
export const PAD_TABS = [[-14.0, 3.2], [-4.3, 2.6], [2.7, 2.6], [10.5, 3.6], [17.7, 3.0]];
export const PAD_NOTCH_S = 14.4;
// emboss field of the pad (x, s in inches): hollows (+) are pressed up toward the inner panel, ridges (-) stand away from it
export function padEmboss(x, s) {
  const band = (ax, as_, bx, bs, w) => { // soft band along the segment a-b
    const dx = bx - ax, ds = bs - as_, L2 = dx * dx + ds * ds; const t = clamp(((x - ax) * dx + (s - as_) * ds) / L2, 0, 1);
    const d = Math.hypot(x - (ax + dx * t), s - (as_ + ds * t)); return 1 - smoothstep(w * 0.4, w, d);
  };
  const dish = (cx, cs, r) => 1 - smoothstep(r * 0.65, r, Math.hypot(x - cx, s - cs));
  let ridge = 0;
  ridge = Math.max(ridge, band(-21, -21, -9.5, -7.0, 2.2), band(21, -21, 9.5, -7.0, 2.2)); // the V bands running from the front corners toward the center
  ridge = Math.max(ridge, band(-9.5, -7.0, -2.0, -3.0, 1.8), band(9.5, -7.0, 2.0, -3.0, 1.8));
  ridge = Math.max(ridge, band(-23.0, 9.0, 23.0, 9.0, 1.4) * 0.6);
  const hollow = Math.max(dish(-9.0, 0.5, 5.8), dish(10.5, 2.0, 5.4), dish(-17.5, 8.0, 3.6));
  return hollow - ridge * 0.9;
}
// push-clip positions on the pad (x, s)
export const PAD_CLIPS = [[-21.2, -9.0], [-20.8, 5.5], [21.4, -3.5], [21.0, 8.5], [-12.5, -22.5], [2.8, -17.5], [13.8, -19.5], [-6.0, 4.5], [8.8, 5.8], [-1.0, -7.5], [20.6, -18.4], [-20.2, -18.6], [-2.5, 11.8], [14.5, 11.6]];

function surf(nI, nJ, fn, flip = false) {
  const P = [], UV = [], I = [];
  for (let j = 0; j <= nJ; j++) for (let i = 0; i <= nI; i++) { const p = fn(i / nI, j / nJ); P.push(p[0], p[1], p[2]); UV.push(p[0] * 0.06, p[2] * 0.06); }
  for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) { const a = j * (nI + 1) + i, b = a + 1, c = a + nI + 2, d = a + nI + 1; if (flip) I.push(a, d, b, b, d, c); else I.push(a, b, d, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); return g;
}

export function buildHoodUnder({ quality, mats: given } = {}) {
  quality = quality || { tex: 512 };
  const d = quality.tex >= 2048 ? 1 : quality.tex >= 1024 ? 0.75 : 0.5;
  const mats = given || makeMats(quality);
  const root = new THREE.Group(); root.name = 'hood_under';
  const inch = new THREE.Group(); inch.scale.setScalar(IN); root.add(inch);
  const fast = new Fasteners(mats);
  const A = {};
  const yIn = (s, x) => hoodHeight(s, x) - 1.85; // inner panel surface under the skin

  // ================= inner panel: pan with the rim, slots, latch box, hinge plates =================
  {
    const g = part(inch, 'hood_inner', 'engine.hood_inner'); const b = new Batch();
    b.add('innerWhite', surf(44, 52, (u, v) => { const s = lerp(-29.7, 18.9, v), xh = hoodHalfWidth(s) - 0.35; const x = lerp(-xh, xh, u); return [x, yIn(s, x), s]; }, true));
    // raised perimeter bead (the flange where the inner panel is joined to the skin) and a rear header beam
    b.add('innerWhite', tube(Array.from({ length: 12 }, (_, k) => { const x = lerp(-hoodHalfWidth(18.9) + 1.2, hoodHalfWidth(18.9) - 1.2, k / 11); return [x, yIn(18.4, x) - 0.15, 18.4]; }), 0.55, { radial: 8, segs: 30 }));
    for (const sgn of [-1, 1]) b.add('innerWhite', tube(Array.from({ length: 12 }, (_, k) => { const s = lerp(-29, 18, k / 11), x = sgn * (hoodHalfWidth(s) - 1.5); return [x, yIn(s, x) - 0.12, s]; }), 0.5, { radial: 8, segs: 40 }));
    // front header: latch reinforcement box with the striker slot, as in the reference photo
    b.add('innerWhite', rbox([0, yIn(-27.5, 0) - 0.3, -27.4], 14.4, 0.8, 5.8, 0.3));
    b.add('steelRaw', rbox([0, yIn(-27.5, 0) - 0.72, -27.4], 5.0, 0.18, 3.0, 0.08));
    for (const x of [-4.4, 4.4]) b.add('padClip', cylAxis('y', [x, yIn(-27.5, 0) - 0.8, -27.4], 0.45, 0.2, 14));
    b.add('padClip', rbox([0, yIn(-27.5, 0) - 0.82, -27.4], 3.2, 0.12, 1.1, 0.05));
    // slots along both side rims
    for (const sgn of [-1, 1]) for (const s of [-16, -8.5, -1, 6.5, 13.5]) {
      const x = sgn * (hoodHalfWidth(s) - 2.6), y = yIn(s, x), sl = (yIn(s, x + 0.5) - yIn(s, x - 0.5));
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.34, 10), mats.padClip); m.scale.set(0.7, 2.0, 1); m.rotation.set(Math.PI / 2, 0, Math.atan(sl));
      m.position.set(x, y - 0.03, s); g.add(m);
    }
    b.flush(g, mats, { name: 'hi' });
    A.inner = g;
  }

  // ================= insulation pad =================
  {
    const g = part(inch, 'hood_pad', 'engine.hood_pad');
    const outline = padOutline(); const N = outline.length; const padY = (s, x) => { const e = padEmboss(x, s); return yIn(s, x) - 0.5 + (e > 0 ? e * 0.42 : e * 0.7); };
    const K = Math.round(16 * Math.max(0.7, d)), cx = 0, cs = -4; // rings of the outline scaled toward the center (the outline is star-shaped about it)
    const P = [], UV = [], I = [];
    P.push(cx, padY(cs, cx), cs); UV.push(cx * 0.05, cs * 0.05);
    for (let k = 1; k <= K; k++) { const r = k / K; for (let i = 0; i < N; i++) { const x = cx + r * (outline[i][0] - cx), s = cs + r * (outline[i][1] - cs); P.push(x, padY(s, x), s); UV.push(x * 0.05, s * 0.05); } }
    const ix = (k, i) => 1 + (k - 1) * N + (i % N);
    for (let i = 0; i < N; i++) I.push(0, ix(1, i + 1), ix(1, i));
    for (let k = 1; k < K; k++) for (let i = 0; i < N; i++) { const a = ix(k, i), b = ix(k, i + 1), c = ix(k + 1, i + 1), dd = ix(k + 1, i); I.push(a, b, dd, b, c, dd); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mats.pad); m.name = 'pad_face'; m.castShadow = false; m.receiveShadow = true; g.add(m);
    // the white inner-panel tabs seen through the rear notches of the pad
    { const tb = new Batch(); for (const [tx, tw] of PAD_TABS) tb.add('innerWhite', rbox([tx, padY(15.4, tx) - 0.06, (PAD_NOTCH_S + 16.4) / 2], tw, 0.14, 16.4 - PAD_NOTCH_S, 0.05)); tb.flush(g, mats, { name: 'tabs' }); }
    // edge wall (the pad is about half an inch thick)
    const E = [], EI = [];
    for (let i = 0; i < N; i++) { const x = outline[i][0], s = outline[i][1], y = padY(s, x); E.push(x, y, s, x, y + 0.5, s); }
    for (let i = 0; i < N; i++) { const a = i * 2, b = ((i + 1) % N) * 2; EI.push(a, a + 1, b, b, a + 1, b + 1); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(E, 3)); eg.setIndex(EI); eg.computeVertexNormals();
    const em = new THREE.Mesh(eg, mats.pad); em.name = 'pad_edge'; g.add(em);
    // push-clip retainers: round heads
    const clips = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.7, 0.28, 14), mats.padClip, PAD_CLIPS.length); clips.name = 'pad_clips';
    const mm = new THREE.Matrix4();
    PAD_CLIPS.forEach(([x, s], i) => { mm.makeTranslation(x, padY(s, x) - 0.14, s); clips.setMatrixAt(i, mm); });
    clips.frustumCulled = false; g.add(clips);
    A.pad = g;
  }

  // ================= striker loop (wire hook the primary latch catches) =================
  {
    const g = part(inch, 'hood_striker', 'engine.hood_latch'); const b = new Batch();
    const y0 = yIn(-27.5, 0) - 0.75;
    b.add('steelRaw', tube([[-1.3, y0, -28.6], [-1.3, y0 - 1.8, -28.6], [-0.8, y0 - 2.7, -28.6], [0.8, y0 - 2.7, -28.6], [1.3, y0 - 1.8, -28.6], [1.3, y0, -28.6]], 0.17, { radial: 8, caps: false }));
    b.flush(g, mats, { name: 'sk' });
    A.striker = g;
  }

  // ================= spring-loaded hinge arms at both rear corners =================
  A.hinges = {};
  for (const sgn of [-1, 1]) {
    const g = part(inch, `hinge_arm_${sgn > 0 ? 'R' : 'L'}`, 'engine.hood_hinge'); const b = new Batch();
    const ax = sgn * 25.9; // arm sits outboard of the body bracket
    const plateY = yIn(16.4, sgn * 24.4) - 0.2;
    // hood-side mounting plate bolted under the inner panel, with the four bolts
    b.add('zinc', rbox([sgn * 24.6, plateY, 16.4], 4.4, 0.24, 5.4, 0.1));
    for (const dx of [-1.4, 1.4]) for (const ds of [-1.9, 1.9]) fast.bolt([sgn * 24.6 + dx, plateY - 0.12, 16.4 + ds], [0, -1, 0], 0.32);
    // stamped S-shaped arm from the plate up around to the pivot, with a reinforcing flange
    const arm = [[ax, plateY - 0.05, 14.4], [ax, plateY - 0.3, 17.2], [ax, plateY + 0.6, 18.9], [ax, HINGE.pivotY - 0.8, 19.3], [ax, HINGE.pivotY, HINGE.pivotS]];
    b.add('steelBlack', tube(arm, 0.55, { radial: 8, tension: 0.5 }));
    b.add('steelBlack', rbox([ax, plateY - 0.2, 15.6], 1.2, 0.3, 4.0, 0.12));
    b.add('steelRaw', cylAxis('x', [ax + sgn * 0.5, HINGE.pivotY, HINGE.pivotS], 0.95, 0.35, 16)); // pin end washer
    // coil spring: flat spiral (clock spring) wound around the pivot pin in a stamped cup, tail hooked on the arm
    b.add('steelBlack', cylAxis('x', [ax + sgn * 0.9, HINGE.pivotY, HINGE.pivotS], 1.75, 0.3, 28));
    const turns = 3.6, segs = Math.round(26 * turns * Math.max(0.6, d));
    for (let k = 0; k < 4; k++) {
      const xs = ax + sgn * (0.7 + k * 0.22), pts = [];
      for (let i = 0; i <= segs; i++) { const th = (i / segs) * turns * Math.PI * 2, r = 0.5 + (i / segs) * 1.1; pts.push([xs, HINGE.pivotY + Math.sin(th) * r, HINGE.pivotS + Math.cos(th) * r]); }
      b.add('steelRaw', tube(pts, 0.09, { radial: 5, segs, caps: false }));
    }
    b.add('steelRaw', tube([[ax + sgn * 1.0, HINGE.pivotY + 1.6, HINGE.pivotS + 0.3], [ax + sgn * 1.0, HINGE.pivotY + 1.7, HINGE.pivotS - 1.4], [ax + sgn * 0.2, HINGE.pivotY + 0.9, HINGE.pivotS - 2.4]], 0.11, { radial: 5 })); // outer tail
    b.flush(g, mats, { name: 'ha' });
    A.hinges[sgn > 0 ? 'R' : 'L'] = g;
  }

  // ================= washer jets on the skin (rear) and the hose clipped along the rear edge to the hinge =================
  {
    const g = part(inch, 'hood_washer', 'engine.washer_jets'); const b = new Batch();
    for (const x of [-9.4, 9.4]) {
      const y = hoodHeight(14.6, x);
      b.add('plastic', rbox([x, y + 0.1, 14.6], 1.9, 0.5, 1.5, 0.2)); b.add('plastic', cylAxis('y', [x, y + 0.42, 14.6], 0.55, 0.3, 12));
      b.add('padClip', cylAxis('y', [x, y + 0.6, 14.4], 0.12, 0.2, 8));
      b.add('cable', tube([[x, y - 0.2, 14.6], [x, yIn(14.8, x) - 0.1, 14.8]], 0.24, { radial: 6, caps: false }));
    }
    const rim = (x, s, dy = -0.3) => [x, yIn(s, x) + dy, s];
    b.add('cable', tube([rim(9.4, 14.8), rim(4.5, 17.0, -0.55), rim(-5, 17.6, -0.55), rim(-9.4, 14.8), rim(-9.4, 17.2, -0.55), rim(-15.5, 17.8, -0.55), rim(-21.5, 17.8, -0.55), rim(-24.6, 18.6, -0.6), [-25.0, 52.6, 19.2], [-24.5, 54.0, 19.6]], 0.24, { radial: 6, segs: 70 }));
    for (const [x, s] of [[0, 17.5], [-15.5, 17.8], [-22.0, 17.9]]) fast.bolt([x, yIn(s, x) - 0.65, s], [0, -1, 0], 0.28);
    b.flush(g, mats, { name: 'hw' });
    A.washerJets = g;
  }

  { const fg = part(inch, 'fasteners_hood', 'engine.fasteners'); fast.flush(fg); }
  A.hoodHinge = { pivotS: HINGE.pivotS * IN, pivotY: HINGE.pivotY * IN, pivotSIn: HINGE.pivotS, pivotYIn: HINGE.pivotY, openAngleMax: HINGE.openAngleMaxDeg * Math.PI / 180, openAngleMaxDeg: HINGE.openAngleMaxDeg };
  return { group: root, anchors: A, hoodPose };
}
