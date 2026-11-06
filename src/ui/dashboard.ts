import {
  DualCanSatAssembly,
  createDefaultAssembly,
  Component,
} from '../assembly/components';
import { MaterialName } from '../assembly/materials';
import { validateCanSatEnvelope, EnvelopeValidationReport } from '../assembly/validator';
import { computeMassProperties, DualMassProperties } from '../physics/massProperties';
import { runFullMissionSimulation, MissionResult } from '../sim/flightLoop';
import { FailureConfig } from '../physics/failures';
import { estimateVelocityAndMaxAltitudeFromTelemetry } from '../sim/telemetry';

export interface DashboardControllerOptions {
  material?: MaterialName;
  useGps?: boolean;
}

export interface DashboardState {
  material: MaterialName;
  useGps: boolean;
  assembly: DualCanSatAssembly;
  envelopeReport: EnvelopeValidationReport;
  massProperties: DualMassProperties;
  eggFractureAlert: boolean;
}

export interface CustomImpactParams {
  primaryTouchdownVzMS: number;
  secondaryTouchdownVzMS: number;
  overrideSecondaryStrokeM?: number;
}

export function createDashboardController(options: DashboardControllerOptions = {}) {
  let material: MaterialName = options.material ?? 'PLA';
  let useGps = options.useGps ?? true;
  let assembly: DualCanSatAssembly = createDefaultAssembly({ useGps });
  let eggFractureAlert = false;

  function recalculate(): DashboardState {
    const envelopeReport = validateCanSatEnvelope(assembly);
    const massProperties = computeMassProperties(assembly);
    return {
      material,
      useGps,
      assembly,
      envelopeReport,
      massProperties,
      eggFractureAlert,
    };
  }

  return {
    getState(): DashboardState {
      return recalculate();
    },
    setUseGps(enabled: boolean) {
      useGps = enabled;
      assembly = createDefaultAssembly({ useGps });
      return recalculate();
    },
    setChassisMaterial(newMaterial: MaterialName) {
      material = newMaterial;
      const densityMultipliers: Record<MaterialName, number> = {
        PLA: 1.0,
        PETG: 1.024,
        ABS: 0.838,
        CarbonFiber: 1.25,
        Aluminum6061: 2.177,
      };
      const mult = densityMultipliers[newMaterial] ?? 1.0;
      assembly.primary.chassisMassKg = 0.120 * mult;
      assembly.secondary.chassisMassKg = 0.085 * mult;
      return recalculate();
    },
    addInternalComponent(target: 'primary' | 'secondary', component: Component) {
      if (target === 'primary') {
        assembly.primary.components.push(component);
      } else {
        assembly.secondary.components.push(component);
      }
      return recalculate();
    },
    removeInternalComponent(target: 'primary' | 'secondary', componentId: string) {
      const list = target === 'primary' ? assembly.primary.components : assembly.secondary.components;
      const idx = list.findIndex((c) => c.id === componentId);
      if (idx !== -1) list.splice(idx, 1);
      return recalculate();
    },
    hasComponent(target: 'primary' | 'secondary', componentId: string): boolean {
      const list = target === 'primary' ? assembly.primary.components : assembly.secondary.components;
      return list.some((c) => c.id === componentId);
    },
    simulateCustomImpact(params: CustomImpactParams) {
      const g0 = 9.80665;
      const stroke1 = 0.145;
      const g1 = (params.primaryTouchdownVzMS ** 2) / (2 * 0.85 * stroke1) / g0;

      const stroke2 = params.overrideSecondaryStrokeM ?? 2.45;
      const g2 = (params.secondaryTouchdownVzMS ** 2) / (2 * 0.85 * stroke2) / g0;

      eggFractureAlert = g1 > 45.0 || g2 > 45.0;
      return eggFractureAlert;
    },
    runSimulation(
      failureConfig?: FailureConfig,
      altitudes?: { dropAltitudeM?: number; separationAltitudeM?: number }
    ): MissionResult {
      const res = runFullMissionSimulation({
        assembly,
        dropAltitudeM: altitudes?.dropAltitudeM ?? 450.0,
        separationAltitudeM: altitudes?.separationAltitudeM ?? 200.0,
        targetCircleDiameterM: 3.0,
        postLandingDurationS: 10.0,
        dtS: 0.05,
        failureConfig,
      });
      eggFractureAlert = !res.impactReport.bothEggsSurvived;
      return res;
    },
  };
}

export function exportMissionTelemetryCsv(mission: MissionResult): string {
  const summary = estimateVelocityAndMaxAltitudeFromTelemetry(mission.telemetryFrames);
  const rows: string[] = [];
  rows.push(
    'timeS,phase,pressurePa,temperatureC,rollRad,pitchRad,yawRad,accelZMS2,reconstructedVzMS,distanceToSecondaryM,bearingToSecondaryRad'
  );

  for (let i = 0; i < mission.telemetryFrames.length; i++) {
    const f = mission.telemetryFrames[i];
    const vz = summary.estimatedVelocitiesMS[i] ?? 0;
    rows.push(
      [
        f.timeS.toFixed(2),
        f.phase,
        f.barometer.pressurePa.toFixed(0),
        f.barometer.temperatureC.toFixed(1),
        f.imu.orientationRad.roll.toFixed(3),
        f.imu.orientationRad.pitch.toFixed(3),
        f.imu.orientationRad.yaw.toFixed(3),
        f.imu.accelMS2.z.toFixed(2),
        vz.toFixed(2),
        f.relativeLocalization.distance3DM.toFixed(2),
        f.relativeLocalization.bearingRad.toFixed(3),
      ].join(',')
    );
  }

  return rows.join('\n');
}

export function exportMissionTelemetryJson(mission: MissionResult): string {
  const summary = estimateVelocityAndMaxAltitudeFromTelemetry(mission.telemetryFrames);
  const postLandingDurationS =
    mission.telemetryFrames[mission.telemetryFrames.length - 1].timeS -
    mission.events.primaryLandingTimeS;

  return JSON.stringify(
    {
      maxAchievedAltitudeM: summary.maxAltitudeM,
      postLandingDurationS,
      bothEggsSurvived: mission.impactReport.bothEggsSurvived,
      events: mission.events,
      frames: mission.telemetryFrames,
    },
    null,
    2
  );
}
