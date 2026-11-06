export interface DropTestResult {
  v_touch_ms: number;
  mass_grams: number;
  h_equiv_meters: number;
  kinetic_energy_joules: number;
  recommendations: string[];
}

export function calculateDropTestParameters(
  v_touch: number,
  massGram: number
): DropTestResult {
  const g0 = 9.81;
  const h_equiv = (v_touch ** 2) / (2 * g0);
  const kinetic_energy = 0.5 * (massGram / 1000) * (v_touch ** 2);

  const recommendations = [
    'Superficie de impacto: Pasto húmedo o colchón elastomérico con rigidez equivalente (deformación elástica 15-25 mm).',
    'Inspección post-impacto: Usar luz ultravioleta o tinte penetrante para descartar microfisuras en la cáscara del huevo.',
    'Orientación polar: Lanzar con el eje longitudinal del huevo alineado verticalmente para maximizar la resistencia estructural.',
    'Masa de prueba: Verificar que el huevo utilizado sea de 60 a 65 gramos con cámara de aire intacta.',
    'Cápsula TPU: Asegurar que los conos de deformación progresiva y las bandas elásticas no queden pinzadas con el chasis rígido.',
  ];

  return {
    v_touch_ms: Number(v_touch.toFixed(2)),
    mass_grams: Number(massGram.toFixed(1)),
    h_equiv_meters: Number(h_equiv.toFixed(2)),
    kinetic_energy_joules: Number(kinetic_energy.toFixed(2)),
    recommendations,
  };
}
