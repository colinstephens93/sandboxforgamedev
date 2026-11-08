# Research facts: 2005 Silverado 2500HD LT Crew Cab SB 4WD, 6.6L LLY Duramax, Allison 1000 (5-spd)

Compiled 2026-11-08 for the browser game.

## Method and limitations (read first)

- **WebFetch and curl were blocked by the session network policy** (Wikipedia, Edmunds, DieselHub, GM manual host all refused: DNS failure / 403). I could NOT open any primary document (GM owner's manual PDF, Garrett data sheets, SAE J1349, Allison spec sheet).
- All "sourced" values below come from **WebSearch result summaries** (which quote the underlying pages). URLs are the pages the search surfaced; I did not read them in full.
- Because of this, I only tag `confirmed` where two independent search-surfaced sources agree, or one source is clearly primary. Many items are therefore `estimated`. Estimates are labelled with their basis (engineering reasoning, my background knowledge, or forum anecdote). Nothing was invented silently; where I could not find a value it says `not found`.
- Tag legend: `confirmed` = two independent sources or primary; `estimated` = single weak source, forum/vendor claim, derived, or background knowledge.
- Where sources conflict, both values are given.

---

## 1. Truck dimensions (2005 Silverado 2500HD Crew Cab, short box 6.6 ft, 4WD)

Known already: wheelbase 153.0 in (3,886 mm), fuel tank 26 gal.

| Item | Value (US / SI) | Source | Confidence |
|---|---|---|---|
| Wheelbase | 153.0 in / 3,886 mm | autopadre 17043, carspecs.us (4x4 Crew Cab 6.6 ft box 153 in WB) | confirmed |
| Overall length | 237.3 in / 6,027 mm | https://www.autopadre.com/vehicle-dimensions/chevrolet-silverado-2500/2005-hd-crew-cab-lt-17047 . (256.2 in on Edmunds/Auto Channel is the 8 ft long-box 167 in WB truck, NOT ours) | estimated (one source for SB; consistent with 153 WB + ~84 in of overhang) |
| Overall width (no mirrors) | 79.7 in / 2,024 mm | autopadre 17047; Edmunds/KBB also list 79.7 | confirmed |
| Overall height (4WD) | 77.0 in / 1,956 mm | autopadre 17047 | estimated (single source; 4WD HD crew cabs are ~76-78 in) |
| Track, front | 68.6 in / 1,742 mm | https://theautochannel.com/db/usedcarbuyersguide/show_car_capacities.php?id=15658 (that page is the long-box 4x4 CC; track is shared across wheelbases) | estimated |
| Track, rear | 66.0 in / 1,676 mm | same Auto Channel page | estimated |
| Curb weight (Duramax/Allison 4WD CC SB) | sources: 5,479 lb, 5,760 lb (autopadre, unclear trim, likely 2WD/gas), 6,049 lb (Edmunds LS 4WD LB), 6,131 lb (Auto Channel 4WD CC LB). **Game value: ~6,350 lb / 2,880 kg** (range 6,200-6,500 lb) | https://www.autopadre.com/vehicle-weight/chevrolet-silverado-2500/2005-hd-crew-cab-lt-17048 , Auto Channel | estimated (Duramax+Allison+4WD adds ~350-450 lb over the gas 4WD figures; short box subtracts ~100 lb) |
| Weight distribution F/R (empty) | ~57% / 43% (about 3,620 lb front / 2,730 lb rear) | not found; diesel front-heavy truck, background knowledge | estimated |
| Ground clearance | sources: 10.6 in front (autopadre, Auto Channel) and 9.1 in front / 12.1 in rear (autopadre 17047), 13.6 in rear (17048). **Game: 9.1-10.6 in front axle/ 270 mm min; rear axle ~12-13.6 in / 305-345 mm** | autopadre ground-clearance pages | estimated (listings conflict) |
| Approach angle | not found (iSeeCars fields blank). Estimate ~22 deg (front bumper/air dam, 4WD HD) | https://www.iseecars.com/car/2005-chevrolet-silverado_2500hd-specs (blank) | estimated |
| Departure angle | not found. Estimate ~22 deg (to receiver/bumper) | | estimated |
| Front overhang | ~38.5 in / 980 mm | derived: 237.3 total - 153.0 WB = 84.3 in split ~46/54 as on GMT800 | estimated. Cars.com listing (52 in front / 11 in "rear w/o bumper", https://www.cars.com/research/chevrolet-silverado_2500-2005/specs/264694 ) looks unreliable (same page has absurd ground clearance values); ignore |
| Rear overhang (with bumper) | ~45.8 in / 1,163 mm | derived (see above) | estimated |
| Box inside length (floor, SB "6.6 ft") | ~78.7 in / 2,000 mm (long box is 97.6 in / 2,479 mm per Edmunds) | SB value not found in sources; GMT800 6'6" box convention | estimated |
| Box width between wheelhousings | 50.0 in / 1,270 mm | https://theautochannel.com/db/usedcarbuyersguide/show_car_capacities.php?id=15658 , carspecs.us , cars.com | confirmed |
| Box max inside width | ~65-66 in / ~1,650-1,675 mm | not found; GMT800 background knowledge | estimated |
| Box inside height (side wall) | ~20 in / 508 mm (cars.com lists 20 in for 2500; 21.4 in suggested in brief was not confirmed) | https://www.cars.com/research/chevrolet-silverado_2500-2005/specs/264674 | estimated |
| Tailgate width | ~62 in / 1,575 mm (cars.com, 2500) | cars.com | estimated |
| Tailgate height (top of lowered-gate / sill off ground) | ~34-36 in / 865-915 mm bed floor height off ground for 4WD | not found; background | estimated |

Additional: standard tire LT245/75R16E (see item 9). 2500HD Duramax rear axle ratio is normally 3.73 (not verified here).

---

## 2. LLY turbocharger

| Item | Value | Source | Confidence |
|---|---|---|---|
| Model | Garrett GT3788VA (variable-geometry, "VNT/VGT"); Garrett P/N 848212-5001S for LLY/LBZ replacements; LB7 used a different wastegated unit | Pure Diesel Power 848212-5001S listing (https://puredieselpower.com/chevy-gm-products/lly-duramax/2004.5-2005-gm-6.6l-lly-replacement-turbos/04-5-10-gm-lly-lbz-lmm-6.6l-duramax-garrett-stock-replacement-turbocharger-848212-5001s), https://us.bddiesel.com/products/garrett-gt3788va-duramax-turbo-exchange-chevy-2004-2010-lly-lbz-lmm-c-w-vane-position-sensor | confirmed (multiple vendor listings; GT3788VA is widely documented) |
| Vane actuator type | **Neither vacuum nor electric motor.** Engine-oil-pressure-driven piston actuator moves the unison ring/vanes; the ECM drives a PWM VGT solenoid (Garrett 792593-0001) that meters oil to the actuator piston; a position sensor (763527-0512; 2004.5-2005 LLY needs adapter harness 771864-0001) gives vane position feedback. If the solenoid fails electrically the vanes stick in a fixed position. | https://www.dieselhub.com/maintenance/6.6-duramax-vgt-solenoid.html , https://www.dieselhub.com/maintenance/6.6-duramax-turbocharger-rebuild.html , BD Diesel listing above | confirmed (DieselHub + vendor parts listings agree; one blog claiming an "electronic actuator" was disregarded) |
| Vane position convention (tuners) | EFILive/HP Tuners show "vane position %". Convention is **0% = vanes open (low boost / low back-pressure), higher % = more closed**. Typical logged values: LLY about 40% at WOT, LBZ closer to 20% (forum anecdote); a custom unison ring can shift the mapping (a forum user noted 70% = fully closed on theirs). Closed-end must be found by commanding the vanes to the stop. | https://duramaxdiesels.com/forum/threads/max-vane.12579 , https://www.hpacademy.com/forum/practical-diesel-tuning/show/desired-turbo-vane-position/ | estimated (direction inferred from forum posts, not a spec) |
| Max safe turbo shaft speed (GT37 frame) | **not found.** Estimate ~125,000-140,000 rpm for a GT37-class compressor; Garrett G-series pages quote 150,000 rpm for smaller frames which is not applicable. Use ~130,000 rpm as the "danger" line | search of https://www.turbomaster.info/eng/turbos/technical_data/garrett_GT37/ gave dimensions only | estimated |
| Stock peak boost | **not found for LLY.** Estimate ~22-26 psig at peak torque/rated, up to ~28-30 psig briefly in the factory cal (LB7 wastegate cal limit ~22 psi per Bostech). A tuned-on-stock-hardware truck commonly runs 30-38 psi; Stainless Diesel quotes a 38-40 psi max recommended boost for drop-in turbos | https://bostechauto.com/blog/duramax-turbo-problems-complete-lly-lbz-lmm-l5p-troubleshooting-guide , https://www.thoroughbreddiesel.com/assets/1/pdf/stainless-diesel-5blade-lmm-lly-lbz-lml-duramax-power-ranges.pdf | estimated |
| Stock EGT guidance (pre-turbo) | Forum quoting GM guidance: designed for extended running at 1,300-1,350 F pre-turbo (~1,150 F post-turbo). A stock LBZ may touch ~1,500 F briefly. Diesel Power Products FAQ: LLY should not exceed 1,300 F. Diesel Tech: stock LLY towing can sit around 1,300 F. | https://duramaxdiesels.com/forum/threads/what-is-safe-egt.13506/post-219495 , https://dieselpowerproducts.com/c-97-gm-duramax-045-05-66l-lly.aspx , https://dieseltechmag.com/2008/08/duramax-buildup | confirmed for the ~1,300 F continuous guidance (three sources, though forum/vendor), estimated for spike values |
| Piston damage threshold (pre-turbo) | see item 7 | | |

---

## 3. Allison 1000 (5-speed, 2004.5-2005 LLY era)

| Item | Value | Source | Confidence |
|---|---|---|---|
| Gear ratios | 1st 3.10 (3.094), 2nd 1.81 (1.809), 3rd 1.41 (1.406), 4th 1.00, 5th 0.71 (0.711), Reverse 4.49 (4.48) | https://en.wikipedia.org/wiki/Allison_1000_transmission , https://www.dieselhub.com/transmission/allison-1000.html | confirmed |
| Published input torque rating | **620 lb-ft not found.** DieselHub lists max input torque 520 lb-ft (2001-2004) and 565 lb-ft (2005). The LLY engine itself is rated 605 lb-ft with the automatic in some tables (see item 4/6), which exceeds these numbers, so the "rating" is an application rating, not a hard limit. Game value: use 605 lb-ft (820 N·m) engine peak and treat clutch capacity separately. | https://www.dieselhub.com/transmission/allison-1000.html | estimated (conflicting) |
| Torque at which stock clutches begin to slip under tuning | Diesel Tech: stock clutches struggled to hold more than ~350 rear-wheel hp for long (5th gear slipping on bigger tunes). Driving Line: reliable limit ~ +90 hp over stock before limp mode/damage risk. Weak spots are the C2 and C4 clutch packs (BD claims to double C2/C4 capacity). Practical game threshold: slip begins ~ 350 whp / roughly 750-800 lb-ft engine torque at the flywheel on a sustained basis, earlier (~+100 hp) with aggressive line pressure/timing | https://dieseltechmag.com/2008/08/duramax-buildup , https://drivingline.com/articles/performance-roadblocks-of-the-lly-duramax | estimated (magazine anecdotes) |
| Transmission temperature limits | Max sump 250 F, 300 F at cooler-out port (forum quoting Allison); normal sump 160-200 F; GM towing engineer quoted: fluid degrades significantly above ~270 F | https://www.irv2.com/forums/f125/question-for-allison-tech-trans-fluid-temp-461254.html , https://community.goodsam.com/discussions/technicalissues/transmission-temp-/1381233 | estimated (forum quotes of Allison/GM; no document read) |
| Converter stall speed | Stock "factory stall" Duramax converters are listed at about 1,300-1,500 rpm (ATS factory-stall unit for 2001-2010 LCT1000). Vendors' mild-upgrade units are 1,700-1,800 rpm; high-stall 2,100-2,500 rpm. Game: ~1,500 rpm at WOT stall for stock | https://rudysdiesel.com/products/ats-five-star-performance-torque-converter-factory-1300-1500-rpm-stall-speed-allison-lct1000-2001-2010-gm-6-6l-duramax , https://www.alligatorperformance.com/products/suncoast-gm-1057-3d-triple-disk-torque-converter-01-16-gm-6-6l-duramax | estimated |
| Stall torque ratio | Allison converter family (TC-210/211/221/222) torque ratios listed 2.05, 2.00 (or 1.91), 1.73, 1.58; the LLY pickup converter is believed to be in the ~1.6-2.0 range. ATS claims "factory torque multiplication approx 1.25:1" (vendor marketing, likely at a different operating point). Game: stall ratio ~1.8 estimated | https://www.sonnax.com/tech_resources/27-allison-1000-converters-the-next-generation-6 , ATS | estimated (conflicting) |
| Converter size | 300 mm (~11.8 in) housing; single-disc lockup clutch (stock) | ATS listing "300mm housing" https://www.atsdiesel.com/ats-five-star-torque-converter-2100-2500-rpm-stall-speed-with-300mm-housing-allison-lct1000-2001-201 | estimated |
| Lockup behavior | Stock design is a single-disc lockup clutch. Specific schedule not found; Allison 1000 typically locks the converter in 2nd-5th at light load and sooner/at lower speed in Tow/Haul. Game: no lockup in 1st; apply on 2nd-5th when slip small and throttle moderate, release on heavy throttle or high trans temp | | estimated |

---

## 4. Stock LLY chassis dyno results and tuned results

| Item | Value | Source | Confidence |
|---|---|---|---|
| Factory ratings | 310 hp @ 3,000 rpm (231 kW); torque 520 lb-ft @ 1,600 (GM Authority) **or** 605 lb-ft (820 N·m) with automatic (DieselHub). The widely cited LLY figure is 310 hp / 605 lb-ft (auto); the 520 is the LB7 number. | https://gmauthority.com/blog/gm/gm-engines/gm-6-6-liter-lly-v-8-duramax-turbo-diesel-engine/ , https://www.dieselhub.com/duramax/6.6-duramax-diesel-timeline.html | conflicting; 310 hp confirmed, torque estimated 605 |
| Typical stock whp (Dynojet/Mustang) | Forum: "230-250 rwhp / ~410 rwtq bone stock" (LB7/LLY generally). Diesel World puts LLY-era trucks between the LB7 (~240-260 rwhp) and LML (~340-360). Game: **stock LLY ~ 245 whp (range 230-260), peak wheel torque ~ 430-480 lb-ft (580-650 N·m)** | https://duramaxdiesels.com/forum/threads/dyno-of-casper.114 (stock 2005 2500HD thread, numbers not retrieved), https://www.pressreader.com/canada/diesel-world-4104/20171101/281492161472503 | estimated |
| Drivetrain loss, Allison 4WD | 310 hp -> ~245 whp = ~21% (Mustang-style loaded). Typical quoted range 18-23% for Allison 4WD. | derived | estimated |
| Typical tuned results on stock injectors/turbo | Driving Line: about 530 rwhp is where stock turbo/injectors/CP3 run out of capacity. Practical street tune on stock hardware: roughly +100 to +150 whp (to 350-400 whp). The brief's +175-230 whp ("Race") is plausible at the high end but I could not find a specific dyno sheet. EFILive-tuned stock-turbo LBZ made 522 hp / 932 lb-ft (Dieselarmy) which bounds what is possible with stock-ish hardware. | https://www.drivingline.com/articles/to-smoke-a-muscle-car-lly-duramax-edition , https://www.dieselarmy.com/?p=41951 | estimated |
| Effects of such tunes | EGT: sustained pre-turbo temps push toward and above 1,300 F, faster than stock; heavy black smoke under load (rich, turbo-limited airflow); Allison: clutch slip (esp. 5th gear / C2-C4), heat in the sump, shift-flare; shift kit/line-pressure change commonly paired. Dynomite 200 hp injectors vendor recommends a pyrometer. | https://dieseltechmag.com/2008/08/duramax-buildup , https://dieselpowerproducts.com/c-97-gm-duramax-045-05-66l-lly.aspx | estimated |

---

## 5. LLY injection system

| Item | Value | Source | Confidence |
|---|---|---|---|
| Pump | Bosch CP3 (3-plunger high-pressure pump), with Fuel Pressure Regulator (FPR) on the pump and rail pressure sensor | multiple duramaxdiesels forum threads | confirmed |
| Rail pressure range (stock) | Rail relief opens at ~23,200 psi (160 MPa) on LB7/LLY vs ~26,100 psi (180 MPa) on LBZ/LMM (forum; a poster disputes exact opening points). Factory LLY peak command up to ~26,100 psi is also claimed. Game: **idle ~ 5,000-7,000 psi; peak commanded ~23,000-26,000 psi at high load/rpm** | https://www.duramaxdiesels.com/forum/goto/post?id=215124 , https://duramaxdiesels.com/forum/threads/lbz-fpr-on-lly.36760 | estimated (forum) |
| LLY FPR vs LBZ FPR | The LBZ regulator plunger has a square slot vs the triangular slot on the LB7/LLY regulator; the larger area flows slightly more. Owners swap LBZ FPRs onto LLYs because the stock LLY regulator can not hold commanded rail pressure at high fuel demand (falls well below command, e.g. commanded ~25k, actual ~22k on a 3300 us tune); swap requires re-scaling the FPR current/rail-pressure tables. Shimming the LLY pressure-relief valve is also used. | https://duramaxdiesels.com/forum/threads/wd-modded-lbz-reg-tuning.12397/page-2 , https://duramaxdiesels.com/forum/threads/lbz-regulator-on-lly-tuning.45833/post-668332 , https://duramaxdiesels.com/forum/threads/lbz-fpr-on-lly.36760 | confirmed as forum consensus (several threads); numbers estimated. **Game mechanic idea: rail pressure error grows when requested pulse > ~3,000 us or demand high; LBZ regulator removes ~half of the shortfall.** |
| Injectors | Bosch solenoid injectors with SAC-style nozzles (LLY units are smaller than the LB7's, so a longer pulse is needed for the same fuel). Dynomite aftermarket sets: +20% (50 hp), +30%, +100% (200 hp). Max pulse width not found; tuners talk about ~1,500-3,300 us commanded in the high-power range. | https://www.parleysdieselperformance.com/products/dynomite-diesel-ddpnlly-200-brand-new-100-percent-over-200hp-injector-set-for-20045-2005-chevy-gmc-66l-duramax-lly , duramaxdiesels forum | estimated |
| Number of injections | Pilot + main. Pilot timing is relative to (added to) main SOI, minimum separation between pilot end and main start ~3 deg. No post-injection on this calibration (DPF-era engines have it). | https://duramaxdiesels.com/forum/threads/pilot-timming.5493 , HP Academy | estimated |
| Injection timing (BTDC) | **not found as stock table.** Estimate main SOI: idle ~ 0-6 deg BTDC; peak torque (1,600-2,000 rpm) ~ 8-14 deg BTDC; rated power (3,000 rpm) ~ 18-24 deg BTDC; tuned: +3 to +8 deg more advance, usually bounded to ~25-30 deg total with EGT/ peak-cylinder-pressure concern. Pilot ~ 8-15 deg ahead of main at light load, zeroed above ~2,800 rpm/80 mm3 by many tuners. | duramaxdiesels forum posts above | estimated |
| Main fuel at peak torque | **not found**. Derived: 605 lb-ft (820 N·m) @ 1,600 rpm, BSFC ~ 210 g/kWh, 0.835 g/cm3 diesel -> **~90 mm3/stroke**; at rated power (231 kW @ 3,000 rpm, BSFC ~ 230) -> ~88 mm3/stroke | derived calculation | estimated |

---

## 6. LLY engine data

| Item | Value | Source | Confidence |
|---|---|---|---|
| Bore | 4.055 in / 103 mm | GM Authority, DieselHub, XtremeDiesel | confirmed |
| Stroke | 3.897 in / 99 mm (not 3.898) | https://gmauthority.com/blog/gm/gm-engines/gm-6-6-liter-lly-v-8-duramax-turbo-diesel-engine/ , https://www.xtremediesel.com/blog/?p=6030 | confirmed |
| Displacement | 6.6 L / 402.7 cu in (6,599 cc) | Wikipedia Duramax V8 page | confirmed |
| Compression ratio | 17.5:1 for 2004.5-2005 (16.8:1 only for 2006 LLY) | https://dieselhub.com/duramax/6.6-duramax-lly.html | confirmed (DieselHub and Diesel Army agree) |
| Firing order | 1-2-7-8-4-5-6-3 | GM Authority and others | confirmed |
| Governed / max rpm | 3,250 rpm electronically governed per spec sheets (not 3,200). Wikipedia lists 3,200 for 2004-05 and 3,450 redline for 2006-07 LLY. Game: governed 3,250; | https://dieselhub.com/duramax/6.6-duramax-lly.html , Wikipedia | conflicting; estimated |
| Idle rpm | ~680 rpm warm (some sources 600-700) | DieselHub etc. | estimated |
| Fuel cut rpm | not found; estimate ~3,450 rpm (hard cut ~200 rpm above governed) | | estimated |
| Thermostat opening | not found; estimate ~180-190 F (82-88 C) start-to-open; full open ~200+ F | | estimated |
| Oil pressure | Forum (GM/Isuzu spec quoted): minimum 14 psi hot idle, 42 psi hot at 1,800 rpm. Typical owner readings ~25-35 psi hot idle, 55-65 psi cruising; warning set ~7-10 psi. | https://duramaxdiesels.com/forum/threads/sporadic-low-oil-pressure.22681 , https://www.duramaxdiesels.com/forum/threads/aftermarket-oil-pumps.9845/ | estimated (forum) |
| Peak cylinder pressure / head gasket lift | **not found.** Vendors recommend head studs at roughly 45 psi boost and above. Estimate: stock design peak cylinder pressure ~ 2,000-2,300 psi; head-lift/gasket distress risk rising above ~2,500-3,000 psi (estimated from general diesel practice; stock bolts + MLS-less gaskets lift first at high boost + advanced timing). | https://dieselpowerproducts.com/products/p-power-stroke-products-head-stud-kit-01-16-gm-66l-duramax-lb7-lly-lbz-lmm-lml | estimated |
| Glow plugs | 8 fast-glow plugs on a glow-plug controller ("Wait To Start" lamp, preheat roughly 1-6 s depending on coolant temp, afterglow for a short period) | background knowledge, not verified | estimated |

---

## 7. Piston damage thresholds (LLY aluminum pistons)

- Continuous pre-turbo guidance: **1,300-1,350 F (704-732 C)** as the design/safe sustained figure; ~1,150 F post-turbo (dieselworld/duramaxdiesels forum above).
- Spikes: ~1,500 F (816 C) pre-turbo for a few seconds is tolerated by stock trucks (forum report); sustained 1,500 F+ is the typical start of piston crown damage, with erosion/melting of the aluminum crown and ring-land loss as pre-turbo EGT goes to ~1,600-1,700 F sustained (approx. 870-925 C).
- Post-turbo equivalents are ~150-250 F lower than pre-turbo under load (so a game "danger" of ~1,250-1,350 F post-turbo corresponds to ~1,500+ F pre).
- Confidence: `estimated`. No metallurgical source found; brief mentioned 1,300-1,500 F tune-safe guidance, which matches DPP/forum figures. Sources: https://duramaxdiesels.com/forum/threads/what-is-safe-egt.13506/post-219495 , https://dieselpowerproducts.com/c-97-gm-duramax-045-05-66l-lly.aspx

---

## 8. SAE J1349 correction factor formulas (compression-ignition)

I could not open the standard itself (paywalled/blocked). What the searches support, and what is background recollection, is separated.

**Reference conditions (confirmed, multiple sources incl. ARAI test procedure):** dry air pressure 99 kPa, 25 C (298 K). (Equivalent 29.23 inHg dry, 77 F.) Intended ambient validity roughly 15-35 C (SAE J1349 AUG2004 summary).

**A. ISO 1585 / UN R85 / ARAI form for diesels (confirmed via https://www.araiindia.com/pdf/Test_Cycle_Test_Procedure.pdf and https://globalautoregs.com/texts?rule_id=96):**

```
alpha = fa ^ fm                          (fm is an EXPONENT: UN R85 corrected a typo that rendered it inline)

fa (naturally aspirated or mechanically supercharged) = (99 / ps) * (T / 298)^0.7
fa (turbocharged, with or without charge cooler)       = (99 / ps)^0.7 * (T / 298)^1.5

ps = dry atmospheric pressure in kPa (total minus water vapour)
T  = intake air absolute temperature in K  (T = C + 273)
fm = 0.036 * qc - 1.14        for 40 <= qc <= 65
fm = 0.3                      for qc < 40
fm = 1.2                      for qc > 65
qc = q / r   (q = fuel delivered in mg per litre of displacement per cycle; r = compressor-outlet / inlet pressure ratio, r=1 for NA)
validity window on fa: not verified (recollection: roughly 0.93-1.07; ISO 1585 tightens it to 0.98-1.02 for strict tests)
```
Confidence: formulas in the brief `(99/Pd)*((T+273)/298)^0.7` is the NA diesel fa and the turbo `(99/Pd)^0.7 * (T/298)^1.5` matches the ARAI text (confirmed); fm numbers 0.036qc-1.14 and range are from my recollection of ISO 1585/Directive 80/1269 (`estimated`).

**B. SAE J1349 JUN90 (diesel/CI):** recollection (`estimated`, not verified): `CF = ((99 / Pd) ^ 0.65) * (((T + 273) / 298) ^ 0.5)` with Pd in kPa and T in C. The JUN90 spark-ignition form is `CF = 1.18 * (99/Pd) * sqrt((T+273)/298) - 0.18`, which is the one most chassis-dyno software (Dynojet "SAE") applies regardless of fuel. JUN90 also assumed 85% mechanical efficiency when friction data is not available (source: SAE J1349 summaries).

**C. Current SAE J1349 (AUG2004 / 2011 revisions):** aligned with ISO 1585 for correction; the spark-ignition factor dropped the `1.18 ... - 0.18` term and became `CF = (99 / Pd) * ((T + 273) / 298)^0.5`; the CI case uses the `fa^fm` family in A. Also includes an LHV correction of observed power for fuel properties. Confidence `estimated`; the exact equation should be checked against the standard before presenting it as quoted.

**Recommendation for the game:** implement A (documented, sourced) for diesels, optionally offer "SAE J1349 JUN90 (Dynojet-style)" with the SI formula in B for a "Dynojet reads higher/lower" toggle.

---

## 9. Tire LT245/75R16 E (Michelin LTX M/S2 and similar)

| Item | Value | Source | Confidence |
|---|---|---|---|
| Overall diameter | 30.5 in / 775 mm (LTX M/S2); Defender LTX M/S 30.4 in | https://tiresize.com/tires/Michelin/LTX-MS2-245-75R16.htm , https://www.tires-easy.com/245-75-16/michelin-tires/ltx-m-s2/tirecode/36228 | confirmed |
| Section width | 9.8 in / 249 mm | same | confirmed |
| Revolutions per mile | 683 (=424 rev/km) | tiresize.com, level4x4 (Agilis LTX also 683) | confirmed |
| Free (unloaded) radius | 15.25 in / 387 mm | derived from 30.5 in | estimated |
| Effective rolling radius | 14.76 in / 375 mm (=63,360 / (683 x 2 pi)) | derived | estimated (rolling radius is the right number for wheel-speed/gearing) |
| Static loaded radius | ~14.2-14.4 in / 360-366 mm at full rated load | not found; typical 93-95% of free radius | estimated |
| Load rating | 3,042 lb single @ 80 psi (LT245/75R16 120/116R, Load Range E) | tires-easy listing | confirmed |

---

## 10. Typical chassis dyno hardware

All values `estimated` unless noted; no manufacturer spec sheet was reachable.

- **Mustang MD-AWD-500 (linked roller, in-ground):** capacity listed 3,000 whp? (a review listing says 3,000 whp), eddy-current air-cooled absorber(s), strain-gauge load cell, two 40,000 CFM fans, dual rear / triple front roller sets. Source: https://etesters.com/see/Dynos/?page=3 , https://dsportmag.com/the-tech/dyno-tech-guide-part-three-verdict-dyno-showcase/4 . Roller diameter and inertia not found.
- **Roller diameters from Mustang listings:** AWD-800 uses a single 24 in roller (low base inertia); MD-AWD-IMP-DE uses 50 in rollers; AWD-1750 uses 50 in rollers linked to sets of 12.625 in rollers. https://fiperformance.com/products/mustang-md-awd-imp-de-all-wheel-drive-dynamometer-for-sale
- **Eddy-current absorber capacity:** Mustang MD-7500 uses three air-cooled units rated up to 600 hp each (1,800 hp total); another model 900 hp braking per unit (same fiperformance/etesters listings).
- **Dynojet 224xLC:** not found. Estimated: twin 18-24 in diameter (45-60 cm) steel drums per axle-set, eddy-current Inertia/Load absorber ~1,500-2,000 hp class. Use a roller-diameter of 24 in (610 mm) for a Mustang-style truck dyno, 18-21 in for Dynojet.
- **Drum inertia (game default):** model an effective equivalent inertia of **~2,000 lb-ft^2 mass-referred (about 90 kg·m² at the roller) for a heavy-duty single-axle rear set**, derived from a 24 in x 36 in solid steel cylinder: mass ~4,600 lb, I = 0.5 m r^2 ~ 2,300 lb·ft² (97 kg·m²). Real hollow drums are lighter; Mustang inertia-mode adds/subtracts simulated mass.

---

## 11. Panel gaps / ergonomics (estimates only)

All `estimated` (not found in sources): GMT800 hood/door panel gap ~4-6 mm (known to be wide, ~5 mm typical); door height ~46-48 in (1,170-1,220 mm) from sill to roof; step-in height (door sill above ground, 4WD) ~22-24 in (560-610 mm) without running boards; steering wheel diameter ~15.0 in (380 mm); driver seat H-point height ~40 in (1,015 mm) above ground with 4WD ride height.

---

## 12. Gauge cluster, controls, Tow/Haul

I could not retrieve the 2005 owner's manual PDF (assets.gm.com returned 403). Only these were surfaced:

- **Tachometer (confirmed from manual excerpt on manualowl):** the 2005 manual says the tach on diesel and gasoline shows a dashed red zone and a solid red zone. Warning text about running above 6,000 rpm applies to the gas tach scale. https://www.manualowl.com/am/Chevrolet/2005-Silverado%202500%20Pickup/Manual/7117?page=117 (page also near 197, 381). Diesel scale endpoint not confirmed (my recollection: diesel tach is marked to 4 or 5 x1000, dashed red begins near governed rpm ~3,200). `estimated`
- **Tow/Haul button (confirmed, manual page excerpt):** a single tap toggles Tow/Haul; press-and-hold toggles Overdrive disable (per excerpt) https://www.manualowl.com/am/Chevrolet/2005-Silverado%202500%20Pickup/Manual/7117?page=197 . Manual cross-refers to "Grade Braking" under Tow/Haul (page 2-30) and a Tow/Haul Mode light (page 3-49). Behavior (background + excerpt): delays upshifts, raises shift pressure for firmer shifts, holds gears longer/ locks converter earlier, uses engine/downshift to slow on grades (Grade Braking).
- **Everything else `not found` in the sources; the following are the brief's values or my recollection, unverified:** speedometer 0-120 mph (km/h inner ring); coolant gauge ~160-260 F; trans temp gauge ~100-300 F (HD diesel gets a dedicated trans temp gauge); oil pressure ~0-100 or 0-120 psi (psi gauge, not just a light); voltmeter 9-19 V; fuel E-F with 26 gal diesel tank (confirmed 26 gal from brief). Diesel-specific lights: Wait To Start, Water in Fuel, Service Engine Soon.
- **Hood release:** lever at lower left of the dash (driver's footwell side), pops hood; then a secondary safety latch under the front of hood must be lifted by hand (standard GMT800; not verified from the manual here).
- **Tailgate:** pull handle / press button, gate drops and is supported by two cables; the tailgate can also be removed by lifting off the pins (standard GMT800; not verified).
- **Ignition positions:** LOCK, OFF/ACC, ON/RUN, START; diesel requires waiting for the Wait To Start lamp (glow plugs) to go out before cranking. Key must be in LOCK to remove (steering column mechanical lock). Not verified from manual.

---

## Items I could not confirm (summary)

Not found / only estimated: exact SB curb weight and weight distribution; track widths for SB (only LB value); approach/departure angles; overhangs; SB box inside length/height; tailgate height; turbo max shaft speed; stock peak boost; LLY stock rail-pressure table and injection timing/quantities; Allison 620 lb-ft rating (sources say 520/565; engine itself is rated 605); converter stall speed and torque ratio; stock whp/wheel-torque baseline (only forum anecdote); thermostat temp; cylinder pressure limit; glow-plug timing; SAE J1349 exact equations (the ISO/UN R85 diesel form is sourced; the J1349 JUN90/2004/2011 constants are from memory); Mustang/Dynojet roller diameter, inertia and absorber ratings for the specific models; the entire owner's manual gauge set (items 12), hood release, tailgate and ignition details.
