# PLAN: Duramax Dyno Shop

Source of truth: `PROMPT.md`. This plan breaks its section 9 (order of work) into milestones and
increments. Every increment has its validation criteria written up front. `PROGRESS.md` logs the results.

## Standing validation for every increment (the loop)

| Gate | Command / action | Must show |
|---|---|---|
| T | `npm test` | all unit tests pass (new and old) |
| B | `npm run build` | succeeds, no errors |
| R | `node scripts/check.mjs` (Playwright, headless Chromium, SwiftShader WebGL) | app loads, zero console errors, increment-specific probes pass |
| S | screenshot via `window.__game.shot(name)` / `npm run shots` | opened and compared with the named reference photo |
| A | `ACCURACY.md`, `src/data/truckSpec.js` updated | every new real-world number has source + `confirmed`/`estimated` |

Test hooks: the app exposes `window.__game` (state, camera bookmarks, scripted inputs) so the browser check can
drive keys, doors, the pull and the tune without pixel-clicking.

Architecture rule: **simulation is pure JS with no Three.js imports** (`src/sim/*`), so it is unit-testable in
Node. Rendering reads sim state. All numbers come from `src/data/truckSpec.js`.

`||` marks increments that are independent and may be built in parallel (different files, separate agents).

## M1. Foundation (PROMPT 9.1)

| # | Increment | Validation |
|---|---|---|
| 1.1 | Vite + Three + Vitest scaffold, `truckSpec.js` with sources, `ACCURACY.md`, check/shots harness | T, B; check.mjs loads page with WebGL and reports renderer info; no console errors |
| 1.2 | Renderer, procedural shop env map (PMREM), ACES, post-FX chain (bloom, N8AO, SMAA), quality settings | R: lit test sphere + chrome + paint swatch screenshot; frame time logged |
| 1.3 | Shop shell: 24x18 m, 6 m eave, steel panels, trusses, 2 roll-up doors, polished concrete with joints and stains, LED high bays, office | S: shop wide shot, compare to a real shop feel; no z-fighting |
| 1.4 | Dyno pit and rollers, the dyno room layout (geometry only) | S: pit view |

## M2. Truck exterior (PROMPT 9.2)

| # | Increment | Validation |
|---|---|---|
| 2.1 | Lofted body shell (cab, crew doors, hood, fenders, bed, tailgate) from section curves at spec dimensions | S: side profile vs IMG_2851/2862 (proportions); dimension test (bounding box vs spec) |
| 2.2 | Wheels (16 in polished 8-lug, gold bowtie cap), LT245/75R16E tires with sidewall text, wheel wells | S: close-up vs `06-stock-wheel-tire.jpg` |
| 2.3 | Bumpers, grille, headlamps, fog lamps, taillamps, mirrors, glass with frit, door handles, trim | S: front 3/4 vs IMG_2852/2873, rear vs IMG_2859 |
| 2.4 | Badges and decals (gold bowtie, DURAMAX, 2500 HD, SILVERADO, 4x4) | S: vs 05a-05d |
| 2.5 | Bed interior, tailgate details; underside (frame, IFS, axles, driveshafts, exhaust, tank, fuel filter on driver rail, spare) | S: underside vs 03, IMG_2856 |
| 2.6 | Truck placed on the dyno rollers, straps, chocks, fan, exhaust hose, weather station, control stand | S: hero shot (screenshot 1) |

## M3. Openings and engine bay (PROMPT 9.3)

| # | Increment | Validation |
|---|---|---|
| 3.1 | Interaction system: raycast focus, `E` use, hinge animation with limits; four doors, fuel door, tailgate | R: scripted open/close of each, angle at limit asserted |
| 3.2 | Hood: release handle then secondary latch then lift, spring hinge arms | R: scripted sequence; S vs `04b` |
| 3.3 | LLY engine bay with all labeled parts A to O in the drawn positions | S: engine bay vs diagram and IMG_2874-2877; test: every label present |
| 3.4 | Inspection mode (I) with label data file | R: probe returns names for sampled parts |

## M4. Cab interior and start sequence (PROMPT 9.4)

| # | Increment | Validation |
|---|---|---|
| 4.1 | `sim/startSequence.js` (pure): key positions, wait-to-start, crank, 15 s limit, cool-down, elevated idle | T: unit tests per rule |
| 4.2 | Dash, cluster (canvas gauges, needles), DIC, steering wheel, column, console, center stack, hood release, transfer case | S: gauges vs `01`, `IMG_2867`; dash vs `IMG_2866`, `01b` |
| 4.3 || Seats (tan leather, stitching, perforation), rear bench, door cards, headliner and overhead console, carpet | S: vs `IMG_2869-2871`, `07`, `07b` |
| 4.4 | Driver view, enter with E, key/ignition interaction wired to sim, gauges live | R: key to RUN shows lights; START idles at 680; S screenshot 5 |

## M5. Engine, drivetrain, dyno (PROMPT 9.5) (physics is pure and may run in parallel with M2 to M4)

| # | Increment | Validation |
|---|---|---|
| 5.1 | `sim/engine.js`: calibration-driven torque from fuel, timing, rail, boost, air-limited; stock cal | T: 310 hp @3000, 605 lb-ft @1600 exact at crank; hp = T*rpm/5252; shape; governor |
| 5.2 | `sim/turbo.js`: VGT shaft speed, boost, drive pressure, EGT from vane, exhaust flow | T: closing vanes raises speed, boost, drive pressure, EGT |
| 5.3 | `sim/drivetrain.js`: Allison ratios, converter lockup, 3.73, tire radius, loss | T: wheel numbers in loss range |
| 5.4 | `sim/dyno.js`: rollers with inertia, run state machine, wheel hp/torque from accel, J1349 correction, run history, safety refusals | T: stock whp derived, within real range, run-to-run <1 percent; refused without straps |
| 5.5 | Dyno UI: control stand screen, live graph, peaks, history | S: screenshot 7 |
| 5.6 | Thermal: coolant and transmission temperature, heat soak, REDUCED ENGINE POWER | T: temps rise over pulls |

## M6. AI Live (PROMPT 5A, 9.6)

| # | Increment | Validation |
|---|---|---|
| 6.1 | `sim/calibration.js` + 5 tune calibrations, LBZ regulator model, Allison torque capacity | T: each tune lands at stock whp + gain (with LBZ); stock regulator falls short on rail pressure on higher tunes |
| 6.2 | Breakage model (`sim/failures.js`): trans, head gasket, turbo, piston, with limits in spec | T: each fires only past its limit, never below |
| 6.3 | Flash state machine (`sim/flash.js`): connect, read, backup, write, interruption, no-start | T: backup required; interruption causes no-start; recovery |
| 6.4 | AI Live UI on a laptop screen (3D laptop plus an in-page overlay when focused), tune cards, Turbo Sound page, datalog, compare | S: screenshots 11 and 12 |
| 6.5 | Laptop cart, OBD cable under dash, battery charger, parts shelf LBZ regulator install, repair menu | R: scripted full procedure |

## M7. Player, cameras, audio, UI (PROMPT 9.7)

| # | Increment | Validation |
|---|---|---|
| 7.1 | Walk mode with BVH/simplified collision, crouch, bounds | R: scripted walk reaches every corner of the shop; cannot enter truck body/lift/equipment |
| 7.2 | Driver, dyno, orbit/photo (O, H, P) cameras, camera bookmarks | R: each mode switches |
| 7.3 | Cinematic intro, loading screen, help panel (F1), settings | R: intro plays and skips |
| 7.4 || Procedural audio (engine, turbo from modeled shaft speed, exhaust, starter, fan, rollers, doors, reverb) | T: audio parameter mapping functions are pure and tested; R: AudioContext runs, no errors |

## M8. Shop equipment and performance (PROMPT 9.8)

| # | Increment | Validation |
|---|---|---|
| 8.1 || 2-post lift, toolboxes (drawers open), workbench + vise, tire changer, balancer, compressor with piping, oil drain, shelving with boxes, shop computer, fire extinguishers, roll-up door actions, light switches | S: screenshot 9; inspect labels from data |
| 8.2 | Quality low/medium/high, instancing, shadow caster budget | R: frame time per quality logged |

## M9. Verification, audit, polish (PROMPT 11)

| # | Increment | Validation |
|---|---|---|
| 9.1 | Full section-11 check list script (`scripts/check.mjs --full`) | all green |
| 9.2 | `npm run shots` produces all 12 screenshots | files exist, opened and reviewed |
| 9.3 | Review agent (fresh) vs references; art-director and GM-technician passes; fix list | `PROGRESS.md` |
| 9.4 | README, final `ACCURACY.md`, final report | acceptance checklist all true |

## Parallelism and agents

* Research agent (running early): `docs/research/facts.md` feeds `truckSpec.js`.
* Physics (5.1 to 5.4, 6.1 to 6.3) is pure JS: can be built while visuals proceed. A separate **test agent** writes
  independent tests from the spec text only.
* 4.3 seats, 7.4 audio, 8.1 shop equipment are independent builder-agent jobs once the shop/truck coordinate
  conventions exist (files owned per agent, merged one at a time, rebuilt and re-tested by me).
* **Review agent** at the end of every milestone, fresh context, screenshots vs `reference/`.

## Conventions

* Units: meters in code; the spec keeps inches/lb/hp/lb-ft and exports converters (`in`, `lb`, ...).
* Coordinates: Three.js right-handed, Y up. The truck faces **-Z**, so **+X is the passenger (right) side** and -X is the
  driver (left) side. Truck origin: on the floor, centered between the wheels, at the front axle (Z = 0 at the front
  axle centerline, rear axle at Z = +wheelbase). The shop is centered on the dyno; shop long axis along X.
* Gold bowtie, tan leather, Summit White are tokens in `src/data/materialsSpec.js`.
