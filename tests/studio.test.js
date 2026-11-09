import { describe, it, expect } from 'vitest';
import { cullDecision } from '../src/truck/culling.js';

// The rule the game and the truck studio share for skipping parts nobody can see (src/truck/culling.js).
describe('truck hidden-part culling', () => {
  const base = { camY: 1.7, camZ: 3, bayFrontZ: -1, hoodMoved: false };
  it('hides the engine bay and the underbody for a standing viewer beside a closed hood', () => {
    expect(cullDecision(base)).toEqual({ showBay: false, showUnder: false });
  });
  it('shows the engine bay when the hood is open or moving', () => {
    expect(cullDecision({ ...base, hoodMoved: true }).showBay).toBe(true);
  });
  it('shows the engine bay from in front of the grille and from a low camera', () => {
    expect(cullDecision({ ...base, camZ: -2 }).showBay).toBe(true);
    expect(cullDecision({ ...base, camY: 0.9 }).showBay).toBe(true);
  });
  it('shows the underbody only from a low camera', () => {
    expect(cullDecision({ ...base, camY: 1.2 }).showUnder).toBe(true);
    expect(cullDecision({ ...base, camY: 1.31 }).showUnder).toBe(false);
  });
  it('draws everything while warming up so every shader compiles during loading', () => {
    expect(cullDecision({ ...base, warm: true })).toEqual({ showBay: true, showUnder: true });
  });
});
