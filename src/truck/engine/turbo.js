// VGT turbocharger (Garrett GT3788VA style) at the rear of the valley, the foil-wrapped exhaust crossovers, heat shield, downpipe,
// vane actuator and PWM solenoid. Added to the engine group (it shakes with the engine). Truck-frame inches.
import * as THREE from 'three';
import { Batch, T, V, tube, cylAxis, rbox, boxAt, alongY } from './geo.js';
import { ENGINE } from './layout.js';

const part = (parent, name, labelId) => { const g = new THREE.Group(); g.name = name; if (labelId) g.userData.labelId = labelId; parent.add(g); return g; };

export function buildTurbo({ mats, d, fast }, root) {
  const A = {};
  const t = ENGINE.turbo, rad = Math.max(10, Math.round(24 * d));
  const g = part(root, 'turbo', 'engine.turbo'); const b = new Batch();
  // center housing (bearing housing, cast aluminum) with the oil and coolant lines
  b.add('alum', cylAxis('x', [t.x, t.y, t.s], 2.3, 4.8, rad));
  b.add('alumMach', cylAxis('x', [t.x, t.y, t.s], 2.5, 0.5, rad));
  b.add('alum', rbox([t.x, t.y - 3.0, t.s], 3.4, 2.4, 3.2, 0.5));
  b.add('steelRaw', tube([[t.x + 0.6, t.y - 4.0, t.s + 0.6], [t.x + 0.6, t.y - 7.0, t.s + 2.4], [t.x + 1.6, t.y - 9.0, t.s + 4.6]], 0.3, { radial: 8 })); // oil feed line
  // compressor: scroll volute (torus), back plate, inlet snout
  const volute = new THREE.TorusGeometry(2.9, 1.3, Math.max(8, Math.round(14 * d)), Math.max(16, Math.round(32 * d))); volute.rotateY(Math.PI / 2);
  b.add('alum', T(volute, [t.x + 4.0, t.y, t.s]));
  b.add('alum', cylAxis('x', [t.x + 3.9, t.y, t.s], 3.0, 3.4, rad));
  b.add('alum', cylAxis('x', [t.x + 7.1, t.y, t.s], 2.0, 2.8, rad, 3.0)); // inlet cone (small end toward +x)
  b.add('alumMach', cylAxis('x', [t.x + 8.7, t.y, t.s], 2.15, 0.45, rad)); // bead for the hose clamp
  b.add('alum', rbox([t.x + 4.2, t.y + 3.9, t.s + 1.8], 3.4, 2.4, 3.2, 0.6)); // outlet boss
  b.add('alumMach', cylAxis('y', [t.x + 3.6, t.y + 4.2, t.s + 2.3], 1.35, 0.6, rad));
  b.add('alum', tube([[t.x + 4.0, t.y + 2.6, t.s + 0.6], [t.x + 3.8, t.y + 3.8, t.s + 1.8], [t.x + 3.5, t.y + 4.4, t.s + 2.4]], 1.3, { radial: 12 }));
  // turbine: cast iron housing and volute, exhaust outlet flange facing down
  const tv = new THREE.TorusGeometry(3.0, 1.45, Math.max(8, Math.round(14 * d)), Math.max(16, Math.round(32 * d))); tv.rotateY(Math.PI / 2);
  b.add('ironDark', T(tv, [t.x - 4.4, t.y, t.s]));
  b.add('ironDark', cylAxis('x', [t.x - 4.2, t.y, t.s], 3.4, 4.2, rad));
  b.add('ironDark', cylAxis('y', [t.x - 4.6, t.y - 3.2, t.s], 2.3, 2.4, rad));
  b.add('ironDark', cylAxis('y', [t.x - 4.6, t.y - 4.5, t.s], 2.9, 0.5, rad));
  b.add('ironDark', rbox([t.x - 4.8, t.y + 0.4, t.s + 3.5], 3.6, 4.2, 2.6, 0.5)); // exhaust inlet flange boss (from the crossovers)
  b.flush(g, mats, { cast: true, name: 'turbo' });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fast.bolt([t.x - 4.6 + Math.cos(a) * 2.5, t.y - 4.8, t.s + Math.sin(a) * 2.5], [0, -1, 0], 0.3); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fast.bolt([t.x + 2.0, t.y + Math.cos(a) * 3.05, t.s + Math.sin(a) * 3.05], [-1, 0, 0], 0.28); }
  fast.clamp([t.x + 8.0, t.y, t.s], [1, 0, 0], 2.3);
  A.turbo = g;

  // downpipe down the driver side of the bellhousing, flex joint and V-band
  {
    const dp = part(root, 'downpipe', 'engine.heat_shield'); const db = new Batch();
    const path = [[t.x - 4.6, t.y - 5.0, t.s], [t.x - 5.4, 30.5, t.s + 1.6], [-8.8, 27.8, 19.2], [-11.6, 24.2, 19.8], [-11.8, 17.0, 20.4]];
    db.add('steelRaw', tube(path, 1.75, { radial: 14 }));
    db.add('alumMach', cylAxis('y', [-5.5, 30.2, t.s + 1.8], 2.1, 0.6, 16));
    db.flush(dp, mats, { cast: true, name: 'dp' });
    fast.clamp([-5.5, 30.2, t.s + 1.8], [0.3, 1, 0.2], 1.7);
    // stamped heat shield draped over the turbine housing (top and rear)
    const sh = new THREE.CylinderGeometry(4.55, 4.55, 4.4, 36, 1, true, -0.28 * Math.PI, 1.3 * Math.PI); sh.rotateZ(Math.PI / 2);
    const hb = new Batch(); hb.add('heatShield', T(sh, [t.x - 4.2, t.y, t.s]));
    for (let k = 0; k < 3; k++) hb.add('heatShield', boxAt([t.x - 4.2 + (k - 1) * 1.6, t.y + 3.7, t.s + 3.2 - k * 0.2], 0.9, 0.1, 1.0)); // mounting tabs
    hb.flush(dp, mats, { name: 'shield' });
    A.downpipe = dp;
  }

  // foil-wrapped exhaust crossovers from each manifold to the turbine inlet
  {
    const cg = part(root, 'crossovers', 'engine.heat_shield'); const cb = new Batch();
    const drv = [[-15.0, 29.2, 11.6], [-13.8, 31.8, 14.6], [-10.6, 33.8, 17.0], [-7.6, 35.4, 18.4], [-5.4, 36.4, 18.4]];
    const pas = [[15.0, 29.2, 11.6], [14.6, 31.0, 15.4], [13.0, 33.0, 19.2], [8.5, 34.2, 21.0], [2.0, 34.6, 21.3], [-2.5, 35.2, 20.6], [-5.0, 36.0, 19.0]];
    cb.add('foil', tube(drv, 1.45, { radial: 14, ridges: 12, ridgeAmp: 0.04 }));
    cb.add('foil', tube(pas, 1.45, { radial: 14, ridges: 26, ridgeAmp: 0.04 }));
    cb.flush(cg, mats, { cast: true, name: 'xo' });
    for (const [x, y, s, dx, dy, dz] of [[-13.8, 31.8, 14.6, 0.6, 0.5, 1], [-10.6, 33.8, 17.0, 1, 0.3, 0.4], [14.6, 31.0, 15.4, 0, 0.5, 1], [13.0, 33.0, 19.2, -0.7, 0, 1], [8.5, 34.2, 21.0, -1, 0, 0], [2.0, 34.6, 21.3, -1, 0, 0]]) fast.clamp([x, y, s], [dx, dy, dz], 1.45);
    A.crossovers = cg;
  }

  // VGT vane actuator (vacuum pod with rod) and the PWM solenoid on its bracket
  {
    const ag = part(root, 'vgt_actuator', 'engine.turbo_actuator'); const ab = new Batch();
    ab.add('steelBlack', cylAxis('y', [t.x - 4.6, t.y + 5.0, t.s - 0.3], 1.75, 2.6, 24));
    ab.add('steelBlack', cylAxis('y', [t.x - 4.6, t.y + 6.5, t.s - 0.3], 1.2, 1.0, 20, 1.55));
    ab.add('steelRaw', cylAxis('y', [t.x - 4.6, t.y + 3.3, t.s - 0.3], 0.28, 1.6, 8));
    ab.add('steelBlack', rbox([t.x - 4.6, t.y + 3.2, t.s - 1.2], 0.7, 0.5, 3.6, 0.15)); // bracket to the turbine
    ab.add('steelRaw', tube([[t.x - 4.6, t.y + 3.0, t.s - 0.3], [t.x - 4.6, t.y + 2.2, t.s - 0.8], [t.x - 3.9, t.y + 1.4, t.s + 0.6]], 0.2, { radial: 6 })); // vane rod
    ab.add('plastic', cylAxis('y', [t.x - 4.6, t.y + 7.1, t.s - 0.3], 0.45, 0.6, 8)); // vacuum nipple
    // PWM solenoid
    ab.add('plastic', rbox([t.x - 0.8, t.y + 1.0, t.s + 5.2], 2.4, 2.0, 2.0, 0.4));
    ab.add('plastic', rbox([t.x - 0.8, t.y + 2.2, t.s + 5.6], 1.3, 1.0, 1.4, 0.2)); // connector
    ab.add('steelBlack', rbox([t.x - 0.8, t.y - 0.4, t.s + 5.2], 3.2, 0.3, 2.6, 0.08)); // bracket
    ab.add('plastic', cylAxis('y', [t.x - 1.5, t.y + 2.2, t.s + 4.6], 0.32, 1.0, 8));
    ab.add('plastic', cylAxis('y', [t.x - 0.2, t.y + 2.2, t.s + 4.6], 0.32, 1.0, 8));
    ab.add('rubber', tube([[t.x - 1.5, t.y + 2.8, t.s + 4.6], [t.x - 2.4, t.y + 5.0, t.s + 2.6], [t.x - 3.4, t.y + 7.0, t.s - 1.6], [t.x - 4.4, t.y + 7.4, t.s - 2.6]], 0.2, { radial: 6 }));
    ab.flush(ag, mats, { name: 'act' });
    A.actuator = ag;
  }

  // heat shimmer: two crossed soft quads above the turbine and downpipe, scaled by st.shimmer
  {
    const sh = new THREE.Group(); sh.name = 'heat_shimmer';
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uAmt;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 q = vUv; q.y -= uTime * 0.55; q.x += sin(vUv.y * 9.0 + uTime * 2.1) * 0.06;
          float streak = n(vec2(q.x * 7.0, q.y * 3.2)) * n(vec2(q.x * 15.0 + 3.0, q.y * 6.0 - uTime));
          float mask = smoothstep(0.0,0.22,vUv.x) * smoothstep(1.0,0.78,vUv.x) * smoothstep(0.0,0.12,vUv.y) * smoothstep(1.0,0.35,vUv.y);
          float a = pow(streak, 1.6) * mask * uAmt * 0.16;
          gl_FragColor = vec4(vec3(0.85,0.9,1.0), a);
        }`,
    });
    for (const rot of [0, Math.PI / 2]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), mat); m.rotation.y = rot; m.position.set(t.x - 4.0, t.y + 7.5, t.s + 1.5); m.renderOrder = 10; m.frustumCulled = false; m.raycast = () => {}; sh.add(m);
    }
    root.add(sh); A.shimmer = sh; A.shimmerMat = mat;
  }
  return A;
}
