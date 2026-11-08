// Safety and wall controls: ABC fire extinguishers beside each roll-up door, first-aid cabinet, eyewash station,
// the two overhead-door pushbutton stations (UP / STOP / DOWN, interactive), the light switch, the electrical panel
// and printed signs. Wall-mounted items sit on backing plates so nothing floats off the ribbed panels.
import { THREE, Part, interactive, label, canvasMaterial, place } from './common.js';
import { extinguisherLabelCanvas, gaugeCanvas } from './art.js';
import { SHOP } from './../layout.js';

const NZ = -SHOP.halfZ + 0.04;       // north wall: wainscot face (z = -8.96); the panel above is at z = -9.0 (backing plates bridge it)

function extinguisher(M) {
  const g = new THREE.Group(); g.name = 'fireExtinguisher';
  const P = new Part();
  const zc = 0.095; // axis distance from the wall plane
  // body: lathe with domed bottom and a shouldered neck
  const prof = [[0.0005, 0.0], [0.04, 0.004], [0.065, 0.016], [0.0775, 0.05], [0.0775, 0.33], [0.07, 0.375], [0.05, 0.4], [0.032, 0.415], [0.03, 0.43]];
  P.lathe(M.red, prof, 0, 0.03, zc, { seg: 28 });
  P.cyl(M.darkSteel, 0.082, 0.02, 0, 0.035, zc, { seg: 24 });                // base ring / foot collar
  // valve head: brass body, squeeze handle and lever, safety pin, gauge, hose
  P.cyl(M.brass, 0.034, 0.05, 0, 0.485, zc, { seg: 14 });
  P.box(M.darkSteel, 0.045, 0.03, 0.14, 0, 0.53, zc, { r: 0.006 });          // head casting
  P.box(M.black, 0.03, 0.018, 0.17, 0, 0.545, zc + 0.01, { r: 0.006, rx: 0.0 }); // carrying handle
  P.box(M.black, 0.03, 0.016, 0.15, 0, 0.5, zc + 0.03, { r: 0.005, rx: 0.25 });  // lever
  P.cyl(M.chrome, 0.003, 0.05, 0.0, 0.52, zc + 0.095, { axis: 'x', seg: 6 });
  P.torus(M.chrome, 0.011, 0.002, 0.026, 0.52, zc + 0.095, { axis: 'x', seg: 10, rseg: 4 });  // pull pin ring
  P.hose(M.black, [[0.03, 0.5, zc - 0.02], [0.1, 0.45, zc + 0.02], [0.1, 0.3, zc + 0.06], [0.055, 0.16, zc + 0.082], [0.0, 0.1, zc + 0.08]], 0.007, { segs: 16, radial: 6 });
  P.cyl(M.black, 0.014, 0.05, 0.0, 0.08, zc + 0.082, { seg: 8, r2: 0.02 });  // nozzle
  // wall bracket: backing plate and a strap around the body
  P.box(M.darkSteel, 0.12, 0.4, 0.05, 0, 0.25, -0.015, { r: 0.004 });
  P.box(M.darkSteel, 0.1, 0.07, 0.03, 0, 0.55, -0.025);                     // hook plate
  P.torus(M.darkSteel, 0.081, 0.006, 0, 0.26, zc, { axis: 'y', seg: 28, rseg: 5 });
  P.box(M.black, 0.06, 0.02, 0.02, 0, 0.26, zc - 0.075);
  P.build(g, { cast: false });
  // label wrap on the body (curved patch) and a small pressure gauge
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0782, 0.0782, 0.2, 18, 1, true, -0.95, 1.9), canvasMaterial(extinguisherLabelCanvas(), { roughness: 0.5 }));
  lab.rotation.y = Math.PI * 0; lab.position.set(0, 0.24, zc); g.add(lab);
  // cylinder default maps +z at theta = 0 toward +x? orient so the arc faces +z
  lab.geometry.rotateY(Math.PI / 2 - 0.0); lab.geometry.rotateY(-Math.PI / 2 + 0.0);
  const gg = new THREE.Mesh(new THREE.CircleGeometry(0.022, 18), canvasMaterial(gaugeCanvas(300, 'PSI', 96), { roughness: 0.3 }));
  gg.position.set(0, 0.575, zc + 0.082); gg.rotation.x = -0.9; g.add(gg);
  const bezel = new Part(); bezel.cyl(M.chrome, 0.024, 0.012, 0, 0.5755, zc + 0.082, { seg: 14, rx: 0.9 }); bezel.build(g);
  return g;
}

export function stationButtons(M, doorIndex, doorsProvider, interactables, updaters) {
  const g = new THREE.Group(); g.name = 'doorStation' + doorIndex;
  const H = new Part();
  H.box(M.safetyYellow, 0.1, 0.24, 0.06, 0, 0, 0.03, { r: 0.008 });      // enclosure
  H.box(M.darkSteel, 0.12, 0.3, 0.05, 0, 0, -0.015);                     // backing plate (bridges the wainscot step to the wall at z = -9.0)
  H.build(g, { cast: false });
  const mk = (y, mat, label_, prompt, run, shape) => {
    const b = new THREE.Group(); b.position.set(0, y, 0.066);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.022, 20), mat); cap.rotation.x = Math.PI / 2; cap.position.z = 0.0; b.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.003, 6, 20), M.chrome); ring.position.z = -0.008; b.add(ring);
    g.add(b);
    b.userData.press = 0;
    interactive(b, prompt, (c) => { run(c); b.userData.press = 1; });
    interactables.push(b);
    return b;
  };
  const door = () => doorsProvider()[doorIndex];
  const up = mk(0.075, M.green, 'UP', 'Raise the overhead door', (c) => { const d = door(); if (d) { d.target = 1; c?.say?.(`Overhead door ${doorIndex + 1}: raising`); } });
  const stop = mk(0.0, M.ledRed, 'STOP', 'Stop the overhead door', (c) => { const d = door(); if (d) { d.target = d.open; c?.say?.(`Overhead door ${doorIndex + 1}: stopped`); } });
  const down = mk(-0.075, M.black, 'DOWN', 'Lower the overhead door', (c) => { const d = door(); if (d) { d.target = 0; c?.say?.(`Overhead door ${doorIndex + 1}: lowering`); } });
  g.userData.buttons = { up, stop, down };
  label(g, 'shop.doorStation');
  // the whole station toggles with one interact as a fallback when the button is not hit directly
  interactive(g, () => (door() && door().target ? 'Lower the overhead door' : 'Raise the overhead door'), (c) => { const d = door(); if (!d) return; d.target = d.target ? 0 : 1; c?.say?.(`Overhead door ${doorIndex + 1}: ${d.target ? 'raising' : 'lowering'}`); });
  interactables.push(g);
  updaters.push((dt) => { for (const b of [up, stop, down]) { if (b.userData.press > 0) { b.userData.press = Math.max(0, b.userData.press - dt * 4); } b.children[0].position.z = -0.009 * Math.min(1, b.userData.press * 3); } });
  return g;
}

function firstAidCabinet(M) {
  const g = new THREE.Group(); g.name = 'firstAid';
  const P = new Part();
  P.box(M.whitePlastic, 0.4, 0.5, 0.12, 0, 0, 0.0, { r: 0.012 });
  P.box(M.whitePlastic, 0.37, 0.47, 0.012, 0, 0, 0.066, { r: 0.008 });
  P.box(M.darkSteel, 0.04, 0.04, 0.012, 0.15, 0.0, 0.075);
  P.box(M.red, 0.12, 0.012, 0.01, 0.0, 0.2, 0.076);
  P.box(M.darkSteel, 0.42, 0.52, 0.012, 0, 0, -0.065);
  P.build(g, { cast: false });
  return g;
}

function eyewash(M) {
  const g = new THREE.Group(); g.name = 'eyewash';
  const P = new Part();
  P.box(M.lightSteel, 0.3, 0.46, 0.05, 0, 0.0, -0.015, { r: 0.006 });                      // backing plate
  P.lathe(M.green, [[0.001, 0.0], [0.07, 0.012], [0.19, 0.075], [0.195, 0.1], [0.18, 0.1], [0.09, 0.05], [0.001, 0.04]], 0, -0.2, 0.2, { seg: 24 }); // bowl
  P.cyl(M.chrome, 0.02, 0.2, 0, -0.08, 0.04, { seg: 10 });                                  // supply
  P.cyl(M.green, 0.022, 0.05, 0, -0.18, 0.05, { seg: 10 });
  for (const s of [-1, 1]) { P.cyl(M.green, 0.016, 0.07, s * 0.07, -0.14, 0.15, { seg: 8, rx: -0.5 }); P.cyl(M.safetyYellow, 0.02, 0.016, s * 0.07, -0.11, 0.165, { seg: 8, rx: -0.5 }); }
  P.box(M.green, 0.1, 0.012, 0.15, 0.0, -0.13, 0.14);                                       // push paddle
  P.cyl(M.chrome, 0.012, 0.1, 0.0, -0.13, 0.09, { axis: 'z', seg: 8 });
  P.build(g, { cast: false });
  return g;
}

function electricalPanel(M) {
  const g = new THREE.Group(); g.name = 'panel';
  const P = new Part();
  P.box(M.gray, 0.4, 0.6, 0.12, 0, 0, 0.0, { r: 0.008 });
  P.box(M.lightSteel, 0.36, 0.56, 0.01, 0, 0, 0.065, { r: 0.006 });
  P.box(M.black, 0.03, 0.12, 0.02, 0.15, 0.0, 0.085, { r: 0.004 });         // handle
  P.box(M.paper, 0.1, 0.07, 0.004, -0.08, 0.2, 0.072);
  P.box(M.darkSteel, 0.42, 0.62, 0.012, 0, 0, -0.063);
  P.cyl(M.chrome, 0.015, 0.7, 0.0, 0.62, -0.01, { seg: 8 });                // conduit up to the ceiling
  P.cyl(M.chrome, 0.022, 0.025, 0.0, 0.3, -0.0, { seg: 8 });
  P.build(g, { cast: false });
  return g;
}

function lightSwitch(M) {
  const g = new THREE.Group(); g.name = 'lightSwitch';
  const P = new Part();
  P.box(M.beige, 0.12, 0.2, 0.012, 0, 0, 0.006, { r: 0.006 });
  P.box(M.darkSteel, 0.14, 0.22, 0.012, 0, 0, -0.004);
  P.build(g, { cast: false });
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.014), M.whitePlastic);
  rocker.position.set(0, 0.0, 0.019); g.add(rocker);
  return { g, rocker };
}

export function buildSafety(ctx) {
  const { M, group, shop, interactables, updaters, signs } = ctx;
  const doors = () => shop.doors;
  const hz = SHOP.halfZ;
  // ---- fire extinguishers: one beside each door frame (x = -5.5 and 5.5) ----
  for (const x of [-5.5, 5.5]) {
    const e = extinguisher(M); e.position.set(x, 0.85, NZ); label(e, 'shop.extinguisher'); group.add(e);
    signs.add('fireExt', 0.22, x, 1.72, -hz + 0.006, 0);
  }
  // ---- pushbutton stations (door 1 on the right of its frame, door 2 on the left of its frame) ----
  [[-0.55, 0], [0.55, 1]].forEach(([x, i]) => {
    const st = stationButtons(M, i, doors, interactables, updaters); st.position.set(x, 1.4, NZ); group.add(st);
    signs.add(i === 0 ? 'door1' : 'door2', 0.2, x, 1.61, -hz + 0.006, 0);
  });
  // ---- first aid, eyewash, electrical panel along the north wall east of door 2 ----
  const fa = firstAidCabinet(M); fa.position.set(6.9, 1.3, -hz + 0.062); label(fa, 'shop.firstAid'); group.add(fa);
  signs.add('firstAid', 0.2, 6.9, 1.7, -hz + 0.006, 0);
  const ew = eyewash(M); ew.position.set(8.1, 1.3, -hz + 0.012); label(ew, 'shop.eyewash'); group.add(ew);
  signs.add('eyewash', 0.2, 8.1, 1.85, -hz + 0.006, 0);
  const pn = electricalPanel(M); pn.position.set(9.4, 1.55, -hz + 0.062); label(pn, 'shop.panel'); group.add(pn);
  signs.add('highVolt', 0.2, 9.4, 2.0, -hz + 0.006, 0);
  // ---- light switch near the office door (outer face of the office west wall, x = 6.34) ----
  {
    const { g, rocker } = lightSwitch(M);
    g.position.set(6.34, 1.3, 5.1); g.rotation.y = -Math.PI / 2; group.add(g);
    label(g, 'shop.lightSwitch');
    signs.add('switchPlate', 0.15, 6.337, 1.47, 5.1, -Math.PI / 2);
    interactive(g, () => (shop.lights.on ? 'Turn the shop lights off' : 'Turn the shop lights on'), (c) => { shop.setLights(!shop.lights.on); c?.say?.(shop.lights.on ? 'Shop lights on' : 'Shop lights off'); });
    interactables.push(g);
    updaters.push(() => { rocker.rotation.x = shop.lights.on ? 0.3 : -0.3; rocker.position.y = shop.lights.on ? 0.012 : -0.012; });
  }
  // ---- more signs: PPE at the bench, lift caution, no smoking by the shelves, exhaust and hearing signs on frame columns ----
  signs.add('ppe', 0.4, -11.995, 1.7, -6.9, Math.PI / 2);
  signs.add('liftWarn', 0.45, -11.995, 1.55, 2.95, Math.PI / 2);
  signs.add('noSmoking', 0.3, 11.995, 1.6, 2.6, -Math.PI / 2);
  signs.add('exhaust', 0.19, -6.0, 1.9, -hz + 0.34 + 0.0, 0);
  signs.add('hearing', 0.19, 0.0, 1.9, -hz + 0.34 + 0.0, 0);
}
