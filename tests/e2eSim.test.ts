import { describe, it, expect } from 'vitest';
import {
  createDashboardController,
  exportMissionTelemetryCsv,
  exportMissionTelemetryJson,
} from '../src/ui/dashboard';
import { interpolateSceneStateAtTime } from '../src/ui/scene3d';

describe('Phase 5: 3D Playback State, Interactive Dashboard Controller & Telemetry Exporter', () => {
  it('recalculates total mass (< 600g), CoM, and egg G-load alert reactively when changing chassis material, toggling useGps, or adding components', () => {
    const controller = createDashboardController({
      material: 'PLA',
      useGps: true,
    });

    const initialState = controller.getState();
    expect(initialState.envelopeReport.isValid).toBe(true);
    expect(initialState.envelopeReport.totalMassKg).toBeLessThanOrEqual(0.600);
    expect(initialState.useGps).toBe(true);
    expect(initialState.eggFractureAlert).toBe(false);

    // 1. Toggle useGps -> false (mass decreases by GPS module mass)
    controller.setUseGps(false);
    const noGpsState = controller.getState();
    expect(noGpsState.useGps).toBe(false);
    expect(noGpsState.envelopeReport.totalMassKg).toBeLessThan(
      initialState.envelopeReport.totalMassKg
    );

    // 2. Switch chassis material from PLA (1240 kg/m3) to Aluminum6061 (2700 kg/m3)
    controller.setChassisMaterial('Aluminum6061');
    const aluState = controller.getState();
    expect(aluState.material).toBe('Aluminum6061');
    expect(aluState.envelopeReport.totalMassKg).toBeGreaterThan(
      noGpsState.envelopeReport.totalMassKg
    );

    // 3. Add custom internal sensor and verify CoM & mass update
    controller.addInternalComponent('primary', {
      id: 'Extra_Camera_Payload',
      category: 'sensor',
      massKg: 0.015,
      positionM: { x: 0, y: 0, z: 0.12 },
      radiusM: 0.01,
    });
    const updatedState = controller.getState();
    expect(updatedState.massProperties.coupled.comM.z).not.toBeCloseTo(
      aluState.massProperties.coupled.comM.z,
      4
    );

    // 4. Trigger egg G-load alert when impact velocity / stroke exceeds 45 G limit
    controller.simulateCustomImpact({
      primaryTouchdownVzMS: 11.5,
      secondaryTouchdownVzMS: 55.0,
      overrideSecondaryStrokeM: 0.01, // Insufficient crush stroke -> > 45 G
    });
    expect(controller.getState().eggFractureAlert).toBe(true);
  });

  it('interpolates 3D scene state at any timestamp t (Primary/Secondary Z positions, 200m separation flag, blade spin angle from RPM, and force/CoM vectors)', () => {
    const controller = createDashboardController({ material: 'PETG', useGps: true });
    const mission = controller.runSimulation();

    // Before separation (e.g., during coupled drop at h > 200m)
    const tCoupled = mission.events.dropTimeS + 2.0;
    const stateCoupled = interpolateSceneStateAtTime(mission, tCoupled);

    expect(stateCoupled.isSeparated).toBe(false);
    expect(stateCoupled.primaryZ).toBeGreaterThan(200.0);
    expect(stateCoupled.secondaryZ).toBeCloseTo(stateCoupled.primaryZ, 2);
    expect(stateCoupled.targetCircleDiameterM).toBe(3.0);

    // After separation at h < 200m (autorotation active)
    const tAutorot = mission.events.separationTimeS + 5.0;
    const stateAutorot = interpolateSceneStateAtTime(mission, tAutorot);

    expect(stateAutorot.isSeparated).toBe(true);
    expect(stateAutorot.primaryZ).toBeLessThan(200.0);
    expect(stateAutorot.primaryZ).toBeGreaterThan(stateAutorot.secondaryZ);
    expect(stateAutorot.bladeRpm).toBeGreaterThan(500);
    expect(stateAutorot.bladeSpinAngleRad).toBeGreaterThan(0);
    expect(stateAutorot.vectors.thrustN).toBeGreaterThan(0);
    expect(stateAutorot.vectors.comZ).toBeGreaterThan(0);
    expect(stateAutorot.vectors.relativeDistanceM).toBeGreaterThan(0);
  });

  it('exports complete mission telemetry (CSV & JSON) including +10s post-landing window, reconstructed velocity, max altitude (~450m), and relative localization vector', () => {
    const controller = createDashboardController({ material: 'CarbonFiber', useGps: true });
    const mission = controller.runSimulation();

    const csv = exportMissionTelemetryCsv(mission);
    const lines = csv.trim().split('\n');
    const header = lines[0];

    expect(header).toContain('timeS');
    expect(header).toContain('phase');
    expect(header).toContain('pressurePa');
    expect(header).toContain('temperatureC');
    expect(header).toContain('rollRad');
    expect(header).toContain('pitchRad');
    expect(header).toContain('yawRad');
    expect(header).toContain('accelZMS2');
    expect(header).toContain('reconstructedVzMS');
    expect(header).toContain('distanceToSecondaryM');
    expect(header).toContain('bearingToSecondaryRad');
    expect(lines.length).toBe(mission.telemetryFrames.length + 1);

    const jsonStr = exportMissionTelemetryJson(mission);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.maxAchievedAltitudeM).toBeCloseTo(450.0, 0);
    expect(parsed.postLandingDurationS).toBeGreaterThanOrEqual(10.0);
    expect(parsed.bothEggsSurvived).toBe(true);
    expect(parsed.frames.length).toBe(mission.telemetryFrames.length);
    expect(parsed.frames[parsed.frames.length - 1].phase).toBe('POST_LANDING');
  });
});
