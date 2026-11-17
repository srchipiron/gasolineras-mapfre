// Cálculo de resultados: precio efectivo con tréboles, coste real del
// repostaje (incluido el desvío), filtros, orden y estadísticas.

import { findRule, percentFor, effectivePrice, treblesFor } from './treboles.js';
import { isOpenAt, parseSchedule } from './horario.js';

// Los km por carretera suelen ser ~30 % más que en línea recta.
export const ROAD_FACTOR = 1.3;

export const SORTS = {
  effective: 'Con tréboles',
  price: 'Surtidor',
  total: 'Coste real',
  distance: 'Distancia',
};

/**
 * Enriquece cada estación con los datos del carburante elegido.
 * @param {object[]} stations estaciones con `prices` y `distanceKm` (o `offRouteKm`)
 * @param {object} opts { fuel, program, overrides, litres, consumption, now }
 */
export function enrich(stations, opts) {
  const { fuel, program, overrides = {}, litres = 40, consumption = 6.5, now = new Date() } = opts;
  const trebolValue = program?.trebolValue ?? 1;
  const out = [];
  for (const st of stations) {
    const price = st.prices?.[fuel];
    if (price == null) continue;
    const rule = findRule(st, program, overrides);
    const pct = percentFor(rule, now);
    const eff = effectivePrice(price, pct, trebolValue);
    const detourKm = (st.offRouteKm ?? st.distanceKm ?? 0) * 2 * ROAD_FACTOR;
    const detourCost = (detourKm * consumption / 100) * price;
    const fillCost = litres * eff;
    const week = parseSchedule(st.schedule);
    out.push({
      station: st,
      price,
      rule,
      mapfre: !!rule,
      percent: pct,
      effective: eff,
      treboles: rule ? treblesFor(litres * price, pct) : 0,
      detourKm,
      detourCost,
      totalCost: fillCost + detourCost,
      open: isOpenAt(week, now),
    });
  }
  return out;
}

export function filterResults(list, { onlyMapfre = false, openNow = false, hideRestricted = true } = {}) {
  return list.filter((r) => {
    if (onlyMapfre && !r.mapfre) return false;
    if (openNow && r.open === false) return false;
    if (hideRestricted && r.station.saleType === 'R') return false;
    return true;
  });
}

const dist = (r) => r.station.offRouteKm ?? r.station.distanceKm ?? 0;
const COMPARATORS = {
  effective: (a, b) => a.effective - b.effective || a.price - b.price || dist(a) - dist(b),
  price: (a, b) => a.price - b.price || dist(a) - dist(b),
  total: (a, b) => a.totalCost - b.totalCost || dist(a) - dist(b),
  distance: (a, b) => dist(a) - dist(b) || a.effective - b.effective,
  along: (a, b) => (a.station.alongKm ?? 0) - (b.station.alongKm ?? 0),
};

export function sortResults(list, sort = 'effective') {
  return list.slice().sort(COMPARATORS[sort] ?? COMPARATORS.effective);
}

function minBy(list, key) {
  let best = null;
  for (const r of list) if (!best || r[key] < best[key]) best = r;
  return best;
}

/** Estadísticas de la zona y mejores opciones. */
export function summarize(list) {
  if (!list.length) return { count: 0 };
  const prices = list.map((r) => r.price).sort((a, b) => a - b);
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  const mapfreList = list.filter((r) => r.mapfre);
  const nonMapfre = list.filter((r) => !r.mapfre);
  return {
    count: list.length,
    mapfreCount: mapfreList.length,
    min: prices[0],
    max: prices[prices.length - 1],
    avg,
    median: prices[Math.floor(prices.length / 2)],
    p33: prices[Math.floor((prices.length - 1) / 3)],
    p66: prices[Math.floor(((prices.length - 1) * 2) / 3)],
    bestEffective: minBy(list, 'effective'),
    bestMapfre: minBy(mapfreList, 'effective'),
    bestNonMapfre: minBy(nonMapfre, 'price'),
    bestTotal: minBy(list, 'totalCost'),
  };
}

/** Categoría de precio para colorear: 'cheap' | 'mid' | 'expensive'. */
export function priceLevel(price, summary) {
  if (!summary || !summary.count || price == null) return 'mid';
  if (price <= summary.p33) return 'cheap';
  if (price > summary.p66) return 'expensive';
  return 'mid';
}
