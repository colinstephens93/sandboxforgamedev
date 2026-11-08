// Inspection labels for the dyno hardware (merged by the integrator into src/data/labels/dyno.js).
export const DYNO_LABELS = {
  'dyno.pit': {
    name: 'Dyno pit',
    desc: 'Concrete in-ground pit that holds the rollers and absorber so the drum tops sit at floor level; steel curb, hazard paint, ladder and rails keep people out of it.',
  },
  'dyno.rollers': {
    name: 'Dyno rollers',
    desc: 'Two 24 in knurled steel drums per rear tire (36 in long) on pillow-block bearings; the tire rides in the cradle and drives them, the rotating mass is the inertia load.',
  },
  'dyno.absorber': {
    name: 'Eddy-current absorber and flywheel',
    desc: 'Air-cooled eddy-current brake with a torque arm on a load cell, plus an inertia flywheel; the dyno reads load torque from the cell and roller speed from the shaft encoder.',
  },
  'dyno.chocks': {
    name: 'Wheel chocks',
    desc: 'Rubber wedge chocks in front of the front tires so the truck cannot creep forward off the rollers; they back up the tie-down straps.',
  },
  'dyno.strap': {
    name: 'Ratchet tie-down strap',
    desc: 'Two-inch ratchet strap from a tow hook or frame point to a floor D-ring; four of them hold the truck down and centered on the rollers during a pull.',
  },
  'dyno.fan': {
    name: 'High-velocity cooling fan',
    desc: 'Four-foot cage-guarded fan in front of the grille that stands in for road wind so the radiator, intercooler and transmission cooler see real airflow.',
  },
  'dyno.hose': {
    name: 'Exhaust extraction hose',
    desc: 'Four-inch corrugated hose from an overhead reel with a rubber cone that slips over the tailpipe and carries the diesel exhaust out of the shop.',
  },
  'dyno.weather': {
    name: 'Weather station',
    desc: 'Measures air temperature, barometric pressure and relative humidity near the truck; the dyno software uses them for the SAE J1349 correction factor.',
  },
  'dyno.stand': {
    name: 'Dyno control stand',
    desc: 'Rolling operator desk with the dyno computer and live graph, emergency stop, and throttle and load controls; cables run to the pit.',
  },
};
export default DYNO_LABELS;
