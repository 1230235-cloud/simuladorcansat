import { describe, it, expect } from 'vitest';
import { createDefaultAssembly } from '../src/assembly/components';
import { computeMassProperties } from '../src/physics/massProperties';
import {
  evaluateGroundImpact,
  evaluateDualPayloadEggSurvival,
} from '../src/physics/impact';

describe('Phase 2.3: Geometric Free-Stroke, Elastic Band Suspension & Bottom-Out Impact Physics', () => {
  it('enforces real geometric stroke limits (Primary 15-25mm, Secondary 8-12mm) and triggers BOTTOM_OUT_CHASSIS_IMPACT when E_k > E_bands', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const massProps = computeMassProperties(assembly);

    const report = evaluateDualPayloadEggSurvival({
      primaryMassKg: massProps.primaryDecoupled.massKg,
      primaryTouchdownVzMS: 10.2,
      secondaryMassKg: massProps.secondaryDecoupled.massKg,
      secondaryTouchdownVzMS: 40.0,
    });

    // Geometric stroke limits must match real cylinder clearances (NO multi-meter strokes!)
    expect(report.primary.maxStrokeM).toBeGreaterThanOrEqual(0.015);
    expect(report.primary.maxStrokeM).toBeLessThanOrEqual(0.025);
    expect(report.secondary.maxStrokeM).toBeGreaterThanOrEqual(0.008);
    expect(report.secondary.maxStrokeM).toBeLessThanOrEqual(0.012);

    // Secondary in free-fall (~40 m/s) with 8-12 mm clearance MUST bottom-out against rigid floor
    expect(report.secondary.bottomedOut).toBe(true);
    expect(report.secondary.peakGLoad).toBeGreaterThan(500.0);
    expect(report.secondary.eggSurvived).toBe(false);
    expect(report.secondary.failureCause).toBe('BOTTOM_OUT_CHASSIS_IMPACT');
    expect(report.bothEggsSurvived).toBe(false);
  });

  it('computes exact bottom-out G-load against rigid 1.5mm chassis plate when elastic bands are too loose', () => {
    const g0 = 9.80665;
    const eggMassKg = 0.065;
    const vImpMS = 10.0;
    const maxStrokeM = 0.020; // 20 mm primary bay clearance
    const bandStiffnessK = 250.0; // Loose bands: E_bands = 0.5 * 250 * 0.02^2 = 0.05 J < E_k = 3.25 J

    const res = evaluateGroundImpact({
      payloadMassKg: 0.250,
      eggMassKg,
      impactVelocityVzMS: vImpMS,
      maxStrokeM,
      bandStiffnessK,
    });

    const ekEgg = 0.5 * eggMassKg * vImpMS * vImpMS;
    const eBandsMax = 0.5 * bandStiffnessK * maxStrokeM * maxStrokeM;
    const eResidual = ekEgg - eBandsMax;
    const rigidPlateStrokeM = 0.0015; // 1.5 mm rigid plastic deformation
    const expectedAPeak = eResidual / (eggMassKg * rigidPlateStrokeM);
    const expectedGPeak = expectedAPeak / g0;

    expect(res.bottomedOut).toBe(true);
    expect(res.peakGLoad).toBeCloseTo(expectedGPeak, 2);
    expect(res.peakGLoad).toBeGreaterThan(200.0);
    expect(res.eggSurvived).toBe(false);
    expect(res.failureCause).toBe('BOTTOM_OUT_CHASSIS_IMPACT');
  });

  it('distinguishes over-stiff band fracture (EXCESSIVE_BAND_STIFFNESS), band rupture (SUSPENSION_BAND_SNAP), oblique penalty, and elastic survival', () => {
    // 1. Over-stiff bands: arrests before maxStrokeM, but transmits > 45 G
    const overStiff = evaluateGroundImpact({
      payloadMassKg: 0.250,
      eggMassKg: 0.065,
      impactVelocityVzMS: 5.0,
      maxStrokeM: 0.025,
      bandStiffnessK: 6000.0,
    });
    expect(overStiff.bottomedOut).toBe(false);
    expect(overStiff.peakGLoad).toBeGreaterThan(45.0);
    expect(overStiff.eggSurvived).toBe(false);
    expect(overStiff.failureCause).toBe('EXCESSIVE_BAND_STIFFNESS');

    // 2. Band snap on impact
    const snapped = evaluateGroundImpact({
      payloadMassKg: 0.250,
      eggMassKg: 0.065,
      impactVelocityVzMS: 8.0,
      maxStrokeM: 0.025,
      bandStiffnessK: 800.0,
      bandSnapProb: 1.0,
    });
    expect(snapped.eggSurvived).toBe(false);
    expect(snapped.failureCause).toBe('SUSPENSION_BAND_SNAP');

    // 3. Controlled low-velocity impact within elastic envelope (V = 3.0 m/s, s_max = 25mm, k = 950 N/m)
    const survived = evaluateGroundImpact({
      payloadMassKg: 0.250,
      eggMassKg: 0.065,
      impactVelocityVzMS: 3.0,
      maxStrokeM: 0.025,
      bandStiffnessK: 950.0,
    });
    expect(survived.bottomedOut).toBe(false);
    expect(survived.peakGLoad).toBeLessThanOrEqual(45.0);
    expect(survived.eggSurvived).toBe(true);
    expect(survived.failureCause).toBe('NONE');

    // 4. Oblique impact angle reduces effective lateral clearance and triggers bottom-out
    const oblique = evaluateGroundImpact({
      payloadMassKg: 0.250,
      eggMassKg: 0.065,
      impactVelocityVzMS: 3.0,
      maxStrokeM: 0.025,
      bandStiffnessK: 950.0,
      impactAngleDeg: 40.0,
    });
    expect(oblique.bottomedOut).toBe(true);
    expect(oblique.eggSurvived).toBe(false);
    expect(oblique.failureCause).toBe('BOTTOM_OUT_CHASSIS_IMPACT');

    // 5. TPU capsule on soft grass at nominal touchdown (9.5 m/s) -> 24.0 - 28.5 G, SURVIVED NOMINAL
    const tpuLanding = evaluateGroundImpact({
      payloadMassKg: 0.350,
      eggMassKg: 0.065,
      impactVelocityVzMS: 9.5,
      maxStrokeM: 0.020,
      hasTpuCapsule: true,
      groundType: 'soft_grass',
    });
    expect(tpuLanding.peakGLoad).toBeGreaterThanOrEqual(24.0);
    expect(tpuLanding.peakGLoad).toBeLessThanOrEqual(28.5);
    expect(tpuLanding.eggSurvived).toBe(true);
    expect(tpuLanding.survived).toBe(true);
    expect(tpuLanding.mode).toBe('NOMINAL');
    expect(tpuLanding.bottomedOut).toBe(false);
    expect(tpuLanding.failureCause).toBe('NONE');
  });
});
