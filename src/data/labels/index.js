// Inspection labels live in data (PROMPT.md section 2): id -> { name, desc }.
// Each module owns its own file and the id prefix matching it (shop.*, truck.*, engine.*, interior.*, dyno.*, ailive.*).
import shop from './shop.js';
import truck from './truck.js';
import engine from './engine.js';
import interior from './interior.js';
import dyno from './dyno.js';

export const LABELS = { ...shop, ...truck, ...engine, ...interior, ...dyno };
export const labelFor = (id) => LABELS[id] || null;
