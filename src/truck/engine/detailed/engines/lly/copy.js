const base = {
  category: 'ENGINE ASSEMBLY',
};

export function pistonCard(number, bankLabel) {
  return {
    ...base,
    id: `piston-${number}`,
    eyebrow: `RECIPROCATING ASSEMBLY · CYLINDER ${number}`,
    name: `Bowl-in-Piston · Cyl. ${number}`,
    material: 'High-silicon cast aluminum alloy',
    summary:
      'Oil-cooled, bowl-in-piston crown with a high-swirl combustion bowl and a steel top-ring insert. The piston pin axis is offset for reduced slap.',
    specs: [
      ['CYLINDER', `${number} · ${bankLabel}`],
      ['BORE', '103.00 mm / 4.055 in'],
      ['COMPRESSION', '17.5:1 (2004–05) / 16.8:1 (2006)'],
      ['RING PACK', '2 compression · 1 oil control'],
      ['PIN', 'Full-floating · 42 mm'],
      ['MATERIAL', 'Cast Al-Si alloy'],
    ],
  };
}

export function rodCard(number, bankLabel) {
  return {
    ...base,
    id: `rod-${number}`,
    eyebrow: `RECIPROCATING ASSEMBLY · CYLINDER ${number}`,
    name: `Fracture-Split Connecting Rod · Cyl. ${number}`,
    material: 'Forged alloy steel, fracture-split cap',
    summary:
      'Powder-forged or hot-forged steel I-beam connecting rod. The big end is fracture-split for perfect cap registry, then clamped with high-strength rod bolts.',
    specs: [
      ['CYLINDER', `${number} · ${bankLabel}`],
      ['BIG END', 'Fracture-split cap'],
      ['SMALL END', 'Full-floating pin bushing'],
      ['FASTENERS', 'Torque-to-yield rod bolts'],
      ['PROCESS', 'Shot-peened · forged steel'],
      ['FATIGUE DESIGN', 'High-load diesel duty'],
    ],
  };
}

export const COMPONENT_CARDS = {
  block: {
    ...base,
    eyebrow: 'CYLINDER BLOCK',
    name: 'Deep-Skirt Cast Gray Iron Block',
    material: 'Cast gray iron · induction-hardened',
    summary:
      'The LLY’s rigid 90-degree V8 crankcase uses a deep-skirt casting, cross-bolted main bearing caps and induction-hardened cylinder bores. The block forms the structural spine of the Duramax 6600.',
    specs: [
      ['DISPLACEMENT', '6,599 cc / 402.62 cu in'],
      ['CONFIGURATION', '90° V8 · OHV'],
      ['BORE × STROKE', '103.00 × 99.00 mm'],
      ['BORE/STROKE', '1.04 : 1 (oversquare)'],
      ['DECK HEIGHT', '9.57 in nominal'],
      ['MAIN CAPS', '5 × cast iron · 4-bolt'],
      ['MATERIAL', 'Gray iron, induction hardened'],
    ],
  },
  'main-caps': {
    ...base,
    eyebrow: 'BOTTOM END',
    name: 'Cast Iron Main Bearing Caps',
    material: 'Cast gray iron / tri-metal bearings',
    summary:
      'Five cross-bolted main caps locate the nitrided crankshaft. The deep-skirt block’s main webs and caps carry the firing loads of all eight cylinders.',
    specs: [
      ['QUANTITY', '5'],
      ['BEARINGS', 'Tri-metal main shells'],
      ['FASTENERS', 'Cross-bolted · 4 per cap'],
      ['JOURNAL Ø', '74 mm nominal'],
      ['CAP MATERIAL', 'Cast gray iron'],
    ],
  },
  crank: {
    ...base,
    eyebrow: 'ROTATING ASSEMBLY',
    name: 'Nitrided Forged Steel Crankshaft',
    material: 'Forged steel · nitrided journals',
    summary:
      'A four-throw, cross-plane V8 crankshaft with five main journals, radiused fillets and induction-hardened journals. Throw radius is exactly 49.5 mm for the 99 mm stroke.',
    specs: [
      ['STROKE', '99.00 mm / 3.897 in'],
      ['THROW RADIUS', '49.50 mm'],
      ['THROWS', '4 · paired rod journals'],
      ['MAIN JOURNALS', '5'],
      ['MATERIAL', 'Forged alloy steel'],
      ['SURFACE', 'Nitrided / induction hardened'],
      ['FLYWHEEL', 'Dual-mass compatible · 8 bolts'],
    ],
  },
  camshaft: {
    ...base,
    eyebrow: 'VALVETRAIN',
    name: 'Forged Steel Cam-in-Block Camshaft',
    material: 'Forged steel · hardfaced lobes',
    summary:
      'A single central camshaft runs at half crankshaft speed. Sixteen precision lobes operate the 32-valve OHV valvetrain through mechanical roller lifters and pushrods.',
    specs: [
      ['DRIVE', 'Gear-driven · 0.5× crank'],
      ['LOCATION', 'In block · central valley'],
      ['LOBES', '16 · mirrored intake/exhaust'],
      ['BEARINGS', '5 × steel-backed'],
      ['MATERIAL', 'Forged steel'],
      ['LOBE FINISH', 'Hardfaced / polished'],
    ],
  },
  pistons: {
    ...base,
    eyebrow: 'RECIPROCATING ASSEMBLY',
    name: 'Bowl-in-Piston Set',
    material: 'High-silicon cast aluminum alloy',
    specs: [
      ['BORE', '103.00 mm'],
      ['STROKE', '99.00 mm'],
      ['COMPRESSION', '17.5:1 / 16.8:1'],
      ['CROWN', 'High-swirl diesel bowl'],
      ['COOLING', 'Oil-cooled crown'],
    ],
    summary: 'Eight oil-cooled aluminium pistons convert combustion pressure into the 99 mm stroke. Each crown is machined with a re-entrant diesel combustion bowl and valve reliefs.',
  },
  rods: {
    ...base,
    eyebrow: 'RECIPROCATING ASSEMBLY',
    name: 'Fracture-Split Rod Set',
    material: 'Forged alloy steel',
    summary: 'Eight forged steel connecting rods with fracture-split big-end caps, full-floating bushes and high-strength rod bolts.',
    specs: [
      ['QUANTITY', '8 · one per cylinder'],
      ['CAP', 'Fracture-split · no dowels'],
      ['SMALL END', 'Floating pin bushing'],
      ['PROCESS', 'Forged · shot-peened'],
    ],
  },
  'cylinder-head-right': {
    ...base,
    eyebrow: 'PASSENGER-SIDE BANK · 1-3-5-7',
    name: 'Cast Aluminum Cylinder Head · Right',
    material: 'Cast aluminum alloy',
    summary:
      'Right-bank four-valve cylinder head. Each cylinder carries two intake and two exhaust valves operated by bridged rocker arms, a central cam and 8 pushrods.',
    specs: [
      ['CYLINDERS', '1 · 3 · 5 · 7'],
      ['VALVES', '16 (4 per cylinder)'],
      ['TYPE', 'OHV · cam-in-block'],
      ['INJECTOR', 'Bosch common-rail · centre'],
      ['GLOW PLUG', '1 per cylinder'],
      ['MATERIAL', 'Cast aluminum'],
    ],
  },
  'cylinder-head-left': {
    ...base,
    eyebrow: 'DRIVER-SIDE BANK · 2-4-6-8',
    name: 'Cast Aluminum Cylinder Head · Left',
    material: 'Cast aluminum alloy',
    summary:
      'Driver-side four-valve head, mirroring the right bank. The LLY uses a true OHV architecture with rocker shafts and valve bridges above each head.',
    specs: [
      ['CYLINDERS', '2 · 4 · 6 · 8'],
      ['VALVES', '16 (4 per cylinder)'],
      ['TYPE', 'OHV · cam-in-block'],
      ['INJECTOR', 'Bosch common-rail · centre'],
      ['GLOW PLUG', '1 per cylinder'],
      ['MATERIAL', 'Cast aluminum'],
    ],
  },
  valves: {
    ...base,
    eyebrow: '32-VALVE OHV SYSTEM',
    name: 'Intake & Exhaust Valves',
    material: 'Silicon-chromium steel / Inconel exhaust',
    summary:
      'Thirty-two poppet valves — four per cylinder — arranged as two intake and two exhaust valves. Each pair is linked by a hardened steel bridge.',
    specs: [
      ['TOTAL VALVES', '32'],
      ['PER CYLINDER', '2 intake + 2 exhaust'],
      ['INTAKE LIFT', '10.9 mm nominal'],
      ['EXHAUST LIFT', '10.4 mm nominal'],
      ['INTAKE MATERIAL', 'Silicon-chrome steel'],
      ['EXHAUST MATERIAL', 'Inconel alloy'],
    ],
  },
  'valve-bridges': {
    ...base,
    eyebrow: 'OHV VALVETRAIN',
    name: 'Valve Bridges',
    material: 'Hardened billet steel',
    summary:
      'Sixteen bridges span each pair of same-function valves. A central adjuster transfers rocker motion to both valve stems, carrying the LLY’s 32-valve capability in a pushrod package.',
    specs: [
      ['QUANTITY', '16 (8 per bank)'],
      ['VALVES PER BRIDGE', '2'],
      ['ADJUSTMENT', 'Ball-pivot set screw'],
      ['MATERIAL', 'Hardened steel'],
      ['WEAR PAD', 'Chilled / polished'],
    ],
  },
  rockers: {
    ...base,
    eyebrow: 'OHV VALVETRAIN',
    name: 'Rocker Arm & Shaft Assembly',
    material: 'Forged / cast steel',
    summary:
      'Sixteen rocker arms pivot on hardened shafts above the heads. Roller tips reduce friction at the valve bridges while a ball cup accepts each pushrod.',
    specs: [
      ['QUANTITY', '16 · 8 per bank'],
      ['SHAFTS', '4 · hardened steel'],
      ['TYPE', 'Pedestal-mounted rocker'],
      ['TIP', 'Roller / hardened pad'],
      ['RATIO', '1.5 : 1 nominal'],
    ],
  },
  pushrods: {
    ...base,
    eyebrow: 'OHV VALVETRAIN',
    name: 'Pushrods',
    material: 'Seamless chrome-moly steel tube',
    summary:
      'Sixteen oil-through pushrods transfer cam lift from the in-block roller lifters to the rocker arms. They are visible running through the valley and head castings.',
    specs: [
      ['QUANTITY', '16'],
      ['LENGTH', '259 mm nominal'],
      ['TYPE', 'Oil-through ball-end'],
      ['MATERIAL', 'Chrome-moly steel'],
      ['END FINISH', 'Hardened ball tips'],
    ],
  },
  lifters: {
    ...base,
    eyebrow: 'OHV VALVETRAIN',
    name: 'Mechanical Roller Lifters',
    material: 'Hardened steel body / roller bearing',
    summary:
      'Sixteen mechanical roller lifters track the central camshaft. Rollers and guide bars locate each lifter while oil passages feed the pushrod cups.',
    specs: [
      ['QUANTITY', '16'],
      ['TYPE', 'Mechanical roller'],
      ['GUIDE', 'Linked guide bar'],
      ['CAM', 'Central in-block'],
      ['SPEED', '0.5× crankshaft'],
    ],
  },
  valvetrain: {
    ...base,
    eyebrow: '32-VALVE OHV SYSTEM',
    name: 'Cam-in-Block OHV Valvetrain',
    material: 'Forged steel, hardened alloy & aluminum',
    summary:
      'One central in-block camshaft at 0.5× crank speed drives sixteen mechanical roller lifters, sixteen oil-through pushrods and sixteen shaft-mounted rockers. Each rocker operates a valve bridge over a pair of valves, for 32 valves in total.',
    specs: [
      ['ARCHITECTURE', 'OHV · cam-in-block'],
      ['CAMSHAFT', '1 · 16 lobes · 0.5× crank'],
      ['LIFTERS', '16 · mechanical roller'],
      ['PUSHRODS', '16 · chrome-moly'],
      ['ROCKERS', '16 · shaft-mounted'],
      ['VALVE BRIDGES', '16 · two valves each'],
      ['VALVES', '32 · 4 per cylinder'],
    ],
  },
  'valve-covers': {
    ...base,
    eyebrow: 'TOP END',
    name: 'Rocker / Valve Covers',
    material: 'Ceramic-coated die-cast aluminum / acoustic composite',
    summary:
      'Two large covers seal the LLY valvetrain and carry oil filler and breather provisions. These test-cell covers use a dark ceramic finish with machined identification rails and quick-release perimeter bolts.',
    specs: [
      ['QUANTITY', '2'],
      ['BANK COVERAGE', '4 cylinders each'],
      ['SEAL', 'Reusable perimeter gasket'],
      ['FASTENERS', 'M6 shoulder bolts'],
      ['OIL FILLER', 'Right-hand cover'],
    ],
  },
  turbo: {
    ...base,
    eyebrow: 'FORCED INDUCTION',
    name: 'Garrett GT3788VA VVT Turbocharger',
    material: 'Aluminum compressor · heat-tinted cast iron turbine',
    summary:
      'Water-cooled Garrett variable-vane turbocharger mounted at the rear of the engine valley. The GT3788VA uses an electronic vane actuator to spool quickly and control boost across the LLY’s operating range.',
    specs: [
      ['MODEL', 'Garrett GT3788VA'],
      ['CONTROL', 'Variable nozzle turbine (VVT)'],
      ['BEARING', 'Water-cooled journal bearing'],
      ['BOOST', 'up to ≈22 psi'],
      ['MAX SHAFT', '≈120,000 rpm'],
      ['LUBRICATION', 'Engine oil feed / drain'],
    ],
  },
  'intake-manifold': {
    ...base,
    eyebrow: 'AIR INDUCTION',
    name: 'Cast Aluminum Intake Plenum',
    material: 'Cast aluminum alloy',
    summary:
      'The intake manifold distributes compressor charge air to the eight ports and integrates EGR delivery and the intake air temperature / pressure sensor.',
    specs: [
      ['TYPE', 'Cast plenum · 8 runners'],
      ['CHARGE AIR', 'Intercooled'],
      ['EGR FEED', 'Metered · valve controlled'],
      ['SENSOR', 'TMAP combined'],
      ['MATERIAL', 'Cast aluminum'],
    ],
  },
  'charge-pipes': {
    ...base,
    eyebrow: 'AIR INDUCTION',
    name: 'Intercooler Charge Piping',
    material: 'Mandrel-bent aluminum / silicone couplers',
    summary:
      'Large-diameter mandrel-bent aluminum charge pipe routes compressor air to the intake manifold, with reinforced silicone couplers and constant-torque clamps.',
    specs: [
      ['SYSTEM', 'Air-to-air intercooler'],
      ['PIPE', '76 mm mandrel-bent aluminum'],
      ['COUPLING', '4-ply silicone / T-bolt clamps'],
      ['SENSOR', 'Boost pressure / temperature'],
    ],
  },
  'exhaust-manifold-right': {
    ...base,
    eyebrow: 'PASSENGER-SIDE BANK',
    name: 'Cast Exhaust Manifold · Right',
    material: 'High-silicon molybdenum cast iron',
    summary:
      'Right-bank four-port exhaust log in heat-resistant cast iron, finished with a heat-tint patina and connected to the VVT turbine inlet.',
    specs: [
      ['PORTS', '4'],
      ['OUTLET', 'Rear collector · up-pipe'],
      ['MATERIAL', 'Si-Mo cast iron'],
      ['FASTENERS', 'Stainless studs / copper nuts'],
      ['MAX EGT', '≈780 °C'],
    ],
  },
  'exhaust-manifold-left': {
    ...base,
    eyebrow: 'DRIVER-SIDE BANK',
    name: 'Cast Exhaust Manifold · Left',
    material: 'High-silicon molybdenum cast iron',
    summary:
      'Driver-bank four-port exhaust log in heat-resistant cast iron, connected to the VVT turbine inlet through a heat-tinted up-pipe.',
    specs: [
      ['PORTS', '4'],
      ['OUTLET', 'Rear collector · up-pipe'],
      ['MATERIAL', 'Si-Mo cast iron'],
      ['FASTENERS', 'Stainless studs / copper nuts'],
      ['MAX EGT', '≈780 °C'],
    ],
  },
  'up-pipes': {
    ...base,
    eyebrow: 'EXHAUST',
    name: 'Turbine Up-Pipes',
    material: 'Heat-tinted stainless / cast alloy',
    summary:
      'The up-pipes collect both exhaust manifolds and feed the turbine scroll. Slip joints and heat shielding accommodate thermal expansion.',
    specs: [
      ['TYPE', 'Dual up-pipe / collector'],
      ['INLET', 'Both 4-port exhaust logs'],
      ['OUTLET', 'GT3788VA turbine'],
      ['MATERIAL', 'Stainless steel with heat tint'],
    ],
  },
  egr: {
    ...base,
    eyebrow: 'EMISSIONS',
    name: 'Cooled EGR Valve & Cooler',
    material: 'Stainless cooler / cast aluminum valve',
    summary:
      'A water-cooled exhaust-gas cooler feeds a metered EGR valve mounted in the valley. Coolant passages and corrugated stainless tube lower combustion temperatures and NOx.',
    specs: [
      ['SYSTEM', 'Cooled EGR'],
      ['COOLER', 'Stainless tube / coolant jacket'],
      ['VALVE', 'Electronic butterfly / poppet'],
      ['ACTUATOR', '12 V smart actuator'],
      ['COOLANT', 'Engine coolant circuit'],
      ['FEED', 'Upstream of VVT turbine'],
    ],
  },
  cp3: {
    ...base,
    eyebrow: 'FUEL · BOSCH COMMON RAIL',
    name: 'Bosch CP3.3 High-Pressure Pump',
    material: 'Cast aluminum body / hardened steel internals',
    summary:
      'The Bosch CP3.3 radial-piston pump is driven from the engine timing train and supplies the common rails. A metering valve on the pump controls fuel delivery.',
    specs: [
      ['MODEL', 'Bosch CP3.3'],
      ['TYPE', '3 × radial piston'],
      ['DRIVE', 'Timing gear · displayed speed ratio illustrative'],
      ['PRESSURE', 'up to 23,000 psi (2004–05)'],
      ['PRESSURE', 'up to 26,000 psi (2006)'],
      ['CONTROL', 'Inlet metering valve'],
      ['LUBRICATION', 'Diesel fuel'],
    ],
  },
  'fuel-rails': {
    ...base,
    eyebrow: 'FUEL · COMMON RAIL',
    name: 'High-Pressure Common Rails',
    material: 'Forged stainless steel / high-pressure fittings',
    summary:
      'Two common rails store pressurised diesel at up to 26,000 psi and distribute it to eight injectors through illustrative high-pressure lines; actuation type is disputed in the recorded sources.',
    specs: [
      ['QUANTITY', '2 · one per bank'],
      ['PRESSURE', '23,000–26,000 psi'],
      ['SENSOR', 'Rail pressure sensor'],
      ['RELIEF', 'Pressure relief valve'],
      ['LINES', '8 × high-pressure steel / braided'],
    ],
  },
  'high-pressure-lines': {
    ...base,
    eyebrow: 'FUEL · 26,000 PSI CIRCUIT',
    name: 'High-Pressure Injector Lines',
    material: 'Cold-drawn steel / braided stainless',
    summary:
      'Eight high-pressure fuel lines connect the common rails to the injectors. Their swaged ends and vibration clamps are designed for 23,000–26,000 psi common-rail pressure.',
    specs: [
      ['LINES', '8'],
      ['WORKING PRESSURE', 'up to 26,000 psi'],
      ['CONSTRUCTION', 'Cold-drawn steel / braid'],
      ['CONNECTIONS', 'Swaged 60° cone'],
      ['DAMPING', 'Line clamps / anti-vibration'],
    ],
  },
  injectors: {
    ...base,
    eyebrow: 'BOSCH COMMON RAIL',
    name: 'Fuel Injectors · Actuation Disputed',
    material: 'Illustrative injector construction',
    summary:
      'Eight Bosch direct-injection units sit centrally in the combustion chambers. The brief uses piezoelectric terminology, but the recorded research favors solenoid actuation; injection stages shown by the model are illustrative.',
    specs: [
      ['QUANTITY', '8 · one per cylinder'],
      ['ACTUATION', 'Brief: piezoelectric; research favors solenoid'],
      ['NOZZLE', 'Revised seven-hole design (2006); earlier years unverified'],
      ['PRESSURE', 'up to 26,000 psi'],
      ['INJECTION', 'Pilot / main / post · illustrative'],
      ['FEED', 'Bosch common rail'],
    ],
  },
  'glow-plugs': {
    ...base,
    eyebrow: 'COLD START',
    name: 'Glow Plugs',
    material: 'Illustrative heater construction',
    summary:
      'One glow plug per cylinder preheats the combustion chamber for reliable cold starting. The glow-plug control module modulates heater current after start.',
    specs: [
      ['QUANTITY', '8'],
      ['POSITION', '1 per cylinder · exhaust side'],
      ['ELEMENT', 'Ceramic / sheathed shown · illustrative'],
      ['SUPPLY', 'Illustrative; factory voltage not established'],
      ['CONTROLLER', 'Glow plug control module'],
    ],
  },
  'oil-pan': {
    ...base,
    eyebrow: 'LUBRICATION',
    name: 'Oil Pan · Illustrative Construction',
    material: 'Illustrative; factory sump material unverified',
    summary:
      'The sump, ribs, material and drain details are illustrative; factory construction is not established by the recorded research. The LLY lubrication system carries 10 US quarts with a filter change.',
    specs: [
      ['CAPACITY', '10 US qt / 9.46 L'],
      ['MATERIAL', 'Cast aluminum shown · illustrative'],
      ['SEAL', 'Molded silicone gasket'],
      ['DRAIN', 'Illustrative drain hardware'],
      ['FEATURES', 'Windage tray · oil level sensor'],
    ],
  },
  'oil-filter': {
    ...base,
    eyebrow: 'LUBRICATION',
    name: 'ACDelco PF2232 Oil Filter',
    material: 'Steel canister / synthetic blend media',
    summary:
      'The spin-on ACDelco PF2232 full-flow filter removes soot and wear debris from the 10-quart oil charge. Mounted low on the driver-side oil cooler adapter housing for service access.',
    specs: [
      ['PART NUMBER', 'ACDelco PF2232'],
      ['TYPE', 'Spin-on full flow'],
      ['LOCATION', 'Driver side · lower block'],
      ['THREAD', 'M27 × 2.0'],
      ['MEDIA', 'High-efficiency synthetic blend'],
      ['OIL CHARGE', '10 US quarts'],
    ],
  },
  flywheel: {
    ...base,
    eyebrow: 'ROTATING ASSEMBLY',
    name: 'Flywheel / Flexplate',
    material: 'Cast iron / billet steel',
    summary:
      'The rear flywheel stores rotational energy and provides the dyno coupling face. It rotates at crankshaft speed and carries the starter ring gear.',
    specs: [
      ['MOUNT', '8-bolt crank flange'],
      ['RING GEAR', 'Illustrative; tooth count unverified'],
      ['COUPLING', 'Industrial dyno adapter'],
      ['BALANCE', 'Zero-balanced with crank'],
    ],
  },
  'front-drive': {
    ...base,
    eyebrow: 'FRONT ACCESSORY DRIVE',
    name: 'Timing Cover & Damper',
    material: 'Cast aluminum / elastomeric damper',
    summary:
      'Cast-aluminum front cover encloses the timing gears. A torsional damper with poly-V pulley drives the accessory belt and carries timing marks.',
    specs: [
      ['DAMPER', 'Elastomeric torsional'],
      ['PULLEY', '8-rib poly-V'],
      ['TIMING', 'Crank / cam gear train'],
      ['COVER', 'Cast aluminum'],
      ['ACCESSORIES', 'Water pump · alternator'],
    ],
  },
  'timing-gears': {
    ...base,
    eyebrow: 'TIMING DRIVE',
    name: 'Cam & Crank Timing Gears',
    material: 'Hardened steel',
    summary:
      'The gear train drives the camshaft at exactly half crankshaft speed while the displayed Bosch CP3.3 drive ratio is illustrative and unsourced. Timing marks and a keyed hub maintain valve and injection phasing.',
    specs: [
      ['CAM RATIO', '2:1 reduction'],
      ['CP3 RATIO', '1:1 shown · illustrative, unsourced'],
      ['GEAR TYPE', 'Helical / spur'],
      ['MATERIAL', 'Hardened steel'],
    ],
  },
  'starter-motor': {
    ...base,
    eyebrow: 'STARTING SYSTEM',
    name: 'Gear-Reduction Starter Motor',
    material: 'Cast aluminum nose / steel field housing',
    summary:
      'The displayed starter housing, reduction arrangement and electrical details are illustrative. Factory brand, pinion teeth and ring-gear teeth are not established by the recorded research.',
    specs: [
      ['VOLTAGE', '12 V shown · illustrative'],
      ['TYPE', 'Gear-reduction PMGR shown · illustrative'],
      ['PINION', 'Illustrative; pinion and ring-gear counts unverified'],
      ['POWER', 'Illustrative; factory rating unverified'],
      ['LOCATION', 'Passenger side · rear bellhousing'],
    ],
  },
  'wiring-harness': {
    ...base,
    eyebrow: 'ENGINE MANAGEMENT',
    name: 'Engine Wiring & Fluid Harness',
    material: 'Cross-linked rubber / braided stainless',
    summary:
      'Test-cell harness carrying injector, rail-pressure, VGT, EGR and sensor signals, plus turbo coolant and oil drain plumbing. Braided sections are specified for high-temperature zones.',
    specs: [
      ['HARNESS', 'Engine + dyno interface'],
      ['SIGNALS', 'Rail pressure · VGT · EGR · TMAP'],
      ['CONNECTORS', 'Sealed GT 150 / APEX'],
      ['TURBO FEED', 'Braided stainless'],
      ['ROUTING', 'Heat-sleeved · P-clipped'],
    ],
  },
  'exhaust-downpipe': {
    ...base,
    eyebrow: 'EXHAUST SYSTEM',
    name: 'Turbo Downpipe & Heat Wrap',
    material: 'Aluminized steel / stainless wrap',
    summary:
      'Downpipe carries turbine exhaust away from the valley toward the cell extraction system. The heat-wrapped section protects adjacent harness and coolant plumbing.',
    specs: [
      ['SYSTEM', 'Test-cell exhaust extraction'],
      ['BORE', '4 in / 102 mm'],
      ['MATERIAL', 'Aluminized steel'],
      ['INSULATION', 'Stainless heat wrap'],
      ['FLANGE', 'V-band · turbine outlet'],
    ],
  },
  'engine-mounts': {
    ...base,
    eyebrow: 'INSTALLATION',
    name: 'Engine Mount Brackets',
    material: 'Cast iron / elastomer isolators',
    summary:
      'Cast brackets and elastomeric isolators carry the 835 lb engine on the test cell bedplate while isolating firing pulses from the dyno frame.',
    specs: [
      ['QUANTITY', '2 main / 1 transmission'],
      ['ISOLATOR', 'Vulcanized natural rubber'],
      ['BRACKET', 'Cast iron'],
      ['LOAD', '835 lb engine + torque reaction'],
    ],
  },
  'test-stand': {
    ...base,
    eyebrow: 'DMAX TEST CELL · MORAINE, OHIO',
    name: 'Heavy-Duty Engine Test Stand',
    material: 'Fabricated structural steel',
    summary:
      'Welded industrial bedplate with engine isolation mounts, driveline guard, exhaust extraction and distributed DAQ. Designed to hold the LLY at steady state and transient operating points.',
    specs: [
      ['CELL', 'DMAX Engine Test Cell 04'],
      ['BEDPLATE', 'Hot-rolled welded steel'],
      ['DYNO', 'Eddy-current absorber'],
      ['COUPLING', 'Instrumented driveshaft'],
      ['RATED LOAD', '1,000 lb-ft / 4,000 rpm'],
    ],
  },
  dyno: {
    ...base,
    eyebrow: 'TEST CELL EQUIPMENT',
    name: 'Eddy-Current Dynamometer',
    material: 'Cast iron / copper field coils',
    summary:
      'The absorber applies controlled load to the LLY through an instrumented driveshaft. Torque is measured by a strain-gauge load cell in the reaction frame.',
    specs: [
      ['TYPE', 'Eddy-current / water-cooled'],
      ['ABSORPTION', 'up to 1,000 lb-ft'],
      ['SPEED', '0–4,000 rpm'],
      ['TORQUE', 'Load-cell reaction measurement'],
      ['COOLING', 'Closed-loop water'],
    ],
  },
};

export function engineSummary(firingOrder) {
  return {
    displacement: '6,599 cc / 402.62 CID',
    firingOrder,
    peakTorque: '605 lb-ft @ 1,600 rpm',
    peakPower: '310 hp @ 3,000 rpm',
    governed: '3,250 rpm',
  };
}
