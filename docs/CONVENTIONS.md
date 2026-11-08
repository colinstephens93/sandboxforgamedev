# Conventions for every module (read before writing code)

## World
* Three.js, right-handed, Y up, **1 unit = 1 meter**. Floor is y = 0.
* Shop frame: X along the 24 m length (x in [-12, 12]), Z along the 18 m width (z in [-9, 9]).
  The two roll-up doors are on the **north wall (z = -9)** at x = -3 and x = +3. The truck faces -Z, toward them.
* Truck local frame: origin on the floor at the front axle centerline, truck faces **-Z**, **+X = passenger side**,
  rear axle at z = +3.886 m. Its group is placed in the shop at DYNO.truckOrigin (src/shop/layout.js).
* Layout constants and named equipment zones: `src/shop/layout.js`. Stay inside your zone.
* Real-world numbers come from `src/data/truckSpec.js` (helpers IN, LB, ... exported). No magic numbers for anything
  real. Design-only numbers (shop equipment sizes) can live in your module with a short comment.

## Appearance
* Everything is generated in code: no downloaded textures, HDRIs or models, no images in the repo (npm packages only).
  Textures: `src/core/proc.js` helpers (canvas + noise + height-to-normal). Materials: `src/core/materials.js`.
* PBR throughout (MeshStandard/MeshPhysical), real thickness, rounded edges (`roundedBoxGeometry` in `src/core/geom.js`),
  no floating parts, no z-fighting, no stretched textures (use `metricBox`/`metricPlane` UVs in meters).
* Repeated parts use InstancedMesh. Keep draw calls modest. Only the shop's key lights cast shadows: set
  `castShadow = true` only on large objects; `receiveShadow = true` everywhere reasonable.
* Honor `quality` (see `src/core/quality.js`): texture sizes come from `quality.tex`.

## Inspection labels and interaction (set data on Object3D.userData)
* `obj.userData.labelId = 'shop.compressor'`, resolved through `src/data/labels/index.js`
  (your module's own file `src/data/labels/<prefix>.js`: `{ name, desc }`). Put it on the group or mesh that a
  player would point at; raycasts walk up parents to find the nearest labelId.
* `obj.userData.interact = { prompt: 'Open drawer', run(ctx) { ... } }` makes an object usable with E.
  `ctx` provides: `ctx.shop` (the object returned by buildShop: setLights, setDoor, doors), `ctx.say(text)` for the
  message line, `ctx.state` (a plain object for flags). `run` may start animations by registering
  `ctx.animate(fn)` where fn(dt) returns true when finished.
* Colliders: return an array of THREE.Box3 (world/shop frame) for every solid object; the player is a 0.35 m radius
  capsule that cannot enter them. Keep them tight and few (one box per cabinet, not per shelf).

## Module shape
* A builder exports `buildX({ quality, shop })` returning `{ group, colliders, update?(dt, state) }` with all
  Object3Ds added under `group` in the shop frame (or truck frame for truck parts).
* Pure simulation code lives in `src/sim/` and must not import three or touch the DOM so it can be unit-tested.

## Process
* Tests: `npm test` (vitest, tests/*.test.js). Build: `npm run build`. Both must pass.
* Visual check: `node scripts/shot.mjs <name> "<cam x,y,z>" "<target x,y,z>" [fov] [quality] [W] [H]`
  writes `.dev/<name>.png` (software WebGL is slow: use quality `low` or `medium`; first load takes seconds).
  `node scripts/probe.mjs low 60` prints console errors. The app exposes `window.__game` for scripted checks.
* Open each screenshot and judge it: demanding art director, then a technician who knows the real object.
* Own only your files. Do not edit files you do not own; tell the integrator what hooks you need.
