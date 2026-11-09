import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------------------------------------------------------------------------
   Small deterministic random + texture workshop
--------------------------------------------------------------------------- */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas2d(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texFromCanvas(canvas, { repeat = [1, 1], srgb = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeConcreteTextures(seed = 42) {
  const random = rng(seed);
  const size = 1024;
  const [albedoCanvas, actx] = canvas2d(size);
  const [bumpCanvas, bctx] = canvas2d(512);
  const img = actx.createImageData(size, size);
  const bimg = bctx.createImageData(512, 512);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const grain = (random() - 0.5) * 18 + (random() - 0.5) * 8;
      const cloud = 9 * Math.sin(x * 0.012 + y * 0.006) + 6 * Math.sin(y * 0.023);
      const value = 121 + grain + cloud;
      img.data[i] = value;
      img.data[i + 1] = value + 1;
      img.data[i + 2] = value - 2;
      img.data[i + 3] = 255;
    }
  }
  actx.putImageData(img, 0, 0);
  // aggregate speckle and hairline cracks
  for (let i = 0; i < 4600; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = random() * 1.5 + 0.2;
    actx.fillStyle = random() > 0.45 ? 'rgba(62,62,58,.18)' : 'rgba(205,203,196,.12)';
    actx.beginPath();
    actx.arc(x, y, r, 0, Math.PI * 2);
    actx.fill();
  }
  actx.strokeStyle = 'rgba(52,52,48,.16)';
  actx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    let x = random() * size;
    let y = random() * size;
    actx.beginPath();
    actx.moveTo(x, y);
    for (let s = 0; s < 10; s++) {
      x += (random() - 0.5) * 55;
      y += random() * 32;
      actx.lineTo(x, y);
    }
    actx.stroke();
  }
  for (let i = 0; i < 22; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 30 + random() * 160;
    const g = actx.createRadialGradient(x, y, 0, x, y, radius);
    const dark = random() > 0.55;
    g.addColorStop(0, dark ? 'rgba(35,36,33,.08)' : 'rgba(225,222,211,.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    actx.fillStyle = g;
    actx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const bimgData = bimg.data;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const v = 122 + (random() - 0.5) * 46 + 9 * Math.sin(x * 0.07) + 9 * Math.sin(y * 0.055);
      bimgData[i] = bimgData[i + 1] = bimgData[i + 2] = v;
      bimgData[i + 3] = 255;
    }
  }
  bctx.putImageData(bimg, 0, 0);
  const map = texFromCanvas(albedoCanvas, { repeat: [2.6, 2.1], srgb: true });
  const bump = texFromCanvas(bumpCanvas, { repeat: [2.6, 2.1] });
  return { map, bump };
}

export function makeGrimeTexture(seed = 7) {
  const random = rng(seed);
  const [c, ctx] = canvas2d(512);
  const img = ctx.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 95 + random() * 100;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return texFromCanvas(c, { repeat: [3, 3] });
}

function makeCastBump(seed = 37) {
  const random = rng(seed);
  const [c, ctx] = canvas2d(512);
  const img = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const granular = (random() - 0.5) * 34;
      const sand = Math.sin(x * 0.25 + y * 0.11) * 4;
      const v = 128 + granular + sand;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return texFromCanvas(c, { repeat: [2.5, 2.5] });
}

function makeBrushedRoughness(seed = 9) {
  const random = rng(seed);
  const [c, ctx] = canvas2d(512);
  ctx.fillStyle = '#858585';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2400; i++) {
    const y = random() * 512;
    const alpha = 0.025 + random() * 0.11;
    ctx.strokeStyle = `rgba(${random() > 0.5 ? 240 : 20},${random() > 0.5 ? 240 : 20},${random() > 0.5 ? 240 : 20},${alpha})`;
    ctx.lineWidth = random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (random() - 0.5) * 4);
    ctx.stroke();
  }
  return texFromCanvas(c, { repeat: [3, 1] });
}

export function makeRadialTexture(inner = 'rgba(0,0,0,0.65)', outer = 'rgba(0,0,0,0)', size = 512) {
  const [c, ctx] = canvas2d(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.38, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeHazardTexture(repeatX = 8, repeatY = 1) {
  const [c, ctx] = canvas2d(512, 64);
  ctx.fillStyle = '#181918';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#dfa12b';
  for (let x = -64; x < 540; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 28, 0);
    ctx.lineTo(x + 56, 0);
    ctx.lineTo(x + 28, 64);
    ctx.closePath();
    ctx.fill();
  }
  const t = texFromCanvas(c, { repeat: [repeatX, repeatY], srgb: true });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/* ---------------------------------------------------------------------------
   Label / signage textures
--------------------------------------------------------------------------- */
export function makeLabelTexture(lines, opts = {}) {
  const {
    width = 1024,
    height = 256,
    background = 'transparent',
    color = '#e8e7e1',
    accent = '#e68f2c',
    titleFont = '700 132px Bahnschrift, "Arial Narrow", Arial, sans-serif',
    bodyFont = '500 34px Bahnschrift, "Arial Narrow", Arial, sans-serif',
    align = 'left',
    padding = 54,
    border = false,
    letterSpacing = 0,
  } = opts;
  const [c, ctx] = canvas2d(width, height);
  ctx.clearRect(0, 0, width, height);
  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  if (border) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, width - 16, height - 16);
  }
  const entries = Array.isArray(lines) ? lines : [{ text: lines, font: titleFont, color }];
  const x = align === 'center' ? width / 2 : padding;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  let total = 0;
  const metrics = entries.map((entry) => {
    const font = entry.font || (entry.small ? bodyFont : titleFont);
    ctx.font = font;
    const m = ctx.measureText(entry.text);
    const h = parseInt(font.match(/(\d+)px/)?.[1] || '32', 10) * 1.25;
    total += h;
    return { ...entry, font, m, h };
  });
  let y = height / 2 - total / 2;
  for (const item of metrics) {
    ctx.font = item.font;
    ctx.fillStyle = item.color || (item.small ? color : color);
    if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
    ctx.fillText(item.text, x, y + item.h / 2);
    if (item.accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(x, y + item.h + 2, Math.min(220, item.m.width), 5);
    }
    y += item.h;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function makeDecalMaterial(texture, roughness = 0.6) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.02,
    roughness,
    metalness: 0.18,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/* ---------------------------------------------------------------------------
   Materials
--------------------------------------------------------------------------- */
export function createMaterials() {
  const castBump = makeCastBump();
  const brushed = makeBrushedRoughness();
  const common = {
    bumpMap: castBump,
    bumpScale: 0.55,
    envMapIntensity: 1.0,
    dithering: true,
  };
  const mk = (opts) => new THREE.MeshStandardMaterial({ ...common, ...opts });
  const physical = (opts) => new THREE.MeshPhysicalMaterial({ ...common, ...opts });

  const mats = {
    castIronBlock: mk({
      color: 0x2a2e2c,
      metalness: 0.48,
      roughness: 0.72,
      bumpScale: 0.75,
    }),
    castIronBlockDark: mk({
      color: 0x1f2321,
      metalness: 0.45,
      roughness: 0.76,
      bumpScale: 0.78,
    }),
    castIronCap: mk({
      color: 0x353936,
      metalness: 0.54,
      roughness: 0.68,
    }),
    castIronExhaust: mk({
      color: 0x5d4333,
      metalness: 0.68,
      roughness: 0.54,
      bumpScale: 0.76,
    }),
    castIronExhaustTint: mk({
      color: 0x74543e,
      metalness: 0.66,
      roughness: 0.46,
    }),
    castAluminumHead: mk({
      color: 0xaab0ab,
      metalness: 0.78,
      roughness: 0.43,
      bumpScale: 0.38,
    }),
    castAluminum: mk({
      color: 0x8b918c,
      metalness: 0.75,
      roughness: 0.48,
      bumpScale: 0.42,
    }),
    machinedAluminum: physical({
      color: 0xb5bab5,
      metalness: 0.9,
      roughness: 0.24,
      clearcoat: 0.12,
      clearcoatRoughness: 0.42,
      bumpMap: brushed,
      bumpScale: 0.12,
    }),
    satinAluminum: mk({
      color: 0x8c918b,
      metalness: 0.8,
      roughness: 0.44,
      bumpMap: brushed,
      bumpScale: 0.1,
    }),
    alumDark: mk({
      color: 0x555b58,
      metalness: 0.78,
      roughness: 0.5,
      bumpMap: castBump,
      bumpScale: 0.3,
    }),
    castIronDark: mk({
      color: 0x424643,
      metalness: 0.68,
      roughness: 0.62,
    }),
    nitridedSteel: physical({
      color: 0x686b61,
      metalness: 0.94,
      roughness: 0.29,
      clearcoat: 0.1,
      clearcoatRoughness: 0.3,
      bumpMap: brushed,
      bumpScale: 0.08,
    }),
    forgedSteel: mk({
      color: 0x565a5b,
      metalness: 0.92,
      roughness: 0.4,
    }),
    polishedSteel: mk({
      color: 0xd4d7d3,
      metalness: 1.0,
      roughness: 0.13,
      bumpMap: brushed,
      bumpScale: 0.06,
    }),
    darkSteel: mk({
      color: 0x343737,
      metalness: 0.9,
      roughness: 0.46,
    }),
    blackOxide: mk({
      color: 0x1e2020,
      metalness: 0.8,
      roughness: 0.48,
    }),
    boltSteel: mk({
      color: 0x858982,
      metalness: 0.9,
      roughness: 0.28,
      bumpMap: brushed,
      bumpScale: 0.04,
    }),
    blackPlastic: physical({
      color: 0x171a1a,
      metalness: 0.16,
      roughness: 0.52,
      clearcoat: 0.5,
      clearcoatRoughness: 0.34,
      bumpMap: castBump,
      bumpScale: 0.12,
    }),
    wrinkleBlack: mk({
      color: 0x202323,
      metalness: 0.5,
      roughness: 0.65,
      bumpMap: castBump,
      bumpScale: 1.1,
    }),
    coverBlack: mk({
      color: 0x232625,
      metalness: 0.6,
      roughness: 0.4,
    }),
    rubber: mk({
      color: 0x101212,
      metalness: 0.02,
      roughness: 0.91,
      bumpMap: brushed,
      bumpScale: 0.25,
    }),
    carbon: mk({
      color: 0x171512,
      metalness: 0.14,
      roughness: 0.88,
      bumpMap: castBump,
      bumpScale: 0.9,
    }),
    heatShield: physical({
      color: 0xa9aaa2,
      metalness: 0.82,
      roughness: 0.32,
      clearcoat: 0.1,
    }),
    turboBlue: mk({
      color: 0x2d4856,
      metalness: 0.45,
      roughness: 0.52,
    }),
    rubberBlue: mk({
      color: 0x17374b,
      metalness: 0.02,
      roughness: 0.76,
    }),
    copper: mk({
      color: 0xa66b42,
      metalness: 0.95,
      roughness: 0.28,
      bumpMap: brushed,
      bumpScale: 0.06,
    }),
    fuelLine: mk({
      color: 0x6b6d63,
      metalness: 0.92,
      roughness: 0.31,
      bumpMap: brushed,
      bumpScale: 0.08,
    }),
    braided: mk({
      color: 0x3f423c,
      metalness: 0.72,
      roughness: 0.58,
      bumpMap: brushed,
      bumpScale: 0.4,
    }),
    brass: mk({
      color: 0xae8c53,
      metalness: 0.93,
      roughness: 0.3,
    }),
    oilFilterBlue: physical({
      color: 0x1e5d87,
      metalness: 0.55,
      roughness: 0.36,
      clearcoat: 0.7,
      clearcoatRoughness: 0.22,
    }),
    red: physical({
      color: 0xa3271c,
      metalness: 0.2,
      roughness: 0.38,
      clearcoat: 0.6,
    }),
    amber: new THREE.MeshStandardMaterial({
      color: 0xcc7c1f,
      emissive: 0x7a3300,
      emissiveIntensity: 0.8,
      roughness: 0.32,
      metalness: 0.15,
    }),
    gaugeFace: new THREE.MeshStandardMaterial({
      color: 0xd7d3c5,
      roughness: 0.82,
      metalness: 0.01,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xb9d2d7,
      metalness: 0,
      roughness: 0.08,
      transmission: 0.78,
      transparent: true,
      opacity: 0.3,
      thickness: 0.04,
      ior: 1.48,
    }),
    floor: null,
    concreteWall: mk({
      color: 0x777a75,
      metalness: 0.02,
      roughness: 0.9,
      bumpMap: castBump,
      bumpScale: 1.4,
    }),
    wallSteel: mk({
      color: 0x303837,
      metalness: 0.55,
      roughness: 0.55,
    }),
    standSteel: mk({
      color: 0x252a2a,
      metalness: 0.72,
      roughness: 0.42,
      bumpMap: castBump,
      bumpScale: 0.35,
    }),
    standYellow: physical({
      color: 0xa9751b,
      metalness: 0.24,
      roughness: 0.44,
      clearcoat: 0.25,
    }),
    aluminumDuct: mk({
      color: 0x868c89,
      metalness: 0.82,
      roughness: 0.38,
    }),
    castDark: mk({
      color: 0x3a3e3d,
      metalness: 0.65,
      roughness: 0.64,
    }),
  };

  // reusable glass / glow materials (per-piston instances added later)
  mats.combustion = new THREE.MeshBasicMaterial({
    color: 0xff8a32,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mats.injection = new THREE.MeshBasicMaterial({
    color: 0xffd08a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  mats.glowPlug = new THREE.MeshStandardMaterial({
    color: 0x5d2511,
    emissive: 0xff5d17,
    emissiveIntensity: 0.05,
    roughness: 0.4,
    metalness: 0.55,
  });
  mats.emissiveWarm = new THREE.MeshBasicMaterial({ color: 0xffdfb1 });
  mats.emissiveCool = new THREE.MeshBasicMaterial({ color: 0xbfe4ff });
  mats.emissiveGreen = new THREE.MeshBasicMaterial({ color: 0x55ffb0 });
  mats.ledRed = new THREE.MeshBasicMaterial({ color: 0xff3e24 });
  mats.screen = new THREE.MeshBasicMaterial({ color: 0x14252b });
  return mats;
}

/* ---------------------------------------------------------------------------
   Geometry helpers
--------------------------------------------------------------------------- */
export function mesh(geometry, material, opts = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = opts.castShadow !== false;
  m.receiveShadow = opts.receiveShadow !== false;
  if (opts.name) m.name = opts.name;
  if (opts.position) m.position.set(...opts.position);
  if (opts.rotation) m.rotation.set(...opts.rotation);
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.renderOrder !== undefined) m.renderOrder = opts.renderOrder;
  if (opts.partId) m.userData.partId = opts.partId;
  return m;
}

export function box(w, h, d, material, opts = {}) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, opts);
}

export function cylinder(rTop, rBottom, h, material, opts = {}) {
  const radial = opts.radial ?? 20;
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, radial, 1, opts.open ?? false), material, opts);
}

export function roundedBox(w, h, d, radius, material, opts = {}) {
  const seg = opts.segments ?? 2;
  return mesh(new RoundedBoxGeometry(w, h, d, seg, radius), material, opts);
}

export function cylinderBetween(a, b, radius, material, opts = {}) {
  const start = a.isVector3 ? a : new THREE.Vector3(...a);
  const end = b.isVector3 ? b : new THREE.Vector3(...b);
  const delta = new THREE.Vector3().subVectors(end, start);
  const len = delta.length();
  const m = mesh(new THREE.CylinderGeometry(radius, opts.taper ? radius * opts.taper : radius, len, opts.radial ?? 14, 1, opts.open ?? false), material, {
    ...opts,
    castShadow: opts.castShadow !== false,
    receiveShadow: opts.receiveShadow !== false,
  });
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  if (opts.partId) m.userData.partId = opts.partId;
  return m;
}

export function tube(points, radius, material, opts = {}) {
  const vectors = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  const curve = new THREE.CatmullRomCurve3(vectors, false, opts.curveType || 'catmullrom', opts.tension ?? 0.4);
  const geo = new THREE.TubeGeometry(curve, opts.segments ?? 48, radius, opts.radial ?? 10, false);
  return mesh(geo, material, opts);
}

export function torus(radius, tubeRadius, material, opts = {}) {
  return mesh(new THREE.TorusGeometry(radius, tubeRadius, opts.radialSeg ?? 10, opts.tubularSeg ?? 32, opts.arc ?? Math.PI * 2), material, opts);
}

export function bolt(size, material, opts = {}) {
  const group = new THREE.Group();
  const washer = cylinder(size * 1.45, size * 1.45, size * 0.22, material, { radial: 18, castShadow: false });
  const head = cylinder(size, size * 1.1, size * 0.8, material, { radial: 6, castShadow: opts.castShadow ?? false });
  head.position.y = size * 0.5;
  head.rotation.y = Math.PI / 6;
  group.add(washer, head);
  if (opts.stud) {
    const stud = cylinder(size * 0.5, size * 0.5, size * 1.4, material, { radial: 10, castShadow: false });
    stud.position.y = -size * 0.8;
    group.add(stud);
  }
  group.userData.bolt = true;
  if (opts.position) group.position.set(...opts.position);
  return group;
}

export function orientYTo(obj, direction) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return obj;
}

export function orientZTo(obj, direction) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
  return obj;
}

export function addBoltAt(parent, position, normal, size, material, opts = {}) {
  const b = bolt(size, material, opts);
  b.position.set(...position);
  orientYTo(b, new THREE.Vector3(...normal));
  parent.add(b);
  return b;
}

export function deckOfBolts(parent, count, radiusPositions, normal, size, material, center = [0, 0, 0]) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    addBoltAt(
      parent,
      [center[0] + Math.cos(a) * radiusPositions, center[1] + Math.sin(a) * radiusPositions, center[2]],
      normal,
      size,
      material,
    );
  }
}

export function roundedRectShape(w, h, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

export function extrudeShape(shape, depth, material, opts = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: opts.bevel !== false,
    bevelSegments: opts.bevelSegments ?? 2,
    bevelSize: opts.bevelSize ?? 1.2,
    bevelThickness: opts.bevelThickness ?? 1.2,
    curveSegments: opts.curveSegments ?? 16,
  });
  geo.translate(0, 0, -depth / 2);
  return mesh(geo, material, opts);
}

export function decal(parent, texture, w, h, position, rotation = [0, 0, 0], opts = {}) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    makeDecalMaterial(texture, opts.roughness ?? 0.62),
  );
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.renderOrder = opts.renderOrder ?? 2;
  m.castShadow = false;
  m.receiveShadow = false;
  if (opts.partId) m.userData.partId = opts.partId;
  parent.add(m);
  return m;
}

export function addHexBoltRing(parent, ringRadius, count, z, material, boltSize, opts = {}) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (opts.phase ?? 0);
    addBoltAt(
      parent,
      [Math.cos(a) * ringRadius, Math.sin(a) * ringRadius, z],
      [0, 0, opts.face ?? 1],
      boltSize,
      material,
    );
  }
}

export function createPulley(radius, width, material, opts = {}) {
  const g = new THREE.Group();
  const grooveMat = opts.grooveMat || material;
  const body = cylinder(radius, radius, width, material, { rotation: [Math.PI / 2, 0, 0], radial: 40, castShadow: true });
  g.add(body);
  for (let i = -1; i <= 1; i++) {
    const groove = cylinder(radius * 1.015, radius * 1.015, width * 0.13, grooveMat, {
      rotation: [Math.PI / 2, 0, 0],
      radial: 40,
      castShadow: false,
      position: [0, 0, i * width * 0.28],
    });
    g.add(groove);
  }
  const hub = cylinder(radius * 0.34, radius * 0.34, width * 1.22, material, {
    rotation: [Math.PI / 2, 0, 0],
    radial: 24,
    castShadow: true,
  });
  g.add(hub);
  if (opts.spokes) {
    for (let i = 0; i < opts.spokes; i++) {
      const a = (i / opts.spokes) * Math.PI * 2;
      const spoke = box(radius * 0.12, radius * 0.9, width * 0.72, material, {
        position: [Math.cos(a) * radius * 0.4, Math.sin(a) * radius * 0.4, 0],
        rotation: [0, 0, a],
        castShadow: false,
      });
      g.add(spoke);
    }
  }
  return g;
}

export function createSpring(radius, length, wireRadius, turns, material, opts = {}) {
  const pts = [];
  const steps = Math.max(32, turns * 14);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * length, Math.sin(a) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.Group();
  const spring = mesh(new THREE.TubeGeometry(curve, steps, wireRadius, 6, false), material, {
    castShadow: opts.castShadow ?? true,
    receiveShadow: true,
  });
  g.add(spring);
  g.userData.spring = spring;
  return g;
}

export function createScrollVolute({
  startRadius = 46,
  endRadius = 83,
  crossStart = 12,
  crossEnd = 26,
  turns = 1.5,
  segments = 54,
  ringSegments = 12,
  material,
  materialDark,
  phase = 0,
}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const totalAngle = turns * Math.PI * 2;
  const pathPoints = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = phase + totalAngle * t;
    const r = startRadius + (endRadius - startRadius) * Math.pow(t, 1.16);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const cr = crossStart + (crossEnd - crossStart) * Math.pow(t, 0.9);
    const tangent = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
    const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const binormal = new THREE.Vector3(0, 0, 1);
    for (let j = 0; j <= ringSegments; j++) {
      const b = (j / ringSegments) * Math.PI * 2;
      const nx = radial.x * Math.cos(b) + binormal.x * Math.sin(b);
      const ny = radial.y * Math.cos(b) + binormal.y * Math.sin(b);
      const nz = binormal.z * Math.sin(b);
      positions.push(x + nx * cr, y + ny * cr, nz * cr);
      normals.push(nx, ny, nz);
      uvs.push(t, j / ringSegments);
    }
    pathPoints.push({ a, r, x, y, cr, tangent, radial });
  }
  const stride = ringSegments + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < ringSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  const outer = mesh(geo, material, { castShadow: true, receiveShadow: true });
  const group = new THREE.Group();
  group.add(outer);
  if (materialDark) {
    const innerGeo = geo.clone();
    innerGeo.scale(0.97, 0.97, 0.97);
    const inner = mesh(innerGeo, materialDark, { castShadow: false, receiveShadow: true });
    inner.material.side = THREE.BackSide;
    group.add(inner);
  }
  group.userData.path = pathPoints;
  return group;
}

export function createGear(radius, width, teeth, material, opts = {}) {
  const g = new THREE.Group();
  const disc = cylinder(radius, radius, width, material, {
    rotation: [Math.PI / 2, 0, 0],
    radial: Math.max(40, teeth * 2),
    castShadow: true,
  });
  g.add(disc);
  const toothWidth = (2 * Math.PI * radius) / teeth * 0.48;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tooth = box(toothWidth, radius * 0.12, width, material, {
      position: [Math.cos(a) * (radius + radius * 0.055), Math.sin(a) * (radius + radius * 0.055), 0],
      rotation: [0, 0, a],
      castShadow: false,
    });
    g.add(tooth);
  }
  return g;
}

export function circularHolesPlate(radius, width, count, material, opts = {}) {
  const g = new THREE.Group();
  const plate = cylinder(radius, radius, width, material, {
    rotation: [Math.PI / 2, 0, 0],
    radial: 48,
    castShadow: opts.castShadow ?? true,
  });
  g.add(plate);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const hole = cylinder(radius * 0.08, radius * 0.08, width * 1.1, opts.holeMat || material, {
      position: [Math.cos(a) * radius * 0.65, Math.sin(a) * radius * 0.65, 0],
      rotation: [Math.PI / 2, 0, 0],
      radial: 12,
      castShadow: false,
    });
    g.add(hole);
  }
  return g;
}

/* ---------------------------------------------------------------------------
   Utility: merge static meshes while preserving selectable component groups.
   Dynamic branches can be excluded with userData.dynamic = true.
--------------------------------------------------------------------------- */
export function mergeStaticMeshes(root, { skip = [] } = {}) {
  const skipSet = new Set(skip);
  const buckets = new Map();
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();

  root.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh) return;
    if (obj.userData.noMerge) return;
    let p = obj;
    while (p && p !== root) {
      if (p.userData.dynamic || skipSet.has(p)) return;
      p = p.parent;
    }
    if (obj.material?.transparent || Array.isArray(obj.material)) return;
    if (!obj.geometry || !obj.geometry.attributes.position) return;
    // Normalise every geometry to a compatible, non-indexed attribute set.
    let geo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    const matrix = new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld);
    geo.applyMatrix4(matrix);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) {
      const count = geo.attributes.position.count;
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    // Drop any exotic attributes so every geometry in a material bucket matches.
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    }
    geo.clearGroups();
    const attrs = Object.keys(geo.attributes).sort().join(',');
    const key = [
      obj.material?.uuid,
      obj.userData.partId || (obj.parent && obj.parent.userData.partId) || '',
      obj.castShadow ? 1 : 0,
      obj.receiveShadow ? 1 : 0,
      obj.renderOrder,
      attrs,
    ].join('|');
    if (!buckets.has(key)) {
      buckets.set(key, {
        material: obj.material,
        items: [],
        sources: [],
        castShadow: obj.castShadow,
        receiveShadow: obj.receiveShadow,
        partId: obj.userData.partId,
      });
    }
    const bucket = buckets.get(key);
    bucket.items.push(geo);
    bucket.sources.push(obj);
  });

  for (const [, bucket] of buckets) {
    if (bucket.items.length < 2) {
      bucket.items.forEach((g) => g.dispose());
      continue;
    }
    // Defensive normalisation: some generated geometries can expose an
    // undefined index property instead of null, which BufferGeometryUtils
    // interprets as an indexed geometry.
    for (let i = 0; i < bucket.items.length; i++) {
      let geo = bucket.items[i];
      if (geo.index === undefined) geo.index = null;
      if (geo.index !== null) {
        const nonIndexed = geo.toNonIndexed();
        geo.dispose();
        geo = nonIndexed;
        bucket.items[i] = geo;
      }
    }
    let merged = null;
    try {
      merged = mergeGeometries(bucket.items, false);
    } catch (e) {
      merged = null;
    }
    if (!merged) {
      bucket.items.forEach((g) => g.dispose());
      continue;
    }
    const m = new THREE.Mesh(merged, bucket.material);
    m.castShadow = bucket.castShadow;
    m.receiveShadow = bucket.receiveShadow;
    if (bucket.partId) m.userData.partId = bucket.partId;
    m.matrixAutoUpdate = false;
    m.frustumCulled = true;
    root.add(m);
    for (const obj of bucket.sources) obj.parent?.remove(obj);
    bucket.items.forEach((g) => g.dispose());
  }
  return root;
}

export function setShadows(object, cast = true, receive = true) {
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

export function clamp(value, min, max) {
  return THREE.MathUtils.clamp(value, min, max);
}
