// Lumped variable-geometry turbo model (Garrett GT3788VA class). Vane position v: 0 = open, 1 = closed.
import { P } from './params.js';
import { clamp } from './util.js';

const CP_AIR = 1005, CP_EXH = 1180, G_AIR = 0.2857, G_EXH = 0.2424;

export const prFromOmega = (omega, T1) => {
  const u = omega * P.compTipRadius;
  return Math.pow(1 + (P.psiEta * u * u) / (CP_AIR * T1), 1 / G_AIR);
};

export const omegaFromPr = (pr, T1) => {
  const x = (Math.pow(pr, G_AIR) - 1) * CP_AIR * T1 / P.psiEta;
  return Math.sqrt(Math.max(x, 0)) / P.compTipRadius;
};

export const compressorPowerW = (mAir, pr, T1) => (mAir * CP_AIR * T1 * (Math.pow(pr, G_AIR) - 1)) / P.compEta;
export const compressorOutletK = (pr, T1) => T1 * (1 + (Math.pow(pr, G_AIR) - 1) / P.compEta);

export const vaneArea = (v) => P.turbArea * (1 - P.vaneAreaGain * clamp(v, 0, 1));
export const turbineEta = (v) => P.turbEta - 0.12 * Math.pow(Math.abs(v - 0.45), 2) * 2;

// Back pressure after the turbine (downpipe, exhaust) in kPa absolute
export const exhaustBackKpa = (pAmb, mExh) => pAmb + 3 + P.backPressureK * Math.pow(mExh / 0.35, 2);

// Turbine inlet (drive) pressure from the Stodola-type flow relation
export const drivePressureKpa = (mExh, T3, p4, v) => {
  const a = (mExh * Math.sqrt(T3)) / vaneArea(v);
  return Math.sqrt(p4 * p4 + a * a);
};

// exhaust pulse energy matters at low flow (blowdown pulses are not captured by the steady-flow relation)
export const turbinePowerW = (mExh, T3, p3, p4, v) =>
  turbineEta(v) * mExh * CP_EXH * T3 * (1 - Math.pow(p4 / p3, G_EXH)) * (1 + P.pulseGain * Math.exp(-mExh / P.pulseFlow));

export const TURBO_CONST = { CP_AIR, CP_EXH };
