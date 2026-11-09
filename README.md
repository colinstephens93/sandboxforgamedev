# Duramax Dyno Shop

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

All 276 unit tests continue to pass and `npm run build` succeeds.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

Other commands: `npm test` (unit tests: engine, dyno, tuning, failures, start sequence, flash procedure, UI),
`npm run build`, `npm run shots` (Playwright: saves the 12 showcase screenshots to `screenshots/` at 1920 x 1080;
`SHOTS_QUALITY=low|medium|high`), `node scripts/check.mjs` (46 scripted verification checks: intro, every
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

* **Views** (keys 1 to 8): hero, side, rear, wheel, engine bay with the hood up, the engine on its own, driver's seat, underside. Drag to orbit, right-drag to pan, wheel to zoom.
* **Parts shown**: body, wheels, interior, engine bay, hood underside and underside can each be switched off; each lists its draw calls and triangles.
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

## Listening to the audio (the ear pass)

The audio is procedural. A small mapping adjustment (turbo whistle base gain 0.42 → 0.48) was made in the
improvement pass so the Turbo Sound closed-vane whistle is more present. A full human listening comparison
against real LLY recordings is still outstanding.

`node scripts/audioCheck.mjs --save` renders the real `AudioEngine` through an `OfflineAudioContext` and writes
listenable WAVs to `.dev/audio/` (idle cold and warm, inside the cab, WOT with and without the Turbo Sound
vanes closed, the intake hiss, the two fan-only beds, the rollers, the start sequence and the door/one-shot set).
Play them next to each other, loudness-matched, and compare with a real Duramax.


A GPU with WebGL2 is expected; the quality setting (Q, or F1 panel) is low / medium / high (high by default). Software rendering works
but is slow.

## Optional: Blender build tools

Blender is used only through scripts in `tools/blender/` (headless `bpy`): reference overlay renders for proportion checks and baked
lighting for the shop. Nothing is hand-modeled or downloaded, and the game runs without any of their outputs. See `docs/DECISIONS.md`
and `tools/blender/README.md`.

## Controls

| Key | Action |
|---|---|
| W A S D, Shift, Ctrl | walk, run, crouch (look under the truck). Click the view to capture the mouse; Esc releases it |
| E | use: open doors, hood, tailgate, fuel door, drawers, roll-up doors; sit in the truck; turn the key (hold for START) |
| I | inspection mode: point at any part for its name and a one-line description |
| T | dyno panel (gear, straps, fan, start a run, graph, history) |
| L | AI Live laptop app (read, backup, write, quick tunes, Turbo Sound, datalog, compare) |
| M | shop menu (repairs after a failure, LBZ fuel pressure regulator, shop temperature) |
| V / C | driver view / dyno camera while running |
| O | orbit and photo mode (H hides all UI, P saves a PNG) |
| F1 | help panel; Q cycles quality; any key skips the intro |

## How the game works

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
src/game/                  input, walk controller and collision, interaction, openings, cameras, the Game loop
src/ui/                    overlay, dyno panel and graph, AI Live app, shop menu
tests/                     vitest unit tests
scripts/                   fit.mjs (calibration fit), check.mjs (46 checks), perf.mjs (frame time), shots.mjs,
                           shot.mjs and probe.mjs helpers
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
