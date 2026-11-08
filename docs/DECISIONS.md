# Decisions

## Blender is a scripted build tool, not a hand-modeling tool (agreed with the owner)

**Decision.** Blender is used only through Python scripts checked into `tools/blender/`, run headless with the `bpy` package. Nothing
in the game is hand-modeled or downloaded. The spec rule in `PROMPT.md` section 8 ("generate every texture and model yourself, in
code; do not download textures, HDRIs or 3D models") still holds: a script in the repo is code, and every file it produces can be
regenerated from the script. Generated files are build artifacts and are never edited by hand.

**Roles.**
1. *Measurement and review.* Scripted orthographic renders (side, front, top) of the game's truck, overlaid on the reference photos to
   measure proportion errors. Output stays in `.dev/` (git-ignored). Does not change anything shipped.
2. *Baked lighting for the shop.* A scripted Cycles render of the shop interior gives an environment map and baked ambient occlusion.
   Optional: the game falls back to the real-time environment map it builds today.
3. *Optional second pass on the body shell.* A script rebuilds the hood, fenders and nose with bevel and subdivision tools from the same
   measurements as `src/data/truckSpec.js`, exports a glTF, and the game loads it when present. The code-built body
   (`src/truck/skin.js`, `body.js`, `panels.js`) remains the fallback so the game always runs.

**Constraints.**
* Scripts read dimensions from `src/data/truckSpec.js` (through a small exported JSON), never hard-code real-world numbers.
* No downloaded models, textures or HDRIs. The reference photos are for looking only and are never shipped.
* `bpy` is installed in a throwaway virtual environment, not in the project dependencies (`package.json` stays Node-only).
* The owner uses the Blender application only to open and inspect generated `.blend` files and to report what looks wrong.

**Where it applies.** `PROMPT.md` is unchanged. This file records the clarification for the tooling.
