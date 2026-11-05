import { describe, it, expect } from 'vitest';
import { createDefaultAssembly } from '../src/assembly/components';
import { computeMassProperties } from '../src/physics/massProperties';
import { computeIsaState } from '../src/physics/isa';
import {
  simulateCoupledFreeFallToSeparation,
  simulateSecondaryFreeFallToGround,
} from '../src/physics/ballistics';

describe('Phase 2.1: ISA Atmosphere & Ballistic Free-Fall Solver', () => {
  it('computes accurate ISA atmospheric density, pressure, and temperature from 0m to 450m', () => {
    const seaLevel = computeIsaState(0);
    const dropAlt = computeIsaState(450);

    expect(seaLevel.temperatureK).toBeCloseTo(288.15, 2);
    expect(seaLevel.pressurePa).toBeCloseTo(101325, 0);
    expect(seaLevel.densityKgM3).toBeCloseTo(1.225, 3);

    expect(dropAlt.temperatureK).toBeLessThan(seaLevel.temperatureK);
    expect(dropAlt.pressurePa).toBeLessThan(seaLevel.pressurePa);
    expect(dropAlt.densityKgM3).toBeGreaterThan(1.15);
    expect(dropAlt.densityKgM3).toBeLessThan(1.225);
  });

  it('simulates coupled free-fall from h_drop = 450m to exact separation trigger at h_sep = 200m', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const massProps = computeMassProperties(assembly);

    const result = simulateCoupledFreeFallToSeparation({
      massKg: massProps.coupled.massKg,
      diameterM: assembly.primary.diameterM,
      dropAltitudeM: 450,
      separationAltitudeM: 200,
      dragCoefficient: 0.75,
      dtS: 0.01,
    });

    expect(result.initialAltitudeM).toBe(450);
    expect(result.finalAltitudeM).toBeCloseTo(200, 0);
    expect(result.elapsedTimeS).toBeGreaterThan(6.5);
    expect(result.elapsedTimeS).toBeLessThan(12.0);
    expect(result.separationVelocityVzMS).toBeGreaterThan(35.0);
    expect(result.separationVelocityVzMS).toBeLessThan(68.0);
  });

  it('simulates unbraked ballistic free-fall of Secondary Payload from 200m to ground (0m)', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const massProps = computeMassProperties(assembly);

    const secondaryDrop = simulateSecondaryFreeFallToGround({
      massKg: massProps.secondaryDecoupled.massKg,
      diameterM: assembly.secondary.diameterM,
      startAltitudeM: 200,
      initialVzMS: 48.0,
      dragCoefficient: 0.80,
      dtS: 0.01,
    });

    expect(secondaryDrop.finalAltitudeM).toBeCloseTo(0, 1);
    expect(secondaryDrop.elapsedTimeS).toBeGreaterThan(2.5);
    expect(secondaryDrop.impactVelocityVzMS).toBeGreaterThan(35.0);
    expect(secondaryDrop.impactVelocityVzMS).toBeLessThan(85.0);
    expect(secondaryDrop.trajectory.length).toBeGreaterThan(50);
  });
});
