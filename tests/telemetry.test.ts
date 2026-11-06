import { describe, it, expect } from 'vitest';
import {
  synthesizeTelemetryFrame,
  estimateVelocityAndMaxAltitudeFromTelemetry,
  computeRelativeLocalization,
} from '../src/sim/telemetry';

describe('Phase 4.1: Synthetic Sensors, Trajectory Estimator & Relative Localization (useGps Toggle)', () => {
  it('generates realistic Barometer (P, T), 9-axis IMU (accel, gyro omega_z, orientation) and servo state', () => {
    const frame = synthesizeTelemetryFrame({
      timeS: 25.0,
      phase: 'PRIMARY_AUTOROTATION',
      primaryPositionM: { x: 0.4, y: -0.3, z: 120.0 },
      primaryVelocityMS: { x: 0.1, y: -0.1, z: -10.2 }, // descending at 10.2 m/s
      primaryAccelMS2: { x: 0.0, y: 0.0, z: 0.0 },
      primaryAttitudeRad: { roll: 0.02, pitch: -0.01, yaw: 1.57 },
      omegaZRadS: 250.0, // ~2387 RPM
      secondaryPositionM: { x: 1.1, y: 0.8, z: 45.0 },
      servoReleased: true,
      useGps: true,
    });

    expect(frame.barometer.pressurePa).toBeGreaterThan(95000);
    expect(frame.barometer.pressurePa).toBeLessThan(101325);
    expect(frame.barometer.temperatureC).toBeCloseTo(15.0 - 0.0065 * 120.0, 1);

    expect(frame.imu.gyroRadS.z).toBeCloseTo(250.0, 1);
    expect(frame.imu.rpmZ).toBeCloseTo((250.0 * 60) / (2 * Math.PI), 0);
    expect(frame.imu.orientationRad.roll).toBeCloseTo(0.02, 2);
    expect(frame.servoReleased).toBe(true);
  });

  it('reconstructs velocity profile and maximum achieved altitude (~450 m) from telemetry frames', () => {
    const frames = [
      synthesizeTelemetryFrame({
        timeS: 0,
        phase: 'ASCENT',
        primaryPositionM: { x: 0, y: 0, z: 0 },
        primaryVelocityMS: { x: 0, y: 0, z: 10 },
        primaryAccelMS2: { x: 0, y: 0, z: 0 },
        primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 },
        omegaZRadS: 0,
        secondaryPositionM: { x: 0, y: 0, z: 0 },
        servoReleased: false,
        useGps: true,
      }),
      synthesizeTelemetryFrame({
        timeS: 45,
        phase: 'DROP_COUPLED',
        primaryPositionM: { x: 0, y: 0, z: 450.0 },
        primaryVelocityMS: { x: 0, y: 0, z: 0 },
        primaryAccelMS2: { x: 0, y: 0, z: -9.81 },
        primaryAttitudeRad: { roll: 0, pitch: 0, yaw: 0 },
        omegaZRadS: 0,
        secondaryPositionM: { x: 0, y: 0, z: 450.0 },
        servoReleased: false,
        useGps: true,
      }),
      synthesizeTelemetryFrame({
        timeS: 60,
        phase: 'PRIMARY_AUTOROTATION',
        primaryPositionM: { x: 0.2, y: 0.1, z: 100.0 },
        primaryVelocityMS: { x: 0, y: 0, z: -10.2 },
        primaryAccelMS2: { x: 0, y: 0, z: 0 },
        primaryAttitudeRad: { roll: 0.01, pitch: 0.01, yaw: 0.5 },
        omegaZRadS: 253.0,
        secondaryPositionM: { x: 0.5, y: 0.4, z: 0 },
        servoReleased: true,
        useGps: true,
      }),
    ];

    const summary = estimateVelocityAndMaxAltitudeFromTelemetry(frames);
    expect(summary.maxAltitudeM).toBeCloseTo(450.0, 0);
    expect(summary.estimatedVelocitiesMS.length).toBe(frames.length);
    expect(Math.abs(summary.estimatedVelocitiesMS[2])).toBeCloseTo(10.2, 0);
  });

  it('computes Primary-to-Secondary distance d_12 and bearing psi_12 in both useGps=true (GPS) and useGps=false (RSSI + Baro/IMU) modes', () => {
    const p1 = { x: 0.3, y: -0.2, z: 80.0 };
    const p2 = { x: 1.5, y: 1.0, z: 0.0 };

    const trueDx = p2.x - p1.x;
    const trueDy = p2.y - p1.y;
    const trueDz = p2.z - p1.z;
    const trueDist3D = Math.hypot(trueDx, trueDy, trueDz);
    const trueBearingRad = Math.atan2(trueDy, trueDx);

    const locGps = computeRelativeLocalization({
      primaryPositionM: p1,
      secondaryPositionM: p2,
      useGps: true,
    });

    expect(locGps.mode).toBe('GPS_DIFFERENTIAL');
    expect(locGps.distance3DM).toBeCloseTo(trueDist3D, 0);
    expect(locGps.bearingRad).toBeCloseTo(trueBearingRad, 1);
    expect(locGps.gpsCoordinates).toBeDefined();

    const locRssi = computeRelativeLocalization({
      primaryPositionM: p1,
      secondaryPositionM: p2,
      useGps: false,
    });

    expect(locRssi.mode).toBe('RSSI_IMU_BALLISTIC');
    expect(locRssi.gpsCoordinates).toBeUndefined();
    expect(locRssi.rssiDbm).toBeLessThan(-40);
    expect(Math.abs(locRssi.distance3DM - trueDist3D)).toBeLessThan(8.0);
    expect(Math.abs(locRssi.bearingRad - trueBearingRad)).toBeLessThan(0.25);

    // Passive Secondary with zero electronics (no LoRa transmitter / no GPS)
    const locNoRf = computeRelativeLocalization({
      primaryPositionM: p1,
      secondaryPositionM: p2,
      useGps: false,
      secondaryHasRf: false,
    });

    expect(locNoRf.mode).toBe('NO_RF_BLIND_ESTIMATE');
    expect(locNoRf.signalAvailable).toBe(false);
    expect(locNoRf.rssiDbm).toBeUndefined();
    expect(locNoRf.gpsCoordinates).toBeUndefined();
  });
});
