// Dev harness: node scripts/runDyno.mjs [tuneId] [regulator]
import { Plant } from '../src/sim/plant.js';
import { Dyno } from '../src/sim/dyno.js';
import { loadCal } from '../src/sim/calibrations.js';
const [tune = 'stock', reg = 'LLY', runs = '1'] = process.argv.slice(2);
const plant = new Plant({ cal: loadCal(tune), regulator: reg });
plant.setCalibration(loadCal(tune));
plant.startEngine(); plant.warm(198, 188);
const dyno = new Dyno(plant); dyno.strapAll(true); dyno.setFan(true);
for (let r = 0; r < +runs; r++) {
  dyno.startRun();
  const dt = 0.005; let steps = 0;
  while (!['done', 'refused', 'idle'].includes(dyno.phase) && steps < 100000) { dyno.update(dt); steps++; }
  const run = dyno.last;
  console.log(dyno.phase, dyno.message, 'sim s', (steps * dt).toFixed(1));
  if (run) {
    console.log(`tune ${run.tuneName} reg ${run.regulator} peak ${run.peakHp.toFixed(1)} whp @${run.peakHpRpm}  ${run.peakTq.toFixed(1)} lb-ft @${run.peakTqRpm} CF ${run.cf.toFixed(4)} maxEGT ${run.maxEgtF} boost ${run.maxBoostPsi} slip ${run.maxSlipRpm} turbo ${run.maxTurboKrpm}k railErr ${Math.round(run.railErrPsi)} pcyl ${run.maxCylPsi} transF ${Math.round(run.endTransF)} coolF ${Math.round(run.endCoolantF)}`);
    if (process.env.CURVE) console.table(run.points.filter((p, i) => i % 4 === 0).map((p) => ({ rpm: p.rpm, hp: +p.hp.toFixed(1), tq: +p.tq.toFixed(1) })));
  }
}
