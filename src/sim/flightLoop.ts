import { DualCanSatAssembly } from '../assembly/components';
import { computeMassProperties } from '../physics/massProperties';
import { computeMechanicalSeparation } from '../physics/separation';
import { getDefaultRotorConfig, computeAutorotationStep } from '../physics/autorotation';
import { computeIsaState } from '../physics/isa';
import { evaluateDualPayloadEggSurvival, DualImpactReport } from '../physics/impact';
import { TelemetryFrame, synthesizeTelemetryFrame } from './telemetry';
import { FailureConfig, initFailureState } from '../physics/failures';

export type { FailureConfig };

export interface MissionSimulationOptions {
  assembly: DualCanSatAssembly;
  dropAltitudeM?: number;
  separationAltitudeM?: number;
  targetCircleDiameterM?: number;
  postLandingDurationS?: number;
  dtS?: number;
  failureConfig?: FailureConfig;
}

export interface MissionEvents {
  dropAltitudeM: number;
  dropHorizontalRadiusM: number;
  dropTimeS: number;
  separationAltitudeM: number;
  separationTimeS: number;
  secondaryLandingTimeS: number;
  primaryLandingTimeS: number;
  primaryLandingRadiusM?: number;
  landedInsideTarget?: boolean;
  servoJammed?: boolean;
  maxTiltDeg?: number;
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
  const { assembly, dropAltitudeM = 450.0, separationAltitudeM = 200.0, targetCircleDiameterM = 3.0, postLandingDurationS = 10.0, dtS = 0.05, failureConfig } = options;
  const massProps = computeMassProperties(assembly);
  const useGps = assembly.useGps;
  const rotor = getDefaultRotorConfig();
  const fail = initFailureState(failureConfig);
  const secondaryHasRf = assembly.secondary.components.some((c) => c.category === 'avionics' || (c.category === 'sensor' && c.id.includes('GPS')));
  const frames: TelemetryFrame[] = [];

  let timeS = 0;
  const pPos = { x: 0.1, y: 0.1, z: 0.0 };
  const sPos = { x: 0.1, y: 0.1, z: 0.0 };
  let pVz = 0, sVz = 0, pOmega = 0, servoReleased = false;

  // 1. ASCENT
  while (pPos.z < dropAltitudeM) {
    pPos.z = Math.min(dropAltitudeM, pPos.z + 10.0 * dtS);
    sPos.z = pPos.z;
    timeS += dtS;
    frames.push(synthesizeTelemetryFrame({
      timeS, phase: 'ASCENT', primaryPositionM: { ...pPos }, primaryVelocityMS: { x: 0, y: 0, z: 10.0 }, primaryAccelMS2: { x: 0, y: 0, z: 0 },
      primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 }, omegaZRadS: 0, secondaryPositionM: { ...sPos }, servoReleased: false, useGps, secondaryHasRf,
    }));
  }

  const dropTimeS = timeS;
  const coupledArea = Math.PI * Math.pow(assembly.primary.diameterM / 2, 2);
  const coupledCd = 0.75, coupledMass = massProps.coupled.massKg;

  const targetSepAlt = failureConfig?.pinFrictionJam === 'LATE_DEPLOYMENT'
    ? Math.max(20.0, separationAltitudeM * 0.5)
    : separationAltitudeM;

  // 2. DROP COUPLED
  while (pPos.z > targetSepAlt) {
    const isa = computeIsaState(pPos.z);
    const accelZ = G - (0.5 * isa.densityKgM3 * coupledCd * coupledArea * pVz * pVz) / coupledMass;
    const nextZ = pPos.z - pVz * dtS;
    pPos.x += fail.horizontalSpeedMS * dtS;
    sPos.x = pPos.x;

    if (nextZ <= targetSepAlt) {
      const frac = (pPos.z - targetSepAlt) / (pVz * dtS);
      const subDt = Math.max(0.001, frac * dtS);
      pVz += accelZ * subDt;
      pPos.z = targetSepAlt;
      sPos.z = targetSepAlt;
      timeS += subDt;
      break;
    }
    pVz += accelZ * dtS;
    pPos.z = nextZ;
    sPos.z = pPos.z;
    timeS += dtS;
    frames.push(synthesizeTelemetryFrame({
      timeS, phase: 'DROP_COUPLED', primaryPositionM: { ...pPos }, primaryVelocityMS: { x: fail.horizontalSpeedMS, y: 0, z: -pVz },
      primaryAccelMS2: { x: 0, y: 0, z: -accelZ }, primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 }, omegaZRadS: 0, secondaryPositionM: { ...sPos }, servoReleased: false, useGps, secondaryHasRf,
    }));
  }

  // 3. MECHANICAL SEPARATION OR PIN JAM
  let separationTimeS = timeS, separationAltitudeActual = pPos.z;
  let secondaryLandingTimeS = 0, secondaryTouchdownVzMS = 0;
  let primaryLandingTimeS = 0, primaryTouchdownVzMS = 0;

  if (fail.servoJammed) {
    // Separation failed completely: stay coupled and crash at terminal velocity
    while (pPos.z > 0) {
      const isa = computeIsaState(pPos.z);
      const accelZ = G - (0.5 * isa.densityKgM3 * coupledCd * coupledArea * pVz * pVz) / coupledMass;
      pVz += accelZ * dtS;
      pPos.z = Math.max(0, pPos.z - pVz * dtS);
      pPos.x += fail.horizontalSpeedMS * dtS;
      sPos.z = pPos.z;
      sPos.x = pPos.x;
      timeS += dtS;
      frames.push(synthesizeTelemetryFrame({
        timeS, phase: 'DROP_COUPLED', primaryPositionM: { ...pPos }, primaryVelocityMS: { x: fail.horizontalSpeedMS, y: 0, z: -pVz },
        primaryAccelMS2: { x: 0, y: 0, z: -accelZ }, primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 }, omegaZRadS: 0, secondaryPositionM: { ...sPos }, servoReleased: false, useGps, secondaryHasRf,
      }));
    }
    primaryTouchdownVzMS = Math.abs(pVz);
    secondaryTouchdownVzMS = Math.abs(pVz);
    secondaryLandingTimeS = timeS;
    primaryLandingTimeS = timeS;
    separationAltitudeActual = 0;
  } else {
    servoReleased = true;
    const sep = computeMechanicalSeparation({
      primaryMassKg: massProps.primaryDecoupled.massKg, secondaryMassKg: massProps.secondaryDecoupled.massKg, preSeparationVzMS: pVz, springImpulseNs: 0.35, separationAltitudeM: pPos.z,
    });
    pVz = sep.primaryPostVzMS;
    sVz = sep.secondaryPostVzMS;
    pOmega = 0.1;

    // 4. DUAL DESCENT
    const sArea = Math.PI * Math.pow(assembly.secondary.diameterM / 2, 2) * 0.3;
    const sCd = 0.80, sMass = massProps.secondaryDecoupled.massKg;
    let sLanded = sPos.z <= 0;
    let pLanded = pPos.z <= 0;
    if (sLanded) { secondaryLandingTimeS = timeS; secondaryTouchdownVzMS = Math.abs(sVz); }
    if (pLanded) { primaryLandingTimeS = timeS; primaryTouchdownVzMS = Math.abs(pVz); }

    while (!pLanded || !sLanded) {
      if (!sLanded) {
        const isaSec = computeIsaState(sPos.z);
        sVz += (G - (0.5 * isaSec.densityKgM3 * sCd * sArea * sVz * sVz) / sMass) * dtS;
        sPos.z -= sVz * dtS;
        sPos.x += (fail.horizontalSpeedMS + 0.05) * dtS;
        if (sPos.z <= 0) {
          sPos.z = 0;
          sLanded = true;
          secondaryLandingTimeS = timeS;
          secondaryTouchdownVzMS = Math.abs(sVz);
        }
      }

      let stepVertAccel = 0;
      if (!pLanded) {
        const step = computeAutorotationStep({
          vzMS: pVz, omegaRadS: pOmega, altitudeM: pPos.z, primaryMassKg: massProps.primaryDecoupled.massKg, primaryIzzKgM2: massProps.primaryDecoupled.izzKgM2, bodyDiameterM: assembly.primary.diameterM, rotor,
        });
        const asymLiftLoss = fail.effectiveAsymmetry * 9.0;
        stepVertAccel = step.verticalAccelMS2;
        pOmega = Math.max(0.1, pOmega + step.angularAccelRadS2 * dtS);
        pVz += (step.verticalAccelMS2 + asymLiftLoss) * dtS;
        pPos.z -= pVz * dtS;
        pPos.x += fail.horizontalSpeedMS * dtS;
        if (pPos.z <= 0) {
          pPos.z = 0;
          pLanded = true;
          primaryLandingTimeS = timeS;
          primaryTouchdownVzMS = Math.abs(pVz);
        }
      }

      timeS += dtS;

      const tiltRad = (fail.maxTiltDeg * Math.PI) / 180;
      frames.push(synthesizeTelemetryFrame({
        timeS,
        phase: pLanded ? 'POST_LANDING' : 'PRIMARY_AUTOROTATION',
        primaryPositionM: { ...pPos },
        primaryVelocityMS: { x: fail.horizontalSpeedMS, y: 0, z: pLanded ? 0 : -pVz },
        primaryAccelMS2: { x: 0, y: 0, z: -stepVertAccel },
        primaryAttitudeRad: { roll: tiltRad, pitch: 0.01, yaw: timeS * 0.1 },
        omegaZRadS: pOmega,
        secondaryPositionM: { ...sPos },
        servoReleased,
        useGps,
        secondaryHasRf,
      }));
    }
  }

  pPos.z = 0;
  sPos.z = 0;
  const primaryLandingRadiusM = Math.hypot(pPos.x, pPos.y);
  const landedInsideTarget = primaryLandingRadiusM <= (targetCircleDiameterM / 2);
  const impactAngleDeg = Math.atan2(fail.horizontalSpeedMS, Math.max(1.0, primaryTouchdownVzMS)) * (180 / Math.PI);

  const hasTpu = failureConfig?.hasTpuCapsule ?? failureConfig?.hasTpuProtection ?? failureConfig?.hasFoam ?? true;
  const ground = failureConfig?.groundType ?? failureConfig?.groundHardness ?? 'soft_grass';
  const bandK = failureConfig?.bandStiffnessK ?? 950.0;

  const impactReport = evaluateDualPayloadEggSurvival({
    primaryMassKg: massProps.primaryDecoupled.massKg,
    primaryTouchdownVzMS: Math.abs(primaryTouchdownVzMS),
    secondaryMassKg: massProps.secondaryDecoupled.massKg,
    secondaryTouchdownVzMS: Math.abs(secondaryTouchdownVzMS),
    primaryBandK: bandK,
    secondaryBandK: bandK,
    impactAngleDeg,
    hasTpuCapsulePrimary: hasTpu,
    hasTpuProtectionPrimary: hasTpu,
    hasTpuProtectionSecondary: false,
    hasTpuCapsuleSecondary: false,
    groundHardness: ground,
    groundType: ground,
  });

  // 5. POST-LANDING
  const postEnd = timeS + postLandingDurationS + dtS;
  while (timeS <= postEnd) {
    timeS += dtS;
    pOmega = Math.max(0, pOmega - 20.0 * dtS);
    frames.push(synthesizeTelemetryFrame({
      timeS, phase: 'POST_LANDING', primaryPositionM: { ...pPos }, primaryVelocityMS: { x: 0, y: 0, z: 0 }, primaryAccelMS2: { x: 0, y: 0, z: 0 },
      primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 }, omegaZRadS: pOmega, secondaryPositionM: { ...sPos }, servoReleased, useGps, secondaryHasRf,
    }));
  }

  return {
    events: {
      dropAltitudeM, dropHorizontalRadiusM: Math.hypot(0.1, 0.1), dropTimeS, separationAltitudeM: separationAltitudeActual,
      separationTimeS, secondaryLandingTimeS, primaryLandingTimeS, primaryLandingRadiusM, landedInsideTarget, servoJammed: fail.servoJammed, maxTiltDeg: fail.maxTiltDeg,
    },
    primaryTouchdownVzMS, secondaryTouchdownVzMS, impactReport, telemetryFrames: frames,
  };
}
