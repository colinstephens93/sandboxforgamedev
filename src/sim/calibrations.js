// Assembles the calibrations: templates (shape) + calFit.json (fitted tables).
import fit from '../data/calFit.js';
import { TEMPLATES, RPM_NODES, TUNE_ORDER } from './calTemplates.js';

const tbl = (ys) => ({ x: RPM_NODES, y: ys.slice() });
export function buildCal(id) {
  const t = TEMPLATES[id]; const f = fit[id];
  if (!t || !f) throw new Error('No calibration fit for ' + id);
  return {
    ...t,
    fuel: tbl(f.fuel), timing: tbl(t.timing), rail: tbl(t.railPsi), boost: tbl(t.boostPsi), torqueLimit: tbl(t.torqueLimit),
    vane: { x: RPM_NODES, light: RPM_NODES.map(() => t.vaneLight), full: f.vaneFull.slice() },
  };
}
export const loadCal = buildCal;
export { TUNE_ORDER, RPM_NODES };
