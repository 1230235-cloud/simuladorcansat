import { describe, it, expect } from 'vitest';
import { createDefaultAssembly } from '../src/assembly/components';
import { computeMassProperties } from '../src/physics/massProperties';
import { computeMechanicalSeparation } from '../src/physics/separation';
import {
  computeAutorotationStep,
  simulatePrimaryAutorotationToGround,
  getDefaultRotorConfig,
} from '../src/physics/autorotation';

describe('Phase 2.2: Mechanical Separation & Passive Autorotation Solver', () => {
  it('conserves linear momentum exactly at h = 200m separation (|Delta p_z| < 1e-9 N*s)', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const massProps = computeMassProperties(assembly);

    const M1 = massProps.primaryDecoupled.massKg;
    const M2 = massProps.secondaryDecoupled.massKg;
    const Vz0 = 49.5;
    const impulseNs = 0.35;

    const sep = computeMechanicalSeparation({
      primaryMassKg: M1,
      secondaryMassKg: M2,
      preSeparationVzMS: Vz0,
      springImpulseNs: impulseNs,
      separationAltitudeM: 200,
    });

    const initialMomentum = (M1 + M2) * Vz0;
    const finalMomentum = M1 * sep.primaryPostVzMS + M2 * sep.secondaryPostVzMS;

    expect(Math.abs(finalMomentum - initialMomentum)).toBeLessThan(1e-9);
    expect(sep.momentumErrorNs).toBeLessThan(1e-9);
    expect(sep.primaryPostVzMS).toBeCloseTo(Vz0 - impulseNs / M1, 8);
    expect(sep.secondaryPostVzMS).toBeCloseTo(Vz0 + impulseNs / M2, 8);
    expect(sep.secondaryPostVzMS).toBeGreaterThan(sep.primaryPostVzMS);
  });

  it('produces positive driving torque (tau_net > 0) at blade deployment (omega_0 = 0) to initiate passive spin-up', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const massProps = computeMassProperties(assembly);
    const rotor = getDefaultRotorConfig();

    const step0 = computeAutorotationStep({
      vzMS: 45.0,
      omegaRadS: 0.1,
      altitudeM: 200,
      primaryMassKg: massProps.primaryDecoupled.massKg,
      primaryIzzKgM2: massProps.primaryDecoupled.izzKgM2,
      bodyDiameterM: assembly.primary.diameterM,
      rotor,
    });

    expect(step0.driveTorqueNm).toBeGreaterThan(step0.dragTorqueNm);
    expect(step0.netTorqueNm).toBeGreaterThan(0);
    expect(step0.angularAccelRadS2).toBeGreaterThan(0);
    expect(step0.axialThrustN).toBeGreaterThan(0);
  });

  it('reaches rotational equilibrium (alpha -> 0) and terminal descent velocity strictly within [8.0, 12.0] m/s before touchdown', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const massProps = computeMassProperties(assembly);
    const rotor = getDefaultRotorConfig();

    const sim = simulatePrimaryAutorotationToGround({
      startAltitudeM: 200,
      initialVzMS: 48.0,
      initialOmegaRadS: 0,
      primaryMassKg: massProps.primaryDecoupled.massKg,
      primaryIzzKgM2: massProps.primaryDecoupled.izzKgM2,
      bodyDiameterM: assembly.primary.diameterM,
      metacentricMarginM: assembly.primary.rotorHubZM - massProps.primaryDecoupled.comM.z,
      rotor,
      dtS: 0.005,
    });

    expect(sim.finalAltitudeM).toBeCloseTo(0, 1);

    // Terminal velocity strictly inside [8.0, 12.0] m/s per contest rules
    expect(sim.equilibriumVzMS).toBeGreaterThanOrEqual(8.0);
    expect(sim.equilibriumVzMS).toBeLessThanOrEqual(12.0);
    expect(sim.touchdownVzMS).toBeGreaterThanOrEqual(8.0);
    expect(sim.touchdownVzMS).toBeLessThanOrEqual(12.0);

    // Rotational equilibrium condition: alpha -> 0 (|alpha| < 1e-3 rad/s^2) and RPM in [900, 2800]
    expect(Math.abs(sim.finalAngularAccelRadS2)).toBeLessThan(1e-3);
    expect(sim.equilibriumRpm).toBeGreaterThanOrEqual(900);
    expect(sim.equilibriumRpm).toBeLessThanOrEqual(2800);

    // Gyroscopic stability tilt < 8 degrees
    expect(sim.steadyStateTiltDeg).toBeLessThan(8.0);
  });
});
