// Rolling professional tool chests: a roll cab with an optional top chest, drawers that really open and close,
// chrome pulls, key locks, swivel casters, and sockets / wrenches / pliers / screwdrivers lying inside.
import { THREE, Part, rbox, rng, interactive, label, worldBox } from './common.js';
import { Drawer, layoutDrawers } from './drawers.js';
import { foot } from './plan.js';

const DRAWER_GAP = 0.004;

// Fill one drawer tray with tools. Local frame: origin at the tray center on the foam surface, x across, z toward the back (negative z).
function fillTray(P, M, kind, tw, td, seed) {
  const r = rng(seed);
  const x0 = -tw / 2, zf = -0.02; // first row near the front
  if (kind === 'sockets') {
    const rows = Math.max(2, Math.floor((td - 0.06) / 0.075));
    for (let k = 0; k < rows; k++) {
      const z = zf - 0.04 - k * 0.075;
      P.box(M.blackPlastic || M.plastic, tw - 0.02, 0.012, 0.022, 0, 0.006, z);
      const n = Math.floor((tw - 0.06) / 0.034);
      for (let i = 0; i < n; i++) {
        const x = x0 + 0.04 + i * ((tw - 0.08) / Math.max(1, n - 1));
        const big = k % 2 === 1 ? 1.22 : 1.0, taper = 1 - (i / n) * 0.35;
        const rad = 0.0105 * big * (0.75 + 0.25 * taper);
        const h = 0.026 + 0.014 * (1 - i / n) * (k % 2 === 0 ? 1 : 0.6);
        P.cyl(M.chrome, rad, h, x, 0.012 + h / 2, z, { seg: 10 });
        P.cyl(M.darkSteel, rad * 1.03, 0.006, x, 0.012 + h - 0.004, z, { seg: 10 }); // size band near the top
      }
    }
  } else if (kind === 'wrenches') {
    const n = Math.floor((tw - 0.05) / 0.033);
    for (let i = 0; i < n; i++) {
      const L = 0.13 + (i / Math.max(1, n - 1)) * 0.2, hr = 0.011 + (i / n) * 0.0065;
      const x = x0 + 0.03 + i * 0.033, z0 = zf - 0.03;
      const zc = z0 - L / 2;
      P.box(M.chrome, 0.012, 0.005, L, x, 0.003, zc);
      P.cyl(M.chrome, hr, 0.006, x, 0.0035, z0 - L, { seg: 10 });
      P.cyl(M.chrome, hr * 1.1, 0.006, x, 0.0035, z0, { seg: 10 });
      P.cyl(M.foam, hr * 0.55, 0.008, x, 0.0045, z0, { seg: 8 });
      P.cyl(M.foam, hr * 0.5, 0.008, x, 0.0045, z0 - L, { seg: 8 });
    }
  } else if (kind === 'pliers') {
    const cols = [M.red, M.black, M.safetyYellow];
    for (let i = 0; i < 5; i++) {
      const x = x0 + 0.06 + i * ((tw - 0.12) / 4), L = 0.15 + r() * 0.05;
      P.box(M.chrome, 0.03, 0.01, 0.07, x, 0.006, zf - 0.07, {});
      P.box(cols[i % 3], 0.012, 0.014, L, x - 0.012, 0.009, zf - 0.07 - 0.035 - L / 2, { ry: 0.05 });
      P.box(cols[i % 3], 0.012, 0.014, L, x + 0.012, 0.009, zf - 0.07 - 0.035 - L / 2, { ry: -0.05 });
    }
  } else if (kind === 'drivers') {
    const cols = [M.red, M.safetyYellow, M.black, M.orange];
    const n = Math.floor((tw - 0.05) / 0.03);
    for (let i = 0; i < n; i++) {
      const x = x0 + 0.03 + i * 0.03, hl = 0.1, sl = 0.07 + (i % 4) * 0.03;
      P.cyl(cols[i % 4], 0.0105, hl, x, 0.011, zf - 0.04 - hl / 2, { axis: 'z', seg: 8 });
      P.cyl(M.chrome, 0.0035, sl, x, 0.011, zf - 0.04 - hl - sl / 2, { axis: 'z', seg: 6 });
    }
  } else if (kind === 'ratchets') {
    for (let i = 0; i < 4; i++) {
      const x = x0 + 0.08 + i * ((tw - 0.16) / 3), L = 0.2 + (i % 2) * 0.1;
      P.cyl(M.chrome, 0.018, 0.012, x, 0.008, zf - 0.04, { seg: 12 });
      P.box(M.black, 0.02, 0.014, L, x, 0.008, zf - 0.04 - L / 2 - 0.01);
      P.box(M.chrome, 0.026, 0.01, 0.07, x, 0.008, zf - 0.04 - 0.01 - 0.035 + 0);
    }
    for (let i = 0; i < 6; i++) P.cyl(M.chrome, 0.0055, 0.1 + (i % 3) * 0.05, x0 + 0.05 + i * 0.045, 0.008, zf - td + 0.14, { axis: 'z', seg: 6 });
  } else if (kind === 'misc') {
    for (let i = 0; i < 6; i++) {
      const x = x0 + 0.08 + r() * (tw - 0.16), z = zf - 0.05 - r() * (td - 0.2);
      P.box(r() < 0.5 ? M.orange : M.steel, 0.05 + r() * 0.05, 0.03 + r() * 0.02, 0.05 + r() * 0.06, x, 0.02, z, { ry: r() * 3 });
    }
  }
}

const KINDS = ['pliers', 'drivers', 'wrenches', 'sockets', 'ratchets', 'sockets', 'misc', 'wrenches'];

function buildDrawer(M, { W, D, h, kind, frontMat, seed, travel, pullY = null, tool = true, inner = true }) {
  const g = new THREE.Group();
  const fw = W - 0.004, ft = 0.022;
  const front = new Part();
  front.box(frontMat, fw, h - DRAWER_GAP, ft, 0, 0, 0, { r: 0.004 });
  const frontMeshes = front.build(g, { cast: false, name: 'drawerFront' });
  const trim = new Part();
  // chrome pull: a bar on two stand-offs along the top edge of the front
  const py = pullY ?? (h / 2 - 0.022);
  trim.cyl(M.chrome, 0.0075, fw - 0.1, 0, py, ft / 2 + 0.026, { axis: 'x', seg: 10 });
  trim.cyl(M.chrome, 0.006, 0.028, -(fw / 2 - 0.05), py, ft / 2 + 0.012, { axis: 'z', seg: 8 });
  trim.cyl(M.chrome, 0.006, 0.028, (fw / 2 - 0.05), py, ft / 2 + 0.012, { axis: 'z', seg: 8 });
  trim.build(g, { name: 'drawerPull' });
  const innerG = new THREE.Group(); innerG.name = 'drawerInner'; g.add(innerG);
  if (inner) {
    const td = D - 0.1, tw = W - 0.09, tz0 = -ft / 2; // tray runs back from the front plate
    const tray = new Part();
    const th = Math.max(0.05, h - 0.03);
    tray.box(M.steel, tw, 0.012, td, 0, -th / 2 + 0.006, tz0 - td / 2);        // floor
    tray.box(M.steel, 0.012, th, td, -tw / 2 + 0.006, 0, tz0 - td / 2);        // sides
    tray.box(M.steel, 0.012, th, td, tw / 2 - 0.006, 0, tz0 - td / 2);
    tray.box(M.steel, tw, th, 0.012, 0, 0, tz0 - td + 0.006);                  // back
    tray.box(M.foam, tw - 0.026, 0.012, td - 0.02, 0, -th / 2 + 0.018, tz0 - td / 2 - 0.004); // foam liner
    tray.build(innerG);
    if (tool) {
      const tp = new Part();
      // tools placed relative to the foam top, tray front
      const sub = new THREE.Group();
      fillTray(tp, M, kind, tw - 0.04, td - 0.03, seed);
      tp.build(sub, { name: 'tools' });
      sub.position.set(0, -th / 2 + 0.024, tz0 - 0.005);
      innerG.add(sub);
    }
  }
  const d = new Drawer({ travel, speed: 3.0 });
  g.userData.drawer = d;
  innerG.visible = false;
  g.userData.inner = innerG;
  return g;
}

// buildChest: returns { group, drawers, interactables, update(dt), colliderLocal }
export function buildChest(M, o) {
  const { W, D, hutch = null, cab, bodyMat, frontMat, name, labelId, seed = 1 } = o;
  const group = new THREE.Group(); group.name = name;
  const drawers = [];
  const CASTER = 0.14, CAB_H = o.cabH ?? 0.78, CAB_TOP = CASTER + CAB_H;
  const body = new Part();
  const t = 0.02;
  const topRail = 0.07, botRail = 0.025;
  // ---- cab shell ----
  body.box(bodyMat, t, CAB_H, D - 0.022, -W / 2 + t / 2, CASTER + CAB_H / 2, -0.011, { r: 0.004 });      // sides (behind the drawer fronts)
  body.box(bodyMat, t, CAB_H, D - 0.022, W / 2 - t / 2, CASTER + CAB_H / 2, -0.011, { r: 0.004 });
  body.box(M.darkSteel, W - 2 * t, CAB_H, 0.012, 0, CASTER + CAB_H / 2, -D / 2 + 0.006);    // back (dark inside)
  body.box(M.darkSteel, W - 2 * t, 0.02, D - 0.02, 0, CASTER + 0.01, -0.01);                // bottom
  body.box(bodyMat, W - 2 * t, botRail, 0.03, 0, CASTER + botRail / 2 + 0.02, D / 2 - 0.015); // bottom rail
  body.box(bodyMat, W - 2 * t, topRail, 0.03, 0, CAB_TOP - topRail / 2, D / 2 - 0.015);      // top rail (holds the lock)
  body.box(M.darkSteel, W - 2 * t, 0.02, D - 0.02, 0, CAB_TOP - 0.01, -0.01);               // inner top
  // work surface: ABS top with overhang
  body.box(M.black, W + 0.02, 0.028, D + 0.02, 0, CAB_TOP + 0.014, 0, { r: 0.008, seg: 2 });
  // key lock + latch bar on the top rail, small nameplate
  body.cyl(M.chrome, 0.011, 0.012, W / 2 - 0.09, CAB_TOP - topRail / 2, D / 2 + 0.003, { axis: 'z', seg: 14 });
  body.cyl(M.darkSteel, 0.0045, 0.014, W / 2 - 0.09, CAB_TOP - topRail / 2, D / 2 + 0.004, { axis: 'z', seg: 6 });
  body.box(M.chrome, 0.15, 0.022, 0.004, -W / 2 + 0.14, CAB_TOP - topRail / 2, D / 2 + 0.002);
  // side push handle (tube) on the left, side handle on the right
  for (const sx of [-1, 1]) {
    body.box(M.darkSteel, 0.014, 0.03, 0.04, sx * (W / 2 + 0.007), CAB_TOP - 0.1, D / 2 - 0.1);
    body.box(M.darkSteel, 0.014, 0.03, 0.04, sx * (W / 2 + 0.007), CAB_TOP - 0.1, -D / 2 + 0.1);
    body.cyl(M.chrome, 0.012, D - 0.2, sx * (W / 2 + 0.035), CAB_TOP - 0.1, 0, { axis: 'z', seg: 10 });
  }
  // casters: swivel fork + rubber wheel, plus a swivel-lock dot
  const cx = W / 2 - 0.07, cz = D / 2 - 0.07;
  const casterRubber = M.rubber;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * cx, z = sz * cz;
    body.cyl(M.darkSteel, 0.045, 0.012, x, CASTER - 0.006 + 0.0, z, { seg: 12 });           // swivel plate
    body.box(M.steel, 0.007, 0.07, 0.07, x - 0.022, 0.095, z);                               // fork
    body.box(M.steel, 0.007, 0.07, 0.07, x + 0.022, 0.095, z);
    body.cyl(casterRubber, 0.058, 0.032, x, 0.058, z, { axis: 'x', seg: 16 });               // wheel
    body.cyl(M.satin, 0.02, 0.04, x, 0.058, z, { axis: 'x', seg: 10 });                      // hub
  }
  // ---- top chest ----
  let hutchTop = CAB_TOP + 0.028;
  const HD = hutch ? (o.hutchD ?? D - 0.17) : 0;
  let hutchOpen = 0;
  if (hutch) {
    const HH = o.hutchH ?? 0.5, HW = W - 0.04;
    const hz = -D / 2 + HD / 2 + 0.03; // set back toward the rear so the cab top has a front ledge
    const y0 = hutchTop;
    body.box(bodyMat, t, HH, HD - 0.022, -HW / 2 + t / 2, y0 + HH / 2, hz - 0.011, { r: 0.004 });
    body.box(bodyMat, t, HH, HD - 0.022, HW / 2 - t / 2, y0 + HH / 2, hz - 0.011, { r: 0.004 });
    body.box(M.darkSteel, HW - 2 * t, HH, 0.012, 0, y0 + HH / 2, hz - HD / 2 + 0.006);
    body.box(M.darkSteel, HW - 2 * t, 0.02, HD - 0.02, 0, y0 + 0.01, hz);
    body.box(bodyMat, HW - 2 * t, 0.04, 0.03, 0, y0 + 0.02, hz + HD / 2 - 0.015);
    body.box(bodyMat, HW - 2 * t, 0.035, 0.03, 0, y0 + HH - 0.0175, hz + HD / 2 - 0.015);
    // lid with a lip, chrome piano hinge at the back, a lid stay
    body.box(bodyMat, HW + 0.01, 0.026, HD + 0.01, 0, y0 + HH + 0.013, hz, { r: 0.008 });
    body.box(M.chrome, HW - 0.1, 0.018, 0.008, 0, y0 + HH, hz - HD / 2 - 0.005);
    body.cyl(M.chrome, 0.011, 0.012, HW / 2 - 0.08, y0 + HH - 0.0175, hz + HD / 2 + 0.003, { axis: 'z', seg: 14 });
    hutchTop = y0 + HH + 0.026; hutchOpen = HH;
    // hutch drawers
    const hs = layoutDrawers(hutch, DRAWER_GAP, HH - 0.04 - 0.035 - 0.0);
    hs.forEach((s, i) => {
      const d = buildDrawer(M, { W: HW, D: HD, h: s.h, kind: KINDS[(i * 3 + seed) % KINDS.length], frontMat, seed: seed * 17 + i, travel: HD - 0.08, pullY: s.h > 0.1 ? s.h / 2 - 0.024 : 0.0 });
      d.position.set(0, y0 + 0.04 + s.y, hz + HD / 2 - 0.011);
      d.userData.homeZ = d.position.z; d.userData.where = 'top chest';
      group.add(d); drawers.push(d);
    });
  }
  // ---- cab drawers ----
  const openingH = CAB_H - botRail - 0.02 - topRail;
  const cs = layoutDrawers(cab, DRAWER_GAP, openingH);
  cs.forEach((s, i) => {
    const d = buildDrawer(M, { W: W - 0.0, D, h: s.h, kind: KINDS[(i * 5 + seed * 2) % KINDS.length], frontMat, seed: seed * 31 + i + 100, travel: D - 0.1, pullY: s.h / 2 - 0.026 });
    d.position.set(0, CASTER + botRail + 0.02 + s.y, D / 2 - 0.011);
    d.userData.homeZ = d.position.z; d.userData.where = 'cabinet';
    group.add(d); drawers.push(d);
  });
  body.build(group, { cast: true, name: 'chestBody' });
  // interactions
  const interactables = [];
  drawers.forEach((d, i) => {
    interactive(d, () => (d.userData.drawer.isOpen ? 'Close drawer' : 'Open drawer'), (ctx) => {
      const open = d.userData.drawer.toggle();
      if (open) d.userData.inner.visible = true;
      ctx?.say?.(open ? `Drawer opened: ${tooltip(d, i)}` : 'Drawer closed');
    });
    interactables.push(d);
  });
  label(group, labelId);
  const totalH = hutch ? hutchTop : CAB_TOP + 0.028;
  return {
    group, drawers, interactables, height: totalH,
    update(dt) {
      for (const d of drawers) {
        const dr = d.userData.drawer;
        if (dr.update(dt) || dr.t === 0 || dr.t === 1) {
          d.position.z = d.userData.homeZ + dr.offset;
          if (dr.t === 0 && !dr.target) d.userData.inner.visible = false;
        }
      }
    },
  };
}

function tooltip(d, i) {
  const k = d.userData.where;
  return `${k} drawer ${i + 1}`;
}

// ---- the three chests of the shop ----
export function buildToolboxes(M, place) {
  const out = [];
  // A: large red 56 inch roll cab with a red top chest (black work surface, black casters hubs)
  const A = buildChest(M, { name: 'toolboxLarge', labelId: 'shop.toolboxLarge', W: 1.42, D: 0.62, bodyMat: M.red, frontMat: M.red, hutch: [0.07, 0.09, 0.11, 0.14], cab: [0.085, 0.085, 0.1, 0.12, 0.14, 0.18], seed: 1 });
  place(A.group, foot('toolbox.A').x, 0, foot('toolbox.A').z, Math.PI);
  // B: black and red 40 inch combo (black body with red drawer fronts)
  const B = buildChest(M, { name: 'toolboxSmall', labelId: 'shop.toolboxSmall', W: 1.0, D: 0.6, bodyMat: M.black, frontMat: M.red, hutch: [0.08, 0.1, 0.14], cab: [0.09, 0.11, 0.14, 0.17, 0.2], hutchH: 0.4, seed: 2 });
  place(B.group, foot('toolbox.B').x, 0, foot('toolbox.B').z, Math.PI);
  // C: short bench cart (cab only) with black fronts and red body
  const C = buildChest(M, { name: 'toolboxBench', labelId: 'shop.toolboxBench', W: 0.8, D: 0.55, bodyMat: M.red, frontMat: M.black, hutch: null, cab: [0.09, 0.1, 0.14, 0.2], cabH: 0.74, seed: 3 });
  place(C.group, foot('toolbox.C').x, 0, foot('toolbox.C').z, Math.PI / 2);
  for (const c of [A, B, C]) out.push(c);
  return out;
}
