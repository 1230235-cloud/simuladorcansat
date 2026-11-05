import { computeIsaState } from './isa';

export interface TrajectoryPoint {
  timeS: number;
  altitudeM: number;
  vzMS: number;
}

export interface FreeFallParams {
  massKg: number;
  diameterM: number;
  dropAltitudeM?: number;
  separationAltitudeM?: number;
  startAltitudeM?: number;
  initialVzMS?: number;
  dragCoefficient: number;
  dtS: number;
}

export interface FreeFallResult {
  initialAltitudeM: number;
  finalAltitudeM: number;
  elapsedTimeS: number;
  separationVelocityVzMS?: number;
  impactVelocityVzMS?: number;
  trajectory: TrajectoryPoint[];
}

const G = 9.80665;

export function simulateCoupledFreeFallToSeparation(params: FreeFallParams): FreeFallResult {
  const {
    massKg,
    diameterM,
    dropAltitudeM = 450,
    separationAltitudeM = 200,
    dragCoefficient,
    dtS = 0.01,
  } = params;

  const crossArea = Math.PI * Math.pow(diameterM / 2, 2);
  let t = 0;
  let h = dropAltitudeM;
  let vz = 0;

  const trajectory: TrajectoryPoint[] = [{ timeS: t, altitudeM: h, vzMS: vz }];

  while (h > separationAltitudeM) {
    const isa = computeIsaState(h);
    const dragForce = 0.5 * isa.densityKgM3 * dragCoefficient * crossArea * vz * vz;
    const accelZ = G - dragForce / massKg;

    vz += accelZ * dtS;
    h -= vz * dtS;
    t += dtS;

    trajectory.push({ timeS: t, altitudeM: Math.max(separationAltitudeM, h), vzMS: vz });
  }

  return {
    initialAltitudeM: dropAltitudeM,
    finalAltitudeM: h,
    elapsedTimeS: t,
    separationVelocityVzMS: vz,
    trajectory,
  };
}

export function simulateSecondaryFreeFallToGround(params: FreeFallParams): FreeFallResult {
  const {
    massKg,
    diameterM,
    startAltitudeM = 200,
    initialVzMS = 48.0,
    dragCoefficient,
    dtS = 0.01,
  } = params;

  // Secondary payload has streamlined / aspect-ratio corrected reference area:
  const crossArea = Math.PI * Math.pow(diameterM / 2, 2) * 0.3;
  let t = 0;
  let h = startAltitudeM;
  let vz = initialVzMS;

  const trajectory: TrajectoryPoint[] = [{ timeS: t, altitudeM: h, vzMS: vz }];

  while (h > 0) {
    const isa = computeIsaState(h);
    const dragForce = 0.5 * isa.densityKgM3 * dragCoefficient * crossArea * vz * vz;
    const accelZ = G - dragForce / massKg;

    vz += accelZ * dtS;
    h -= vz * dtS;
    t += dtS;

    trajectory.push({ timeS: t, altitudeM: Math.max(0, h), vzMS: vz });
  }

  return {
    initialAltitudeM: startAltitudeM,
    finalAltitudeM: Math.max(0, h),
    elapsedTimeS: t,
    impactVelocityVzMS: vz,
    trajectory,
  };
}
