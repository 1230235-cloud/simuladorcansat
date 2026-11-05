import { describe, it, expect } from 'vitest';
import { MATERIALS } from '../src/assembly/materials';
import { createDefaultAssembly } from '../src/assembly/components';
import { validateCanSatEnvelope } from '../src/assembly/validator';

describe('Phase 1.2: Materials, Internal Components & Regulatory Envelope', () => {
  it('defines all 5 mandatory chassis materials with physical density and crush stress', () => {
    const required = ['PLA', 'PETG', 'ABS', 'CarbonFiber', 'Aluminum6061'] as const;
    for (const mat of required) {
      expect(MATERIALS[mat]).toBeDefined();
      expect(MATERIALS[mat].densityKgM3).toBeGreaterThan(900);
      expect(MATERIALS[mat].crushStressPa).toBeGreaterThan(1e5);
    }
  });

  it('enforces 600g max total mass, two 65g chicken eggs, and strictly 9V_PP3 batteries', () => {
    const assembly = createDefaultAssembly({ useGps: true });
    const report = validateCanSatEnvelope(assembly);

    expect(report.isValid).toBe(true);
    expect(report.totalMassKg).toBeLessThanOrEqual(0.600);

    const primaryEgg = assembly.primary.components.find((c) => c.id === 'Chicken_Egg_65g');
    const secondaryEgg = assembly.secondary.components.find((c) => c.id === 'Chicken_Egg_65g');
    expect(primaryEgg?.massKg).toBeCloseTo(0.065, 4);
    expect(secondaryEgg?.massKg).toBeCloseTo(0.065, 4);
    expect((primaryEgg?.massKg ?? 0) + (secondaryEgg?.massKg ?? 0)).toBeCloseTo(0.130, 4);

    const allComponents = [...assembly.primary.components, ...assembly.secondary.components];
    const batteries = allComponents.filter((c) => c.category === 'battery');
    expect(batteries.length).toBeGreaterThanOrEqual(1);
    for (const bat of batteries) {
      expect(bat.type).toBe('9V_PP3');
    }

    const activeRotorMotors = allComponents.filter((c) => c.category === 'active_rotor_motor');
    expect(activeRotorMotors.length).toBe(0);
  });

  it('rejects invalid batteries (LiPo) or total mass exceeding 0.600 kg', () => {
    const invalidAssembly = createDefaultAssembly({ useGps: true });
    invalidAssembly.primary.components.push({
      id: 'Illegal_LiPo',
      category: 'battery',
      type: 'LiPo_3S',
      massKg: 0.250,
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
