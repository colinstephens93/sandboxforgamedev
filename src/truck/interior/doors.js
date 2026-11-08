// Door cards (tan, IMG_2857 and IMG_2868): upper trim, pull-cup armrest with the power window and lock switches, inside release
// handle, speaker grille, map pocket and carpeted lower panel. Built in truck inches and returned as one group per door; the
// caller adds each group to the matching door group (`parts.doors.fL, fR, rL, rR`, origin = truck origin) so the cards swing with the door.
import * as THREE from 'three';
import { Batch, M, boxG, cylG, cylZ, plateG, softBox, prismX, polyG, canvasTex, lerp, clamp, boxUV, rrShape } from './kit.js';
import { ST } from '../skin.js';

const FRONT = { s0: ST.doorF0 + 1.0, s1: ST.doorF1 - 0.8 };   // 23.6 .. 68.8
const REAR = { s0: ST.doorF1 + 0.9, s1: 104.6 };               // 70.5 .. 104.6

export function buildDoorCards(env) {
  const { root, M: MT, quality } = env;
  const cards = {};
  const LAB = { fL: 'interior.doorCardFL', fR: 'interior.doorCardFR', rL: 'interior.doorCardRL', rR: 'interior.doorCardRR' };
  const speakerTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#4a4b4a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2c2c';
    for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < w; x += 6) { c.beginPath(); c.arc(x + 1.5, y + 1.5, 1.6, 0, 7); c.fill(); }
  }, { aniso: 4 });
  speakerTex.wrapS = speakerTex.wrapT = THREE.RepeatWrapping; speakerTex.repeat.set(0.35, 0.35);
  const speakerMat = new THREE.MeshStandardMaterial({ map: speakerTex, roughness: 0.8, metalness: 0.1 });
  const boseTex = canvasTex(128, 32, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#c9cac8'; c.font = 'italic 800 24px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BOSE', w / 2, h / 2); }, { aniso: 4 });
  const switchTex = canvasTex(512, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#c8c8c3'; c.font = '700 20px Arial'; c.textAlign = 'center'; ['□', '□', '□', '□'].forEach((t, i) => c.fillText(t, 80 + i * 76, 22)); }, { aniso: 4 });

  for (const key of ['fL', 'fR', 'rL', 'rR']) {
    const sg = key.endsWith('R') ? 1 : -1, front = key[0] === 'f';
    const R = front ? FRONT : REAR; const len = R.s1 - R.s0, mid = (R.s0 + R.s1) / 2;
    const grp = new THREE.Group(); grp.name = `doorcard_${key}`; grp.userData.labelId = LAB[key];
    const inner = new THREE.Group(); inner.scale.setScalar(0.0254); grp.add(inner);
    const B = new Batch(MT);
    const X = (d) => sg * d; // lateral position from the centerline (inward is smaller)
    // ---- base panel: profile in (s, y), thickness from |x| 34.9 to 37.5 ----
    const prof = front
      ? [[R.s0, 22.0], [R.s0, 49.0], [R.s0 + 2.5, 54.3], [R.s1 - 2.5, 54.3], [R.s1, 50.0], [R.s1, 22.0]]
      : [[R.s0, 22.0], [R.s0, 50.0], [R.s0 + 2.5, 54.3], [R.s1 - 8, 54.3], [R.s1, 49.0], [R.s1, 22.0]];
    B.add(prismX(prof, X(34.9), X(37.5)), 'tanSoft');
    // upper pad (padded vinyl bolster above the armrest) with a top shoulder along the belt line
    B.add(softBox({ w: 3.4, h: 3.0, d: len - 3, r: 0.9, step: 4 }), 'tanPlastic', M(X(35.7), 52.8, mid));
    // lower carpeted kick area
    B.add(softBox({ w: 3.0, h: 6.4, d: len - 2, r: 0.5, step: 4 }), 'carpet', M(X(35.3), 25.3, mid));
    // accent line between the upper vinyl and the lower panel
    B.add(boxG(0.3, 0.3, len - 3), 'tanSeam', M(X(34.75), 31.2, mid));
    // ---- armrest / pull cup ----
    const aS0 = front ? R.s0 + 10 : R.s0 + 7, aS1 = front ? R.s1 - 4 : R.s1 - 6; const aLen = aS1 - aS0, aMid = (aS0 + aS1) / 2;
    B.add(softBox({ w: 3.9, h: 2.4, d: aLen, r: 1.0, step: 3, deform: (p) => { if (p[1] > 0) p[1] += 0.2 * (1 - (p[2] / (aLen / 2)) ** 2); } }), 'tanPlastic', M(X(33.4), 43.6, aMid));
    // armrest top (a slightly lighter, smooth cap)
    B.add(softBox({ w: 3.0, h: 0.5, d: aLen - 4, r: 0.2, step: 3 }), 'tanPlastic', M(X(33.0), 45.0, aMid - 1));
    // inside release handle: black recess in the pull cup + the handle bar (IMG_2857)
    const hS = front ? R.s1 - 11 : R.s1 - 12;
    const hnd = new THREE.Group(); hnd.name = 'door_handle_inside'; hnd.userData.labelId = 'interior.doorHandleInside';
    B.add(softBox({ w: 1.6, h: 3.5, d: 5.6, r: 0.4, step: 3 }), 'black', M(X(35.0), 43.2, hS));
    B.add(softBox({ w: 1.1, h: 0.9, d: 4.4, r: 0.3, step: 2 }), 'blackSoft', M(X(33.8), 43.2, hS));
    // ---- switch plate on the armrest: window, lock and mirror switches ----
    if (front) {
      const sS0 = R.s0 + 13, sS1 = R.s0 + 31;
      B.add(softBox({ w: 2.5, h: 1.0, d: sS1 - sS0, r: 0.4, step: 2 }), 'graphite', M(X(33.0), 45.3, (sS0 + sS1) / 2));
      for (let i = 0; i < 4; i++) B.add(softBox({ w: 1.1, h: 0.45, d: 2.4, r: 0.15, step: 1 }), 'blackSoft', M(X(33.0), 45.9, sS0 + 2.5 + i * 3.1, 0, 0, 0));
      B.add(cylG(0.7, 0.72, 0.5, 18), 'knob', M(X(33.0), 45.95, sS1 - 1.3)); // mirror selector
      // lock rocker on the upper trim (left of the handle), memory seat buttons pod (driver only, IMG_2857)
      B.add(softBox({ w: 1.0, h: 1.0, d: 3.2, r: 0.3, step: 2 }), 'black', M(X(34.3), 49.6, R.s1 - 8));
      B.add(softBox({ w: 0.5, h: 0.7, d: 1.4, r: 0.15, step: 1 }), 'blackSoft', M(X(33.8), 49.6, R.s1 - 8.6));
      if (key === 'fL') {
        B.add(softBox({ w: 0.9, h: 1.7, d: 6.6, r: 0.3, step: 2 }), 'graphite', M(X(34.2), 49.5, R.s0 + 28));
        for (let i = 0; i < 4; i++) B.add(cylG(0.2, 0.2, 0.25, 10), 'knob', M(X(33.7), 49.5 + (i % 2 ? -0.35 : 0.35), R.s0 + 25.8 + i * 1.5));
      }
    } else {
      B.add(softBox({ w: 2.0, h: 0.9, d: 4.0, r: 0.35, step: 2 }), 'graphite', M(X(33.0), 45.3, R.s0 + 12));
      B.add(softBox({ w: 1.0, h: 0.4, d: 2.2, r: 0.15, step: 1 }), 'blackSoft', M(X(33.0), 45.9, R.s0 + 12));
    }
    // ---- speaker grille (front doors, lower front) ----
    if (front) {
      const spk = new THREE.Group(); spk.name = 'door_speaker'; spk.userData.labelId = 'interior.speaker';
      const f0 = R.s0 + 3, f1 = R.s0 + 21;
      const spMesh = new THREE.Mesh(prismX([[f0, 28], [f1 + 4, 28], [f1 + 4, 41], [f0 + 3, 43.5]], X(34.2), X(35.0)), speakerMat); spk.add(spMesh); inner.add(spk);
      if (key === 'fL') { const bose = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: boseTex, transparent: true, depthWrite: false, opacity: 0.8 })); bose.rotation.y = sg < 0 ? Math.PI / 2 : -Math.PI / 2; bose.position.set(X(34.0), 41.4, R.s0 + 15); inner.add(bose); }
    }
    // ---- map pocket (lower) ----
    const pS0 = front ? R.s0 + 3 : R.s0 + 2, pS1 = R.s1 - 3;
    B.add(softBox({ w: 3.4, h: 2.6, d: pS1 - pS0, r: 0.6, step: 4 }), 'tanPlastic', M(X(33.9), 28.4, (pS0 + pS1) / 2));
    B.add(softBox({ w: 2.6, h: 1.8, d: pS1 - pS0 - 2, r: 0.4, step: 4 }), 'black', M(X(33.6), 28.6, (pS0 + pS1) / 2));
    // small red door reflector on the lower rear edge (IMG_2857, IMG_2868)
    B.add(boxG(0.3, 1.2, 3.6), 'redBtn', M(X(35.0), 27.4, R.s1 - 3.8));
    // speaker grille shows through the shell via the mesh below; door pull strap for rear doors
    if (!front) B.add(softBox({ w: 2.6, h: 1.0, d: 9.0, r: 0.4, step: 3 }), 'tanPlastic', M(X(33.4), 49.4, mid));
    B.build(inner, {});
    // hit helper for the handle
    cards[key] = grp;
  }
  return { cards, lamps: [] };
}
