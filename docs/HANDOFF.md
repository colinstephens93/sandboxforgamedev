# Handoff: finishing the Duramax Dyno Shop

Read this first. The project is a browser game (Three.js) of a stock 2005 Silverado 2500HD LT crew cab, 6.6 L Duramax LLY, on a chassis
dyno, with AI Live tuning. Everything is built and merged; what remains is measurement, proportion fixes, the final screenshots and
documentation. The full specification is `PROMPT.md` (source of truth); the running log is `PROGRESS.md`; every estimate and conflict is in
`ACCURACY.md`; the Blender decision is `docs/DECISIONS.md`; the module conventions are `docs/CONVENTIONS.md`.

* Repo: https://github.com/colinstephens93/sandboxforgamedev
* Branch to work on and push to: `claude/youthful-rubin-gg2uno` (do not push anywhere else, do not open a pull request)

## 0. Rules that always apply

* Do not edit anything in `reference/`. Never commit `.ctz` files or anything with serial numbers, licenses or keys.
* Do not download textures, HDRIs or 3D models. Everything is generated in code (npm packages and Blender scripts in the repo are fine).
* All real-world numbers live in `src/data/truckSpec.js` with a source and a `confirmed` or `estimated` tag. No magic numbers elsewhere.
* Never fake a result, hard-code a dyno number or disable a test to get green. Nothing may be committed on a red build or failing tests.
* Commit small, with clear messages, and push to the branch above after each finished task.
* If a problem resists three honest attempts, write it in `PROGRESS.md` (what you tried) and move on.
* Do not touch `src/sim/` calibrations or the fitted tables (`src/data/calFit.js`, `scripts/fit.mjs`) unless a task says so: the dyno numbers are
  verified by the tests and must stay (stock about 252 whp, tunes at stock plus 30, 60, 120, 175, 230 whp with the LBZ regulator).

## 1. Setup (do this first, and report the results)

Needs Node 20 or newer, git and Blender (already installed by the owner).

```bash
git clone https://github.com/colinstephens93/sandboxforgamedev
cd sandboxforgamedev
git checkout claude/youthful-rubin-gg2uno
npm install
npm run setup:browser        # downloads Playwright's Chromium
npm test                     # must pass (about 280 tests)
npm run build                # must succeed
GPU=1 node scripts/check.mjs # scripted browser checks, must end "29/29 passed" (on Windows set the variable differently: $env:GPU=1)
npm run dev                  # http://127.0.0.1:5173 for a manual look
```

`GPU=1` makes the headless browser use the real graphics card. Without it the scripts use slow software rendering, so always use `GPU=1` on
the owner's desktop. If WebGL will not start in headless mode, add `HEADED=1` (opens a visible browser window instead) and note it in `PROGRESS.md`.

## 2. Tasks, in order

### Task A: Blender measurement overlay (grunt work, no judgment about looks needed)

Goal: measure where the game's truck outline differs from the reference photos, as numbers.

1. `tools/blender/exportProfile.mjs` (Node): imports `src/truck/skin.js` and writes `.dev/profile.json` with the side silhouette in meters in
   the truck frame (z = distance rearward of the front axle, y = height): the hood line `hoodHeight(s, 0)` for s from -30.5 to 19.3 in, the
   roof line `roofHeight(s, 0)` for s from 43.6 to 108.6 in, the beltline, the bed rail (`H.bedRail`, s from 110.8 to 191 in), the bumper
   faces, the wheel centers and radii (front s = 0, rear s = 153 in, center height 14.5 in, radius 15.25 in), and the key stations in `ST`.
2. `tools/blender/overlay.py`: runs with `blender --background --python tools/blender/overlay.py` (or the `bpy` package). It reads
   `.dev/profile.json`, loads a reference photo, scales and positions the outline over it, and renders a composite PNG to `.dev/overlay_<photo>.png`
   (outline in a bright color, 50 percent transparent over the photo).
3. Photo calibration (horizontal only; the photos show a lifted truck with oversize tires, so vertical heights follow the spec envelope, not the photo):
   * `reference/IMG_2862.jpeg` (side, front of truck at the left): front wheel hub center at pixel (175, 595), rear hub center at (833, 593); the wheelbase is 153.0 in.
   * `reference/IMG_2851.jpeg` (other side, front at the right): measure its hub centers the same way and record them in the script.
   * Anchor the vertical scale with the roof line: the roof must land on the roof in the photo, then report the remaining vertical error.
4. Output a table `.dev/overlay_report.md`: for each key feature (nose, hood end, windshield base, roof front, roof rear, cab back, bed front, bed rail end, tailgate end, rear
   bumper end) the position in the photo (inches from the front axle) versus the game, and the difference in inches. Flag any difference above 1.5 in.
5. If the model cannot view images, say so in `PROGRESS.md` and produce the numeric report from pixel measurements you can compute (for example find the roof edge by
   scanning the photo for the white body against the sky) instead; hand the composite images to the owner for viewing.

Acceptance: `.dev/overlay_report.md` exists with the table, and the two PNG composites exist. Commit the scripts (not `.dev/`).

### Task B: proportion fixes (needs judgment, only if the report flags real errors)

Using the report, adjust the tables in `src/truck/skin.js` (`W_MAX`, the `P_*` profile tables, `hoodHeight`, `roofHeight`, `ST`, `H`) so the flagged features move toward the
photos. Keep the body inside the spec envelope (width 79.7 in, height 77 in, length 237.3 in, wheelbase 153.0 in). After each change run `npm test` and
`GPU=1 node scripts/check.mjs`. Known weak spots to look at first: the nose and fender front are too rounded and bulbous, the fender-to-hood seam is soft, and the A-pillar
strips look like thin tubes.

### Task C: the 12 showcase screenshots

```bash
GPU=1 SHOTS_QUALITY=high npm run shots      # 1920 x 1080, writes screenshots/*.png
```

It takes the 12 camera bookmarks defined in `src/game/bookmarks.js` and the scene presets in `Game.prototype.prepare` (`src/game/game.js`). Seven were taken before the proportion work;
retake all of them after Task B. Each file name is fixed by the bookmark. Open every image and judge it twice, once as a demanding art director (anything fake, flat, blocky, too dark,
too bright, plastic or unfinished) and once as a GM technician who owns a 2005 Duramax (proportions, part placement, badges, interior layout, gauge behavior against `reference/` and
`src/data/truckSpec.js`). Write a list of the problems in `PROGRESS.md`, fix what can be fixed, and record anything that cannot be confirmed in `ACCURACY.md`.
If the model cannot view images, run the screenshots, commit them, and ask the owner for the review; do not claim a review that did not happen.

Known open items from the last review: the dyno fan blocks the nose in some views (the hero preset rolls it aside), the cable from the laptop clips through a closed driver door,
the seats and cluster bezel are simplified, and the tailgate/fuel door have not been looked at in the final set.

### Task D: documentation and the final report

* Finish `PROGRESS.md` (milestone summaries with the screenshots), `ACCURACY.md` (every entry), and the README (setup and controls are already there; check they are still true).
* Final report in the form the spec asks for (end of `PROMPT.md`): what was built, the controls, the file structure, the screenshot files, every entry in `ACCURACY.md` and any other limitation.

## 3. What is still unverified

* Audio was never listened to; its levels were set from spectra. It needs an ear pass by a person.
* Frame rate on real hardware was never measured (all checks ran on software rendering). If you have a GPU, record the frame time at each quality setting in `PROGRESS.md`.
* The SAE correction uses the ISO 1585 compression-ignition form; the J1349 text itself was not available.

## 4. Reporting back

When a task is done, add a short entry to `PROGRESS.md` (what you did, the checks you ran, anything left open), commit, and push. If you are blocked, say exactly what is blocking and what you tried.
