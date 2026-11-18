// Tendencia del precio medio en tu provincia (últimos 14 días).

import { html, raw, eurL } from '../format.js';
import { lineChart } from '../chart.js';
import { fuelLabel, FUELS } from '/shared/fuels.js';

const NF1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cts = (delta) => `${NF1.format(Math.abs(Math.round(delta * 1000) / 10))} cts`;

/** Provincia con más gasolineras en la búsqueda. */
export function mainProvince(stations) {
  const count = new Map();
  for (const s of stations ?? []) if (s.idProvincia) count.set(s.idProvincia, (count.get(s.idProvincia) ?? 0) + 1);
  let best = null;
  for (const [p, n] of count) if (!best || n > best[1]) best = [p, n];
  return best?.[0] ?? null;
}

const TREND_TEXT = {
  down: { icon: '📉', word: 'bajando', hint: 'Si te queda depósito, esperar unos días puede salir algo más barato.' },
  up: { icon: '📈', word: 'subiendo', hint: 'Si vas a repostar pronto, mejor hoy que dentro de unos días.' },
  flat: { icon: '➖', word: 'estable', hint: 'Sin cambios importantes: reposta cuando te venga bien.' },
};

export function trendHtml(t, { fuel, open = false } = {}) {
  if (!t) return '';
  const name = fuelLabel(fuel);
  if (!t.summary?.trend) {
    return html`<p class="trend-card muted small">📊 Recopilando el precio medio de ${name} en ${t.provinceName} de los últimos días (${t.days} de ${t.series.length})…</p>`;
  }
  const s = t.summary;
  const txt = TREND_TEXT[s.trend];
  const nat = t.national?.trend
    ? html` · España: ${t.national.change < 0 ? '▼' : t.national.change > 0 ? '▲' : '='} ${cts(t.national.change)}`
    : '';
  const points = t.series.map((p) => ({ date: p.date, value: p.avg }));
  return html`
  <details class="trend-card trend-${s.trend}" ${open ? 'open' : ''}>
    <summary>${txt.icon} <b>${name} en ${t.provinceName}: ${txt.word}</b>
      ${s.trend === 'flat' ? '' : html`${s.change < 0 ? '▼' : '▲'} ${cts(s.change)}`} en ${s.days} días</summary>
    <div class="trend-body">
      ${raw(lineChart(points, { label: `Precio medio de ${name} en ${t.provinceName}` }))}
      <p class="small">Media hoy <b>${eurL(s.last)}</b> · hace ${s.days} días ${eurL(s.ref)}${nat}.</p>
      <p class="small">${txt.hint}</p>
      <p class="muted small">Media de las gasolineras de venta al público de la provincia, con los datos diarios del Ministerio. Es lo que ha pasado estos días, no una predicción.</p>
    </div>
  </details>`;
}

let cache = { key: null, data: null, at: 0 };

export async function renderTrend(ctx) {
  const { state, api } = ctx;
  const el = document.getElementById('trend');
  if (!el) return;
  const fuel = state.settings.fuel;
  const province = mainProvince(state.nearby?.stations);
  if (!province || !FUELS.some((f) => f.key === fuel)) {
    el.innerHTML = '';
    return;
  }
  const key = `${province}|${fuel}`;
  const open = el.querySelector('details')?.open ?? false;
  if (cache.key !== key || Date.now() - cache.at > 30 * 60 * 1000) {
    try {
      cache = { key, data: await api.trend({ province, fuel }), at: Date.now() };
    } catch {
      el.innerHTML = '';
      return;
    }
  }
  if (state.settings.fuel !== fuel) return; // cambió mientras se descargaba
  el.innerHTML = trendHtml(cache.data, { fuel, open });
}
