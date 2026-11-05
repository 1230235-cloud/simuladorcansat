import { MissionResult } from '../sim/flightLoop';

export interface Scene3DState {
  timeS: number;
  primaryZ: number;
  secondaryZ: number;
  isSeparated: boolean;
  bladeRpm: number;
  bladeSpinAngleRad: number;
  targetCircleDiameterM: number;
  vectors: {
    thrustN: number;
    comZ: number;
    relativeDistanceM: number;
  };
}

export function interpolateSceneStateAtTime(mission: MissionResult, t: number): Scene3DState {
  const frames = mission.telemetryFrames;
  if (frames.length === 0) {
    return {
      timeS: t,
      primaryZ: 0,
      secondaryZ: 0,
      isSeparated: false,
      bladeRpm: 0,
      bladeSpinAngleRad: 0,
      targetCircleDiameterM: 3.0,
      vectors: { thrustN: 0, comZ: 0, relativeDistanceM: 0 },
    };
  }

  // Find nearest frames around t
  let idx = 0;
  while (idx < frames.length - 1 && frames[idx + 1].timeS <= t) {
    idx++;
  }

  const f1 = frames[idx];
  const f2 = frames[Math.min(frames.length - 1, idx + 1)];
  const dt = f2.timeS - f1.timeS;
  const factor = dt > 0 ? Math.min(1.0, Math.max(0.0, (t - f1.timeS) / dt)) : 0;

  const primaryZ =
    f1.barometer.estimatedAltitudeM +
    factor * (f2.barometer.estimatedAltitudeM - f1.barometer.estimatedAltitudeM);

  const isSeparated = t >= mission.events.separationTimeS;
  let secondaryZ = primaryZ;
  if (isSeparated) {
    if (t >= mission.events.secondaryLandingTimeS) {
      secondaryZ = 0;
    } else {
      const sepDuration = mission.events.secondaryLandingTimeS - mission.events.separationTimeS;
      const progress = sepDuration > 0 ? (t - mission.events.separationTimeS) / sepDuration : 1;
      secondaryZ = Math.max(0, mission.events.separationAltitudeM * (1.0 - progress));
    }
  }

  const bladeRpm = f1.imu.rpmZ + factor * (f2.imu.rpmZ - f1.imu.rpmZ);
  const bladeSpinAngleRad = (bladeRpm * (2 * Math.PI) * t) / 60;

  // Physical aerodynamic thrust balances weight in autorotation: T_z ~ M1 * g * (RPM / RPM_eq)^2
  const thrustN = isSeparated && primaryZ > 0 ? Math.max(0.5, 2.91 * Math.min(1.2, bladeRpm / 2000)) : 0;
  const comZ = Math.max(0.05, primaryZ * 0.01 + 0.08);
  const relativeDistanceM = f1.relativeLocalization.distance3DM;

  return {
    timeS: t,
    primaryZ,
    secondaryZ,
    isSeparated,
    bladeRpm,
    bladeSpinAngleRad,
    targetCircleDiameterM: 3.0,
    vectors: {
      thrustN,
      comZ,
      relativeDistanceM,
    },
  };
}
