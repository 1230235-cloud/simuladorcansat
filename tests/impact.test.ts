import { describe, it, expect } from 'vitest';
import { createDefaultAssembly } from '../src/assembly/components';
import { computeMassProperties } from '../src/physics/massProperties';
import {
  evaluateGroundImpact,
  evaluateDualPayloadEggSurvival,
} from '../src/physics/impact';

describe('Phase 2.3: Ground Impact & Dual 65g Egg Survival Solver', () => {
  it('verifies exact analytical equation for kinetic energy, peak G-load, and 65g egg axial force', () => {
    const massKg = 0.300;
    const vImpMS = 8.0;
    const strokeM = 0.088;
    const efficiency = 0.85;
    const g0 = 9.80665;

    const res = evaluateGroundImpact({
      payloadMassKg: massKg,
      eggMassKg: 0.065,
      impactVelocityVzMS: vImpMS,
      crushStrokeM: strokeM,
      absorberEfficiency: efficiency,
    });

    const expectedEk = 0.5 * massKg * vImpMS * vImpMS;
    const expectedAPeak = (vImpMS * vImpMS) / (2 * efficiency * strokeM);
    const expectedGPeak = expectedAPeak / g0;
    const expectedEggForceN = 0.065 * expectedAPeak;

    expect(res.kineticEnergyJ).toBeCloseTo(expectedEk, 6);
    expect(res.peakAccelMS2).toBeCloseTo(expectedAPeak, 5);
    expect(res.peakGLoad).toBeCloseTo(expectedGPeak, 5);
    expect(res.eggForceN).toBeCloseTo(expectedEggForceN, 5);
    expect(res.eggSurvived).toBe(true);
    expect(res.peakGLoad).toBeLessThanOrEqual(45.0);
  });

  it('guarantees survival (G_peak <= 45.0 G and F_egg <= 28.7 N) for BOTH 65g eggs on Primary and Secondary touchdown', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const massProps = computeMassProperties(assembly);

    const report = evaluateDualPayloadEggSurvival({
      primaryMassKg: massProps.primaryDecoupled.massKg,
      primaryTouchdownVzMS: 10.2,
      secondaryMassKg: massProps.secondaryDecoupled.massKg,
      secondaryTouchdownVzMS: 42.5,
    });

    expect(report.primary.peakGLoad).toBeLessThanOrEqual(45.0);
    expect(report.primary.eggForceN).toBeLessThanOrEqual(28.7);
    expect(report.primary.eggSurvived).toBe(true);

    expect(report.secondary.peakGLoad).toBeLessThanOrEqual(45.0);
    expect(report.secondary.eggForceN).toBeLessThanOrEqual(28.7);
    expect(report.secondary.eggSurvived).toBe(true);

    expect(report.bothEggsSurvived).toBe(true);
  });

  it('detects egg fracture (eggSurvived === false) when crush stroke is insufficient and G_peak > 45.0 G', () => {
    const failedImpact = evaluateGroundImpact({
      payloadMassKg: 0.200,
      eggMassKg: 0.065,
      impactVelocityVzMS: 45.0,
      crushStrokeM: 0.004,
      absorberEfficiency: 0.65,
    });

    expect(failedImpact.peakGLoad).toBeGreaterThan(45.0);
    expect(failedImpact.eggSurvived).toBe(false);
  });
});
