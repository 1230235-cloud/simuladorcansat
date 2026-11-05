import {
  createDashboardController,
  exportMissionTelemetryCsv,
  exportMissionTelemetryJson,
} from './ui/dashboard';
import { interpolateSceneStateAtTime } from './ui/scene3d';
import { CanSat3DViewport } from './ui/viewport3d';
import {
  drawTimeSeriesChart,
  drawEggGauges,
  drawRelativeRadar,
} from './ui/charts';
import { parseCadFromBuffer, CadFormat } from './importers/cadLoader';
import { MissionResult } from './sim/flightLoop';
import { MaterialName } from './assembly/materials';

const controller = createDashboardController({ material: 'PLA', useGps: true });
const viewportContainer = document.getElementById('viewport3d-container')!;
const viewport = new CanSat3DViewport(viewportContainer);

let currentMission: MissionResult | null = null;
let currentTimeS = 0;
let isPlaying = false;
let followCam: 'overview' | 'primary' | 'secondary' = 'overview';
let lastRafTime = 0;

function updateHeaderAndBom(): void {
  const state = controller.getState();
  const massElem = document.getElementById('stat-mass')!;
  const envElem = document.getElementById('stat-envelope')!;
  const gpsElem = document.getElementById('stat-gps')!;
  const eggElem = document.getElementById('stat-eggs')!;

  const massG = (state.envelopeReport.totalMassKg * 1000).toFixed(1);
  massElem.textContent = `${massG} g / 600 g`;
  massElem.style.color = state.envelopeReport.totalMassKg <= 0.6 ? '#22c55e' : '#ef4444';

  envElem.textContent = state.envelopeReport.isValid ? 'VALID' : 'INVALID';
  envElem.style.color = state.envelopeReport.isValid ? '#22c55e' : '#ef4444';

  gpsElem.textContent = state.useGps ? 'GPS ACTIVE' : 'RSSI ONLY';
  eggElem.textContent = state.eggFractureAlert ? 'CRITICAL (>45G)' : 'INTACT (<=45G)';
  eggElem.style.color = state.eggFractureAlert ? '#ef4444' : '#22c55e';

  const tbody = document.getElementById('bom-tbody')!;
  tbody.innerHTML = '';
  const rows = [
    { name: 'Primary Chassis', sub: 'Primary', m: state.assembly.primary.chassisMassKg },
    { name: 'Secondary Chassis', sub: 'Secondary', m: state.assembly.secondary.chassisMassKg },
    ...state.assembly.primary.components.map((c) => ({
      name: c.id.replace(/_/g, ' '),
      sub: 'Primary',
      m: c.massKg,
    })),
    ...state.assembly.secondary.components.map((c) => ({
      name: c.id.replace(/_/g, ' '),
      sub: 'Secondary',
      m: c.massKg,
    })),
  ];
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.name}</td><td>${r.sub}</td><td>${(r.m * 1000).toFixed(1)} g</td>`;
    tbody.appendChild(tr);
  });
}

function renderCharts(mission: MissionResult, t: number): void {
  const times = mission.telemetryFrames.map((f) => f.timeS);
  const alts = mission.telemetryFrames.map((f) => f.barometer.estimatedAltitudeM);
  const vels = mission.telemetryFrames.map((f) => f.estimatedVelocityMS ?? 0);
  const rpms = mission.telemetryFrames.map((f) => f.imu.rpmZ);

  const cAlt = document.getElementById('chart-altitude') as HTMLCanvasElement;
  const cVel = document.getElementById('chart-velocity') as HTMLCanvasElement;
  const cRpm = document.getElementById('chart-rpm') as HTMLCanvasElement;
  const cEgg = document.getElementById('chart-eggs') as HTMLCanvasElement;
  const cRad = document.getElementById('chart-radar') as HTMLCanvasElement;

  drawTimeSeriesChart(cAlt, { times, values: alts }, t, {
    title: 'Altitude Profile',
    unit: 'm',
    eventMarkerTime: mission.events.separationTimeS,
  });

  drawTimeSeriesChart(cVel, { times, values: vels }, t, {
    title: 'Descent Velocity',
    unit: 'm/s',
    targetBand: [8, 12],
    lineColor: '#22c55e',
    eventMarkerTime: mission.events.separationTimeS,
  });

  drawTimeSeriesChart(cRpm, { times, values: rpms }, t, {
    title: 'Autogiro Rotor RPM',
    unit: 'RPM',
    lineColor: '#eab308',
  });

  drawEggGauges(
    cEgg,
    mission.impactReport.primary.peakGLoad,
    mission.impactReport.secondary.peakGLoad
  );

  const state = interpolateSceneStateAtTime(mission, t);
  const relDist = state.vectors.relativeDistanceM;
  drawRelativeRadar(cRad, relDist, state.bladeSpinAngleRad % (2 * Math.PI), controller.getState().useGps);
}

function runSimulationAndSetup(): void {
  currentMission = controller.runSimulation();
  const maxT = currentMission.telemetryFrames[currentMission.telemetryFrames.length - 1].timeS;
  const slider = document.getElementById('timeline-slider') as HTMLInputElement;
  slider.max = maxT.toFixed(2);
  currentTimeS = 0;
  slider.value = '0';
  document.getElementById('mission-status-badge')!.textContent = 'SIMULATED';
  document.getElementById('mission-status-badge')!.classList.add('active');
  renderCharts(currentMission, 0);
  updateFrame(0);
}

function updateFrame(t: number): void {
  if (!currentMission) return;
  const state = interpolateSceneStateAtTime(currentMission, t);
  viewport.updateState(state, followCam);
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
  }
  requestAnimationFrame(animationLoop);
}

// Bind UI controls
document.getElementById('material-select')!.addEventListener('change', (e) => {
  controller.setChassisMaterial((e.target as HTMLSelectElement).value as MaterialName);
  updateHeaderAndBom();
  runSimulationAndSetup();
});

document.getElementById('btn-gps-yes')!.addEventListener('click', () => {
  controller.setUseGps(true);
  document.getElementById('btn-gps-yes')!.classList.add('active');
  document.getElementById('btn-gps-no')!.classList.remove('active');
  updateHeaderAndBom();
  runSimulationAndSetup();
});

document.getElementById('btn-gps-no')!.addEventListener('click', () => {
  controller.setUseGps(false);
  document.getElementById('btn-gps-no')!.classList.add('active');
  document.getElementById('btn-gps-yes')!.classList.remove('active');
  updateHeaderAndBom();
  runSimulationAndSetup();
});

document.getElementById('btn-run-sim')!.addEventListener('click', () => {
  runSimulationAndSetup();
});

document.getElementById('btn-play-pause')!.addEventListener('click', () => {
  isPlaying = !isPlaying;
  document.getElementById('btn-play-pause')!.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
});

document.getElementById('timeline-slider')!.addEventListener('input', (e) => {
  currentTimeS = parseFloat((e.target as HTMLInputElement).value);
  updateFrame(currentTimeS);
});

document.querySelectorAll('.btn-cam').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.btn-cam').forEach((b) => b.classList.remove('active'));
    const target = e.currentTarget as HTMLButtonElement;
    target.classList.add('active');
    followCam = target.getAttribute('data-cam') as 'overview' | 'primary' | 'secondary';
  });
});

document.getElementById('cad-file-input')!.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const ext = file.name.split('.').pop()?.toLowerCase() as CadFormat;
  if (!['stl', 'obj', 'gltf', 'glb'].includes(ext)) {
    alert('Please upload a valid CAD file (.stl, .obj, .gltf, .glb)');
    return;
  }
  const buffer = await file.arrayBuffer();
  const geometry = parseCadFromBuffer(buffer, ext);
  viewport.loadCustomCadGeometry('primary', geometry);
});

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('btn-export-csv')!.addEventListener('click', () => {
  if (!currentMission) runSimulationAndSetup();
  if (currentMission) {
    const csv = exportMissionTelemetryCsv(currentMission);
    downloadFile(csv, 'cansat_telemetry.csv', 'text/csv');
  }
});

document.getElementById('btn-export-json')!.addEventListener('click', () => {
  if (!currentMission) runSimulationAndSetup();
  if (currentMission) {
    const json = exportMissionTelemetryJson(currentMission);
    downloadFile(json, 'cansat_telemetry.json', 'application/json');
  }
});

updateHeaderAndBom();
runSimulationAndSetup();
requestAnimationFrame(animationLoop);
