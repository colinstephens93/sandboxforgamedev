import { REAR_LABELS } from '../../truck/rear.js';
import { WHEEL_LABELS } from '../../truck/wheels.js';
import { UNDERSIDE_LABELS } from '../../truck/underside.js';
// Inspection labels for truck.* ids. Each module defines its own labels next to the geometry.
export default { ...REAR_LABELS, ...UNDERSIDE_LABELS, ...WHEEL_LABELS };
