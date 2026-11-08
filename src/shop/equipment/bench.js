// Workbench against the west wall: butcher-block top on a welded steel frame, a swivel-base bench vise,
// a tool pegboard with hung tools, a bench grinder, and the small things that pile up on a real bench.
import { THREE, Part, label, rng, place } from './common.js';
import { foot } from './plan.js';

const TOP_Y = 0.9;     // work surface height (about 35 in)

function pegTools(P, M, bx, y0, z0, w) {
  // all tools hang on the board plane at x = bx; u runs along z; y0 = bottom of the board
  const x = bx + 0.03;
  const top = y0 + 0.84;
  const hook = (z, y) => { P.cyl(M.darkSteel, 0.0035, 0.05, bx + 0.025, y, z, { axis: 'x', seg: 5 }); };
  // wrench rail (left): nine combination wrenches
  const rz = -0.88;
  P.box(M.darkSteel, 0.012, 0.025, 0.62, x - 0.005, top - 0.02, rz);
  for (let i = 0; i < 9; i++) {
    const L = 0.12 + i * 0.016, zz = rz - 0.27 + i * 0.066;
    P.box(M.chrome, 0.012, L, 0.017, x + 0.01, top - 0.035 - L / 2, zz);
    P.cyl(M.chrome, 0.013 + i * 0.0007, 0.012, x + 0.01, top - 0.035 - L, zz, { axis: 'x', seg: 8 });
    P.cyl(M.chrome, 0.0135, 0.012, x + 0.01, top - 0.04, zz, { axis: 'x', seg: 8 });
  }
  // hammers and a dead blow mallet
  [-0.38, -0.27, -0.16].forEach((zz, i) => {
    const hy = top - 0.03;
    P.box(i === 2 ? M.red : M.safetyYellow, 0.018, 0.3, 0.022, x + 0.015, hy - 0.15, zz);
    P.box(M.darkSteel, 0.03, 0.045, i === 2 ? 0.08 : 0.1, x + 0.02, hy - 0.01, zz);
    if (i < 2) P.box(M.lightSteel, 0.026, 0.02, 0.03, x + 0.02, hy - 0.012, zz - 0.06);
    hook(zz, hy + 0.02);
  });
  // adjustable wrenches
  [0.0, 0.07].forEach((zz, i) => {
    const L = 0.28 - i * 0.07, hy = top - 0.03;
    P.box(M.chrome, 0.014, L, 0.026, x + 0.012, hy - L / 2, zz);
    P.box(M.chrome, 0.016, 0.06, 0.05, x + 0.012, hy - L - 0.02, zz);
    hook(zz, hy + 0.02);
  });
  // pliers: three pairs with colored grips
  const grips = [M.red, M.black, M.safetyYellow];
  [0.27, 0.37, 0.47].forEach((zz, i) => {
    const hy = top - 0.03;
    P.box(M.chrome, 0.012, 0.07, 0.034, x + 0.012, hy - 0.035, zz);
    P.box(grips[i], 0.016, 0.13, 0.014, x + 0.014, hy - 0.135, zz - 0.014);
    P.box(grips[i], 0.016, 0.13, 0.014, x + 0.014, hy - 0.135, zz + 0.014);
    hook(zz, hy + 0.02);
  });
  // hacksaw (right, hung flat) and a big pipe wrench
  P.box(M.black, 0.016, 0.014, 0.4, x + 0.015, top - 0.06, 0.88);
  P.box(M.black, 0.016, 0.2, 0.014, x + 0.015, top - 0.16, 0.7 + 0.0);
  P.box(M.lightSteel, 0.008, 0.012, 0.36, x + 0.012, top - 0.255, 0.88);
  P.box(M.red, 0.02, 0.4, 0.034, x + 0.02, top - 0.27, 1.07, { r: 0.006 });
  P.box(M.red, 0.026, 0.07, 0.07, x + 0.02, top - 0.495, 1.07);
  hook(0.7, top - 0.03); hook(1.07, top - 0.03);
  // screwdriver rail (middle left): eight screwdrivers
  const sy = y0 + 0.42, sz0 = -0.95;
  P.box(M.darkSteel, 0.012, 0.02, 0.5, x - 0.0, sy, sz0 + 0.22);
  for (let i = 0; i < 8; i++) {
    const zz = sz0 - 0.02 + i * 0.062, sl = 0.07 + (i % 4) * 0.025;
    P.cyl([M.red, M.safetyYellow, M.black, M.orange][i % 4], 0.0105, 0.095, x + 0.02, sy - 0.065, zz, { seg: 8 });
    P.cyl(M.chrome, 0.003, sl, x + 0.02, sy - 0.112 - sl / 2, zz, { seg: 5 });
  }
  // chisels / punches rail (middle)
  P.box(M.darkSteel, 0.012, 0.02, 0.34, x, sy, -0.3 + 0.1);
  for (let i = 0; i < 5; i++) {
    const zz = -0.38 + i * 0.065;
    P.cyl(M.lightSteel, 0.008, 0.1 + (i % 3) * 0.03, x + 0.02, sy - 0.07 - (i % 3) * 0.015, zz, { seg: 6 });
    P.cyl(M.darkSteel, 0.012, 0.012, x + 0.02, sy - 0.015, zz, { seg: 6 });
  }
  // tape measure, utility lamp, snips, drill bit case, zip ties
  P.box(M.safetyYellow, 0.04, 0.075, 0.08, x + 0.025, sy - 0.04, 0.05, { r: 0.008 }); P.box(M.black, 0.04, 0.02, 0.03, x + 0.025, sy - 0.04, 0.06); hook(0.05, sy);
  P.box(M.black, 0.03, 0.045, 0.14, x + 0.02, sy - 0.1, 0.33, { r: 0.005 }); P.box(M.orange, 0.012, 0.17, 0.026, x + 0.02, sy - 0.12, 0.33);
  hook(0.33, sy);
  P.box(M.orange, 0.04, 0.16, 0.22, x + 0.025, sy - 0.12, 0.62, { r: 0.008 }); P.box(M.black, 0.044, 0.04, 0.2, x + 0.026, sy - 0.09, 0.62);
  P.box(M.red, 0.04, 0.2, 0.06, x + 0.025, sy - 0.1, 0.95); hook(0.95, sy + 0.02);
  // bottom row: spray cans on a small shelf
  P.box(M.darkSteel, 0.1, 0.012, 0.9, bx + 0.05, y0 + 0.1, -0.55);
  for (let i = 0; i < 7; i++) { P.cyl([M.red, M.blue, M.safetyYellow, M.green, M.red, M.blue, M.orange][i], 0.032, 0.17, bx + 0.05, y0 + 0.195, -0.95 + i * 0.1, { seg: 10 }); P.cyl(M.black, 0.02, 0.02, bx + 0.05, y0 + 0.29, -0.95 + i * 0.1, { seg: 8 }); }
}

export function buildBench(ctx) {
  const { M, group } = ctx;
  const f = foot('bench');
  const bench = new THREE.Group(); bench.name = 'workbench';
  const L = f.hz * 2, D = f.hx * 2;       // along z, along x
  const P = new Part();
  // top: 2 in maple butcher block, steel edge guard
  P.box(M.wood, D, 0.05, L, 0, TOP_Y - 0.025, 0, { r: 0.004 });
  P.box(M.darkSteel, D - 0.02, 0.02, L - 0.02, 0, TOP_Y - 0.06, 0);
  // legs and aprons (2 in square tube)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(M.steel, 0.06, TOP_Y - 0.07, 0.06, sx * (D / 2 - 0.05), (TOP_Y - 0.07) / 2, sz * (L / 2 - 0.06));
  for (const sz of [-1, 0, 1]) P.box(M.steel, D - 0.12, 0.05, 0.05, 0, TOP_Y - 0.1, sz * (L / 2 - 0.06));
  for (const sx of [-1, 1]) P.box(M.steel, 0.05, 0.05, L - 0.12, sx * (D / 2 - 0.05), 0.22, 0);
  P.box(M.wood, D - 0.1, 0.03, L - 0.12, 0, 0.2, 0);                  // lower shelf
  for (const sx of [-1, 1]) P.box(M.steel, 0.05, 0.05, L - 0.12, sx * (D / 2 - 0.05), TOP_Y - 0.1, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(M.rubber, 0.07, 0.012, 0.07, sx * (D / 2 - 0.05), 0.006, sz * (L / 2 - 0.06));
  // three-drawer steel unit hung under the north end (fronts face the room, +x)
  const dz = -L / 2 + 0.45, ux = (D - 0.14) / 2;
  P.box(M.black, D - 0.14, 0.4, 0.78, 0, TOP_Y - 0.28, dz, { r: 0.006 });
  for (let i = 0; i < 3; i++) {
    P.box(M.darkSteel, 0.012, 0.11, 0.74, ux + 0.002, TOP_Y - 0.16 - i * 0.125 - 0.0 + 0.0, dz, { r: 0.003 });
    P.box(M.chrome, 0.012, 0.012, 0.3, ux + 0.022, TOP_Y - 0.13 - i * 0.125, dz);
  }
  // under-bench: two totes, a parts bin and an oil jug on the shelf
  P.box(M.grayPlastic, 0.4, 0.2, 0.5, 0.0, 0.325, 0.6, { r: 0.01 });
  P.box(M.grayPlastic, 0.4, 0.12, 0.45, 0.0, 0.28, 0.0, { r: 0.01 });
  P.box(M.red, 0.18, 0.2, 0.3, 0.0, 0.33, 1.2, { r: 0.01 });
  // ---- on the bench ----
  // props: brake-cleaner cans, a parts tray with fasteners, shop rags, a coffee can, a funnel
  const r = rng(21);
  for (let i = 0; i < 4; i++) {
    const cx = -0.18 + (i % 2) * 0.06, cz = 0.3 + (i >> 1) * 0.07 - 0.12;
    P.cyl([M.red, M.safetyYellow, M.red, M.blue][i], 0.033, 0.19, cx, TOP_Y + 0.095, cz, { seg: 10 });
    P.cyl(M.black, 0.02, 0.025, cx, TOP_Y + 0.2, cz, { seg: 8 });
  }
  P.box(M.steel, 0.26, 0.03, 0.34, 0.05, TOP_Y + 0.015, 0.7, { r: 0.004 });       // tray
  P.box(M.darkSteel, 0.24, 0.035, 0.015, 0.05, TOP_Y + 0.04, 0.7 + 0.16);
  for (let i = 0; i < 40; i++) { const bx = 0.05 + (r() - 0.5) * 0.2, bz = 0.7 + (r() - 0.5) * 0.28; P.cyl(M.lightSteel, 0.006, 0.03, bx, TOP_Y + 0.045, bz, { axis: r() < 0.5 ? 'x' : 'z', seg: 5, ry: r() * 3 }); P.cyl(M.chrome, 0.009, 0.006, bx + 0.02, TOP_Y + 0.036, bz + 0.01, { seg: 6 }); }
  P.cyl(M.safetyYellow, 0.055, 0.12, 0.05, TOP_Y + 0.06, -0.55, { seg: 14 });
  P.box(M.red, 0.18, 0.045, 0.22, 0.04, TOP_Y + 0.0225, 0.12, { r: 0.015, ry: 0.4 });           // folded shop towel
  P.box(M.fabric, 0.2, 0.04, 0.24, 0.0, TOP_Y + 0.065, 0.12, { r: 0.015, ry: -0.2 });
  const V = new Part();
  // bench vise (6 in) at the south end, front edge
  const vz = L / 2 - 0.32, vx = D / 2;
  V.cyl(M.darkSteel, 0.08, 0.02, vx - 0.12, TOP_Y + 0.01, vz, { seg: 16 });                    // swivel base
  V.box(M.blue, 0.15, 0.11, 0.14, vx - 0.02, TOP_Y + 0.075, vz, { r: 0.012 });                 // body
  V.box(M.darkSteel, 0.016, 0.075, 0.15, vx + 0.062, TOP_Y + 0.14, vz);                         // fixed jaw plate
  V.box(M.blue, 0.05, 0.09, 0.16, vx + 0.1, TOP_Y + 0.11, vz, { r: 0.008 });                   // movable jaw
  V.box(M.darkSteel, 0.012, 0.07, 0.15, vx + 0.075, TOP_Y + 0.14, vz);                          // movable jaw plate
  V.cyl(M.chrome, 0.013, 0.34, vx + 0.1, TOP_Y + 0.07, vz, { axis: 'x', seg: 10 });            // screw
  V.cyl(M.chrome, 0.007, 0.28, vx + 0.26, TOP_Y + 0.07, vz, { axis: 'z', seg: 8 });             // T handle
  V.sph(M.black, 0.014, vx + 0.26, TOP_Y + 0.07, vz - 0.14, { seg: 8 }); V.sph(M.black, 0.014, vx + 0.26, TOP_Y + 0.07, vz + 0.14, { seg: 8 });
  V.box(M.darkSteel, 0.06, 0.03, 0.09, vx - 0.02, TOP_Y + 0.14, vz); // anvil face
  const G = new Part();
  // bench grinder (6 in) at the north end near the wall
  const gz = -L / 2 + 0.28, gx = -0.05;
  G.box(M.darkSteel, 0.22, 0.02, 0.4, gx, TOP_Y + 0.01, gz, { r: 0.004 });
  G.cyl(M.green, 0.07, 0.3, gx, TOP_Y + 0.1, gz, { axis: 'z', seg: 18 });
  for (const s of [-1, 1]) {
    G.cyl(M.stone, 0.078, 0.025, gx, TOP_Y + 0.1, gz + s * 0.18, { axis: 'z', seg: 18 });
    G.cyl(M.darkSteel, 0.088, 0.012, gx, TOP_Y + 0.1, gz + s * 0.2, { axis: 'z', seg: 18 });
    G.box(M.darkSteel, 0.05, 0.018, 0.04, gx + 0.1, TOP_Y + 0.07, gz + s * 0.18);              // tool rest
    G.box(M.glass, 0.002, 0.07, 0.07, gx + 0.1, TOP_Y + 0.17, gz + s * 0.19);                 // spark guard (clear)
  }
  G.box(M.black, 0.06, 0.04, 0.06, gx + 0.07, TOP_Y + 0.06, gz, { r: 0.006 });                 // switch
  G.box(M.red, 0.02, 0.012, 0.02, gx + 0.1, TOP_Y + 0.065, gz);
  P.build(bench, { cast: false });
  // pegboard on the wall above the bench (1.25 .. 2.15 m)
  const peg = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.9, 2.4), M.pegboard);
  // metric UVs: BoxGeometry uv are 0..1 per face, remap in meters
  const uv = board.geometry.attributes.uv; const dims = [[2.4, 0.9], [2.4, 0.9], [0.012, 2.4], [0.012, 2.4], [0.012, 0.9], [0.012, 0.9]];
  for (let fc = 0; fc < 6; fc++) for (let v = 0; v < 4; v++) { const i = fc * 4 + v; uv.setXY(i, uv.getX(i) * dims[fc][0], uv.getY(i) * dims[fc][1]); }
  board.position.set(-0.40 + 0.0, 1.7, 0); board.receiveShadow = true; peg.add(board);
  const frame = new Part();
  frame.box(M.darkSteel, 0.03, 0.03, 2.44, -0.405, 1.255, 0); frame.box(M.darkSteel, 0.03, 0.03, 2.44, -0.405, 2.145, 0);
  frame.box(M.darkSteel, 0.03, 0.9, 0.03, -0.405, 1.7, -1.215); frame.box(M.darkSteel, 0.03, 0.9, 0.03, -0.405, 1.7, 1.215);
  pegTools(frame, M, -0.395, 1.28, 0.0, 2.4);
  // strip light above the pegboard
  frame.box(M.darkSteel, 0.08, 0.05, 1.3, -0.37, 2.22, 0, { r: 0.008 });
  frame.box(M.emissiveWhite, 0.05, 0.012, 1.24, -0.33, 2.205, 0);
  frame.build(peg, { cast: false });
  bench.add(peg);
  place(bench, f.x, 0, f.z, 0);
  label(bench, 'shop.workbench');
  const viseG = new THREE.Group(); viseG.name = 'vise'; V.build(viseG, { cast: false }); bench.add(viseG); label(viseG, 'shop.vise');
  const grinderG = new THREE.Group(); grinderG.name = 'grinder'; G.build(grinderG, { cast: false }); bench.add(grinderG); label(grinderG, 'shop.grinder');
  label(peg, 'shop.pegboard');
  group.add(bench);
  return bench;
}
