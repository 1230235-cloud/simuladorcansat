export interface IsaState {
  altitudeM: number;
  temperatureK: number;
  pressurePa: number;
  densityKgM3: number;
}

// Standard sea level constants (ISA)
const T0 = 288.15; // K
const P0 = 101325; // Pa
const L = 0.0065; // Temperature lapse rate (K/m)
const G = 9.80665; // Gravity (m/s^2)
const R = 287.05287; // Gas constant for dry air (J/(kg*K))

export function computeIsaState(altitudeM: number): IsaState {
  const h = Math.max(0, altitudeM);
  const temperatureK = T0 - L * h;
  const pressurePa = P0 * Math.pow(temperatureK / T0, G / (R * L));
  const densityKgM3 = pressurePa / (R * temperatureK);

  return {
    altitudeM: h,
    temperatureK,
    pressurePa,
    densityKgM3,
  };
}
