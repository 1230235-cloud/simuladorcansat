import { createDashboardController, exportMissionTelemetryCsv, exportMissionTelemetryJson } from './ui/dashboard';
import { interpolateSceneStateAtTime } from './ui/scene3d';
import { CanSat3DViewport } from './ui/viewport3d';
import { CameraViewMode } from './ui/cameraController';
import { drawTimeSeriesChart, drawEggGauges, drawRelativeRadar } from './ui/charts';
import { setupCadImport, autoLoadDefaultModels } from './ui/cadManager';
import { setupFailureControls } from './ui/failureControls';
import { setupAltitudeControls } from './ui/altitudeControls';
import { updateImpactAlert } from './ui/impactAlert';
import { MissionResult } from './sim/flightLoop';
import { MaterialName } from './assembly/materials';
import { COMPONENT_CATALOG } from './assembly/components';

const controller = createDashboardController({ material: 'PLA', useGps: true });
const viewportContainer = document.getElementById('viewport3d-container')!;
const viewport = new CanSat3DViewport(viewportContainer);
setupCadImport(viewport, () => { if (currentMission) updateFrame(currentTimeS); });
autoLoadDefaultModels(viewport, () => { if (currentMission) updateFrame(currentTimeS); });
const getFailureConfig = setupFailureControls(() => runSimulationAndSetup(false));
setupAltitudeControls((alts) => {
  viewport.setAltitudes(alts.dropAltitudeM, alts.separationAltitudeM);
  runSimulationAndSetup(false);
});

let currentMission: MissionResult | null = null;
let currentTimeS = 0;
let isPlaying = false;
let currentCameraMode: CameraViewMode = 'orbit';
let lastRafTime = 0;

function updateHeaderAndBom(): void {
  const state = controller.getState();
  const massG = (state.envelopeReport.totalMassKg * 1000).toFixed(1);
  const comZCm = (state.massProperties.coupled.comM.z * 100).toFixed(1);
  const izz = (state.massProperties.coupled.izzKgM2 * 1000).toFixed(2);

  const massElem = document.getElementById('stat-mass')!;
  massElem.textContent = `${massG} g`;
  massElem.style.color = state.envelopeReport.totalMassKg <= 0.6 ? '#22c55e' : '#ef4444';
  document.getElementById('stat-com')!.textContent = `${comZCm} cm`;
  document.getElementById('stat-izz')!.textContent = `${izz} g·m²`;

  const envElem = document.getElementById('stat-envelope')!;
  envElem.textContent = state.envelopeReport.isValid ? 'VALID' : 'INVALID';
  envElem.style.color = state.envelopeReport.isValid ? '#22c55e' : '#ef4444';
  document.getElementById('stat-gps')!.textContent = state.useGps ? 'ACTIVE' : 'RSSI';
  const eggElem = document.getElementById('stat-eggs')!;
  const pSurv = currentMission ? currentMission.impactReport.primary.eggSurvived : !state.eggFractureAlert;
  const sSurv = currentMission ? currentMission.impactReport.secondary.eggSurvived : false;
  eggElem.textContent = currentMission ? (pSurv ? (sSurv ? 'HUEVOS INTACTOS' : 'C1: SURVIVED | C2: FAIL') : 'ALERT (>45G)') : (!state.eggFractureAlert ? 'HUEVOS INTACTOS' : 'ALERT (>45G)');
  eggElem.style.color = pSurv ? '#22c55e' : '#ef4444';

  const tbody = document.getElementById('bom-tbody')!;
  tbody.innerHTML = '';
  const rows = [
    { name: 'Primary Chassis', sub: 'Primary', m: state.assembly.primary.chassisMassKg },
    { name: 'Secondary Chassis', sub: 'Secondary', m: state.assembly.secondary.chassisMassKg },
    ...state.assembly.primary.components.map((c) => ({ name: c.id.replace(/_/g, ' '), sub: 'Primary', m: c.massKg })),
    ...state.assembly.secondary.components.map((c) => ({ name: c.id.replace(/_/g, ' '), sub: 'Secondary', m: c.massKg })),
  ];
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.name}</td><td>${r.sub}</td><td>${(r.m * 1000).toFixed(1)} g</td>`;
    tbody.appendChild(tr);
  });
}

function renderCatalog(): void {
  const container = document.getElementById('catalog-container')!;
  container.innerHTML = '';
  COMPONENT_CATALOG.forEach((item) => {
    const active = controller.hasComponent(item.stage, item.id);
    const row = document.createElement('div');
    row.className = 'catalog-item';
    row.innerHTML = `
      <label>
        <input type="checkbox" data-id="${item.id}" data-stage="${item.stage}" ${active ? 'checked' : ''} ${item.isMandatory ? 'disabled' : ''} />
        ${item.name}
      </label>
      <span class="catalog-meta">${(item.massKg * 1000).toFixed(0)}g</span>
    `;
    const chk = row.querySelector('input')!;
    chk.addEventListener('change', () => {
      if (chk.checked) {
        controller.addInternalComponent(item.stage, item);
      } else {
        controller.removeInternalComponent(item.stage, item.id);
      }
      updateHeaderAndBom();
      runSimulationAndSetup();
    });
    container.appendChild(row);
  });
}

function renderCharts(mission: MissionResult, t: number): void {
  const times = mission.telemetryFrames.map((f) => f.timeS);
  const alts = mission.telemetryFrames.map((f) => f.barometer.estimatedAltitudeM);
  const vels = mission.telemetryFrames.map((f) => f.estimatedVelocityMS ?? 0);
  const rpms = mission.telemetryFrames.map((f) => f.imu.rpmZ);

  drawTimeSeriesChart(document.getElementById('chart-altitude') as HTMLCanvasElement, { times, values: alts }, t, {
    title: 'Altitude Profile', unit: 'm', yRange: [0, mission.events.dropAltitudeM],
    eventMarkerTime: mission.events.separationTimeS, eventMarkerLabel: `${mission.events.separationAltitudeM.toFixed(0)}m Sep`,
  });
  drawTimeSeriesChart(document.getElementById('chart-velocity') as HTMLCanvasElement, { times, values: vels }, t, {
    title: 'Descent Velocity', unit: 'm/s', targetBand: [8, 12], lineColor: '#22c55e',
    eventMarkerTime: mission.events.separationTimeS, eventMarkerLabel: `${mission.events.separationAltitudeM.toFixed(0)}m Sep`,
  });
  drawTimeSeriesChart(document.getElementById('chart-rpm') as HTMLCanvasElement, { times, values: rpms }, t, {
    title: 'Autogiro Rotor RPM', unit: 'RPM', lineColor: '#eab308',
  });
  drawEggGauges(
    document.getElementById('chart-eggs') as HTMLCanvasElement,
    mission.impactReport.primary.peakGLoad,
    mission.impactReport.secondary.peakGLoad,
    mission.impactReport.primary.failureCause,
    mission.impactReport.secondary.failureCause
  );

  const state = interpolateSceneStateAtTime(mission, t);
  const secHasRf = controller.getState().assembly.secondary.components.some(
    (c) => c.category === 'avionics' || (c.category === 'sensor' && c.id.includes('GPS'))
  );
  drawRelativeRadar(
    document.getElementById('chart-radar') as HTMLCanvasElement,
    state.vectors.relativeDistanceM,
    state.bladeSpinAngleRad % (2 * Math.PI),
    controller.getState().useGps,
    secHasRf
  );
}

function runSimulationAndSetup(autoPlay = false): void {
  const dEl = document.getElementById('slider-drop-alt') as HTMLInputElement | null;
  const sEl = document.getElementById('slider-sep-alt') as HTMLInputElement | null;
  const kEl = document.getElementById('slider-stiffness') as HTMLInputElement | null;
  const tEl = document.getElementById('chk-tpu') as HTMLInputElement | null;
  const gEl = document.getElementById('select-ground') as HTMLSelectElement | null;
  const alts = { dropAltitudeM: dEl ? Number(dEl.value) : 450, separationAltitudeM: sEl ? Number(sEl.value) : 200 };
  const cfg = {
    ...getFailureConfig(),
    bandStiffnessK: kEl ? Number(kEl.value) : 950,
    hasTpuProtection: tEl ? tEl.checked : true,
    hasTpuCapsule: tEl ? tEl.checked : true,
    groundHardness: (gEl?.value ?? 'soft_grass') as any,
    groundType: (gEl?.value ?? 'soft_grass') as any,
  };
  viewport.setAltitudes(alts.dropAltitudeM, alts.separationAltitudeM);
  currentMission = controller.runSimulation(cfg, alts);
  const maxT = currentMission.telemetryFrames[currentMission.telemetryFrames.length - 1].timeS;
  const slider = document.getElementById('timeline-slider') as HTMLInputElement;
  slider.max = maxT.toFixed(2);
  currentTimeS = 0;
  slider.value = '0';
  document.getElementById('mission-status-badge')!.textContent = 'SIMULATED';
  document.getElementById('mission-status-badge')!.classList.add('active');
  if (autoPlay) {
    isPlaying = true;
    lastRafTime = 0;
    document.getElementById('btn-play-pause')!.textContent = '⏸ Pause';
  }
  updateHeaderAndBom();
  renderCharts(currentMission, 0);
  updateFrame(0);
}

function updateFrame(t: number): void {
  if (!currentMission) return;
  const state = interpolateSceneStateAtTime(currentMission, t);
  viewport.updateState(state, currentCameraMode);
  updateImpactAlert(viewport, currentMission, t);
  document.getElementById('timeline-label')!.textContent = `t = ${t.toFixed(2)} s / Alt: ${state.primaryZ.toFixed(1)} m`;
  renderCharts(currentMission, t);
}

function animationLoop(timestamp: number): void {
  if (lastRafTime === 0) lastRafTime = timestamp;
  const dt = (timestamp - lastRafTime) / 1000;
  lastRafTime = timestamp;

  if (isPlaying && currentMission) {
    const maxT = currentMission.telemetryFrames[currentMission.telemetryFrames.length - 1].timeS;
    currentTimeS += dt * 1.5;
    if (currentTimeS > maxT) {
      currentTimeS = maxT;
      isPlaying = false;
      document.getElementById('btn-play-pause')!.textContent = '▶ Play';
    }
    (document.getElementById('timeline-slider') as HTMLInputElement).value = currentTimeS.toFixed(2);
    updateFrame(currentTimeS);
  } else {
    viewport.render();
  }
  requestAnimationFrame(animationLoop);
}

// 2. Camera View Mode Controls
document.querySelectorAll('.btn-cam').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.btn-cam').forEach((b) => b.classList.remove('active'));
    const target = e.currentTarget as HTMLButtonElement;
    target.classList.add('active');
    currentCameraMode = target.getAttribute('data-cam') as CameraViewMode;
    viewport.setCameraMode(currentCameraMode);
    if (currentMission) updateFrame(currentTimeS);
  });
});

// UI controls
document.getElementById('material-select')!.addEventListener('change', (e) => {
  controller.setChassisMaterial((e.target as HTMLSelectElement).value as MaterialName);
  updateHeaderAndBom(); runSimulationAndSetup();
});

function setGpsActive(active: boolean): void {
  controller.setUseGps(active);
  document.getElementById('btn-gps-yes')!.classList.toggle('active', active);
  document.getElementById('btn-gps-no')!.classList.toggle('active', !active);
  updateHeaderAndBom();
  renderCatalog();
  runSimulationAndSetup();
}
document.getElementById('btn-gps-yes')!.addEventListener('click', () => setGpsActive(true));
document.getElementById('btn-gps-no')!.addEventListener('click', () => setGpsActive(false));

document.getElementById('btn-run-sim')!.addEventListener('click', () => runSimulationAndSetup(true));

document.getElementById('btn-play-pause')!.addEventListener('click', () => {
  isPlaying = !isPlaying;
  document.getElementById('btn-play-pause')!.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
});

document.getElementById('timeline-slider')!.addEventListener('input', (e) => {
  currentTimeS = parseFloat((e.target as HTMLInputElement).value);
  updateFrame(currentTimeS);
});

function exportData(fn: () => string, filename: string, type: string): void {
  if (!currentMission) return;
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([fn()], { type })), download: filename }).click();
}
document.getElementById('btn-export-csv')!.addEventListener('click', () => exportData(() => exportMissionTelemetryCsv(currentMission!), 'cansat_telemetry.csv', 'text/csv'));
document.getElementById('btn-export-json')!.addEventListener('click', () => exportData(() => exportMissionTelemetryJson(currentMission!), 'cansat_telemetry.json', 'application/json'));

updateHeaderAndBom();
renderCatalog();
runSimulationAndSetup();
requestAnimationFrame(animationLoop);
