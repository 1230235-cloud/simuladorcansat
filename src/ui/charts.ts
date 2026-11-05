export interface ChartDataSeries {
  times: number[];
  values: number[];
}

export function drawTimeSeriesChart(
  canvas: HTMLCanvasElement,
  data: ChartDataSeries,
  currentTime: number,
  options: {
    title: string;
    unit: string;
    targetBand?: [number, number];
    lineColor?: string;
    eventMarkerTime?: number;
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || data.times.length === 0) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const padL = 40;
  const padR = 15;
  const padT = 25;
  const padB = 25;
  const pw = w - padL - padR;
  const ph = h - padT - padB;

  const tMin = data.times[0];
  const tMax = data.times[data.times.length - 1];
  let vMin = Math.min(...data.values);
  let vMax = Math.max(...data.values);
  if (options.targetBand) {
    vMin = Math.min(vMin, options.targetBand[0] - 2);
    vMax = Math.max(vMax, options.targetBand[1] + 2);
  }
  if (vMax === vMin) vMax += 1;

  // Title
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText(`${options.title} (${options.unit})`, padL, 16);

  // Background target band (e.g. 8-12 m/s)
  if (options.targetBand) {
    const yTop = padT + (1 - (options.targetBand[1] - vMin) / (vMax - vMin)) * ph;
    const yBottom = padT + (1 - (options.targetBand[0] - vMin) / (vMax - vMin)) * ph;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fillRect(padL, yTop, pw, yBottom - yTop);
    ctx.fillStyle = '#22c55e';
    ctx.font = '9px monospace';
    ctx.fillText('Target 8-12 m/s', padL + 4, yTop + 10);
  }

  // Grid
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(padL, padT, pw, ph);

  // Separation event marker
  if (options.eventMarkerTime && options.eventMarkerTime >= tMin && options.eventMarkerTime <= tMax) {
    const xm = padL + ((options.eventMarkerTime - tMin) / (tMax - tMin)) * pw;
    ctx.strokeStyle = '#eab308';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xm, padT);
    ctx.lineTo(xm, padT + ph);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#eab308';
    ctx.font = '9px sans-serif';
    ctx.fillText('200m Sep', xm + 2, padT + ph - 4);
  }

  // Data curve
  ctx.strokeStyle = options.lineColor ?? '#38bdf8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i < data.times.length; i++) {
    const x = padL + ((data.times[i] - tMin) / (tMax - tMin)) * pw;
    const y = padT + (1 - (data.values[i] - vMin) / (vMax - vMin)) * ph;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Current time scrubber line
  if (currentTime >= tMin && currentTime <= tMax) {
    const xc = padL + ((currentTime - tMin) / (tMax - tMin)) * pw;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xc, padT);
    ctx.lineTo(xc, padT + ph);
    ctx.stroke();
  }
}

export function drawEggGauges(
  canvas: HTMLCanvasElement,
  gPrimary: number,
  gSecondary: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const drawGauge = (
    label: string,
    gVal: number,
    x: number,
    y: number,
    gw: number
  ) => {
    const isSafe = gVal <= 45.0;
    const pct = Math.min(1.0, gVal / 60.0);
    const color = isSafe ? '#22c55e' : '#ef4444';

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(label, x, y - 6);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, gw, 14);

    ctx.fillStyle = color;
    ctx.fillRect(x, y, gw * pct, 14);

    // Limit line at 45G
    const xLimit = x + gw * (45.0 / 60.0);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xLimit, y - 2);
    ctx.lineTo(xLimit, y + 16);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '10px monospace';
    ctx.fillText(`${gVal.toFixed(1)} G ${isSafe ? '(SURVIVED)' : '(BROKEN)'}`, x + 5, y + 11);
  };

  drawGauge('Primary Payload Egg (65g)', gPrimary, 20, 24, w - 40);
  drawGauge('Secondary Payload Egg (65g)', gSecondary, 20, 60, w - 40);
}

export function drawRelativeRadar(
  canvas: HTMLCanvasElement,
  distanceM: number,
  bearingRad: number,
  useGps: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + 10;
  const maxRadius = Math.min(cx, cy) - 20;

  // Title & Mode badge
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText(`Relative Tracking (${useGps ? 'GPS' : 'RSSI + Inertial'})`, 15, 18);

  // Radar rings
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  for (let r = 0.25; r <= 1.0; r += 0.25) {
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius * r, 0, 2 * Math.PI);
    ctx.stroke();
  }

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(cx - maxRadius, cy);
  ctx.lineTo(cx + maxRadius, cy);
  ctx.moveTo(cx, cy - maxRadius);
  ctx.lineTo(cx, cy + maxRadius);
  ctx.stroke();

  // Cardinal directions
  ctx.fillStyle = '#64748b';
  ctx.font = '9px monospace';
  ctx.fillText('N', cx - 3, cy - maxRadius + 10);
  ctx.fillText('S', cx - 3, cy + maxRadius - 3);
  ctx.fillText('E', cx + maxRadius - 10, cy + 3);
  ctx.fillText('W', cx - maxRadius + 3, cy + 3);

  // Center (Primary Payload)
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
  ctx.fill();

  // Target (Secondary Payload)
  const normDist = Math.min(1.0, distanceM / 100.0);
  const tx = cx + Math.sin(bearingRad) * maxRadius * normDist;
  const ty = cy - Math.cos(bearingRad) * maxRadius * normDist;

  ctx.strokeStyle = '#f43f5e';
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(tx, ty, 5, 0, 2 * Math.PI);
  ctx.fill();

  // Info label
  ctx.fillStyle = '#f8fafc';
  ctx.font = '10px monospace';
  ctx.fillText(`Dist: ${distanceM.toFixed(1)} m | Az: ${(bearingRad * (180 / Math.PI)).toFixed(0)}°`, 15, h - 8);
}
