# PROGRESS

Running log: each increment's result, the checks run, the screenshots taken, and any problem left open.


## Phase 1.1–1.2 (2026-11-09): odometer fix and placeholder cleanup

## Phase 2.1 (2026-11-09): front fascia and headlamp refinement

## Phase 2.2 (2026-11-09): engine bay density

## Phase 2.3 (2026-11-09): cab interior detail and stronger PBR
* Summit White paint: lower base roughness, tighter clearcoat roughness, higher env intensity and stronger orange-peel normal.
* Chrome and tinted glass materials strengthened (lower roughness, higher env response, slight transmission on glass).
* Scene environmentIntensity raised from 0.5 to 0.7 so reflections read more clearly on paint, chrome and glass.
* Interior leather roughness slightly reduced for better grain response. Seat stitching and perforated inserts already present.
* All 276 tests and `npm run build` pass.
* Added extra visible loom runs (driver-side apron harness, passenger-side sensor loom) and additional hose/charge-pipe segments in `src/truck/engine/bits.js`.
* Existing hood insulation pad (embossed, dusty normal map, clips) and spring-loaded hinge arms remain; the new plumbing reduces empty regions seen from the open-hood camera.
* All 276 tests and `npm run build` pass. Further density (more clamps, specific intercooler pipe routing) can be added against the LLY reference photos if needed.
* Headlamp lenses: switched to higher transmission (0.92) MeshPhysicalMaterial with lower roughness and higher env intensity so they no longer read as opaque white boxes.
* Deepened main and turn housings slightly and made the clear lenses stand prouder of the housing.
* Amber section transmission improved. All 276 tests and `npm run build` still pass.
* Next visual targets remain denser grille edge definition and full engine-bay density (Phase 2.2).
* Fixed plant.js odometer initialization (was zeroed by `* 0`). Now starts at 145,000 mi (estimated) and accumulates from tire linear speed (`wheelSpeed() * TIRE_R`).
* Wired `odometerMi` and `engineHours` into the cab cluster update so the DIC shows live values.
* Cleaned placeholder “XXXX” text on the engine cover and VIN sticker area (replaced with plausible non-serial format).
* All 276 unit tests still pass. Logged in ACCURACY.md.
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

### Task B: proportion fixes in code (done)
Acted only where Task A measured a real error or the screenshots showed a real defect.
* **Nose / hood.** `hoodHeight` raised and flattened (leading edge 47.6 -> 50.8 in, cowl 54.4 unchanged, so the
  rise is 3.6 in instead of 6.8) and the hood's edge roll cut from 2.7 to 0.85 in. The traced side silhouette
  now tracks the photo within about 1 in at the nose (was 3.0-3.8 in low). The grille surround, upper grille and
  headlamps moved up with it (grille top 45.6 -> 49.0, lamps taller), so the hood and the grille meet at the
  shut line as in IMG_2853.
* **Fender-to-hood seam.** The fender's shoulder blend shortened from 9.5 to 5.5 in and its top edge raised to
  0.3 in below the hood skin, so the shut line reads as a line instead of a soft roll.
* **A-pillar and C-pillar.** The body had no outer pillar faces at all: the windshield stopped about 10 in
  inboard of the body side and the skin left an open wedge into the cab (the "thin tubes" and the see-through
  roof edge). Added ruled pillar faces (`buildPillarGeometry` in body.js, `WS`/`RG` glass outlines shared with
  the glass in index.js) between the glass edges and the body side, and widened the glass to 62.8/54.4 in
  (windshield) and 61.2/56.4 in (back glass) so the pillars are 3.5-8 in wide, not 10-12.
* Not changed: the axial positions of the nose / rear bumper (the overall-length conflict above; the spec
  envelope wins) and the seats and cluster bezel (documented as simplified, no measurement to fix them
  against).
* Checks after the change: `npm test` **276/276**, `npm run build` ok, `GPU=1 node scripts/check.mjs`
  **29/29**. The Blender overlay was re-run: the outline is still exactly 237.30 x 77.00 in.

### Task C: verification scripts and the cheap defects (done)
* `scripts/check.mjs` extended from 29 to **46 checks**, all passing (`GPU=1 node scripts/check.mjs`
  -> `46/46 passed`). New checks:
  * every quick tune is written through the full AI Live procedure and lands at stock + its owner gain:
    Heavy Tow +29.7, Light Tow +60.1, Economy +119.7, Street +175.3, Race +229.9 whp; the six calibrations
    form an increasing ladder 252 < 282 < 312 < 372 < 427 < 482 whp.
  * closing the Turbo Sound vanes at idle raises turbo speed 17,741 -> 38,042 rpm (+114 percent), exhaust gas
    temperature 327 -> 348 F and the vane position 0.40 -> 0.79, all through the engine model.
  * vanes held closed at full load overspeed the turbo (152,789 rpm peak) and the failure model reports the
    turbo as damaged.
  * repeated Race pulls burn the stock Allison: 28 pulls, 259 kJ of clutch slip energy,
    "ALLISON CLUTCHES BURNED".
  * walk mode reaches the walkable area at all four shop corners (the office and the equipment own parts of
    the corners, so the check finds the free point nearest each corner and walks to it from a nearby free
    start), and **47 of 48 solid colliders block the player**.
  * the AI Live cable refuses to plug in through a closed driver door.
  * the rear lamps follow the brake pedal and reverse (the `lamps.set` wiring below) and the driver view sits
    at the cab eye point.
* Bugs the new checks found and fixed (not by weakening the checks):
  * **Driver mode threw on its first frame**: `this.eyeWorld` and `this.drv` were never initialised, so
    `V` (sit in the truck) crashed. The eye is now taken from the interior's `anchors.eye` (truck frame
    -16, 56, 66 in) transformed by the truck's placement; verified at (-0.41, 1.39, 0.90) in the shop.
  * `lamps.set()` was never called: the tail, brake and reverse lamps are now wired to the key position, the
    brake pedal and the shifter range in `Game.update`.
  * the AI Live cable clipped through a closed driver door; plugging it in now requires the door open (as it
    does in reality, since the OBD-II port is under the left of the dash), and the charger leads arc over the
    fender/hood line (`leadRoute` gained a `via` control point) instead of through the bodywork.
* `scripts/perf.mjs` added: measures the real per-frame cost (update + render with `gl.finish()`, 45 frames
  after a warm-up) at 1920 x 1080 for low / medium / high, prints average and 95th percentile and writes
  `.dev/perf.json`. **Headless Chromium on this machine has no GPU** (it falls back to SwiftShader), so the
  frame times below were measured with `HEADED=1 GPU=1` on the real GPU, an Intel Arc 140V (8 GB):
  see the table in the milestone summary at the end of this file.
* Open: headless WebGL cannot reach the GPU here, so `GPU=1` in the headless scripts still runs software
  rendering; the browser checks therefore run at 1280 x 720 low/medium and take longer than they would on a
  GPU. `check.mjs` passes in that mode (46/46).

### Task D: the 12 screenshots (done, reviewed, imperfect)
`HEADED=1 GPU=1 SHOTS_QUALITY=high node scripts/shots.mjs` at 1920 x 1080. All 12 exist in `screenshots/` and
were retaken after Task B and the Task C/D fixes:
`01-hero`, `02-side-profile`, `03-rear-tailgate-down`, `04-engine-bay`, `05-driver-dash`, `06-open-door`,
`07-dyno-run`, `08-pit-underside`, `09-shop-wide`, `10-wheel-badge`, `11-ailive-write`, `12-compare-baseline-vs-tune`.

Shot defects found and fixed while reviewing them (the presets were broken, not just the framing):
* the engine-bay preset set the hood's `target` but never ran the release sequence or the hinge animation, so
  shot 04 showed a closed hood from above. `Game.prepare` now sets both releases and calls `HingeDoor.toggle`,
  which is what actually animates.
* the door preset did the same, so shot 06 showed the truck with every door shut. Same fix.
* shot 12 opened the AI Live panel on CONNECT: `panelsReg.ailive` is a wrapper without `go()`. It now uses
  `uiPanels.ailive.go('compare')`, and the preset clears a half-finished flash state first (the previous shot
  leaves one behind, which showed "WRITE FAILED" instead of the comparison).
* the hero shot was filled by the cooling fan: the `fanAside` preset now rolls the fan 6.2 m aside and 0.8 m
  forward (a wheeled fan), and the hero/side/rear/door/pit/AI Live cameras were re-aimed.
* the chrome/glass read flat: `scene.environmentIntensity` was 0.28 (the shop PMREM barely showed in the
  paint); it is now 0.5, the tinted glass is darker (opacity 0.72, colour 0x0a1513) and the headliner is 0.4 in
  narrower so its edge no longer shows between the roof and the door headers at the top of the glass.

**Review 1, demanding art director** (problems found; the shots above are the state after the fixes):
* hero: composed well now, but the front fascia is a plain white slab, the headlamp lenses read as white boxes
  with a milky face, and the paint still has little reflection variation over the big flat surfaces.
* side: proportions and stance now track the reference photo, the glass reads as dark tint, but the roof still
  reads as a cap sitting on thin pillars, and the bed rail cap is a heavy black band.
* rear: the dropped tailgate and the bed read, the straps are visible, but the tailgate's inner face is almost
  black and the rear bumper is a thin chrome line.
* engine bay: the open hood, the 6.6 cover, both batteries, the surge tank, the air box, the fan shroud and the
  cowl read; the bay is much emptier and cleaner than the LLY reference photos and the hood pad is a plain
  surface with no hinge arms visible.
* driver: the cluster (0-120 mph, 0-5 x1000 tach with the red zone, coolant, trans, oil, volts), the DIC
  odometer, the steering wheel with switches, the center stack and the transfer-case switch read well; the dash
  top is a flat tan expanse and the glass tint over the view out is subtle.
* open door: the tan door card (armrest, switch panel, speaker grille, map pocket), the jamb, the placard and
  the cab interior read; the switches themselves are simplified.
* dyno screen: strong. Graph, peaks (251.9 whp at 3,000, 491 lb-ft at 1,675), SAE 0.997, gear, straps, fan,
  history and weather all read.
* pit: the underside, the spare's sidewall lettering, the axle and the rollers read, but the roller/absorber
  assembly dominates the lower half and the frame is dark.
* shop wide: reads as a working diesel shop (lift, reels, dyno with the control stand, shelving, office).
  Weak: plain walls, a very clean floor, and the outside world through the doors is placeholder geometry.
* wheel: strong. MICHELIN LTX M/S2, LT245/75R16, the 8-lug polished wheel, the gold bowtie cap, the rotor and
  caliper behind it.
* AI Live: the laptop shows WRITING STREET with a progress bar and a countdown and the cable runs off the cart;
  the cable's last run to the dash is partly hidden behind the cart.
* compare: strong. Stock 251.9 whp / 491 lb-ft against Race 481.2 whp / 881 lb-ft, +229.3 whp and +390 lb-ft,
  with the per-run table (regulator, vane, max EGT, boost, rail error).

**Review 2, a technician who owns a 2005 Duramax** (checked against `reference/` and `src/data/truckSpec.js`):
* cluster faces, scales and warning lamps match `01-dash-cluster-lit` and the DIC shows the odometer; the
  transmission temperature band (100-300 F) and the 265 F hot lamp match the diesel supplement.
* badges: gold bowtie in the grille and on the wheel caps, DURAMAX and 2500 HD on the front doors, 4x4 on the
  bed sides, SILVERADO on the tailgate with no CHEVROLET lettering, no Z71. Correct for the configuration.
* the two batteries (one per side), the coolant surge tank, the air cleaner, the remote terminals, the fan
  shroud and the 6.6 cover match the engine-compartment diagram's arrangement; the hood is held by its spring
  hinges with no prop rod, as the handbook says.
* the tailgate drops to horizontal on its cables; the tire lettering, size and 8-lug pattern match
  `06-stock-wheel-tire.jpg`.
* deviations that remain: the overall-length conflict in `ACCURACY.md` (the photos measure 220.7/225.3 in
  against the published 237.3 in, so the nose and rear bumper are longer than the photo truck), the front
  fascia and headlamps are simplified, the seats and cluster bezel are simplified (as handed over), and the
  bed rail caps/liner are plain. Nothing was found that contradicts `truckSpec.js`.
* the visual review above was done by the model on the rendered images; a human eye on the paint, the audio and
  the overall feel is still owed.

### Frame times (Task C), real GPU
`HEADED=1 GPU=1 node scripts/perf.mjs`, 1920 x 1080, 45 frames each after a warm-up; per-frame cost is
update + render with `gl.finish()`, so it includes the GPU. GPU: Intel Arc 140V (8 GB), D3D11. (Headless
Chromium on this machine falls back to SwiftShader, hence `HEADED=1`.)

| Quality | Average | p50 | p95 | Max | Average fps |
|---|---:|---:|---:|---:|---:|
| low | 9.07 ms | 9.50 ms | 11.70 ms | 12.00 ms | 110.3 |
| medium | 13.73 ms | 13.60 ms | 17.90 ms | 21.30 ms | 72.8 |
| high | 18.85 ms | 19.70 ms | 26.80 ms | 31.20 ms | 53.1 |

High quality at 1080p averages **18.85 ms (53 fps)** on this integrated GPU, not a locked 60. The 95th
percentile is 26.8 ms. Low and medium are comfortably above 60 fps. Before the finishing pass the same
machine measured 20.6 ms at high; the small gain came from the narrower headliner and the glass, not from any
quality reduction. No quality setting was lowered to make the number look better.

## Acceptance checklist (PROMPT.md) with the evidence

| # | Item | State | Evidence |
|---|---|:--:|---|
| 1 | `src/data/truckSpec.js` holds every real-world number with a source and confidence tag | yes | `tests/spec.test.js` (3 tests) enforces a tag comment on every leaf; 276/276 tests pass |
| 2 | 2005 GMT800 Classic crew cab at correct dimensions, Summit White, real reflections | yes | overlay outline bbox 237.30 x 77.00 in = the spec; `02-side-profile`, `01-hero`; env intensity 0.5 |
| 3 | Correct wheels, tires, glass, badging and underside for the configuration | yes | `10-wheel-badge` (LT245/75R16E, 8-lug, gold cap), `08-pit-underside`, badges checked in review 2 |
| 4 | Four doors, tailgate, hood and fuel door open on real hinges with real limits | yes | `check.mjs`: 4 doors to 72/78 deg, hood sequence refusals, tailgate, fuel door; `06-open-door` |
| 5 | Year-correct LLY engine bay with labeled components | yes | `04-engine-bay`; engine-bay label tests; the A-O parts follow the supplement diagram (see ACCURACY.md) |
| 6 | Walkable LT cab with live, accurate gauges | yes | `05-driver-dash`; cluster tests; driver view check at (-0.41, 1.39, 0.90) |
| 7 | Real diesel start sequence with the glow plug wait | yes | `check.mjs`: key RUN lights WTS, engine starts at 680 rpm; start-sequence unit tests |
| 8 | Physically modelled dyno pull with wheel hp and torque, SAE correction, run history | yes | `07-dyno-run`: 251.9 whp, 491 lb-ft, SAE 0.997; sim tests |
| 9 | Stock dyno results in the real stock LLY range, derived not hard-coded | yes | 251.9 whp from the physics; `tests/sim.test.js` (310 hp / 605 lb-ft at the crank) |
| 10 | AI Live: read, backup, write with real failure on interruption, quick tunes, datalog, comparison | yes | `check.mjs` (backup required, interrupted write no-start, recovery, five tunes at their gains); `12-compare` |
| 11 | Turbo Sound vane adjustment changes whistle/hiss through the modeled turbo, with real costs | yes | `check.mjs`: turbo 17.7k -> 38.0k rpm, EGT +21 F; overspeed failure at full load |
| 12 | Tuned results and breakage limits derived from sourced data, estimates in `ACCURACY.md` | yes | `12-compare` gains; `check.mjs` transmission burn; ACCURACY.md |
| 13 | Complete, inspectable shop with solid collision | yes | `09-shop-wide`; 47/48 colliders block the player; four corner walks |
| 14 | Walk, driver, dyno and photo camera modes; intro; help panel; UI hiding; PNG capture | yes | `check.mjs` intro + walk; driver view fixed and checked; `V`/`C`/`O`/`H`/`P` paths in game.js |
| 15 | Procedural engine, turbo, fan and roller sound | yes (unheard) | `scripts/audioCheck.mjs` 95/95 spectral checks, 56 audio unit tests; **never listened to by a person** |
| 16 | Smooth performance with a quality setting, no console errors | yes, with a caveat | frame table above (high 53 fps on the Intel Arc 140V); `check.mjs` no console errors |
| 17 | Passing unit tests for the engine and dyno math | yes | 276/276 |
| 18 | README, `ACCURACY.md` and the `npm run shots` script | yes | README updated; ACCURACY.md; `scripts/shots.mjs` |
| 19 | All 12 screenshots saved, art-reviewed and accuracy-audited | yes | `screenshots/` 12 files; both reviews above |

## What is still owed or imperfect
* **A human ear on the audio.** Levels were set from spectra (95/95 offline checks, 56 unit tests) and were
  never listened to; this is the largest unverified area. To make that pass possible without a live session,
  `node scripts/audioCheck.mjs --save` now has documented output: it renders the real `AudioEngine` through an
  `OfflineAudioContext` and wrote 17 listenable WAVs to `.dev/audio/` (idle cold/warm, cab, WOT with and
  without the vanes closed, intake hiss, fan-only beds, rollers, the start sequence, the one-shots). They are
  git-ignored build output; regenerate them with the command above. 95/95 checks passed on the run that made
  them.
* **A human eye on the art.** The two reviews above were done by the model on the renders. The paint, the
  lighting and the overall feel have not been judged by a person.
* The overall-length conflict between the photos and the published 237.3 in (`ACCURACY.md`): unresolved by
  decision.
* High quality averages 53 fps at 1080p on the measured integrated GPU rather than a locked 60.
* The front fascia, headlamps, seats, cluster bezel and the outside world are simplified; the engine bay is
  cleaner and emptier than the reference photos.
* Headless Chromium has no GPU on this machine. The checks and shots therefore either run software rendering
  (`GPU=1` headless) or need `HEADED=1` for the real GPU (the shots and the frame times).

## Final report
See the last message of the finishing session; the same text is kept here.

The project is a single-page Three.js app. `npm install && npm run dev` serves it at http://127.0.0.1:5173
(`docs/DEEPSEEK_PROMPT.md` section 3). Controls: WASD/Shift/Ctrl walk, E use, I inspect, T dyno panel, L AI
Live, M shop menu, V driver, C dyno camera, O orbit/photo, F1 help, Q quality, H hide UI, P save PNG.
Architecture and the physics are described in `README.md`; the shipping tree is
`src/data` (spec, labels), `src/sim` (pure physics), `src/truck` (body, front, rear, underside, interior,
engine bay), `src/shop` (shell, equipment, dyno hardware, AI Live rig), `src/game`, `src/ui`, `src/audio`,
`tests`, `scripts`, `tools/blender`.

Checks: `npm test` 276/276, `npm run build` ok, `GPU=1 node scripts/check.mjs` 46/46, `HEADED=1 GPU=1 node
scripts/perf.mjs` frame table above.

## Final report (also the closing message of the finishing session)

### What was built
The **Duramax Dyno Shop**: one runnable Three.js/WebGL browser app of a factory-stock 2005 Chevrolet
Silverado 2500HD LT Crew Cab (Summit White, 6.6 L Duramax LLY, Allison 1000, 4WD, 6.5 ft box) strapped to an
in-ground chassis dynamometer in a 24 x 18 m diesel performance shop, with the original AI Live laptop tuning
app. Everything (models, textures, sound) is generated in code.

Walk the shop; open all four doors, the tailgate, the hood (cab release, secondary latch, spring hinges) and the
fuel door; inspect every part (I); sit in the cab; start the diesel with the real glow-plug procedure; run the
truck on the dyno and read wheel hp/lb-ft with SAE correction and a run history; plug AI Live in, read, back up
and write any of the five owner tunes plus stock; adjust the VGT vanes on the Turbo Sound page and hear the
turbo follow the modeled shaft speed; abuse it until the Allison, the head gaskets, the turbo or the pistons
fail, and repair them from the shop menu.

### Controls
W A S D, Shift (run), Ctrl (crouch), mouse look (click to lock, Esc to release); E use (openings, drawers,
roll-up doors, sit, key); I inspection mode; T dyno panel; L AI Live; M shop menu; V driver view; C dyno camera
while running; O orbit/photo mode; F1 help; Q quality (low/medium/high); H hide UI; P save a PNG; any key skips
the intro.

### File structure
`src/data/truckSpec.js` (every real-world number with a source and a `confirmed`/`estimated` tag) and
`src/data/labels/`; `src/sim/` pure physics (engine, turbo, driveline, plant, dyno, atmos, failures,
calibrations + `src/data/calFit.js`, startSequence, flash); `src/core/` (renderer and post-processing,
procedural textures, materials, shop environment map, quality); `src/shop/` (shell, layout, equipment, dyno
hardware, AI Live rig); `src/truck/` (parametric skin and panels, body, front end, wheels, rear, interior,
engine bay, underside); `src/game/` (loop, input, player and collision, interaction, openings, cameras,
bookmarks); `src/ui/` (dyno panel and graph, AI Live app, shop menu); `src/audio/`; `tests/`; `scripts/`;
`tools/blender/`.

### The screenshots
`screenshots/01-hero.png`, `02-side-profile.png`, `03-rear-tailgate-down.png`, `04-engine-bay.png`,
`05-driver-dash.png`, `06-open-door.png`, `07-dyno-run.png`, `08-pit-underside.png`, `09-shop-wide.png`,
`10-wheel-badge.png`, `11-ailive-write.png`, `12-compare-baseline-vs-tune.png` — all 1920 x 1080, all retaken
after the proportion work, each judged twice (art director and Duramax technician); the problem lists are above.

### ACCURACY.md, in short (the file has the full text)
* Conflicts: LLY compression ratio 17.5:1; governed rpm 3,200 (PROMPT.md wins); Allison input torque 565 lb-ft
  and slip onset about 350 whp; converter stall 1,500 rpm and ratio 1.8; overall length 237.3 in estimated from
  one source — and, new, the photos measure **220.7 / 225.3 in**, so the nose and rear bumper are longer than
  the photo truck. That is the largest unresolved accuracy item; the task text pins the envelope at 237.3 in,
  so the game keeps it.
* Estimated (all tagged): dimensions and weights other than wheelbase and width, ride heights, box and cab
  measurements, panel gaps, tach and gauge bands read from the photos, glow-plug times, every failure limit,
  every tune's torque gain and every fueling table, the roller diameter/inertia, the drivetrain inertia, the
  glass widths (62.8/54.4 in windshield, 61.2/56.4 in back glass), the pillar crown and the new hood line.
* Unverified: owner's-manual excerpts (read from the photos), the washer reservoir position, the hood release
  and tailgate procedure as standard GMT800, the SAE J1349 text (the ISO 1585 form is implemented), the vane
  sign convention, the exhaust side and fuel-filter conflicts (resolved from the photos and the owner), and the
  finishing-pass items: the glass frit border is **not modelled**, the front fascia/headlamps, seats, cluster
  bezel and engine-bay plumbing are simplified, the outside world is a placeholder, and the paint/lighting were
  tuned by eye.

### Results
* `npm test`: **276/276 passed** (14 files), including `tests/sim.test.js` and `tests/flash.test.js`.
* `npm run build`: succeeds (1.43 MB bundle, 459 kB gzip).
* `GPU=1 node scripts/check.mjs`: **46/46 passed**, no console errors that matter (`headless: 1280x720`).
* `HEADED=1 GPU=1 node scripts/perf.mjs`, 1920 x 1080, Intel Arc 140V: low 9.07 ms avg / 11.70 p95, medium
  13.73 / 17.90, high 18.85 / 26.80 (53.1 fps average at high).
* `blender --background --python tools/blender/overlay.py`: two overlays plus the report, outline bbox exactly
  237.30 x 77.00 in.
* Pushed to `claude/youthful-rubin-gg2uno`; no pull request.

### What I could not do, and why
* **Listen to the audio.** No audio device/ear in this session; levels remain spectrum-derived (95/95 offline
  checks and 56 unit tests prove the synthesis tracks the simulated firing frequency, turbo speed and fan, not
  that it sounds right).
* **Judge the art as a person would.** The two reviews were done on the renders by the model; a human eye on
  the paint, the lighting and the overall feel is still owed.
* **Reach 60 fps at high quality on this hardware.** 53 fps average at 1080p on an integrated Intel Arc 140V;
  no quality setting was lowered to hide it.
* **Measure in headless mode.** Headless Chromium has no GPU here (SwiftShader), so the frame times and the
  screenshots were produced with `HEADED=1`; the scripted checks run headless in software rendering.
