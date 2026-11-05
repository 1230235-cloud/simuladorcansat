import { DualCanSatAssembly } from '../assembly/components';
import { computeMassProperties } from '../physics/massProperties';
import { computeMechanicalSeparation } from '../physics/separation';
import { getDefaultRotorConfig, computeAutorotationStep } from '../physics/autorotation';
import { computeIsaState } from '../physics/isa';
import { evaluateDualPayloadEggSurvival, DualImpactReport } from '../physics/impact';
import { TelemetryFrame, synthesizeTelemetryFrame } from './telemetry';

export interface MissionSimulationOptions {
  assembly: DualCanSatAssembly;
  dropAltitudeM: number;
  separationAltitudeM: number;
  targetCircleDiameterM: number;
  postLandingDurationS: number;
  dtS: number;
}

export interface MissionEvents {
  dropAltitudeM: number;
  dropHorizontalRadiusM: number;
  dropTimeS: number;
  separationAltitudeM: number;
  separationTimeS: number;
  secondaryLandingTimeS: number;
  primaryLandingTimeS: number;
}

export interface MissionResult {
  events: MissionEvents;
  primaryTouchdownVzMS: number;
  secondaryTouchdownVzMS: number;
  impactReport: DualImpactReport;
  telemetryFrames: TelemetryFrame[];
}

const G = 9.80665;

export function runFullMissionSimulation(options: MissionSimulationOptions): MissionResult {
  const {
    assembly,
    dropAltitudeM = 450.0,
    separationAltitudeM = 200.0,
    targetCircleDiameterM: _targetD = 3.0,
    postLandingDurationS = 10.0,
    dtS = 0.05,
  } = options;

  const massProps = computeMassProperties(assembly);
  const useGps = assembly.useGps;
  const rotor = getDefaultRotorConfig();
  const frames: TelemetryFrame[] = [];

  let timeS = 0;
  const pPos = { x: 0.1, y: 0.1, z: 0.0 };
  const sPos = { x: 0.1, y: 0.1, z: 0.0 };
  let pVz = 0;
  let sVz = 0;
  let pOmega = 0;
  let servoReleased = false;

  // 1. ASCENT: 0m -> dropAltitudeM
  const ascentSpeed = 10.0;
  while (pPos.z < dropAltitudeM) {
    pPos.z = Math.min(dropAltitudeM, pPos.z + ascentSpeed * dtS);
    sPos.z = pPos.z;
    timeS += dtS;

    frames.push(
      synthesizeTelemetryFrame({
        timeS,
        phase: 'ASCENT',
        primaryPositionM: { ...pPos },
        primaryVelocityMS: { x: 0, y: 0, z: ascentSpeed },
        primaryAccelMS2: { x: 0, y: 0, z: 0 },
        primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 },
        omegaZRadS: 0,
        secondaryPositionM: { ...sPos },
        servoReleased: false,
        useGps,
      })
    );
  }

  const dropTimeS = timeS;
  const dropHorizontalRadiusM = Math.hypot(pPos.x, pPos.y);

  // 2. DROP COUPLED: dropAltitudeM -> separationAltitudeM
  const coupledArea = Math.PI * Math.pow(assembly.primary.diameterM / 2, 2);
  const coupledCd = 0.75;
  const coupledMass = massProps.coupled.massKg;

  while (pPos.z > separationAltitudeM) {
    const isa = computeIsaState(pPos.z);
    const dragForce = 0.5 * isa.densityKgM3 * coupledCd * coupledArea * pVz * pVz;
    const accelZ = G - dragForce / coupledMass;

    const nextZ = pPos.z - pVz * dtS;
    if (nextZ <= separationAltitudeM) {
      const frac = (pPos.z - separationAltitudeM) / (pVz * dtS);
      const subDt = Math.max(0.001, frac * dtS);
      pVz += accelZ * subDt;
      pPos.z = separationAltitudeM;
      sPos.z = separationAltitudeM;
      timeS += subDt;
      break;
    }

    pVz += accelZ * dtS;
    pPos.z = nextZ;
    sPos.z = pPos.z;
    timeS += dtS;

    frames.push(
      synthesizeTelemetryFrame({
        timeS,
        phase: 'DROP_COUPLED',
        primaryPositionM: { ...pPos },
        primaryVelocityMS: { x: 0, y: 0, z: -pVz },
        primaryAccelMS2: { x: 0, y: 0, z: -accelZ },
        primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 },
        omegaZRadS: 0,
        secondaryPositionM: { ...sPos },
        servoReleased: false,
        useGps,
      })
    );
  }

  // 3. MECHANICAL SEPARATION at 200m
  servoReleased = true;
  const separationTimeS = timeS;
  const separationAltitudeActual = pPos.z;

  const sep = computeMechanicalSeparation({
    primaryMassKg: massProps.primaryDecoupled.massKg,
    secondaryMassKg: massProps.secondaryDecoupled.massKg,
    preSeparationVzMS: pVz,
    springImpulseNs: 0.35,
    separationAltitudeM: pPos.z,
  });

  pVz = sep.primaryPostVzMS;
  sVz = sep.secondaryPostVzMS;
  pOmega = 0.1;

  // 4. DUAL DESCENT: Primary with Autorotation, Secondary with Ballistic Free-Fall
  const sArea = Math.PI * Math.pow(assembly.secondary.diameterM / 2, 2) * 0.3;
  const sCd = 0.80;
  const sMass = massProps.secondaryDecoupled.massKg;
  let secondaryLanded = false;
  let secondaryLandingTimeS = 0;
  let secondaryTouchdownVzMS = 0;

  while (pPos.z > 0) {
    if (!secondaryLanded) {
      const isaSec = computeIsaState(sPos.z);
      const sDrag = 0.5 * isaSec.densityKgM3 * sCd * sArea * sVz * sVz;
      sVz += (G - sDrag / sMass) * dtS;
      sPos.z -= sVz * dtS;
      sPos.x += 0.05 * dtS;
      sPos.y += 0.05 * dtS;

      if (sPos.z <= 0) {
        sPos.z = 0;
        secondaryLanded = true;
        secondaryLandingTimeS = timeS;
        secondaryTouchdownVzMS = sVz;
      }
    }

    const step = computeAutorotationStep({
      vzMS: pVz,
      omegaRadS: pOmega,
      altitudeM: pPos.z,
      primaryMassKg: massProps.primaryDecoupled.massKg,
      primaryIzzKgM2: massProps.primaryDecoupled.izzKgM2,
      bodyDiameterM: assembly.primary.diameterM,
      rotor,
    });

    pOmega = Math.max(0.1, pOmega + step.angularAccelRadS2 * dtS);
    pVz += step.verticalAccelMS2 * dtS;
    pPos.z -= pVz * dtS;
    timeS += dtS;

    frames.push(
      synthesizeTelemetryFrame({
        timeS,
        phase: 'PRIMARY_AUTOROTATION',
        primaryPositionM: { ...pPos },
        primaryVelocityMS: { x: 0, y: 0, z: -pVz },
        primaryAccelMS2: { x: 0, y: 0, z: -step.verticalAccelMS2 },
        primaryAttitudeRad: { roll: 0.01, pitch: 0.01, yaw: timeS * 0.1 },
        omegaZRadS: pOmega,
        secondaryPositionM: { ...sPos },
        servoReleased,
        useGps,
      })
    );
  }

  pPos.z = 0;
  const primaryLandingTimeS = timeS;
  const primaryTouchdownVzMS = pVz;

  const impactReport = evaluateDualPayloadEggSurvival({
    primaryMassKg: massProps.primaryDecoupled.massKg,
    primaryTouchdownVzMS,
    secondaryMassKg: massProps.secondaryDecoupled.massKg,
    secondaryTouchdownVzMS: secondaryTouchdownVzMS || 42.5,
  });

  // 5. POST-LANDING
  const postEnd = timeS + postLandingDurationS + dtS;
  while (timeS <= postEnd) {
    timeS += dtS;
    pOmega = Math.max(0, pOmega - 20.0 * dtS);

    frames.push(
      synthesizeTelemetryFrame({
        timeS,
        phase: 'POST_LANDING',
        primaryPositionM: { ...pPos },
        primaryVelocityMS: { x: 0, y: 0, z: 0 },
        primaryAccelMS2: { x: 0, y: 0, z: 0 },
        primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 },
        omegaZRadS: pOmega,
        secondaryPositionM: { ...sPos },
        servoReleased,
        useGps,
      })
    );
  }

  return {
    events: {
      dropAltitudeM,
      dropHorizontalRadiusM,
      dropTimeS,
      separationAltitudeM: separationAltitudeActual,
      separationTimeS,
      secondaryLandingTimeS,
      primaryLandingTimeS,
    },
    primaryTouchdownVzMS,
    secondaryTouchdownVzMS,
    impactReport,
    telemetryFrames: frames,
  };
}
