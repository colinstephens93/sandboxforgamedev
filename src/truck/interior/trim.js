// The cab shell: carpet and transmission tunnel with rubber mats, door sills, B/C pillar trim, headliner and rails, overhead console
// with map lamps, sun visors, rear view mirror, grab handles, rear wall and window trim, and the tire/loading placard.
// Reference: 07-overhead-console-headliner, 07b-crew-cab-rear-interior, IMG_2858 (placard), IMG_2868 (jamb), IMG_2869 to IMG_2871 (floor, mats).
import * as THREE from 'three';
import { Batch, M, boxG, cylG, cylX, cylZ, plateG, softBox, surfaceG, tubeG, canvasTex, lerp, clamp, smooth, boxUV, stitchesG } from './kit.js';
import { spec } from '../../data/truckSpec.js';

const sm = (t) => smooth(clamp(t, 0, 1));
const FLOOR = 22;

// carpet height above the cab floor at (x, s): transmission tunnel hump, toe board rise and the side sill rise
export function floorY(x, s) {
  const ax = Math.abs(x);
  const tunnel = 4.4 * (1 - sm((ax - 6.2) / 3.6)) * sm((s - 43) / 6) * (1 - sm((s - 90) / 12));
  const toe = 4.6 * sm((47.5 - s) / 11);
  const side = 1.7 * sm((ax - 31.5) / 3.5);
  const rearRise = 1.4 * sm((s - 86) / 6) * (1 - sm((ax - 24) / 6)); // rear seat riser
  return FLOOR + tunnel + toe + side + rearRise;
}

export function buildCabShell(env) {
  const { root, M: MT, quality, anchors } = env;
  const g = new THREE.Group(); g.name = 'cab_shell'; root.add(g);
  const B = new Batch(MT);
  const hi = quality.tex >= 1024;

  // ---------------- carpet + mats ----------------
  const carpetG = surfaceG(hi ? 64 : 40, hi ? 90 : 56, (u, v) => { const x = u * 36.2, s = lerp(33.5, 107.3, (v + 1) / 2); return [x, floorY(x, s), s, x, s]; }, { flip: true });
  const carpetMesh = new THREE.Mesh(carpetG, MT.carpet); carpetMesh.name = 'carpet'; carpetMesh.userData.labelId = 'interior.carpet'; carpetMesh.receiveShadow = true; g.add(carpetMesh);
  const matPatch = (x0, x1, s0, s1, key = 'rubberMat', lift = 0.09) => B.add(surfaceG(10, 14, (u, v) => { const x = lerp(x0, x1, (u + 1) / 2), s = lerp(s0, s1, (v + 1) / 2); return [x, floorY(x, s) + lift, s, x, s]; }, { flip: true }), key);
  matPatch(-34.2, -8.4, 36.5, 59.0); matPatch(8.4, 34.2, 36.5, 59.0);                // front all-weather mats
  matPatch(-34.0, -9.0, 41.5, 52.0, 'diamondMat', 0.14); matPatch(9.0, 34.0, 41.5, 52.0, 'diamondMat', 0.14); // pedal-area diamond plate (IMG_2871)
  matPatch(-33.5, -8.5, 77.5, 98.5); matPatch(8.5, 33.5, 77.5, 98.5);                // rear mats
  // mat edges: thin raised border
  for (const [x0, x1, s0, s1] of [[-34.2, -8.4, 36.5, 59], [8.4, 34.2, 36.5, 59], [-33.5, -8.5, 77.5, 98.5], [8.5, 33.5, 77.5, 98.5]]) {
    const bd = (a, b, c, d) => B.add(boxG(Math.abs(b - a), 0.12, Math.abs(d - c)), 'rubber', M((a + b) / 2, floorY((a + b) / 2, (c + d) / 2) + 0.14, (c + d) / 2));
    bd(x0, x1, s0, s0 + 0.35); bd(x0, x1, s1 - 0.35, s1); bd(x0, x0 + 0.35, s0, s1); bd(x1 - 0.35, x1, s0, s1);
  }

  // ---------------- sills, kick panels, jamb pillars, trim ----------------
  for (const sx of [-1, 1]) {
    // door sill scuff plates (front door 22.6 to 69.6; rear 69.8 to 105.8) with satin insert
    B.add(softBox({ w: 4.0, h: 0.9, d: 47.5, r: 0.3, step: 4 }), 'tanPlastic', M(sx * 35.8, 22.6, 46.2));
    B.add(boxG(2.6, 0.06, 46.5), 'satin', M(sx * 35.8, 23.1, 46.2));
    B.add(softBox({ w: 4.0, h: 0.9, d: 35.5, r: 0.3, step: 4 }), 'tanPlastic', M(sx * 35.8, 22.6, 87.7));
    B.add(boxG(2.6, 0.06, 34.8), 'satin', M(sx * 35.8, 23.1, 87.7));
    // kick panel at the front of the footwell
    B.add(softBox({ w: 2.0, h: 10.0, d: 10.5, r: 0.6, step: 3 }), 'tanPlastic', M(sx * 34.4, 28.0, 41.2, 0, 0, 0));
    // B-pillar post: painted white lower jamb face (front face toward -s), tan upper trim and belt guide
    B.add(boxG(5.8, 22, 3.8), 'bodyPaintInner', M(sx * 34.7, 33.0, 69.7));
    B.add(softBox({ w: 4.2, h: 30.0, d: 4.6, r: 0.8, step: 5 }), 'tanPlastic', M(sx * 34.2, 59.0, 70.0));
    // C-pillar / rear quarter trim
    B.add(softBox({ w: 3.4, h: 22, d: 6.0, r: 0.8, step: 5 }), 'tanPlastic', M(sx * 35.0, 62.0, 105.0));
    B.add(softBox({ w: 3.4, h: 35, d: 7.5, r: 0.8, step: 5 }), 'tanPlastic', M(sx * 35.2, 40.5, 104.0));
    // rear door window shelf trim at the cab back corner
    B.add(softBox({ w: 4.0, h: 1.2, d: 8, r: 0.4, step: 4 }), 'tanPlastic', M(sx * 33.0, 58.0, 104.0));
  }
  // rear wall (cab back) below the rear window and the rear window frame
  B.add(softBox({ w: 71, h: 36.5, d: 1.6, r: 0.6, step: 6 }), 'tanPlastic', M(0, 40.2, 107.0));
  B.add(softBox({ w: 56, h: 1.4, d: 4.5, r: 0.5, step: 6 }), 'tanPlastic', M(0, 58.7, 105.0));      // rear window shelf
  B.add(softBox({ w: 2.2, h: 14.6, d: 1.4, r: 0.4, step: 5 }), 'tanPlastic', M(-27.9, 66.0, 106.7)); // window side frames
  B.add(softBox({ w: 2.2, h: 14.6, d: 1.4, r: 0.4, step: 5 }), 'tanPlastic', M(27.9, 66.0, 106.7));
  B.add(softBox({ w: 56, h: 1.6, d: 1.4, r: 0.4, step: 6 }), 'tanPlastic', M(0, 73.2, 106.4));       // header over the rear window
  // third brake lamp bulge is outside. engine tunnel cover under the dash
  B.add(softBox({ w: 20, h: 1, d: 9, r: 0.3, step: 4 }), 'carpet', M(-16, 26.6, 37.5, -0.4, 0, 0));

  // tire and loading placard + VIN area on the driver B-pillar jamb face (facing the front door when it is open), IMG_2858
  {
    const plac = canvasTex(1024, 768, (c, w, h) => {
      c.fillStyle = '#e4ddc5'; c.beginPath(); c.roundRect(10, 10, w - 20, h - 20, 40); c.fill();
      const gr = c.createRadialGradient(w * 0.7, h * 0.7, 40, w * 0.7, h * 0.7, w); gr.addColorStop(0, 'rgba(120,100,60,0.0)'); gr.addColorStop(1, 'rgba(120,100,60,0.18)'); c.fillStyle = gr; c.fill();
      c.fillStyle = '#16140f'; c.fillRect(60, 56, 96, 96); c.fillStyle = '#e4ddc5'; c.font = '800 54px Arial'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText('GM', 108, 96); c.fillRect(80, 120, 56, 8);
      c.fillStyle = '#16140f'; c.textAlign = 'left'; c.font = '700 34px Arial';
      const I = spec.identity;
      const kg = (lb) => Math.round(lb * 0.45359237);
      c.fillText('MFD BY GENERAL MOTORS CORP', 250, 64);
      c.font = '700 30px Arial'; c.fillText(`GVWR  ${kg(I.gvwrLb)}KG(${I.gvwrLb}LB)`, 190, 112); c.fillText(`GAWR FRT ${kg(I.gawrFrontLb)}KG(${I.gawrFrontLb}LB)`, 400, 160); c.fillText(`GAWR RR ${kg(I.gawrRearLb)}KG(${I.gawrRearLb}LB)`, 520, 204);
      c.font = '600 24px Arial'; ['THIS VEHICLE CONFORMS TO ALL APPLICABLE U.S. FEDERAL MOTOR', 'VEHICLE SAFETY STANDARDS IN EFFECT ON THE DATE OF', 'MANUFACTURE SHOWN ABOVE.'].forEach((t, i) => c.fillText(t, 70, 262 + i * 32));
      c.font = '700 32px Arial'; c.fillText('VIN  XXXXXXXXXXXXXXXXX', 70, 390); c.font = '600 28px Arial'; c.fillText('TYPE: TRUCK', 640, 390);
      c.font = '600 26px Arial'; c.fillText('TIRE SIZE', 170, 446); c.fillText('RIM', 470, 446); c.fillText('COLD TIRE PRESSURE', 600, 480);
      const tsize = 'LT245/75R16E';
      [['FRT', '16X6.5J', '380KPA(55PSI)'], ['RR', '16X6.5J', '550KPA(80PSI)'], ['SPA', '16X6.5J', '550KPA(80PSI)']].forEach(([pos, rim, pr], i) => { const y = 500 + i * 42; c.fillText(pos, 70, y); c.fillText(tsize, 170, y); c.fillText(rim, 470, y); c.fillText(pr, 640, y); });
      c.font = '600 22px Arial'; c.fillText('SEE OWNER’S MANUAL FOR MORE INFORMATION.', 120, 690);
    }, { aniso: quality.aniso });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.05), new THREE.MeshStandardMaterial({ map: plac, roughness: 0.55, metalness: 0 }));
    pl.name = 'placard'; pl.userData.labelId = 'interior.placard';
    pl.position.set(-34.7, 35.0, 67.68); pl.rotation.y = Math.PI; // faces -s
    g.add(pl); anchors.placard = pl;
  }

  // ---------------- headliner ----------------
  const hlH = (x, s) => { const crest = lerp(73.5, 74.5, sm((s - 44) / 10)) - 1.0 * sm((s - 100) / 8); return crest - 1.7 * Math.pow(Math.abs(x) / 31.5, 3) - 0.0; };
  const hl = new THREE.Mesh(surfaceG(36, 50, (u, v) => { const x = u * 31.6, s = lerp(44.2, 106.8, (v + 1) / 2); return [x, hlH(x, s), s, x, s]; }, { flip: false }), MT.headliner);
  hl.name = 'headliner'; hl.userData.labelId = 'interior.headliner'; g.add(hl);
  // roof rails above the side glass and the front and rear headers
  for (const sx of [-1, 1]) B.add(softBox({ w: 3.4, h: 2.2, d: 62.5, r: 0.7, step: 6 }), 'tanPlastic', M(sx * 31.9, 72.9, 75.5, 0, 0, sx * 0.32));
  B.add(softBox({ w: 50, h: 2.4, d: 3.0, r: 0.8, step: 6 }), 'tanPlastic', M(0, 73.4, 43.6)); // windshield header
  // dome lamp, rear map/dome
  const lampMat = MT.lampLens;
  const lamps = [];
  // ---- overhead console (07): two map lamps, two buttons, storage bin ----
  {
    const oh = new THREE.Group(); oh.name = 'overhead_console'; oh.userData.labelId = 'interior.overhead'; g.add(oh);
    const OB = new Batch(MT);
    const cy = 73.2, cz = 48.2;
    OB.add(softBox({ w: 12.4, h: 1.9, d: 8.0, r: 0.9, step: 2.5, deform: (p) => { if (p[1] < 0) p[1] -= 0.0; } }), 'tanSoftTwo', M(0, cy - 0.6, cz));
    for (const sx of [-1, 1]) { // map lamps: black bezel, lens, and a small lens glow
      OB.add(new THREE.TorusGeometry(1.15, 0.2, 8, 24), 'black', M(sx * 3.5, cy - 1.52, cz - 1.0, Math.PI / 2, 0, 0));
      OB.add(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 24), 'black', M(sx * 3.5, cy - 1.3, cz - 1.0));
    }
    OB.add(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12), 'black', M(-0.9, cy - 1.52, cz - 1.0)); OB.add(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12), 'black', M(0.9, cy - 1.52, cz - 1.0));
    // storage bin door: black recess with a tan door, partially seen
    OB.add(softBox({ w: 6.0, h: 0.5, d: 3.0, r: 0.2, step: 2 }), 'black', M(0, cy - 1.52, cz + 2.5));
    OB.add(softBox({ w: 5.4, h: 0.4, d: 2.4, r: 0.2, step: 2 }), 'tanSoftTwo', M(0, cy - 1.7, cz + 2.5));
    OB.build(oh, {});
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.88, 24), lampMat); lens.rotation.x = Math.PI / 2; lens.position.set(sx * 3.5, cy - 1.42 - 0.18, cz - 1.0); oh.add(lens);
    }
    const pl = new THREE.PointLight(0xffe3b8, 0, 3.0, 1.8); pl.userData.maxI = 0.9; pl.position.set(0, cy - 3.5, cz + 5); g.add(pl); lamps.push(pl);
    const rl = new THREE.PointLight(0xffe3b8, 0, 2.8, 1.8); rl.userData.maxI = 0.7; rl.position.set(0, 71.0, 92); g.add(rl); lamps.push(rl);
    // rear dome lamp lens (crew cab)
    B.add(softBox({ w: 5.0, h: 0.7, d: 3.6, r: 0.3, step: 2 }), 'tanSoftTwo', M(0, 73.2, 90.5));
    const rlens = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), lampMat); rlens.rotation.x = Math.PI / 2; rlens.position.set(0, 72.78, 90.5); g.add(rlens);
  }

  // ---------------- sun visors (stowed against the headliner), rear view mirror, grab handles ----------------
  for (const sx of [-1, 1]) {
    const v = new THREE.Group(); v.name = sx < 0 ? 'visor_L' : 'visor_R'; v.userData.labelId = 'interior.visor';
    v.add(new THREE.Mesh(softBox({ w: 13.8, h: 1.2, d: 8.6, r: 0.5, step: 3 }), MT.tanSeat));
    const arm = new THREE.Mesh(cylG(0.2, 0.2, 5.5, 10), MT.steel); arm.rotation.z = Math.PI / 2; arm.position.set(sx * 9.4, 0.2, -3.8); v.add(arm);
    v.position.set(sx * 17.0, 72.75, 46.2); v.rotation.x = -0.08; g.add(v);
    B.add(softBox({ w: 2.2, h: 0.9, d: 2.2, r: 0.3, step: 2 }), 'tanPlastic', M(sx * 27.2, 73.0, 42.2)); // pivot mount
    B.add(softBox({ w: 1.8, h: 0.8, d: 1.8, r: 0.3, step: 2 }), 'tanPlastic', M(sx * 2.0, 73.1, 42.5)); // visor clip
  }
  {
    const mir = new THREE.Group(); mir.name = 'rearview_mirror'; mir.userData.labelId = 'interior.mirror';
    mir.add(new THREE.Mesh(softBox({ w: 11.8, h: 3.1, d: 1.7, r: 0.8, step: 2 }), MT.black));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(10.9, 2.4), MT.mirrorGlass); face.position.z = 0.88; mir.add(face);
    const stem = new THREE.Mesh(cylG(0.25, 0.3, 3.4, 12), MT.black); stem.position.set(0, 2.2, -2.2); stem.rotation.x = -1.0; mir.add(stem);
    const btn = new THREE.Mesh(cylG(0.8, 0.8, 0.2, 14), MT.black); btn.rotation.x = Math.PI / 2 + 0.55; btn.position.set(0, 3.2, -3.1); mir.add(btn);
    mir.position.set(0, 66.6, 41.2); mir.rotation.x = 0.08; g.add(mir);
    anchors.mirror = mir;
  }
  for (const [sx, s] of [[-1, 60.5], [1, 60.5], [-1, 95.0], [1, 95.0]]) { // grab handles over the doors
    const gh = new THREE.Group(); gh.name = 'grab_handle';
    gh.add(new THREE.Mesh(tubeG([[0, 0, -3.8], [0, -0.9, -3.2], [0, -1.15, 0], [0, -0.9, 3.2], [0, 0, 3.8]], 0.38, 18, 8), MT.tanPlastic));
    for (const k of [-1, 1]) { const m = new THREE.Mesh(softBox({ w: 1.5, h: 0.5, d: 1.6, r: 0.2, step: 2 }), MT.tanPlastic); m.position.set(0, 0.1, k * 4.0); gh.add(m); }
    gh.position.set(sx * 31.3, 71.8, s); gh.rotation.z = -sx * 0.32; g.add(gh);
  }
  B.build(g, {});
  anchors.overhead = g.getObjectByName('overhead_console');
  const update = () => {};
  return { anchors: {}, lamps, lampMat, update };
}
