// Steady-state crank curve: hold each rpm at full pedal until the turbo settles (used by tests and the engine map view).
import { Powerplant } from './engine.js';
import { makeAir } from './atmos.js';

export function crankCurve(cal, { regulator = 'LBZ', rpms, pedal = 1, weather, seconds = 8, sound } = {}) {
  const air = makeAir(weather);
  const list = rpms || Array.from({ length: 27 }, (_, i) => 1000 + i * 100);
  return list.map((rpm) => {
    const pp = new Powerplant({ cal, regulator, air });
    if (sound) pp.sound = { ...sound };
    pp.omega = 5000;
    let o;
    for (let t = 0; t < seconds; t += 0.01) { o = pp.compute(rpm, { pedal }, 0.01); pp.advance(0.01); }
    return o;
  });
}

export function steadyPoint(cal, rpm, pedal, opts = {}) { return crankCurve(cal, { ...opts, rpms: [rpm], pedal })[0]; }
