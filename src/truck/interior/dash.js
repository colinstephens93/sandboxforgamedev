// The GMT800 instrument panel: pad, cluster hood and bezel, defrost grille, vents, the LT center stack (radio, climate, cubby, lower
// tray with 12 V outlets), headlamp and transfer-case pods, glove box, knee bolster, A-pillar trim, speaker grille.
// Authored in inches in the truck frame (s = z rearward). Layout from 01b-dash-wide-driver-pov (shape), IMG_2866 (center stack),
// IMG_2869 to IMG_2871 (tan dash with graphite bezels), spec in PROMPT.md section 4.
import * as THREE from 'three';
import { Batch, M, prismX, boxG, cylG, cylX, cylZ, plateG, rrShape, softBox, polyG, canvasTex, lerp, clamp, lookM, boxUV } from './kit.js';
import { makeCanvas } from '../../core/proc.js';

export const DASH = {
  // dash face slope reference (s at a given y), used by the pods and the stack
  faceS: (y) => 44.5 + (49 - y) * 0.15,
  stackOrigin: { x: 0, y: 41.1, s: 45.9, tilt: 0.12 },
  cluster: { x: -16, y: 50.3, s: 41.8, tilt: (25 * Math.PI) / 180 },
  glove: { x0: 9.5, x1: 34.0, y0: 28.6, y1: 40.8, s: 46.4 },
};

// a frame helper: add geometry in a local frame placed in the truck frame
class Frame {
  constructor(B, matrix) { this.B = B; this.m = matrix; }
  add(g, key, local) { this.B.add(g, key, local ? this.m.clone().multiply(local) : this.m); return this; }
}

export function buildDash(env) {
  const { root, M: MT, quality, anchors, labelled } = env;
  const B = new Batch(MT);
  const g = new THREE.Group(); g.name = 'dash'; g.userData.labelId = 'interior.dash'; root.add(g);

  // ---------------- instrument panel body (pad + face + knee bolster) ----------------
  const upper = (faceTop) => faceTop;
  const lower = [[45.4, 40.0], [46.2, 35.0], [46.4, 31.8], [41.5, 29.8], [37.8, 25.0], [33.5, 22.2], [22.6, 22.2]];
  const regular = [[22.6, 54.0], [28, 53.55], [36, 53.0], [42, 52.6], [43.6, 52.3], [44.2, 51.6], [44.5, 50.0], [44.7, 47.0], [44.9, 44.0], ...lower];
  const clusterZone = [[22.6, 54.0], [28, 53.55], [36, 53.0], [39.8, 52.8], [40.4, 52.38], [42.5, 47.88], [43.3, 47.2], [44.3, 46.2], [44.8, 44.0], [45.4, 40.0], ...lower.slice(1)];
  B.add(prismX(regular, -35.6, -23.6), 'tanDash'); // left of the cluster
  B.add(prismX(clusterZone, -23.6, -8.4), 'tanDash');
  // right segment (center stack and passenger side); the glove box cavity is carved out of the passenger part
  const G = DASH.glove;
  B.add(prismX(regular, -8.4, G.x0), 'tanDash');
  const gloveProfile = [[22.6, 54.0], [28, 53.55], [36, 53.0], [42, 52.6], [43.6, 52.3], [44.2, 51.6], [44.7, 49.5], [45.9, G.y1 + 0.2], [G.s - 4.6, G.y1 + 0.2], [G.s - 4.6, G.y0 + 0.4], [46.0, G.y0 - 0.2], [46.3, 31.8], [41.5, 29.8], [37.8, 25.0], [33.5, 22.2], [22.6, 22.2]];
  B.add(prismX(gloveProfile, G.x0, G.x1), 'tanDash');
  B.add(prismX(regular, G.x1, 35.6), 'tanDash');

  // pad stitching line along the front-top of the pad on the passenger side and the driver side (cut-and-sew look of the LT dash)
  // (the real 2005 pad is molded: only a soft seam line is added above the glove box for the airbag door)
  const seam = [[10, 52.1], [33, 52.1], [33, 52.0], [33, 47.0]];

  // ---------------- cluster bezel + visor ----------------
  const C = DASH.cluster;
  const cm = M(C.x, C.y, C.s, -C.tilt, 0, 0);
  const cf = new Frame(B, cm);
  const hole = rrShape(12.46, 5.0, 0.6);
  cf.add(plateG(15.0, 6.5, 1.0, 1.4, 0.06, hole), 'graphite', M(0, 0.05, 0));
  // dark backing behind the face and a thin chrome-black ring inside the opening
  cf.add(boxG(15.6, 7.0, 0.3), 'black', M(0, 0, -0.2));
  // visor (the binnacle hood): sloped dark hood above the face, with side cheeks
  const visorProfile = [[-0.7, 2.5], [-0.7, 3.1], [0.9, 3.3], [2.7, 3.1], [3.2, 2.7], [3.1, 2.5], [2.4, 2.65], [0.8, 2.6]];
  cf.add(prismX(visorProfile, -7.5, 7.5), 'graphite');
  for (const sx of [-1, 1]) cf.add(prismX([[-0.4, 2.9], [2.6, 3.0], [2.9, 2.6], [1.5, 0.9], [-0.4, 0.6]], sx * 7.3, sx * 7.55), 'graphite');
  // lower lip under the cluster (flows into the dash face)
  cf.add(prismX([[-0.2, -2.6], [0.9, -2.9], [1.5, -3.5], [1.2, -4.2], [-0.2, -4.2]], -7.5, 7.5), 'graphite');

  // ---------------- speaker grille / defrost grille / sensors on the pad ----------------
  // defrost outlet across the base of the windshield: dark recess with fine slats
  const defrostY = 53.5;
  B.add(boxG(50, 0.2, 2.2), 'black', M(0, defrostY + 0.08, 28.2));
  for (let i = 0; i < 38; i++) B.add(boxG(0.28, 0.16, 2.0), 'graphiteSat', M(-24.4 + (48.8 * i) / 37, defrostY + 0.17, 28.2));
  // side defrost slots at the A-pillars
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) B.add(boxG(0.3, 0.14, 2.6), 'graphiteSat', M(sx * (31.0 + i * 0.7), 53.1, 31.0, 0, 0.0, 0));
  // center speaker grille with perforations
  B.add(boxG(5.0, 0.12, 2.4), 'black', M(2.0, 53.0, 36.5));
  B.add(boxG(4.6, 0.04, 2.0), 'satin', M(2.0, 53.07, 36.5));
  // sun-load sensor dome
  B.add(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'black', M(-0.4, 53.0, 33.0, 0, 0, 0, 1, 0.6, 1));

  // ---------------- side vents and the pods on the left of the cluster (01b, IMG_2871) ----------------
  const faceS = DASH.faceS;
  const podFrame = (x, y, w, h) => new Frame(B, M(x, y, faceS(y) + 0.02, -0.1, 0, 0));
  // left vent: rectangular slatted vent
  {
    const f = podFrame(-31.0, 48.6);
    f.add(plateG(6.2, 3.6, 0.35, 0.5, 0.04), 'graphite', M(0, 0, 0));
    for (let i = 0; i < 6; i++) f.add(boxG(5.2, 0.14, 0.5), 'black', M(0, -1.3 + i * 0.52, 0.28, -0.35, 0, 0));
    f.add(boxG(0.3, 2.6, 0.35), 'graphite', M(0.3, 0, 0.3));
  }
  // headlamp switch pod: graphite panel with the rotary headlamp knob, fog button and a dimmer wheel
  const hl = podFrame(-31.0, 43.1);
  hl.add(plateG(6.2, 4.6, 0.5, 0.5, 0.05), 'graphite', M(0, 0, 0));
  hl.add(cylZ(1.0, 1.05, 0.7, 28), 'knob', M(0.8, -0.2, 0.75));
  hl.add(cylZ(0.72, 0.8, 0.1, 24), 'graphiteSat', M(0.8, -0.2, 1.12));
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; hl.add(boxG(0.1, 0.2, 0.7), 'knob', M(0.8 + Math.cos(a) * 1.07, -0.2 + Math.sin(a) * 1.07, 0.75, 0, 0, a + Math.PI / 2)); }
  hl.add(boxG(0.9, 0.5, 0.35), 'black', M(-2.1, 1.2, 0.35)); // fog lamp button
  hl.add(boxG(1.6, 0.5, 0.35), 'black', M(-1.9, -1.4, 0.35)); // dimmer slider
  hl.add(boxG(0.3, 0.2, 0.4), 'satin', M(-1.9, -1.4, 0.45));
  // headlamp knob is an interaction object in the real truck? (no: scenery); give it a label
  const hlObj = new THREE.Group(); hlObj.name = 'headlamp_switch'; hlObj.position.set(-31 + 0.8, 43.1 - 0.2, faceS(43.1) + 0.9); hlObj.userData.labelId = 'interior.headlampSwitch';
  const hlHit = new THREE.Mesh(boxG(6.0, 4.4, 1.6), new THREE.MeshBasicMaterial({ visible: false })); hlObj.add(hlHit); hlObj.position.set(-31, 43.1, faceS(43.1) + 0.5); g.add(hlObj);
  hlHit.userData.labelId = 'interior.headlampSwitch';

  // transfer case switch cluster (left of the steering column): 2WD / 4HI / N / 4LO push buttons
  const tcFrame = podFrame(-30.4, 38.2);
  tcFrame.add(plateG(7.0, 2.7, 0.45, 0.4, 0.05), 'graphite', M(0, 0, 0));
  const tcButtons = [];
  ['2WD', '4HI', 'N', '4LO'].forEach((name, i) => { tcFrame.add(plateG(1.35, 1.0, 0.45, 0.12, 0.04), 'blackSoft', M(-2.4 + i * 1.6, -0.2, 0.35)); });
  const tcPlate = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9c7bd'; c.font = '700 13px Inter, Arial, sans-serif'; c.textAlign = 'center'; ['2WD', '4HI', 'N', '4LO'].forEach((t, i) => c.fillText(t, 36 + i * 62, 18)); }, { aniso: 4 });
  const tcLabel = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 1.0), new THREE.MeshBasicMaterial({ map: tcPlate, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.55, 0.55, 0.55) }));
  tcLabel.position.set(-30.4, 38.2 + 0.85, faceS(38.2) + 0.58); tcLabel.rotation.x = -0.1; g.add(tcLabel);
  const tcObj = new THREE.Group(); tcObj.name = 'transfer_case_switch'; tcObj.position.set(-30.4, 38.2, faceS(38.2) + 0.5);
  tcObj.add(new THREE.Mesh(boxG(7.0, 2.7, 1.4), new THREE.MeshBasicMaterial({ visible: false })));
  tcObj.userData.labelId = 'interior.transferCase'; g.add(tcObj); anchors.transferCase = tcObj;
  // indicator lamps for the active button (small amber dots)
  const tcDots = [0, 1, 2, 3].map((i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: 0xffb030, toneMapped: true })); m.position.set(-30.4 - 2.4 + i * 1.6, 38.2 - 0.62, faceS(38.2) + 0.6); m.rotation.x = -0.1; m.visible = false; g.add(m); return m; });
  env.tcDots = tcDots;

  // ---------------- knee bolster / lower dash with the OBD port, fuse door, hood release ----------------
  // lower trim panel across the driver's knee area
  B.add(softBox({ w: 21, h: 5.4, d: 1.5, r: 0.5, step: 2 }), 'tanDash', M(-17.0, 34.0, 45.6, -0.12, 0, 0));
  // steering column opening collar in the dash face
  B.add(cylZ(3.3, 3.5, 0.6, 28), 'graphite', lookM([-16, 40.6, 45.2], [0, -0.3, 1]));

  // OBD-II connector: 16-pin D-shaped (SAE J1962 type A) port under the driver side of the dash, facing down and back toward the knees
  {
    const obd = new THREE.Group(); obd.name = 'obd_port'; obd.userData.labelId = 'interior.obdPort';
    obd.position.set(-22.5, 30.0, 43.9);
    // trapezoid (D) shell: 2.5 in wide at the top, 2.1 in at the bottom, 0.68 in tall; opening toward local +Z
    const shape = new THREE.Shape(); shape.moveTo(-1.45, 0.45); shape.lineTo(1.45, 0.45); shape.lineTo(1.2, -0.45); shape.lineTo(-1.2, -0.45); shape.closePath();
    const hole2 = new THREE.Path(); hole2.moveTo(-1.25, 0.28); hole2.lineTo(1.25, 0.28); hole2.lineTo(1.05, -0.28); hole2.lineTo(-1.05, -0.28); hole2.closePath(); shape.holes.push(hole2);
    const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false }), MT.black); shell.position.z = -0.2; obd.add(shell);
    const floorP = new THREE.Mesh(boxG(2.5, 0.56, 0.12), MT.black); floorP.position.set(0, 0, 0.0); obd.add(floorP);
    const key = new THREE.Mesh(boxG(2.2, 0.07, 0.5), MT.black); key.position.set(0, 0.0, 0.3); obd.add(key);
    const pinG = boxG(0.09, 0.12, 0.45);
    for (let i = 0; i < 8; i++) for (const r of [-1, 1]) { const p = new THREE.Mesh(pinG, MT.brass); p.position.set(-0.98 + i * 0.28, r * 0.15, 0.3); obd.add(p); }
    const br = new THREE.Mesh(boxG(3.6, 0.14, 1.9), MT.steel); br.position.set(0, 0.62, -0.5); obd.add(br);
    const pig = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.1, -0.9), new THREE.Vector3(0.3, 1.2, -1.4), new THREE.Vector3(1.6, 2.2, -1.6)]), 10, 0.2, 8), MT.blackSoft); obd.add(pig);
    obd.rotation.x = 0.7; // +Z (the opening) points down and rearward
    g.add(obd);
    const hit = new THREE.Mesh(boxG(4.4, 3, 3), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0, 0.6); obd.add(hit);
    anchors.obdPort = obd;
    // plug point (where the AI Live cable mates), at the opening, +Z outward
    anchors.obdPlug = new THREE.Object3D(); anchors.obdPlug.name = 'obd_plug'; anchors.obdPlug.position.set(0, 0, 0.8); obd.add(anchors.obdPlug);
  }

  // hood release: T-handle low on the left of the steering wheel (under the dash edge)
  {
    const h = new THREE.Group(); h.name = 'hood_release'; h.userData.labelId = 'interior.hoodRelease'; h.position.set(-29.4, 30.2, 44.6);
    const lever = new THREE.Mesh(cylG(0.13, 0.13, 3.2, 8), MT.steel); lever.rotation.x = Math.PI / 2; lever.position.z = 1.2; h.add(lever);
    const grip = new THREE.Mesh(softBox({ w: 3.0, h: 0.85, d: 0.9, r: 0.32, step: 1 }), MT.blackSoft); grip.position.set(0, 0, 2.9); h.add(grip);
    const bracket = new THREE.Mesh(boxG(1.8, 0.8, 0.5), MT.graphite); bracket.position.set(0, 0.55, -0.1); h.add(bracket);
    g.add(h); anchors.hoodRelease = h; h.userData.restZ = h.position.z;
    const hit = new THREE.Mesh(boxG(4.4, 2.4, 4.0), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, 0, 2.2); h.add(hit);
  }

  // parking brake pedal: far left of the footwell, small ribbed rubber pad on a lever arm from the toe board
  {
    const p = new THREE.Group(); p.name = 'parking_brake_pedal'; p.userData.labelId = 'interior.parkBrake'; p.position.set(-31.0, 26.8, 44.0);
    const arm = new THREE.Mesh(boxG(1.2, 0.7, 6.0), MT.steel); arm.position.set(0, 0.6, 2.9); arm.rotation.x = 0.35; p.add(arm);
    const pad = new THREE.Mesh(plateG(3.4, 2.2, 0.5, 0.35, 0.05), MT.rubberGrip); pad.position.set(0, -1.2, 6.5); pad.rotation.x = -0.45; p.add(pad);
    for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(boxG(3.0, 0.07, 0.08), MT.black); rib.position.set(0, -1.62 + i * 0.28, 7.05 - i * 0.0); rib.rotation.x = -0.45; p.add(rib); }
    g.add(p); anchors.parkBrake = p;
    const hit = new THREE.Mesh(boxG(4, 3, 3), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, -1.2, 6.6); p.add(hit);
  }
  // brake and accelerator pedals
  {
    const brake = new THREE.Group(); brake.name = 'brake_pedal'; brake.userData.labelId = 'interior.brakePedal'; brake.position.set(-18.6, 28.2, 45.0);
    const arm = new THREE.Mesh(boxG(1.0, 8.5, 0.6), MT.steel); arm.position.set(0, 3.8, 1.0); brake.add(arm);
    const pad = new THREE.Mesh(plateG(5.0, 2.6, 0.6, 0.4, 0.05), MT.rubberGrip); pad.position.set(0, 0, 1.6); pad.rotation.x = -0.18; brake.add(pad);
    for (let i = 0; i < 7; i++) { const rib = new THREE.Mesh(boxG(4.6, 0.08, 0.1), MT.black); rib.position.set(0, -1.0 + i * 0.33, 2.25); rib.rotation.x = -0.18; brake.add(rib); }
    g.add(brake); anchors.brakePedal = brake;
    const accel = new THREE.Group(); accel.name = 'accelerator_pedal'; accel.userData.labelId = 'interior.accelPedal'; accel.position.set(-11.4, 22.4, 47.5);
    const apad = new THREE.Group(); apad.rotation.x = -1.0; apad.position.set(0, 3.0, 0.3); accel.add(apad);
    apad.add(new THREE.Mesh(plateG(3.0, 7.4, 0.6, 0.45, 0.06), MT.rubberGrip));
    for (let i = 0; i < 9; i++) { const rib = new THREE.Mesh(boxG(2.6, 0.08, 0.1), MT.black); rib.position.set(0, -3.2 + i * 0.75, 0.7); apad.add(rib); }
    const hinge = new THREE.Mesh(boxG(3.0, 0.7, 0.9), MT.steel); hinge.position.set(0, 0.0, 0.0); accel.add(hinge);
    g.add(accel); anchors.accelPedal = accel;
    for (const o of [brake, accel]) { const hit = new THREE.Mesh(boxG(5.2, 6, 3), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(0, 2, 1.8); o.add(hit); }
  }
  // dead pedal footrest on the far left
  B.add(plateG(5.0, 3.0, 0.5, 0.35, 0.05), 'rubberGrip', M(-26.8, 25.4, 46.0, -0.8, 0, 0));

  // ---------------- center stack (IMG_2866): radio, climate, vent, cubby, lower tray ----------------
  const SO = DASH.stackOrigin; const sm = M(SO.x, SO.y, SO.s, -SO.tilt, 0, 0);
  const sf = new Frame(B, sm);
  // bezel plate with openings (radio 7.2 x 3.9, HVAC 6.2 x 2.3, vent, cubby)
  const bez = new THREE.Shape(); { const x0 = -6.7, x1 = 5.9, y0 = -2.6, y1 = 5.9, r = 0.5; bez.moveTo(x0 + r, y0); bez.lineTo(x1 - r, y0); bez.quadraticCurveTo(x1, y0, x1, y0 + r); bez.lineTo(x1, y1 - r); bez.quadraticCurveTo(x1, y1, x1 - r, y1); bez.lineTo(x0 + r, y1); bez.quadraticCurveTo(x0, y1, x0, y1 - r); bez.lineTo(x0, y0 + r); bez.quadraticCurveTo(x0, y0, x0 + r, y0); }
  const hole1 = (x0, x1, y0, y1) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.closePath(); return p; };
  bez.holes.push(hole1(-5.6, 1.6, 1.1, 5.0), hole1(-5.1, 1.1, -1.6, 0.7), hole1(2.6, 5.6, 1.6, 5.2), hole1(2.1, 5.0, -0.9, 1.2));
  const bezG = new THREE.ExtrudeGeometry(bez, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 6 });
  sf.add(bezG, 'graphite', M(0, 0, -0.1));
  // dark box behind (the cavity floor)
  sf.add(boxG(12.4, 8.4, 0.3), 'black', M(-0.4, 1.65, -0.55));
  // --- radio faceplate ---
  const radio = new THREE.Group(); radio.name = 'radio'; radio.userData.labelId = 'interior.radio';
  const RF = { cx: -2.0, cy: 3.05, w: 7.2, h: 3.9 };
  const radioCanvas = (c, w, h) => {
    const k = w / RF.w; c.fillStyle = '#17181a'; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const P = (x, y) => [(x + RF.w / 2) * k, (RF.h / 2 - y) * k];
    c.fillStyle = '#c9c9c4'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const txt = (t, x, y, s = 0.2) => { const [px, py] = P(x, y); c.font = `600 ${s * k}px Inter, Arial, sans-serif`; c.fillText(t, px, py); };
    // button caps (flat look; the 3D caps sit on top)
    txt('REV   FWD', -1.15, 1.5, 0.16); txt('RPT', 0.03, 1.5, 0.15); txt('SONG LIST', 0.7, 1.5, 0.12); txt('RDM', 1.34, 1.5, 0.15); txt('LOAD CD ⏏', 2.46, 1.5, 0.15);
    txt('SEEK SCAN', -2.7, 0.0, 0.14); txt('BAND', -1.0, -1.6, 0.15); txt('CD AUX', -0.2, -1.6, 0.13); txt('INFO', 0.72, -1.6, 0.14); txt('P-TYPE', 1.35, -1.6, 0.13); txt('TRAF', 1.95, -1.6, 0.13); txt('AUTO EQ', 2.7, -1.6, 0.11); txt('AUTO VOL', 3.35, -1.6, 0.11);
    txt('PWR', -2.98, 1.03, 0.14); txt('push', -2.98, 0.72, 0.11); txt('TUNE', -2.6, -1.05, 0.14);
    c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineWidth = 0.03 * k; const [a, b] = P(-2.1, 0.88); c.beginPath(); c.moveTo(a, b); c.lineTo(a + 4.7 * k, b); c.stroke(); // CD slot
    const [sx, sy] = P(-2.0, 0.88); c.fillStyle = '#050505'; c.fillRect(sx, sy - 0.04 * k, 4.7 * k, 0.08 * k);
    [-1.1, 0.67, 2.4].forEach((x, i) => { txt(`${i * 2 + 1}      ${i * 2 + 2}`, x, 0.25, 0.17); });
    // display well
    const [dx0, dy0] = P(-1.9, -0.1); c.fillStyle = '#04100f'; c.beginPath(); c.roundRect(dx0, dy0, 5.0 * k, 1.25 * k, 0.1 * k); c.fill();
  };
  const radioTex = canvasTex(1152, 624, radioCanvas, { aniso: quality.aniso });
  const rf = new THREE.Mesh(new THREE.PlaneGeometry(RF.w, RF.h), new THREE.MeshStandardMaterial({ map: radioTex, roughness: 0.5, metalness: 0.1 }));
  rf.position.set(RF.cx, RF.cy, 0.09); radio.add(rf);
  // display (emissive teal)
  const dispCanvas = document.createElement('canvas'); dispCanvas.width = 512; dispCanvas.height = 128;
  const dispTex = new THREE.CanvasTexture(dispCanvas); dispTex.colorSpace = THREE.SRGBColorSpace;
  const dispMat = new THREE.MeshBasicMaterial({ map: dispTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: true });
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 1.2), dispMat); disp.position.set(RF.cx + 0.6, RF.cy - 0.7, 0.13); radio.add(disp);
  env.radioDisplay = { canvas: dispCanvas, tex: dispTex, mat: dispMat, last: '' };
  // radio 3D bits are in the stack frame (radio group origin = stack origin)
  const rbtn = (x, y, w, h, key = 'blackSoft') => sf.add(plateG(w, h, 0.22, Math.min(h, w) * 0.3, 0.03), key, M(x, y, 0.07));
  [[-1.15, 1.5, 1.4, 0.34], [0.03, 1.5, 0.52, 0.34], [0.7, 1.5, 0.62, 0.34], [1.34, 1.5, 0.52, 0.34], [2.46, 1.5, 1.3, 0.34], [-2.7, 0.0, 1.2, 0.36], [-1.1, 0.25, 1.28, 0.42], [0.67, 0.25, 1.28, 0.42], [2.4, 0.25, 1.28, 0.42]]
    .forEach(([x, y, w, h]) => rbtn(x + RF.cx, y + RF.cy, w, h));
  [[-1.0, -1.6, 1.0], [-0.2, -1.6, 0.8], [0.72, -1.6, 0.7], [1.35, -1.6, 0.7], [1.95, -1.6, 0.6], [2.7, -1.6, 0.75], [3.35, -1.6, 0.65]].forEach(([x, y, w]) => rbtn(x + RF.cx, y + RF.cy, w, 0.34));
  // knobs: PWR/VOL, TUNE, brightness
  for (const [x0, y0, r] of [[-2.98, 0.98, 0.5], [-2.6, -1.1, 0.5], [2.7, -0.82, 0.32]]) { const x = x0 + RF.cx, y = y0 + RF.cy;
    sf.add(cylZ(r, r * 1.05, 0.42, 28), 'knob', M(x, y, 0.2)); sf.add(cylZ(r * 0.82, r * 0.82, 0.04, 24), 'satin', M(x, y, 0.42));
  }
  sf.add(boxG(0.05, 0.28, 0.05), 'chrome', M(-2.98 + RF.cx, 1.3 + RF.cy, 0.46));
  radio.position.set(0, 0, 0); radio.applyMatrix4(sm); g.add(radio);
  const radioHit = new THREE.Mesh(boxG(7.4, 4.2, 1.2), new THREE.MeshBasicMaterial({ visible: false })); radioHit.position.set(RF.cx, RF.cy, 0.2); radio.add(radioHit);
  // --- climate control ---
  const clim = new THREE.Group(); clim.name = 'climate_controls'; clim.userData.labelId = 'interior.climate';
  const CF = { cx: -2.0, cy: -0.45, w: 6.2, h: 2.3 };
  const climTex = canvasTex(992, 368, (c, w, h) => {
    const k = w / CF.w; c.fillStyle = '#181a1c'; c.fillRect(0, 0, w, h);
    const P = (x, y) => [(x + CF.w / 2) * k, (CF.h / 2 - y) * k];
    // blue/red temperature rings
    for (const sx of [-1, 1]) { const [px, py] = P(sx * 2.35, 0.1); const R = 0.88 * k; c.lineWidth = 0.13 * k; c.strokeStyle = '#2f8fe0'; c.beginPath(); c.arc(px, py, R, Math.PI * 0.62, Math.PI * 1.25); c.stroke(); c.strokeStyle = '#d63a30'; c.beginPath(); c.arc(px, py, R, Math.PI * 1.55, Math.PI * 2.38); c.stroke(); }
    c.fillStyle = '#c9c9c4'; c.font = `600 ${0.13 * k}px Inter, Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
    [['OFF', -2.6], ['\u21bb', -1.3], ['A/C', 0], ['\u2668', 1.3], ['\u25a4', 2.6]].forEach(([t, x]) => { const [px, py] = P(x, -0.92); c.fillText(t, px, py); });
  }, { aniso: quality.aniso });
  const cf2 = new THREE.Mesh(new THREE.PlaneGeometry(CF.w, CF.h), new THREE.MeshStandardMaterial({ map: climTex, roughness: 0.5, metalness: 0.1 }));
  cf2.position.set(CF.cx, CF.cy, 0.09); clim.add(cf2);
  const climCanvas = document.createElement('canvas'); climCanvas.width = 256; climCanvas.height = 192;
  const climT = new THREE.CanvasTexture(climCanvas); climT.colorSpace = THREE.SRGBColorSpace;
  const climMat = new THREE.MeshBasicMaterial({ map: climT, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: new THREE.Color(1.3, 1.3, 1.3) });
  const climDisp = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.3), climMat); climDisp.position.set(CF.cx, CF.cy + 0.1, 0.12); clim.add(climDisp);
  env.climDisplay = { canvas: climCanvas, tex: climT, mat: climMat, last: '' };
  clim.applyMatrix4(sm); g.add(clim);
  for (const sx of [-1, 1]) { sf.add(cylZ(0.62, 0.66, 0.5, 28), 'knob', M(CF.cx + sx * 2.35, CF.cy + 0.1, 0.22)); sf.add(boxG(0.07, 0.34, 0.05), 'chrome', M(CF.cx + sx * 2.35, CF.cy + 0.45, 0.5)); }
  // fan up/down and AUTO / defog buttons around the display (IMG_2866)
  for (const y of [CF.cy + 0.35, CF.cy - 0.2]) rbtn(CF.cx - 1.28, y, 0.55, 0.45);

  for (const y of [CF.cy + 0.35, CF.cy - 0.2]) rbtn(CF.cx + 1.28, y, 0.6, 0.45);
  [-4.6, -3.3, -2.0, -0.7, 0.6].forEach((x) => rbtn(x, CF.cy - 0.92, 1.0, 0.3));
  // --- big vent with horizontal slats (IMG_2866) ---
  {
    const vf = new Frame(B, sm);
    vf.add(boxG(3.5, 4.0, 0.2), 'black', M(4.1, 3.4, -0.05));
    for (let i = 0; i < 8; i++) vf.add(boxG(3.1, 0.16, 0.7), 'graphite', M(4.1, 1.95 + i * 0.37, 0.12, -0.28, 0, 0));
    vf.add(boxG(0.34, 3.2, 0.3), 'graphite', M(4.1, 3.4, 0.2));
    vf.add(cylZ(0.28, 0.28, 0.4, 16), 'satin', M(4.1, 3.4, 0.4));
  }
  // --- cubby ---
  sf.add(boxG(2.8, 2.0, 0.12), 'rubberMat', M(3.55, 0.15, -0.35));
  // --- lower tray panel in tan, with the 12 V accessory outlets and the cigar lighter (IMG_2866) ---
  const lowerFrame = new Frame(B, sm);
  lowerFrame.add(softBox({ w: 13.4, h: 5.4, d: 0.7, r: 0.3, step: 2 }), 'tanDash', M(-0.4, -5.3, 0.05));
  lowerFrame.add(boxG(8.0, 2.2, 0.25), 'black', M(0.5, -5.0, 0.4)); // alcove
  lowerFrame.add(boxG(6.8, 0.5, 0.2), 'rubberMat', M(0.1, -5.6, 0.42)); // tray liner
  // cigar lighter (left) and 12 V power outlet with a cap (right)
  const accessory = (x, y, capped) => { lowerFrame.add(cylZ(0.55, 0.55, 0.3, 20), 'graphite', M(x, y, 0.5)); lowerFrame.add(cylZ(0.4, 0.4, 0.34, 18), capped ? 'blackSoft' : 'satin', M(x, y, 0.55)); if (capped) lowerFrame.add(boxG(0.12, 0.26, 0.05), 'satin', M(x + 0.55, y + 0.0, 0.7)); };
  accessory(-3.4, -4.4, false); accessory(4.2, -4.1, true);
  // The lighter is its own object with a label
  const lighter = new THREE.Group(); lighter.name = 'cigar_lighter'; lighter.userData.labelId = 'interior.cigarLighter';
  lighter.add(new THREE.Mesh(boxG(1.4, 1.4, 0.6), new THREE.MeshBasicMaterial({ visible: false }))); lighter.position.set(-3.4, -4.4, 0.6); lighter.applyMatrix4(sm); g.add(lighter);

  // ---------------- glove box (interactable) ----------------
  const gl = DASH.glove; const glw = gl.x1 - gl.x0, glh = gl.y1 - gl.y0;
  const bin = new Frame(B, M(0, 0, 0));
  // dark bin inside the cavity
  bin.add(boxG(glw - 0.3, glh - 0.5, 0.2), 'graphite', M((gl.x0 + gl.x1) / 2, (gl.y0 + gl.y1) / 2, gl.s - 4.55));
  bin.add(boxG(0.2, glh - 0.4, 4.4), 'graphite', M(gl.x0 + 0.2, (gl.y0 + gl.y1) / 2, gl.s - 2.3));
  bin.add(boxG(0.2, glh - 0.4, 4.4), 'graphite', M(gl.x1 - 0.2, (gl.y0 + gl.y1) / 2, gl.s - 2.3));
  bin.add(boxG(glw - 0.3, 0.2, 4.4), 'graphite', M((gl.x0 + gl.x1) / 2, gl.y0 + 0.45, gl.s - 2.3));
  bin.add(boxG(glw - 0.3, 0.2, 4.4), 'graphite', M((gl.x0 + gl.x1) / 2, gl.y1 - 0.2, gl.s - 2.3));
  const gdoor = new THREE.Group(); gdoor.name = 'glovebox_door'; gdoor.userData.labelId = 'interior.glovebox';
  gdoor.position.set((gl.x0 + gl.x1) / 2, gl.y0, gl.s + 0.25);   // hinge at the bottom edge
  const door = new THREE.Mesh(softBox({ w: glw - 0.3, h: glh - 0.1, d: 1.2, r: 0.4, step: 2 }), MT.tanDash); door.position.set(0, glh / 2, 0); gdoor.add(door);
  // handle recess
  const rec = new THREE.Mesh(boxG(4.0, 0.9, 0.4), MT.black); rec.position.set(0, glh - 1.6, 0.52); gdoor.add(rec);
  const latch = new THREE.Mesh(plateG(3.2, 0.5, 0.2, 0.15, 0.03), MT.graphite); latch.position.set(0, glh - 1.6, 0.68); gdoor.add(latch);
  const inner = new THREE.Mesh(boxG(glw - 1.2, glh - 1.0, 0.2), MT.graphite); inner.position.set(0, glh / 2, -0.4); gdoor.add(inner);
  g.add(gdoor); anchors.glovebox = gdoor;
  const gHit = new THREE.Mesh(boxG(glw, glh, 2), new THREE.MeshBasicMaterial({ visible: false })); gHit.position.set(0, glh / 2, 0.2); gdoor.add(gHit);

  // passenger airbag door seam on the pad (soft line) and the AIRBAG tag
  B.add(boxG(24, 0.03, 0.08), 'tanSeam', M(21.5, 52.55, 41.2)); B.add(boxG(0.08, 0.03, 9), 'tanSeam', M(9.5, 52.58, 36.8)); B.add(boxG(0.08, 0.03, 9), 'tanSeam', M(33.5, 52.58, 36.8));

  // ---------------- A-pillar trim (tan) and the dash end caps ----------------
  for (const sx of [-1, 1]) {
    // A-pillar interior cover follows the windshield edge from the dash to the header
    const pts = []; const n = 14;
    for (let i = 0; i <= n; i++) { const t = i / n; const y = lerp(54.4, 74.4, t); const s = lerp(23.2, 43.4, t) + 1.3; const x = sx * (lerp(33.8, 31.4, t) + 0.0); pts.push([x, y, s]); }
    const geo = (() => { const pos = [], idx = []; const wdt = 2.5; pts.forEach(([x, y, s], i) => { pos.push(x, y, s, x - sx * wdt * 0.78, y, s + 1.0); pos.push(x - sx * wdt * 0.8, y - 0.2, s + 1.8); }); for (let i = 0; i < pts.length - 1; i++) { const a = i * 3; for (let k = 0; k < 2; k++) { const p = a + k, q = a + k + 1, r = a + 3 + k, t = a + 3 + k + 1; if (sx > 0) idx.push(p, q, r, q, t, r); else idx.push(p, r, q, q, r, t); } } const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); return boxUV(gg.toNonIndexed()); })();
    B.add(geo, 'tanSoftTwo');
  }

  B.build(g, { cast: false });
  return { group: g, tcDots, radio, clim };
}
