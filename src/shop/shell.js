// The shop building: insulated steel building, polished concrete floor with control joints and oil stains,
// frames, LED high-bay lights, two roll-up doors, an office shell and the outside world seen through the doors.
import * as THREE from 'three';
import { makeCanvas, noiseField, canvasFromField, heightToNormal, tex, rng } from '../core/proc.js';
import { metricBox, metricPlane, box, aabb } from '../core/geom.js';
import { SHOP, DYNO, ZONES } from './layout.js';

function concreteMaps(size) {
  const n = size;
  // base: fine speckle + broad mottling; control joints are cut into the tile edge (3 m tile)
  const broad = noiseField(n, n, 6, 3, 4, 0.55);
  const fine = noiseField(n, n, 96, 5, 3, 0.6);
  const colorC = canvasFromField(broad, n, n, (v, i) => {
    const f = fine[i];
    const g = 118 + v * 40 + (f - 0.5) * 26;
    return [g, g * 0.985, g * 0.96];
  });
  // joints: dark thin line on tile edges
  const cg = colorC.getContext('2d');
  cg.fillStyle = 'rgba(20,20,20,0.85)';
  const jw = Math.max(2, n / 512 * 3);
  cg.fillRect(0, 0, n, jw); cg.fillRect(0, 0, jw, n);
  cg.fillStyle = 'rgba(60,60,58,0.5)';
  cg.fillRect(0, jw, n, jw * 0.8); cg.fillRect(jw, 0, jw * 0.8, n);
  // roughness: polished (low) with mottled variation, joints rough
  const rc = canvasFromField(broad, n, n, (v, i) => { const r = 0.2 + v * 0.22 + (fine[i] - 0.5) * 0.1; const k = r * 255; return [k, k, k]; });
  const rg = rc.getContext('2d'); rg.fillStyle = '#d0d0d0'; rg.fillRect(0, 0, n, jw); rg.fillRect(0, 0, jw, n);
  const nh = new Float32Array(n * n);
  for (let i = 0; i < nh.length; i++) nh[i] = fine[i] * 0.5 + broad[i] * 0.2;
  const normal = heightToNormal(nh, n, n, 1.2);
  return { colorC, rc, normal };
}

function ribbedPanelMaps(base = [214, 217, 219]) {
  const w = 256, h = 64;
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = (x / w) * 4 % 1; // 4 ribs per tile (tile = 1.2 m: 0.3 m rib pitch)
    height[y * w + x] = t < 0.2 ? t / 0.2 : t < 0.5 ? 1 : t < 0.7 ? 1 - (t - 0.5) / 0.2 : 0;
  }
  const noise = noiseField(w, h, 16, 4, 3, 0.5);
  const colorC = canvasFromField(height, w, h, (v, i) => { const k = 0.9 + noise[i] * 0.14 - (v < 0.1 ? 0.1 : 0); return [base[0] * k, base[1] * k, base[2] * k]; });
  const normal = heightToNormal(height, w, h, 5);
  return { colorC, normal };
}

function skyTexture() {
  const c = makeCanvas(32, 256), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#5f8fc4'); grd.addColorStop(0.55, '#a9c8e6'); grd.addColorStop(0.9, '#e8f0f4'); grd.addColorStop(1, '#f2f2ee');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 256);
  return tex(c, { wrap: false });
}

export function buildShop({ quality }) {
  const S = SHOP;
  const group = new THREE.Group(); group.name = 'shop';
  const colliders = []; // THREE.Box3 solids for walk collision
  const interactables = [];
  const lights = { fixtures: [], pointLights: [], spots: [], on: true };
  const rngf = rng(42);
  const T = quality.tex;

  // ---------------- materials ----------------
  const cm = concreteMaps(T);
  const concrete = new THREE.MeshPhysicalMaterial({
    map: tex(cm.colorC, { repeat: [1 / 3, 1 / 3], aniso: quality.aniso }),
    roughnessMap: tex(cm.rc, { repeat: [1 / 3, 1 / 3], srgb: false, aniso: quality.aniso }),
    normalMap: tex(cm.normal, { repeat: [1 / 3, 1 / 3], srgb: false, aniso: quality.aniso }),
    normalScale: new THREE.Vector2(0.35, 0.35), metalness: 0.0, roughness: 1.0, clearcoat: 0.12, clearcoatRoughness: 0.2, envMapIntensity: 0.8,
  });
  const panelTile = 1.2;
  const pm = ribbedPanelMaps([205, 209, 211]);
  const panelMat = new THREE.MeshStandardMaterial({
    map: tex(pm.colorC, { repeat: [1 / panelTile, 1 / 1.2], aniso: quality.aniso }),
    normalMap: tex(pm.normal, { repeat: [1 / panelTile, 1 / 1.2], srgb: false, aniso: quality.aniso }),
    normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.55, metalness: 0.25, envMapIntensity: 0.7,
  });
  const pmd = ribbedPanelMaps([70, 74, 80]);
  const wainMat = new THREE.MeshStandardMaterial({
    map: tex(pmd.colorC, { repeat: [1 / panelTile, 1 / 1.2], aniso: quality.aniso }),
    normalMap: tex(pmd.normal, { repeat: [1 / panelTile, 1 / 1.2], srgb: false, aniso: quality.aniso }),
    roughness: 0.5, metalness: 0.35, envMapIntensity: 0.8,
  });
  const insul = new THREE.MeshStandardMaterial({ color: 0xe9ebe8, roughness: 0.75, metalness: 0.0, side: THREE.DoubleSide });
  const steelFrame = new THREE.MeshStandardMaterial({ color: 0x35383c, roughness: 0.55, metalness: 0.5 });
  const steelRed = new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.45, metalness: 0.3 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1e2023, roughness: 0.5, metalness: 0.6 });
  const exteriorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.64, 0.62).multiplyScalar(2.0) });

  const add = (o) => { group.add(o); return o; };
  const wallBox = (w, h, d, x, y, z, mat = panelMat, collide = true) => {
    const m = new THREE.Mesh(metricBox(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true;
    add(m);
    if (collide) colliders.push(aabb(x, y, z, w / 2, h / 2, d / 2));
    return m;
  };

  // ---------------- floor with the dyno pit cut out ----------------
  {
    const shape = new THREE.Shape();
    shape.moveTo(-S.halfX, -S.halfZ); shape.lineTo(S.halfX, -S.halfZ); shape.lineTo(S.halfX, S.halfZ); shape.lineTo(-S.halfX, S.halfZ); shape.closePath();
    const pz = DYNO.truckOrigin.z + 3.886; // rear axle z (wheelbase 153 in = 3.886 m)
    const hole = new THREE.Path();
    const hw = DYNO.pit.halfW, hl = DYNO.pit.len / 2;
    // shape y = -world z (rotateX(-pi/2) maps shape y to -z), winding opposite to the outer contour
    hole.moveTo(-hw, -pz - hl); hole.lineTo(hw, -pz - hl); hole.lineTo(hw, -pz + hl); hole.lineTo(-hw, -pz + hl); hole.closePath();
    shape.holes.push(hole);
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2); // shape (x, y) -> world (x, 0, -y), normal up (+Y)
    // ShapeGeometry uv = shape coords in meters; after rotation the uv remain metric. ok
    const floor = new THREE.Mesh(g, concrete);
    floor.receiveShadow = true; floor.name = 'floor';
    add(floor);
  }

  // ---------------- exterior world seen through the doors ----------------
  {
    // ground apron with slight color variation
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x4a4a46, roughness: 0.92, metalness: 0.02 });
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(180, 140), apronMat);
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.03, -78); apron.receiveShadow = true; add(apron);
    // distant skyline / industrial buildings
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x6a675f, roughness: 0.85, metalness: 0.05 });
    for (let i = 0; i < 5; i++) {
      const w = 18 + rngf() * 22, h = 6 + rngf() * 14, d = 4 + rngf() * 6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMat);
      b.position.set(-60 + i * 28 + rngf() * 8, h / 2, -70 - rngf() * 12); add(b);
    }
    const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 20), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, color: new THREE.Color(1.6, 1.65, 1.7) }));
    sky.position.set(0, -4, 0); sky.name = 'sky'; add(sky);
    // tree billboards with better spread
    const treeTex = (() => {
      const c = makeCanvas(256, 256), g = c.getContext('2d'); const r = rng(11);
      g.fillStyle = '#3b2b1d'; g.fillRect(122, 150, 12, 106);
      for (let i = 0; i < 380; i++) {
        const x = 128 + (r() - 0.5) * 170 * (1 - (i / 380) * 0.3), y = 100 + (r() - 0.5) * 120 + (i / 380) * 20, rad = 10 + r() * 22;
        const l = 22 + r() * 22; g.fillStyle = `hsl(${88 + r() * 24}, ${34 + r() * 20}%, ${l}%)`;
        g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
      }
      return tex(c, { wrap: false });
    })();
    const treeMat = new THREE.MeshBasicMaterial({ map: treeTex, transparent: true, alphaTest: 0.3, color: new THREE.Color(1.25, 1.25, 1.2), side: THREE.DoubleSide });
    for (let i = 0; i < 22; i++) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(8 + rngf() * 6, 8 + rngf() * 6), treeMat);
      t.position.set(-55 + i * 5.2 + rngf() * 3, 4.8 + rngf() * 1.5, -48 - rngf() * 14); add(t);
    }
    // lot markings
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.4, 0.45) }));
    lot.rotation.x = -Math.PI / 2; lot.position.set(0, -0.02, -24); add(lot);
  }

  // ---------------- walls ----------------
  const wt = S.wallT, hx = S.halfX, hz = S.halfZ, eave = S.eave;
  // north wall (z = -hz) with two roll-up door openings
  {
    const xs = [-hx];
    const segs = [];
    let cursor = -hx;
    for (const dx of S.doorXs) {
      const l = dx - S.doorW / 2;
      segs.push([cursor, l]); cursor = dx + S.doorW / 2;
    }
    segs.push([cursor, hx]);
    for (const [a, b] of segs) {
      wallBox(b - a, eave, wt, (a + b) / 2, eave / 2, -hz - wt / 2);
      // wainscot inside
      wallBox(b - a, 1.2, 0.04, (a + b) / 2, 0.6, -hz + 0.02, wainMat, false);
    }
    for (const dx of S.doorXs) {
      wallBox(S.doorW, eave - S.doorH, wt, dx, S.doorH + (eave - S.doorH) / 2, -hz - wt / 2, panelMat, false); // header over the opening
    }
  }
  // south wall (z = +hz) with a man door and the office glazing handled by office
  wallBox(2 * hx, eave, wt, 0, eave / 2, hz + wt / 2);
  wallBox(2 * hx, 1.2, 0.04, 0, 0.6, hz - 0.02, wainMat, false);
  // east/west gable walls (x = +-hx): rectangle plus triangle
  for (const sx of [-1, 1]) {
    wallBox(wt, eave, 2 * hz, sx * (hx + wt / 2), eave / 2, 0);
    wallBox(0.04, 1.2, 2 * hz, sx * (hx - 0.02), 0.6, 0, wainMat, false);
    const tri = new THREE.Shape(); tri.moveTo(-hz, 0); tri.lineTo(hz, 0); tri.lineTo(0, S.ridge - eave); tri.closePath();
    const g = new THREE.ExtrudeGeometry(tri, { depth: wt, bevelEnabled: false });
    // metric uv for the ribbed panels
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { /* extrude uv already in shape meters */ }
    const m = new THREE.Mesh(g, panelMat); m.rotation.y = sx * Math.PI / 2; m.position.set(sx * (hx + (sx > 0 ? 0 : 0)), eave, 0);
    // extrude depth goes +z in local space: after rotation +z -> +x (sx=1) or -x (sx=-1); shift to sit outside
    m.position.x = sx > 0 ? hx : -hx - wt; m.rotation.y = Math.PI / 2; m.receiveShadow = true; add(m);
  }

  // ---------------- roof (gable ridge along X) ----------------
  const slope = Math.atan2(S.ridge - eave, hz);
  const rafterLen = Math.hypot(hz, S.ridge - eave);
  for (const sz of [-1, 1]) {
    // tilt group: rotation about X by sz*slope raises the half toward the ridge at z = 0
    const tilt = new THREE.Group();
    tilt.rotation.x = sz * slope;
    tilt.position.set(0, (eave + S.ridge) / 2, sz * hz / 2);
    const top = new THREE.Mesh(metricPlane(2 * hx + 0.6, rafterLen + 0.4), new THREE.MeshStandardMaterial({ color: 0xb9bcbe, roughness: 0.5, metalness: 0.4 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.16; top.castShadow = false; tilt.add(top);
    const under = new THREE.Mesh(metricPlane(2 * hx, rafterLen), insul);
    under.rotation.x = Math.PI / 2; under.position.y = 0.0; under.receiveShadow = true; tilt.add(under);
    add(tilt);
  }

  // ---------------- steel frames (portal frames), girts, purlins ----------------
  const frameXs = [-hx + 0.15, -6, 0, 6, hx - 0.15];
  const ibeam = (len, flange = 0.2, web = 0.3, t = 0.012, mat = steelFrame) => {
    const g = new THREE.Group();
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(t, web, len), mat); g.add(w1);
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(flange, t * 1.4, len), mat); f1.position.y = web / 2; g.add(f1);
    const f2 = f1.clone(); f2.position.y = -web / 2; g.add(f2);
    return g;
  };
  for (const fx of frameXs) {
    for (const sz of [-1, 1]) {
      // column
      const col = new THREE.Group();
      const web = new THREE.Mesh(new THREE.BoxGeometry(0.012, eave, 0.32), steelFrame); col.add(web);
      for (const k of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.2, eave, 0.016), steelFrame); f.position.z = k * 0.16; col.add(f); }
      col.position.set(fx, eave / 2, sz * (hz - 0.17)); col.children.forEach((c) => { c.castShadow = false; });
      add(col);
      if (Math.abs(fx) < hx - 1) colliders.push(aabb(fx, eave / 2, sz * (hz - 0.17), 0.12, eave / 2, 0.18));
      // rafter
      const r = ibeam(rafterLen, 0.18, 0.3, 0.012);
      const holder = new THREE.Group(); holder.rotation.x = sz * slope; holder.position.set(fx, (eave + S.ridge) / 2 - 0.2, sz * hz / 2); holder.add(r);
      add(holder);
    }
  }
  // purlins (instanced)
  {
    const geo = new THREE.BoxGeometry(2 * hx, 0.1, 0.05);
    const n = 14; const im = new THREE.InstancedMesh(geo, darkSteel, n * 2);
    const m4 = new THREE.Matrix4(); let k = 0;
    for (const sz of [-1, 1]) for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; const z = sz * hz * (1 - t * 0.98);
      const y = eave + (S.ridge - eave) * (t * 0.98) - 0.12;
      m4.compose(new THREE.Vector3(0, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(sz * slope, 0, 0)), new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(k++, m4);
    }
    add(im);
  }

  // ---------------- LED high bay lights ----------------
  {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.4, metalness: 0.7 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0.95, 0.97, 1.0), emissiveIntensity: 5.0, roughness: 0.3 });
    lights.lensMat = lensMat;
    const posList = [];
    for (const x of [-9, -3, 3, 9]) for (const z of [-5, 0.2, 5]) posList.push([x, z]);
    posList.push([0, -2.6]);
    for (const [x, z] of posList) {
      const y = 5.4 + (S.ridge - eave) * (1 - Math.abs(z) / hz) - 0.9 + 0.5;
      const hy = Math.min(y, 6.3);
      const f = new THREE.Group(); f.position.set(x, hy - 0.3, z);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.12, 24), bodyMat); f.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.025, 28), lensMat); lens.position.y = -0.07; f.add(lens);
      const fins = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.1, 24), bodyMat); fins.position.y = 0.1; f.add(fins);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), darkSteel); rod.position.y = 0.55; f.add(rod);
      add(f); lights.fixtures.push(f);
    }
    lights.positions = posList;
  }

  // ---------------- roll-up doors (animated) ----------------
  const doors = [];
  {
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xe3e5e4, roughness: 0.5, metalness: 0.35, map: tex((() => { const c = makeCanvas(32, 128), g = c.getContext('2d'); for (let i = 0; i < 4; i++) { const y = i * 32; const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, '#9a9c9e'); gr.addColorStop(0.15, '#f1f2f1'); gr.addColorStop(0.8, '#d4d6d5'); gr.addColorStop(1, '#6f7173'); g.fillStyle = gr; g.fillRect(0, y, 32, 32); } return c; })(), { repeat: [1, S.doorH / 0.5 / 4], aniso: 4 }) });
    for (const dx of S.doorXs) {
      const g = new THREE.Group(); g.position.set(dx, S.doorH, -hz + 0.02);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(S.doorW - 0.1, S.doorH, 0.05), slatMat);
      panel.position.y = -S.doorH / 2; panel.receiveShadow = true; g.add(panel);
      // bottom bar
      const bar = new THREE.Mesh(new THREE.BoxGeometry(S.doorW - 0.1, 0.09, 0.07), darkSteel); bar.position.y = -S.doorH + 0.045; g.add(bar);
      // rolled-up coil in the header (visible when open)
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, S.doorW - 0.1, 24), slatMat); coil.rotation.z = Math.PI / 2; coil.position.set(0, 0.22, 0.0); g.add(coil);
      // guide tracks
      for (const k of [-1, 1]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.1, S.doorH, 0.1), darkSteel); tr.position.set(k * (S.doorW / 2 - 0.02), -S.doorH / 2, 0.02); g.add(tr); }
      add(g);
      const state = { group: g, panel, bar, open: 1, target: 1, dx };
      doors.push(state);
      // placed collider while closed handled in update
      const col = aabb(dx, S.doorH / 2, -hz + 0.02, S.doorW / 2, S.doorH / 2, 0.06); col.userData = { door: state }; col.userData.enabled = false;
      state.collider = col;
      colliders.push(col);
    }
  }
  const setDoor = (i, open) => { doors[i].target = open ? 1 : 0; };
  const updateDoors = (dt) => {
    for (const d of doors) {
      d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 0.35);
      const h = (1 - d.open);
      d.panel.scale.y = Math.max(0.0001, h); d.panel.position.y = -S.doorH * h / 2 + 0.0;
      d.bar.position.y = -S.doorH * h + 0.045;
      d.bar.visible = h > 0.01;
      d.group.children[2].visible = true;
      d.collider.userData.enabled = d.open < 0.6;
    }
  };

  // ---------------- office shell (south-east corner) ----------------
  const office = new THREE.Group(); office.name = 'office'; add(office);
  {
    const o = ZONES.office; const h = 2.7;
    const x0 = o.x - o.hx, z0 = o.z - o.hz; // north-west corner of the office footprint
    const wm = new THREE.MeshStandardMaterial({ color: 0xcfd1cd, roughness: 0.8 });
    const wall = (w, hh, d, x, y, z, mat = wm) => { const m = new THREE.Mesh(metricBox(w, hh, d), mat); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = true; office.add(m); colliders.push(aabb(x, y, z, w / 2, hh / 2, d / 2)); };
    // west wall (with a door gap) and north wall (with a window)
    wall(0.12, h, o.hz * 2 - 1.2, x0, h / 2, z0 + (o.hz * 2 - 1.2) / 2 + 1.2); // west wall, door gap near north end
    wall(0.12, h - 2.1, 1.2, x0, 2.1 + (h - 2.1) / 2, z0 + 0.6); // above the door
    // north wall with window: lower and upper strips and pillars
    wall(o.hx * 2, 1.0, 0.12, o.x, 0.5, z0);
    wall(o.hx * 2, 0.5, 0.12, o.x, h - 0.25, z0);
    wall(0.4, 1.2, 0.12, x0 + 0.2, 1.6, z0); wall(0.4, 1.2, 0.12, x0 + o.hx * 2 - 0.2, 1.6, z0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2 - 0.8, 1.2, 0.02), new THREE.MeshPhysicalMaterial({ color: 0xbfd6d8, roughness: 0.05, transparent: true, opacity: 0.25, envMapIntensity: 1.2 }));
    glass.position.set(o.x, 1.6, z0); office.add(glass);
    // ceiling (drop ceiling tile look)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(o.hx * 2, o.hz * 2), new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(o.x, h, o.z); office.add(ceil);
    // office floor: slightly raised vinyl tile look
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(o.hx * 2, o.hz * 2), new THREE.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.55 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(o.x, 0.012, o.z); fl.receiveShadow = true; office.add(fl);
    office.userData = { x0, z0, h };
  }

  // ---------------- oil stains (decals on the floor) ----------------
  {
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    const nf = noiseField(256, 256, 6, 9, 4, 0.55);
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 128, dy = (y - 128) / 128; const r = Math.hypot(dx, dy);
      const a = Math.max(0, 1 - r) * (0.4 + nf[y * 256 + x] * 0.9); const al = Math.min(0.85, Math.pow(a, 1.4) * 1.3);
      const i = (y * 256 + x) * 4; img.data[i] = 22; img.data[i + 1] = 20; img.data[i + 2] = 18; img.data[i + 3] = al * 255;
    }
    g.putImageData(img, 0, 0);
    const t = tex(c, { wrap: false });
    const stainMat = new THREE.MeshPhysicalMaterial({ map: t, transparent: true, roughness: 0.18, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 1.2 });
    const spots = [[0.6, -1.0, 1.1], [-0.4, 3.2, 1.8], [-8.2, 2.6, 1.4], [-5.0, 5.8, 0.8], [3.8, 1.2, 0.7], [-1.9, 7.2, 0.9], [-2.0, -5.5, 0.6], [6.0, -4.0, 0.8], [-8.1, 4.1, 0.9], [-10.4, -4.6, 0.7], [2.2, -3.5, 0.55], [-3.8, 1.1, 0.7], [4.5, 4.8, 0.65], [-6.5, -2.2, 0.5]];
    const pzC = DYNO.truckOrigin.z + 3.886;
    spots.push([0.0, pzC + 1.7, 0.9], [-1.5, pzC - 3.9, 0.8]);
    for (const [x, z, s] of spots) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.5, s * 1.3), stainMat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = rngf() * 6.28; m.position.set(x, 0.003 + rngf() * 0.001, z); group.add(m);
    }
  }

  // ---------------- lights (physical units; tuned visually) ----------------
  {
    const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x6d6a64, 0.12); hemi.name = 'hemi'; add(hemi); lights.hemi = hemi;
    const spotDefs = [[0, -3.0], [0, 0.4], [0, 3.6]];
    for (const [x, z] of spotDefs) {
      const s = new THREE.SpotLight(0xf4f7ff, 75, 16, Math.PI / 3.2, 0.9, 1.6);
      s.position.set(x, 5.8, z); s.target.position.set(x, 0, z);
      s.castShadow = true; s.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
      s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02; s.shadow.radius = 5; s.shadow.camera.near = 1; s.shadow.camera.far = 14;
      add(s); add(s.target); lights.spots.push(s);
    }
    // fill lights: only the ones nearest the truck (x = 0) are created; setFill(n) switches how many are lit, with the
    // remaining ones strengthened to make up for the ones dropped (every light costs time on every lit pixel)
    const fill = lights.positions.filter(([x]) => Math.abs(x) >= 1)
      .sort((a, b) => (Math.abs(a[0]) - Math.abs(b[0])) || (Math.abs(a[1] - 0.2) - Math.abs(b[1] - 0.2)))
      .slice(0, 6);
    for (const [x, z] of fill) {
      const p = new THREE.PointLight(0xf1f5ff, 16, 14, 1.7); p.position.set(x, 5.2, z); add(p); lights.pointLights.push(p);
    }
    lights.baseIntensities = [...lights.spots.map((s) => s.intensity), ...lights.pointLights.map((p) => p.intensity), hemi.intensity];
  }
  const nSpots = lights.spots.length;
  lights.setFill = (n) => {
    n = Math.max(1, Math.min(lights.pointLights.length, n | 0));
    const gain = Math.min(2.5, (12 / n) * 0.6 + 0.4);
    lights.pointLights.forEach((p, i) => {
      p.visible = i < n;
      lights.baseIntensities[nSpots + i] = 16 * gain;
      if (lights.on) p.intensity = 16 * gain;
    });
  };
  const setLights = (on) => {
    lights.on = on;
    const all = [...lights.spots, ...lights.pointLights, lights.hemi];
    all.forEach((l, i) => { l.intensity = on ? lights.baseIntensities[i] : (l === lights.hemi ? 0.15 : 0); });
    lights.lensMat.emissiveIntensity = on ? 5.0 : 0.0;
  };

  lights.setFill(quality.fillLights ?? 6);
  return { group, colliders, interactables, lights, doors, setDoor, updateDoors, setLights, office, materials: { concrete, panelMat, steelFrame, darkSteel, steelRed, insul, wainMat, exteriorMat } };
}
