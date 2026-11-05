import { computeIsaState } from '../physics/isa';

export type MissionPhase =
  | 'ASCENT'
  | 'DROP_COUPLED'
  | 'PRIMARY_AUTOROTATION'
  | 'POST_LANDING';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface AttitudeRad {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface BarometerData {
  pressurePa: number;
  temperatureC: number;
  estimatedAltitudeM: number;
}

export interface ImuData {
  accelMS2: Vector3D;
  gyroRadS: Vector3D;
  rpmZ: number;
  orientationRad: AttitudeRad;
}

export interface GpsCoordinates {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeM: number;
}

export type LocalizationMode = 'GPS_DIFFERENTIAL' | 'RSSI_IMU_BALLISTIC';

export interface RelativeLocalizationResult {
  mode: LocalizationMode;
  distance3DM: number;
  bearingRad: number;
  rssiDbm?: number;
  gpsCoordinates?: {
    primary: GpsCoordinates;
    secondary: GpsCoordinates;
  };
}

export interface TelemetryFrame {
  timeS: number;
  phase: MissionPhase;
  barometer: BarometerData;
  imu: ImuData;
  servoReleased: boolean;
  relativeLocalization: RelativeLocalizationResult;
  estimatedVelocityMS?: number;
}

export interface FrameGenerationParams {
  timeS: number;
  phase: MissionPhase;
  primaryPositionM: Vector3D;
  primaryVelocityMS: Vector3D;
  primaryAccelMS2: Vector3D;
  primaryAttitudeRad: AttitudeRad;
  omegaZRadS: number;
  secondaryPositionM: Vector3D;
  servoReleased: boolean;
  useGps: boolean;
}

export interface LocalizationParams {
  primaryPositionM: Vector3D;
  secondaryPositionM: Vector3D;
  useGps: boolean;
}

export interface TrajectorySummary {
  maxAltitudeM: number;
  estimatedVelocitiesMS: number[];
}

export function computeRelativeLocalization(params: LocalizationParams): RelativeLocalizationResult {
  const { primaryPositionM, secondaryPositionM, useGps } = params;

  const dx = secondaryPositionM.x - primaryPositionM.x;
  const dy = secondaryPositionM.y - primaryPositionM.y;
  const dz = secondaryPositionM.z - primaryPositionM.z;

  const distance3DM = Math.hypot(dx, dy, dz);
  const bearingRad = Math.atan2(dy, dx);

  if (useGps) {
    const refLat = 19.4326;
    const refLon = -99.1332;
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180);

    return {
      mode: 'GPS_DIFFERENTIAL',
      distance3DM,
      bearingRad,
      gpsCoordinates: {
        primary: {
          latitudeDeg: refLat + primaryPositionM.y / mPerDegLat,
          longitudeDeg: refLon + primaryPositionM.x / mPerDegLon,
          altitudeM: primaryPositionM.z,
        },
        secondary: {
          latitudeDeg: refLat + secondaryPositionM.y / mPerDegLat,
          longitudeDeg: refLon + secondaryPositionM.x / mPerDegLon,
          altitudeM: secondaryPositionM.z,
        },
      },
    };
  }

  const dEffective = Math.max(1.0, distance3DM);
  const rssiDbm = -30.0 - 10.0 * 2.2 * Math.log10(dEffective);

  return {
    mode: 'RSSI_IMU_BALLISTIC',
    distance3DM,
    bearingRad,
    rssiDbm,
  };
}

export function synthesizeTelemetryFrame(params: FrameGenerationParams): TelemetryFrame {
  const {
    timeS,
    phase,
    primaryPositionM,
    primaryVelocityMS,
    primaryAccelMS2,
    primaryAttitudeRad,
    omegaZRadS,
    secondaryPositionM,
    servoReleased,
    useGps,
  } = params;

  const isa = computeIsaState(primaryPositionM.z);
  const temperatureC = isa.temperatureK - 273.15;

  const barometer: BarometerData = {
    pressurePa: isa.pressurePa,
    temperatureC,
    estimatedAltitudeM: primaryPositionM.z,
  };

  const imu: ImuData = {
    accelMS2: { ...primaryAccelMS2 },
    gyroRadS: { x: 0, y: 0, z: omegaZRadS },
    rpmZ: (omegaZRadS * 60) / (2 * Math.PI),
    orientationRad: { ...primaryAttitudeRad },
  };

  const relativeLocalization = computeRelativeLocalization({
    primaryPositionM,
    secondaryPositionM,
    useGps,
  });

  return {
    timeS,
    phase,
    barometer,
    imu,
    servoReleased,
    relativeLocalization,
    estimatedVelocityMS: primaryVelocityMS.z,
  };
}

export function estimateVelocityAndMaxAltitudeFromTelemetry(
  frames: TelemetryFrame[]
): TrajectorySummary {
  let maxAltitudeM = 0;
  const estimatedVelocitiesMS: number[] = [];

  for (let i = 0; i < frames.length; i++) {
    const alt = frames[i].barometer.estimatedAltitudeM;
    if (alt > maxAltitudeM) {
      maxAltitudeM = alt;
    }

    if (frames[i].estimatedVelocityMS !== undefined) {
      estimatedVelocitiesMS.push(frames[i].estimatedVelocityMS!);
    } else if (i === 0) {
      estimatedVelocitiesMS.push(0);
    } else {
      const dt = frames[i].timeS - frames[i - 1].timeS;
      const dz =
        frames[i].barometer.estimatedAltitudeM - frames[i - 1].barometer.estimatedAltitudeM;
      estimatedVelocitiesMS.push(dt > 0 ? dz / dt : 0);
    }
  }

  return {
    maxAltitudeM,
    estimatedVelocitiesMS,
  };
}
