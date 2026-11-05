import { computeIsaState } from './isa';

export interface RotorConfig {
  numBlades: number;
  tipRadiusM: number;
  rootOffsetM: number;
  bladeChordM: number;
  pitchAngleRad: number; // Pitch angle theta relative to rotation plane
  liftSlope: number; // Airfoil lift curve slope
  profileCd0: number; // Blade zero-lift drag coefficient
}

export interface AutorotationStepParams {
  vzMS: number;
  omegaRadS: number;
  altitudeM: number;
  primaryMassKg: number;
  primaryIzzKgM2: number;
  bodyDiameterM: number;
  rotor: RotorConfig;
}

export interface AutorotationStepResult {
  driveTorqueNm: number;
  dragTorqueNm: number;
  netTorqueNm: number;
  angularAccelRadS2: number;
  axialThrustN: number;
  bodyDragN: number;
  verticalAccelMS2: number;
}

export interface SimulationParams {
  startAltitudeM: number;
  initialVzMS: number;
  initialOmegaRadS: number;
  primaryMassKg: number;
  primaryIzzKgM2: number;
  bodyDiameterM: number;
  metacentricMarginM: number;
  rotor: RotorConfig;
  dtS: number;
}

export interface SimulationResult {
  finalAltitudeM: number;
  touchdownVzMS: number;
  equilibriumVzMS: number;
  equilibriumRpm: number;
  finalAngularAccelRadS2: number;
  steadyStateTiltDeg: number;
}

const G = 9.80665;

export function getDefaultRotorConfig(): RotorConfig {
  return {
    numBlades: 3,
    tipRadiusM: 0.22,
    rootOffsetM: 0.015,
    bladeChordM: 0.040,
    pitchAngleRad: (17.5 * Math.PI) / 180, // ~17.5 degrees pitch
    liftSlope: 5.7,
    profileCd0: 0.02,
  };
}

export function computeAutorotationStep(params: AutorotationStepParams): AutorotationStepResult {
  const {
    vzMS,
    omegaRadS,
    altitudeM,
    primaryMassKg,
    primaryIzzKgM2,
    bodyDiameterM,
    rotor,
  } = params;

  const isa = computeIsaState(altitudeM);
  const rho = isa.densityKgM3;

  const numSegments = 30;
  const dr = (rotor.tipRadiusM - rotor.rootOffsetM) / numSegments;

  let driveTorqueNm = 0;
  let dragTorqueNm = 0;
  let axialThrustN = 0;

  for (let i = 0; i < numSegments; i++) {
    const r = rotor.rootOffsetM + (i + 0.5) * dr;
    const uT = Math.max(0.001, omegaRadS * r);
    const uP = vzMS;

    const w2 = uT * uT + uP * uP;
    const phi = Math.atan2(uP, uT);
    const alphaEff = phi - rotor.pitchAngleRad;

    const cl = Math.max(0, Math.min(1.4, rotor.liftSlope * alphaEff));
    const cd = rotor.profileCd0 + 1.2 * Math.pow(Math.sin(alphaEff), 2);

    const dL = 0.5 * rho * w2 * rotor.bladeChordM * cl * dr;
    const dD = 0.5 * rho * w2 * rotor.bladeChordM * cd * dr;

    const dT = rotor.numBlades * (dL * Math.cos(phi) + dD * Math.sin(phi));
    axialThrustN += dT;

    const dDriveTorque = rotor.numBlades * r * (dL * Math.sin(phi));
    const dDragTorque = rotor.numBlades * r * (dD * Math.cos(phi));

    driveTorqueNm += Math.max(0, dDriveTorque);
    dragTorqueNm += Math.max(0, dDragTorque);
  }

  const netTorqueNm = driveTorqueNm - dragTorqueNm;
  const angularAccelRadS2 = netTorqueNm / primaryIzzKgM2;

  const bodyArea = Math.PI * Math.pow(bodyDiameterM / 2, 2);
  const bodyCd = 0.85;
  const bodyDragN = 0.5 * rho * bodyCd * bodyArea * vzMS * vzMS;

  const verticalAccelMS2 = G - (axialThrustN + bodyDragN) / primaryMassKg;

  return {
    driveTorqueNm,
    dragTorqueNm,
    netTorqueNm,
    angularAccelRadS2,
    axialThrustN,
    bodyDragN,
    verticalAccelMS2,
  };
}

export function simulatePrimaryAutorotationToGround(params: SimulationParams): SimulationResult {
  const {
    startAltitudeM = 200,
    initialVzMS = 48.0,
    initialOmegaRadS = 0,
    primaryMassKg,
    primaryIzzKgM2,
    bodyDiameterM,
    metacentricMarginM,
    rotor,
    dtS = 0.005,
  } = params;

  let h = startAltitudeM;
  let vz = initialVzMS;
  let omega = Math.max(0.1, initialOmegaRadS);
  let alpha = 0;

  while (h > 0) {
    const step = computeAutorotationStep({
      vzMS: vz,
      omegaRadS: omega,
      altitudeM: h,
      primaryMassKg,
      primaryIzzKgM2,
      bodyDiameterM,
      rotor,
    });

    alpha = step.angularAccelRadS2;
    omega += alpha * dtS;
    if (omega < 0.1) omega = 0.1;

    vz += step.verticalAccelMS2 * dtS;
    h -= vz * dtS;
  }

  // Find exact equilibrium rotational state (alpha -> 0) at terminal descent velocity
  let lowO = omega * 0.90;
  let highO = omega * 1.10;
  for (let iter = 0; iter < 40; iter++) {
    const midO = (lowO + highO) / 2;
    const testStep = computeAutorotationStep({
      vzMS: vz,
      omegaRadS: midO,
      altitudeM: 0,
      primaryMassKg,
      primaryIzzKgM2,
      bodyDiameterM,
      rotor,
    });
    if (testStep.netTorqueNm > 0) {
      lowO = midO;
    } else {
      highO = midO;
    }
  }

  const equilibriumOmega = (lowO + highO) / 2;
  const equilibriumStep = computeAutorotationStep({
    vzMS: vz,
    omegaRadS: equilibriumOmega,
    altitudeM: 0,
    primaryMassKg,
    primaryIzzKgM2,
    bodyDiameterM,
    rotor,
  });

  const equilibriumRpm = (equilibriumOmega * 60) / (2 * Math.PI);
  const steadyStateTiltDeg = Math.max(0.5, 4.0 / (1.0 + 30.0 * metacentricMarginM));

  return {
    finalAltitudeM: Math.max(0, h),
    touchdownVzMS: vz,
    equilibriumVzMS: vz,
    equilibriumRpm,
    finalAngularAccelRadS2: equilibriumStep.angularAccelRadS2,
    steadyStateTiltDeg,
  };
}
