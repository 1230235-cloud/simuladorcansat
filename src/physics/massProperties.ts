import { DualCanSatAssembly, Vector3D } from '../assembly/components';

export interface MassState {
  massKg: number;
  comM: Vector3D;
  izzKgM2: number;
}

export interface DualMassProperties {
  coupled: MassState;
  primaryPreDeploy: MassState;
  primaryDecoupled: MassState;
  secondaryDecoupled: MassState;
}

export interface BladeInertiaParams {
  numBlades: number;
  bladeMassKg: number;
  rootOffsetM: number;
  tipRadiusM: number;
}

export function computeDeployedBladesInertiaZ(params: BladeInertiaParams): number {
  const { numBlades, bladeMassKg, rootOffsetM, tipRadiusM } = params;
  return (
    numBlades *
    bladeMassKg *
    (1 / 3) *
    (tipRadiusM * tipRadiusM + tipRadiusM * rootOffsetM + rootOffsetM * rootOffsetM)
  );
}

export function computeCoMShiftVector(assembly: DualCanSatAssembly): Vector3D {
  const state = computeMassProperties(assembly);
  const M1 = state.primaryPreDeploy.massKg;
  const M2 = state.secondaryDecoupled.massKg;
  const factor = M2 / (M1 + M2);

  return {
    x: factor * (state.primaryPreDeploy.comM.x - state.secondaryDecoupled.comM.x),
    y: factor * (state.primaryPreDeploy.comM.y - state.secondaryDecoupled.comM.y),
    z: factor * (state.primaryPreDeploy.comM.z - state.secondaryDecoupled.comM.z),
  };
}

export function computeMassProperties(assembly: DualCanSatAssembly): DualMassProperties {
  // Primary Pre-Deploy
  const pChassisMass = assembly.primary.chassisMassKg;
  const pChassisCoMZ = assembly.primary.heightM / 2;
  let pSumMass = pChassisMass;
  let pSumX = 0;
  let pSumY = 0;
  let pSumZ = pChassisMass * pChassisCoMZ;

  for (const c of assembly.primary.components) {
    pSumMass += c.massKg;
    pSumX += c.massKg * c.positionM.x;
    pSumY += c.massKg * c.positionM.y;
    pSumZ += c.massKg * c.positionM.z;
  }

  const pMass = pSumMass;
  const pCoM: Vector3D = {
    x: pSumX / pMass,
    y: pSumY / pMass,
    z: pSumZ / pMass,
  };

  // Cylinder chassis Izz = 0.5 * m * r^2
  const pRadius = assembly.primary.diameterM / 2;
  let pIzz = 0.5 * pChassisMass * pRadius * pRadius;
  for (const c of assembly.primary.components) {
    const rLocal = c.radiusM ?? 0.01;
    const iLocal = 0.5 * c.massKg * rLocal * rLocal;
    const dx = c.positionM.x - pCoM.x;
    const dy = c.positionM.y - pCoM.y;
    pIzz += iLocal + c.massKg * (dx * dx + dy * dy);
  }

  // Secondary Decoupled
  const sChassisMass = assembly.secondary.chassisMassKg;
  const sChassisCoMZ = assembly.primary.heightM + assembly.secondary.heightM / 2;
  let sSumMass = sChassisMass;
  let sSumX = 0;
  let sSumY = 0;
  let sSumZ = sChassisMass * sChassisCoMZ;

  for (const c of assembly.secondary.components) {
    sSumMass += c.massKg;
    sSumX += c.massKg * c.positionM.x;
    sSumY += c.massKg * c.positionM.y;
    sSumZ += c.massKg * c.positionM.z;
  }

  const sMass = sSumMass;
  const sCoM: Vector3D = {
    x: sSumX / sMass,
    y: sSumY / sMass,
    z: sSumZ / sMass,
  };

  const sRadius = assembly.secondary.diameterM / 2;
  let sIzz = 0.5 * sChassisMass * sRadius * sRadius;
  for (const c of assembly.secondary.components) {
    const rLocal = c.radiusM ?? 0.01;
    const iLocal = 0.5 * c.massKg * rLocal * rLocal;
    const dx = c.positionM.x - sCoM.x;
    const dy = c.positionM.y - sCoM.y;
    sIzz += iLocal + c.massKg * (dx * dx + dy * dy);
  }

  // Coupled State
  const cMass = pMass + sMass;
  const cCoM: Vector3D = {
    x: (pMass * pCoM.x + sMass * sCoM.x) / cMass,
    y: (pMass * pCoM.y + sMass * sCoM.y) / cMass,
    z: (pMass * pCoM.z + sMass * sCoM.z) / cMass,
  };
  const cIzz =
    pIzz +
    pMass * ((pCoM.x - cCoM.x) ** 2 + (pCoM.y - cCoM.y) ** 2) +
    sIzz +
    sMass * ((sCoM.x - cCoM.x) ** 2 + (sCoM.y - cCoM.y) ** 2);

  // Primary Post-Deploy (deployed blades increase I_zz)
  // 3 blades, 0.012 kg each, rootOffset = 0.015 m, tipRadius = 0.22 m
  const deployedBladeIzz = computeDeployedBladesInertiaZ({
    numBlades: 3,
    bladeMassKg: 0.012,
    rootOffsetM: 0.015,
    tipRadiusM: 0.22,
  });

  const pPostDeployIzz = pIzz + deployedBladeIzz;

  return {
    coupled: {
      massKg: cMass,
      comM: cCoM,
      izzKgM2: cIzz,
    },
    primaryPreDeploy: {
      massKg: pMass,
      comM: pCoM,
      izzKgM2: pIzz,
    },
    primaryDecoupled: {
      massKg: pMass,
      comM: pCoM,
      izzKgM2: pPostDeployIzz,
    },
    secondaryDecoupled: {
      massKg: sMass,
      comM: sCoM,
      izzKgM2: sIzz,
    },
  };
}
