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
    eventMarkerLabel?: string;
    yRange?: [number, number];
  }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || data.times.length === 0) return;

  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const padL = 40, padR = 15, padT = 25, padB = 25;
  const pw = w - padL - padR, ph = h - padT - padB;

  const tMin = data.times[0], tMax = data.times[data.times.length - 1];
  let vMin = Math.min(...data.values), vMax = Math.max(...data.values);
  if (options.yRange) {
    vMin = Math.min(vMin, options.yRange[0]);
    vMax = Math.max(vMax, options.yRange[1]);
  }
  if (options.targetBand) {
    vMin = Math.min(vMin, options.targetBand[0] - 2);
    vMax = Math.max(vMax, options.targetBand[1] + 2);
  }
  if (vMax === vMin) vMax += 1;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText(`${options.title} (${options.unit})`, padL, 16);

  if (options.targetBand) {
    const yTop = padT + (1 - (options.targetBand[1] - vMin) / (vMax - vMin)) * ph;
    const yBottom = padT + (1 - (options.targetBand[0] - vMin) / (vMax - vMin)) * ph;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fillRect(padL, yTop, pw, yBottom - yTop);
    ctx.fillStyle = '#22c55e';
    ctx.font = '9px monospace';
    ctx.fillText('Target 8-12 m/s', padL + 4, yTop + 10);
  }

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(padL, padT, pw, ph);

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
    ctx.fillText(options.eventMarkerLabel ?? 'Sep', xm + 2, padT + ph - 4);
  }

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
  gSecondary: number,
  causeP?: string,
  causeS?: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const drawGauge = (label: string, gVal: number, x: number, y: number, gw: number, cause?: string) => {
    const isSafe = gVal <= 45.0 && (!cause || cause === 'NONE');
    const pct = Math.min(1.0, gVal / 60.0);
    const color = isSafe ? '#22c55e' : '#ef4444';

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(label, x, y - 6);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, gw, 14);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, gw * pct, 14);

    const xLimit = x + gw * (45.0 / 60.0);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xLimit, y - 2);
    ctx.lineTo(xLimit, y + 16);
    ctx.stroke();

    const gStr = gVal > 999 ? `${gVal.toFixed(0)} G` : `${gVal.toFixed(1)} G`;
    const desc = isSafe ? `SURVIVED - ${gStr}` : `${gStr} [${cause === 'BOTTOM_OUT_CHASSIS_IMPACT' ? 'BOTTOM-OUT' : cause === 'SUSPENSION_BAND_SNAP' ? 'ROTURA LIGA' : 'SOBRETENSIÓN'}]`;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '10px monospace';
    ctx.fillText(desc, x + 5, y + 11);
  };

  drawGauge('Primary Egg (65g)', gPrimary, 20, 24, w - 40, causeP);
  drawGauge('Secondary Egg (65g)', gSecondary, 20, 60, w - 40, causeS);
}

export function drawRelativeRadar(
  canvas: HTMLCanvasElement,
  distanceM: number,
  bearingRad: number,
  useGps: boolean,
  secondaryHasRf = true
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2 + 10;
  const maxRadius = Math.min(cx, cy) - 20;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText(`Relative Tracking (${!secondaryHasRf ? 'CIEGO / SIN RF' : useGps ? 'GPS' : 'RSSI + IMU'})`, 15, 18);

  if (!secondaryHasRf) {
    ctx.fillStyle = '#ef4444';
    ctx.font = '9px sans-serif';
    ctx.fillText('⚠ Sin telemetría en Carga 2 - Solo predicción balística', 15, 30);
  }

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  for (let r = 0.25; r <= 1.0; r += 0.25) {
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius * r, 0, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(cx - maxRadius, cy);
  ctx.lineTo(cx + maxRadius, cy);
  ctx.moveTo(cx, cy - maxRadius);
  ctx.lineTo(cx, cy + maxRadius);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '9px monospace';
  ctx.fillText('N', cx - 3, cy - maxRadius + 10);
  ctx.fillText('S', cx - 3, cy + maxRadius - 3);
  ctx.fillText('E', cx + maxRadius - 10, cy + 3);
  ctx.fillText('W', cx - maxRadius + 3, cy + 3);

  // Primary position (center)
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
  ctx.fill();

  // Secondary position
  const normDist = Math.min(1.0, distanceM / 100.0);
  const tx = cx + Math.sin(bearingRad) * maxRadius * normDist;
  const ty = cy - Math.cos(bearingRad) * maxRadius * normDist;

  ctx.strokeStyle = secondaryHasRf ? '#f43f5e' : '#eab308';
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = secondaryHasRf ? '#f43f5e' : '#eab308';
  ctx.beginPath();
  ctx.arc(tx, ty, 5, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '10px monospace';
  ctx.fillText(`Dist: ${distanceM.toFixed(1)} m | Az: ${(bearingRad * (180 / Math.PI)).toFixed(0)}°`, 15, h - 8);
}
