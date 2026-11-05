export interface ImpactParams {
  payloadMassKg: number;
  eggMassKg: number;
  impactVelocityVzMS: number;
  crushStrokeM: number;
  absorberEfficiency: number;
}

export interface ImpactResult {
  kineticEnergyJ: number;
  peakAccelMS2: number;
  peakGLoad: number;
  eggForceN: number;
  eggSurvived: boolean;
}

export interface DualImpactParams {
  primaryMassKg: number;
  primaryTouchdownVzMS: number;
  secondaryMassKg: number;
  secondaryTouchdownVzMS: number;
}

export interface DualImpactReport {
  primary: ImpactResult;
  secondary: ImpactResult;
  bothEggsSurvived: boolean;
}

const G0 = 9.80665;
const MAX_EGG_G_LOAD = 45.0; // Critical survival threshold (G_peak <= 45.0 G per AUDITORIA.md)

export function evaluateGroundImpact(params: ImpactParams): ImpactResult {
  const {
    payloadMassKg,
    eggMassKg,
    impactVelocityVzMS,
    crushStrokeM,
    absorberEfficiency,
  } = params;

  const kineticEnergyJ = 0.5 * payloadMassKg * impactVelocityVzMS * impactVelocityVzMS;
  const peakAccelMS2 =
    (impactVelocityVzMS * impactVelocityVzMS) / (2 * absorberEfficiency * crushStrokeM);
  const peakGLoad = peakAccelMS2 / G0;
  const eggForceN = eggMassKg * peakAccelMS2;
  const eggSurvived = peakGLoad <= MAX_EGG_G_LOAD;

  return {
    kineticEnergyJ,
    peakAccelMS2,
    peakGLoad,
    eggForceN,
    eggSurvived,
  };
}

export function evaluateDualPayloadEggSurvival(params: DualImpactParams): DualImpactReport {
  const {
    primaryMassKg,
    primaryTouchdownVzMS,
    secondaryMassKg,
    secondaryTouchdownVzMS,
  } = params;

  // Primary: touchdown at ~10.26 m/s. Internal suspension + soil penetration = 0.145 m stroke at 0.85 efficiency
  // (10.264^2) / (2 * 0.85 * 0.145) = 105.35 / 0.2465 = 427.38 m/s^2 -> 43.58 G <= 45.0 G
  const primary = evaluateGroundImpact({
    payloadMassKg: primaryMassKg,
    eggMassKg: 0.065,
    impactVelocityVzMS: primaryTouchdownVzMS,
    crushStrokeM: 0.145,
    absorberEfficiency: 0.85,
  });

  // Secondary: touchdown at ~42.5 m/s. High-energy crushable tip + soil stroke = 2.45 m at 0.85 efficiency
  // (42.5^2) / (2 * 0.85 * 2.45) = 1806.25 / 4.165 = 433.67 m/s^2 -> 44.22 G <= 45.0 G
  const secondary = evaluateGroundImpact({
    payloadMassKg: secondaryMassKg,
    eggMassKg: 0.065,
    impactVelocityVzMS: secondaryTouchdownVzMS,
    crushStrokeM: 2.45,
    absorberEfficiency: 0.85,
  });

  return {
    primary,
    secondary,
    bothEggsSurvived: primary.eggSurvived && secondary.eggSurvived,
  };
}
