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
