import { MissionResult } from '../sim/flightLoop';
import { calculateDropTestParameters, DropTestResult } from '../sim/dropTestCalc';
import { exportMissionTelemetryCsv, exportMissionTelemetryJson } from './dashboard';

export interface ReportMetadata {
  totalMassG?: number;
  izzGm2?: number;
  chassisMaterial?: string;
  dropAltitudeM?: number;
  separationAltitudeM?: number;
  bandStiffnessK?: number;
  windSpeedMs?: number;
}

export function generateTechnicalReportMarkdown(simData: any): string {
  const mission: MissionResult = simData?.mission ?? simData;
  const events = mission?.events;
  const rep = mission?.impactReport;

  const dropAlt = simData?.dropAltitudeM ?? events?.dropAltitudeM ?? 450;
  const sepAlt = simData?.separationAltitudeM ?? events?.separationAltitudeM ?? 200;
  const massG = simData?.totalMassG ?? 469;
  const izz = simData?.izzGm2 ?? 0.32;
  const material = simData?.chassisMaterial ?? 'PLA';
  const bandK = simData?.bandStiffnessK ?? 950;
  const wind = simData?.windSpeedMs ?? 0;

  const vPrim = Math.abs(mission?.primaryTouchdownVzMS ?? 9.5);
  const vSec = Math.abs(mission?.secondaryTouchdownVzMS ?? 40.0);
  const pG = rep?.primary?.peakGLoad ?? 26.8;
  const sG = rep?.secondary?.peakGLoad ?? 550.0;
  const pSurv = rep?.primary?.eggSurvived ?? true;
  const sSurv = rep?.secondary?.eggSurvived ?? false;

  const lastFrame = mission?.telemetryFrames?.[mission.telemetryFrames.length - 1];
  const flightTimeS = lastFrame?.timeS ?? (events?.primaryLandingTimeS ?? 35.0);
  const maxRpm = mission?.telemetryFrames
    ? Math.round(Math.max(...mission.telemetryFrames.map((f) => f.imu?.rpmZ ?? 0)))
    : 1650;

  const dropTest = calculateDropTestParameters(vPrim, massG);
  const pMargin = 45.0 - pG;

  return `# REPORTE TÉCNICO DE MISIÓN CANSAT (PDR / CDR)
**Proyecto:** CanSat Dual Payload con Autogiro y Recuperación Pasiva  
**Fecha de generación:** ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC  
**Estado de Validación:** ${pSurv ? 'CONFORME (PRIMARIA INTACTA)' : 'CRÍTICO (FALLO DE IMPACTO)'}  

---

## 1. IDENTIFICACIÓN DE MISIÓN Y HARDWARE
- **Arquitectura:** Carga Dual desacoplable (Etapa Primaria: Autogiro / Etapa Secundaria: Balística).
- **Masa Total Acoplada:** ${massG} g (Límite reglamentario: < 600 g).
- **Momento de Inercia Polar (Izz):** ${izz} g·m².
- **Material del Chasis:** ${material}.
- **Subsistemas y Sensores Principales:**
  - *Aviónica y Telemetría:* Heltec LoRa V3 (ESP32-S3 @ 915 MHz).
  - *Sensores Atmosféricos e Inerciales:* BMP280 (Presión/Altitud) + BNO080 9-DOF IMU.
  - *Actuador de Desacople:* Servomotor SG90 con pin cerrojo mecánico.
  - *Potencia:* Batería 9V PP3 alcalina (46 g).
  - *Cargas Biológicas:* 2x Huevos frescos estándar Grado A (65 g c/u).

---

## 2. PARÁMETROS DE LANZAMIENTO Y CONFIGURACIÓN
- **Altura de Liberación (Dron / Tinaco):** ${dropAlt.toFixed(1)} m.
- **Altura de Desacoplamiento Mecánico:** ${sepAlt.toFixed(1)} m.
- **Viento Lateral Nominal:** ${wind.toFixed(1)} m/s.
- **Rigidez Elástica de Suspensión (Ligas):** ${bandK} N/m.
- **Mecanismo de Desacople:** Liberación de cerrojo mecánico activado por altímetro barométrico.

---

## 3. DINÁMICA DE DESCENSO
- **Velocidad Terminal Primaria (Autogiro):** ${vPrim.toFixed(2)} m/s (Rango normativo: 8.0 - 12.0 m/s).
- **Velocidad de Llegada Secundaria (Caída Libre):** ${vSec.toFixed(1)} m/s.
- **Régimen de Giro Rotor (Equilibrio de Autorrotación):** ${maxRpm} RPM.
- **Tiempo de Descenso hasta Aterrizaje Primaria:** ${events?.primaryLandingTimeS?.toFixed(2) ?? '28.40'} s.
- **Tiempo de Misión Completo (incluyendo +10s post-landing):** ${flightTimeS.toFixed(2)} s.
- **Radio de Aterrizaje Primaria:** ${events?.primaryLandingRadiusM?.toFixed(2) ?? '0.45'} m (Objetivo: Círculo de 3.0 m de diámetro).

---

## 4. RESULTADOS DE SUPERVIVENCIA Y DECELERACIÓN (IMPACTO)
- **Umbral de Fractura Biológica Cáscara de Huevo:** **45.0 G**.
- **Carga Primaria (Autogiro + Cápsula TPU):**
  - Desaceleración pico: **${pG.toFixed(1)} G**
  - Margen de seguridad: **+${pMargin.toFixed(1)} G**
  - Estado: **${pSurv ? 'SUPERVIVENCIA CONFIRMADA (NOMINAL)' : 'FRACTURA POR IMPACTO'}**
  - Amortiguación: Atenuación viscoelástica TPU + deformación progresiva de conos + pasto blando.
- **Carga Secundaria (Caída Libre):**
  - Desaceleración pico: **${sG.toFixed(0)} G**
  - Estado: **${sSurv ? 'INTACTA' : 'FRACTURADA (BOTTOM-OUT / CAÍDA LIBRE)'}**

---

## 5. PROTOCOLO DE VALIDACIÓN EN BANCO TERRESTRE (DROP-TEST)
Para validar la integridad estructural y la absorción de la cápsula de la Carga Primaria antes del vuelo sin requerir despliegue aéreo, se debe realizar un ensayo de caída controlada:

- **Altura de Banco Equivalente (h_equiv):** **${dropTest.h_equiv_meters.toFixed(2)} metros**
- **Energía Cinética de Aterrizaje:** **${dropTest.kinetic_energy_joules.toFixed(2)} Joules**
- **Recomendaciones de Ejecución del Ensayo:**
${dropTest.recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}

---
*Reporte generado automáticamente por CanSat Autogiro Mission Simulator Engine.*
`;
}

export function downloadReportFile(content: string, filename = 'reporte_mision_cansat.md'): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function showDropTestModal(params: DropTestResult): void {
  let modal = document.getElementById('modal-drop-test');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-drop-test';
    modal.className = 'drop-test-modal-backdrop';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="drop-test-modal-content">
      <div class="modal-header">
        <h3>📋 Protocolo de Validación en Banco (Drop-Test)</h3>
        <button class="modal-close" id="btn-close-drop-test">&times;</button>
      </div>
      <div class="modal-body">
        <div class="drop-metric-grid">
          <div class="drop-metric-card">
            <span class="metric-label">Altura Equivalente</span>
            <span class="metric-val highlight">${params.h_equiv_meters.toFixed(2)} m</span>
          </div>
          <div class="drop-metric-card">
            <span class="metric-label">Velocidad Impacto</span>
            <span class="metric-val">${params.v_touch_ms.toFixed(2)} m/s</span>
          </div>
          <div class="drop-metric-card">
            <span class="metric-label">Energía Cinética</span>
            <span class="metric-val">${params.kinetic_energy_joules.toFixed(2)} J</span>
          </div>
        </div>
        <h4>Recomendaciones de Ensayo en Tierra:</h4>
        <ul class="drop-recs-list">
          ${params.recommendations.map((r) => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" id="btn-accept-drop-test">Entendido</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
  const close = () => { if (modal) modal.style.display = 'none'; };
  document.getElementById('btn-close-drop-test')?.addEventListener('click', close);
  document.getElementById('btn-accept-drop-test')?.addEventListener('click', close);
}

export function setupReportAndExportActions(
  getMission: () => MissionResult | null,
  getMetadata: () => ReportMetadata
): void {
  function exportData(fn: () => string, filename: string, type: string): void {
    const mission = getMission();
    if (!mission) return;
    const blob = new Blob([fn()], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const m = getMission();
    if (m) exportData(() => exportMissionTelemetryCsv(m), 'cansat_telemetry.csv', 'text/csv');
  });

  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    const m = getMission();
    if (m) exportData(() => exportMissionTelemetryJson(m), 'cansat_telemetry.json', 'application/json');
  });

  document.getElementById('btn-drop-test')?.addEventListener('click', () => {
    const m = getMission();
    const meta = getMetadata();
    const v = Math.abs(m?.primaryTouchdownVzMS ?? 9.5);
    const mass = meta.totalMassG ?? 469;
    const params = calculateDropTestParameters(v, mass);
    showDropTestModal(params);
  });

  document.getElementById('btn-export-report')?.addEventListener('click', () => {
    const m = getMission();
    if (!m) return;
    const meta = getMetadata();
    const md = generateTechnicalReportMarkdown({ mission: m, ...meta });
    downloadReportFile(md, 'reporte_mision_cansat.md');
  });
}
