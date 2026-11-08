# Duramax Dyno Shop prompt

The build prompt for an autonomous coding agent. It follows the showcase framework in
`docs/FRAMEWORK.md` (adapted from the Superyat prompt). Give everything below the line to the agent.

---

Build a photorealistic, fully interactive 3D diesel performance shop containing a white 2005 Chevrolet Silverado 2500HD LT Crew Cab with the 6.6 L Duramax (LLY) and Allison 1000 automatic, strapped to a chassis dynamometer. Make it one runnable browser app using Three.js and WebGL. A person must be able to walk through the whole shop, inspect every tool and machine, walk around the truck, open every door, the tailgate and the hood, inspect the engine bay, climb into the cab, start the engine, run the truck on the dyno to measure horsepower and torque, tune it with the shop's laptop tuning software, AI Live, and run it again to see what the tune changed. This will be shown publicly as a showcase. Accuracy to the real truck, the real engine and real dyno behavior matters more than anything else. After that, the paint, the materials and the shop lighting matter most.

Work autonomously from start to finish. Do not ask me questions. Make sensible decisions, keep going, and do not stop until every item in the acceptance checklist at the end works and you have checked it with screenshots.

## 0. ACCURACY RULES (read first, apply everywhere)

The one failure that ruins this project is anything that is not true to the real 2005 truck, the real LLY Duramax, or a real dyno shop.

- **One source of truth:** put every real-world number in `src/data/truckSpec.js` (dimensions, weights, engine ratings, gear ratios, tire size, dyno constants). Each value carries a comment with its source and a confidence tag: `confirmed` or `estimated`. Models, physics, gauges and the dyno all read from this file. No magic numbers elsewhere.
- **Year-correct:** this is the 2003–2007 "Classic" GMT800 body, the 2005 model year, with the LLY engine and the 5-speed Allison. Never mix in parts of other years: no 2006+ LBZ engine, no 6-speed Allison, no 2007.5+ GMT900 body, no LB7 injector layout.
- **Do not invent.** If a detail is not in this prompt, not in the `reference/` folder, and you are not certain of it, use the plainest correct option and add it to `ACCURACY.md` as "unverified". Never fill a gap with a guess that looks confident.
- **Reference photos:** open every image in `reference/` and read `reference/INDEX.md` before modeling. The index says what each photo is trusted for. Where a photo shows something the index marks as non-stock, build the factory 2005 part instead.
- **Stock only:** the truck in the game is a factory-stock 2005 at factory ride height. No leveling kit, lift, aftermarket tires, aftermarket intake parts, step bars or spray-in bed liner.
- **Factory data already confirmed from the 2005 owner's manual** (record in the spec file with the source "2005 Silverado owner's manual"): axle ratio 3.73; maximum trailer 12,000 lb and GCWR 22,000 lb for this configuration; short-bed fuel tank 26.0 gal; wheel nut torque 140 lb-ft; A/C refrigerant R134a 1.6 lb; transmission normal temperature 180 to 200 °F, hot warning at 265 °F. **Confirmed from the 2005 Duramax diesel supplement** (GM part 15101364, in `reference/manuals/`): engine VIN code 2 (6.6L V8 Turbo Diesel, the LLY); cooling system 24.0 qt; engine oil with filter 10.0 qt; normal idle 680 rpm; oil pressure above 80 psi is normal, especially when cold; the yellow-loop engine oil dipstick; a fuel cooler under the vehicle. Read both manuals' relevant sections before building the cab, gauges, engine bay and start logic.
- **Units:** model in meters (1 unit = 1 m), but keep the source values in inches, feet, lb, hp and lb-ft in the spec file and convert in code. Display US units in the UI.

## 1. THE TRUCK (exterior)

Configuration (default, change in the spec file only):
- 2005 Chevrolet Silverado 2500HD, LT trim, Crew Cab (four full-size doors), 6.5 ft box, 4WD, Summit White, 6.6 L Duramax LLY, 5-speed Allison 1000, factory-stock (all confirmed by owner). Tan leather interior, as in the reference photos.

Main dimensions:
- Wheelbase 153.0 in (confirmed for the crew cab short box; the 8 ft box is 167.0 in).
- Overall width about 79.7 in without mirrors; height about 77 in. Overall length per a verified source; record it in the spec file with its source.
- Factory tires LT245/75R16E on 16 x 6.5 in rims, 55 psi front and 80 psi rear (from the door placard in the reference photos), 8-lug wheels with an 8 x 6.5 in (8 x 165.1 mm) bolt pattern, 16 in polished aluminum LT wheels. Tire sidewall lettering readable at the right scale.
- Human-scale checks: door handle height, step-in height for a 4WD HD, bed rail height and tailgate height must all look right next to a 1.78 m person.

Body:
- Summit White gloss paint with clearcoat, correct GMT800 Classic body lines: the 2003–2007 front fascia and grille with the Chevrolet bowtie, the headlamps of that body, the HD's raised hood, flared fenders, chrome bumpers as fitted to the LT, towing mirrors or standard mirrors as on the reference.
- Build the body as smooth curved surfaces from cross-section and profile curves, not boxes. Correct panel gaps (about 4–5 mm) at every door, the hood, the tailgate and the fuel door. Real door seals and weatherstrip.
- Glass: tinted windshield, side glass and rear glass with the black ceramic frit border.
- Badging only where the real truck had it, in the right places and sizes, confirmed by the owner:
  - a **gold** Chevrolet bowtie in the grille bar (and gold bowties on the wheel center caps)
  - the DURAMAX and 2500 HD badges on each side, as in `reference/05b-door-badge.jpg` and the side photos
  - the chrome SILVERADO badge with bowtie on the lower left of the tailgate, and **no** CHEVROLET lettering on the tailgate
  - the **4x4** decal on each rear bedside ahead of the taillight; no Z71 decal
  Check each against the reference photos; list anything you cannot confirm in `ACCURACY.md`.
- Bed: the inner box with stamped floor ribs, wheel tubs, tie-down hooks, stake pockets, and a working tailgate with its hinges, latches and support cables.
- Underside: the fuel filter and its housing on the driver-side frame rail in front of the fuel tank (confirmed by owner and the 2005 Duramax diesel supplement), with its water-in-fuel sensor wire; frame rails, crossmembers, front differential and IFS (torsion bars) for the 4WD, solid rear axle on leaf springs, driveshafts, transfer case, exhaust with the downpipe, fuel tank, spare tire under the bed. Visible from a low angle and from the dyno pit.
- Light grime that a working shop truck would have: a little road dust low on the rockers and wheel wells, never dirty enough to hide the paint.

## 2. OPENINGS AND INSPECTION

All openings are animated on real hinge axes with real swing angles and stop at real limits:
- **Four doors:** open and close with E when facing the handle. Door cards, door jamb with the tire and loading placard and VIN sticker area, door check straps, interior lights come on when a door opens.
- **Tailgate:** opens by lifting the handle while pulling the tailgate toward you, drops to horizontal and hangs on its cables; closes by pushing it firmly up until it latches (2005 owner's manual).
- **Hood:** opens in the real order from the 2005 owner's manual: pull the release handle inside the cab, to the lower left of the steering wheel, then pull up the secondary release near the center of the grille, then lift the hood. GMT800 hoods have no prop rod and no gas struts: it is held open by the spring-loaded hinge arms at both rear corners (see `reference/04b-hood-underside-in-situ-hinges.jpg`), with the molded insulation pad underneath.
- **Fuel door.**
- **Inspection mode (I):** point at any part and see its name and a one-line description (for example "Allison 1000 transmission dipstick"). The label list lives in data, not in scattered code.

## 3. ENGINE BAY (the second hero)

The 6.6 L Duramax LLY, built at the correct scale and position:
- The real LLY top-side layout from the diesel supplement's Engine Compartment Overview (`reference/manuals/lly-engine-compartment-diagram.png`, drawn from the front of the truck, so the left of the drawing is the passenger side). Every labeled part must be present and in its drawn position: A engine air cleaner/filter, B coolant surge tank, C two batteries (one each side), D air filter restriction indicator, E engine oil dipstick (yellow loop), F Allison transmission dipstick, G engine oil fill cap, H engine fan, I power steering fluid reservoir, J remote negative terminal, K remote positive terminal, L brake fluid reservoir, N underhood fuse block, O windshield washer fluid reservoir. No clutch fluid reservoir (M), since this truck is an automatic.
- Also: the engine cover, the intake tube, the turbocharger, the radiator and intercooler stack with the fan shroud, hoses with clamps, wiring looms in split loom, and the hood insulation pad.
- Match the reference photos for every component's position. Anything not confirmed goes in `ACCURACY.md`.
- When the engine runs: a subtle idle vibration of the engine on its mounts, the cooling fan turning, and a faint heat shimmer near the turbo under load.

## 4. CAB INTERIOR (walkable, enter with E at an open door)

The 2003–2007 GMT800 interior in LT trim:
- Leather front bucket seats with the center console, or the 40/20/40 front bench, matching the reference. Rear crew cab bench. Correct seat stitching and perforation pattern.
- The real dashboard of that generation: the gauge cluster laid out exactly as the real one with working needles, the center stack with the radio and climate controls, the steering wheel with the bowtie and its switches, the column shift lever with the Tow/Haul and overdrive-disable button on its end (tap toggles Tow/Haul, press and hold toggles overdrive disable, each with its cluster indicator), the ignition with LOCK, ACCESSORY, RUN and START positions, the hood release handle low left of the steering wheel, the transfer case control left of the steering column, the parking brake pedal, and the headlight switch.
- **Starting sequence (from the 2005 Duramax diesel supplement):** the shifter must be in PARK or NEUTRAL or the engine will not crank. Key to RUN: the gauges and the driver information center come on and the Wait to Start light comes on. It is a fast warm-up glow plug system, so the light stays on only briefly, and it may not come on at all with a hot engine. As soon as the light goes off, key to START; the engine cranks, catches with a diesel clatter, and the key returns to RUN when released. Idle settles at 680 rpm, and the engine sounds louder when cold. If the key is held in START longer than 15 seconds, stop cranking and require a one-minute starter cool-down, as the manual instructs. The engine shuts off with the key.
- **Elevated idle and exhaust restrictor:** when the shop air is below 32 °F and the coolant is below 150 °F, and the feature is enabled, idle ramps from 680 to 1,200 rpm after a short delay. It drops back to normal when the brake or accelerator is pressed or the shifter leaves PARK or NEUTRAL, and ends when the coolant reaches 150 °F. The driver information center shows ELEVATED IDLE ENABLED or ELEVATED IDLE DISABLED when it is toggled. Expose shop temperature as a setting so this can be demonstrated.
- Gauges read the real state, using the United States heavy-duty automatic cluster from the 2005 owner's manual: speedometer (driven by the rear wheels on the dyno rollers) with odometer, tachometer with its dashed red zone and solid red zone, voltmeter, engine coolant temperature, transmission temperature (normal 180 to 200 °F; at about 265 °F the driver information center shows TRANSMISSION HOT and the transmission enters protection mode until it falls below 260 °F), oil pressure, fuel, the warning and indicator lights (including Tow/Haul, overdrive disable, four-wheel drive and check engine), and the driver information center with the engine hour meter.

## 5. THE SHOP AND THE DYNO

**The building:** a real independent diesel performance shop, about 24 x 18 m, 6 m eave height:
- Insulated steel building with two roll-up overhead doors, polished concrete floor with control joints and realistic oil stains, LED high-bay lights, a small office, an air compressor with hard piping and drops, a 2-post lift, rolling toolboxes, a workbench with a vise, a tire changer and balancer, an oil drain, parts shelving with real-looking boxes, a shop computer, and a fire extinguisher by each door.
- Every listed item can be walked up to and inspected (label, and a simple working action where it makes sense: toolbox drawers open, the roll-up doors raise and lower, the lights switch on and off).

**The dynamometer:** an in-ground chassis dyno with large inertia rollers and an eddy-current load absorber:
- The rear wheels sit on the rollers; the truck is in 2WD for the run. Wheel chocks at the front tires, ratchet tie-down straps from the frame to floor anchors at all four corners, a large high-velocity cooling fan in front of the grille, an exhaust extraction hose over the tailpipe, and a weather station (temperature, pressure, humidity).
- A dyno control stand with a screen showing the live graph.

**The dyno run (physically modeled, never a canned number):**
- Engine model: torque is computed from the calibration (fuel quantity, injection timing, rail pressure and boost) and limited by the air available, not read from a fixed curve, so that tuning changes it (section 5A). With the stock calibration it must reproduce the published rating of 310 hp at 3,000 rpm and 605 lb-ft at 1,600 rpm (Allison-equipped) exactly at the crank, with a realistic diesel shape: strong low-end torque, flat peak, and falling torque toward the governor near 3,200 rpm.
- Drivetrain: the 5-speed Allison 1000 ratios (3.10, 1.81, 1.41, 1.00, 0.71, reverse 4.49; all confirmed), the torque converter locking up during the pull, the 3.73 axle ratio (the only ratio listed for the 6.6 L diesel in the K-2500 Crew Cab Short Box HD in the 2005 owner's manual) and the tire rolling diameter from the spec file, and a drivetrain loss consistent with a 4WD truck with an automatic (about 15 to 20 percent).
- Procedure: the operator selects a gear (4th, 1:1, is the standard pull gear), the player holds full throttle, the rollers accelerate under the real inertia, the software reads roller speed and acceleration, and computes wheel horsepower and wheel torque against engine rpm.
- Output: a graph of wheel hp and wheel lb-ft against rpm, with peak values, the SAE J1349 correction factor from the weather station, and a run history to compare runs. A stock truck must land in the real range of a stock LLY on a chassis dyno; derive it, don't hard-code it. Run-to-run variation stays within about 1 percent.
- During and after the run: coolant and transmission temperatures rise, the fan sound, the exhaust note, the rollers spinning and the tires deforming slightly under load.
- Safety realism: the run is refused if the straps are not attached or the hood is closed with the fan off, with a clear message, as a real operator would.

## 5A. TUNING WITH AI LIVE

The shop tunes the truck with **AI Live**, an original laptop tuning app built for this game. It works like real Duramax tuning tools, but its name, logo and screens are original: do not copy the name, branding or interface of any real tuning product.

**The hardware and the ritual (real shop procedure):**
- A laptop on a rolling cart, and an interface cable that plugs into the OBD-II port under the left side of the dash. A battery charger clipped to the batteries, as shops do before flashing.
- Steps in order: plug in, key to RUN with the engine off, **read** the truck's current tune, **save a backup** of the stock tune (required before the first write), choose a tune, **write** it with a progress bar and a realistic duration, then cycle the key and start the engine.
- A write fails if it is interrupted: the key turned off, the cable unplugged, or battery voltage too low without the charger. A failed write leaves the truck in a no-start state with the cluster dark or flickering until the backup or another tune is written. This is how real flashing behaves.

**Quick tunes (the only tuning mode):**
- Six named tunes, each card showing its purpose and its expected gains and risks: **Stock** (the factory calibration, always available), plus the five positions of the owner's real switchable LLY tune, with the horsepower each adds over stock (confirmed by the owner):

  | Position | Gain over stock |
  |---|---|
  | Heavy Tow | +30 hp |
  | Light Tow | +60 hp |
  | Economy | +120 hp |
  | Street | +175 hp |
  | Race | +230 hp |

  Each tune's peak horsepower on the dyno must come out at stock plus its gain (with the LBZ regulator installed), produced by the calibration and the physics, not added on afterwards. The owner did not supply torque gains: derive them from a realistic diesel fueling curve for each tune, and record them as estimates in `ACCURACY.md`. The tow tunes keep the conservative Allison behavior that suits towing, and Economy aims at efficiency at part throttle as well as power. See `reference/tuning/`.
- **LBZ fuel pressure regulator:** the owner's five tunes were written for an LLY with the LBZ fuel pressure regulator swapped onto the CP3 injection pump (confirmed by the owner). The game truck arrives with the stock LLY regulator, and the LBZ regulator sits on the parts shelf as an installable upgrade at the workbench, with a short install sequence on the pump. Running the five tunes with the stock regulator is allowed but behaves as it would in reality: on the higher tunes the rail pressure falls short of target at high fuel demand, power falls short of the tune's numbers, and the log shows the rail pressure error. Record the regulator's effect with its source or as an estimate in `ACCURACY.md`.
- The selected tune changes the calibration the engine model reads: main fuel quantity, injection timing, rail pressure, boost and turbo vane targets, the smoke limiter, the torque limiters, and the Allison's shift points, line pressure and converter lockup.
- The truck behaves differently on every level, on the dyno and at idle: power and torque curves, boost, exhaust temperature, smoke, sound and transmission behavior.

**Physics that pushes back:**
- More fuel without enough air gives black smoke on the dyno, higher exhaust gas temperature and smaller gains, as on a real diesel.
- The engine model tracks cylinder pressure, exhaust gas temperature, turbo speed, coolant and transmission temperature on every pull and over repeated pulls (heat soak).
- The stock **Allison 1000** has a torque capacity. Above it, the clutches slip: the transmission temperature climbs, the dyno graph turns ragged, and slip shows in the log.
- The 2005 diesel supplement's **REDUCED ENGINE POWER** message appears when the engine computer would really go into protection.

**Breakage (on, as the owner wants):** parts can fail when pushed too hard, at believable limits only, never randomly:
- **Allison transmission:** prolonged slip burns the clutches. The truck then fails to hold the load on the dyno, and the transmission is marked as needing a rebuild.
- **Head gaskets:** sustained high cylinder pressure lifts the heads, giving white smoke, coolant loss and climbing temperature.
- **Turbocharger:** overspeed or extreme exhaust temperature damages it, with a change in sound and a loss of boost.
- **Pistons:** extreme exhaust temperature held over time damages them, with a loss of power and smoke.
- Each failure is announced clearly, explained in plain language (what failed and why), and can be repaired from the shop menu so play continues. Every limit lives in `src/data/truckSpec.js` with a source and a confidence tag. The race tune should be capable of hurting the stock transmission when abused, as on real trucks.

**Datalogging and comparison:**
- AI Live records a log during every dyno pull: rpm, fuel quantity, rail pressure, boost, airflow, injection timing, exhaust gas temperature, coolant and transmission temperature, and transmission slip.
- After the run, the dyno screen overlays the selected tune's graph on the stock baseline, with the gain in wheel horsepower and torque. Runs and logs are saved and can be compared.

**Accuracy:** GM's factory calibration tables are not public. Build the stock calibration to reproduce the published rating and the real stock dyno range, and build each tune level to reproduce the owner's real tune data or published results for LLY trucks on stock injectors, turbo and transmission. Record every value with its source in `truckSpec.js`, and list every estimate in `ACCURACY.md`.

## 6. SOUND

Procedural audio with the Web Audio API, built from the engine state: the Duramax diesel clatter at idle, turbo spool and whistle rising with boost, the exhaust note, the starter motor, the cooling fan, the roller whine on the dyno, door and hood sounds, and the shop's large-room reverb. Audio starts on the first user click.

## 7. CAMERAS AND CONTROLS

- **Walk mode, the default after the intro:** first person, pointer-lock mouse look, WASD, Shift to run, eye height 1.65 m, solid collision with walls, the truck, the lift and the equipment, and the dyno pit edges. Use a BVH or simplified collision meshes so walking is smooth. Crouch (Ctrl) to look under the truck.
- **Driver view:** seated at the correct eye point in the cab.
- **Dyno view (C while running):** a camera at the rear quarter, low, with the graph overlay.
- **Orbit and photo mode (O):** fly freely; H hides all UI; P saves a PNG.
- **Cinematic intro on load, 15 to 20 seconds:** a slow walk-in through the open roll-up door toward the truck on the dyno, one low three-quarter front shot of the truck with the shop lights reflecting in the white paint and chrome, ending in walk mode. Any key skips it.
- **Help and settings:** F1 toggles a minimal help panel with all controls and a quality setting (low, medium, high; high by default). Esc releases the mouse. A clean loading screen with progress.

## 8. REALISM (art direction)

- **Materials:** physically based throughout: clearcoat paint, chrome and polished aluminum, cast and machined engine metal, rubber, hard plastics with the right texture, leather with grain and stitching, carpet, glass with transmission and reflection, concrete, painted steel, and the dyno's diamond plate.
- **Assets:** generate every texture and model yourself, in code, canvas or shaders. Do not download textures, HDRIs or 3D models. The only allowed external code is npm packages such as three, a post-processing library and a BVH collision library. Reference photos in `reference/` are for looking at only.
- **Lighting:** an environment map of the shop itself with PMREM so the paint and chrome reflect the real room, soft shadows from the high bays, daylight through the open roll-up door, and correct exposure inside the cab and under the hood.
- **Post-processing, photographic and never overdone:** ACES filmic tone mapping, subtle bloom, ambient occlusion and high-quality anti-aliasing.
- **Detail:** rounded edges and real thickness everywhere, no floating parts, no gaps that the real truck does not have, no z-fighting, no stretched textures.
- **Performance:** a stable 60 fps at 1080p on a recent laptop GPU, with instancing for repeated parts, a limited set of shadow casters, a capped pixel ratio and frustum culling.

## 9. ORDER OF WORK (build the showcase shot first)

1. Project setup and `src/data/truckSpec.js` with sources. Then the shop shell, the lighting, tone mapping and post-processing.
2. The truck exterior at correct dimensions on the dyno. Check the hero shot.
3. The openings: doors, tailgate and hood, then the engine bay.
4. The cab interior and the starting sequence with live gauges.
5. The engine and drivetrain model, the dyno run, the graph and the correction factor. Prove the stock numbers.
6. AI Live: the laptop, the read, backup and write procedure, the quick tunes, the datalog, the comparison graph, and the breakage model.
7. Walk mode with collision, the cameras, the intro, the UI and the audio.
8. The shop equipment and inspection labels, quality settings and performance.
9. Verification, the accuracy audit and polish (section 11).

If something has to be simplified, cut in this order: shop equipment actions (keep the equipment, drop the interactions), the underside detail beyond what is visible from the pit, then the rear seat detail, then breakage animations (keep the failure logic and messages). Never cut the stock-versus-tuned comparison, the read, backup and write procedure, and never cut the accuracy of the truck's shape, the engine bay, the gauges, or the dyno physics.

## 10. TECHNICAL

- **Stack:** Vite plus Three.js, with clear modules: data (spec, labels), shop, truck exterior, openings, engine bay, interior, materials and procedural textures, engine and drivetrain model, dyno, player and collision, audio, cameras and UI.
- **Code:** clean, no placeholders, no fake buttons and no pre-rendered video. Every listed control must really work.
- **Tests:** unit tests for the engine and dyno math: the crank curve hits 310 hp at 3,000 rpm and 605 lb-ft at 1,600 rpm; hp equals torque times rpm divided by 5,252 everywhere; the SAE correction factor is right for known inputs; wheel numbers fall in the configured loss range; the stock calibration reproduces the rated curve; each tune level lands within its target range; each failure triggers only past its limit and never below it.
- **README:** one-command setup (npm install, then npm run dev), all controls, and the architecture.
- **Screenshot script:** `npm run shots` opens the app in Playwright, sets each named camera bookmark, and saves the screenshots below. The bookmarks are named presets in code.

## 11. VERIFY, LOOK, AUDIT, IMPROVE (do not skip)

Run the app in a headless browser (Playwright, with a WebGL-capable flag):

- **Checks:** no console errors that matter; the intro plays and skips; every door, the tailgate and the hood open and close; the engine starts with the glow plug wait and idles; a full dyno pull completes and produces a graph and peak numbers; the run is refused without straps; a backup is required before the first write; a full tune write works and an interrupted write fails and is recoverable; every quick tune changes the dyno result in the expected direction; the higher tunes fall short on rail pressure with the stock regulator and reach their numbers with the LBZ regulator installed; abusing the race tune can break the transmission; walk mode reaches every corner of the shop; frame time is reasonable; the unit tests pass.
- **Screenshots** in screenshots/:
  1. hero: low three-quarter front view of the truck on the dyno
  2. side profile showing the full crew cab and box proportions
  3. rear three-quarter with the tailgate down and the straps
  4. engine bay from above with the hood up
  5. the driver's seat view of the dashboard and gauges at idle
  6. an open front door with the door jamb and interior
  7. the dyno screen with a finished run graph and peak numbers
  8. the dyno pit view of the underside and rollers
  9. the shop wide shot with the equipment
  10. a close-up of the wheel, tire and badge detail
  11. AI Live on the laptop during a tune write, with the cable plugged in under the dash
  12. the dyno screen comparing the stock baseline with a performance tune

**Art review:** open each screenshot and judge it as a demanding art director. Look for anything fake, flat, blocky, too dark, too bright, plastic or unfinished.

**Accuracy audit:** then judge each screenshot as a GM truck technician who owns a 2005 Duramax. Compare proportions, part placement, badges, interior layout and gauge behavior against the spec file and the reference photos. Every mismatch is a bug: fix it, or if it cannot be confirmed, record it in `ACCURACY.md`. Repeat both reviews until the truck reads as the real 2005 truck.

## ACCEPTANCE CHECKLIST (all must be true before you finish)

- [ ] `src/data/truckSpec.js` holds every real-world number with a source and confidence tag
- [ ] The 2005 GMT800 Classic crew cab at correct dimensions, Summit White, with real reflections
- [ ] Correct wheels, tires, glass, badging and underside for the configuration
- [ ] Four doors, tailgate, hood and fuel door open on real hinges with real limits
- [ ] A year-correct LLY engine bay with labeled components
- [ ] A walkable LT cab with live, accurate gauges
- [ ] The real diesel start sequence with the glow plug wait
- [ ] A physically modeled dyno pull with wheel hp and torque, SAE correction and run history
- [ ] Stock dyno results within the real stock LLY range, derived and not hard-coded
- [ ] AI Live: read, backup, write with real failure on interruption, quick tunes, datalog and stock-versus-tuned comparison
- [ ] Tuned results and breakage limits derived from sourced data, with estimates listed in `ACCURACY.md`
- [ ] A complete, inspectable shop with solid collision
- [ ] Walk, driver, dyno and photo camera modes; the intro; the help panel; UI hiding; PNG capture
- [ ] Procedural engine, turbo, fan and roller sound
- [ ] Smooth performance with a quality setting, and no console errors
- [ ] Passing unit tests for the engine and dyno math
- [ ] README, `ACCURACY.md` and the `npm run shots` script
- [ ] All 12 screenshots saved, art-reviewed and accuracy-audited

When you finish, report:
- what you built
- the controls
- the file structure
- the screenshot files
- every entry in `ACCURACY.md` and any other limitation that remains
