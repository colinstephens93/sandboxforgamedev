// Air system: vertical 80-gallon compressor, black-iron riser, copper header along the north and west walls (kept
// 0.05 m off the wall surface, never through a wall), drops with hose reels and quick couplers at three places.
import { THREE, Part, label, canvasMaterial, place } from './common.js';
import { gaugeCanvas } from './art.js';
import { foot } from './plan.js';
import { SHOP } from '../layout.js';

const PIPE_R = 0.0165;      // 3/4 in nominal copper / black iron (about 33 mm outside diameter)
const WALL = 0.06;          // pipe center distance from the wall surface

function gaugeMesh(M, quality, max, size = 0.045) {
  const g = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(size, size, 0.022, 20), M.chrome); bezel.rotation.x = Math.PI / 2; g.add(bezel);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(size * 0.9, 24), canvasMaterial(gaugeCanvas(max, 'PSI', 128), { roughness: 0.3 }));
  dial.position.z = 0.0115; g.add(dial);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(size * 0.9, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.02, clearcoat: 1 }));
  lens.position.z = 0.012; g.add(lens);
  return g;
}

function buildCompressor(M, quality) {
  const g = new THREE.Group(); g.name = 'compressor';
  const P = new Part();
  const R = 0.31, y0 = 0.1, y1 = 1.5;
  // tank: cylinder with elliptical heads (lathe, bottom to top)
  const prof = [];
  const hh = 0.12;
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; prof.push([R * Math.sin(a) + 0.0001, y0 + hh - hh * Math.cos(a)]); }
  prof.push([R, y1 - hh]);
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; prof.push([R * Math.cos(a) + 0.0001, y1 - hh + hh * Math.sin(a)]); }
  P.lathe(M.blue, prof, 0, 0, 0, { seg: 36 });
  P.torus(M.blue, R, 0.006, 0, y0 + hh, 0, { axis: 'y', seg: 36, rseg: 5 });
  P.torus(M.blue, R, 0.006, 0, y1 - hh, 0, { axis: 'y', seg: 36, rseg: 5 });
  // feet: three legs with a ring
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + Math.PI / 6; P.box(M.darkSteel, 0.1, 0.1, 0.08, Math.sin(a) * 0.23, 0.05, Math.cos(a) * 0.23, { ry: a }); P.box(M.rubber, 0.11, 0.012, 0.09, Math.sin(a) * 0.23, 0.006, Math.cos(a) * 0.23, { ry: a }); }
  // pump platform (on top)
  P.box(M.darkSteel, 0.62, 0.03, 0.58, 0, y1 + 0.02, 0.0, { r: 0.006 });
  // two-stage pump: crankcase, LP and HP cylinders with fins, heads, intercooler, air filter
  const cy = y1 + 0.17;
  P.cyl(M.cast, 0.085, 0.3, 0.0, cy, -0.13, { axis: 'x', seg: 16 });
  P.cyl(M.cast, 0.07, 0.03, 0.16, cy, -0.13, { axis: 'x', seg: 16 });
  for (let k = 0; k < 7; k++) { P.cyl(M.cast, 0.074, 0.006, -0.055, cy + 0.12 + k * 0.026, -0.13, { seg: 16 }); P.cyl(M.cast, 0.045, 0.005, 0.075, cy + 0.1 + k * 0.022, -0.13, { seg: 12 }); }
  P.cyl(M.cast, 0.062, 0.2, -0.055, cy + 0.2, -0.13, { seg: 14 });
  P.cyl(M.cast, 0.036, 0.15, 0.075, cy + 0.17, -0.13, { seg: 12 });
  P.cyl(M.blackIron, 0.07, 0.04, -0.055, cy + 0.32, -0.13, { seg: 14 });
  P.cyl(M.black, 0.075, 0.09, -0.055, cy + 0.395, -0.13, { seg: 14 });       // air filter
  P.cyl(M.blackIron, 0.045, 0.02, 0.075, cy + 0.26, -0.13, { seg: 12 });
  P.tube(M.copper, [[-0.055, cy + 0.2, -0.2], [-0.055, cy + 0.28, -0.24], [0.075, cy + 0.3, -0.24], [0.075, cy + 0.26, -0.15]], 0.011);   // intercooler tube
  // flywheel and belt guard, electric motor
  P.cyl(M.cast, 0.15, 0.035, 0.0, cy + 0.02, 0.0, { axis: 'x', seg: 24, ry: 0 });
  P.box(M.darkSteel, 0.14, 0.34, 0.42, -0.14, cy - 0.04, 0.08, { r: 0.012 });        // belt guard
  P.cyl(M.blue, 0.115, 0.34, 0.03, cy - 0.02, 0.2, { axis: 'x', seg: 20 });         // motor can
  P.cyl(M.darkSteel, 0.12, 0.03, 0.2, cy - 0.02, 0.2, { axis: 'x', seg: 20 });       // fan cover end
  P.cyl(M.darkSteel, 0.1, 0.03, -0.15, cy - 0.02, 0.2, { axis: 'x', seg: 20 });
  P.box(M.black, 0.11, 0.09, 0.1, 0.03, cy + 0.1, 0.2, { r: 0.008 });                 // terminal box
  // pressure switch, unloader and check valve line
  P.box(M.gray, 0.1, 0.12, 0.08, -0.25, y1 + 0.12, 0.2, { r: 0.008 });
  P.box(M.red, 0.012, 0.02, 0.05, -0.25 - 0.056, y1 + 0.15, 0.2);
  P.cyl(M.chrome, 0.009, 0.16, -0.25, y1 + 0.03, 0.17, { seg: 8 });
  // tank manifold on the front: regulator, outlet valve, drain valve, safety valve
  P.cyl(M.brass, 0.014, 0.12, -R - 0.04, 1.05, 0.0, { axis: 'x', seg: 10 });
  P.cyl(M.brass, 0.022, 0.03, -R - 0.075, 1.05, 0.0, { axis: 'x', seg: 10 });
  P.cyl(M.chrome, 0.016, 0.03, -R - 0.045, 1.13, 0.0, { seg: 10 });                      // regulator knob stem
  P.cyl(M.black, 0.03, 0.025, -R - 0.045, 1.155, 0.0, { seg: 12 });                       // knob
  P.cyl(M.brass, 0.012, 0.06, 0.0, y1 + 0.01, R * 0.5, { seg: 8 });                       // safety relief valve
  P.cyl(M.brass, 0.02, 0.025, 0.0, y1 + 0.06, R * 0.5, { seg: 8 });
  // tank outlet on the wall side (+x), black iron nipple and ball valve
  P.cyl(M.blackIron, PIPE_R, 0.14, R + 0.06, 1.0, 0.0, { axis: 'x', seg: 10 });
  P.cyl(M.brass, 0.024, 0.07, R + 0.08, 1.0, 0.0, { axis: 'x', seg: 10 });
  P.box(M.red, 0.1, 0.012, 0.014, R + 0.08, 1.04, 0.0);
  // data plate on the tank
  P.build(g, { cast: true });
  // gauges on the front manifold: tank pressure and regulated line pressure
  const g1 = gaugeMesh(M, quality, 200); g1.rotation.y = -Math.PI / 2; g1.position.set(-R - 0.09, 1.19, -0.075); g.add(g1);
  const g2 = gaugeMesh(M, quality, 200); g2.rotation.y = -Math.PI / 2; g2.position.set(-R - 0.09, 1.19, 0.075); g.add(g2);
  const g3 = gaugeMesh(M, quality, 200, 0.032); g3.rotation.y = -Math.PI / 2; g3.position.set(-0.25 - 0.056 - 0.01, y1 + 0.12, 0.2); g.add(g3);
  label(g, 'shop.compressor');
  const drain = new THREE.Group(); drain.userData.labelId = 'shop.tankDrain';
  const D = new Part();
  D.cyl(M.brass, 0.016, 0.07, 0.04, 0.13, R * 0.9, { axis: 'z', seg: 10 });               // drain: nipple
  D.sph(M.brass, 0.026, 0.04, 0.13, R * 0.9 + 0.045, { seg: 10 });                         // drain: ball valve body
  D.box(M.red, 0.012, 0.012, 0.1, 0.04, 0.13 + 0.03, R * 0.9 + 0.1, { rx: 0.5 });         // drain: lever
  D.build(drain, { cast: false }); g.add(drain);
  const gaugeGrp = new THREE.Group(); gaugeGrp.userData.labelId = 'shop.airGauge'; gaugeGrp.add(g1, g2); g.add(gaugeGrp);
  return g;
}

// reel: wall at local z = 0, reel faces +z. hose = hose material
function buildReel(M, hoseMat, labelId, { dropLen = 0.9 } = {}) {
  const g = new THREE.Group();
  const P = new Part();
  const zc = 0.17; // axis height off the wall
  // wall bracket and swivel arm
  P.box(M.darkSteel, 0.2, 0.46, 0.012, 0, 0, 0.006, { r: 0.004 });
  P.box(M.darkSteel, 0.06, 0.06, 0.14, 0, 0, 0.07, { r: 0.004 });
  // spool: two flanges, hub, coiled hose
  P.cyl(M.black, 0.27, 0.014, 0, 0, zc - 0.1, { axis: 'z', seg: 32 });
  P.torus(M.black, 0.262, 0.012, 0, 0, zc + 0.1, { axis: 'z', seg: 32, rseg: 6 });
  for (let i = 0; i < 4; i++) P.box(M.black, 0.02, 0.5, 0.012, 0, 0, zc + 0.1, { rz: i * Math.PI / 4 });
  P.cyl(M.darkSteel, 0.09, 0.2, 0, 0, zc, { axis: 'z', seg: 18 });
  P.cyl(hoseMat, 0.225, 0.19, 0, 0, zc, { axis: 'z', seg: 32 });
  for (let k = 1; k <= 4; k++) P.torus(hoseMat, 0.1 + k * 0.025, 0.0095, 0, 0, zc + 0.097, { axis: 'z', seg: 28, rseg: 6 });   // coiled layers on the front face
  P.cyl(M.darkSteel, 0.228, 0.01, 0, 0, zc - 0.04, { axis: 'z', seg: 32 }); // winding ridges
  P.cyl(M.darkSteel, 0.228, 0.01, 0, 0, zc + 0.04, { axis: 'z', seg: 32 });
  P.cyl(M.chrome, 0.03, 0.03, 0, 0, zc + 0.115, { axis: 'z', seg: 14 });   // hub cap
  // rim holes / spokes on the front flange
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.cyl(M.darkSteel, 0.024, 0.016, Math.sin(a) * 0.17, Math.cos(a) * 0.17, zc + 0.103, { axis: 'z', seg: 8 }); }
  // guide arm at the bottom with a roller and the hose leaving it
  P.box(M.steel, 0.05, 0.1, 0.05, 0, -0.26, zc, { r: 0.004 });
  P.cyl(M.lightSteel, 0.02, 0.06, 0, -0.29, zc, { axis: 'x', seg: 10 });
  P.hose(hoseMat, [[0, -0.28, zc], [0.0, -0.4, zc + 0.01], [0.05, -0.62, zc + 0.04], [0.1, -0.2 - dropLen + 0.15, zc + 0.08], [0.12, -0.1 - dropLen + 0.06, zc + 0.09]], 0.0095, { segs: 24, radial: 8 });
  // quick coupler on the hose end
  const ey = -0.1 - dropLen;
  P.cyl(M.brass, 0.016, 0.07, 0.12, ey, zc + 0.09, { seg: 10 });
  P.cyl(M.chrome, 0.02, 0.012, 0.12, ey - 0.04, zc + 0.09, { seg: 10 });
  P.cyl(M.chrome, 0.008, 0.04, 0.12, ey - 0.07, zc + 0.09, { seg: 8 });
  P.build(g, { cast: false });
  label(g, labelId);
  return g;
}

function buildPipes(M) {
  const g = new THREE.Group(); g.name = 'airPiping';
  const P = new Part(); // copper header
  const B = new Part(); // black iron + fittings
  const hx = SHOP.halfX, hz = SHOP.halfZ;
  const ex = hx - WALL, wx = -hx + WALL, nz = -hz + 0.5;  // east wall, west wall, north header line (stands off the wall to clear the frame columns)
  const hy = 5.15, ly = 2.55;                              // north header height (over the door tops), west run height
  const cp = foot('compressor');
  const outlet = [cp.x + 0.31 + 0.14, 1.0, cp.z];
  // black iron from the tank outlet: out to the east wall, up, then along to the north wall corner
  B.tube(M.blackIron, [[cp.x + 0.31 + 0.1, 1.0, cp.z], [ex, 1.0, cp.z], [ex, ly, cp.z]], PIPE_R);
  // east wall to the north wall corner, then the copper header
  P.tube(M.copper, [[ex, ly, cp.z], [ex, hy, cp.z], [ex, hy, nz]], PIPE_R);
  P.tube(M.copper, [[ex, hy, nz], [wx, hy, nz], [wx, ly, nz], [wx, ly, 7.4]], PIPE_R);
  // east wall branch to the drop near the compressor
  const d1z = -5.6;
  P.tube(M.copper, [[ex, ly, cp.z], [ex, ly, d1z]], PIPE_R);
  // drops: [wall x, z, face sign (+1 reel faces +x), name]
  const drops = [
    { x: ex, z: d1z, nx: -1, run: ly },
    { x: wx, z: 1.6, nx: 1, run: ly },
    { x: wx, z: 6.5, nx: 1, run: ly },
  ];
  for (const d of drops) {
    // reel drop: down to the reel hub height with a red ball valve
    P.tube(M.copper, [[d.x, d.run, d.z], [d.x, 1.52, d.z]], PIPE_R);
    B.cyl(M.brass, 0.022, 0.07, d.x, 2.1, d.z, { seg: 10 });
    B.box(M.red, 0.012, 0.012, 0.12, d.x - d.nx * 0.0, 2.1, d.z + 0.0, { ry: 0.0 });
    // second drop for a fixed quick coupler with a filter/regulator
    const cz = d.z + 0.62;
    P.tube(M.copper, [[d.x, d.run, d.z], [d.x, d.run, cz], [d.x, 1.3, cz]], PIPE_R);
    B.cyl(M.brass, 0.022, 0.06, d.x, 1.9, cz, { seg: 10 });
    B.cyl(M.chrome, 0.03, 0.12, d.x, 1.25 + 0.12, cz, { seg: 12 });             // filter bowl
    B.cyl(M.black, 0.026, 0.1, d.x, 1.03, cz, { seg: 12 });
    B.cyl(M.brass, 0.014, 0.05, d.x, 0.93, cz, { seg: 8 });
    B.cyl(M.chrome, 0.018, 0.02, d.x, 0.9, cz, { seg: 10 });                    // quick coupler
    B.cyl(M.black, 0.008, 0.04, d.x - d.nx * 0.0, 1.38, cz - 0.034, { seg: 6 }); // regulator knob
    // wall brackets for the drops
  }
  // pipe clips along the header: small steel standoffs to the wall
  const clip = (x, y, z, nxs, nzs) => { B.box(M.darkSteel, nxs ? 0.04 : 0.03, 0.025, nzs ? 0.04 : 0.03, x, y, z); };
  for (let x = ex - 1.0; x > wx + 0.5; x -= 2.5) { B.box(M.darkSteel, 0.03, 0.03, 0.5, x, hy, -hz + 0.26); B.cyl(M.darkSteel, 0.024, 0.02, x, hy, nz, { axis: 'x', seg: 8 }); }
  for (let z = -8.0; z < 7.2; z += 2.4) { B.box(M.darkSteel, 0.05, 0.03, 0.03, wx - 0.0, ly, z); }
  for (let z = -7.5; z < -4; z += 2.0) { B.box(M.darkSteel, 0.05, 0.03, 0.03, ex, ly, z); }
  for (const e of [[wx, ly, 7.4], [ex, ly, d1z]]) P.sph(M.copper, PIPE_R * 1.15, e[0], e[1], e[2], { seg: 8 });
  // unions along the header (every few meters)
  for (let x = ex - 2.0; x > wx + 1; x -= 4.2) P.cyl(M.copper, PIPE_R * 1.4, 0.06, x, hy, nz, { axis: 'x', seg: 10 });
  P.build(g, { cast: false }); B.build(g, { cast: false });
  label(g, 'shop.airPipe');
  return g;
}

export function buildCompressorArea(ctx) {
  const { M, group, quality } = ctx;
  const cp = foot('compressor');
  const c = buildCompressor(M, quality); place(c, cp.x, 0, cp.z, 0); group.add(c);
  group.add(buildPipes(M));
  const hx = SHOP.halfX;
  const hoses = [M.orange, M.blue, M.safetyYellow];
  const specs = [
    { z: -5.6, ry: -Math.PI / 2 },
    { z: 1.6, ry: Math.PI / 2 },
    { z: 6.5, ry: Math.PI / 2 },
  ];
  // reels hang on the wall: the reel group origin is on the wall plane
  specs.forEach((s, i) => {
    const r = buildReel(M, hoses[i], 'shop.hoseReel');
    place(r, s.ry < 0 ? hx - 0.0 : -hx + 0.0, 1.52, s.z, s.ry);
    group.add(r);
  });
  ctx.signs.add('airTank', 0.26, cp.x - 0.35, 1.5, -SHOP.halfZ + 0.045, 0); // on the north wall beside the compressor
}
