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
* Underside (agent report, all `estimated`): frame width 34.5 in, kick-up location, tank dimensions (about 25 gal by volume), spring geometry, crossmember positions, AAM 11.5 rear cover with 10 bolts, springs under the axle, transfer case front output side, cooler line sides, rear strap tabs (not factory), recirculating-ball steering gear (believed correct for GMT800; the brief said rack). Wheel center 14.5 in vs skin.js rolling radius 14.76 in + 0.6 in: small inconsistency, left as is.
* Wheels/tires (agent report, `estimated`): rotor size (13 in outer radius), caliper shape and position, knuckle/CV stub/axle detail; the Michelin LTX M/S2 section width 9.8 in comes from the listing; 0.75 in deflection and the 14.5 in hub height; the DOT code on the sidewall is made up; wheel offset, face recess and cap geometry estimated from photo 06 at one angle; rear brakes modeled as a disc rotor with caliper (rear brake type not verified from the references).
