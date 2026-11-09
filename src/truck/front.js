// Front end of the 2003-2007 GMT800 Classic HD: grille surround with horizontal-slat grilles, chrome bar with the GOLD bowtie,
// cat-eye headlamps with the lower turn/park units, black bumper cap over a chrome strip, valance with fog lamps and tow-hook slots.
// Layout measured from reference/IMG_2853, 2860, 2873 (front views). Inches in the truck frame, converted at the end.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from '../core/materials.js';
import { IN_TO_M as IN, S_FRONT } from './skin.js';
import { gridPanel } from './panels.js';

const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, s) => new THREE.Vector3(x * IN, y * IN, s * IN);

// front face surface: where the fascia is in s (inches rearward of the front axle) at lateral x and height y
export const faceS = (x, y) => -30.8 - (47.4 - y) * 0.2 - 1.5 * Math.max(0, 1 - Math.pow(x / 40, 2)) + 0.0 * x;

// a bent rectangle patch on the front face (x0..x1, y0..y1), with an offset forward (negative s)
function facePatch(x0, x1, y0, y1, off = 0, nI = 14, nJ = 6) {
  const P = [], uv = [], ind = [];
  for (let j = 0; j <= nJ; j++) for (let i = 0; i <= nI; i++) {
    const x = lerp(x0, x1, i / nI), y = lerp(y0, y1, j / nJ);
    const p = V(x, y, faceS(x, y) - off); P.push(p.x, p.y, p.z); uv.push(x * IN, y * IN);
  }
  for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) { const a = j * (nI + 1) + i, b = a + 1, c = a + nI + 2, d = a + nI + 1; ind.push(a, d, b, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
  return g;
}

// rounded rectangle shape
function rrShape(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}

// extrude a shape (in x,y inches) with depth along -s (toward the front), then bend it onto the front face
function bentExtrude(shape, depthIn, { bevel = 0.18, off = 0, cx = 0, cy = 0, bendFace = true, segs = 3 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depthIn, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 10 });
  g.scale(IN, IN, IN);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / IN + cx, y = pos.getY(i) / IN + cy, zl = pos.getZ(i) / IN; // zl = local depth (0 at back, +depth at front)
    const sFace = bendFace ? faceS(x, y) : -31;
    pos.setXYZ(i, x * IN, y * IN, (sFace - zl - off) * IN);
  }
  g.computeVertexNormals();
  return g;
}

function bowtieShape(w = 11.0) {
  const k = w / 2;
  const pts = [[-1, 0.13], [-0.34, 0.2], [-0.22, 0.34], [0.22, 0.34], [0.34, 0.2], [1, 0.13], [1, -0.13], [0.34, -0.2], [0.22, -0.34], [-0.22, -0.34], [-0.34, -0.2], [-1, -0.13]];
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x * k, y * k) : s.moveTo(x * k, y * k))); s.closePath(); return s;
}

export function buildFront({ quality }) {
  const group = new THREE.Group(); group.name = 'front';
  const paint = mat.paint(); paint.side = THREE.DoubleSide;
  const chrome = mat.chrome();
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd2a23a, metalness: 1.0, roughness: 0.18, envMapIntensity: 1.5, clearcoat: 0.6 });
  const black = mat.blackPlastic(0.55);
  const blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x0d0e10, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const bumperBlack = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.62, metalness: 0.05 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0xe9efee, roughness: 0.04, metalness: 0, transmission: 0, transparent: true, opacity: 0.42, clearcoat: 1, envMapIntensity: 1.6, ior: 1.5 });
  const amberLens = new THREE.MeshPhysicalMaterial({ color: 0xff8a14, roughness: 0.1, transparent: true, opacity: 0.8, clearcoat: 1, envMapIntensity: 1.2 });
  const reflector = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 1, roughness: 0.12, envMapIntensity: 1.6 });
  const bulb = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.3 });
  const add = (g, m, name, cast = true) => { const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.castShadow = cast; mesh.receiveShadow = true; group.add(mesh); return mesh; };

  // ---------- body-color surround (frame around the grille openings) ----------
  // The surround's top edge is the hood's shut line; it follows the hood table in skin.js (hood front
  // 49.6 in at s = -30.5) so the hood and the grille meet without a gap, as in IMG_2853.
  const sur = [];
  sur.push(facePatch(-25.2, 25.2, 49.0, 50.5, 0)); // top strip
  sur.push(facePatch(-25.2, -22.0, 33.0, 49.0, 0)); // left post
  sur.push(facePatch(22.0, 25.2, 33.0, 49.0, 0)); // right post
  sur.push(facePatch(-22.0, 22.0, 33.0, 34.2, 0, 14, 2)); // bottom strip
  sur.push(facePatch(-22.0, 22.0, 38.2, 38.8, 0, 14, 1)); // between-grille web (behind the chrome bar)
  add(mergeGeometries(sur, false), paint, 'grille_surround');

  // grilles: recessed black box with silver horizontal bars and thin dividers
  const grille = (hw, y0, y1, bars, name) => {
    const back = facePatch(-hw, hw, y0, y1, -1.6, 10, 2); // recessed 1.6 in behind the face (offset negative = rearward)
    add(back, new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.8 }), name + '_back', false);
    const h = (y1 - y0) / bars;
    const geo = new THREE.BoxGeometry(2 * hw * IN, 0.34 * IN, 0.4 * IN);
    const im = new THREE.InstancedMesh(geo, mat.chrome(), bars);
    const m = new THREE.Matrix4();
    for (let i = 0; i < bars; i++) { const y = y0 + h * (i + 0.5); m.makeTranslation(0, y * IN, (faceS(0, y) + 0.2) * IN); im.setMatrixAt(i, m); }
    im.name = name + '_bars'; group.add(im);
    // bar edges follow the curve of the face: split each bar into 6 bent pieces for the plan curvature
    im.visible = false;
    const pieces = [];
    for (let b = 0; b < bars; b++) {
      const y = y0 + h * (b + 0.5);
      const p = facePatch(-hw, hw, y - 0.17, y + 0.17, 0.15, 16, 1);
      pieces.push(p);
    }
    add(mergeGeometries(pieces, false), mat.chrome(), name + '_slats');
    // vertical dividers
    const dv = [];
    for (const x of [-hw * 0.5, 0, hw * 0.5]) dv.push(facePatch(x - 0.18, x + 0.18, y0, y1, 0.1, 1, 1));
    add(mergeGeometries(dv, false), new THREE.MeshStandardMaterial({ color: 0x6a6d70, metalness: 0.8, roughness: 0.4 }), name + '_dividers', false);
  };
  grille(22.0, 44.4, 49.0, 10, 'grille_upper');
  grille(21.4, 34.4, 38.2, 8, 'grille_lower');

  // ---------- chrome bar with the gold bowtie ----------
  {
    const bar = [];
    bar.push(facePatch(-37.2, 37.2, 38.5, 41.7, 0.35, 40, 4));
    const g = mergeGeometries(bar, false);
    add(g, chrome, 'chrome_bar');
    const bt = bentExtrude(bowtieShape(11.4), 0.5, { bevel: 0.12, off: 0.35, cx: 0, cy: 40.1 });
    add(bt, gold, 'bowtie_gold');
  }

  // ---------- headlamps (cat-eye) ----------
  for (const sx of [-1, 1]) {
    const hl = new THREE.Group(); hl.name = `headlamp_${sx > 0 ? 'R' : 'L'}`;
    // upper main lamp: rounded polygon, tilted
    const mk = (cx, cy, w, h, depth, name) => {
      const sh = rrShape(w, h, Math.min(w, h) * 0.28);
      // housing (black), reflector bowl and lens
      const housing = bentExtrude(sh, depth, { bevel: 0.08, cx: sx * cx, cy, off: -0.2 });
      const lensG = bentExtrude(rrShape(w - 0.5, h - 0.5, Math.min(w, h) * 0.24), 0.18, { bevel: 0.2, cx: sx * cx, cy, off: 0.15 });
      const refl = bentExtrude(rrShape(w - 1.3, h - 1.1, Math.min(w, h) * 0.22), 0.2, { bevel: 0.35, cx: sx * cx, cy, off: -0.15 });
      const parts = { housing, lensG, refl };
      add(housing, black, `${name}_housing`); add(refl, reflector, `${name}_reflector`, false); add(lensG, lens, `${name}_lens`, false);
      // bulb
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 * IN, 12, 8), bulb); const sb = faceS(sx * cx, cy);
      b.position.set(sx * (cx - 0.5) * IN, cy * IN, (sb + 1.6) * IN); b.name = `${name}_bulb`; group.add(b);
    };
    mk(30.0, 42.8, 12.6, 8.6, 3.0, `hl_main_${sx > 0 ? 'R' : 'L'}`);
    // lower turn/parking lamp
    mk(30.0, 36.4, 12.6, 5.6, 2.6, `hl_turn_${sx > 0 ? 'R' : 'L'}`);
    // amber outboard section on the lower lamp
    const amb = bentExtrude(rrShape(2.6, 4.4, 0.9), 0.16, { bevel: 0.18, cx: sx * 35.0, cy: 36.4, off: 0.18 });
    add(amb, amberLens, `hl_amber_${sx > 0 ? 'R' : 'L'}`, false);
  }

  // ---------- bumper ----------
  // plan-view outline of the cap: nose at s = S_FRONT (-38.5), wrapping back to the fender at x = +-39.6, s about -24
  {
    const cap = new THREE.Shape();
    const hw = 39.7, thick = 3.6;
    // outline in the (x, y_shape) plane where y_shape = -s (front is +y); rotateX(-90 deg) later maps y_shape -> -z... see make()
    const n = 40; const front = [];
    for (let i = 0; i <= n; i++) {
      const t = -1 + (2 * i) / n; const wrap = Math.pow(Math.abs(t), 4.2);
      front.push([t * hw, -(S_FRONT + (-S_FRONT - 24) * wrap * 0.58)]);
    }
    cap.moveTo(front[0][0], front[0][1]);
    for (let i = 1; i < front.length; i++) cap.lineTo(front[i][0], front[i][1]);
    for (let i = front.length - 1; i >= 0; i--) cap.lineTo(front[i][0] * 0.985, front[i][1] - thick - (i === 0 || i === n ? 3.5 : 0));
    cap.closePath();
    const make = (y0, y1, bev) => {
      const g = new THREE.ExtrudeGeometry(cap, { depth: y1 - y0, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 8 });
      g.scale(IN, IN, IN);
      g.rotateX(-Math.PI / 2); // shape y -> -z (so y_shape = -s gives z = s), extrusion z -> +y
      g.translate(0, y0 * IN, 0);
      g.computeVertexNormals(); return g;
    };
    add(make(25.6, 32.0, 0.5), bumperBlack, 'bumper_cap');
    // two slots in the upper cap (as in the photos): dark recesses
    for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(9 * IN, 1.1 * IN, 0.4 * IN), new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 1 })); s.position.set(sx * 11 * IN, 26.9 * IN, (S_FRONT - 0.05) * IN); group.add(s); }
    add(make(21.0, 25.7, 0.35), chrome, 'bumper_chrome');
    // lower valance (dark gray), set back
    const val = make(16.8, 21.1, 0.25); val.scale(0.94, 1, 0.94); val.translate(0, 0, 1.3 * IN);
    add(val, new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.7, metalness: 0.1 }), 'bumper_valance');
    // fog lamps in the valance
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(5.2 * IN, 2.4 * IN, 0.6 * IN), new THREE.MeshPhysicalMaterial({ color: 0xe8f0ee, transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1 }));
      f.position.set(sx * 31.5 * IN, 19.0 * IN, (S_FRONT + 2.4) * IN); f.name = 'fog_lamp'; group.add(f);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(5.5 * IN, 2.0 * IN, 0.5 * IN), new THREE.MeshStandardMaterial({ color: 0x050505 }));
      hook.position.set(sx * 17.5 * IN, 19.2 * IN, (S_FRONT + 1.9) * IN); group.add(hook);
    }
  }
  group.userData.labelId = 'truck.front';
  return { group };
}

// ---------------- mirrors (power tow-style, black) and handles ----------------
export function buildMirror({ side }) {
  const g = new THREE.Group(); g.name = `mirror_${side > 0 ? 'R' : 'L'}`;
  const black = new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.5, metalness: 0.05 });
  const mirrorGlass = new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 1, roughness: 0.03, envMapIntensity: 1.8 });
  // housing: rounded box 4.6 in deep, 6.6 wide, 10.5 tall
  const housing = new THREE.Mesh(new THREE.BoxGeometry(5.0 * IN, 10.6 * IN, 6.4 * IN), black);
  housing.geometry = (function () { const s = rrShape(6.4, 10.6, 1.5); const e = new THREE.ExtrudeGeometry(s, { depth: 3.4, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.9, bevelSegments: 4, curveSegments: 8 }); e.scale(IN, IN, IN); e.rotateY(Math.PI / 2); e.translate(-2.2 * IN, 0, 0); return e; })();
  housing.castShadow = true; g.add(housing);
  // glass face (toward the rear of the truck, +z)
  const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6 * IN, 9.6 * IN), mirrorGlass);
  glassMesh.rotation.y = Math.PI * 0.5 * 0 + Math.PI; glassMesh.position.set(0, 0, 3.7 * IN); glassMesh.rotation.y = 0; g.add(glassMesh);
  // arm
  const arm = new THREE.Mesh(new THREE.BoxGeometry(5.6 * IN, 1.7 * IN, 1.8 * IN), black); arm.position.set(-side * 3.6 * IN, -4.2 * IN, -1.1 * IN); g.add(arm);
  g.rotation.y = side * -0.12;
  return g;
}

export function buildHandle({ side, key = 'f' }) {
  const g = new THREE.Group(); g.name = `handle_${key}${side > 0 ? 'R' : 'L'}`;
  const bl = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.45, metalness: 0.1 });
  const base = new THREE.Mesh((function () { const s = rrShape(7.0, 2.6, 1.1); const e = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3, curveSegments: 6 }); e.scale(IN, IN, IN); e.rotateY(Math.PI / 2); return e; })(), bl);
  g.add(base);
  const grip = new THREE.Mesh((function () { const s = rrShape(5.6, 1.4, 0.65); const e = new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3, curveSegments: 6 }); e.scale(IN, IN, IN); e.rotateY(Math.PI / 2); e.translate(0.45 * IN, 0, 0); return e; })(), bl);
  g.add(grip);
  if (key === 'f') { const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * IN, 0.45 * IN, 0.3 * IN, 14), new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 1, roughness: 0.3 })); lock.rotation.z = Math.PI / 2; lock.position.set(0.55 * IN, 0, -4.1 * IN); g.add(lock); }
  g.scale.x = side;
  return g;
}


