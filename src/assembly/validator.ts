import { DualCanSatAssembly } from './components';

export interface EnvelopeValidationReport {
  isValid: boolean;
  totalMassKg: number;
  errors: string[];
}

export function validateCanSatEnvelope(assembly: DualCanSatAssembly): EnvelopeValidationReport {
  const errors: string[] = [];

  const primaryMass =
    assembly.primary.chassisMassKg +
    assembly.primary.components.reduce((sum, c) => sum + c.massKg, 0);

  const secondaryMass =
    assembly.secondary.chassisMassKg +
    assembly.secondary.components.reduce((sum, c) => sum + c.massKg, 0);

  const totalMassKg = primaryMass + secondaryMass;

  if (totalMassKg > 0.600) {
    errors.push(`Total mass exceeds 0.600 kg limit: ${totalMassKg.toFixed(4)} kg`);
  }

  const allComponents = [...assembly.primary.components, ...assembly.secondary.components];

  const batteries = allComponents.filter((c) => c.category === 'battery');
  if (batteries.length === 0) {
    errors.push('No battery found in assembly');
  }

  for (const bat of batteries) {
    if (bat.type !== '9V_PP3') {
      errors.push(`Invalid battery type: ${bat.type}. Strictly only 9V_PP3 allowed.`);
    }
  }

  const activeRotorMotors = allComponents.filter((c) => c.category === 'active_rotor_motor');
  if (activeRotorMotors.length > 0) {
    errors.push('Active rotor motors are strictly prohibited. Passive autorotation only.');
  }

  const totalHeightM = assembly.primary.heightM + assembly.secondary.heightM;
  if (totalHeightM < 0.20 || totalHeightM > 0.23) {
    errors.push(`Total height ${totalHeightM.toFixed(3)}m out of range [0.20, 0.23]m`);
  }

  if (assembly.primary.heightM > 0.16) {
    errors.push(`Primary height ${assembly.primary.heightM.toFixed(3)}m exceeds 0.16m limit`);
  }

  if (assembly.secondary.heightM > 0.07) {
    errors.push(`Secondary height ${assembly.secondary.heightM.toFixed(3)}m exceeds 0.07m limit`);
  }

  if (assembly.primary.diameterM < 0.09 || assembly.primary.diameterM > 0.10) {
    errors.push(`Primary diameter ${assembly.primary.diameterM.toFixed(3)}m out of range [0.09, 0.10]m`);
  }

  if (assembly.secondary.diameterM < 0.09 || assembly.secondary.diameterM > 0.10) {
    errors.push(`Secondary diameter ${assembly.secondary.diameterM.toFixed(3)}m out of range [0.09, 0.10]m`);
  }

  if (assembly.hasExternalProtuberances) {
    errors.push('CanSat outer surface must be smooth without external protuberances');
  }

  return {
    isValid: errors.length === 0,
    totalMassKg,
    errors,
  };
}
