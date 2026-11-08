// Shop air and the SAE-style correction factor.
import { spec } from '../data/truckSpec.js';

// Magnus formula, saturation vapour pressure in kPa
export const satVapourKpa = (tC) => 0.61094 * Math.exp((17.625 * tC) / (tC + 243.04));

export function makeAir({ tempC = 24, pressureKpa = 101.0, humidityPct = 45 } = {}) {
  const pv = satVapourKpa(tempC) * (humidityPct / 100);
  const dryKpa = pressureKpa - pv;
  const T = tempC + 273.15;
  const rho = (dryKpa * 1000) / (287.05 * T) + (pv * 1000) / (461.5 * T);
  return { tempC, pressureKpa, humidityPct, vapourKpa: pv, dryKpa, rho, T };
}

// Compression-ignition correction factor, ISO 1585 / UN R85 form (the form SAE J1349 is aligned with):
//   alpha = fa^fm,  fa(turbo) = (99/ps)^0.7 * (T/298)^1.5,  fm = 0.3 (qc<40), 0.036*qc-1.14 (40..65), 1.2 (qc>65)
// ps = dry pressure kPa, T = intake air K, qc = fuelPerLitrePerCycleMg / pressureRatio.
// Reference conditions come from the spec (99 kPa dry, 25 C). Exponent details are `estimated` in ACCURACY.md.
export function correctionFactor(air, { turbo = true, qc = 40 } = {}) {
  const std = spec.dyno;
  const ps = air.dryKpa, T = air.tempC + 273.15, Tstd = std.saeStdTempC + 273.15;
  const fa = turbo ? Math.pow(std.saeStdDryPressureKpa / ps, 0.7) * Math.pow(T / Tstd, 1.5)
    : (std.saeStdDryPressureKpa / ps) * Math.pow(T / Tstd, 0.7);
  const fm = qc < 40 ? 0.3 : qc > 65 ? 1.2 : 0.036 * qc - 1.14;
  return Math.pow(fa, fm);
}

// Classic SAE J1349 (JUN90) spark-ignition style factor most chassis dyno software prints; offered for comparison
export function correctionFactorJun90(air) {
  return 1.18 * (99 / air.dryKpa) * Math.sqrt((air.tempC + 273.15) / 298) - 0.18;
}
