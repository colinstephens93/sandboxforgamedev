// Procedural audio for the Duramax Dyno Shop (Web Audio only, no sound files).
export { AudioEngine } from './AudioEngine.js';
export * from './mapping.js';
export { FiringScheduler, PulseScheduler, NodeBudget, LOOKAHEAD, MAX_GRAIN_HZ, NODE_BUDGET_PER_SEC } from './scheduler.js';
import { RECIPES } from './oneshots.js';
export const ONE_SHOT_NAMES = Object.keys(RECIPES);
export { ALIASES as ONE_SHOT_ALIASES } from './oneshots.js';
export { renderImpulseResponse, schroederRt60, renderKnock } from './dsp.js';
