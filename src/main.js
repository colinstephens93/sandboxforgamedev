import * as THREE from 'three';
import { Renderer } from './core/renderer.js';
import { qualityFromUrl, QUALITY } from './core/quality.js';
import { buildShop } from './shop/shell.js';
import { bakeEnvironment } from './core/env.js';
import { buildEquipment } from './shop/equipment/index.js';
import { buildTruck } from './truck/index.js';
import { DYNO } from './shop/layout.js';

const canvas = document.getElementById('view');
const loadbar = document.getElementById('loadbar');
const loadmsg = document.getElementById('loadmsg');
const progress = (f, m) => { loadbar.style.width = `${Math.round(f * 100)}%`; loadmsg.textContent = m; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function boot() {
  progress(0.05, 'Starting renderer');
  const qname = qualityFromUrl();
  const R = new Renderer(canvas, qname);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101113);
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 300);
  camera.position.set(-10.5, 1.65, 7.5); camera.lookAt(0, 1.2, -1);
  await nextFrame();
  progress(0.2, 'Building the shop');
  const shop = buildShop({ quality: R.q });
  scene.add(shop.group);
  scene.environmentIntensity = 0.28;
  const equipment = buildEquipment({ quality: R.q, shop });
  scene.add(equipment.group);
  progress(0.35, 'Building the truck');
  const truck = buildTruck({ quality: R.q });
  truck.group.position.set(DYNO.truckOrigin.x, 0, DYNO.truckOrigin.z);
  scene.add(truck.group);
  await nextFrame();
  progress(0.6, 'Baking shop reflections');
  bakeEnvironment(R.renderer, scene, new THREE.Vector3(0, 1.4, 0), R.q.envSize);
  progress(0.9, 'Preparing post-processing');
  R.setScene(scene, camera);
  await nextFrame();
  progress(1, 'Ready');

  const state = { R, scene, camera, shop, equipment, truck, frames: 0, last: performance.now(), fps: 0 };
  window.__game = state;
  state.setCam = (p, t, fov = 60) => { camera.position.set(...p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(...t); };
  state.renderOnce = () => R.render(0.016);
  state.shot = () => { R.render(0.016); return canvas.toDataURL('image/png'); };

  const loop = (t) => {
    const dt = Math.min(0.05, (t - state.last) / 1000); state.last = t;
    state.fps = state.fps * 0.9 + (1 / Math.max(dt, 1e-3)) * 0.1;
    shop.updateDoors(dt);
    R.render(dt);
    state.frames++;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  document.getElementById('loading').style.opacity = '0';
  setTimeout(() => document.getElementById('loading').remove(), 700);
}
boot().catch((e) => { console.error(e); document.getElementById('loadmsg').textContent = 'Error: ' + e.message; });
