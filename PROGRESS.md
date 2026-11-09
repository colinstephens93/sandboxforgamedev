# PROGRESS

Running log: each increment's result, the checks run, the screenshots taken, and any problem left open.

## 1.1 Scaffold (in progress)
* Vite 8 + Three 0.187 + Vitest 5 + postprocessing + N8AO + three-mesh-bvh installed.
* `src/data/truckSpec.js` first version with sources; `tests/spec.test.js` enforces the tag-comment rule. 3/3 tests pass.
* Research agent produced `docs/research/facts.md` (search-summary based, see ACCURACY.md).

## 1.1 to 1.3 Foundation: done
* Vite + Three + Vitest scaffold, `truckSpec.js` with source and `confirmed`/`estimated` tags (enforced by a test), `ACCURACY.md`, `PLAN.md`.
* Renderer with HalfFloat composer: SSAO (postprocessing; N8AO was incompatible with Three 0.187), subtle bloom, ACES filmic tone mapping, SMAA, three quality presets.
* Shop shell: 24 x 18 m, 6 m eave, gable roof, steel frames, ribbed panel walls with wainscot, two animated roll-up doors, polished concrete with control joints and oil stains, LED high bays, office shell, outside world. Shot `.dev/shop4.png` reviewed (looks like a real shop; the exterior trees/blobs and the office are placeholders to polish).
* Env map baked from the shop itself (PMREM from a cube camera).

## M5 early: simulation (pure JS, tested) done ahead of the visuals
* `src/sim/engine.js`: torque computed from fuel quantity, timing, rail pressure (CP3 + LLY/LBZ regulator), air from a lumped GT3788VA VGT model, smoke limiter, torque limiter, governor. No torque curve is read from a table.
* `scripts/fit.mjs` solves the stock fuel and vane feed-forward tables against the published 310 hp @ 3,000 and 605 lb-ft @ 1,600, then solves each of the five tune fuel tables so the MEASURED dyno peak equals stock whp + the owner's gain. Results (LBZ regulator): stock 251.8 whp (18.6 percent loss), Heavy Tow +29.8, Light Tow +59.9, Economy +120.0, Street +175.4, Race +230.1. With the stock LLY regulator Street falls about 13 whp short and Race about 30 whp short, rail error 1,400 and 2,800 psi; the three lower tunes are unaffected.
* `src/sim/driveline.js`: converter + lockup + Allison clutch packs (stick/slip), 3.73 axle, rollers with inertia; `src/sim/dyno.js` measures power from roller acceleration plus a coast-down parasitic correction; SAE correction (ISO 1585 / UN R85 CI form); run history; refusal without straps or with hood closed and fan off.
* `src/sim/failures.js`: transmission, head gasket, turbo, piston limits from the spec. Stock and the tow tunes survive 12 consecutive pulls; 20 consecutive Race pulls burn the Allison (heat soak lowers clutch capacity, slip energy accumulates).
* `src/sim/startSequence.js`: key positions, Wait to Start, 15 s crank limit and 1 minute cool-down, elevated idle.
* 46 unit tests pass.
* Open: transmission slip makes a run dramatic (flare); idle turbo speed baseline low (18k rpm open vane); thermal numbers (coolant creeps only about 5 F per Race pull) need a look when the UI exists.

## Integration log
* Audio (7.4) merged: 42 + 14 unit tests, `scripts/audioCheck.mjs` 95/95 offline spectral checks (idle firing 45.3 Hz, whistle tracks modeled turbo rpm). Unheard: needs an ear pass. Wired into `Game.updateAudio`.
* Shop equipment (8.1) merged: lift, 3 tool chests with 22 openable drawers, bench, tire area, compressor with piping and 3 drops, shelving with the LBZ regulator slot, office furniture, extinguishers, door and light switches. 133 tests, build, 15/15 browser checks pass. Shot `.dev/shopeq.png` reviewed: reads as a working diesel shop. Open: the empty dyno pit shows as a pale patch until the dyno hardware merges; a few wall-hugging items sit just outside their zone rectangles but clear of the truck.
* Pending merges: wheels, dyno hardware, underside, bed/tailgate/badges, engine bay, interior/cluster, dyno + AI Live + shop-menu UI.

## Finishing pass (docs/DEEPSEEK_PROMPT.md, branch claude/youthful-rubin-gg2uno)

### Environment (Windows desktop, 2026-11-08)
* Node 24.16.0, npm 12.0.2, Blender 5.2.3. Playwright 1.65 with Chrome for Testing 158 downloaded by
  `npm run setup:browser`.
* `npm install` had to be run with the npm cache redirected into the workspace and every Node tool (vitest,
  vite, Playwright) had to run outside the harness file sandbox: on Windows those tools spawn helper processes
  with piped stdio, which the sandbox rejects with `spawn EPERM`. Nothing about the repo caused it.
* `tests/interior.test.js` failed on Windows before any change: it built its `src/truck/interior` path from
  `new URL(import.meta.url).pathname`, which yields `C:\C:\Users\...` on Windows. Fixed with `fileURLToPath`
  (a portability fix, not a weakened test). Baseline then: **276 unit tests pass, `npm run build` succeeds,
  `GPU=1 node scripts/check.mjs` 29/29 passed.**

### Task A: Blender measurement overlay (done)
* `tools/blender/exportProfile.mjs` imports `src/truck/skin.js` and writes `.dev/profile.json`: the closed side
  silhouette, the hood/roof/beltline/bed-rail/bumper lines, wheel centres and radii, the `ST` stations and the
  ten report features, in meters in the truck frame. It self-checks the outline against the spec envelope:
  **bbox 237.30 x 77.00 in = the spec exactly**.
* `tools/blender/overlay.py` runs headless in Blender 5.2 (`blender --background --python ...`, bpy + numpy
  only), reads the profile, calibrates each photo from the two wheel hubs (4.3007 px/in for IMG_2862,
  4.1765 px/in for IMG_2851), anchors the vertical scale on the roof line, draws the outline at about 50
  percent over the photo plus the wheels, the measured stations and a length-matched cyan copy, and writes
  `.dev/overlay_IMG_2862.png`, `.dev/overlay_IMG_2851.png` and `.dev/overlay_report.md`.
* **The composites were opened and looked at**, twice: the calibration lines the cab, roof, doors, bed and
  wheel centres onto the photo within a few pixels; the magenta nose and rear bumper fall outside the photo's
  truck by 7.3 in and 4-9 in.
* Findings (report table, inches from the front axle, photo minus game; flag > 1.5 in):
  * nose **+7.3** (IMG_2862) / **+7.6** (IMG_2851), rear bumper **-9.3** / **-4.3**, bed rail end **-2.9**,
    tailgate end **-4.0**: at this calibration the photo truck's bumper-to-bumper span is **220.7 / 225.3 in**
    against the published **237.3 in**. That is a source conflict, not a modelling error: the game keeps the
    published envelope, so the two ends cannot both match the photos. Recorded in `ACCURACY.md`.
  * cab back **+0.3**, bed front **+0.3**, roof rear **-0.9**, roof front **+1.3**, windshield base -2.5/+2.3:
    the cab and bed are right. No action.
  * the traced top silhouette is **up to 3.0-3.8 in higher than the game's hood line at the front of the hood**
    (s about -30): the game's nose droops, which is the known "rounded, bulbous nose". Fixed in Task B.
  * vertical residual (game ground line against the photo's tyre contact patch): **-0.03 in** and **+0.10 in**,
    so the roof-anchored vertical scale is sound.
* Open: IMG_2851's roof-front crossing is not measurable (dark trees behind the truck); the rear bumper scan in
  IMG_2862 is partly occluded by the truck parked beside it (+-2 in).
