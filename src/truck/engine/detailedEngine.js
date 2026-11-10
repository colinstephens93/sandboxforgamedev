// The detailed LLY long block: block, heads, valve covers, working internals (crank, rods, pistons, cam, valvetrain),
// front drive, manifolds, turbo, intake, EGR and fuel system, with cutaway and exploded views.
//
// The model itself is the engine from the duramaxsimulator repo (github.com/colinstephens93/duramaxsimulator, commit
// f1ff396), copied into ./detailed/ (its README lists the one data correction made here). This file fits it into the truck: that model is in millimetres with the
// crankshaft on the origin and its front toward +Z; the engine bay is in inches with the front toward -Z.
import * as THREE from 'three';
import { createMaterials } from './detailed/utils.js';
import { buildEngine } from './detailed/engines/families/v8-ohv.js';
import entry from './detailed/engines/lly/index.js';
import { CORE_LABEL } from './detailedLabels.js';

const MM_PER_IN = 25.4;
const SHADOW_MIN_RADIUS_MM = 90;

// crank: { x, y, s } of the crankshaft centreline at the engine's mid-length, in bay inches.
export function buildDetailedEngine({ crank }) {
  const model = buildEngine(createMaterials(), entry);
  const root = model.root; root.name = 'engine_core';
  root.scale.setScalar(1 / MM_PER_IN); root.rotation.y = Math.PI; root.position.set(crank.x, crank.y, crank.s);
  // Draw-call merging (src/truck/optimize.js) may merge across parts, but not across anything that moves or hides on
  // its own: the assemblies slide apart in the exploded view, and some cover and exhaust details hide in the cutaway.
  for (const g of model.assemblies.values()) g.userData.dynamic = true;
  for (const o of [...(model.coverDetailMeshes || []), ...(model.exhaustDetailMeshes || []), ...(model.shellMeshes || [])]) o.userData.noMerge = true;
  for (const [id, groups] of model.parts) for (const g of groups) g.userData.labelId = CORE_LABEL(id);
  // Shadows: only the large castings and housings cast them. The shadow pass redraws every caster, and the small
  // hardware (lines, clips, bolts, sensors) adds draw calls there without a shadow anyone could pick out.
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.castShadow = o.geometry.boundingSphere.radius > SHADOW_MIN_RADIUS_MM; o.receiveShadow = true;
  });
  let crankDeg = 0, t = 0;
  // In the truck the sump is the underside module's own (it is shaped around the front axle and crossmember); this model's
  // deeper test-stand sump would hang below them, so it is only shown when the engine is looked at on its own.
  const pan = model.assemblies.get('oil-pan'); let standalone = false;
  const frame = { crankAngleDeg: 0, runTime: 0, rpm: 0, timeScale: 1, fuel: 0, glow: 0 };
  // st: { rpm, running }. The crank angle is integrated here; everything that turns follows it.
  const update = (dt, st = {}) => {
    const rpm = st.running ? st.rpm || 0 : 0;
    t += dt; crankDeg = (crankDeg + rpm * 6 * dt) % 720;
    frame.crankAngleDeg = crankDeg; frame.runTime = t; frame.rpm = rpm; frame.fuel = st.running ? 1 : 0; frame.glow = st.glow || 0;
    model.update(dt, frame);
    if (pan) pan.visible = standalone || model.explodeTarget > 0 || model.explodeAmount > 0.02;
    // combustion flashes and injection sprays sit inside the heads: only worth drawing while the castings are cut away
    const show = !!model.internalVisibility;
    for (const f of model.combustionFlashes) { f.sprite.visible = show; f.cone.visible = show; }
  };
  update(0); // settle visibility: the internals stay hidden until the castings are cut away
  return {
    group: root, model, update,
    get standalone() { return standalone; }, set standalone(v) { standalone = !!v; },
    setCutaway: (on) => model.setCutaway(on), setExploded: (on) => model.setExploded(on),
    get cutaway() { return model.cutawayTarget > 0; }, get exploded() { return model.explodeTarget > 0; },
    get busy() { return model.cutawayAmount !== model.cutawayTarget || model.explodeAmount !== model.explodeTarget; },
  };
}
