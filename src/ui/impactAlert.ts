import { MissionResult } from '../sim/flightLoop';
import { CanSat3DViewport } from './viewport3d';

export function updateImpactAlert(
  viewport: CanSat3DViewport,
  mission: MissionResult | null,
  t: number
): void {
  if (!mission) return;
  const banner = document.getElementById('impact-alert-banner');
  const rep = mission.impactReport;
  const pG = rep.primary.peakGLoad;
  const sG = rep.secondary.peakGLoad;
  const pLanded = t >= mission.events.primaryLandingTimeS;
  const sLanded = t >= mission.events.secondaryLandingTimeS;

  const pFail = pLanded && (pG > 45.0 || !rep.primary.eggSurvived);
  const sFail = sLanded && (sG > 45.0 || !rep.secondary.eggSurvived);

  viewport.setBlinkState(pFail, sFail);
  if (banner) {
    if (pFail && sFail) {
      banner.className = 'impact-alert-banner alert-critical';
      banner.textContent = '💥 IMPACTO CRÍTICO: AMBOS HUEVOS FRACTURADOS';
      banner.style.display = 'block';
    } else if (pFail) {
      banner.className = 'impact-alert-banner alert-critical';
      banner.textContent = rep.primary.bottomedOut
        ? '💥 CARGA 1: HUEVO FRACTURADO (BOTTOM-OUT)'
        : '💥 CARGA 1: HUEVO FRACTURADO (> 45 G)';
      banner.style.display = 'block';
    } else if ((pLanded || sLanded) && !pFail && sFail) {
      banner.className = 'impact-alert-banner alert-warning';
      banner.textContent = '⚠️ PRIMARIA INTACTA (<45G) | SECUNDARIA FRACTURADA (CAÍDA LIBRE)';
      banner.style.display = 'block';
    } else if (pLanded && rep.bothEggsSurvived) {
      banner.className = 'impact-alert-banner alert-success';
      banner.textContent = '✅ ATERRIZAJE EXITOSO: HUEVOS INTACTOS (< 45 G)';
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }
}
