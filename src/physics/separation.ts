export interface SeparationParams {
  primaryMassKg: number;
  secondaryMassKg: number;
  preSeparationVzMS: number;
  springImpulseNs: number;
  separationAltitudeM: number;
}

export interface SeparationResult {
  separationAltitudeM: number;
  primaryPostVzMS: number;
  secondaryPostVzMS: number;
  momentumErrorNs: number;
}

export function computeMechanicalSeparation(params: SeparationParams): SeparationResult {
  const {
    primaryMassKg,
    secondaryMassKg,
    preSeparationVzMS,
    springImpulseNs,
    separationAltitudeM,
  } = params;

  // With downward +z:
  // Internal spring pushes Primary upward (-z) and Secondary downward (+z)
  const primaryPostVzMS = preSeparationVzMS - springImpulseNs / primaryMassKg;
  const secondaryPostVzMS = preSeparationVzMS + springImpulseNs / secondaryMassKg;

  const initialMomentum = (primaryMassKg + secondaryMassKg) * preSeparationVzMS;
  const finalMomentum = primaryMassKg * primaryPostVzMS + secondaryMassKg * secondaryPostVzMS;
  const momentumErrorNs = Math.abs(finalMomentum - initialMomentum);

  return {
    separationAltitudeM,
    primaryPostVzMS,
    secondaryPostVzMS,
    momentumErrorNs,
  };
}
