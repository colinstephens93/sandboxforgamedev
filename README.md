# Duramax Dyno Shop

**The default page is now the bench** (`index.html`): the truck alone on a plain backdrop with fixed views, the engine you can
start and watch run, the chassis dyno and the AI Live tuning app. It is built for a laptop browser and draws nothing while
nothing moves. The original walk-around shop game is still here, at `shop.html`. See "The bench" below.

A browser game (Three.js, WebGL, Web Audio) of a stock **2005 Chevrolet Silverado 2500HD LT Crew Cab, 6.6 L Duramax LLY, Allison 1000**,
strapped to a chassis dynamometer in a diesel performance shop. Walk the shop, open every door, the tailgate and the hood, inspect the
engine bay, climb into the cab, start the engine with the real diesel glow-plug procedure, measure horsepower and torque on the
dyno, tune the truck with the shop laptop's **AI Live** software, and run it again to see what the tune changed. Everything (models,
textures, sound) is generated in code.

Accuracy to the real truck, the real LLY and real dyno behaviour comes first: see `PROMPT.md` (the specification), `ACCURACY.md`
(every estimate, conflict and unverified item) and `src/data/truckSpec.js` (the single source of every real-world number, each with a
source and a `confirmed` or `estimated` tag).

## Improvement pass (November 2026)

A review-driven improvement pass was completed on this branch. See `PROGRESS.md` for the full log.

- **Odometer**: starts at a realistic 145,000 mi and accumulates from tire linear speed; engine hours and mileage are shown live in the DIC.
- **Visual fidelity**: stronger Summit White clearcoat and chrome/glass response, deeper headlamp lenses, extra engine-bay looms and hoses, denser exterior through the roll-up doors, and additional floor oil stains.
- **Performance**: high-quality preset modestly reduced (pixel ratio, SSAO samples/resolution, shadow map, SMAA) to improve frame time while remaining superior to medium.
- **Audio**: turbo whistle presence slightly increased; full human ear pass still outstanding.

All 276 unit tests of that pass continued to pass and `npm run build` succeeded.

## Truck-only pass (November 2026)

- **Truck studio**, **draw-call merging** and the **detailed engine** from the duramaxsimulator repository: see the sections below.
- **About three times faster** in the same software-rendered test (8.6 s to 3.0 s per frame for the whole game): the glass and lamp lenses no longer force a second drawing of the whole scene, small parts no longer cast shadows, and the engine is skipped behind a closed hood.
- **Cab and glass**: the interior trim now sits inside the body instead of showing around the windows, the rear glass is privacy glass, and the chrome front bumper is smooth.
- **X** in the game shows the engine cutaway with the hood up.

293 unit tests pass and `npm run build` succeeds. Details in `PROGRESS.md`.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173            the bench (default page)
                   # http://127.0.0.1:5173/shop.html   the walk-around shop game
                   # http://127.0.0.1:5173/studio.html the truck studio (rendering work, no simulation)
```

`npm run build` writes all three pages to `dist/` with relative paths (GitHub Pages serves `index.html`, the bench).

## The bench (default page)

The truck stands alone on a plain floor. There is no shop, no walking and no pointing at things: everything is on the bar at
the bottom of the window and in the three panels, which dock on the right so the truck stays in view.

| Control | What it does |
|---|---|
| **Engine**: Turn on / Turn off | Starts or stops the engine independently of views and dyno runs. Turn off also cancels starting or aborts an active pull |
| **Throttle** slider | The accelerator pedal. The dyno takes it over during a run |
| **View** (keys 1 to 4) | Engine (hood up), Engine alone, Cutaway (castings faded, internals visible; engine power is controlled separately), Rear wheels. Drag to look around, wheel to zoom |
| **Dyno** (T) | Start Run; graph, peaks and run history. The bench is pre-strapped; hood and fan settings do not block a run |
| **AI Live** (L) | Opens Quick Tunes. Choose Apply tune to load the calibration and staged turbo sound settings immediately, with the engine running or stopped. No connection, read, backup, or key cycle is needed. Finish or abort an active dyno run before changing tunes |
| **Shop menu** (M) | Repairs, the LBZ fuel pressure regulator, shop temperature, reset |
| **Quality** | low, bench (default), medium, high. If frames stay under about 40 a second it steps down on its own |
| **Sound on / off**, **?** (F1) | Audio, help. Esc closes a panel |

What makes it light: none of the shop is loaded or drawn (walls, equipment, dyno hardware, the shop lights, the
reflection bake); the `bench` quality preset has one shadow light, no ambient occlusion and no bloom; shadow maps are
redrawn only while something moves (a hinge, the wheels, the running engine); each view switches off the parts it cannot
show; and with the engine off and the camera still the page does not draw at all (the readout at the top left says
"idle"). Between runs the dyno's absorber holds the rollers whenever the shifter is in P or N or the engine is off, so the
wheels stop after a pull instead of coasting for minutes.

The sound is heard from a fixed spot 1.5 m in front of the grille (louder with the hood up). Measured frame times are in `PROGRESS.md`.

Checks for the bench: `node scripts/benchCheck.mjs` (drives the page through its own buttons and panels: the four views, direct tuning with the engine stopped and running, turbo sound settings, and reset), `node scripts/benchPerf.mjs
[quality] [WxH]` (frame time of the bench next to the shop game at the same quality and size) and
`node scripts/benchShots.mjs` (one PNG per view and per docked panel in `.dev/`).

Code: `src/bench/bench.js` (class `Bench extends Studio`), `src/bench/controls.js` (the bar), `src/bench/bench.css`,
`src/game/simLoop.js` (the simulation wiring shared with the shop game).

## The shop game (`shop.html`)

Other commands: `npm test` (unit tests: engine, dyno, tuning, failures, start sequence, flash procedure, UI),
`npm run build`, `npm run shots` (Playwright, the shop game: saves the 12 showcase screenshots to `screenshots/` at 1920 x 1080;
`SHOTS_QUALITY=low|medium|high`), `node scripts/check.mjs` (46 scripted verification checks of the shop game: intro, every
opening, the start sequence, the dyno refusals and pull, the whole AI Live procedure, all five quick tunes, the
Turbo Sound vanes and the turbo overspeed failure, the race tune burning the transmission, walk collision and
reachability, the cable/door rule, the rear lamps and the driver eye point), `node scripts/perf.mjs` (frame
time at each quality: average, p50 and p95, written to `.dev/perf.json`), `node scripts/fit.mjs` (re-fit the
calibration tables against the physics) and `node tools/blender/overlay.py` under Blender (the measurement
overlay, see below).

Playwright needs `npm run setup:browser` once. Headless Chromium on Windows can fall back to software WebGL
(SwiftShader); `GPU=1` asks for the real GPU and `HEADED=1` opens a visible window, which is the only way to
get the GPU on a machine where headless has none (the frame-time numbers in `PROGRESS.md` were measured that
way). Setting `HEADED=1` is also worth it for the screenshots.

## Truck studio (truck and engine only)

`studio.html` loads the truck and its engine alone on a neutral backdrop: no shop, no dyno, no equipment, no simulation and no audio.
It exists so the truck's rendering, materials and frame cost can be worked on without the scenery in the way. It uses the same
renderer, quality presets, materials and hidden-part culling as the game, so what is tuned and measured there carries over.

```bash
npm run studio     # opens http://127.0.0.1:5173/studio.html (add ?quality=low|medium|high)
```

* **Views** (keys 1 to 9 and 0): hero, side, rear, wheel, engine bay with the hood up, the engine alone, engine cutaway (castings faded, internals moving), engine exploded, driver's seat, underside. Drag to orbit, right-drag to pan, wheel to zoom.
* **Parts shown**: body, wheels, interior, engine, the rest of the engine bay, hood underside and underside can each be switched off; each lists its draw calls and triangles.
* **Truck**: hood, doors, tailgate, engine running with an rpm slider, engine cutaway and exploded.
* **Render**: shadows, ambient occlusion, bloom, anti-aliasing, render scale and shadow map size switch one at a time on top of the preset, so the cost of each can be read off. Two generated lighting setups (studio softboxes, daylight).
* **Readout**: frame rate, CPU and GPU time per frame, draw calls, triangles, shader programs, textures.
* **Run benchmark**: times whole frames (finished on the GPU, so the display's refresh rate does not cap the result) for five views and shows a table that can be copied as JSON.

The same from the command line (`GPU=1` uses the real graphics card; `CHROME_PATH=...` uses an installed Chromium):

```bash
GPU=1 node scripts/studio.mjs perf                 # frame time per view at low / medium / high -> .dev/studio-perf.json
GPU=1 node scripts/studio.mjs perf high 1280x720   # one preset, another resolution
GPU=1 node scripts/studio.mjs shots high           # one PNG per view -> .dev/studio-<view>.png
```

Code: `src/studio/studio.js` (scene, views, benchmark), `src/studio/main.js` (panels), `src/truck/culling.js` (the culling rule shared with the game).

### Draw-call merging

The truck is built from about 950 labelled parts. `src/truck/optimize.js` merges parts that share a material and never move
relative to each other into one mesh for drawing, and keeps the originals on a raycast-only layer so pointing at a part still
finds that part's own name and action. Merging stops at anything that moves: nodes marked `userData.dynamic`, anything usable
with E, and named anchors; a mesh that changes on its own is marked `userData.noMerge`. `tests/optimize.test.js` drives every
moving part and fails if a merged part would have moved, hidden or changed. Add `?merge=0` to the game or studio URL (or
`MERGE=0` for `scripts/studio.mjs`) to draw the unmerged truck for comparison.

### Detailed engine

The engine block, heads, internals, front drive, turbo and fuel system are the detailed LLY model from the
[duramaxsimulator](https://github.com/colinstephens93/duramaxsimulator) repository, copied unchanged into
`src/truck/engine/detailed/` (see the README there) and fitted into the bay by `src/truck/engine/detailedEngine.js`. The
truck keeps its own dress around it (engine cover, fan, air conditioning compressor, power steering, dipstick, downpipe,
hoses and wiring) and its own sump, which is shaped around the front axle. Its crank, pistons, cam and valvetrain turn with
engine speed and are only drawn while the castings are cut away or the engine is exploded.

## Listening to the audio (the ear pass)

The audio is procedural. A small mapping adjustment (turbo whistle base gain 0.42 → 0.48) was made in the
improvement pass so the Turbo Sound closed-vane whistle is more present. A full human listening comparison
against real LLY recordings is still outstanding.

`node scripts/audioCheck.mjs --save` renders the real `AudioEngine` through an `OfflineAudioContext` and writes
listenable WAVs to `.dev/audio/` (idle cold and warm, inside the cab, WOT with and without the Turbo Sound
vanes closed, the intake hiss, the two fan-only beds, the rollers, the start sequence and the door/one-shot set).
Play them next to each other, loudness-matched, and compare with a real Duramax.


A GPU with WebGL2 is expected; in the shop game the quality setting (Q, or F1 panel) is low / medium / high (high by default). Software rendering works
but is slow.

## Optional: Blender build tools

Blender is used only through scripts in `tools/blender/` (headless `bpy`): reference overlay renders for proportion checks and baked
lighting for the shop. Nothing is hand-modeled or downloaded, and the game runs without any of their outputs. See `docs/DECISIONS.md`
and `tools/blender/README.md`.

## Controls of the shop game (`shop.html`)

| Key | Action |
|---|---|
| W A S D, Shift, Ctrl | walk, run, crouch (look under the truck). Click the view to capture the mouse; Esc releases it |
| E | use: open doors, hood, tailgate, fuel door, drawers, roll-up doors; sit in the truck; turn the key (hold for START) |
| I | inspection mode: point at any part for its name and a one-line description |
| X | engine cutaway (hood up): the castings fade and the crank, pistons, cam and valvetrain are shown working |
| T | dyno panel (gear, straps, fan, start a run, graph, history) |
| L | AI Live laptop app (read, backup, write, quick tunes, Turbo Sound, datalog, compare) |
| M | shop menu (repairs after a failure, LBZ fuel pressure regulator, shop temperature) |
| V / C | driver view / dyno camera while running |
| O | orbit and photo mode (H hides all UI, P saves a PNG) |
| F1 | help panel; Q cycles quality; any key skips the intro |

## How the truck works (both pages; the shop game adds the walking)

* **Hood**: pull the release handle in the cab (lower left of the steering wheel), then the secondary release at the grille, then lift. GMT800 hoods have no prop rod: spring-loaded hinge arms hold it.
* **Start**: shifter in PARK or NEUTRAL, key to RUN, wait for the Wait to Start light to go off, key to START. Over 15 s of cranking requires a one-minute starter cool-down.
* **Dyno run**: strap all four corners, turn the fan on (or open the hood), pick a gear (4th is the standard pull), start the run. The run is refused without straps or with the hood closed and the fan off.
* **Tuning**: plug the AI Live cable into the OBD-II port under the dash (open the driver's door first), key to RUN with the engine off, clip on the charger, read the truck, save a backup, then write a tune. An interrupted write leaves the truck in a no-start state until another write succeeds.
* **LBZ regulator**: the owner's five tunes were written for an LLY with the LBZ fuel pressure regulator. The truck arrives with the stock regulator; the upgrade is on the parts shelf (shop menu). Without it the higher tunes fall short on rail pressure.
* **Turbo Sound**: AI Live page that closes the VGT vanes at idle and light load for more whistle. The sound follows the modeled turbo shaft speed; it also raises back pressure and exhaust temperature, and too much at high load overspeeds the turbo.
* **Breakage**: transmission clutches, head gaskets, turbo and pistons fail only past their documented limits and can be repaired from the shop menu.

## Architecture

```
src/data/truckSpec.js      every real-world number, source and confidence tag
src/data/labels/           inspection labels (data, not scattered code)
src/sim/                   pure simulation (no rendering): atmos, turbo, engine, driveline, plant, dyno, failures,
                           calibrations (+ fitted tables in src/data/calFit.js), startSequence, flash (AI Live)
src/core/                  renderer + post-processing, procedural textures, materials, environment map, quality
src/shop/                  shell, layout, equipment, dyno hardware, AI Live rig
src/truck/                 parametric skin and panels, body, front end, wheels, bed and tailgate, interior, engine bay, underside
src/audio/                 procedural Web Audio: diesel, turbo from modeled shaft speed, starter, fan, rollers, doors, reverb
src/game/                  input, walk controller and collision, interaction, openings, cameras, the Game loop;
                           simLoop.js (simulation wiring shared with the bench), hinge.js (door and hood hinges)
src/bench/                 the bench page: Bench (extends the studio), control bar, stylesheet
src/studio/                the truck studio (truck-only stage, views, part show/hide, benchmark)
src/ui/                    overlay, dyno panel and graph, AI Live app, shop menu
tests/                     vitest unit tests
scripts/                   fit.mjs (calibration fit), benchCheck.mjs, benchPerf.mjs and benchShots.mjs (the bench),
                           check.mjs (46 checks), perf.mjs (frame time) and shots.mjs (the shop game), shot.mjs and probe.mjs helpers
tools/blender/             optional scripted Blender tools: exportProfile.mjs + overlay.py (the reference
                           overlay and the measurement report)
```

### The dyno and the physics

Torque is never read from a curve. `src/sim/engine.js` computes it from the calibration (fuel quantity, timing, rail pressure,
boost and vane targets, smoke limiter, torque limiter) and the air the VGT turbo (Garrett GT3788VA model) delivers. `src/sim/driveline.js`
models the torque converter, its lockup clutch, the Allison clutch packs, the 3.73 axle, tire radius, and the dyno rollers with their
inertia. `src/sim/dyno.js` measures wheel power the way a real inertia dyno does (roller acceleration plus a coast-down parasitic
correction), corrects it (ISO 1585 / SAE J1349 family) and bins it by engine rpm. The stock calibration reproduces 310 hp at
3,000 rpm and 605 lb-ft at 1,600 rpm at the crank, and lands near 252 whp on the dyno; each tune lands at the stock baseline plus the
owner's measured rear-wheel gain (Heavy Tow +30, Light Tow +60, Economy +120, Street +175, Race +230 whp) with the LBZ regulator.
`scripts/fit.mjs` solves those tables against the model; the unit tests prove the results.
