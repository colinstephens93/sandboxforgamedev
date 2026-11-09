import { ENGINE_LABELS } from '../../truck/engine/labels.js';
// Inspection labels for engine.* ids (defined with the geometry).
import { coreEngineLabels } from '../../truck/engine/detailedLabels.js';
export default { ...ENGINE_LABELS, ...coreEngineLabels() };
