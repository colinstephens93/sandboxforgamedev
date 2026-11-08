// Layout of the 2005 LLY engine bay, truck frame in INCHES: x lateral (+ passenger), y up, s rearward of the front axle (+Z).
// Positions of every labeled part come from the supplement's Engine Compartment Overview (reference/manuals/lly-engine-compartment-diagram.png,
// drawn from the FRONT of the truck, so the drawing's left is the passenger side), measured from pixel positions (bay centerline at drawing
// x = 410 px, about 12.5 px per inch, rear wall at the top of the drawing) and cross-checked with IMG_2863 to 2865 and 2874 to 2877.
// Pure data, no three.js: tests/engine.test.js checks the left-to-right order against the diagram.
import { hoodHalfWidth, hoodHeight } from '../skin.js';

export const GAP_IN = 4.5 / 25.4;

// Ordered fixed stations
export const BAY = {
  supportS0: -31.0, supportS1: -28.4, // radiator support upper crossbar (behind the grille back panel)
  firewallS: (y) => (y >= 50 ? 21.6 : y >= 44 ? 24.4 - (y - 44) * (2.8 / 6) : y >= 30 ? 24.4 : 24.4 + (30 - y) * 0.6), // firewall: s at height y (near vertical, sloping back toward the toe board)
  apronHalf: (s) => hoodHalfWidth(s) - 1.8, // inner fender apron top wall
  apronTopY: (s) => hoodHeight(s, hoodHalfWidth(s) + GAP_IN) - 0.55 - 1.2,
};

export const HINGE = { pivotS: 19.5, pivotY: 54.0, openAngleMaxDeg: 70, halfSpan: 24.0 };

// The labeled parts: c = center (x, y, s); the diagram letter and the pixel position it was measured from are in the comment.
export const POS = {
  // A air cleaner: front passenger corner, drawing px (90..210, 360..440)
  airbox: { x: 20.0, y: 38.0, s: -18.0, w: 8.8, h: 8.0, l: 16.0, letter: 'A' },
  // B coolant surge tank, directly behind the air cleaner, px (100..190, 316..360), cap at its inboard rear corner
  surgeTank: { x: 20.0, y: 38.0, s: -1.2, w: 8.8, h: 9.0, l: 12.0, letter: 'B' },
  surgeCap: { x: 17.6, y: 43.4, s: 3.0, letter: 'B' },
  // C passenger battery behind the surge tank (px 110..190, 232..290); driver battery in front of the fuse block (px 620..720, 410..435)
  batteryPass: { x: 19.2, y: 33.5, s: 11.5, w: 10.25, h: 7.7, l: 7.0, letter: 'C' },
  batteryDriver: { x: -19.2, y: 33.2, s: -3.5, w: 10.25, h: 7.7, l: 7.0, letter: 'C' },
  // D restriction indicator on the intake tube next to the air cleaner outlet (px 203, 377)
  restriction: { x: 16.4, y: 42.4, s: -8.0, letter: 'D' },
  // E engine oil dipstick: loop on the passenger side of the engine front (px 227, 345, about +14 in; moved in to +13 to clear the alternator)
  dipstickOil: { x: 13.0, y: 35.4, s: -9.0, letter: 'E' },
  // F Allison dipstick: rear of the bay, just passenger of center at the firewall (px 300, 270): taken from the diagram (the brief said driver side)
  dipstickTrans: { x: 9.6, y: 39.6, s: 21.2, letter: 'F' },
  // G oil fill cap: tall neck at the front of the engine, just driver side of the alternator (px 373, 380)
  oilCap: { x: 3.6, y: 34.6, s: -9.6, letter: 'G' },
  // H engine fan: behind the radiator, centered (label leader ends at px 390, 430)
  fan: { x: 0.0, y: 31.2, s: -19.0, letter: 'H' },
  // I power steering reservoir (px 510, 390), J remote negative (px 532, 380), K remote positive (px 560, 400): lined up toward the driver side
  psReservoir: { x: -10.0, y: 37.6, s: -10.0, letter: 'I' },
  remoteNeg: { x: -11.6, y: 34.2, s: -8.9, letter: 'J' },
  remotePos: { x: -14.2, y: 30.8, s: -9.0, letter: 'K' },
  // L brake reservoir on the master cylinder at the driver firewall (px 560..630, 300..490)
  brakeReservoir: { x: -14.6, y: 47.7, s: 14.8, letter: 'L' },
  // N underhood fuse block: big box behind the driver battery (px 650..740, 400..600)
  fuseBlock: { x: -21.0, y: 36.0, s: 12.0, w: 10.5, h: 9.0, l: 13.0, letter: 'N' },
  // O washer fluid filler neck, front driver corner (px 700, 440)
  washerCap: { x: -23.0, y: 35.6, s: -12.4, letter: 'O' },
};

// Engine geometry
export const ENGINE = {
  crank: { x: 0, y: 21.5, s: -3.0 },
  bankS0: -8.0, bankS1: 12.5,
  coverFrontS: -4.0, coverRearS: 10.5,
  turbo: { x: 0, y: 37.0, s: 15.0 },
  firewallClearS: 24.4,
};

// diagram order helpers (used by tests): positive x is the passenger side
export function leftToRightOrder(keys) { return [...keys].sort((a, b) => POS[b].x - POS[a].x); }
