import { describe, it, expect } from 'vitest';
import { calculateDropTestParameters } from '../src/sim/dropTestCalc';
import { generateTechnicalReportMarkdown } from '../src/ui/technicalReport';
import { createDashboardController } from '../src/ui/dashboard';

describe('Drop-Test Calculation and Technical PDR/CDR Report Generation', () => {
  it('calculates exact equivalent drop-test height and kinetic energy', () => {
    const vTouch = 9.5;
    const massGram = 469;
    const res = calculateDropTestParameters(vTouch, massGram);

    // h_equiv = 9.5^2 / (2 * 9.81) = 90.25 / 19.62 = 4.60 m
    expect(res.h_equiv_meters).toBeCloseTo(4.60, 1);
    // Ek = 0.5 * 0.469 * 90.25 = 21.16 J
    expect(res.kinetic_energy_joules).toBeCloseTo(21.16, 1);
    expect(res.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(res.recommendations.some((r) => r.includes('microfisuras'))).toBe(true);
  });

  it('generates complete PDR/CDR Markdown report with all required sections', () => {
    const controller = createDashboardController({ material: 'PLA', useGps: true });
    const mission = controller.runSimulation();

    const report = generateTechnicalReportMarkdown({
      mission,
      totalMassG: 469,
      izzGm2: 0.32,
      chassisMaterial: 'PLA',
      dropAltitudeM: 450,
      separationAltitudeM: 200,
      bandStiffnessK: 950,
      windSpeedMs: 0,
    });

    expect(report).toContain('# REPORTE TÉCNICO DE MISIÓN CANSAT (PDR / CDR)');
    expect(report).toContain('1. IDENTIFICACIÓN DE MISIÓN Y HARDWARE');
    expect(report).toContain('Heltec LoRa V3');
    expect(report).toContain('BMP280');
    expect(report).toContain('BNO080');
    expect(report).toContain('2. PARÁMETROS DE LANZAMIENTO Y CONFIGURACIÓN');
    expect(report).toContain('3. DINÁMICA DE DESCENSO');
    expect(report).toContain('4. RESULTADOS DE SUPERVIVENCIA Y DECELERACIÓN (IMPACTO)');
    expect(report).toContain('5. PROTOCOLO DE VALIDACIÓN EN BANCO TERRESTRE (DROP-TEST)');
    expect(report).toContain('h_equiv');
    expect(report).toContain('Energía Cinética');
  });
});
