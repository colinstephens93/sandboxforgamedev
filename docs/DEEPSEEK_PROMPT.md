# Prompt for the finishing agent (self-contained: paste this whole file)

You are finishing a nearly complete project: the **Duramax Dyno Shop**, a photorealistic browser game (Three.js, WebGL, Web Audio) of a stock
2005 Chevrolet Silverado 2500HD LT Crew Cab (Summit White, 6.6 L Duramax LLY, Allison 1000, 4WD) on a chassis dynamometer in a diesel shop,
with a laptop tuning app called AI Live. A person can walk the shop, open every door, the tailgate and the hood, inspect the engine bay, sit in the cab,
start the engine with the real diesel glow-plug procedure, run the truck on the dyno, tune it with AI Live, and run it again to see what changed.
Accuracy to the real truck, the real LLY engine and real dyno behavior matters more than anything else. After that, paint, materials and shop lighting.

You work autonomously. Do not ask the owner questions that this prompt or the repository already answers. Make sensible decisions, log them, and keep going
until the definition of done (section 6) is true and verified.

## 1. Where things are

* Repository: https://github.com/colinstephens93/sandboxforgamedev , branch **`claude/youthful-rubin-gg2uno`**. Work only on that branch and push only to it. Do not open a pull request.
* Read these completely, in this order, before changing anything:
  1. `PROMPT.md`: the full specification and the **acceptance checklist at its end** (the source of truth for what "done" means; its accuracy rules beat everything else).
  2. `docs/HANDOFF.md`, `docs/DECISIONS.md` (the Blender decision), `docs/CONVENTIONS.md` (coordinates, module shapes), `ACCURACY.md`, `PROGRESS.md`, `PLAN.md`.
  3. `reference/INDEX.md`, then open every image in `reference/` (the index says what each photo may and may not be used for). If you cannot view images, say so in `PROGRESS.md` and follow the no-vision rules in section 4.
  4. `README.md` for the controls and the architecture.
* Layout: `src/data/truckSpec.js` (every real-world number with a source and a `confirmed`/`estimated` tag), `src/sim/` (pure JS simulation, no rendering: engine, turbo,
  driveline, dyno, failures, flash, start sequence, calibrations), `src/truck/` (body, front end, wheels, rear, interior, engine bay, underside), `src/shop/`
  (shell, equipment, dyno hardware, AI Live rig), `src/game/` (game loop, input, player, interaction, truck openings, camera bookmarks), `src/ui/` (dyno panel, AI Live, shop menu),
  `src/audio/` (procedural audio), `tests/` (vitest), `scripts/` (check.mjs, shots.mjs, fit.mjs, shot.mjs, probe.mjs), `tools/blender/` (optional Blender tools).

## 2. Rules that always apply

* Never edit anything in `reference/`. Never commit `.ctz` files or anything with serial numbers, licenses or keys.
* Do not download textures, HDRIs or 3D models. Everything is generated in code. npm packages and Blender Python scripts in the repo are allowed; hand-modeled or downloaded assets are not.
* `src/data/truckSpec.js` is the single source of real-world numbers. No magic numbers elsewhere. Every new real-world number gets a source and a `confirmed`/`estimated` tag (a test enforces the tag comments).
* Do not invent. If a detail is not in `PROMPT.md`, not in `reference/` and you are not certain, take the plainest correct option and add it to `ACCURACY.md` as unverified.
* Stock truck only: factory ride height and parts. The only non-factory items are the AI Live tunes and the optional LBZ fuel pressure regulator on the parts shelf.
* Never fake a result, hard-code a dyno number, or disable a test to get green. Never commit on a red build or failing tests. Keep the app runnable after every commit.
* **Protected numbers.** The dyno results are produced by the physics and verified by tests: stock about 252 wheel hp (about 490 lb-ft), tunes at stock plus 30, 60, 120, 175 and 230 wheel hp with the LBZ regulator,
  Street about 14 hp and Race about 30 hp short with the stock regulator, run-to-run within 1 percent. Do not edit `src/sim/`, `src/data/calFit.js` or `scripts/fit.mjs` unless a task below says so.
  If any test in `tests/sim.test.js` or `tests/flash.test.js` fails after your change, revert that change.
* Commit small with clear messages and push after each finished task. If a problem resists three honest attempts, write what you tried in `PROGRESS.md`, apply the specification's cut order if relevant, and move on.
* Do not edit source files while a screenshot or browser script is running (the dev server reloads the page and kills the run).

## 3. Setup (do this first and report the result of each command)

Needs Node 20+, git and Blender (installed by the owner; Blender is optional for the game itself).

```bash
git clone https://github.com/colinstephens93/sandboxforgamedev
cd sandboxforgamedev
git checkout claude/youthful-rubin-gg2uno
npm install
npm run setup:browser          # installs Playwright's Chromium
npm test                       # must pass (about 280 tests)
npm run build                  # must succeed
# set GPU=1 so headless Chromium uses the real graphics card (bash: GPU=1 ; PowerShell: $env:GPU=1 ; cmd: set GPU=1)
GPU=1 node scripts/check.mjs   # scripted browser checks: must end with "29/29 passed"
npm run dev                    # http://127.0.0.1:5173
```

If headless WebGL will not start, add `HEADED=1` (visible browser window). Without `GPU=1` the scripts use very slow software rendering.
Useful hooks in the page: `window.__game` is the Game object (`advance(seconds)` runs the simulation without rendering, `prepare({...})` sets up a scene state, `cam(pos, target, fov)`,
`plant`, `dyno`, `ign`, `ai`, `truckCtl`, `truck`, `shop`). `scripts/check.mjs` shows how to drive the intro, doors, hood, tailgate, start sequence, dyno runs and the AI Live procedure.

## 4. What is done, what is not

**Done and verified by tests or scripted browser checks (276 unit tests, 29 browser checks):**
the spec file with sources; the simulation (engine computed from fuel, timing, rail pressure, VGT turbo and air limits; driveline with converter, lockup and Allison clutch packs; dyno measuring power from roller
acceleration with coast-down correction and SAE/ISO correction; run history; refusals without straps or with the hood closed and the fan off); the five tunes fitted to the owner's gains; the LBZ regulator effect;
the failure model (transmission, head gaskets, turbo, pistons, only past documented limits); the diesel start sequence (glow-plug wait, 15 s crank limit and one-minute cool-down, elevated idle); the AI Live procedure
(cable, key RUN engine off, read, backup required, write with progress, interruption leaves a no-start state, recovery, charger and battery voltage); the shop; the truck (body, front end, wheels and tires,
rear end, bed, tailgate, badges, fuel door, interior with a live gauge cluster, LLY engine bay with labeled parts A to O, hood underside with spring hinges, underside with the fuel filter on the driver-side rail);
dyno hardware (pit, rollers, straps, fan, hose, stand, weather station); the dyno panel, AI Live app (Connect, Truck, Quick Tunes, Turbo Sound, Datalog, Compare) and shop menu; procedural audio; walk mode, driver
mode (V), dyno camera (C), orbit and photo mode, intro, help panel, UI hiding, PNG capture.

**Not done, or unverified (this is your work):**
1. The 12 screenshots in `screenshots/` exist only partly (shots 1 to 7 were taken, before proportion work; shots 8 to 12 were never taken) and **none has been art-reviewed or accuracy-audited**.
2. Truck body proportions have never been measured against the photos. Known visual weak spots: the nose and fender front are too rounded and bulbous, the fender-to-hood seam is soft, the A-pillar strips look like thin tubes, the seats and
   cluster bezel are simplified.
3. Section 11 checks not yet scripted in `scripts/check.mjs`: walk mode reaches every corner of the shop and cannot enter the truck, lift, equipment or pit; frame time at low, medium and high quality (never measured on real
   hardware); the Race tune breaking the stock transmission when abused (covered by a unit test, not by a browser check); closing the Turbo Sound vanes at high load triggering the turbo overspeed failure in the browser; every quick tune
   changing the dyno result in the browser.
4. Audio was never listened to; levels were set from spectra only. It needs a person's ear. Record that honestly; do not claim it was reviewed.
5. Known small defects: the AI Live cable clips through a closed driver door; the charger leads enter the engine bay through a closed hood; the fuel door has no real opening in the bedside skin; `lamps.set()` (brake, reverse, turn) is not wired to any state;
   the tune cards need scrolling at 1280 x 720; the heat shimmer at the turbo is faint; a transmission slip makes the dyno run dramatic (engine flare) and the idle turbo speed with open vanes is low (about 18k rpm).
6. `README.md`, `PROGRESS.md` milestone summaries with screenshots, `ACCURACY.md` completeness check, and the final report are unfinished.

## 5. Tasks, in order

**Task A: Blender measurement overlay (scripted; Blender is a build tool here, see `docs/DECISIONS.md`).**
1. `tools/blender/exportProfile.mjs` (Node) imports `src/truck/skin.js` and writes `.dev/profile.json`: the side silhouette in meters in the truck frame (z = distance rearward of the front axle, y = height): hood line `hoodHeight(s, 0)` for s -30.5 to 19.3 in,
   roof line `roofHeight(s, 0)` for s 43.6 to 108.6 in, beltline, bed rail (`H.bedRail`, s 110.8 to 191), bumper faces, wheel centers and radii (front s = 0, rear s = 153 in, center height 14.5 in, radius 15.25 in), and the stations in `ST`.
2. `tools/blender/overlay.py` runs with `blender --background --python tools/blender/overlay.py` (or the `bpy` package): load a reference photo, place and scale the outline over it, render `.dev/overlay_<photo>.png` (bright outline, 50 percent transparent).
3. Calibration is horizontal only (the photos show a lifted truck with oversize tires, so heights follow the spec envelope): `reference/IMG_2862.jpeg` front hub center at pixel (175, 595), rear hub (833, 593), wheelbase 153.0 in. Measure `reference/IMG_2851.jpeg`
   (front at the right) the same way. Anchor the vertical scale on the roof line and report the residual.
4. Write `.dev/overlay_report.md`: for nose, hood end, windshield base, roof front, roof rear, cab back, bed front, bed rail end, tailgate end and rear bumper end give photo position versus game position in inches from the front axle and the difference; flag any above 1.5 in.
   Without vision, measure the silhouette edges by scanning pixels (white body against sky) and say so.
Acceptance: the scripts, the report and two overlay PNGs exist. Commit the scripts, not `.dev/`.

**Task B: proportion fixes in code (only where Task A flags real errors).** Adjust the tables in `src/truck/skin.js` (`W_MAX`, `P_FENDER`, `P_CAB`, `P_BED`, `hoodHeight`, `roofHeight`, `ST`, `H`), `src/truck/front.js` and `src/truck/body.js` so flagged features move toward the photos while staying in the spec envelope
(width 79.7 in, height 77 in, length 237.3 in, wheelbase 153.0 in). Work on the weak spots listed in section 4 item 2. After every change run `npm test`, `npm run build` and `GPU=1 node scripts/check.mjs`. Keep panel gaps at 4.5 mm and the door, hood, tailgate hinges working.

**Task C: finish the verification scripts** (section 4 item 3). Extend `scripts/check.mjs` (and add `scripts/perf.mjs` for frame time at the three qualities, 1920 x 1080, printing average and 95th percentile frame time) so every check in `PROMPT.md` section 11 is exercised. Fix real bugs they find (not by weakening a check).
Also fix the small defects in section 4 item 5 that are cheap (wire `lamps.set` to brake and reverse state; make the AI Live cable route avoid a closed door by checking the door state; raise the cable and charger-lead routes accordingly).

**Task D: the 12 screenshots.**
```bash
GPU=1 SHOTS_QUALITY=high npm run shots     # writes screenshots/01-hero.png ... 12-compare-baseline-vs-tune.png at 1920 x 1080
```
The cameras are the bookmarks in `src/game/bookmarks.js`; the scene states are `Game.prototype.prepare` in `src/game/game.js`; the DOM panel shots (7 dyno screen, 12 AI Live compare) are captured with `page.screenshot`.
The required set (from `PROMPT.md` section 11): 1 hero (low three-quarter front on the dyno), 2 side profile, 3 rear three-quarter with tailgate down and straps, 4 engine bay from above with the hood up, 5 driver's seat dash and gauges at idle, 6 open front door with jamb and interior,
7 dyno screen with a finished run graph and peak numbers, 8 dyno pit underside and rollers, 9 shop wide shot with the equipment, 10 close-up of wheel, tire and badge, 11 AI Live on the laptop during a tune write with the cable plugged in under the dash, 12 dyno screen comparing the stock baseline with a tune.
Retake all of them after Task B. **Open every image and judge it twice**: as a demanding art director (anything fake, flat, blocky, too dark, too bright, plastic or unfinished) and as a GM technician who owns a 2005 Duramax (proportions, part placement, badges, interior layout, gauge behavior against `reference/` and `src/data/truckSpec.js`).
List the problems in `PROGRESS.md`, fix what can be fixed, repeat until the truck reads as the real truck. Record anything that cannot be confirmed in `ACCURACY.md`. If you cannot view images, run the scripts, commit the files, and write in `PROGRESS.md` that the visual review is still owed; do not claim it was done.

**Task E: documentation and the final report.** Finish `PROGRESS.md` (milestone summaries with the screenshots), `ACCURACY.md` (every entry, including what you added), `README.md` (check setup and controls are still true), tick the acceptance checklist in `PROGRESS.md` item by item with the evidence for each.

## 6. Definition of done

Every item of the acceptance checklist at the end of `PROMPT.md` is true and verified, specifically:
* `npm test` passes, `npm run build` succeeds, `GPU=1 node scripts/check.mjs` passes completely including the new checks, with no console errors that matter.
* All 12 screenshots exist in `screenshots/`, were retaken after the proportion fixes, and were reviewed twice (or the missing review is stated honestly).
* `ACCURACY.md` lists every estimate, conflict and unverified item; `src/data/truckSpec.js` carries a source and confidence tag on every number.
* Frame time at each quality setting is recorded in `PROGRESS.md`.
* Everything is committed and pushed to `claude/youthful-rubin-gg2uno`.

## 7. Final report (your last message, and a copy in `PROGRESS.md`)

Report: what was built; the controls; the file structure; the screenshot files; every entry in `ACCURACY.md` and any other limitation that remains; the test, build and check results with the actual output; frame times; and anything you could not do (audio listening, image review) and why.
If you are blocked, say exactly what is blocking and what you tried.
