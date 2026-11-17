// Gráfico de líneas mínimo en SVG para el histórico de precios.

import { num3, esc } from './format.js';

export function lineChart(points, { width = 320, height = 140, label = '' } = {}) {
  const pts = points.filter((p) => p.value != null);
  if (pts.length < 2) return '<p class="muted small">No hay suficientes datos históricos.</p>';
  const pad = { l: 44, r: 10, t: 12, b: 22 };
  const vals = pts.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 0.01) { min -= 0.005; max += 0.005; }
  const x = (i) => pad.l + (i / (pts.length - 1)) * (width - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(pts.length - 1).toFixed(1)},${height - pad.b} L${x(0).toFixed(1)},${height - pad.b} Z`;
  const last = pts[pts.length - 1];
  const fmtDate = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const minIdx = vals.indexOf(Math.min(...vals));
  return `
  <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">
    <line class="grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y(max)}" y2="${y(max)}"/>
    <line class="grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y(min)}" y2="${y(min)}"/>
    <text class="axis" x="${pad.l - 6}" y="${y(max) + 4}" text-anchor="end">${num3(max)}</text>
    <text class="axis" x="${pad.l - 6}" y="${y(min) + 4}" text-anchor="end">${num3(min)}</text>
    <path class="area" d="${area}"/>
    <path class="line" d="${d}"/>
    <circle class="dot min" cx="${x(minIdx)}" cy="${y(vals[minIdx])}" r="3.5"><title>Mínimo: ${num3(vals[minIdx])} € (${esc(fmtDate(pts[minIdx].date))})</title></circle>
    <circle class="dot" cx="${x(pts.length - 1)}" cy="${y(last.value)}" r="4"><title>Hoy: ${num3(last.value)} €</title></circle>
    <text class="axis" x="${pad.l}" y="${height - 6}">${esc(fmtDate(pts[0].date))}</text>
    <text class="axis" x="${width - pad.r}" y="${height - 6}" text-anchor="end">${esc(fmtDate(last.date))}</text>
  </svg>`;
}
