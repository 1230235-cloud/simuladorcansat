import { describe, it, expect } from 'vitest';
import { createDefaultAssembly } from '../src/assembly/components';
import {
  computeMassProperties,
  computeCoMShiftVector,
  computeDeployedBladesInertiaZ,
} from '../src/physics/massProperties';

describe('Phase 1.3: Pre/Post Separation Mass, Center of Mass & Axial Inertia I_zz', () => {
  it('computes exact coupled Mass M_total = M1 + M2 and composite CoM R_CoM^(0)', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const state = computeMassProperties(assembly);

    expect(state.coupled.massKg).toBeLessThanOrEqual(0.600);
    expect(state.coupled.massKg).toBeCloseTo(
      state.primaryDecoupled.massKg + state.secondaryDecoupled.massKg,
      6
    );

    const M1 = state.primaryPreDeploy.massKg;
    const M2 = state.secondaryDecoupled.massKg;
    const expectedZ0 =
      (M1 * state.primaryPreDeploy.comM.z + M2 * state.secondaryDecoupled.comM.z) / (M1 + M2);

    expect(state.coupled.comM.z).toBeCloseTo(expectedZ0, 6);
  });

  it('satisfies exact analytical CoM shift equation: Delta R_CoM = (M2 / (M1 + M2)) * (R_CoM^(1) - R_CoM^(2))', () => {
    const assembly = createDefaultAssembly({ useGps: false });
    const state = computeMassProperties(assembly);
    const shift = computeCoMShiftVector(assembly);

    const M1 = state.primaryPreDeploy.massKg;
    const M2 = state.secondaryDecoupled.massKg;
    const factor = M2 / (M1 + M2);

    const expectedShiftX = factor * (state.primaryPreDeploy.comM.x - state.secondaryDecoupled.comM.x);
    const expectedShiftY = factor * (state.primaryPreDeploy.comM.y - state.secondaryDecoupled.comM.y);
    const expectedShiftZ = factor * (state.primaryPreDeploy.comM.z - state.secondaryDecoupled.comM.z);

    expect(shift.x).toBeCloseTo(expectedShiftX, 6);
    expect(shift.y).toBeCloseTo(expectedShiftY, 6);
    expect(shift.z).toBeCloseTo(expectedShiftZ, 6);
  });

  it('enforces metacentric pendular stability: Z_hub - Z_CoM^(1) >= +0.03 m after blade deployment', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const state = computeMassProperties(assembly);

    const metacentricMarginM = assembly.primary.rotorHubZM - state.primaryDecoupled.comM.z;
    expect(metacentricMarginM).toBeGreaterThanOrEqual(0.03);
  });

  it('computes deployed blade inertia I_zz,blades = N_b * m_b * (1/3)*(R^2 + R*r0 + r0^2) and increases Primary I_zz upon deployment', () => {
    const Nb = 3;
    const mb = 0.012;
    const r0 = 0.015;
    const R = 0.22;

    const expectedBladeIzz = Nb * mb * (1 / 3) * (R * R + R * r0 + r0 * r0);
    const calculatedBladeIzz = computeDeployedBladesInertiaZ({
      numBlades: Nb,
      bladeMassKg: mb,
      rootOffsetM: r0,
      tipRadiusM: R,
    });

    expect(calculatedBladeIzz).toBeCloseTo(expectedBladeIzz, 8);

    const assembly = createDefaultAssembly({ useGps: true });
    const state = computeMassProperties(assembly);

    expect(state.primaryDecoupled.izzKgM2).toBeGreaterThan(state.primaryPreDeploy.izzKgM2);
    expect(state.coupled.izzKgM2).toBeGreaterThan(0);
  });
});
