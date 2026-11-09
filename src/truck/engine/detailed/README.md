# Detailed LLY engine model (copied code)

The files in this folder are copied unchanged from the `duramaxsimulator` repository
(github.com/colinstephens93/duramaxsimulator, commit `f1ff396`, `src/`), keeping their relative layout:

| Here | There |
| --- | --- |
| `engines/families/v8-ohv.js`, `v8-ohv-kinematics.js` | the engine builder (block, internals, valvetrain, front drive, turbo, fuel system, cutaway, exploded view) |
| `engines/lly/index.js`, `copy.js` | the LLY data entry and its component descriptions |
| `utils.js` | materials, generated textures and part helpers |
| `kinematics.js`, `core/telemetry.js`, `core/resources.js` | what the builder imports |

Do not edit them here: change them in that repository and copy again, so the two stay the same. Everything that fits
the model into the truck lives outside this folder, in `../detailedEngine.js` (placement, scale, labels, what is shown)
and `../index.js` (which parts of the earlier simple engine it replaces).

Known difference from the truck's own data: the model keeps a 184 mm connecting-rod length (that repository's research
sheet gives 163 mm). The block and deck are built around the 184 mm figure, so it cannot be changed here on its own.
