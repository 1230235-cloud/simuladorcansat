import { describe, it, expect } from 'vitest';
import { MATERIALS } from '../src/assembly/materials';
import { createDefaultAssembly, COMPONENT_CATALOG } from '../src/assembly/components';
import { validateCanSatEnvelope } from '../src/assembly/validator';

describe('Phase 1.2: Real Team Hardware (Heltec LoRa V3), Clean Secondary & Regulatory Envelope', () => {
  it('defines all 5 mandatory chassis materials with physical density and crush stress', () => {
    const required = ['PLA', 'PETG', 'ABS', 'CarbonFiber', 'Aluminum6061'] as const;
    for (const mat of required) {
      expect(MATERIALS[mat]).toBeDefined();
      expect(MATERIALS[mat].densityKgM3).toBeGreaterThan(900);
      expect(MATERIALS[mat].crushStressPa).toBeGreaterThan(1e5);
    }
  });

  it('equips Primary Payload with real hardware (Heltec LoRa V3, BMP280, BNO080, Mini360, SG90, 9V PP3, Egg 1) and keeps Secondary 100% free of electronics by default', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const report = validateCanSatEnvelope(assembly);

    expect(report.isValid).toBe(true);
    expect(report.totalMassKg).toBeLessThanOrEqual(0.600);

    const pIds = assembly.primary.components.map((c) => c.id);
    expect(pIds).toContain('Heltec_LoRa_V3');
    expect(pIds).toContain('BMP280_Primary');
    expect(pIds).toContain('IMU_BNO080_9DOF');
    expect(pIds).toContain('Regulador_Mini360');
    expect(pIds).toContain('Servo_SG90');
    expect(pIds).toContain('Battery_9V_PP3_Primary');
    expect(pIds).toContain('Chicken_Egg_65g');

    const heltec = assembly.primary.components.find((c) => c.id === 'Heltec_LoRa_V3');
    expect(heltec?.massKg).toBeCloseTo(0.025, 3);

    // Secondary Payload must have ONLY Chicken_Egg_65g (zero electronics by default)
    expect(assembly.secondary.components.length).toBe(1);
    expect(assembly.secondary.components[0].id).toBe('Chicken_Egg_65g');
    expect(assembly.secondary.components[0].massKg).toBeCloseTo(0.065, 4);

    // Catalog includes real hardware
    expect(COMPONENT_CATALOG.some((c) => c.id === 'Heltec_LoRa_V3')).toBe(true);
    expect(COMPONENT_CATALOG.some((c) => c.id === 'IMU_BNO080_9DOF')).toBe(true);
    expect(COMPONENT_CATALOG.some((c) => c.id === 'Regulador_Mini360')).toBe(true);
    expect(COMPONENT_CATALOG.some((c) => c.id === 'Servo_SG90')).toBe(true);
  });

  it('rejects invalid batteries (LiPo) or total mass exceeding 0.600 kg', () => {
    const invalidAssembly = createDefaultAssembly({ useGps: true });
    invalidAssembly.primary.components.push({
      id: 'Illegal_LiPo',
      category: 'battery',
      type: 'LiPo_3S',
      massKg: 0.350,
      positionM: { x: 0, y: 0, z: 0.10 },
      radiusM: 0.02,
    });
    const report = validateCanSatEnvelope(invalidAssembly);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('9V_PP3') || e.includes('mass'))).toBe(true);
  });

  it('enforces dimensional limits: H_total in [0.20, 0.23]m, D in [0.09, 0.10]m, H1 <= 0.16m, H2 <= 0.07m', () => {
    const assembly = createDefaultAssembly({ useGps: false });
    const totalHeightM = assembly.primary.heightM + assembly.secondary.heightM;

    expect(totalHeightM).toBeGreaterThanOrEqual(0.20);
    expect(totalHeightM).toBeLessThanOrEqual(0.23);
    expect(assembly.primary.heightM).toBeLessThanOrEqual(0.16);
    expect(assembly.secondary.heightM).toBeLessThanOrEqual(0.07);
    expect(assembly.primary.diameterM).toBeGreaterThanOrEqual(0.09);
    expect(assembly.primary.diameterM).toBeLessThanOrEqual(0.10);
    expect(assembly.secondary.diameterM).toBeGreaterThanOrEqual(0.09);
    expect(assembly.secondary.diameterM).toBeLessThanOrEqual(0.10);
    expect(assembly.hasExternalProtuberances).toBe(false);
  });

  it('toggles GPS_Module mass and presence via boolean useGps option', () => {
    const withGps = createDefaultAssembly({ useGps: true });
    const withoutGps = createDefaultAssembly({ useGps: false });

    expect(withGps.useGps).toBe(true);
    expect(withoutGps.useGps).toBe(false);

    const gpsPartOn = withGps.primary.components.find((c) => c.id === 'GPS_Module');
    const gpsPartOff = withoutGps.primary.components.find((c) => c.id === 'GPS_Module');

    expect(gpsPartOn).toBeDefined();
    expect(gpsPartOn!.massKg).toBeGreaterThan(0.005);
    expect(gpsPartOff).toBeUndefined();
  });
});
