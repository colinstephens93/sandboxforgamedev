# Blender tools (optional)

Scripted, headless Blender. Everything here is code; outputs are regenerated, never hand-edited. See `docs/DECISIONS.md`.

## Setup

The scripts run in the installed Blender application (`blender --background --python ...`); no project
dependency is added (`package.json` stays Node-only). `exportProfile.mjs` needs Node 20+ only.

## Scripts

* `exportProfile.mjs` (Node): imports `src/truck/skin.js` and writes `.dev/profile.json`, the side silhouette and
  the key stations in meters in the truck frame (z = distance rearward of the front axle, y = height).
  `node tools/blender/exportProfile.mjs` — it prints the outline's bounding box and checks it against the
  spec envelope (237.3 x 77.0 in).
* `overlay.py` (Blender): reads `.dev/profile.json`, scales and positions the outline over the two side-view
  reference photos, and writes
  * `.dev/overlay_IMG_2862.png` and `.dev/overlay_IMG_2851.png` — the outline in bright magenta at about 50
    percent over the photo, the wheels as circles, the measured stations as green crosses, and a cyan
    length-matched copy of the outline (explained in the report),
  * `.dev/overlay_report.md` — the measured-versus-game table (inches from the front axle), the differences,
    flags above 1.5 in, the vertical residual and the conclusions.
  Run: `blender --background --python tools/blender/overlay.py`. The calibration constants (hub pixels, roof
  rows) are in the `PHOTOS` table at the top of the script.
* `smoke_test.py`: creates a cube, renders it with Cycles and writes `.dev/blender_smoke.png` (checks the
  install). Run with a `bpy` virtual environment: `~/.venvs/bpy/bin/python tools/blender/smoke_test.py`.

Nothing in the game loads these outputs. `.dev/` is git-ignored; the scripts are committed.
