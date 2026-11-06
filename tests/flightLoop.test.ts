import { describe, it, expect } from 'vitest';
import { createDefaultAssembly } from '../src/assembly/components';
import { runFullMissionSimulation } from '../src/sim/flightLoop';

describe('Phase 4.2: Complete Mission Flight Loop & Ruthless Failure Injection (FailureConfig)', () => {
  it('executes full flight timeline (450m drop, 200m decoupling, >= 10s post-landing) and exposes Secondary free-fall bottom-out', () => {
    const assembly = createDefaultAssembly({ useGps: true });

    const mission = runFullMissionSimulation({
      assembly,
      dropAltitudeM: 450.0,
      separationAltitudeM: 200.0,
      targetCircleDiameterM: 3.0,
      postLandingDurationS: 10.0,
      dtS: 0.05,
    });

    expect(mission.events.dropAltitudeM).toBeCloseTo(450.0, 0);
    expect(mission.events.dropHorizontalRadiusM).toBeLessThanOrEqual(1.5);
    expect(Math.abs(mission.events.separationAltitudeM - 200.0)).toBeLessThanOrEqual(1.0);

    // Primary reaches steady autorotation in [8.0, 12.0] m/s
    expect(mission.primaryTouchdownVzMS).toBeGreaterThanOrEqual(8.0);
    expect(mission.primaryTouchdownVzMS).toBeLessThanOrEqual(12.0);
    expect(mission.events.secondaryLandingTimeS).toBeLessThan(mission.events.primaryLandingTimeS);

    // Secondary free-fall from 200m with 8-12mm clearance bottoms out against rigid chassis
    expect(mission.impactReport.secondary.bottomedOut).toBe(true);
    expect(mission.impactReport.secondary.eggSurvived).toBe(false);
    expect(mission.impactReport.secondary.failureCause).toBe('BOTTOM_OUT_CHASSIS_IMPACT');

    // Post-landing telemetry continues for >= 10.0s
    const postLandingDuration =
      mission.telemetryFrames[mission.telemetryFrames.length - 1].timeS -
      mission.events.primaryLandingTimeS;
    expect(postLandingDuration).toBeGreaterThanOrEqual(10.0);
  });

  it('injects real mission failures via FailureConfig: crosswind drift outside 3m target, pinFrictionJam at 200m, and bladeDeployAsymmetry nutation', () => {
    const assembly = createDefaultAssembly({ useGps: false });

    // 1. Crosswind & gusts -> drifts outside 3m target circle (radius > 1.5m) & oblique impact
    const windMission = runFullMissionSimulation({
      assembly,
      dropAltitudeM: 450.0,
      separationAltitudeM: 200.0,
      targetCircleDiameterM: 3.0,
      postLandingDurationS: 10.0,
      dtS: 0.1,
      failureConfig: {
        windSpeedMs: 6.5,
        windGustsMs: 2.5,
      },
    });
    expect(windMission.events.primaryLandingRadiusM).toBeGreaterThan(1.5);
    expect(windMission.events.landedInsideTarget).toBe(false);
    expect(windMission.impactReport.primary.impactAngleDeg).toBeGreaterThan(10.0);

    // 2. Mechanical pin friction jam at 200m -> fails to decouple, crashes at high speed (> 20 m/s)
    const jammedMission = runFullMissionSimulation({
      assembly,
      dropAltitudeM: 450.0,
      separationAltitudeM: 200.0,
      targetCircleDiameterM: 3.0,
      postLandingDurationS: 10.0,
      dtS: 0.1,
      failureConfig: {
        pinFrictionJam: true,
      },
    });
    expect(jammedMission.events.servoJammed).toBe(true);
    expect(jammedMission.primaryTouchdownVzMS).toBeGreaterThan(20.0);
    expect(jammedMission.impactReport.primary.eggSurvived).toBe(false);

    // 3. Blade deployment asymmetry -> nutation/wobble (> 15 deg) & loss of lift (Vz > 12 m/s)
    const asymMission = runFullMissionSimulation({
      assembly,
      dropAltitudeM: 450.0,
      separationAltitudeM: 200.0,
      targetCircleDiameterM: 3.0,
      postLandingDurationS: 10.0,
      dtS: 0.1,
      failureConfig: {
        bladeDeployAsymmetry: 0.65,
      },
    });
    expect(asymMission.events.maxTiltDeg).toBeGreaterThan(15.0);
    expect(asymMission.primaryTouchdownVzMS).toBeGreaterThan(12.0);
    expect(asymMission.impactReport.primary.eggSurvived).toBe(false);
  });

  it('reflects blind ballistic tracking (NO_RF_BLIND_ESTIMATE) when Secondary Payload has zero electronics', () => {
    const cleanAssembly = createDefaultAssembly({ useGps: false });
    expect(cleanAssembly.secondary.components.length).toBe(1); // Only egg

    const mission = runFullMissionSimulation({
      assembly: cleanAssembly,
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
    expect(postSepFrame!.relativeLocalization.mode).toBe('NO_RF_BLIND_ESTIMATE');
    expect(postSepFrame!.relativeLocalization.signalAvailable).toBe(false);
  });
});
