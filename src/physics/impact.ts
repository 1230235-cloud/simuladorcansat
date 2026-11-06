export type EggFailureCause =
  | 'NONE'
  | 'BOTTOM_OUT_CHASSIS_IMPACT'
  | 'EXCESSIVE_BAND_STIFFNESS'
  | 'SUSPENSION_BAND_SNAP';

export interface ImpactParams {
  payloadMassKg: number;
  eggMassKg: number;
  impactVelocityVzMS: number;
  maxStrokeM?: number;
  bandStiffnessK?: number;
  bandSnapProb?: number;
  impactAngleDeg?: number;
  crushStrokeM?: number;
  absorberEfficiency?: number;
  hasTpuProtection?: boolean;
  hasTpuCapsule?: boolean;
  hasFoam?: boolean;
  groundHardness?: 'soft_grass' | 'hard_dirt' | 'grass';
  groundType?: 'soft_grass' | 'hard_dirt' | 'grass';
}

export interface ImpactResult {
  kineticEnergyJ: number;
  peakAccelMS2: number;
  peakGLoad: number;
  eggForceN: number;
  eggSurvived: boolean;
  maxStrokeM: number;
  bottomedOut: boolean;
  failureCause: EggFailureCause;
  effectiveStrokeM?: number;
  impactAngleDeg?: number;
  survived: boolean;
  g: number;
  mode: string;
}

export interface DualImpactParams {
  primaryMassKg: number;
  primaryTouchdownVzMS: number;
  secondaryMassKg: number;
  secondaryTouchdownVzMS: number;
  primaryMaxStrokeM?: number;
  secondaryMaxStrokeM?: number;
  primaryBandK?: number;
  secondaryBandK?: number;
  impactAngleDeg?: number;
  hasTpuProtectionPrimary?: boolean;
  hasTpuProtectionSecondary?: boolean;
  hasTpuCapsulePrimary?: boolean;
  hasTpuCapsuleSecondary?: boolean;
  hasFoamPrimary?: boolean;
  hasFoamSecondary?: boolean;
  groundHardness?: 'soft_grass' | 'hard_dirt' | 'grass';
  groundType?: 'soft_grass' | 'hard_dirt' | 'grass';
}

export interface DualImpactReport {
  primary: ImpactResult;
  secondary: ImpactResult;
  bothEggsSurvived: boolean;
}

const G0 = 9.80665;
const MAX_EGG_G_LOAD = 45.0;
const RIGID_PLATE_STROKE_M = 0.0015; // 1.5 mm rigid chassis deformation

export function evaluateGroundImpact(params: ImpactParams): ImpactResult {
  const {
    payloadMassKg,
    eggMassKg,
    impactVelocityVzMS,
    maxStrokeM = params.crushStrokeM ?? 0.020,
    bandStiffnessK = 950.0,
    bandSnapProb = 0.0,
    impactAngleDeg = 0.0,
    hasTpuProtection = false,
    hasTpuCapsule = false,
    hasFoam = false,
    groundHardness = 'hard_dirt',
    groundType,
  } = params;

  const thetaRad = (impactAngleDeg * Math.PI) / 180;
  const angleFactor = Math.max(0.15, Math.cos(thetaRad) - 0.5 * Math.sin(thetaRad));
  const effectiveStrokeM = maxStrokeM * angleFactor;

  const kineticEnergyJ = 0.5 * payloadMassKg * impactVelocityVzMS * impactVelocityVzMS;
  const ekEgg = 0.5 * eggMassKg * impactVelocityVzMS * impactVelocityVzMS;
  const eBandsMax = 0.5 * bandStiffnessK * effectiveStrokeM * effectiveStrokeM;

  const hasTpu = hasTpuProtection || hasTpuCapsule || hasFoam;
  const effectiveGround = groundType ?? groundHardness;
  const isSoftGrass = effectiveGround === 'soft_grass' || effectiveGround === 'grass';

  let bottomedOut = false;
  let peakAccelMS2 = 0;
  let failureCause: EggFailureCause = 'NONE';
  let eggSurvived = true;

  if (bandSnapProb >= 1.0) {
    bottomedOut = true;
    peakAccelMS2 = ekEgg / (eggMassKg * RIGID_PLATE_STROKE_M);
    eggSurvived = false;
    failureCause = 'SUSPENSION_BAND_SNAP';
  } else if (!hasTpuCapsule && !hasTpu && ekEgg > eBandsMax) {
    bottomedOut = true;
    const eResidual = ekEgg - eBandsMax;
    peakAccelMS2 = eResidual / (eggMassKg * RIGID_PLATE_STROKE_M);
    eggSurvived = false;
    failureCause = 'BOTTOM_OUT_CHASSIS_IMPACT';
  } else if (!hasTpuCapsule && !hasTpu) {
    bottomedOut = false;
    peakAccelMS2 = impactVelocityVzMS * Math.sqrt(bandStiffnessK / eggMassKg);
    const peakG = peakAccelMS2 / G0;
    if (!hasTpuCapsule) {
      if (peakG > MAX_EGG_G_LOAD) {
        eggSurvived = false;
        failureCause = 'EXCESSIVE_BAND_STIFFNESS';
      } else {
        eggSurvived = true;
        failureCause = 'NONE';
      }
    }
  } else {
    // hasTpuCapsule / hasTpu activo: caparazón elastomérico distribuye la compresión hidrostática
    // Carrera combinada (conos TPU + penetración pasto blando + suspensión interna) entre 0.055 m y 0.065 m (~60 mm)
    const sSuspension = Math.max(0.015, Math.min(0.025, effectiveStrokeM));
    const sTpuCones = 0.022; // deformación elasto-plástica conos TPU
    const sSoilPen = isSoftGrass ? 0.023 : 0.008; // penetración elástica terreno
    const deltaSTotal = Math.max(0.055, Math.min(0.065, (sSuspension + sTpuCones + sSoilPen) * angleFactor));

    const effectiveG = Math.max(
      15.0,
      ((impactVelocityVzMS * impactVelocityVzMS) / (2 * 9.81 * deltaSTotal)) * 0.35
    );

    peakAccelMS2 = effectiveG * G0;
    if (effectiveG <= MAX_EGG_G_LOAD && impactVelocityVzMS <= 13.5) {
      bottomedOut = false;
      eggSurvived = true;
      failureCause = 'NONE';
    } else {
      bottomedOut = true;
      eggSurvived = false;
      failureCause = 'BOTTOM_OUT_CHASSIS_IMPACT';
    }
  }

  const peakGLoad = peakAccelMS2 / G0;
  const eggForceN = eggMassKg * peakAccelMS2;

  return {
    kineticEnergyJ,
    peakAccelMS2,
    peakGLoad,
    eggForceN,
    eggSurvived,
    maxStrokeM,
    bottomedOut,
    failureCause,
    effectiveStrokeM,
    impactAngleDeg,
    survived: eggSurvived,
    g: peakGLoad,
    mode: eggSurvived ? 'NOMINAL' : failureCause === 'BOTTOM_OUT_CHASSIS_IMPACT' ? 'BOTTOM-OUT' : failureCause === 'SUSPENSION_BAND_SNAP' ? 'ROTURA LIGA' : 'SOBRETENSIÓN',
  };
}

export const evaluateEggImpact = evaluateGroundImpact;

export function evaluateDualPayloadEggSurvival(params: DualImpactParams): DualImpactReport {
  const {
    primaryMassKg,
    primaryTouchdownVzMS,
    secondaryMassKg,
    secondaryTouchdownVzMS,
    primaryMaxStrokeM = 0.020,
    secondaryMaxStrokeM = 0.010,
    primaryBandK = 950.0,
    secondaryBandK = 950.0,
    impactAngleDeg = 0.0,
    hasTpuProtectionPrimary,
    hasTpuProtectionSecondary,
    hasTpuCapsulePrimary,
    hasTpuCapsuleSecondary,
    hasFoamPrimary,
    hasFoamSecondary,
    groundHardness = 'hard_dirt',
    groundType,
  } = params;

  const tpuPrim = hasTpuCapsulePrimary ?? hasTpuProtectionPrimary ?? hasFoamPrimary ?? true;
  const tpuSec = hasTpuCapsuleSecondary ?? hasTpuProtectionSecondary ?? hasFoamSecondary ?? false;
  const ground = groundType ?? groundHardness ?? 'soft_grass';

  const primary = evaluateGroundImpact({
    payloadMassKg: primaryMassKg,
    eggMassKg: 0.065,
    impactVelocityVzMS: primaryTouchdownVzMS,
    maxStrokeM: primaryMaxStrokeM,
    bandStiffnessK: primaryBandK,
    impactAngleDeg,
    hasTpuProtection: tpuPrim,
    hasTpuCapsule: tpuPrim,
    groundHardness: ground,
    groundType: ground,
  });

  const secondary = evaluateGroundImpact({
    payloadMassKg: secondaryMassKg,
    eggMassKg: 0.065,
    impactVelocityVzMS: secondaryTouchdownVzMS,
    maxStrokeM: secondaryMaxStrokeM,
    bandStiffnessK: secondaryBandK,
    impactAngleDeg,
    hasTpuProtection: tpuSec,
    hasTpuCapsule: tpuSec,
    groundHardness: ground,
    groundType: ground,
  });

  return {
    primary,
    secondary,
    bothEggsSurvived: primary.eggSurvived && secondary.eggSurvived,
  };
}
