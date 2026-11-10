# ACCURACY.md

Every real-world number lives in `src/data/truckSpec.js` with a `confirmed` or `estimated` tag. This file lists what is
estimated, what conflicts between sources, and what could not be verified ("unverified"). Research notes with URLs:
`docs/research/facts.md` (the research agent could only read search-result summaries, not full pages).

## Conflicts between sources (decision taken)

| Item | Sources | Decision |
|---|---|---|
| LLY compression ratio | DieselHub and Diesel Army: 17.5:1 for 2004.5-2005; other sources 16.8:1 (2006 LLY) | 17.5 used, `estimated`; it only enters the model through the efficiency fit, not the rated output |
| Governed rpm | PROMPT.md and Wikipedia: 3,200; spec sheets: 3,250 | PROMPT.md wins: 3,200 governor |
| Allison 1000 input torque | DieselHub: 520 lb-ft (2001-04), 565 lb-ft (2005); engine rated 605 lb-ft with the automatic | 565 lb-ft used as clutch capacity basis, `estimated`; slip onset taken from magazine anecdote (about 350 whp) |
| Converter stall and torque ratio | 1,300-1,500 rpm stall; torque ratio 1.25 to 2.0 | 1,500 rpm, 1.8, `estimated` |
| Overall length | one source: 237.3 in (256.2 in is the long box) | 237.3, `estimated` |

## Estimated values (all tagged `estimated` in truckSpec.js)

Dimensions and weights other than wheelbase and width, box and cab measurements, ride height, step-in height,
door handle height, panel gaps, torque converter stall and ratio, lockup schedule, converter capacity, drivetrain
inertia, thermostat opening, coolant gauge hot zone, tach red-zone start, glow-plug wait times, roller diameter and
inertia, SAE correction exponents beyond the standard (see below), every failure limit, every tune's torque gain and
every fueling table (GM calibration tables are not public).

## Unverified

* Owner's manual excerpts could not be fetched (assets.gm.com returned 403 to the research agent). The tach scale
  (0-5 x1000 read from `01-dash-cluster-lit.jpg`) and the diesel gauge ranges are read from the reference photos, not
  from the manual text.
* The washer fluid reservoir position is not identifiable in any photo (reference/duramax-2005-photo-notes.md);
  it is placed low in the driver-side fender, the usual GMT800 location.
* Hood release lever and tailgate procedure are the standard GMT800 ones, as in the prompt.
* SAE J1349: the diesel correction implemented is the ISO 1585 / UN R85 form (turbo: `(99/ps)^0.7 (T/298)^1.5`), the
  SAE J1349 text itself could not be read.
* The vane-position convention (0 percent open, higher percent more closed) is inferred from tuner forums.

## Entries added during the build
(see below; each increment appends here)
* Dyno roller pair gap is a design value (0.10 m between drum surfaces, unverified): the spec estimate of 17 in cannot keep drum tops near floor level under a 15.25 in tire. Rear axle seats about 6.5 cm lower in the cradle than at rest (`anchors.rearAxleDropM`, geometric).
* Roller direction: at the contact patch the drum surface moves the same way as the tire surface (physical), so the drum top turns opposite to the tire top.
* Rear/bed (agent report, all `estimated`): door badge sizes (2500 HD about 9.0 in, DURAMAX about 4.4 in) and position (lower front corner of the front door, as in 05b and IMG_2862); 4x4 decal size and position; bed floor/tub/gate-inner colors; tub height and length; 13 lengthwise ribs at 5.08 in pitch; tie-down and stake-pocket positions; tailgate height 23.4 in, width 70 in, thickness 2.1 in, hinge at y = 37.8 in; cable anchor positions; taillamp section order and proportions; CHMSL size; bumper depth and chrome shape; receiver tube 3.2 in square; no tow hooks or frame end caps modelled (none visible in the photos).
* Fuel door: the bedside skin has no real opening; the DIESEL cap stands proud only while the door is open.
* Engine bay (agent report): the built layout follows the diagram and LLY photos over the brief where they differ: alternator on the passenger side of the engine front, A/C compressor driver side, J and K at the driver-side front beside the power steering reservoir, F (Allison dipstick) just passenger of center at the firewall, brake reservoir cap black with a yellow brake symbol. Unconfirmed (estimated): hose and pipe routing, remote terminal bracket details, Allison dipstick handle color, hood washer nozzle positions, battery orientation and label text (generic placeholder), radiator top cover outline and decals, VGT actuator type and solenoid position (built as a pod with rod), hood latch and secondary release geometry, hinge arm shape (from photo 04b only), fan diameter 19 in and blade shape, firewall and cowl details, engine bank dimensions. The secondary release lever is behind the grille: the game lets the player pull it by pointing at the grille.
* Exhaust side: the tailpipe exits on the PASSENGER side (reference/03-underside-rear.jpg and IMG_2872 both show it there, and the downpipe descends on the passenger side). The earlier task text said driver side; the photos win. The dyno exhaust hose adapter follows it.
* Fuel filter conflict: the diesel supplement describes an engine-mounted filter with the drain on the passenger side, or on the driver-side frame rail in front of the tank; the owner confirmed the driver-side frame rail, which is built (with its water-in-fuel sensor wire). The fuel tank is on the driver side.
* Underside (agent report, all `estimated`): frame width 34.5 in, kick-up location, tank dimensions (about 25 gal by volume), spring geometry, crossmember positions, AAM 11.5 rear cover with 10 bolts, springs under the axle, transfer case front output side, cooler line sides, rear strap tabs (not factory), recirculating-ball steering gear (believed correct for GMT800; the brief said rack). Wheel center 14.5 in vs skin.js `AXLE_Y` (rolling radius 14.76 in + 0.6 in = 15.36 in): `AXLE_Y` is the centre of the wheel-opening arcs, not the hub, so the openings sit about 0.9 in above concentric with the tires. Left as is; both are estimates.
* Wheels/tires (agent report, `estimated`): rotor size (13 in outer radius), caliper shape and position, knuckle/CV stub/axle detail; the Michelin LTX M/S2 section width 9.8 in comes from the listing; 0.75 in deflection and the 14.5 in hub height; the DOT code on the sidewall is made up; wheel offset, face recess and cap geometry estimated from photo 06 at one angle; rear brakes modeled as a disc rotor with caliper (rear brake type not verified from the references).
* AI Live quick-tune risk text quotes simulation numbers (for example Street EGT about 1,610 F; about 14 whp lost with the LLY regulator): they are model outputs and estimates, not published data.
* Method note: body proportions are measured against the reference photos with scripted orthographic overlays (tools/blender/, see docs/DECISIONS.md). The photos show a lifted truck with oversized tires, so heights follow the spec envelope and only horizontal proportions are taken from the photos.
* **Overall length conflict (measured, not resolved).** At the specified hub calibration (`tools/blender/overlay.py`, `.dev/overlay_report.md`) the photo truck's bumper-to-bumper span is **220.7 in (IMG_2862) and 225.3 in (IMG_2851)** against the **237.3 in** in `truckSpec.js`. The cab, doors, roof, beltline, cab back and bed front agree with the photos within about 1 in, so the difference is entirely in the two overhangs: the photo's nose sits at about -31 in and its rear bumper at about 190-196 in against the game's -38.5 and 198.8 in. 237.3 in is consistent with the confirmed 256.2 in long-box figure (256.2 - 18.9 in of box/wheelbase), and `PROMPT.md`/the task text pin the envelope at 237.3 in, so the game keeps it and the difference is recorded here rather than absorbed by shortening the nose and bumper. It is the largest unresolved accuracy item in the model.
* **Hood line (measured).** `hoodHeight` was raised and flattened to follow the traced photo silhouette (50.5-53.1 in from the leading edge to a third of the way back). The absolute heights still depend on the vertical calibration, which is anchored on the roof line of a lifted truck, so they remain `estimated`.
* **Glass widths (estimated, changed in the finishing pass).** The windshield is now 62.8 in wide at its base and 54.4 in at the top, and the back glass 61.2/56.4 in: the first pass was 56/49 in, which forced a 10-12 in wide A-pillar that read as a flat white sail. The real GMT800 glass width was not measured from a source (the front photo is a low-angle shot); it is inferred from the body width minus a plausible pillar width and is logged as `estimated`.
* **Pillar faces (estimated, added in the finishing pass).** The outer A-pillar and C-pillar faces are new ruled surfaces between the glass edge and the body side (they did not exist, which left an open wedge into the cab). Their crown (0.4-0.45 in) and edge treatment are design values.

## Unverified or simplified in the final render review (screenshots/)

* **Glass frit.** The black ceramic frit border that `PROMPT.md` section 1 asks for is **not modelled**: the side
  and rear glass are a tinted material only (`mat.glassTinted`), with no printed frit band or dot matrix. The
  tint (opacity 0.68, colour 0x0a1513, `src/core/materials.js`) is an estimate, not a measured transmission value.
* **Front fascia and headlamps** are simplified geometry: the grille's slat count and the lamp internals
  (reflector bowls, projector, turn signal section) do not match the reference photos one for one, and the lens
  materials are approximations. The overall arrangement (chrome bar with the gold bowtie, two grille openings,
  cat-eye lamps) matches `IMG_2853`.
* **Seats and cluster bezel** remain simplified, as handed over: stitching, perforation and bolster shapes are
  present but coarse, and the cluster bezel is a plain moulding.
* **Engine bay** contents follow the diesel supplement's diagram (parts A to O in their drawn positions) but the
  bay is cleaner and emptier than `IMG_2874` to `IMG_2877`: hose and pipe routing, bracket shapes and small
  components (clamps, clips, loom splits) are approximations, and the hood's insulation pad is a plain surface
  without the moulded cut-outs.
* **Outside world** seen through the open roll-up doors is procedural geometry (sky, distant industrial buildings,
  tree billboards, and a textured apron). Enhanced in Phase 3.2. It appears in the shop-wide and engine-bay screenshots.
* **Bed rail caps and bed floor**: plain black caps and a ribbed floor; the factory tie-down and stake-pocket
  details exist but the cap profile is a straight extrusion.
* **Paint and lighting** were tuned by eye against the reference photos, not measured; the environment
  intensity is currently 0.7 (raised in Phase 2.3) and the glass tint are art decisions.
* **Audio** has not yet received a full human listening pass against real LLY recordings (see PROGRESS.md).
  Unit tests and offline spectral checks prove the synthesis runs and tracks the simulated firing frequency,
  whistle pitch and fan speed. A small whistle-gain adjustment was made in Phase 4.1.

## Odometer (Phase 1.1)
* Starting value set to 145,000 mi (estimated for a 2005 working shop truck). Accumulates from tire linear speed during dyno or rolling. Engine hours tracked and displayed. Logged 2026-11-09.

## Front fascia (Phase 2.1)
* Headlamp lens transmission and housing depth adjusted for visual fidelity against IMG_2852/2853. Geometry remains parametric from existing faceS/hood shut line. No new real-world numbers introduced.

## Engine bay density (Phase 2.2)
* Additional loom and hose geometry added for visual density. Positions are approximate (estimated) to fill empty regions while remaining consistent with the labeled A–O layout. No new confirmed real-world numbers.

## PBR materials (Phase 2.3)
* Paint, chrome and glass material parameters adjusted for stronger clearcoat and reflections. No new real-world numbers. Environment intensity raised to 0.7.

## Performance (Phase 3.1)
* High-quality SSAO sample count, resolution scale, pixel ratio and shadow map size reduced modestly to improve frame time while keeping the high preset visually superior to medium. No visual features removed.

## Exterior and floor (Phase 3.2)
* Outside world is procedural placeholder geometry (sky, distant buildings, tree billboards, apron). Oil stains are decorative decals. No real-world measurements introduced.

## Audio (Phase 4.1)
* Turbo whistle base gain raised from 0.42 to 0.48 (estimated adjustment for better Turbo Sound presence). Full human listening pass against real LLY recordings is still outstanding.

## Detailed engine and cab fit (November 2026)
* **Engine model.** The block, heads, internals, front drive, turbo, intake, EGR and fuel system are the model from the `duramaxsimulator` repository (commit f1ff396), copied with one data correction (see "Accuracy pass" below). Its own research sheets are the authority for its values; it is an illustrative model, not CAD. It keeps a **184 mm connecting-rod length** although its research sheet gives 163 mm (the block and deck are built around 184 mm, so it cannot be changed in this repository alone). Valve timing, lift and the appearance of the internals are illustrative.
* **Placement (estimated).** The engine sits with its crankshaft on the existing mount axis and its mid-length at s = 2.4 in, chosen so the heads land where the earlier simple engine's banks were. Clearances to the firewall, fan and hood pad are checked by `tests/detailedEngine.test.js`; no real-world mounting dimension was used.
* **Sump.** The copied model's sump is a test-stand shape and hung below the front axle and crossmember, so in the truck the underside module's own sump is shown instead.
* **Engine cover.** Thinned to a lid 2.6 in deep (estimated from reference photo 02; the real cover is a thin tread-pattern lid, not a box).
* **Exhaust.** The bay's earlier downpipe was removed: the copied model has its own, and the underside module carries the pipe on from the engine. Where the two meet is not modelled as a joint.
* **Rear glass.** Rear door glass and the back window are drawn as deep-tint privacy glass, nearly opaque from outside. The tint level is estimated from the reference photos, not measured.
* **Lamp lenses and glass no longer refract.** They use plain transparency (see PROGRESS.md); the headlamp lenses look slightly flatter than before.
* **Cab ambient light.** Surrounding (image-based) light on the non-metal cab trim is scaled to 0.45, because that lighting has no shadows and lit the cab as if it had no roof. The factor is estimated by eye.
* **Cab trim.** Interior trim above the beltline is pulled in to follow the body's inward lean (`src/truck/interior/fit.js`). This corrects trim that stood outside the door frames and roof; pillar trim is slightly narrower toward the roof as a result.


## Bench page (November 2026)
No new real-world number was added to `src/data/truckSpec.js`. What the bench assumes or simplifies:
* **Rollers held between runs (bench only, estimated).** On the bench the dyno's absorber brakes the rollers with 2,200 N·m whenever the engine cannot be driving them (shifter in P or N, or engine off). The figure is the one `src/sim/dyno.js` already uses for the absorber at the end of a run; it is a design value, not a measured absorber rating. The shop game is unchanged: there the rollers still coast under tire and windage losses alone, which takes more than five minutes from the end of a pull.
* **Wheels drawn as standing below 0.02 rad/s** (about one degree a second). A display threshold only.
* **No dyno hardware is drawn.** The truck stands on a plain floor with its rear wheels turning in place; straps, fan, rollers and exhaust hose exist only as dyno state and sound.
* **Listening position (design choice).** Sound is heard from a fixed point 1.5 m ahead of the front of the truck (`frontOverhangIn`, itself estimated, is used as the grille position: the bumper face is a few inches ahead of the real grille) at 1.65 m ear height, or from the driver's seat in the Gauges view. Reverberation is still the shop's generated room.
* **Lighting.** The five underbody fill lights, the two dome lamps and the spare bay light are switched off on the bench, so the underside is darker than in the shop and the dome lamps never come on (no door opens on this page). Studio softbox environment, one shadow-casting key light. The floor is a matte, diffuse-only surface.
* **Interface cable and charger** are connected with the buttons on AI Live's Connect page (labelled as a test button in the app); there is no cable or cart to carry on this page.
* **The Cutaway view starts the engine by itself** through the normal sequence (key to RUN, wait for the glow plugs, START). It will not do so while AI Live is reading or writing.
* **Shop-menu jobs** (repairs, regulator swap) run in the stated seconds on the bench. In the shop game the same jobs finish in half the stated time, because that page runs the panels' per-frame hook twice a frame; this was left as it is so the shop game's behaviour does not change.

## Accuracy pass (November 2026)
No new real-world number was added to `src/data/truckSpec.js`. `tests/accuracy.test.js` now checks that numbers which
appear in more than one place agree (spec against itself, the detailed LLY entry against the spec, the engine's
geometry against its firing order).
* **Charge-air pressure drop (model change).** The intercooler pressure drop used a fixed 0.4 kg/s air flow at every
  operating point, so idle and light load lost the same 6.6 percent of compressor outlet pressure as rated power. It now
  follows the actual air flow (3 percent fixed plus a part that grows with flow squared; `icDropFlow`, `icDropRefFlow`
  in `src/sim/params.js`, both `estimated`, chosen to give the same 6.6 percent at 0.4 kg/s). The fuel and vane tables
  were re-fitted with `scripts/fit.mjs`: stock is still 310 hp at 3,000 rpm and 605 lb-ft at 1,600 rpm, and the five
  tunes land on the same wheel-horsepower gains (within 0.5 whp).
* **Roller drag (correction).** Roller bearing and air drag was carried to the wheel with the radius ratio inverted
  (multiplied by Rr/Rw instead of Rw/Rr), which understated it by a factor of about 1.5. It is a small term
  (`windageNmPerRadS`, `estimated`); the coast-down loss table changes by about 0.003 percent at the speeds of a pull.
* **Fuel properties** (heating value, stoichiometric ratio, density) are read from the spec by the model
  coefficients instead of being repeated there.
* **Intercooler heat soak** depends on boost only. The code also carried a charge-temperature term multiplied by
  zero; it was removed, with no change in behaviour.
* **Fuel level** is a fixed 62 percent of the tank: running the engine does not consume it. Not modelled.
* **Roof crown.** The roof was clamped flat at 77.0 in across 86 percent of its width, with a crease of about 2 degrees
  where the flat met the edge roll. It is now a continuous crown: centre (77.0 in) and edge heights are unchanged and
  the surface between moves by at most 0.15 in. The 0.2 in crown is a design value (`estimated`).
* **Hub height tag.** `HUB_HEIGHT_IN` in `src/truck/wheels.js` was tagged `confirmed`; it is derived from an estimated
  0.75 in tire deflection and is now tagged `estimated`, as this file already listed it.
* **Detailed engine torque curve (copied model, changed here).** The illustrative full-load curve in
  `engines/lly/index.js` gave 526 and 512 lb-ft at 3,150 and 3,250 rpm, which is 315 and 317 hp: more than the rated
  310 hp, past the rated-power speed. The last two points of both calibrations were lowered so rated power is the
  maximum (Allison 508 and 480 lb-ft, manual 492 and 466 lb-ft; shape `estimated`). The truck's dyno and gauges do
  not use this curve; it belongs to the copied model's own telemetry.
* **Not changed, still open.** The copied engine model keeps its 184 mm connecting rod (163 mm in its research
  sheet): with the 99 mm stroke that is a rod-to-stroke ratio of 1.86 against 1.65, so the drawn pistons dwell
  slightly longer near top dead centre than the real engine's. The same entry labels the 310 hp / 605 lb-ft Allison
  calibration "2006" with 16.8:1 compression, while this truck is a 2005 and the spec uses 17.5:1 (conflict table
  above); those labels are not shown in the truck app and were left for the source repository.
