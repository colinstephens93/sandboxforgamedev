// Inspection labels for the detailed long block (engine.core_*), written from the component descriptions that come with
// the model (./detailed/engines/lly/copy.js). No three.js here, so the label table can be loaded on its own.
import entry from './detailed/engines/lly/index.js';
import { COMPONENT_CARDS, pistonCard, rodCard } from './detailed/engines/lly/copy.js';

export const CORE_LABEL = (partId) => `engine.core_${partId.replace(/-/g, '_')}`;

// Inspection labels (id -> { name, desc }) written from that repo's component descriptions.
export function coreEngineLabels() {
  const out = {}, card = (id, c) => { if (c) out[CORE_LABEL(id)] = { name: c.name, desc: c.summary }; };
  for (const [id, c] of Object.entries(COMPONENT_CARDS)) if (id !== 'test-stand' && id !== 'dyno') card(id, c);
  const bank = Object.fromEntries(entry.layout.banks.map((b) => [b.id, b.label]));
  for (const c of entry.layout.cylinders) { card(`piston-${c.number}`, pistonCard(c.number, bank[c.bank])); card(`rod-${c.number}`, rodCard(c.number, bank[c.bank])); }
  return out;
}
