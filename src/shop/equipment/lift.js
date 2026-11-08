// Two-post floor-plate lift (no overhead beam): two yellow columns with carriages and three-stage-style swing arms,
// a hydraulic power unit with an UP button and lowering lever, and the drain pan + waste-oil barrel beside it.
import { THREE, Part, interactive, label } from './common.js';
import { foot } from './plan.js';

const CARRIAGE_MAX = 1.55;   // meters of rise (design value; real lifts reach about 1.8 m)
const SPEED = 0.35;          // m/s in game time

function buildColumn(M, side) {
  const P = new Part();
  const H = 3.4, w = 0.34, d = 0.46;
  P.box(M.yellow, w, H, d, 0, H / 2 + 0.012, 0, { r: 0.012 });
  // slot on the bay side (the carriage rides here): dark inset strip
  P.box(M.darkSteel, 0.012, H - 0.5, 0.18, -side * (w / 2 + 0.002), H / 2 + 0.2, 0);
  // base plate with anchor bolts
  P.box(M.darkSteel, 0.52, 0.02, 0.66, 0, 0.01, 0, { r: 0.004 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    P.cyl(M.chrome, 0.016, 0.024, sx * 0.21, 0.032, sz * 0.27, { seg: 6 });
    P.cyl(M.chrome, 0.008, 0.05, sx * 0.21, 0.058, sz * 0.27, { seg: 6 });
  }
  // top cap and sheave housing
  P.box(M.darkSteel, w + 0.02, 0.07, d + 0.02, 0, H + 0.047, 0, { r: 0.012 });
  P.box(M.black, 0.2, 0.12, 0.12, -side * 0.05, H + 0.14, 0, { r: 0.01 });
  // safety lock release: cable down the front with a knob
  P.rod(M.darkSteel, [-side * (w / 2 + 0.012), H - 0.15, 0.15], [-side * (w / 2 + 0.012), 1.5, 0.15], 0.003);
  P.sph(M.red, 0.018, -side * (w / 2 + 0.012), 1.48, 0.15);
  // fixed label plate
  P.box(M.paper, 0.001, 0.2, 0.3, side * (w / 2 + 0.001), 2.2, 0);
  return P;
}

function buildArm(M, longer) {
  const g = new THREE.Group();
  const P = new Part();
  const L1 = longer ? 0.95 : 0.8, L2 = longer ? 0.75 : 0.6;
  P.box(M.steel, 0.095, 0.08, L1, 0, 0.0, L1 / 2 + 0.02, { r: 0.01 });          // outer tube
  P.box(M.lightSteel, 0.07, 0.056, L2, 0, 0.0, L1 + L2 / 2 - 0.2, { r: 0.008 });  // sliding stage
  const tip = L1 + L2 - 0.2;
  // pad stack: adapter plate, thread, rubber pad
  P.cyl(M.darkSteel, 0.05, 0.03, 0, 0.055, tip - 0.04, { seg: 12 });
  P.cyl(M.chrome, 0.018, 0.05, 0, 0.085, tip - 0.04, { seg: 8 });
  P.cyl(M.rubber, 0.06, 0.04, 0, 0.12, tip - 0.04, { seg: 16 });
  P.torus(M.rubber, 0.045, 0.008, 0, 0.142, tip - 0.04, { axis: 'y', seg: 14, rseg: 5 });
  // pivot pin and collar at the carriage end
  P.cyl(M.darkSteel, 0.032, 0.11, 0, 0.0, 0.0, { seg: 12 });
  P.cyl(M.chrome, 0.012, 0.016, 0, 0.062, 0.0, { seg: 8 });
  // arm restraint gear segment
  P.box(M.black, 0.09, 0.025, 0.05, 0, 0.052, 0.08);
  P.build(g, { cast: false });
  return g;
}

export function buildLift(ctx) {
  const { M, group, interactables, updaters } = ctx;
  const W = foot('lift.colW'), E = foot('lift.colE');
  const lift = new THREE.Group(); lift.name = 'lift'; group.add(lift);
  label(lift, 'shop.lift');
  const cz = W.z;
  // floor plate between the columns (3/8 in steel with a ramped edge)
  const base = new Part();
  base.box(M.darkSteel, E.x - W.x + 0.34, 0.026, 0.5, (W.x + E.x) / 2, 0.013, cz, { r: 0.008 });
  base.box(M.steel, E.x - W.x - 0.3, 0.004, 0.2, (W.x + E.x) / 2, 0.027, cz); // wear strip / cable cover
  // equalizer cable running in the plate (visible entering the columns)
  base.build(lift, { cast: false });

  const carriages = [];
  for (const [col, side] of [[W, 1], [E, -1]]) {
    const colG = new THREE.Group(); colG.position.set(col.x, 0, col.z); lift.add(colG);
    const cp = buildColumn(M, side);
    cp.build(colG, { cast: true, name: 'liftColumn' });
    // carriage: rides on the bay side of the column
    const car = new THREE.Group(); car.position.set(col.x, 0.02, col.z); lift.add(car);
    const cpt = new Part();
    const bx = side === 1 ? 0.2 : -0.2;
    cpt.box(M.yellow, 0.07, 0.62, 0.5, bx - side * 0.0, 0.31, 0, { r: 0.008 });                       // carriage plate on the bay side
    cpt.box(M.yellow, 0.4, 0.62, 0.035, side * 0.03, 0.31, 0.2575, { r: 0.006 });                                 // cheeks around the column
    cpt.box(M.yellow, 0.4, 0.62, 0.035, side * 0.03, 0.31, -0.2575, { r: 0.006 });
    cpt.box(M.black, 0.075, 0.08, 0.2, bx, 0.02, 0);                                                    // slide blocks
    cpt.box(M.darkSteel, 0.06, 0.1, 0.14, bx + (side === 1 ? 0.05 : -0.05), 0.55, 0);                   // lock latch housing
    cpt.build(car, { cast: false, name: 'liftCarriage' });
    // swing arms: front pair longer, rear pair shorter (asymmetric style); stowed parallel to the posts
    const mk = (zEnd, longer) => {
      const arm = buildArm(M, longer);
      arm.position.set(bx + (side === 1 ? 0.05 : -0.05), 0.06, zEnd);
      arm.rotation.y = zEnd > 0 ? -side * 0.2 : Math.PI + side * 0.2;
      car.add(arm);
    };
    mk(0.3, false); mk(-0.3, true);
    carriages.push(car);
  }

  // ---- hydraulic power unit on the west column (outboard side) ----
  const pu = new THREE.Group(); pu.name = 'liftPower'; lift.add(pu);
  pu.position.set(W.x - 0.17 - 0.02, 0, W.z);
  const pp = new Part();
  pp.box(M.darkSteel, 0.012, 0.8, 0.5, -0.0, 0.95, 0);                                               // mounting plate
  pp.cyl(M.blue, 0.1, 0.34, -0.1, 0.78, 0.07, { axis: 'z', seg: 18 });                               // motor
  pp.cyl(M.darkSteel, 0.103, 0.03, -0.1, 0.78, 0.25, { axis: 'z', seg: 18 });
  pp.cyl(M.darkSteel, 0.095, 0.03, -0.1, 0.78, -0.12, { axis: 'z', seg: 18 });
  pp.box(M.black, 0.15, 0.1, 0.12, -0.1, 0.93, 0.12, { r: 0.008 });                                  // terminal box
  pp.box(M.black, 0.2, 0.32, 0.2, -0.12, 1.1, -0.12, { r: 0.012 });                                  // reservoir
  pp.cyl(M.yellow, 0.035, 0.04, -0.12, 1.28, -0.12, { seg: 12 });                                    // fill cap
  pp.box(M.cast, 0.12, 0.14, 0.12, -0.1, 0.62, -0.1);                                                // pump / valve block
  pp.cyl(M.chrome, 0.012, 0.1, -0.1, 0.55, -0.1, { axis: 'x', seg: 8 });
  // hoses: reservoir/valve block to the column cylinder, up the outboard side of the column
  pp.hose(M.black, [[-0.1, 0.7, -0.1], [-0.05, 0.9, -0.2], [-0.03, 1.5, -0.21], [-0.03, 2.4, -0.21], [-0.03, 3.3, -0.2], [0.06, 3.46, -0.1]], 0.012);
  pp.hose(M.black, [[-0.1, 0.62, -0.1], [-0.12, 0.5, -0.32], [-0.14, 0.4, -0.45]], 0.011);
  pp.build(pu, { cast: false });
  // control: UP push button and lowering lever
  const ctl = new THREE.Group(); ctl.position.set(-0.025, 1.18, 0.2); pu.add(ctl);
  const cp = new Part();
  cp.box(M.darkSteel, 0.05, 0.16, 0.1, 0, 0, 0, { r: 0.006 });
  cp.build(ctl, {});
  const upBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 14), M.green);
  upBtn.rotation.z = Math.PI / 2; upBtn.position.set(-0.04, 0.04, 0); ctl.add(upBtn);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8), M.red);
  lever.rotation.z = Math.PI / 2; lever.position.set(-0.075, -0.04, 0); ctl.add(lever);
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), M.red); leverKnob.position.set(-0.125, -0.04, 0); ctl.add(leverKnob);
  // power cord from the unit
  const cord = new Part(); cord.hose(M.black, [[-0.1, 0.93, 0.18], [-0.2, 0.6, 0.5], [-0.8, 0.02, 0.9]], 0.007); cord.build(pu);
  label(pu, 'shop.liftPower');
  const state = { h: 0, target: 0 };
  interactive(pu, () => (state.target > 0 ? 'Lower the lift' : 'Raise the lift'), (c) => {
    state.target = state.target > 0 ? 0 : CARRIAGE_MAX;
    c?.say?.(state.target > 0 ? 'Lift raising: carriages and arms rise' : 'Lift lowering');
  });
  interactables.push(pu);
  updaters.push((dt) => {
    if (state.h === state.target) return;
    const d = state.target - state.h;
    state.h += Math.sign(d) * Math.min(Math.abs(d), SPEED * dt);
    for (const c of carriages) c.position.y = 0.02 + state.h;
    lift.userData.height = state.h;
  });
  lift.userData.state = state;
  return lift;
}
