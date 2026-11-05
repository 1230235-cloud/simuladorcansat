import { describe, it, expect } from 'vitest';
import { createDefaultAssembly } from '../src/assembly/components';
import { runFullMissionSimulation } from '../src/sim/flightLoop';

describe('Phase 4.2: Complete Mission Flight Loop (Ascent -> 450m Drop -> 200m Separation -> Touchdown + 10s)', () => {
  it('executes full flight timeline with exact altitude milestones (450m drop, 200m decoupling) and >= 10s post-landing telemetry', () => {
    const assembly = createDefaultAssembly({ useGps: true });

    const mission = runFullMissionSimulation({
      assembly,
      dropAltitudeM: 450.0,
      separationAltitudeM: 200.0,
      targetCircleDiameterM: 3.0,
      postLandingDurationS: 10.0,
      dtS: 0.05,
    });

    // 1. Ascent and Drop at 450m over 3m diameter target circle (radius = 1.5m)
    expect(mission.events.dropAltitudeM).toBeCloseTo(450.0, 0);
    expect(mission.events.dropHorizontalRadiusM).toBeLessThanOrEqual(1.5);

    // 2. Mechanical decoupling & blade deployment at 200m (+/- 1.0m per AUDITORIA.md)
    expect(Math.abs(mission.events.separationAltitudeM - 200.0)).toBeLessThanOrEqual(1.0);
    expect(mission.events.separationTimeS).toBeGreaterThan(mission.events.dropTimeS);

    // 3. Primary terminal descent strictly within [8.0, 12.0] m/s & Secondary ballistic touchdown
    expect(mission.primaryTouchdownVzMS).toBeGreaterThanOrEqual(8.0);
    expect(mission.primaryTouchdownVzMS).toBeLessThanOrEqual(12.0);
    expect(mission.events.secondaryLandingTimeS).toBeLessThan(mission.events.primaryLandingTimeS);

    // 4. Both 65g chicken eggs survive impact (<= 45 G)
    expect(mission.impactReport.primary.eggSurvived).toBe(true);
    expect(mission.impactReport.secondary.eggSurvived).toBe(true);
    expect(mission.impactReport.bothEggsSurvived).toBe(true);

    // 5. Post-landing telemetry continues for >= 10.0s after Primary touchdown
    const postLandingDuration =
      mission.telemetryFrames[mission.telemetryFrames.length - 1].timeS -
      mission.events.primaryLandingTimeS;

    expect(postLandingDuration).toBeGreaterThanOrEqual(10.0);

    // Verify phases covered in telemetry stream
    const phases = new Set(mission.telemetryFrames.map((f) => f.phase));
    expect(phases.has('ASCENT')).toBe(true);
    expect(phases.has('DROP_COUPLED')).toBe(true);
    expect(phases.has('PRIMARY_AUTOROTATION')).toBe(true);
    expect(phases.has('POST_LANDING')).toBe(true);
  });

  it('supports running full mission with GPS disabled (useGps: false) using RSSI/inertial relative tracking', () => {
    const assemblyNoGps = createDefaultAssembly({ useGps: false });

    const mission = runFullMissionSimulation({
      assembly: assemblyNoGps,
      dropAltitudeM: 450.0,
      separationAltitudeM: 200.0,
      targetCircleDiameterM: 3.0,
      postLandingDurationS: 10.0,
      dtS: 0.1,
    });

    const postSepFrame = mission.telemetryFrames.find(
      (f) => f.phase === 'PRIMARY_AUTOROTATION'
    );
    expect(postSepFrame).toBeDefined();
    expect(postSepFrame!.relativeLocalization.mode).toBe('RSSI_IMU_BALLISTIC');
    expect(postSepFrame!.relativeLocalization.distance3DM).toBeGreaterThan(0);
  });
});
