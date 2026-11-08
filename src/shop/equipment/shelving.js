// Industrial boltless steel shelving on the east wall: orange beams, blue-gray uprights, particleboard decks,
// printed cardboard parts boxes (one merged mesh with an atlas), oil jugs, pails and filters (instanced),
// and the reserved slot for the LBZ fuel pressure regulator.
import { THREE, Part, label, rng, tex, rbox } from './common.js';
import { boxAtlas, jugLabelCanvas } from './art.js';
import { foot } from './plan.js';

const BAYS = 5, BAY_W = 1.2, DEPTH = 0.6, HEIGHT = 2.1;
const DECK_Y = [0.18, 0.64, 1.1, 1.54, 1.96];   // deck tops
export const LBZ_BAY = 2, LBZ_LEVEL = 2;

const BOX_SIZES = [[0.36, 0.27, 0.4], [0.28, 0.21, 0.32], [0.44, 0.33, 0.44], [0.2, 0.15, 0.3], [0.32, 0.24, 0.36]];

function remapFaceUV(g, face, rect) {
  const uv = g.attributes.uv;
  for (let v = 0; v < 4; v++) { const i = face * 4 + v; uv.setXY(i, rect[0] + uv.getX(i) * (rect[2] - rect[0]), rect[1] + uv.getY(i) * (rect[3] - rect[1])); }
}

export function buildShelving(ctx) {
  const { M, group, quality, anchors } = ctx;
  const f = foot('shelving');
  const unit = new THREE.Group(); unit.name = 'shelving';
  unit.position.set(f.x, 0, f.z); unit.rotation.y = -Math.PI / 2;   // local +z = into the room (-x), local +x runs along +z
  const r = rng(314);
  const L = BAYS * BAY_W;

  // ---------- frame: uprights, beams, decks ----------
  const P = new Part();
  const chip = new THREE.MeshStandardMaterial({ color: 0xb59a6c, roughness: 0.9, metalness: 0 });
  for (let k = 0; k <= BAYS; k++) {
    const x = -L / 2 + k * BAY_W;
    for (const z of [-DEPTH / 2 + 0.03, DEPTH / 2 - 0.03]) { P.box(M.blue, 0.05, HEIGHT, 0.05, x, HEIGHT / 2, z); P.box(M.blue, 0.012, HEIGHT, 0.06, x, HEIGHT / 2, z); }
    P.box(M.darkSteel, 0.1, 0.012, 0.08, x, 0.006, DEPTH / 2 - 0.03); P.box(M.darkSteel, 0.1, 0.012, 0.08, x, 0.006, -DEPTH / 2 + 0.03); // foot plates
  }
  for (let lv = 0; lv < DECK_Y.length; lv++) {
    const y = DECK_Y[lv] - 0.018;
    for (let b = 0; b < BAYS; b++) {
      const cx = -L / 2 + (b + 0.5) * BAY_W;
      for (const z of [-DEPTH / 2 + 0.03, DEPTH / 2 - 0.03]) P.box(M.orange, BAY_W - 0.05, 0.07, 0.04, cx, y - 0.035, z);
      P.box(chip, BAY_W - 0.06, 0.018, DEPTH - 0.06, cx, y - 0.0, 0);
    }
  }
  // back sway braces on two bays
  for (const b of [0, 3]) {
    const cx = -L / 2 + (b + 0.5) * BAY_W;
    P.rod(M.steel, [cx - 0.55, 0.3, -DEPTH / 2 + 0.01], [cx + 0.55, 1.9, -DEPTH / 2 + 0.01], 0.008);
    P.rod(M.steel, [cx + 0.55, 0.3, -DEPTH / 2 + 0.01], [cx - 0.55, 1.9, -DEPTH / 2 + 0.01], 0.008);
  }
  P.build(unit, { cast: true, name: 'shelfFrame' });

  // ---------- parts boxes (merged mesh, atlas texture) ----------
  const atlas = boxAtlas(quality.tex);
  const boxMat = new THREE.MeshStandardMaterial({ map: tex(atlas.canvas, { wrap: false, aniso: quality.aniso }), roughness: 0.85, metalness: 0 });
  const B = new Part();
  const frontIds = ['kraftLabel', 'kraftGasket', 'whiteBox', 'blueBox', 'yellowBox', 'redBox', 'greenBox', 'kraftPlain'];
  const addBox = (w, h, d, x, y, z, ry, design) => {
    const g = new THREE.BoxGeometry(w, h, d);
    remapFaceUV(g, 4, atlas.uv[frontIds[design % frontIds.length]]);
    remapFaceUV(g, 5, atlas.uv.side2);
    remapFaceUV(g, 0, atlas.uv.end); remapFaceUV(g, 1, atlas.uv.side);
    remapFaceUV(g, 2, atlas.uv.tape); remapFaceUV(g, 3, atlas.uv.side);
    B.push(boxMat, g, x, y + h / 2, z, 0, ry, 0);
  };
  // instanced small-part carriers
  const jugs = [], pails = [], filters = [];
  const ROOM = 0.52; // usable width of a bay: [-ROOM, ROOM] about its center
  const fillRow = (cx, yd, lv, kindIdx) => {
    const clear = (lv < DECK_Y.length - 1 ? DECK_Y[lv + 1] - yd - 0.08 : 0.3);
    let cur = -ROOM;
    const kind = ['boxes', 'jugs', 'boxes', 'filters', 'pails', 'boxes', 'jugs', 'boxes'][kindIdx % 8];
    if (kind === 'boxes') {
      while (cur < ROOM - 0.2) {
        const s = BOX_SIZES[Math.floor(r() * BOX_SIZES.length)];
        const [w, h, d] = s;
        if (cur + w > ROOM + 0.02) break;
        const design = Math.floor(r() * 8);
        const nStack = Math.max(1, Math.min(3, Math.floor(clear / h)));
        const stack = r() < 0.45 ? nStack : 1;
        const zOff = 0.2 + (r() - 0.5) * 0.04 - d / 2 + 0.06;
        for (let k = 0; k < stack; k++) addBox(w, h, d, cx + cur + w / 2, yd + k * h, Math.min(zOff, DEPTH / 2 - d / 2 - 0.04), (r() - 0.5) * 0.08, design + k);
        cur += w + 0.02 + r() * 0.03;
      }
    } else if (kind === 'jugs') {
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 8; i++) { jugs.push([cx - ROOM + 0.07 + i * 0.135, yd, -0.1 + row * 0.22, Math.floor(r() * 5)]); }
      }
    } else if (kind === 'filters') {
      for (let row = 0; row < 4; row++) for (let i = 0; i < 10; i++) filters.push([cx - ROOM + 0.05 + i * 0.105, yd, -0.2 + row * 0.12, Math.floor(r() * 4)]);
    } else if (kind === 'pails') {
      for (let i = 0; i < 3; i++) pails.push([cx - ROOM + 0.18 + i * 0.34, yd, 0.0, Math.floor(r() * 4)]);
    }
  };
  for (let b = 0; b < BAYS; b++) {
    const cx = -L / 2 + (b + 0.5) * BAY_W;
    for (let lv = 0; lv < DECK_Y.length; lv++) {
      if (b === LBZ_BAY && lv === LBZ_LEVEL) continue;
      const k = b * 3 + lv * 5 + Math.floor(r() * 3);
      // lower decks carry the heavy fluids; upper decks carry boxes
      if (lv === 0) fillRow(cx, DECK_Y[lv], lv, [4, 1, 4, 6, 4][b]);
      else fillRow(cx, DECK_Y[lv], lv, [0, 2, 3, 5, 7][(b + lv) % 5] + (lv === 1 ? 1 : 0));
    }
  }
  // the reserved slot: a low kraft tray, neighbors keep clear; two spare small boxes at its sides
  const yd = DECK_Y[LBZ_LEVEL], cxl = -L / 2 + (LBZ_BAY + 0.5) * BAY_W;
  const tw = 0.34, td = 0.24, th = 0.07;
  const tg = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); for (let fc = 0; fc < 6; fc++) remapFaceUV(g, fc, atlas.uv.side2); B.push(boxMat, g, x, y, z, 0, 0, 0); };
  tg(tw, 0.006, td, cxl, yd + 0.003, 0.0);
  tg(tw, th, 0.006, cxl, yd + th / 2, td / 2 - 0.003);
  tg(tw, th * 0.8, 0.006, cxl, yd + th * 0.4, -td / 2 + 0.003);
  tg(0.006, th * 0.9, td, cxl - tw / 2 + 0.003, yd + th * 0.45, 0);
  tg(0.006, th * 0.9, td, cxl + tw / 2 - 0.003, yd + th * 0.45, 0);
  // side-stack neighbors so the slot reads as reserved between real stock
  addBox(0.2, 0.15, 0.3, cxl - 0.42, yd, 0.04, 0.03, 0);
  addBox(0.2, 0.15, 0.3, cxl + 0.42, yd, 0.02, -0.04, 2);
  B.build(unit, { cast: true, name: 'partsBoxes' });
  anchors.lbzRegulatorSlot = new THREE.Object3D();
  anchors.lbzRegulatorSlot.name = 'lbzRegulatorSlot';
  anchors.lbzRegulatorSlot.position.set(cxl, yd + 0.007, 0.0);
  anchors.lbzRegulatorSlot.userData.size = { w: tw - 0.02, h: 0.18, d: td - 0.02 };
  anchors.lbzRegulatorSlot.userData.note = 'floor of the reserved tray; local +Z points into the room, shop frame after the shelving rotation';
  unit.add(anchors.lbzRegulatorSlot);
  // sign on the beam below the slot: add as a separate small mesh in the unit frame
  {
    // signs are merged in shop frame; compute the shop-frame position of the beam front
    const wp = new THREE.Vector3(cxl, yd - 0.06, DEPTH / 2 - 0.008); unit.updateMatrixWorld(true); wp.applyMatrix4(unit.matrixWorld);
    ctx.signs.add('reserved', 0.22, wp.x, wp.y, wp.z, -Math.PI / 2);
  }

  // ---------- instanced jugs, pails, filters ----------
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  const palette = [0xd2601a, 0x1d5fb0, 0xc41820, 0x2d7a4a, 0xe8c000];
  if (jugs.length) {
    const body = new Part(); body.box(M.jugWhite, 0.12, 0.2, 0.17, 0, 0.1, 0, { r: 0.02 }); body.box(M.jugWhite, 0.03, 0.18, 0.05, 0.0, 0.1, -0.1); body.cyl(M.jugWhite, 0.028, 0.045, 0.04, 0.22, 0.0, { seg: 10 });
    const bg = mergeToGeo(body);
    const cap = new THREE.CylinderGeometry(0.031, 0.031, 0.022, 10); cap.translate(0.04, 0.255, 0.0);
    const lab = new THREE.PlaneGeometry(0.11, 0.12); lab.translate(0, 0.1, 0.0861);
    const labMat = new THREE.MeshStandardMaterial({ map: tex(jugLabelCanvas(quality.tex), { wrap: false, aniso: quality.aniso }), roughness: 0.5 });
    const ib = new THREE.InstancedMesh(bg, M.jugWhite, jugs.length), ic = new THREE.InstancedMesh(cap, M.plastic, jugs.length), il = new THREE.InstancedMesh(lab, labMat, jugs.length);
    jugs.forEach(([x, y, z, c], i) => {
      // jug faces the room: +z local; handle on the back (-z)
      q.setFromEuler(e.set(0, (r() - 0.5) * 0.12, 0)); m.compose(p.set(x, y, z), q, one);
      ib.setMatrixAt(i, m); ic.setMatrixAt(i, m); il.setMatrixAt(i, m);
      ic.setColorAt(i, col.set(palette[c % 5])); il.setColorAt(i, col.set([0xffffff, 0xe8d9b0, 0xd8e6f2, 0xf0d8d8, 0xe0f0e0][c % 5]));
    });
    for (const o of [ib, ic, il]) { o.castShadow = false; o.receiveShadow = true; unit.add(o); }
    ib.userData.labelId = 'shop.fluids'; il.userData.labelId = 'shop.fluids';
    il.instanceColor.needsUpdate = ic.instanceColor.needsUpdate = true;
  }
  if (pails.length) {
    const pg = new THREE.CylinderGeometry(0.15, 0.135, 0.34, 20, 1, false); pg.translate(0, 0.17, 0);
    const lid = new THREE.TorusGeometry(0.15, 0.008, 6, 20); lid.rotateX(Math.PI / 2); lid.translate(0, 0.335, 0);
    const handle = new THREE.TorusGeometry(0.1, 0.004, 5, 14, Math.PI); handle.rotateZ(0); handle.translate(0, 0.34, 0);
    const ip = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0 }), pails.length);
    const il2 = new THREE.InstancedMesh(lid, M.steel, pails.length), ih = new THREE.InstancedMesh(handle, M.chrome, pails.length);
    pails.forEach(([x, y, z, c], i) => {
      q.setFromEuler(e.set(0, r() * 6, 0)); m.compose(p.set(x, y, z), q, one);
      ip.setMatrixAt(i, m); il2.setMatrixAt(i, m); ih.setMatrixAt(i, m); ip.setColorAt(i, col.set([0xd2601a, 0xe9e6dc, 0x1d5fb0, 0xc9a000][c % 4]));
    });
    for (const o of [ip, il2, ih]) { o.castShadow = false; o.receiveShadow = true; unit.add(o); }
    ip.userData.labelId = 'shop.fluids';
  }
  if (filters.length) {
    const fg = new THREE.CylinderGeometry(0.045, 0.045, 0.11, 14); fg.translate(0, 0.055 + 0.01, 0);
    const base = new THREE.CylinderGeometry(0.048, 0.048, 0.016, 14); base.translate(0, 0.008, 0);
    const iF = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.35 }), filters.length);
    const iB = new THREE.InstancedMesh(base, M.steel, filters.length);
    filters.forEach(([x, y, z, c], i) => {
      m.compose(p.set(x, y, z), q.identity(), one); iF.setMatrixAt(i, m); iB.setMatrixAt(i, m);
      iF.setColorAt(i, col.set([0x1d5fb0, 0xd2601a, 0xe9e9e4, 0x2d7a4a][c % 4]));
    });
    for (const o of [iF, iB]) { o.castShadow = false; o.receiveShadow = true; unit.add(o); }
    iF.userData.labelId = 'shop.filters';
  }
  label(unit, 'shop.shelving');
  group.add(unit);
  return unit;
}

function mergeToGeo(part) {
  const meshes = part.build(new THREE.Group());
  return meshes[0].geometry;
}
