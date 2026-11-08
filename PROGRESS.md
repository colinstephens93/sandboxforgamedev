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
